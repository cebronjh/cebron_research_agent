# Cebron M&A Discovery Agent - Complete Deployment Package

## 📁 File Structure

Copy these files into your GitHub repository with this exact structure:

```
your-repo/
├── README.md                          ← Project overview
├── package.json                       ← Dependencies (update yours)
├── .gitignore                         ← Git ignore file
├── .env.example                       ← Example environment variables
│
├── server/
│   ├── index.ts                       ← Main server (update yours)
│   ├── agent-orchestrator.ts         ← NEW - Agent workflow
│   ├── apollo-enrichment.ts          ← NEW - Contact enrichment
│   ├── uspto-patents.ts              ← NEW - Patent intelligence
│   ├── scheduler.ts                  ← NEW - Evening schedule
│   ├── routes.ts                     ← UPDATE - Add agent endpoints
│   └── storage.ts                    ← UPDATE - Add agent methods
│
├── client/
│   └── src/
│       ├── components/
│       │   ├── agent-dashboard.tsx   ← NEW - Agent UI
│       │   └── research-library.tsx  ← NEW - Library UI
│       └── pages/
│           ├── agent.tsx             ← NEW - Agent page
│           └── library.tsx           ← NEW - Library page
│
└── drizzle/
    └── schema.ts                     ← UPDATE - Add agent tables

```

---

## 🚀 Deployment Instructions

### **STEP 1: Prepare Your Local Repository (10 minutes)**

#### **A. Clone your GitHub repo (if not already local)**

```bash
# If you don't have it locally yet
git clone https://github.com/YOUR-USERNAME/your-repo-name.git
cd your-repo-name
```

#### **B. Download all the files I created**

I'll provide each file below - save them to the correct location in your repo.

#### **C. Update your existing files**

