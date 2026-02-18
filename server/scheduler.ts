// server/scheduler.ts

import cron from 'node-cron';
import { agentOrchestrator } from './agent-orchestrator';
import { weeklyIntelligenceEngine } from './weekly-intelligence-engine';
import { storage } from './storage';

const activeTasks: ReturnType<typeof cron.schedule>[] = [];

/**
 * Mark any workflows left in "running" status as "failed".
 * This happens on server startup — if the server restarted (e.g. Railway deploy),
 * those workflows will never complete.
 */
async function cleanupOrphanedWorkflows() {
  try {
    const running = await storage.getRunningWorkflows();
    if (running.length === 0) {
      console.log('[Scheduler] No orphaned workflows found');
      return;
    }
    console.log(`[Scheduler] Cleaning up ${running.length} orphaned workflow(s)...`);
    for (const wf of running) {
      await storage.updateWorkflow(wf.id, {
        status: 'failed',
        completedAt: new Date(),
      });
      console.log(`[Scheduler] Workflow ${wf.id} marked as failed (orphaned)`);
    }
  } catch (error) {
    console.error('[Scheduler] Error cleaning up orphaned workflows:', error);
  }
}

/**
 * Set up a cron job for each active agent config that has a schedule.
 */
async function setupCronJobs() {
  // Stop any previously scheduled tasks
  for (const task of activeTasks) {
    task.stop();
  }
  activeTasks.length = 0;

  const configs = await storage.getActiveAgentConfigs();
  let scheduled = 0;

  for (const config of configs) {
    if (!config.schedule) continue;

    if (!cron.validate(config.schedule)) {
      console.warn(`[Scheduler] Invalid cron expression "${config.schedule}" for config "${config.name}" — skipping`);
      continue;
    }

    const task = cron.schedule(config.schedule, async () => {
      console.log(`[Scheduler] Cron triggered for config "${config.name}" (id=${config.id})`);
      try {
        const workflowId = await agentOrchestrator.runDiscoveryWorkflow(config.id);
        console.log(`[Scheduler] Workflow ${workflowId} started for "${config.name}"`);
      } catch (error) {
        console.error(`[Scheduler] Workflow failed for "${config.name}":`, error);
        await sendErrorNotification({
          configName: config.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });
      }
    });

    activeTasks.push(task);
    scheduled++;
    console.log(`[Scheduler] Scheduled "${config.name}" — cron: ${config.schedule}`);
  }

  if (scheduled === 0) {
    console.log('[Scheduler] No active configs with schedules found');
  } else {
    console.log(`[Scheduler] ${scheduled} cron job(s) active`);
  }
}

/**
 * Main entry point — called once from index.ts after server starts.
 */
export async function startScheduler() {
  console.log('[Scheduler] Initializing...');
  await cleanupOrphanedWorkflows();
  await setupCronJobs();

  // Weekly Intelligence: every Monday at 12 AM (midnight)
  const wiTask = cron.schedule('0 0 * * 1', async () => {
    console.log('[Scheduler] Monday cron: starting Weekly Intelligence scan');
    try {
      const trendId = await weeklyIntelligenceEngine.runWeeklyScan();
      console.log(`[Scheduler] Weekly Intelligence scan completed (trend ID: ${trendId})`);
    } catch (error) {
      console.error('[Scheduler] Weekly Intelligence scan failed:', error);
    }
  });
  activeTasks.push(wiTask);
  console.log('[Scheduler] Weekly Intelligence cron scheduled (Monday 12 AM)');

  console.log('[Scheduler] Ready');
}

// ── Notification helpers (stubs) ────────────────────────────

export async function sendWorkflowCompleteNotification(summary: {
  workflowId: number;
  configName: string;
  totalFound: number;
  autoApproved: number;
  needsReview: number;
  researched: number;
  timestamp: Date;
}) {
  const dayName = summary.timestamp.toLocaleDateString('en-US', { weekday: 'long' });
  const time = summary.timestamp.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const emailBody = `
    Good morning! ${dayName}'s discovery run completed successfully.

    Discovery Summary:
    - Found: ${summary.totalFound} companies
    - Auto-approved: ${summary.autoApproved} companies (already researched)
    - Need your review: ${summary.needsReview} companies

    Action Items:
    ${summary.needsReview > 0
      ? `- Review ${summary.needsReview} pending approvals in dashboard`
      : '- All companies auto-approved - check library for new research'
    }

    Quick Links:
    - Approval Queue: ${process.env.APP_URL}/agent
    - Research Library: ${process.env.APP_URL}/library

    Started: ${dayName} at ${time}
    Completed: ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
  `;

  // TODO: Implement actual email sending
  console.log('[Notification] Email sent:', emailBody);
}

async function sendErrorNotification(params: {
  configName: string;
  error: string;
  timestamp: Date;
}) {
  const emailBody = `
    Discovery Workflow Error

    Configuration: ${params.configName}
    Error: ${params.error}
    Time: ${params.timestamp.toLocaleString()}

    Please check the agent dashboard for details.
  `;

  console.error('[Notification] Error email:', emailBody);
}

/**
 * Test scheduler (run manually)
 */
export async function testScheduler() {
  console.log('[Test] Running manual discovery test...');

  const configs = await storage.getActiveAgentConfigs();

  if (configs.length === 0) {
    console.log('[Test] No active configurations - create one first');
    return;
  }

  const workflowId = await agentOrchestrator.runDiscoveryWorkflow(configs[0].id);
  console.log(`[Test] Test workflow ${workflowId} started`);
}
