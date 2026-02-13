// server/agent-orchestrator.ts

import { Exa } from "exa-js";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { researchCompany } from "./research";

const exa = new Exa(process.env.EXA_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  requiredConfidence?: "High" | "Medium" | "Low";
  requiredIndustries?: string[];
  requiredRevenueRange?: string;
  requiredStrategy?: "buy-side" | "sell-side" | "dual";
}

interface DiscoveredCompany {
  companyName: string;
  websiteUrl: string;
  description: string;
  agentScore: number;
  scoringReason: string;
  confidence: "High" | "Medium" | "Low";
  estimatedRevenue?: string;
  industry?: string;
  geographicFocus?: string;
  recentActivity?: string;
}

export class AgentOrchestrator {
  /**
   * Main discovery workflow
   */
  async runDiscoveryWorkflow(configId: number): Promise<number> {
    console.log(`[Agent] Starting discovery workflow for config ${configId}`);
    
    // 1. Load configuration
    const config = await storage.getAgentConfig(configId);
    if (!config) throw new Error("Config not found");
    
    // 2. Create workflow record
    const workflow = await storage.createWorkflow({
      status: "running",
      triggerType: "scheduled",
      searchCriteria: config.searchCriteria,
      parametersUnchangedCount: config.timesRunUnchanged,
    });
    
    try {
      // 3. Check if parameters need review
      if (config.timesRunUnchanged >= config.alertAfterUnchangedRuns) {
        await this.sendParameterReviewAlert(config);
      }
      
      // 4. Discover companies
      const companies = await this.discoverCompanies(config.searchCriteria);
      
      await storage.updateWorkflow(workflow.id, {
        companiesFound: companies.length,
      });
      
      // 5. Score companies
      const scoredCompanies = await this.scoreCompanies(
        companies,
        config.searchCriteria
      );
      
      await storage.updateWorkflow(workflow.id, {
        companiesScored: scoredCompanies.length,
      });
      
      // 6. Add to discovery queue
      for (const company of scoredCompanies) {
        await storage.addToDiscoveryQueue({
          workflowId: workflow.id,
          ...company,
          approvalStatus: "pending",
        });
      }
      
      // 7. Auto-approve based on rules
      const { autoApproved, manualReview } = await this.processApprovals(
        workflow.id,
        config.autoApprovalRules
      );
      
      await storage.updateWorkflow(workflow.id, {
        companiesAutoApproved: autoApproved.length,
        companiesManualReview: manualReview.length,
        status: manualReview.length > 0 ? "awaiting_approval" : "researching",
      });
      
      // 8. Research auto-approved companies
      if (autoApproved.length > 0) {
        await this.researchCompanies(workflow.id, autoApproved);
      }
      
      // 9. Send notification
      await this.sendWorkflowNotification(workflow.id, {
        totalFound: companies.length,
        autoApproved: autoApproved.length,
        needsReview: manualReview.length,
      });
      
      // 10. Update config
      await storage.updateAgentConfig(configId, {
        lastRunAt: new Date(),
        timesRunUnchanged: config.timesRunUnchanged + 1,
      });
      
      await storage.updateWorkflow(workflow.id, {
        status: "completed",
        completedAt: new Date(),
      });
      
      return workflow.id;
      
    } catch (error) {
      console.error("[Agent] Workflow failed:", error);
      await storage.updateWorkflow(workflow.id, {
        status: "failed",
        completedAt: new Date(),
      });
      throw error;
    }
  }
  
  /**
   * Step 1: Discover companies using Exa
   */
  private async discoverCompanies(
    criteria: SearchCriteria
  ): Promise<any[]> {
    console.log("[Agent] Discovering companies with Exa...");
    
    // Build Exa query
    const query = this.buildExaQuery(criteria);
    
    // Increased from 20 to 35 for higher output
    const results = await exa.searchAndContents({
      query,
      numResults: criteria.maxResults || 35,
      type: "neural",
      useAutoprompt: true,
      text: {
        maxCharacters: 1000,
      },
    });
    
    console.log(`[Agent] Found ${results.results.length} companies`);
    return results.results;
  }
  
  /**
   * Build Exa search query from criteria
   */
  private buildExaQuery(criteria: SearchCriteria): string {
    let query = criteria.query;
    
    if (criteria.industry) {
      query += ` ${criteria.industry}`;
    }
    
    if (criteria.revenueRange) {
      query += ` revenue ${criteria.revenueRange}`;
    }
    
    if (criteria.geographicFocus) {
      query += ` located in ${criteria.geographicFocus}`;
    }
    
    // Add signals based on strategy
    if (criteria.strategy === "buy-side") {
      query += " expansion growth acquisition strategy platform";
    } else if (criteria.strategy === "sell-side") {
      query += " exit sale strategic alternatives succession";
    }
    
    return query.trim();
  }
  
  /**
   * Step 2: Score each company (1-10) with Claude
   */
  private async scoreCompanies(
    companies: any[],
    criteria: SearchCriteria
  ): Promise<DiscoveredCompany[]> {
    console.log(`[Agent] Scoring ${companies.length} companies...`);
    
    const scoredCompanies = await Promise.all(
      companies.map(async (company) => {
        return await this.scoreCompany(company, criteria);
      })
    );
    
    // Filter out scores below 5
    return scoredCompanies.filter((c) => c.agentScore >= 5);
  }
  
