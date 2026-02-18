// server/scheduler.ts

import cron from 'node-cron';
import { agentOrchestrator } from './agent-orchestrator';
import { storage } from './storage';

/**
 * Evening Discovery Schedule
 * Runs Sunday, Tuesday, Thursday at 7 PM
 * User wakes up to new discoveries on Mon/Wed/Fri mornings
 */

// Sunday 7 PM, Tuesday 7 PM, Thursday 7 PM
// Cron format: minute hour day-of-month month day-of-week
// 0 19 * * 0,2,4 = 7 PM on Sunday(0), Tuesday(2), Thursday(4)
cron.schedule('0 19 * * 0,2,4', async () => {
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[now.getDay()];
  
  console.log(`[Scheduler] Starting ${dayName} evening discovery run...`);
  
  try {
    // Get all active agent configurations
    const configs = await storage.getActiveAgentConfigs();
    
    if (configs.length === 0) {
      console.log('[Scheduler] No active configurations found');
      return;
    }
    
    // Run each configuration
    for (const config of configs) {
      console.log(`[Scheduler] Running workflow for: ${config.name}`);
      
      try {
        const workflowId = await agentOrchestrator.runDiscoveryWorkflow(config.id);
        console.log(`[Scheduler] Workflow ${workflowId} started for ${config.name}`);
      } catch (error) {
        console.error(`[Scheduler] Workflow failed for ${config.name}:`, error);
        
        // Send error notification
        await sendErrorNotification({
          configName: config.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: now,
        });
      }
    }
    
    console.log(`[Scheduler] ${dayName} evening discovery complete`);
    
  } catch (error) {
    console.error('[Scheduler] Critical error:', error);
  }
});

/**
 * Send success notification after workflow completes
 * Called by agent orchestrator
 */
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
    hour12: true 
  });
  
  // Email notification (using SendGrid or similar)
  const emailBody = `
    Good morning! ${dayName}'s discovery run completed successfully.
    
    📊 Discovery Summary:
    • Found: ${summary.totalFound} companies
    • Auto-approved: ${summary.autoApproved} companies (already researched)
    • Need your review: ${summary.needsReview} companies
    
    ✅ Action Items:
    ${summary.needsReview > 0 
      ? `• Review ${summary.needsReview} pending approvals in dashboard`
      : '• All companies auto-approved - check library for new research'
    }
    
    🔗 Quick Links:
    • Approval Queue: ${process.env.APP_URL}/agent
    • Research Library: ${process.env.APP_URL}/library
    
    Started: ${dayName} at ${time}
    Completed: ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
  `;
  
  // TODO: Implement actual email sending
  console.log('[Notification] Email sent:', emailBody);
}

/**
 * Send error notification
 */
async function sendErrorNotification(params: {
  configName: string;
  error: string;
  timestamp: Date;
}) {
  const emailBody = `
    ⚠️ Discovery Workflow Error
    
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

console.log('[Scheduler] Evening discovery schedule initialized');
console.log('[Scheduler] Will run: Sunday 7 PM, Tuesday 7 PM, Thursday 7 PM');
