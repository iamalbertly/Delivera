/**
 * Epic Hygiene AI Agent — naming suggestions via orchestrator.
 */
import { runStructuredAITask, AI_TASK_TYPES } from './Delivera-AI-Orchestrator-01Router-SSOT.js';
import { scoreEpicHygiene } from './Delivera-Governance-EpicHygiene-01Score-SSOT.js';
import { appendAgentQueueItem } from './Delivera-Agent-Queue-01Store-IO.js';

export async function runEpicHygieneAgent({ brief = {}, boardPayloads = [], quarter = '', providerConfig = {}, projects = [] } = {}) {
  const hygiene = scoreEpicHygiene(brief, boardPayloads);
  const weakEpics = (hygiene.weak || hygiene.suggestions || []).map((e) => ({
    issueKey: e.issueKey,
    currentTitle: e.summary || e.title,
    suggestedTitle: e.suggestedTitle,
    missingParts: e.missingParts || [],
    score: e.score,
  }));

  if (!weakEpics.length) {
    return { weakEpics: [], fallbackUsed: false };
  }

  const { result, fallbackUsed } = await runStructuredAITask(
    AI_TASK_TYPES.EPIC_HYGIENE_SUGGEST,
    { weakEpics, quarter: quarter || brief?.period?.vodacomQuarter || 'FY27 Q1' },
    { providerConfig },
  );

  if (!fallbackUsed && (result.weakEpics || []).length) {
    await appendAgentQueueItem({
      source: 'ai-orchestrator',
      agentType: 'DataAgent',
      taskType: AI_TASK_TYPES.EPIC_HYGIENE_SUGGEST,
      summary: `${result.weakEpics.length} epic name(s) need cleanup`,
      aiContributed: true,
      approvalRequired: true,
      projects,
    });
  }

  return { weakEpics: result.weakEpics || weakEpics, fallbackUsed };
}
