import Anthropic from "@anthropic-ai/sdk";
import { db } from "../drizzle/schema";
import * as schema from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { ApolloEnrichment } from "./apollo-enrichment";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable =
        error?.status === 429 ||
        error?.status === 502 ||
        error?.status === 503 ||
        error?.message?.includes('ECONNRESET') ||
        error?.message?.includes('ETIMEDOUT') ||
        error?.message?.includes('overloaded');

      if (!isRetryable || attempt === maxRetries) {
        console.error(`[WI Retry] ${label} failed after ${attempt} attempt(s):`, error?.message || error);
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[WI Retry] ${label} attempt ${attempt} failed (${error?.status || error?.message}), retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error(`${label} failed after ${maxRetries} retries`);
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface HotSector {
  name: string;
  heatScore: number;
  reasoning: string;
  dealActivity: string;
  averageMultiple: string;
  activeBuyers: string[];
  searchQuery: string;
}

interface DiscoveredCompany {
  title: string;
  url: string;
  text: string;
}

export class WeeklyIntelligenceEngine {
  async runWeeklyScan(): Promise<number> {
    const monday = getMonday(new Date());
    console.log(`[WI] ========================================`);
    console.log(`[WI] Starting Weekly Intelligence Scan`);
    console.log(`[WI] Week of: ${monday.toISOString().split('T')[0]}`);
    console.log(`[WI] ========================================`);

    // Idempotency: check if a trend for this week already exists
    const existing = await db
      .select()
      .from(schema.weeklyTrends)
      .where(eq(schema.weeklyTrends.weekStarting, monday))
      .limit(1);

    if (existing.length > 0 && existing[0].scanCompletedAt) {
      console.log(`[WI] Scan for week of ${monday.toISOString().split('T')[0]} already completed (ID: ${existing[0].id}). Skipping.`);
      return existing[0].id;
    }

    // Create or reuse trend record
    let trendId: number;
    if (existing.length > 0) {
      trendId = existing[0].id;
      console.log(`[WI] Resuming incomplete scan (ID: ${trendId})`);
    } else {
      const [trend] = await db
        .insert(schema.weeklyTrends)
        .values({ weekStarting: monday })
        .returning();
      trendId = trend.id;
      console.log(`[WI] Created trend record ID: ${trendId}`);
    }

    try {
      // Step 1: Scan M&A News
      console.log(`[WI] Step 1/5: Scanning M&A news...`);
      const newsData = await this.scanMAndANews();
      await db
        .update(schema.weeklyTrends)
        .set({ rawNewsData: newsData })
        .where(eq(schema.weeklyTrends.id, trendId));
      console.log(`[WI] Step 1 complete: ${newsData.length} news items collected`);

      // Step 2: Identify Hot Sectors
      console.log(`[WI] Step 2/5: Identifying hot sectors with Claude...`);
      const sectors = await this.identifyHotSectors(newsData);
      const sectorRows = [];
      for (const sector of sectors) {
        const [row] = await db
          .insert(schema.hotSectors)
          .values({
            trendWeekId: trendId,
            sectorName: sector.name,
            heatScore: Math.round(sector.heatScore),
            reasoning: sector.reasoning,
            dealActivity: sector.dealActivity,
            averageMultiple: sector.averageMultiple,
            activeBuyers: sector.activeBuyers,
            searchQuery: sector.searchQuery,
            status: "scanning",
          })
          .returning();
        sectorRows.push({ ...sector, dbId: row.id });
      }
      console.log(`[WI] Step 2 complete: ${sectorRows.length} hot sectors identified`);

      // Step 3: Discover Companies per sector
      console.log(`[WI] Step 3/5: Discovering target companies...`);
      for (const sector of sectorRows) {
        console.log(`[WI]   Searching sector: ${sector.name}`);
        const companies = await this.discoverCompaniesForSector(sector);
        console.log(`[WI]   Found ${companies.length} companies for ${sector.name}`);

        // Save as target_contacts
        for (const company of companies) {
          await db.insert(schema.targetContacts).values({
            sectorId: sector.dbId,
            companyName: company.title,
            companyWebsite: company.url,
            estimatedRevenue: null,
            ownershipType: "Unknown",
            enrichmentStatus: "pending",
          });
        }
      }
      console.log(`[WI] Step 3 complete`);

      // Step 4: Classify & Enrich
      console.log(`[WI] Step 4/5: Classifying ownership & enriching contacts...`);
      for (const sector of sectorRows) {
        const contacts = await db
          .select()
          .from(schema.targetContacts)
          .where(eq(schema.targetContacts.sectorId, sector.dbId));

        await this.classifyAndEnrichContacts(sector.dbId, contacts);
      }
      console.log(`[WI] Step 4 complete`);

      // Step 5: Generate Newsletters
      console.log(`[WI] Step 5/5: Generating newsletters...`);
      for (const sector of sectorRows) {
        const contacts = await db
          .select()
          .from(schema.targetContacts)
          .where(eq(schema.targetContacts.sectorId, sector.dbId));

        const nonPeContacts = contacts.filter(c => c.ownershipType !== "PE-Backed");
        await this.generateNewsletter(sector, nonPeContacts);

        await db
          .update(schema.hotSectors)
          .set({ status: "ready" })
          .where(eq(schema.hotSectors.id, sector.dbId));
      }

      // Mark scan as complete
      await db
        .update(schema.weeklyTrends)
        .set({ scanCompletedAt: new Date() })
        .where(eq(schema.weeklyTrends.id, trendId));

      console.log(`[WI] ========================================`);
      console.log(`[WI] Weekly Intelligence Scan COMPLETE`);
      console.log(`[WI] Trend ID: ${trendId}, Sectors: ${sectorRows.length}`);
      console.log(`[WI] ========================================`);
      return trendId;
    } catch (error: any) {
      console.error(`[WI] Weekly scan FAILED:`, error?.message || error);
      throw error;
    }
  }

  private async scanMAndANews(): Promise<any[]> {
    const queries = [
      "M&A deals closed this week middle market acquisitions 2026",
      "private equity acquisitions lower middle market recent",
      "industry consolidation trends $20M-$100M companies acquired",
      "founder-led company acquisitions strategic buyers 2026",
    ];

    const allResults: any[] = [];

    for (const query of queries) {
      try {
        const response = await withRetry(() => fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.EXA_API_KEY || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            numResults: 10,
            type: 'neural',
            useAutoprompt: true,
            contents: {
              text: { maxCharacters: 1000 },
            },
          }),
        }), `Exa search: ${query.substring(0, 40)}...`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[WI] Exa error for query "${query}":`, errorText);
          continue;
        }

        const data = await response.json();
        if (data.results) {
          allResults.push(...data.results);
          console.log(`[WI]   Query "${query.substring(0, 40)}..." → ${data.results.length} results`);
        }
      } catch (error: any) {
        console.error(`[WI] Exa search failed for "${query}":`, error?.message);
      }
    }

    // Deduplicate by URL
    const unique = new Map<string, any>();
    for (const result of allResults) {
      if (result.url && !unique.has(result.url)) {
        unique.set(result.url, result);
      }
    }

    return Array.from(unique.values());
  }

  private async identifyHotSectors(newsData: any[]): Promise<HotSector[]> {
    const newsSnippets = newsData
      .map((n, i) => `[${i + 1}] ${n.title}\n${n.text?.substring(0, 300) || 'No text'}`)
      .join('\n\n');

    const prompt = `Analyze these M&A news results from recent searches. Identify the top 5 hottest sectors for sell-side M&A advisory opportunities in the lower middle market ($20M-$100M revenue companies).

NEWS DATA:
${newsSnippets}

For each sector, provide:
- name: Clear sector name (e.g., "Healthcare IT Services", "Industrial Automation")
- heatScore: 1-100 rating of how hot this sector is for M&A activity
- reasoning: 2-3 sentences explaining why this sector is hot
- dealActivity: Brief description of recent deal activity
- averageMultiple: Estimated EBITDA multiple range (e.g., "6x-8x EBITDA")
- activeBuyers: Array of 3-5 known active buyers/PE firms in this space
- searchQuery: An Exa search query to find target companies in this sector (be specific about the type of company)

Return ONLY valid JSON with this exact structure:
{
  "sectors": [
    {
      "name": "...",
      "heatScore": 85,
      "reasoning": "...",
      "dealActivity": "...",
      "averageMultiple": "...",
      "activeBuyers": ["Buyer 1", "Buyer 2"],
      "searchQuery": "..."
    }
  ]
}`;

    const response = await withRetry(() => anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }), 'Claude hot sector analysis');

    let jsonText = "";
    for (const block of response.content) {
      if (block.type === "text") jsonText += block.text;
    }

    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[WI] Could not parse hot sectors JSON from Claude");
      throw new Error("Failed to parse hot sectors from Claude response");
    }

    const data = JSON.parse(jsonMatch[0]);
    const sectors: HotSector[] = (data.sectors || []).slice(0, 5).map((s: any) => ({
      name: s.name || "Unknown Sector",
      heatScore: Math.round(s.heatScore ?? 50),
      reasoning: s.reasoning || "",
      dealActivity: s.dealActivity || "",
      averageMultiple: s.averageMultiple || "",
      activeBuyers: Array.isArray(s.activeBuyers) ? s.activeBuyers : [],
      searchQuery: s.searchQuery || s.name,
    }));

    return sectors;
  }

  private async discoverCompaniesForSector(sector: HotSector & { dbId: number }): Promise<DiscoveredCompany[]> {
    const query = `${sector.searchQuery} $20M-$100M revenue founder-led family-owned independent NOT private equity NOT PE-backed`;

    const response = await withRetry(() => fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.EXA_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        numResults: 15,
        type: 'neural',
        useAutoprompt: true,
        contents: {
          text: { maxCharacters: 800 },
        },
      }),
    }), `Exa company discovery for ${sector.name}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[WI] Exa error discovering companies for ${sector.name}:`, errorText);
      return [];
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) return [];

    // Deduplicate by URL
    const unique = new Map<string, DiscoveredCompany>();
    for (const r of data.results) {
      if (r.url && !unique.has(r.url)) {
        unique.set(r.url, {
          title: r.title || "Unknown Company",
          url: r.url,
          text: r.text || "",
        });
      }
    }

    return Array.from(unique.values());
  }

  private async classifyAndEnrichContacts(
    sectorId: number,
    contacts: (typeof schema.targetContacts.$inferSelect)[]
  ): Promise<void> {
    if (contacts.length === 0) return;

    // Batch classify with Claude (batches of 10)
    const BATCH_SIZE = 10;
    let peBackedCount = 0;

    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      const companyList = batch
        .map((c, idx) => `${idx + 1}. ${c.companyName} (${c.companyWebsite || 'no website'})`)
        .join('\n');

      const prompt = `Classify each company's ownership type based on what you know. Return JSON only.

Companies:
${companyList}

For each company, determine:
- ownershipType: "Founder-Led", "Family-Owned", "PE-Backed", or "Unknown"
- estimatedRevenue: rough estimate like "$30M" or "Unknown"

Return ONLY valid JSON:
{
  "companies": [
    { "index": 1, "ownershipType": "Founder-Led", "estimatedRevenue": "$25M" }
  ]
}`;

      try {
        const response = await withRetry(() => anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }), `Claude PE classification batch ${Math.floor(i / BATCH_SIZE) + 1}`);

        let jsonText = "";
        for (const block of response.content) {
          if (block.type === "text") jsonText += block.text;
        }

        jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          const classifications = data.companies || [];

          for (const cls of classifications) {
            const idx = (cls.index || 0) - 1;
            if (idx >= 0 && idx < batch.length) {
              const contact = batch[idx];
              const isPE = cls.ownershipType === "PE-Backed";
              if (isPE) peBackedCount++;

              await db
                .update(schema.targetContacts)
                .set({
                  ownershipType: cls.ownershipType || "Unknown",
                  estimatedRevenue: cls.estimatedRevenue || null,
                })
                .where(eq(schema.targetContacts.id, contact.id));
            }
          }
        }
      } catch (error: any) {
        console.error(`[WI] PE classification batch failed:`, error?.message);
      }
    }

    // Update PE filtered count on sector
    await db
      .update(schema.hotSectors)
      .set({ peBackedFiltered: peBackedCount })
      .where(eq(schema.hotSectors.id, sectorId));

    console.log(`[WI]   Classified ${contacts.length} companies, ${peBackedCount} PE-backed filtered`);

    // Apollo enrichment (optional)
    const apolloApiKey = process.env.APOLLO_API_KEY;
    if (!apolloApiKey) {
      console.log(`[WI]   No Apollo API key — skipping contact enrichment`);
      return;
    }

    const apollo = new ApolloEnrichment(apolloApiKey);
    const nonPeContacts = await db
      .select()
      .from(schema.targetContacts)
      .where(eq(schema.targetContacts.sectorId, sectorId));

    const toEnrich = nonPeContacts.filter(c => c.ownershipType !== "PE-Backed");

    for (const contact of toEnrich) {
      try {
        const searchResult = await apollo.enrichContacts([
          {
            name: contact.companyName,
            title: "CEO",
            company: contact.companyName,
          },
        ]);

        if (searchResult.length > 0 && searchResult[0].verified) {
          await db
            .update(schema.targetContacts)
            .set({
              contactName: searchResult[0].name !== contact.companyName ? searchResult[0].name : null,
              contactEmail: searchResult[0].email || null,
              contactPhone: searchResult[0].phone || null,
              enrichmentStatus: "enriched",
            })
            .where(eq(schema.targetContacts.id, contact.id));
        } else {
          await db
            .update(schema.targetContacts)
            .set({ enrichmentStatus: "no_results" })
            .where(eq(schema.targetContacts.id, contact.id));
        }
      } catch (error: any) {
        console.error(`[WI]   Apollo enrichment failed for ${contact.companyName}:`, error?.message);
        await db
          .update(schema.targetContacts)
          .set({ enrichmentStatus: "failed" })
          .where(eq(schema.targetContacts.id, contact.id));
      }
    }

    console.log(`[WI]   Apollo enrichment attempted for ${toEnrich.length} non-PE contacts`);
  }

  private async generateNewsletter(
    sector: HotSector & { dbId: number },
    contacts: (typeof schema.targetContacts.$inferSelect)[]
  ): Promise<void> {
    const companyList = contacts
      .map(c => `- ${c.companyName}${c.estimatedRevenue ? ` (est. ${c.estimatedRevenue})` : ''}`)
      .join('\n');

    const prompt = `Write a market intelligence newsletter for M&A advisors focused on the "${sector.name}" sector.

SECTOR DATA:
- Heat Score: ${sector.heatScore}/100
- Deal Activity: ${sector.dealActivity}
- Average Multiples: ${sector.averageMultiple}
- Active Buyers: ${sector.activeBuyers.join(', ')}
- Reasoning: ${sector.reasoning}

TARGET COMPANIES IDENTIFIED (${contacts.length}):
${companyList || 'No companies identified yet'}

TONE & STYLE:
- Expert M&A advisor tone — knowledgeable, confident, authoritative
- 90% informative market intelligence, 10% subtle exit-timing hints
- NOT a sales pitch — this is a valuable market update that happens to make business owners think about timing
- Include specific data points, multiples, and buyer names
- End with a soft observation about market timing (not a CTA)

STRUCTURE:
1. Subject line (compelling, not clickbait)
2. Opening hook (market trend or notable deal)
3. Sector overview with data
4. Why buyers are active in this space
5. What this means for business owners in ${sector.name}
6. Market timing observation

Return the newsletter in this JSON format:
{
  "subject": "...",
  "content": "..."
}

The content should be formatted in clean HTML suitable for email.`;

    const response = await withRetry(() => anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }), `Claude newsletter for ${sector.name}`);

    let jsonText = "";
    for (const block of response.content) {
      if (block.type === "text") jsonText += block.text;
    }

    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

    let subject = `${sector.name} — Weekly M&A Intelligence`;
    let content = jsonText;

    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[0]);
        subject = data.subject || subject;
        content = data.content || content;
      } catch {
        // Use raw text as content if JSON parse fails
        console.warn(`[WI] Newsletter JSON parse failed for ${sector.name}, using raw text`);
      }
    }

    await db.insert(schema.sectorNewsletters).values({
      sectorId: sector.dbId,
      subject,
      content,
    });

    console.log(`[WI]   Newsletter generated for ${sector.name}: "${subject}"`);
  }
}

export const weeklyIntelligenceEngine = new WeeklyIntelligenceEngine();