  /**
   * Score individual company
   */
  private async scoreCompany(
    company: any,
    criteria: SearchCriteria
  ): Promise<DiscoveredCompany> {
    const prompt = `Score this company for M&A fit (1-10 scale):

Company: ${company.title}
Website: ${company.url}
Description: ${company.text}

Target Criteria:
- Industry: ${criteria.industry || "Any"}
- Revenue Range: ${criteria.revenueRange || "Any"}
- Geographic Focus: ${criteria.geographicFocus || "Any"}
- Strategy: ${criteria.strategy || "Any"}

Evaluate based on:
1. Revenue range match (if detectable)
2. Industry fit
3. Geographic match
4. Strategic fit (buy-side vs sell-side indicators)
5. Recent activity (funding, expansion, M&A)

Return ONLY this JSON (no markdown, no explanations):
{
  "score": <number 1-10>,
  "confidence": "<High|Medium|Low>",
  "reason": "<one sentence why this score>",
  "estimatedRevenue": "<revenue estimate or null>",
  "industry": "<primary industry or null>",
  "geographicFocus": "<location or null>",
  "recentActivity": "<recent event or null>"
}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Expected text response");
    }
    
    // Parse JSON response
    const cleanedText = content.text.trim().replace(/```json|```/g, "");
    const parsed = JSON.parse(cleanedText);
    
    return {
      companyName: company.title,
      websiteUrl: company.url,
      description: company.text.substring(0, 500),
      agentScore: parsed.score,
      scoringReason: parsed.reason,
      confidence: parsed.confidence,
      estimatedRevenue: parsed.estimatedRevenue,
      industry: parsed.industry,
      geographicFocus: parsed.geographicFocus,
      recentActivity: parsed.recentActivity,
    };
  }
  
  /**
   * Step 3: Auto-approve companies based on rules
   */
  private async processApprovals(
    workflowId: number,
    rules: AutoApprovalRules
  ): Promise<{
    autoApproved: any[];
    manualReview: any[];
  }> {
    console.log("[Agent] Processing approvals...");
    
    const queue = await storage.getDiscoveryQueue(workflowId);
    const autoApproved: any[] = [];
    const manualReview: any[] = [];
    
    for (const company of queue) {
      const shouldAutoApprove = this.shouldAutoApprove(company, rules);
      
      if (shouldAutoApprove.approved) {
        await storage.updateDiscoveryQueueItem(company.id, {
          approvalStatus: "auto_approved",
          autoApprovalReason: shouldAutoApprove.reason,
          approvedAt: new Date(),
        });
        autoApproved.push(company);
      } else {
        manualReview.push(company);
      }
    }
    
    console.log(`[Agent] Auto-approved: ${autoApproved.length}, Manual review: ${manualReview.length}`);
    
    return { autoApproved, manualReview };
  }
  
  /**
   * Determine if company should be auto-approved
   */
  private shouldAutoApprove(
    company: any,
    rules: AutoApprovalRules
  ): { approved: boolean; reason?: string } {
    // Score check
    if (company.agentScore < rules.minScore) {
      return { approved: false };
    }
    
    // Confidence check
    if (rules.requiredConfidence && company.confidence !== rules.requiredConfidence) {
      return { approved: false };
    }
    
    // Industry check
    if (rules.requiredIndustries && rules.requiredIndustries.length > 0) {
      if (!company.industry || !rules.requiredIndustries.includes(company.industry)) {
        return { approved: false };
      }
    }
    
    // All checks passed
    const reason = `Auto-approved: Score ${company.agentScore}/10, ${company.confidence} confidence`;
    return { approved: true, reason };
  }
  
  /**
   * Step 4: Research auto-approved companies
   */
  private async researchCompanies(
    workflowId: number,
    companies: any[]
  ): Promise<void> {
    console.log(`[Agent] Researching ${companies.length} auto-approved companies...`);
    
    let researched = 0;
    
    for (const company of companies) {
      try {
        // Update status
        await storage.updateDiscoveryQueueItem(company.id, {
          researchStatus: "in_progress",
        });
        
        // Run research
        const reportText = await researchCompany({
          companyName: company.companyName,
          websiteUrl: company.websiteUrl,
          industry: company.industry,
          revenueRange: company.estimatedRevenue,
          geographicFocus: company.geographicFocus,
        });
        
        // Save to database
        const report = await storage.createReport({
          companyName: company.companyName,
          websiteUrl: company.websiteUrl,
          industry: company.industry,
          revenueRange: company.estimatedRevenue,
          geographicFocus: company.geographicFocus,
          report: reportText,
          status: "completed",
        });
        
        // Update queue item
        await storage.updateDiscoveryQueueItem(company.id, {
          researchStatus: "completed",
          reportId: report.id,
        });
        
        researched++;
        
      } catch (error) {
        console.error(`[Agent] Failed to research ${company.companyName}:`, error);
        await storage.updateDiscoveryQueueItem(company.id, {
          researchStatus: "failed",
        });
      }
    }
    
    // Update workflow
    await storage.updateWorkflow(workflowId, {
      companiesResearched: researched,
    });
    
    console.log(`[Agent] Successfully researched ${researched}/${companies.length} companies`);
  }
  
  /**
   * Send parameter review alert
   */
  private async sendParameterReviewAlert(config: any): Promise<void> {
    console.log(`[Agent] Sending parameter review alert for config ${config.id}`);
    
    // TODO: Implement email/notification
    // For now, just log
    console.warn(
      `⚠️  Config "${config.name}" has run ${config.timesRunUnchanged} times unchanged. Please review.`
    );
  }
  
  /**
   * Send workflow completion notification
   */
  private async sendWorkflowNotification(
    workflowId: number,
    summary: {
      totalFound: number;
      autoApproved: number;
      needsReview: number;
    }
  ): Promise<void> {
    console.log(`[Agent] Workflow ${workflowId} complete:`, summary);
    
    // TODO: Send email with summary and link to approval queue
  }
}

export const agentOrchestrator = new AgentOrchestrator();
