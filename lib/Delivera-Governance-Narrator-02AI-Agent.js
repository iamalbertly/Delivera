/**
 * Governance Narrator Agent — AI wording via orchestrator; facts from contract.
 */
import { runStructuredAITask, AI_TASK_TYPES } from './Delivera-AI-Orchestrator-01Router-SSOT.js';
import { narrateBriefTemplate } from './Delivera-Governance-Brief-02Narrator-Template.js';
import { appendAgentQueueItem } from './Delivera-Agent-Queue-01Store-IO.js';
import { recordImprovementEvent } from './Delivera-Improvement-Events-01Store-IO.js';

export async function runGovernanceNarratorAgent({
  contract,
  knowledge = null,
  providerConfig = {},
  reqHeaders = {},
  runId = 'narrator',
  projects = [],
} = {}) {
  const template = narrateBriefTemplate(contract, knowledge);
  const payload = { contract, factContract: contract, knowledge };

  const { result, fallbackUsed, confidence } = await runStructuredAITask(
    AI_TASK_TYPES.GOVERNANCE_NARRATION,
    payload,
    { providerConfig, reqHeaders, runId },
  );

  const narrative = {
    confidence: result.confidence === 'safe' ? template.confidence : template.confidence,
    headline: result.summary || template.headline,
    oneParagraph: result.riskExplanation || template.oneParagraph,
    meetingAnswer: result.managerAnswer || template.meetingAnswer,
    whatToSay: result.piForumAnswer || template.whatToSay,
    protectMeAnswer: result.protectMeAnswer || template.whatToSay,
    simpleSummary: result.simpleSummary || template.meetingAnswer,
    decisionsNeeded: template.decisionsNeeded,
    narratedBy: fallbackUsed ? 'template' : 'advisor',
    issueKeysUsed: result.issueKeysUsed || [],
  };

  if (!fallbackUsed) {
    await appendAgentQueueItem({
      source: 'ai-orchestrator',
      agentType: 'PhraseAgent',
      taskType: AI_TASK_TYPES.GOVERNANCE_NARRATION,
      summary: 'Better wording ready',
      aiContributed: true,
      approvalRequired: false,
      projects,
      payload: { confidence },
    });
  } else {
    await recordImprovementEvent({
      eventType: 'ai-fallback-used',
      surface: 'brief',
      scope: { project: projects[0] || '*' },
      payload: { taskType: AI_TASK_TYPES.GOVERNANCE_NARRATION },
    });
  }

  return { narrative, fallbackUsed, confidence };
}

/** Bridge for assemble service — drop-in replacement for narrateBriefViaProvider pattern. */
export async function narrateBriefViaOrchestrator(contract, providerConfig, templateFn, opts = {}) {
  const { narrative, fallbackUsed } = await runGovernanceNarratorAgent({
    contract,
    providerConfig,
    ...opts,
  });
  if (fallbackUsed && templateFn) return templateFn();
  return narrative;
}
