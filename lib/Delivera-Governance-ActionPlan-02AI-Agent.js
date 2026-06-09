/**
 * Action Planning AI Agent — grouped nudge drafting via orchestrator.
 */
import { runStructuredAITask, AI_TASK_TYPES } from './Delivera-AI-Orchestrator-01Router-SSOT.js';
import { assignDecisionOwners } from './Delivera-Governance-DecisionOwner-01Map-SSOT.js';
import { appendAgentQueueItem, appendInboxItem } from './Delivera-Agent-Queue-01Store-IO.js';

export async function runActionPlanningAgent({
  brief = {},
  providerConfig = {},
  projects = [],
  jobId = '',
} = {}) {
  const topRisks = assignDecisionOwners((brief.topRisks || brief.risks || []).slice(0, 10));

  const { result, fallbackUsed } = await runStructuredAITask(
    AI_TASK_TYPES.ACTION_PLAN,
    { topRisks, allowedIssueKeys: topRisks.map((r) => r.issueKey) },
    { providerConfig },
  );

  const groupedActions = (result.groupedActions || []).map((g) => ({
    ...g,
    approvalRequired: g.approvalRequired !== false,
  }));

  if (!fallbackUsed && groupedActions.length) {
    await appendAgentQueueItem({
      source: 'ai-orchestrator',
      agentType: 'ActionAgent',
      taskType: AI_TASK_TYPES.ACTION_PLAN,
      summary: `${groupedActions.length} grouped action(s) prepared`,
      aiContributed: true,
      approvalRequired: true,
      projects,
      payload: { doFirst: result.doFirst, groupedActions },
    });

    for (const action of groupedActions.slice(0, 3)) {
      await appendInboxItem({
        jobId,
        type: 'nudge',
        projects,
        summary: `${action.owner}: ${String(action.action || '').slice(0, 120)}`,
        safeToSend: brief.freshness?.confidenceLimit !== 'stale',
        approvalRequired: true,
        evidenceLinks: (action.issueKeys || []).filter(Boolean),
        payload: {
          issueKeys: action.issueKeys,
          draftText: action.nudgeDraft || action.action,
          aiContributed: true,
          grouped: true,
        },
      });
    }
  }

  return {
    doFirst: result.doFirst || groupedActions[0]?.action || '',
    groupedActions,
    fallbackUsed,
  };
}
