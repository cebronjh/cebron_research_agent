import Anthropic from "@anthropic-ai/sdk";
import { db, discoveryQueue, reports } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { enrichResearchWithApollo } from "./apollo-enrichment";
import { addPatentIntelligence, evaluatePatentUpside } from "./uspto-patents";
import { addFDAIntelligence } from "./fda-data";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// NO exa-js import - using direct API calls

interface SearchCriteria {
  query: string;
  industry?: string;
  revenueRange?: string;
  geographicFocus?: string;
  strategy?: "buy-side" | "sell-side" | "dual";
  maxResults?: number;
}

interface AutoApprovalRules {
  minScore: number;
  requiredConfidence: "High" | "Medium" | "Low";
  requiredIndustries?: string[];
  requiredRevenueRange?: string;
}

export class AgentOrchestrator {
  async runDiscoveryWorkflow(configId: number): Promise<number> {
    console.log(`[Agent] Starting discovery workflow for config ${configId}`);

    // Import storage functions here to avoid circular dependencies
    const { storage } = await import("./storage");
    
    const config = await storage.getAgentConfig(configId);
    if (!config) {
      throw new Error(`Config ${configId} not found`);
    }

    const workflow = await storage.createWorkflow({
      status: "running",
      triggerType: "scheduled",
      searchCriteria: config.searchCriteria,
      companiesFound: 0,
      companiesScored: 0,
      companiesAutoApproved: 0,
      companiesManualReview: 0,
      companiesResearched: 0,
    });

    try {
      const companies = await this.discoverCompanies(config.searchCriteria);
      await storage.updateWorkflow(workflow.id, {
        companiesFound: companies.length,
      });

      const scoredCompanies = await this.scoreCompanies(companies, config.searchCriteria);
      await storage.updateWorkflow(workflow.id, {
        companiesScored: scoredCompanies.length,
      });

      const { autoApproved, needsReview } = await this.applyAutoApproval(
        scoredCompanies,
        config.autoApprovalRules,
        workflow.id,
        config.searchCriteria.strategy || 'buy-side'
      );

      await storage.updateWorkflow(workflow.id, {
        companiesAutoApproved: autoApproved.length,
        companiesManualReview: needsReview.length,
      });

      // Research in parallel batches of 3 to reduce total workflow time
      let researched = 0;
      const BATCH_SIZE = 3;
      const strategy = config.searchCriteria.strategy || 'buy-side';

      for (let i = 0; i < autoApproved.length; i += BATCH_SIZE) {
        const batch = autoApproved.slice(i, i + BATCH_SIZE);
        console.log(`[Agent] Research batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(autoApproved.length / BATCH_SIZE)}: ${batch.map(c => c.title).join(', ')}`);

        const results = await Promise.allSettled(
          batch.map(company => this.researchCompany(company, workflow.id, strategy))
        );

        for (let j = 0; j < results.length; j++) {
          if (results[j].status === 'fulfilled') {
            researched++;
          } else {
            console.error(`[Agent] Research failed for ${batch[j].title}:`, (results[j] as PromiseRejectedResult).reason);
          }
        }

        // Update progress after each batch
        await storage.updateWorkflow(workflow.id, { companiesResearched: researched });
      }

      await storage.updateWorkflow(workflow.id, {
        companiesResearched: researched,
        status: "completed",
        completedAt: new Date(),
      });

      console.log(`[Agent] Workflow ${workflow.id} complete: ${researched} companies researched, ${needsReview.length} need review`);
      return workflow.id;
    } catch (error) {
      await storage.updateWorkflow(workflow.id, {
        status: "failed",
        completedAt: new Date(),
      });
      throw error;
    }
  }

