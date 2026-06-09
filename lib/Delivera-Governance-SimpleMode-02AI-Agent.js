/**
 * Simple Mode AI Agent — simple English + Swahili copy via orchestrator.
 */
import { runStructuredAITask, AI_TASK_TYPES } from './Delivera-AI-Orchestrator-01Router-SSOT.js';
import { appendAgentQueueItem } from './Delivera-Agent-Queue-01Store-IO.js';

export async function runSimpleModeAgent({
  tier = 'watch',
  brief = {},
  providerConfig = {},
  projects = [],
} = {}) {
  const dt = brief?.deliveryTruth || {};
  const payload = {
    tier,
    statusTier: tier,
    staleCount: Number(dt.staleInProgress) || 0,
    blockedCount: Number(dt.blocked) || 0,
    shortHelp: brief?.executiveView?.verdictLine || '',
    buttonLabel: 'Review action',
  };

  const { result, fallbackUsed } = await runStructuredAITask(
    AI_TASK_TYPES.SIMPLE_MODE_COPY,
    payload,
    { providerConfig },
  );

  if (!fallbackUsed) {
    await appendAgentQueueItem({
      source: 'ai-orchestrator',
      agentType: 'SimpleModeAgent',
      taskType: AI_TASK_TYPES.SIMPLE_MODE_COPY,
      summary: 'Simple Mode copy improved',
      aiContributed: true,
      approvalRequired: false,
      projects,
    });
  }

  return { copy: result, fallbackUsed };
}
