/**
 * PI Baseline AI Agent — worker-facing wrappers over 03 propose orchestrator paths.
 */
import {
  validateCandidatesWithAI,
  proposeFromSlideImage,
  parseSlideExtraction,
  runProposePipeline,
} from './Delivera-Governance-PIBaseline-03Propose-Agent.js';
import { appendAgentQueueItem } from './Delivera-Agent-Queue-01Store-IO.js';
import { AI_TASK_TYPES } from './Delivera-AI-Task-Contracts-01SSOT.js';

export { parseSlideExtraction, runProposePipeline };

export async function classifyPiBaselineCandidates(candidates, quarter, providerConfig = {}, opts = {}) {
  if (!candidates.length) return { candidateItems: [], needsHumanConfirmation: true, fallbackUsed: true };
  const result = await validateCandidatesWithAI(candidates, quarter, providerConfig);
  const usedAi = result.some((c) => String(c.method || '').includes('ai'));
  if (usedAi) {
    await appendAgentQueueItem({
      source: 'ai-orchestrator',
      agentType: 'PIAgent',
      taskType: AI_TASK_TYPES.PI_BASELINE_CLASSIFY,
      summary: 'PI baseline suggestions ready',
      aiContributed: true,
      approvalRequired: true,
      projects: opts.projects || [],
    });
  }
  return {
    candidateItems: result,
    needsHumanConfirmation: true,
    fallbackUsed: !usedAi,
  };
}

export async function proposePiBaselineFromSlide(opts = {}) {
  const result = await proposeFromSlideImage(opts);
  if (result.aiContributed) {
    await appendAgentQueueItem({
      source: 'ai-orchestrator',
      agentType: 'PIAgent',
      taskType: AI_TASK_TYPES.PI_BASELINE_CLASSIFY,
      summary: `PI slide: ${(result.candidates || []).length} item(s)`,
      aiContributed: true,
      approvalRequired: true,
      projects: opts.projects || [],
    });
  }
  return result;
}

export async function runPiBaselineAgentJob({ projects, cache, version3Client, quarter, providerConfig }) {
  return runProposePipeline({ projects, cache, version3Client, quarter, providerConfig });
}