Some files need updates (I'll show exactly what to add).

---

### **STEP 2: Add New Backend Files**

Create these NEW files in your `server/` directory:

#### **File 1: server/agent-orchestrator.ts**

```bash
# Copy the agent-orchestrator.ts file I created earlier
# Save it as: server/agent-orchestrator.ts
```

#### **File 2: server/apollo-enrichment.ts**

```bash
# Copy the apollo-enrichment.ts file I created
# Save it as: server/apollo-enrichment.ts
```

#### **File 3: server/uspto-patents.ts**

```bash
# Copy the uspto-patents.ts file I created
# Save it as: server/uspto-patents.ts
```

#### **File 4: server/scheduler.ts**

```bash
# Copy the scheduler-evening.ts file (rename to scheduler.ts)
# Save it as: server/scheduler.ts
```

---

### **STEP 3: Update Existing Backend Files**

#### **Update: server/index.ts**

Add this import at the top:

```typescript
// Add to top of server/index.ts
import './scheduler'; // Start cron jobs
```

#### **Update: server/routes.ts**

Add these new endpoints (append to your existing routes):

```typescript
// Add these imports at the top
import { agentOrchestrator } from './agent-orchestrator';
import { storage } from './storage';

// Add these routes

/**
 * GET /api/agent/workflows
 * Get recent agent workflows
 */
app.get("/api/agent/workflows", async (req, res) => {
  try {
    const workflows = await storage.getRecentWorkflows(5);
    res.json(workflows);
  } catch (error) {
    console.error("Error fetching workflows:", error);
    res.status(500).json({ error: "Failed to fetch workflows" });
  }
});

/**
 * GET /api/agent/approvals/pending
 * Get companies awaiting manual approval
 */
app.get("/api/agent/approvals/pending", async (req, res) => {
  try {
    const pending = await storage.getPendingApprovals();
    res.json(pending);
  } catch (error) {
    console.error("Error fetching pending approvals:", error);
    res.status(500).json({ error: "Failed to fetch pending approvals" });
  }
});

/**
 * POST /api/agent/approvals/:id/approve
 * Approve a company for research
 */
app.post("/api/agent/approvals/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.approveDiscoveryItem(id);
    
    // Trigger research for this company
    const item = await storage.getDiscoveryItem(id);
    await agentOrchestrator.researchSingleCompany(item);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error approving company:", error);
    res.status(500).json({ error: "Failed to approve company" });
  }
});

/**
 * POST /api/agent/approvals/:id/reject
 * Reject a company
 */
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

/**
 * GET /api/reports/library
 * Get all reports with snippets for library view
 */
app.get("/api/reports/library", async (req, res) => {
  try {
    const reports = await storage.getAllReports();
    
    // Extract snippets from each report
    const snippets = reports.map((report) => {
      const snippet = extractReportSnippet(report.report);
      
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

/**
 * POST /api/agent/config
 * Save agent configuration
 */
app.post("/api/agent/config", async (req, res) => {
  try {
    const config = await storage.saveAgentConfig(req.body);
    res.json(config);
  } catch (error) {
    console.error("Error saving config:", error);
    res.status(500).json({ error: "Failed to save configuration" });
  }
});

/**
 * POST /api/agent/discover
 * Manually trigger discovery
 */
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

// Helper function to extract snippets
function extractReportSnippet(reportText: string) {
  const snippet: {
    executiveSummary?: string;
    recommendation?: "Buy-Side" | "Sell-Side" | "Dual Approach";
    confidence?: "High" | "Medium" | "Low";
    estimatedRevenue?: string;
    estimatedValuation?: string;
    topReason?: string;
  } = {};

  // Extract Executive Summary
  const summaryMatch = reportText.match(
    /##\s*1\.\s*Executive Summary.*?\n([\s\S]*?)(?=\n##|$)/i
  );
  if (summaryMatch) {
    const summaryText = summaryMatch[1].trim();
    const firstParagraph = summaryText.split("\n\n")[0];
    snippet.executiveSummary = firstParagraph.substring(0, 300).trim();
  }

  // Extract Strategic Recommendation
  const recommendationMatch = reportText.match(
    /\*\*PRIMARY RECOMMENDATION:\*\*\s*\[?(Buy-Side|Sell-Side|Dual Approach)/i
  );
  if (recommendationMatch) {
    snippet.recommendation = recommendationMatch[1].trim() as any;
  }

  // Extract Confidence Level
  const confidenceMatch = reportText.match(
    /\*\*CONFIDENCE LEVEL:\*\*\s*\[?(High|Medium|Low)/i
  );
  if (confidenceMatch) {
    snippet.confidence = confidenceMatch[1].trim() as any;
  }

  // Extract Top Reason
  const topReasonMatch = reportText.match(
    /\*\*TOP REASONS?:\*\*[\s\S]*?1\.\s*([^\n]+)/i
  );
  if (topReasonMatch) {
    snippet.topReason = topReasonMatch[1].trim();
  }

  // Extract Estimated Revenue
  const revenueMatch = reportText.match(
    /Estimated Revenue:\s*\$?([\d,]+-?[\d,]*\s*(?:million|M|billion|B))/i
  );
  if (revenueMatch) {
    snippet.estimatedRevenue = revenueMatch[1].trim();
  }

  // Extract Estimated Valuation
  const valuationMatch = reportText.match(
    /\*\*Estimated Enterprise Value:?\*\*\s*\$?([\d,]+-?[\d,]*\s*(?:million|M|billion|B))/i
  );
  if (valuationMatch) {
    snippet.estimatedValuation = valuationMatch[1].trim();
  }

  return snippet;
}
```

#### **Update: server/storage.ts**

Add these new methods to your storage class:

```typescript
// Add these methods to your existing storage.ts file

/**
 * Get recent workflows
 */
async getRecentWorkflows(limit: number = 5) {
  const result = await this.db
    .select()
    .from(agentWorkflows)
    .orderBy(desc(agentWorkflows.createdAt))
    .limit(limit);
  return result;
}

/**
 * Get pending approvals
 */
async getPendingApprovals() {
  const result = await this.db
    .select()
    .from(discoveryQueue)
    .where(eq(discoveryQueue.approvalStatus, 'pending'))
    .orderBy(desc(discoveryQueue.createdAt));
  return result;
}

/**
 * Approve discovery item
 */
async approveDiscoveryItem(id: number) {
  await this.db
    .update(discoveryQueue)
    .set({
      approvalStatus: 'manual_approved',
      approvedAt: new Date(),
    })
    .where(eq(discoveryQueue.id, id));
}

/**
 * Reject discovery item
 */
async rejectDiscoveryItem(id: number) {
  await this.db
    .update(discoveryQueue)
    .set({
      approvalStatus: 'rejected',
    })
    .where(eq(discoveryQueue.id, id));
}

/**
 * Get discovery item
 */
async getDiscoveryItem(id: number) {
  const result = await this.db
    .select()
    .from(discoveryQueue)
    .where(eq(discoveryQueue.id, id))
    .limit(1);
  return result[0];
}

/**
 * Save agent config
 */
async saveAgentConfig(config: any) {
  const result = await this.db
    .insert(agentConfig)
    .values(config)
    .returning();
  return result[0];
}

/**
 * Get active agent configs
 */
async getActiveAgentConfigs() {
  const result = await this.db
    .select()
    .from(agentConfig)
    .where(eq(agentConfig.isActive, true));
  return result;
}

/**
 * Get all reports
 */
async getAllReports() {
  const result = await this.db
    .select()
    .from(reports)
    .orderBy(desc(reports.createdAt));
  return result;
}
```

---

### **STEP 4: Add Frontend Files**

#### **File 1: client/src/components/agent-dashboard.tsx**

```bash
# Copy the agent-dashboard.tsx file I created
# Save it as: client/src/components/agent-dashboard.tsx
```

#### **File 2: client/src/components/research-library.tsx**

```bash
# Copy the research-library.tsx file I created
# Save it as: client/src/components/research-library.tsx
```

#### **File 3: client/src/pages/agent.tsx**

```bash
# Copy the library-page.tsx and agent page code
# Save them as separate page files
```

#### **Update: client/src/App.tsx** (or your router file)

Add these routes:

```typescript
import AgentPage from '@/pages/agent';
import LibraryPage from '@/pages/library';

// In your router:
<Route path="/agent" component={AgentPage} />
<Route path="/library" component={LibraryPage} />
```

---

### **STEP 5: Update Database Schema**

#### **Update: drizzle/schema.ts**

Add these tables to your schema:

```typescript
import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";

// Agent workflows
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

// Discovery queue
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

// Agent configuration
export const agentConfig = pgTable("agent_config", {
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

// Outreach styles (for tone learning)
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
```

---

### **STEP 6: Update package.json**

Add these dependencies to your existing package.json:

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.74.0",
    "exa-js": "^1.0.14",
    "node-cron": "^3.0.3"
  }
}
```

---

### **STEP 7: Create .env.example**

Create a file showing what environment variables are needed:

```bash
# .env.example
# Copy this to .env and fill in your actual keys

