/**
 * Parent Agent Runtime — schedules sub-agent jobs via worker boundary.
 * Load facts → build task contract → AI if needed → verify → queue → approval.
 */
import { logger } from './Delivera-Server-Logging-Utility.js';
import { resolveProviderConfig } from './Delivera-AI-Provider-Gateway.js';
import { resetBudgetRun } from './Delivera-AI-Budget-01Guard-SSOT.js';
import { aiProviderEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';
import { recordJob, updateJobStatus, hasRecentRunningJob } from './Delivera-Governance-Worker-02Jobs-IO.js';
import { runGovernanceNarratorAgent } from './Delivera-Governance-Narrator-02AI-Agent.js';
import { runPiBaselineAgentJob } from './Delivera-Governance-PIBaseline-05AI-Agent.js';
import { runEpicHygieneAgent } from './Delivera-Governance-EpicHygiene-02AI-Agent.js';
import { runFeedbackImprovementAgent } from './Delivera-Governance-FeedbackImprovement-02AI-Agent.js';
import { runSimpleModeAgent } from './Delivera-Governance-SimpleMode-02AI-Agent.js';
import { runActionPlanningAgent } from './Delivera-Governance-ActionPlan-02AI-Agent.js';
import { recordImprovementEvent } from './Delivera-Improvement-Events-01Store-IO.js';

function workerProviderConfig() {
  const env = aiProviderEnvConfig;
  if (env.openrouterApiKey) {
    return { provider: 'openrouter', apiKey: env.openrouterApiKey, host: '' };
  }
  if (env.openaiApiKey) return { provider: 'openai', apiKey: env.openaiApiKey, host: '' };
  if (env.claudeApiKey) return { provider: 'claude', apiKey: env.claudeApiKey, host: '' };
  return { provider: 'built-in', apiKey: '', host: '' };
}

function hasWorkerAiKey() {
  const p = workerProviderConfig();
  return Boolean(p.apiKey && p.provider !== 'built-in');
}

/**
 * @param {string} jobType
 * @param {object} ctx
 */
export async function runAgentOrchestratorJob(jobType, ctx = {}) {
  const runId = `worker-${Date.now()}`;
  resetBudgetRun(runId);
  const providerConfig = ctx.providerConfig
    || (ctx.reqHeaders ? resolveProviderConfig(ctx.reqHeaders || {}) : workerProviderConfig());

  switch (jobType) {
    case 'prepareGovernanceBrief':
      return runGovernanceNarratorAgent({
        contract: ctx.brief || ctx.contract,
        knowledge: ctx.knowledge,
        providerConfig,
        runId,
        projects: ctx.projects,
      });
    case 'proposePIBaseline':
      return runPiBaselineAgentJob(ctx);
    case 'suggestEpicHygiene':
      return runEpicHygieneAgent({
        brief: ctx.brief,
        boardPayloads: ctx.boardPayloads,
        quarter: ctx.quarter,
        providerConfig,
        projects: ctx.projects,
      });
    case 'triageFeedback':
      return runFeedbackImprovementAgent({
        project: ctx.projects?.[0],
        providerConfig,
      });
    case 'generateSimpleModeCopy':
      return runSimpleModeAgent({
        tier: ctx.tier,
        brief: ctx.brief,
        providerConfig,
        projects: ctx.projects,
      });
    case 'prepareGroupedActions':
      return runActionPlanningAgent({
        brief: ctx.brief,
        providerConfig,
        projects: ctx.projects,
        jobId: ctx.jobId,
      });
    case 'buildImpactPack':
      return ctx.buildImpactPack?.(ctx);
    default:
      throw new Error(`Unknown agent job: ${jobType}`);
  }
}

export async function runProposeBaselineJob(projects, deps) {
  if (await hasRecentRunningJob({ type: 'propose-pi-baseline', projects, withinMinutes: 30 })) return;
  const job = await recordJob({ type: 'propose-pi-baseline', status: 'running', projects });
  try {
    if (!hasWorkerAiKey()) {
      await updateJobStatus(job.id, { status: 'skipped', completedAt: new Date().toISOString(), outputs: { reason: 'no-ai-key' } });
      return;
    }
    const result = await runPiBaselineAgentJob({ ...deps, projects, providerConfig: workerProviderConfig() });
    await updateJobStatus(job.id, { status: 'completed', completedAt: new Date().toISOString(), outputs: { candidates: result.candidates?.length || 0 } });
  } catch (err) {
    await updateJobStatus(job.id, { status: 'failed', completedAt: new Date().toISOString(), errors: [err?.message] });
    await recordImprovementEvent({ eventType: 'ai-fallback-used', surface: 'worker', scope: { project: projects[0] }, payload: { job: 'propose-pi-baseline' } });
  }
}

export async function runEpicHygieneJob(projects, ctx) {
  if (await hasRecentRunningJob({ type: 'suggest-epic-hygiene', projects, withinMinutes: 60 })) return;
  const job = await recordJob({ type: 'suggest-epic-hygiene', status: 'running', projects });
  try {
    const result = await runEpicHygieneAgent({ ...ctx, projects, providerConfig: workerProviderConfig() });
    await updateJobStatus(job.id, { status: 'completed', completedAt: new Date().toISOString(), outputs: { weakCount: result.weakEpics?.length || 0 } });
  } catch (err) {
    await updateJobStatus(job.id, { status: 'failed', completedAt: new Date().toISOString(), errors: [err?.message] });
  }
}

export async function runFeedbackTriageJob(projects) {
  if (await hasRecentRunningJob({ type: 'triage-feedback', projects, withinMinutes: 60 })) return;
  const job = await recordJob({ type: 'triage-feedback', status: 'running', projects });
  try {
    const result = await runFeedbackImprovementAgent({ project: projects[0], providerConfig: workerProviderConfig() });
    await updateJobStatus(job.id, { status: 'completed', completedAt: new Date().toISOString(), outputs: { proposals: result.proposals?.length || 0 } });
  } catch (err) {
    await updateJobStatus(job.id, { status: 'failed', completedAt: new Date().toISOString(), errors: [err?.message] });
  }
}

export async function runSimpleModeCopyJob(projects, ctx) {
  if (await hasRecentRunningJob({ type: 'generate-simple-copy', projects, withinMinutes: 120 })) return;
  const job = await recordJob({ type: 'generate-simple-copy', status: 'running', projects });
  try {
    await runSimpleModeAgent({ ...ctx, projects, providerConfig: workerProviderConfig() });
    await updateJobStatus(job.id, { status: 'completed', completedAt: new Date().toISOString() });
  } catch (err) {
    await updateJobStatus(job.id, { status: 'failed', completedAt: new Date().toISOString(), errors: [err?.message] });
  }
}

export async function runGroupedActionsJob(projects, ctx) {
  if (await hasRecentRunningJob({ type: 'prepare-grouped-actions', projects, withinMinutes: 30 })) return;
  const job = await recordJob({ type: 'prepare-grouped-actions', status: 'running', projects });
  try {
    const result = await runActionPlanningAgent({ ...ctx, projects, jobId: job.id, providerConfig: workerProviderConfig() });
    await updateJobStatus(job.id, { status: 'completed', completedAt: new Date().toISOString(), outputs: { actions: result.groupedActions?.length || 0 } });
  } catch (err) {
    await updateJobStatus(job.id, { status: 'failed', completedAt: new Date().toISOString(), errors: [err?.message] });
  }
}

export { hasWorkerAiKey, workerProviderConfig };

function stage5DeferredAgent(name) {
  return Object.freeze({
    name,
    stage: 'stage5-deferred',
    async run(ctx = {}) {
      return {
        status: 'stage5-deferred',
        agent: name,
        caseId: ctx.caseId || '',
        reason: 'Contract exists for the intervention loop; autonomous execution remains human-gated.',
      };
    },
  });
}

export const EvidenceAgent = stage5DeferredAgent('EvidenceAgent');
export const DiagnosisAgent = stage5DeferredAgent('DiagnosisAgent');
export const InterventionAgent = stage5DeferredAgent('InterventionAgent');
export const LearningAgent = stage5DeferredAgent('LearningAgent');
