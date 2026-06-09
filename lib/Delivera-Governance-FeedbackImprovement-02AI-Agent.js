/**
 * Feedback Improvement AI Agent — summarize repeated feedback via orchestrator.
 */
import { runStructuredAITask, AI_TASK_TYPES } from './Delivera-AI-Orchestrator-01Router-SSOT.js';
import { readImprovementEvents } from './Delivera-Improvement-Events-01Store-IO.js';
import { classifyFeedbackToAgent, FEEDBACK_AGENTS } from './Delivera-Governance-FeedbackTriage-01Agents-SSOT.js';
import { appendAgentQueueItem } from './Delivera-Agent-Queue-01Store-IO.js';

export async function runFeedbackImprovementAgent({ project = '', providerConfig = {}, hours = 168 } = {}) {
  const events = await readImprovementEvents({ project, limit: 50, hours });
  if (!events.length) {
    return { proposals: [], fallbackUsed: false };
  }

  const grouped = {};
  for (const ev of events) {
    const agent = classifyFeedbackToAgent(ev);
    grouped[agent] = grouped[agent] || [];
    grouped[agent].push(ev);
  }

  const { result, fallbackUsed } = await runStructuredAITask(
    AI_TASK_TYPES.FEEDBACK_TRIAGE,
    { events: events.slice(0, 30), grouped, project },
    { providerConfig },
  );

  if (!fallbackUsed && (result.proposals || []).length) {
    await appendAgentQueueItem({
      source: 'ai-orchestrator',
      agentType: 'PhraseAgent',
      taskType: AI_TASK_TYPES.FEEDBACK_TRIAGE,
      summary: `${result.proposals.length} feedback improvement proposal(s)`,
      aiContributed: true,
      approvalRequired: true,
      projects: project ? [project] : [],
      payload: { proposals: result.proposals },
    });
  }

  return {
    proposals: (result.proposals || []).map((p) => ({
      ...p,
      agent: p.agent || FEEDBACK_AGENTS.phrase,
      requiresApproval: p.requiresApproval !== false,
    })),
    fallbackUsed,
  };
}
