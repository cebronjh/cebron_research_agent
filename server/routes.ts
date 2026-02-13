import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { agentOrchestrator } from "./agent-orchestrator";

export function registerRoutes(app: Express): Server {
  
  app.get("/api/agent/workflows", async (req, res) => {
    try {
      const workflows = await storage.getRecentWorkflows(5);
      res.json(workflows);
    } catch (error) {
      console.error("Error fetching workflows:", error);
      res.status(500).json({ error: "Failed to fetch workflows" });
    }
  });

  app.get("/api/agent/approvals/pending", async (req, res) => {
    try {
      const pending = await storage.getPendingApprovals();
      res.json(pending);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      res.status(500).json({ error: "Failed to fetch pending approvals" });
    }
  });

  app.post("/api/agent/approvals/:id/approve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.approveDiscoveryItem(id);
      const item = await storage.getDiscoveryItem(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error approving company:", error);
      res.status(500).json({ error: "Failed to approve company" });
    }
  });

  app.post("/api/agent/approvals/:id/reject", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.rejectDiscoveryItem(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error rejecting company:", error);
      res.status(500).json({ error: "Failed to reject company" });
    }
  });

  app.get("/api/reports/library", async (req, res) => {
    try {
      const reports = await storage.getAllReports();
      const snippets = reports.map((report) => {
        const snippet = extractReportSnippet(report.report || '');
        return {
          id: report.id,
          companyName: report.companyName,
          websiteUrl: report.websiteUrl,
          industry: report.industry,
          revenueRange: report.revenueRange,
          geographicFocus: report.geographicFocus,
          createdAt: report.createdAt,
          ...snippet,
        };
      });
      res.json(snippets);
    } catch (error) {
      console.error("Error fetching library:", error);
      res.status(500).json({ error: "Failed to fetch research library" });
    }
  });

  app.post("/api/agent/config", async (req, res) => {
    try {
      const config = await storage.saveAgentConfig(req.body);
      res.json(config);
    } catch (error) {
      console.error("Error saving config:", error);
      res.status(500).json({ error: "Failed to save configuration" });
    }
  });

  app.post("/api/agent/discover", async (req, res) => {
    try {
      const configId = req.body.configId;
      const workflowId = await agentOrchestrator.runDiscoveryWorkflow(configId);
      res.json({ workflowId });
    } catch (error) {
      console.error("Error running discovery:", error);
      res.status(500).json({ error: "Failed to run discovery" });
    }
  });

  function extractReportSnippet(reportText: string) {
    const snippet: {
      executiveSummary?: string;
      recommendation?: "Buy-Side" | "Sell-Side" | "Dual Approach";
      confidence?: "High" | "Medium" | "Low";
      estimatedRevenue?: string;
      estimatedValuation?: string;
      topReason?: string;
    } = {};

    const summaryMatch = reportText.match(
      /##\s*1\.\s*Executive Summary.*?\n([\s\S]*?)(?=\n##|$)/i
    );
    if (summaryMatch) {
      const summaryText = summaryMatch[1].trim();
      const firstParagraph = summaryText.split("\n\n")[0];
      snippet.executiveSummary = firstParagraph.substring(0, 300).trim();
    }

    const recommendationMatch = reportText.match(
      /\*\*PRIMARY RECOMMENDATION:\*\*\s*\[?(Buy-Side|Sell-Side|Dual Approach)/i
    );
    if (recommendationMatch) {
      snippet.recommendation = recommendationMatch[1].trim() as any;
    }

    const confidenceMatch = reportText.match(
      /\*\*CONFIDENCE LEVEL:\*\*\s*\[?(High|Medium|Low)/i
    );
    if (confidenceMatch) {
      snippet.confidence = confidenceMatch[1].trim() as any;
    }

    const topReasonMatch = reportText.match(
      /\*\*TOP REASONS?:\*\*[\s\S]*?1\.\s*([^\n]+)/i
    );
    if (topReasonMatch) {
      snippet.topReason = topReasonMatch[1].trim();
    }

    const revenueMatch = reportText.match(
      /Estimated Revenue:\s*\$?([\d,]+-?[\d,]*\s*(?:million|M|billion|B))/i
    );
    if (revenueMatch) {
      snippet.estimatedRevenue = revenueMatch[1].trim();
    }

    const valuationMatch = reportText.match(
      /\*\*Estimated Enterprise Value:?\*\*\s*\$?([\d,]+-?[\d,]*\s*(?:million|M|billion|B))/i
    );
    if (valuationMatch) {
      snippet.estimatedValuation = valuationMatch[1].trim();
    }

    return snippet;
  }

  const httpServer = createServer(app);
  return httpServer;
}