  private async discoverCompanies(criteria: SearchCriteria): Promise<any[]> {
    console.log("[Agent] Discovering companies with Exa (direct API)...");

    const query = this.buildExaQuery(criteria);
    
    console.log("[Agent] Calling Exa API directly with query:", query);

    // Direct API call to Exa - NO exa-js library
    const response = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.EXA_API_KEY || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        numResults: criteria.maxResults || 35,
        type: 'neural',
        useAutoprompt: true,
        contents: {
          text: {
            maxCharacters: 1000
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Agent] Exa API error response:`, errorText);
      throw new Error(`Exa API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log(`[Agent] Exa API returned ${data.results?.length || 0} results`);

    if (!data.results || data.results.length === 0) {
      console.warn("[Agent] Exa returned no results for query:", query);
      return [];
    }

    // Deduplicate by company name (case-insensitive)
    const uniqueCompanies = new Map();
    for (const company of data.results) {
      const normalizedName = company.title.toLowerCase().trim();
      if (!uniqueCompanies.has(normalizedName)) {
        uniqueCompanies.set(normalizedName, company);
      }
    }
    const deduped = Array.from(uniqueCompanies.values());

    // Cross-run deduplication: skip companies already in discovery queue
    const { storage } = await import("./storage");
    const newCompanies = [];
    let skippedCount = 0;
    for (const company of deduped) {
      const existing = await storage.findExistingCompany(company.title, company.url);
      if (existing) {
        skippedCount++;
        console.log(`[Agent] Skipping ${company.title} - already in queue (ID: ${existing.id}, status: ${existing.approvalStatus})`);
      } else {
        newCompanies.push(company);
      }
    }

    console.log(`[Agent] Found ${data.results.length} companies, ${deduped.length} after dedup, ${newCompanies.length} new (${skippedCount} already known)`);
    return newCompanies;
  }

  private buildExaQuery(criteria: SearchCriteria): string {
    const parts = [criteria.query];
    if (criteria.industry) parts.push(criteria.industry);
    if (criteria.revenueRange) parts.push(criteria.revenueRange);
    if (criteria.geographicFocus) parts.push(criteria.geographicFocus);
    return parts.join(" ");
  }

  private async scoreCompanies(companies: any[], criteria: SearchCriteria): Promise<any[]> {
    console.log("[Agent] Scoring companies with Claude...");

    const scored = [];

    for (const company of companies) {
      try {
        const score = await this.scoreCompany(company, criteria);
        scored.push({ ...company, ...score, strategy: criteria.strategy });
        console.log(`[Agent] Scored ${company.title}: ${score.score}/10 (${score.confidence})`);
      } catch (error) {
        console.error(`[Agent] Failed to score ${company.title}, skipping:`, error);
      }
    }

    // Apply revenue filters
    const filtered = [];

    for (const c of scored) {
      if (c.score < 3) continue;

      const revenue = this.parseRevenue(c.estimatedRevenue);

      if (revenue > 150000000) {
        console.log(`[Agent] Filtered out ${c.title}: Revenue too high ($${revenue/1000000}M)`);
        continue;
      }

      if (revenue < 10000000 && revenue > 0) {
        console.log(`[Agent] ${c.title} below revenue threshold ($${revenue/1000000}M) - checking IP upside...`);
        const hasIPUpside = await this.checkIPUpside(c.title);

        if (hasIPUpside) {
          c.ipUpside = true;
          c.score += 1;
          console.log(`[Agent] ✓ IP upside detected for ${c.title} - score boosted`);
        } else {
          console.log(`[Agent] No IP upside for ${c.title} - keeping with current score`);
        }
      }

      filtered.push(c);
    }

    console.log(`[Agent] ${filtered.length} companies passed filters`);
    return filtered;
  }

  private parseRevenue(revenueStr: string): number {
    if (!revenueStr) return 0;
    
    const cleanStr = revenueStr.toLowerCase().replace(/[,$]/g, '');
    const num = parseFloat(cleanStr);
    
    if (cleanStr.includes('b')) return num * 1000000000;
    if (cleanStr.includes('m')) return num * 1000000;
    if (cleanStr.includes('k')) return num * 1000;
    
    return num;
  }

  private async checkIPUpside(companyName: string): Promise<boolean> {
    try {
      const result = await evaluatePatentUpside(companyName);
      return result;
    } catch (error) {
      console.error(`[Agent] Error checking IP upside:`, error);
      return false;
    }
  }

  private async scoreCompany(company: any, criteria: SearchCriteria): Promise<any> {
    const prompt = `Score this company for M&A target fit (1-10):

Company: ${company.title}
URL: ${company.url}
Description: ${company.text}

Criteria:
- Industry: ${criteria.industry || "Any"}
- Revenue: ${criteria.revenueRange || "Any"}
- Geography: ${criteria.geographicFocus || "Any"}
- Strategy: ${criteria.strategy || "buy-side"}

Return JSON only with this structure:
{
  "score": 8,
  "confidence": "High",
  "reasoning": "...",
  "estimatedRevenue": "$25M",
  "industry": "Healthcare",
  "geographicFocus": "United States",
  "industryMatch": true,
  "ownershipType": "Founder-Led",
  "ownershipNotes": "Founded in 2015, still led by original founders"
}

For ownershipType, determine from the description:
- "Founder-Led" if still run by founders
- "PE-Backed" if owned by private equity
- "Family-Owned" if multi-generational family business
- "Unknown" if unclear

Confidence levels:
- High: Clear fit, strong indicators
- Medium: Reasonable fit, some uncertainty
- Low: Marginal fit or significant gaps`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    let jsonText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        jsonText += block.text;
      }
    }

    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // Extract JSON object even if surrounded by extra text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[Agent] Could not find JSON in Claude response for ${company.title}:`, jsonText.substring(0, 200));
      return {
        score: 5,
        confidence: "Low",
        reasoning: "Failed to parse scoring response",
        estimatedRevenue: "",
        industryMatch: false,
        industry: criteria.industry || "Unknown",
        geographicFocus: criteria.geographicFocus || "",
        ownershipType: "Unknown",
        ownershipNotes: "",
      };
    }

    let data;
    try {
      data = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error(`[Agent] JSON parse error for ${company.title}:`, parseError, jsonMatch[0].substring(0, 200));
      return {
        score: 5,
        confidence: "Low",
        reasoning: "Failed to parse scoring response",
        estimatedRevenue: "",
        industryMatch: false,
        industry: criteria.industry || "Unknown",
        geographicFocus: criteria.geographicFocus || "",
        ownershipType: "Unknown",
        ownershipNotes: "",
      };
    }

    return {
      score: data.score ?? 5,
      confidence: data.confidence ?? "Low",
      reasoning: data.reasoning ?? "",
      estimatedRevenue: data.estimatedRevenue ?? "",
      industryMatch: data.industryMatch ?? false,
      industry: data.industry || criteria.industry,
      geographicFocus: data.geographicFocus || criteria.geographicFocus,
      ownershipType: data.ownershipType || 'Unknown',
      ownershipNotes: data.ownershipNotes || '',
    };
  }

  private async applyAutoApproval(
    companies: any[],
    rules: AutoApprovalRules,
    workflowId: number,
    strategy: 'buy-side' | 'sell-side' | 'dual'
  ): Promise<{ autoApproved: any[]; needsReview: any[] }> {
    const autoApproved = [];
    const needsReview = [];

    const { storage } = await import("./storage");

    for (const company of companies) {
      const queueItem = await storage.addToDiscoveryQueue({
        workflowId,
        companyName: company.title,
        websiteUrl: company.url,
        description: company.text,
        agentScore: company.score,
        scoringReason: company.reasoning,
        confidence: company.confidence,
        estimatedRevenue: company.estimatedRevenue,
        industry: company.industry,
        geographicFocus: company.geographicFocus,
        approvalStatus: "pending",
      });

      // Hardcoded score >= 6 threshold for broader auto-approval (20-30 companies)
      const minScore = 6;
      const confidenceLevels: Record<string, number> = { "Low": 1, "Medium": 2, "High": 3 };
      const requiredConfidenceLevel = confidenceLevels["Low"] ?? 1;
      const companyConfidenceLevel = confidenceLevels[company.confidence] ?? 1;

      const isPEBackedBuySide =
        (company.ownershipType === 'PE-Backed') &&
        strategy === 'buy-side';

      const revenue = this.parseRevenue(company.estimatedRevenue);
      const belowThresholdWithIP = revenue < 10000000 && company.ipUpside;

      let reviewReason = '';

      if (isPEBackedBuySide) {
        reviewReason = 'PE-backed company - requires manual review for buy-side strategy (competitive auction risk)';
      } else if (belowThresholdWithIP) {
        reviewReason = `Below revenue threshold ($${(revenue/1000000).toFixed(1)}M) but significant IP upside detected - manual review recommended`;
      } else if (revenue > 150000000) {
        reviewReason = `Above revenue threshold ($${(revenue/1000000).toFixed(0)}M) - likely too large, requires manual review`;
      } else if (company.score < minScore) {
        reviewReason = `Score ${company.score}/10 below threshold (${minScore})`;
      } else if (companyConfidenceLevel < requiredConfidenceLevel) {
        reviewReason = `Confidence ${company.confidence} below required ${rules?.requiredConfidence ?? "Medium"}`;
      }

      // Auto-approve using configured rules
      const shouldAutoApprove =
        company.score >= minScore &&
        companyConfidenceLevel >= requiredConfidenceLevel &&
        !isPEBackedBuySide &&
        !belowThresholdWithIP &&
        revenue <= 150000000;

      if (shouldAutoApprove) {
        await storage.updateDiscoveryQueueItem(queueItem.id, {
          approvalStatus: "auto_approved",
          autoApprovalReason: `Score ${company.score}/10, ${company.confidence} confidence${company.ownershipType !== 'Unknown' ? ', ' + company.ownershipType : ''}`,
          approvedAt: new Date(),
        });
        autoApproved.push({ ...company, queueId: queueItem.id });
        console.log(`[Agent] ✓ Auto-approved: ${company.title} (${company.score}/10)`);
      } else {
        await storage.updateDiscoveryQueueItem(queueItem.id, {
          approvalStatus: "pending",
          autoApprovalReason: reviewReason || `Score ${company.score}/10 or needs review`,
        });
        needsReview.push({ ...company, queueId: queueItem.id });
        console.log(`[Agent] → Manual review: ${company.title} (${reviewReason || company.score + '/10'})`);
      }
    }

    console.log(`[Agent] Auto-approval summary: ${autoApproved.length} approved, ${needsReview.length} need review (threshold: score >= ${minScore})`);
    return { autoApproved, needsReview };
  }

  // Public method for manual approvals
  async researchCompanyById(queueId: number): Promise<void> {
    console.log(`[Agent] Researching company from queue ${queueId}`);
    
    const [queueItem] = await db
      .select()
      .from(discoveryQueue)
      .where(eq(discoveryQueue.id, queueId))
      .limit(1);
    
    if (!queueItem) {
      throw new Error(`Queue item ${queueId} not found`);
    }
    
    const company = {
      title: queueItem.companyName,
      url: queueItem.websiteUrl,
      text: queueItem.description || '',
      industry: queueItem.industry,
      geographicFocus: queueItem.geographicFocus,
      queueId: queueItem.id,
    };
    
    await this.researchCompany(company, queueItem.workflowId, 'buy-side');
  }

  private async researchCompany(company: any, workflowId: number, strategy: 'buy-side' | 'sell-side' | 'dual'): Promise<void> {
    console.log(`[Agent][Pipeline] ========================================`);
    console.log(`[Agent][Pipeline] Starting research pipeline: ${company.title}`);
    console.log(`[Agent][Pipeline] Queue ID: ${company.queueId}, Workflow: ${workflowId}, Strategy: ${strategy}`);
    console.log(`[Agent][Pipeline] ========================================`);

    const { storage } = await import("./storage");

    try {
      await storage.updateDiscoveryQueueItem(company.queueId, {
        researchStatus: "in_progress",
      });

      // Step 1: Generate base report with Claude
      console.log(`[Agent][Pipeline] Step 1/3: Generating Claude research report...`);
      const baseReport = await this.generateClaudeResearch(company);
      console.log(`[Agent][Pipeline] Step 1 complete - base report: ${baseReport?.length || 0} chars`);

      if (!baseReport || baseReport.length === 0) {
        console.error(`[Agent][Pipeline] FAILED at Step 1: Empty base report for ${company.title}`);
        throw new Error("Empty report generated - Claude API may have failed");
      }

      // Step 2: Enhance with public databases
      console.log(`[Agent][Pipeline] Step 2/3: Enhancing with public databases...`);
      const enhancedReport = await this.enhanceWithDatabases(
        company.title,
        company.industry || "",
        baseReport,
        strategy
      );
      console.log(`[Agent][Pipeline] Step 2 complete - enhanced report: ${enhancedReport?.length || 0} chars (added ${(enhancedReport?.length || 0) - baseReport.length} chars)`);

      if (!enhancedReport || enhancedReport.length === 0) {
        console.error(`[Agent][Pipeline] WARNING: Enhancement returned empty report, falling back to base report`);
      }

      // Step 3: Enrich with Apollo contacts
      console.log(`[Agent][Pipeline] Step 3/3: Enriching with Apollo contacts...`);
      const reportForApollo = enhancedReport || baseReport;
      const finalReport = await enrichResearchWithApollo(
        company.title,
        reportForApollo
      );
      console.log(`[Agent][Pipeline] Step 3 complete - final report: ${finalReport?.length || 0} chars`);

      if (!finalReport || finalReport.length === 0) {
        console.error(`[Agent][Pipeline] CRITICAL: Final report is empty after all enrichment steps`);
        console.error(`[Agent][Pipeline] Base: ${baseReport?.length || 0}, Enhanced: ${enhancedReport?.length || 0}, Final: ${finalReport?.length || 0}`);
        throw new Error("Final report is empty after enrichment");
      }

      // Step 4: Save to database
      console.log(`[Agent][Pipeline] Saving report to database (${finalReport.length} chars)...`);
      const report = await storage.createReport({
        companyName: company.title,
        websiteUrl: company.url,
        industry: company.industry,
        revenueRange: company.estimatedRevenue,
        geographicFocus: company.geographicFocus,
        report: finalReport,
        status: "completed",
      });

      console.log(`[Agent][Pipeline] Report saved - ID: ${report.id}, content length: ${report.report?.length || 'NULL'}`);

      if (!report.report) {
        console.error(`[Agent][Pipeline] CRITICAL: Report saved with NULL content! Report ID: ${report.id}`);
        // Update with the content directly to fix the NULL
        await storage.updateReport(report.id, { report: finalReport });
        console.log(`[Agent][Pipeline] Attempted to fix NULL report via update`);
      }

      await storage.updateDiscoveryQueueItem(company.queueId, {
        researchStatus: "completed",
        reportId: report.id,
      });

      console.log(`[Agent][Pipeline] ✓ Research complete: ${company.title} (Report ID: ${report.id})`);
    } catch (error) {
      console.error(`[Agent][Pipeline] FAILED for ${company.title}:`, error);
      await storage.updateDiscoveryQueueItem(company.queueId, {
        researchStatus: "failed",
      });
      throw error;
    }
  }

  private async generateClaudeResearch(company: any): Promise<string> {
    console.log(`[Agent][Research] Starting Claude research for: ${company.title}`);
    console.log(`[Agent][Research] Company URL: ${company.url}`);
    console.log(`[Agent][Research] Description length: ${company.text?.length || 0} chars`);

    const prompt = `Research this company for M&A analysis:

Company: ${company.title}
Website: ${company.url}
Description: ${company.text}

Create a comprehensive M&A research report with these sections:
1. Executive Summary
2. Strategic Assessment (Buy-Side vs Sell-Side recommendation)
3. Business Overview
4. Financial Intelligence
5. Competitive Landscape
6. Management Team
7. Growth Indicators
8. Key Contacts & Decision-Maker Intelligence
9. Risks & Diligence Priorities
10. Valuation Framework
11. Next Steps

IMPORTANT for Section 8 (Key Contacts & Decision-Maker Intelligence):
Find as many key decision-makers as possible. For each person, use this exact format:
**[Full Name]** - [Their Title]

Prioritize finding these roles:
- Founder / Co-Founder
- Owner / Co-Owner
- CEO / President
- COO (Chief Operating Officer)
- CFO (Chief Financial Officer)
- VP of Business Development / VP of Sales
- General Manager / Managing Director

For each contact found, include:
- Their LinkedIn profile URL if available
- How long they've been in the role (if findable)
- Any relevant background (prior companies, board seats)

Search thoroughly - check the company website's "About Us" / "Team" / "Leadership" pages, LinkedIn company page, press releases, and news articles to find ALL key people.

Use web search to find current information.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
        },
      ],
    });

    console.log(`[Agent][Research] Claude response - stop_reason: ${response.stop_reason}, blocks: ${response.content.length}`);

    // Log block types for debugging
    const blockTypes = response.content.map((b: any) => b.type);
    console.log(`[Agent][Research] Content block types: ${JSON.stringify(blockTypes)}`);

    let reportText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        reportText += block.text;
      }
    }

    console.log(`[Agent][Research] Extracted report length: ${reportText.length} chars`);

    if (!reportText || reportText.length < 100) {
      console.error(`[Agent][Research] WARNING: Report too short (${reportText.length} chars) for ${company.title}`);
      console.error(`[Agent][Research] Full response content types:`, JSON.stringify(blockTypes));

      // Fallback: try to extract any text content from the response
      if (reportText.length === 0) {
        console.error(`[Agent][Research] CRITICAL: No text blocks found in Claude response for ${company.title}`);
        throw new Error(`Claude returned no text content for ${company.title} - response had ${response.content.length} blocks of types: ${blockTypes.join(', ')}`);
      }
    }

    return reportText;
  }

  private async enhanceWithDatabases(
    companyName: string,
    industry: string,
    baseReport: string,
    strategy: 'buy-side' | 'sell-side' | 'dual'
  ): Promise<string> {
    let enhancedReport = baseReport;

    console.log(`[Agent] Enhancing ${companyName} with public databases...`);

    try {
      enhancedReport = await addPatentIntelligence(companyName, enhancedReport);
      console.log(`[Agent] ✓ Added patent intelligence`);
    } catch (error) {
      console.error("[Agent] Patent intelligence failed:", error);
    }

    // SEC EDGAR removed - stub returning empty data
    // USASpending removed - rarely relevant for small private M&A targets

    if (
      industry.toLowerCase().includes("health") ||
      industry.toLowerCase().includes("medical") ||
      industry.toLowerCase().includes("biotech")
    ) {
      try {
        enhancedReport = await addFDAIntelligence(companyName, enhancedReport);
        console.log(`[Agent] ✓ Added FDA intelligence`);
      } catch (error) {
        console.error("[Agent] FDA intelligence failed:", error);
      }
    }

    return enhancedReport;
  }
}

export const agentOrchestrator = new AgentOrchestrator();
