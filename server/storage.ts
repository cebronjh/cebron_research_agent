import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, or, ilike } from "drizzle-orm";
import pg from "pg";
import * as schema from "../drizzle/schema";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

class Storage {

  async getRecentWorkflows(limit: number = 5) {
    const result = await db
      .select()
      .from(schema.agentWorkflows)
      .orderBy(desc(schema.agentWorkflows.createdAt))
      .limit(limit);
    return result;
  }

  async getPendingApprovals() {
    const result = await db
      .select()
      .from(schema.discoveryQueue)
      .where(eq(schema.discoveryQueue.approvalStatus, 'pending'))
      .orderBy(desc(schema.discoveryQueue.createdAt));
    return result;
  }

  async approveDiscoveryItem(id: number) {
    await db
      .update(schema.discoveryQueue)
      .set({
        approvalStatus: 'manual_approved',
        approvedAt: new Date(),
      })
      .where(eq(schema.discoveryQueue.id, id));
  }

  async rejectDiscoveryItem(id: number) {
    await db
      .update(schema.discoveryQueue)
      .set({
        approvalStatus: 'rejected',
      })
      .where(eq(schema.discoveryQueue.id, id));
  }

  async getDiscoveryItem(id: number) {
    const result = await db
      .select()
      .from(schema.discoveryQueue)
      .where(eq(schema.discoveryQueue.id, id))
      .limit(1);
    return result[0];
  }

  async saveAgentConfig(config: any) {
    const result = await db
      .insert(schema.agentConfigurations)
      .values(config)
      .returning();
    return result[0];
  }

  async getActiveAgentConfigs() {
    const result = await db
      .select()
      .from(schema.agentConfigurations)
      .where(eq(schema.agentConfigurations.isActive, true));
    return result;
  }

  // Aliases used by routes.ts
  async getAllAgentConfigs() {
    const result = await db
      .select()
      .from(schema.agentConfigurations)
      .orderBy(desc(schema.agentConfigurations.createdAt));
    return result;
  }

  async createAgentConfig(config: any) {
    return this.saveAgentConfig(config);
  }

  async deleteAgentConfig(id: number) {
    await db
      .delete(schema.agentConfigurations)
      .where(eq(schema.agentConfigurations.id, id));
  }

  async getAllWorkflows() {
    return this.getRecentWorkflows(20);
  }

  async getReports(filter?: { status?: string }) {
    if (filter?.status) {
      const result = await db
        .select()
        .from(schema.reports)
        .where(eq(schema.reports.status, filter.status))
        .orderBy(desc(schema.reports.createdAt));
      return result;
    }
    return this.getAllReports();
  }

  async getReportById(id: number) {
    const result = await db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.id, id))
      .limit(1);
    return result[0];
  }

  async getAllReports() {
    const result = await db
      .select()
      .from(schema.reports)
      .orderBy(desc(schema.reports.createdAt));
    return result;
  }

  async createReport(data: any) {
    const result = await db
      .insert(schema.reports)
      .values(data)
      .returning();
    return result[0];
  }

  async updateReport(id: number, data: any) {
    await db
      .update(schema.reports)
      .set(data)
      .where(eq(schema.reports.id, id));
  }

  async createWorkflow(data: any) {
    const result = await db
      .insert(schema.agentWorkflows)
      .values(data)
      .returning();
    return result[0];
  }

  async updateWorkflow(id: number, data: any) {
    await db
      .update(schema.agentWorkflows)
      .set(data)
      .where(eq(schema.agentWorkflows.id, id));
  }

  async addToDiscoveryQueue(data: any) {
    const result = await db
      .insert(schema.discoveryQueue)
      .values(data)
      .returning();
    return result[0];
  }

  async updateDiscoveryQueueItem(id: number, data: any) {
    await db
      .update(schema.discoveryQueue)
      .set(data)
      .where(eq(schema.discoveryQueue.id, id));
  }

  async getDiscoveryQueue(workflowId: number) {
    const result = await db
      .select()
      .from(schema.discoveryQueue)
      .where(eq(schema.discoveryQueue.workflowId, workflowId));
    return result;
  }

  async getAgentConfig(id: number) {
    const result = await db
      .select()
      .from(schema.agentConfigurations)
      .where(eq(schema.agentConfigurations.id, id))
      .limit(1);
    return result[0];
  }

  async updateAgentConfig(id: number, data: any) {
    await db
      .update(schema.agentConfigurations)
      .set(data)
      .where(eq(schema.agentConfigurations.id, id));
  }

  async getRunningWorkflows() {
    const result = await db
      .select()
      .from(schema.agentWorkflows)
      .where(eq(schema.agentWorkflows.status, 'running'));
    return result;
  }

  async findExistingCompany(companyName: string, websiteUrl?: string): Promise<any | null> {
    const conditions = [ilike(schema.discoveryQueue.companyName, companyName)];
    if (websiteUrl) {
      conditions.push(eq(schema.discoveryQueue.websiteUrl, websiteUrl));
    }
    const result = await db
      .select()
      .from(schema.discoveryQueue)
      .where(or(...conditions))
      .limit(1);
    return result[0] || null;
  }

  async createOutreach(data: any) {
    const result = await db
      .insert(schema.outreachStyles)
      .values(data)
      .returning();
    return result[0];
  }

  async getOutreachByReportId(reportId: number) {
    const result = await db
      .select()
      .from(schema.outreachStyles)
      .where(eq(schema.outreachStyles.reportId, reportId))
      .orderBy(desc(schema.outreachStyles.createdAt));
    return result;
  }

  async updateOutreach(id: number, data: any) {
    const result = await db
      .update(schema.outreachStyles)
      .set(data)
      .where(eq(schema.outreachStyles.id, id))
      .returning();
    return result[0];
  }
  async toggleReportStarred(id: number, isStarred: boolean) {
    await db
      .update(schema.reports)
      .set({ isStarred })
      .where(eq(schema.reports.id, id));
  }

  async getAllFolders() {
    const result = await db
      .select()
      .from(schema.folders)
      .orderBy(schema.folders.name);
    return result;
  }

  async createFolder(name: string) {
    const result = await db
      .insert(schema.folders)
      .values({ name })
      .returning();
    return result[0];
  }

  async moveReportToFolder(id: number, folder: string | null) {
    await db
      .update(schema.reports)
      .set({ folder })
      .where(eq(schema.reports.id, id));
  }

  async clearAllData() {
    // Delete in FK order: outreach → discovery_queue → reports → workflows
    await db.delete(schema.outreachStyles);
    await db.delete(schema.discoveryQueue);
    await db.delete(schema.reports);
    await db.delete(schema.agentWorkflows);
    console.log("[Storage] All search data cleared (outreach, discovery_queue, reports, workflows)");
  }
}

export const storage = new Storage();
