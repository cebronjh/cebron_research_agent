import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { agentOrchestrator } from "./agent-orchestrator";

export function registerRoutes(app: Express): Server {
  // Get all agent configurations
  app.get("/api/agent-configs", async (req, res) => {
    try {
      const configs = await storage.getAllAgentConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Error fetching configs:", error);
      res.status(500).json({ error: "Failed to fetch configs" });
    }
  });

  // Create agent configuration
  app.post("/api/agent-configs", async (req, res) => {
    try {
      const { name, searchCriteria, autoApprovalRules } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "name is required" });
      }
      if (!searchCriteria || typeof searchCriteria !== "object") {
        return res.status(400).json({ error: "searchCriteria is required" });
      }
      if (!searchCriteria.query || typeof searchCriteria.query !== "string") {
        return res.status(400).json({ error: "searchCriteria.query is required" });
      }
      if (!autoApprovalRules || typeof autoApprovalRules !== "object") {
        return res.status(400).json({ error: "autoApprovalRules is required" });
      }
      const config = await storage.createAgentConfig(req.body);
      res.json(config);
    } catch (error) {
      console.error("Error saving config:", error);
      res.status(500).json({ error: "Failed to save config" });
    }
  });

  // Update agent configuration
  app.put("/api/agent-configs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const config = await storage.updateAgentConfig(id, req.body);
      res.json(config);
    } catch (error) {
      console.error("Error updating config:", error);
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  // Delete agent configuration
  app.delete("/api/agent-configs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAgentConfig(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting config:", error);
      res.status(500).json({ error: "Failed to delete config" });
    }
  });

  // Run discovery workflow manually
  app.post("/api/discovery/run/:configId", async (req, res) => {
    try {
      const configId = parseInt(req.params.configId);
      if (isNaN(configId)) {
        return res.status(400).json({ error: "Invalid config ID" });
      }
      console.log(`[API] Starting discovery workflow for config ${configId}`);
      
      // Run workflow asynchronously
      agentOrchestrator.runDiscoveryWorkflow(configId)
        .then(workflowId => {
          console.log(`[API] Discovery workflow ${workflowId} completed`);
        })
        .catch(error => {
          console.error(`[API] Discovery workflow ${configId} failed:`, error);
        });
      
      res.json({ message: "Discovery workflow started" });
    } catch (error) {
      console.error("Error running discovery:", error);
      res.status(500).json({ error: "Failed to run discovery" });
    }
  });

  // Get all workflows
  app.get("/api/workflows", async (req, res) => {
    try {
      const workflows = await storage.getAllWorkflows();
      res.json(workflows);
    } catch (error) {
      console.error("Error fetching workflows:", error);
      res.status(500).json({ error: "Failed to fetch workflows" });
    }
  });

  // Get discovery queue items for a specific workflow
  app.get("/api/workflows/:id/companies", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      if (isNaN(workflowId)) {
        return res.status(400).json({ error: "Invalid workflow ID" });
      }
      const companies = await storage.getDiscoveryQueue(workflowId);
      res.json(companies);
    } catch (error) {
      console.error("Error fetching workflow companies:", error);
      res.status(500).json({ error: "Failed to fetch workflow companies" });
    }
  });

  // Get companies in discovery queue (pending approval)
  app.get("/api/discovery-queue/pending", async (req, res) => {
    try {
      const pending = await storage.getPendingApprovals();
      res.json(pending);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      res.status(500).json({ error: "Failed to fetch pending approvals" });
    }
  });

  // Approve company manually (triggers research)
  app.post("/api/discovery-queue/:id/approve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`[API] Manual approval for company ${id}`);
      
      // Update approval status
      await storage.updateDiscoveryQueueItem(id, {
        approvalStatus: "auto_approved",
        autoApprovalReason: "Manually approved",
        approvedAt: new Date(),
      });
      
      // Trigger research asynchronously
      agentOrchestrator.researchCompanyById(id)
        .then(() => {
          console.log(`[API] Research completed for company ${id}`);
        })
        .catch(error => {
          console.error(`[API] Research failed for company ${id}:`, error);
        });
      
      res.json({ message: "Company approved, research started" });
    } catch (error) {
      console.error("Error approving company:", error);
      res.status(500).json({ error: "Failed to approve company" });
    }
  });

  // Reject company
  app.post("/api/discovery-queue/:id/reject", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateDiscoveryQueueItem(id, {
        approvalStatus: "rejected",
      });
      res.json({ message: "Company rejected" });
    } catch (error) {
      console.error("Error rejecting company:", error);
      res.status(500).json({ error: "Failed to reject company" });
    }
  });

  // Get all completed reports (for library)
  app.get("/api/reports", async (req, res) => {
    try {
      const reports = await storage.getReports({ status: "completed" });
      
      // Parse report snippets for display
      const reportsWithSnippets = reports.map((report: any) => {
        let executiveSummary = "";
        let recommendation = "";
        let confidence = "";
        
        if (report.report) {
          const lines = report.report.split('\n');
          
          // Extract executive summary (first few paragraphs)
          const summaryStart = lines.findIndex((l: string) => 
            l.toLowerCase().includes('executive summary')
          );
          if (summaryStart !== -1) {
            const summaryLines = lines.slice(summaryStart + 1, summaryStart + 5)
              .filter((l: string) => l.trim().length > 0);
            executiveSummary = summaryLines.join(' ').substring(0, 200);
          }
          
          // Extract recommendation
          const recStart = lines.findIndex((l: string) => 
            l.toLowerCase().includes('recommendation') || 
            l.toLowerCase().includes('strategic assessment')
          );
          if (recStart !== -1) {
            const recLine = lines[recStart + 1];
            if (recLine && recLine.length > 0) {
              recommendation = recLine.substring(0, 100);
            }
          }
          
          // Extract confidence
          const confStart = lines.findIndex((l: string) => 
            l.toLowerCase().includes('confidence')
          );
          if (confStart !== -1) {
            const confLine = lines[confStart];
            if (confLine.toLowerCase().includes('high')) confidence = 'High';
            else if (confLine.toLowerCase().includes('medium')) confidence = 'Medium';
            else if (confLine.toLowerCase().includes('low')) confidence = 'Low';
          }
        }
        
        return {
          ...report,
          executiveSummary,
          recommendation,
          confidence,
        };
      });
      
      res.json(reportsWithSnippets);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  // Get single report (full content)
  app.get("/api/reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const report = await storage.getReportById(id);
      
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  // Generate outreach message for a report
  app.post("/api/reports/:id/outreach", async (req, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const strategy = req.body.strategy || "buy-side";
      console.log(`[API] Generating outreach for report ${reportId} (strategy: ${strategy})`);

      const outreach = await agentOrchestrator.generateOutreach(reportId, strategy);
      res.json(outreach);
    } catch (error: any) {
      console.error("Error generating outreach:", error);
      res.status(500).json({ error: error.message || "Failed to generate outreach" });
    }
  });

  // Get outreach messages for a report
  app.get("/api/reports/:id/outreach", async (req, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const outreach = await storage.getOutreachByReportId(reportId);
      res.json(outreach);
    } catch (error) {
      console.error("Error fetching outreach:", error);
      res.status(500).json({ error: "Failed to fetch outreach" });
    }
  });

  // Update/edit an outreach message
  app.put("/api/outreach/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { editedMessage } = req.body;
      if (!editedMessage || typeof editedMessage !== "string") {
        return res.status(400).json({ error: "editedMessage is required" });
      }
      const updated = await storage.updateOutreach(id, {
        editedMessage,
        wasEdited: true,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating outreach:", error);
      res.status(500).json({ error: "Failed to update outreach" });
    }
  });

  // Mark outreach as sent
  app.post("/api/outreach/:id/sent", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateOutreach(id, {
        wasSent: true,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error marking outreach as sent:", error);
      res.status(500).json({ error: "Failed to update outreach" });
    }
  });

  // Record outreach response
  app.post("/api/outreach/:id/response", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateOutreach(id, {
        gotResponse: req.body.gotResponse ?? true,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error recording outreach response:", error);
      res.status(500).json({ error: "Failed to update outreach" });
    }
  });

  // Bulk approve companies
  app.post("/api/discovery-queue/bulk-approve", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      console.log(`[API] Bulk approving ${ids.length} companies: ${ids.join(", ")}`);

      // Approve all
      for (const id of ids) {
        await storage.updateDiscoveryQueueItem(id, {
          approvalStatus: "auto_approved",
          autoApprovalReason: "Bulk approved manually",
          approvedAt: new Date(),
        });
      }

      // Trigger research asynchronously for each
      Promise.allSettled(
        ids.map((id: number) => agentOrchestrator.researchCompanyById(id))
      ).then(results => {
        const succeeded = results.filter(r => r.status === "fulfilled").length;
        const failed = results.filter(r => r.status === "rejected").length;
        console.log(`[API] Bulk research complete: ${succeeded} succeeded, ${failed} failed`);
      });

      res.json({ message: `${ids.length} companies approved, research started` });
    } catch (error) {
      console.error("Error bulk approving:", error);
      res.status(500).json({ error: "Failed to bulk approve" });
    }
  });

  // Bulk reject companies
  app.post("/api/discovery-queue/bulk-reject", async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids array is required" });
      }
      console.log(`[API] Bulk rejecting ${ids.length} companies`);

      for (const id of ids) {
        await storage.updateDiscoveryQueueItem(id, {
          approvalStatus: "rejected",
        });
      }

      res.json({ message: `${ids.length} companies rejected` });
    } catch (error) {
      console.error("Error bulk rejecting:", error);
      res.status(500).json({ error: "Failed to bulk reject" });
    }
  });

  // Clear all search data (keeps configs)
  app.delete("/api/data/clear-all", async (req, res) => {
    try {
      console.log("[API] Clearing all search data...");
      await storage.clearAllData();
      res.json({ message: "All search data cleared" });
    } catch (error) {
      console.error("Error clearing data:", error);
      res.status(500).json({ error: "Failed to clear data" });
    }
  });

  // Health check - validates DB connectivity and API key configuration
  app.get("/api/health", async (req, res) => {
    const checks: Record<string, string> = {};

    // Check required API keys
    checks.anthropic_key = process.env.ANTHROPIC_API_KEY ? "configured" : "MISSING";
    checks.exa_key = process.env.EXA_API_KEY ? "configured" : "MISSING";
    checks.apollo_key = process.env.APOLLO_API_KEY ? "configured" : "not configured (optional)";
    checks.database_url = process.env.DATABASE_URL ? "configured" : "MISSING";

    // Check DB connectivity
    try {
      await storage.getRecentWorkflows(1);
      checks.database = "connected";
    } catch (error) {
      checks.database = "UNREACHABLE";
    }

    const hasCriticalIssue = checks.anthropic_key === "MISSING" ||
      checks.exa_key === "MISSING" ||
      checks.database_url === "MISSING" ||
      checks.database === "UNREACHABLE";

    res.status(hasCriticalIssue ? 503 : 200).json({
      status: hasCriticalIssue ? "degraded" : "ok",
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}

