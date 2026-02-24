import crypto from "crypto";
import { db } from "./storage";
import { exaCache } from "../drizzle/schema";
import { eq, lt } from "drizzle-orm";

interface ExaSearchParams {
  query: string;
  numResults?: number;
  type?: "neural" | "keyword";
  useAutoprompt?: boolean;
  includeDomains?: string[];
  contents?: {
    text?: {
      maxCharacters?: number;
    };
  };
}

interface ExaCacheConfig {
  cacheType: "market_intelligence" | "company_discovery" | "contact_enrichment";
  ttlDays?: number;
}

/**
 * Generate a deterministic hash of the Exa search parameters
 * This is used as the cache key
 */
function generateCacheKey(query: string, params: Partial<ExaSearchParams>): string {
  const cacheString = JSON.stringify({
    query,
    numResults: params.numResults || 10,
    type: params.type || "neural",
    useAutoprompt: params.useAutoprompt !== undefined ? params.useAutoprompt : true,
    includeDomains: params.includeDomains || [],
  });
  return crypto.createHash("sha256").update(cacheString).digest("hex");
}

/**
 * Get cached Exa search results if available and not expired
 */
export async function getCachedExaResults(
  query: string,
  params: Partial<ExaSearchParams>,
) {
  const queryHash = generateCacheKey(query, params);

  try {
    const cached = await db
      .select()
      .from(exaCache)
      .where(eq(exaCache.queryHash, queryHash))
      .limit(1);

    if (cached.length > 0) {
      const cacheEntry = cached[0];

      // Check if cache is expired
      if (new Date() > new Date(cacheEntry.expiresAt)) {
        console.log(`[ExaCache] Cache expired for query: ${query.substring(0, 50)}...`);
        return null;
      }

      // Update hit count
      await db
        .update(exaCache)
        .set({ hitCount: (cacheEntry.hitCount || 0) + 1 })
        .where(eq(exaCache.queryHash, queryHash));

      console.log(
        `[ExaCache] HIT: ${query.substring(0, 50)}... (hit count: ${(cacheEntry.hitCount || 0) + 1})`
      );
      return cacheEntry.results;
    }
  } catch (error) {
    console.error("[ExaCache] Error reading from cache:", error);
    // Continue without cache on error
  }

  return null;
}

/**
 * Store Exa search results in cache
 */
export async function cacheExaResults(
  query: string,
  params: Partial<ExaSearchParams>,
  results: any,
  config: ExaCacheConfig,
) {
  const queryHash = generateCacheKey(query, params);
  const ttlDays = config.ttlDays || 30;

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    await db.insert(exaCache).values({
      queryHash,
      query,
      results,
      exaParameters: {
        numResults: params.numResults || 10,
        type: params.type || "neural",
        useAutoprompt: params.useAutoprompt !== undefined ? params.useAutoprompt : true,
        includeDomains: params.includeDomains || [],
      },
      cacheType: config.cacheType,
      hitCount: 1,
      expiresAt,
      createdAt: new Date(),
    }).onConflictDoUpdate({
      target: exaCache.queryHash,
      set: {
        hitCount: (exaCache.hitCount || 0) + 1,
        expiresAt,
      },
    });

    console.log(
      `[ExaCache] CACHED: ${query.substring(0, 50)}... (TTL: ${ttlDays} days, type: ${config.cacheType})`
    );
  } catch (error) {
    console.error("[ExaCache] Error writing to cache:", error);
    // Non-critical - don't fail the operation
  }
}

/**
 * Clean up expired cache entries (optional maintenance)
 */
export async function cleanupExpiredCache() {
  try {
    const deleted = await db
      .delete(exaCache)
      .where(lt(exaCache.expiresAt, new Date()));

    if (deleted.rowCount > 0) {
      console.log(`[ExaCache] Cleaned up ${deleted.rowCount} expired cache entries`);
    }
  } catch (error) {
    console.error("[ExaCache] Error cleaning up expired cache:", error);
  }
}

/**
 * Wrapper for Exa API calls with caching
 * Usage:
 *   const results = await cachedExaSearch({
 *     query: "M&A deals",
 *     numResults: 10,
 *     type: "neural"
 *   }, {
 *     cacheType: "market_intelligence",
 *     ttlDays: 7
 *   });
 */
export async function cachedExaSearch(
  params: ExaSearchParams,
  config: ExaCacheConfig,
) {
  // Check cache first
  const cached = await getCachedExaResults(params.query, params);
  if (cached) {
    return cached;
  }

  // Call Exa API
  console.log(`[ExaCache] MISS: Calling Exa API for query: ${params.query.substring(0, 50)}...`);

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": process.env.EXA_API_KEY || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: params.query,
      numResults: params.numResults || 10,
      type: params.type || "neural",
      useAutoprompt: params.useAutoprompt !== undefined ? params.useAutoprompt : true,
      ...(params.includeDomains && { includeDomains: params.includeDomains }),
      contents: params.contents || {
        text: { maxCharacters: 1000 },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Exa API error: ${response.statusText}`);
  }

  const results = await response.json();

  // Cache the results
  await cacheExaResults(params.query, params, results, config);

  return results;
}

/**
 * Get cache statistics (for monitoring/debugging)
 */
export async function getCacheStats() {
  try {
    const stats = await db.select().from(exaCache);
    const totalHits = stats.reduce((sum, entry) => sum + (entry.hitCount || 0), 0);
    const costSavings = (totalHits - stats.length) * 0.002; // Approximate cost per Exa call

    return {
      totalCachedQueries: stats.length,
      totalHits: totalHits,
      missCount: stats.length, // Number of cache entries (misses)
      estimatedCostSavings: `$${costSavings.toFixed(2)}`,
      breakdown: {
        market_intelligence: stats.filter((s) => s.cacheType === "market_intelligence").length,
        company_discovery: stats.filter((s) => s.cacheType === "company_discovery").length,
        contact_enrichment: stats.filter((s) => s.cacheType === "contact_enrichment").length,
      },
    };
  } catch (error) {
    console.error("[ExaCache] Error getting stats:", error);
    return null;
  }
}
