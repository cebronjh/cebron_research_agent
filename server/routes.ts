import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { agentOrchestrator } from "./agent-orchestrator";
import { weeklyIntelligenceEngine } from "./weekly-intelligence-engine";
import { eq, desc } from "drizzle-orm";
import * as schema from "../drizzle/schema";

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

  // Update report company name
  app.put("/api/reports/:id/name", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { companyName } = req.body;
      if (!companyName || typeof companyName !== "string" || companyName.trim().length === 0) {
        return res.status(400).json({ error: "companyName is required" });
      }
      await storage.updateReport(id, { companyName: companyName.trim() });
      res.json({ success: true, companyName: companyName.trim() });
    } catch (error) {
      console.error("Error updating report name:", error);
      res.status(500).json({ error: "Failed to update report name" });
    }
  });

  // Toggle report starred status
  app.put("/api/reports/:id/star", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isStarred } = req.body;
      if (typeof isStarred !== "boolean") {
        return res.status(400).json({ error: "isStarred boolean is required" });
      }
      await storage.toggleReportStarred(id, isStarred);
      res.json({ success: true, isStarred });
    } catch (error) {
      console.error("Error toggling star:", error);
      res.status(500).json({ error: "Failed to toggle star" });
    }
  });

  // Get all folders
  app.get("/api/folders", async (req, res) => {
    try {
      const folders = await storage.getAllFolders();
      res.json(folders);
    } catch (error) {
      console.error("Error fetching folders:", error);
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  // Create a new folder
  app.post("/api/folders", async (req, res) => {
    try {
      const { name, parentId } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Folder name is required" });
      }
      if (name.trim().toLowerCase() === "archived") {
        return res.status(400).json({ error: "Cannot use reserved folder name 'archived'" });
      }

      // Validate parent exists if parentId is provided
      if (parentId !== null && typeof parentId === "number") {
        const parent = await storage.getFolderById(parentId);
        if (!parent) {
          return res.status(400).json({ error: "Parent folder not found" });
        }
      }

      const folder = await storage.createFolder(name.trim(), parentId || null);
      res.json(folder);
    } catch (error: any) {
      if (error.message?.includes("unique")) {
        return res.status(400).json({ error: "Folder with this name already exists in this location" });
      }
      console.error("Error creating folder:", error);
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  // Delete a folder (CASCADE handles descendants)
  app.delete("/api/folders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid folder ID" });
      }
      const folder = await storage.getFolderById(id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      await storage.deleteFolder(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting folder:", error);
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });

  // Rename a folder
  app.patch("/api/folders/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid folder ID" });
      }
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Folder name is required" });
      }

      const folder = await storage.getFolderById(id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }

      await db.update(schema.folders).set({ name: name.trim() }).where(eq(schema.folders.id, id));
      const updated = await storage.getFolderById(id);
      res.json(updated);
    } catch (error: any) {
      if (error.message?.includes("unique")) {
        return res.status(400).json({ error: "Folder with this name already exists in this location" });
      }
      console.error("Error renaming folder:", error);
      res.status(500).json({ error: "Failed to rename folder" });
    }
  });

  // Move report to folder (by folderId)
  app.put("/api/reports/:id/folder", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { folderId } = req.body;
      if (folderId !== null && (typeof folderId !== "number" || isNaN(folderId))) {
        return res.status(400).json({ error: "folderId must be a number or null" });
      }

      // Validate folder exists if folderId is provided
      if (folderId !== null && typeof folderId === "number") {
        const folder = await storage.getFolderById(folderId);
        if (!folder) {
          return res.status(404).json({ error: "Folder not found" });
        }
      }

      await storage.moveReportToFolder(id, folderId || null);
      res.json({ success: true, folderId: folderId || null });
    } catch (error) {
      console.error("Error moving to folder:", error);
      res.status(500).json({ error: "Failed to move to folder" });
    }
  });

  // Archive/unarchive a report
  app.put("/api/reports/:id/archive", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isArchived } = req.body;
      if (typeof isArchived !== "boolean") {
        return res.status(400).json({ error: "isArchived boolean is required" });
      }
      await storage.setReportArchived(id, isArchived);
      res.json({ success: true, isArchived });
    } catch (error) {
      console.error("Error archiving report:", error);
      res.status(500).json({ error: "Failed to archive report" });
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

  // Direct company research (skip discovery, research known companies)
  app.post("/api/research/direct", async (req, res) => {
    try {
      const { companies, strategy } = req.body;
      if (!Array.isArray(companies) || companies.length === 0) {
        return res.status(400).json({ error: "companies array is required" });
      }
      if (companies.length > 25) {
        return res.status(400).json({ error: "Maximum 25 companies per request" });
      }
      for (const c of companies) {
        if (!c.name || typeof c.name !== "string" || c.name.trim().length === 0) {
          return res.status(400).json({ error: "Each company must have a non-empty name" });
        }
      }

      const validStrategy = ["buy-side", "sell-side", "dual"].includes(strategy) ? strategy : "buy-side";
      const cleanCompanies = companies.map((c: any) => ({
        name: c.name.trim(),
        websiteUrl: c.websiteUrl?.trim() || undefined,
      }));

      console.log(`[API] Starting direct research for ${cleanCompanies.length} companies (strategy: ${validStrategy})`);

      agentOrchestrator.runDirectResearch(cleanCompanies, validStrategy)
        .then(workflowId => {
          console.log(`[API] Direct research workflow ${workflowId} completed`);
        })
        .catch(error => {
          console.error(`[API] Direct research failed:`, error);
        });

      res.json({ message: "Research started", workflowId: null });
    } catch (error) {
      console.error("Error starting direct research:", error);
      res.status(500).json({ error: "Failed to start direct research" });
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

  // ══════════════════════════════════════════════════════════
  // Weekly Intelligence endpoints
  // ══════════════════════════════════════════════════════════

  // Get latest weekly intelligence scan with hot sectors
  app.get("/api/weekly-intelligence/latest", async (req, res) => {
    try {
      // Get most recent weekly trend
      const [latestTrend] = await db
        .select()
        .from(schema.weeklyTrends)
        .orderBy(desc(schema.weeklyTrends.createdAt))
        .limit(1);

      if (!latestTrend) {
        return res.json({ trend: null, sectors: [] });
      }

      // Get hot sectors for this trend week
      const sectors = await db
        .select()
        .from(schema.hotSectors)
        .where(eq(schema.hotSectors.trendWeekId, latestTrend.id))
        .orderBy(desc(schema.hotSectors.heatScore));

      // For each sector, get company count, contact count, and newsletter
      const sectorsWithCounts = await Promise.all(
        sectors.map(async (sector) => {
          const contacts = await db
            .select()
            .from(schema.targetContacts)
            .where(eq(schema.targetContacts.sectorId, sector.id));

          const nonPeContacts = contacts.filter(
            (c) => c.ownershipType !== "PE-Backed"
          );

          const [newsletter] = await db
            .select()
            .from(schema.sectorNewsletters)
            .where(eq(schema.sectorNewsletters.sectorId, sector.id))
            .limit(1);

          return {
            ...sector,
            companyCount: contacts.length,
            contactCount: nonPeContacts.length,
            newsletterId: newsletter?.id || null,
            newsletterSentAt: newsletter?.sentAt || null,
          };
        })
      );

      res.json({
        trend: latestTrend,
        sectors: sectorsWithCounts,
      });
    } catch (error) {
      console.error("Error fetching weekly intelligence:", error);
      res.status(500).json({ error: "Failed to fetch weekly intelligence" });
    }
  });

  // Get newsletter detail with contacts
  app.get("/api/newsletters/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      const [newsletter] = await db
        .select()
        .from(schema.sectorNewsletters)
        .where(eq(schema.sectorNewsletters.id, id))
        .limit(1);

      if (!newsletter) {
        return res.status(404).json({ error: "Newsletter not found" });
      }

      // Get sector info
      const [sector] = await db
        .select()
        .from(schema.hotSectors)
        .where(eq(schema.hotSectors.id, newsletter.sectorId!))
        .limit(1);

      // Get contacts for this sector (exclude PE-backed)
      const contacts = await db
        .select()
        .from(schema.targetContacts)
        .where(eq(schema.targetContacts.sectorId, newsletter.sectorId!));

      const filteredContacts = contacts.filter(
        (c) => c.ownershipType !== "PE-Backed"
      );

      // Get the trend week for date context
      let trendWeek = null;
      if (sector?.trendWeekId) {
        const [tw] = await db
          .select()
          .from(schema.weeklyTrends)
          .where(eq(schema.weeklyTrends.id, sector.trendWeekId))
          .limit(1);
        trendWeek = tw;
      }

      res.json({
        newsletter,
        sector,
        trendWeek,
        contacts: filteredContacts,
      });
    } catch (error) {
      console.error("Error fetching newsletter:", error);
      res.status(500).json({ error: "Failed to fetch newsletter" });
    }
  });

  // Mark newsletter as sent
  app.post("/api/newsletters/:id/mark-sent", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await db
        .update(schema.sectorNewsletters)
        .set({ sentAt: new Date() })
        .where(eq(schema.sectorNewsletters.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking newsletter sent:", error);
      res.status(500).json({ error: "Failed to mark newsletter as sent" });
    }
  });

  // Archive of past weekly scans
  app.get("/api/weekly-intelligence/archive", async (req, res) => {
    try {
      const trends = await db
        .select()
        .from(schema.weeklyTrends)
        .orderBy(desc(schema.weeklyTrends.weekStarting))
        .limit(20);
      res.json(trends);
    } catch (error) {
      console.error("Error fetching intelligence archive:", error);
      res.status(500).json({ error: "Failed to fetch archive" });
    }
  });

  // Clear weekly intelligence data (for re-runs)
  app.delete("/api/weekly-intelligence/clear", async (req, res) => {
    try {
      console.log("[API] Clearing weekly intelligence data...");
      // Delete in FK order: newsletters → contacts → sectors → trends
      await db.delete(schema.sectorNewsletters);
      await db.delete(schema.targetContacts);
      await db.delete(schema.hotSectors);
      await db.delete(schema.weeklyTrends);
      console.log("[API] Weekly intelligence data cleared");
      res.json({ message: "Weekly intelligence data cleared" });
    } catch (error) {
      console.error("Error clearing weekly intelligence data:", error);
      res.status(500).json({ error: "Failed to clear weekly intelligence data" });
    }
  });

  // Trigger weekly intelligence scan manually
  app.post("/api/weekly-intelligence/run", async (req, res) => {
    try {
      console.log("[API] Starting weekly intelligence scan...");
      weeklyIntelligenceEngine.runWeeklyScan()
        .then(trendId => {
          console.log(`[API] Weekly intelligence scan completed (trend ID: ${trendId})`);
        })
        .catch(error => {
          console.error("[API] Weekly intelligence scan failed:", error);
        });
      res.json({ message: "Weekly intelligence scan started" });
    } catch (error) {
      console.error("Error starting weekly intelligence:", error);
      res.status(500).json({ error: "Failed to start weekly intelligence scan" });
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