# REQUIRED
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
EXA_API_KEY=exa_your-key-here
APOLLO_API_KEY=your-apollo-key-here
DATABASE_URL=postgresql://user:pass@host:5432/db

# OPTIONAL
NODE_ENV=production
TZ=America/Chicago
ADMIN_EMAIL=your@email.com
```

---

### **STEP 8: Update .gitignore**

Make sure sensitive files aren't committed:

```bash
# .gitignore
node_modules/
.env
.env.local
dist/
build/
*.log
.DS_Store
```

---

## 🚀 Deployment Commands

### **1. Install dependencies locally**

```bash
npm install
```

### **2. Test locally first** (recommended)

```bash
# Create .env file with your actual keys
cp .env.example .env
# Edit .env with your API keys

# Run database migration
npm run db:push

# Start dev server
npm run dev

# Test at http://localhost:5000
```

### **3. Commit and push to GitHub**

```bash
git add .
git commit -m "Add M&A discovery agent features"
git push origin main
```

### **4. Railway auto-deploys**

- Railway detects the push
- Builds and deploys automatically
- Watch in Railway dashboard → Deployments

---

## ✅ Post-Deployment Checklist

After Railway finishes deploying:

```
✓ Check Railway deployment logs for errors
✓ Open your app URL (your-app.railway.app)
✓ Navigate to /agent - should load
✓ Navigate to /library - should load
✓ Create test agent configuration
✓ Run manual discovery test
✓ Verify companies appear in library
✓ Check that scheduler is running (logs should show: "Evening discovery schedule initialized")
```

---

## 🆘 If Something Breaks

### **Check Railway Logs:**

```
Railway Dashboard → Your Service → Deployments → Latest → View Logs
```

### **Common Errors:**

**"Cannot find module 'exa-js'"**
```bash
# Make sure package.json includes exa-js
npm install exa-js
git push
```

**"DATABASE_URL is not defined"**
```bash
# In Railway: Variables tab
# Make sure DATABASE_URL exists (should be auto-created)
```

**"Missing API key"**
```bash
# In Railway: Variables tab
# Add all three required keys:
# - ANTHROPIC_API_KEY
# - EXA_API_KEY  
# - APOLLO_API_KEY
```

---

## 📞 Need Help?

If you get stuck:
1. Check Railway deployment logs
2. Check browser console for frontend errors
3. Verify all environment variables are set
4. Make sure database migration ran (npm run db:push)
5. Ask me - describe the specific error you're seeing!

---

This is your complete deployment package. Follow the steps in order and you'll have the agent running in Railway!
