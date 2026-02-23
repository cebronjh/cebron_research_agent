import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Create database connection and export db instance
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString);
export const db = drizzle(client);

// Schema definitions
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  websiteUrl: text("website_url"),
  industry: text("industry"),
  revenueRange: text("revenue_range"),
  geographicFocus: text("geographic_focus"),
  report: text("report"),
  status: text("status"),
  qualityScore: integer("quality_score"),
  contactsFound: integer("contacts_found"),
  isStarred: boolean("is_starred").default(false),
  folder: text("folder"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentWorkflows = pgTable("agent_workflows", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  triggerType: text("trigger_type").notNull(),
  searchCriteria: jsonb("search_criteria").notNull(),
  companiesFound: integer("companies_found").default(0),
  companiesScored: integer("companies_scored").default(0),
  companiesAutoApproved: integer("companies_auto_approved").default(0),
  companiesManualReview: integer("companies_manual_review").default(0),
  companiesResearched: integer("companies_researched").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  parametersUnchangedCount: integer("parameters_unchanged_count").default(0),
  lastParameterUpdate: timestamp("last_parameter_update").defaultNow(),
});

export const discoveryQueue = pgTable("discovery_queue", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").references(() => agentWorkflows.id),
  companyName: text("company_name").notNull(),
  websiteUrl: text("website_url").notNull(),
  description: text("description"),
  agentScore: integer("agent_score").notNull(),
  scoringReason: text("scoring_reason"),
  confidence: text("confidence"),
  estimatedRevenue: text("estimated_revenue"),
  industry: text("industry"),
  geographicFocus: text("geographic_focus"),
  recentActivity: text("recent_activity"),
  approvalStatus: text("approval_status").notNull(),
  autoApprovalReason: text("auto_approval_reason"),
  approvedAt: timestamp("approved_at"),
  researchStatus: text("research_status"),
  reportId: integer("report_id").references(() => reports.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentConfigurations = pgTable("agent_config", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  searchCriteria: jsonb("search_criteria").notNull(),
  autoApprovalRules: jsonb("auto_approval_rules").notNull(),
  schedule: text("schedule"),
  isActive: boolean("is_active").default(true),
  alertAfterUnchangedRuns: integer("alert_after_unchanged_runs").default(3),
  lastRunAt: timestamp("last_run_at"),
  timesRunUnchanged: integer("times_run_unchanged").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const outreachStyles = pgTable("outreach_styles", {
  id: serial("id").primaryKey(),
  originalMessage: text("original_message").notNull(),
  editedMessage: text("edited_message"),
  reportId: integer("report_id").references(() => reports.id),
  strategy: text("strategy"),
  wasEdited: boolean("was_edited").default(false),
  wasSent: boolean("was_sent").default(false),
  gotResponse: boolean("got_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add workflows table alias for compatibility
export const workflows = agentWorkflows;

// Add companies table for storage compatibility
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  configId: integer("config_id").references(() => agentConfigurations.id),
  name: text("name").notNull(),
  websiteUrl: text("website_url"),
  industry: text("industry"),
  revenue: text("revenue"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add researchReports alias for storage compatibility
export const researchReports = reports;

// Folders table for custom folders
export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Weekly Intelligence tables
export const weeklyTrends = pgTable("weekly_trends", {
  id: serial("id").primaryKey(),
  weekStarting: timestamp("week_starting").notNull(),
  rawNewsData: jsonb("raw_news_data"),
  rawTrendsData: jsonb("raw_trends_data"),
  scanCompletedAt: timestamp("scan_completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const hotSectors = pgTable("hot_sectors", {
  id: serial("id").primaryKey(),
  trendWeekId: integer("trend_week_id").references(() => weeklyTrends.id),
  sectorName: text("sector_name").notNull(),
  heatScore: integer("heat_score").notNull(),
  reasoning: text("reasoning"),
  dealActivity: text("deal_activity"),
  averageMultiple: text("average_multiple"),
  activeBuyers: jsonb("active_buyers"),
  searchQuery: text("search_query"),
  peBackedFiltered: integer("pe_backed_filtered").default(0),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sectorNewsletters = pgTable("sector_newsletters", {
  id: serial("id").primaryKey(),
  sectorId: integer("sector_id").references(() => hotSectors.id),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const targetContacts = pgTable("target_contacts", {
  id: serial("id").primaryKey(),
  sectorId: integer("sector_id").references(() => hotSectors.id),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  companyWebsite: text("company_website"),
  estimatedRevenue: text("estimated_revenue"),
  ownershipType: text("ownership_type"),
  sourceWorkflow: text("source_workflow").default("weekly_intelligence"),
  enrichmentStatus: text("enrichment_status").default("pending"),
  newsletterSent: boolean("newsletter_sent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
