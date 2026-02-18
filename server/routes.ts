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

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);
  return httpServer;
}

