/**
 * SSOT: AI Orchestrator — single governed reasoning layer for all AI tasks.
 */
import { resolveProviderConfig } from './Delivera-AI-Provider-Gateway.js';
import {
  providerFailureLogCategory,
  runAITask as gatewayRunAITask,
  runStructuredAITask as gatewayRunStructured,
  runVisionAITask as gatewayRunVision,
} from './Delivera-AI-Provider-Gateway.js';
import { getTaskContract, AI_TASK_TYPES } from './Delivera-AI-Task-Contracts-01SSOT.js';
import { redactPayloadForTask } from './Delivera-AI-Redaction-01Helper.js';
import { checkBudget, recordBudgetUsage } from './Delivera-AI-Budget-01Guard-SSOT.js';
import { verifyAiOutput } from './Delivera-AI-Output-Verify-01SSOT.js';
import { recordAiUsage } from './Delivera-AI-Usage-01Audit-IO.js';
import { aiProviderEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';

export { AI_TASK_TYPES, getTaskContract };

/** One log line per task-type per window when quota is hit — avoid three scary stacks per page. */
const quotaLogLastAt = new Map();
const QUOTA_LOG_WINDOW_MS = 60_000;

function warnTaskFailure(taskType, err) {
  const category = providerFailureLogCategory(err?.message);
  if (category === 'provider-limit-reached') {
    const last = quotaLogLastAt.get(taskType) || 0;
    if (Date.now() - last < QUOTA_LOG_WINDOW_MS) return;
    quotaLogLastAt.set(taskType, Date.now());
    console.warn(`[AI-Orchestrator] ${taskType} provider-limit-reached (throttled) — using fallback templates`);
    return;
  }
  console.warn(`[AI-Orchestrator] ${taskType} failed (${category}), using fallback`);
}

function normalizeTextKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b[a-z][a-z0-9]+-\d+\b/gi, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeIssueKeys(keys = []) {
  return Array.from(new Set((Array.isArray(keys) ? keys : [])
    .map((k) => String(k || '').trim().toUpperCase())
    .filter(Boolean)))
    .sort();
}

function uniqueBy(items = [], keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of (Array.isArray(items) ? items : [])) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function resolveModelForTask(taskType, providerConfig = {}) {
  const env = aiProviderEnvConfig;
  const map = {
    'governance-narration': env.openrouterModelGovernance,
    'pi-baseline-classify': env.openrouterModelVision || env.openrouterModelGovernance,
    'epic-hygiene-suggest': env.openrouterModelGovernance,
    'feedback-triage': env.openrouterModelFeedback,
    'simple-mode-copy': env.openrouterModelSimpleCopy,
    'action-plan': env.openrouterModelGovernance,
    'risk-explanation': env.openrouterModelSimpleCopy,
    'translation-helper': env.openrouterModelSimpleCopy,
    'pi-artifact-ocr': env.openrouterModelPiOcr,
    'pi-artifact-structure-classify': env.openrouterModelPiVision,
    'pi-artifact-reconcile': env.openrouterModelPiReconcile,
  };
  const model = providerConfig.modelOverride || map[taskType] || env.openrouterModelDefault || 'openai/gpt-4o-mini';
  return { ...providerConfig, model };
}

function dedupeAiOutputForTask(output = {}, taskType) {
  if (!output || typeof output !== 'object') return output;
  const next = { ...output };

  if (Array.isArray(next.issueKeysUsed)) {
    next.issueKeysUsed = normalizeIssueKeys(next.issueKeysUsed);
  }

  if (taskType === AI_TASK_TYPES.ACTION_PLAN && Array.isArray(next.groupedActions)) {
    next.groupedActions = uniqueBy(next.groupedActions.map((action) => {
      const issueKeys = normalizeIssueKeys(action?.issueKeys);
      return {
        ...action,
        issueKeys,
        owner: String(action?.owner || action?.decisionNeededFrom || 'Scrum Master').trim(),
        action: String(action?.action || '').trim(),
        nudgeDraft: String(action?.nudgeDraft || action?.action || '').trim(),
      };
    }).filter((action) => action.action || action.issueKeys.length), (action) => {
      const issuePart = action.issueKeys.join(',');
      const ownerPart = normalizeTextKey(action.owner);
      const actionPart = normalizeTextKey(action.action || action.nudgeDraft);
      return `${ownerPart}|${issuePart || actionPart}`;
    }).slice(0, 5);
  }

  if (taskType === AI_TASK_TYPES.EPIC_HYGIENE_SUGGEST && Array.isArray(next.weakEpics)) {
    next.weakEpics = uniqueBy(next.weakEpics.map((epic) => ({
      ...epic,
      issueKey: String(epic?.issueKey || '').trim().toUpperCase(),
      currentTitle: String(epic?.currentTitle || epic?.summary || epic?.title || '').trim(),
      suggestedTitle: String(epic?.suggestedTitle || epic?.currentTitle || epic?.summary || '').trim(),
      missingParts: Array.isArray(epic?.missingParts)
        ? Array.from(new Set(epic.missingParts.map((p) => String(p || '').trim()).filter(Boolean)))
        : [],
    })).filter((epic) => epic.issueKey || epic.currentTitle), (epic) => epic.issueKey || normalizeTextKey(epic.currentTitle)).slice(0, 20);
  }

  if (taskType === AI_TASK_TYPES.PI_BASELINE_CLASSIFY && Array.isArray(next.candidateItems)) {
    next.candidateItems = uniqueBy(next.candidateItems.map((item) => ({
      ...item,
      issueKey: String(item?.issueKey || '').trim().toUpperCase(),
      title: String(item?.title || item?.summary || '').trim(),
    })).filter((item) => item.issueKey || item.title), (item) => item.issueKey || normalizeTextKey(item.title)).slice(0, 50);
  }

  if (taskType === AI_TASK_TYPES.FEEDBACK_TRIAGE && Array.isArray(next.proposals)) {
    next.proposals = uniqueBy(next.proposals.map((proposal) => ({
      ...proposal,
      agent: String(proposal?.agent || 'Improvement').trim(),
      proposal: String(proposal?.proposal || '').trim(),
      affectedScope: String(proposal?.affectedScope || '*').trim(),
    })).filter((proposal) => proposal.proposal), (proposal) => {
      return `${normalizeTextKey(proposal.agent)}|${normalizeTextKey(proposal.affectedScope)}|${normalizeTextKey(proposal.proposal)}`;
    }).slice(0, 10);
  }

  return next;
}

async function executeWithFallback(taskContract, payload, runner, opts = {}) {
  const taskType = taskContract.taskType;
  const runId = opts.runId || 'default';
  const providerConfig = resolveModelForTask(taskType, opts.providerConfig || resolveProviderConfig(opts.reqHeaders || {}));

  let budgetMeta;
  try {
    budgetMeta = checkBudget(taskType, { runId, payload, taskContract });
  } catch (err) {
    const fallback = taskContract.fallbackFn(payload);
    await recordAiUsage({ taskType, provider: 'built-in', success: true, fallbackUsed: true });
    return { result: fallback, fallbackUsed: true, confidence: 'review', error: err.message };
  }

  const redacted = redactPayloadForTask(payload, taskContract);

  if (providerConfig.provider === 'built-in' || (!providerConfig.apiKey && !providerConfig.host && providerConfig.provider !== 'ollama')) {
    const fallback = taskContract.fallbackFn(payload);
    await recordAiUsage({ taskType, provider: 'built-in', success: true, fallbackUsed: true });
    return { result: fallback, fallbackUsed: true, confidence: 'review' };
  }

  try {
    const raw = await runner(taskContract, redacted, providerConfig, budgetMeta);
    const output = dedupeAiOutputForTask(raw?.parsed ?? raw, taskType);
    const verification = verifyAiOutput(output, taskType, payload);

    await recordBudgetUsage(taskType, {
      runId,
      promptTokens: raw?.usage?.promptTokens,
      completionTokens: raw?.usage?.completionTokens,
    });
    await recordAiUsage({
      taskType,
      provider: providerConfig.provider,
      model: providerConfig.model || raw?.model,
      promptTokens: raw?.usage?.promptTokens,
      completionTokens: raw?.usage?.completionTokens,
      success: verification.pass,
      fallbackUsed: false,
    });

    if (!verification.pass) {
      const fallback = taskContract.fallbackFn(payload);
      await recordAiUsage({ taskType, provider: providerConfig.provider, success: false, fallbackUsed: true });
      return {
        result: { ...fallback, _verificationViolations: verification.violations },
        fallbackUsed: true,
        confidence: verification.confidence,
        violations: verification.violations,
      };
    }

    return {
      result: { ...output, confidence: output.confidence || verification.confidence },
      fallbackUsed: false,
      confidence: verification.confidence,
      model: raw?.model || providerConfig.model,
    };
  } catch (err) {
    warnTaskFailure(taskType, err);
    const fallback = taskContract.fallbackFn(payload);
    await recordAiUsage({
      taskType,
      provider: providerConfig.provider,
      model: providerConfig.model,
      success: false,
      fallbackUsed: true,
    });
    return { result: fallback, fallbackUsed: true, confidence: 'review', error: err.message, model: providerConfig.model };
  }
}

/**
 * @param {string|object} taskTypeOrContract
 * @param {object} payload
 * @param {object} [opts]
 */
export async function runAITask(taskTypeOrContract, payload = {}, opts = {}) {
  const taskContract = typeof taskTypeOrContract === 'string'
    ? getTaskContract(taskTypeOrContract)
    : taskTypeOrContract;
  return executeWithFallback(taskContract, payload, gatewayRunAITask, opts);
}

export async function runStructuredAITask(taskTypeOrContract, payload = {}, opts = {}) {
  const taskContract = typeof taskTypeOrContract === 'string'
    ? getTaskContract(taskTypeOrContract)
    : taskTypeOrContract;
  return executeWithFallback(taskContract, payload, gatewayRunStructured, opts);
}

export async function runVisionAITask(taskTypeOrContract, payload = {}, opts = {}) {
  const taskContract = typeof taskTypeOrContract === 'string'
    ? getTaskContract(taskTypeOrContract)
    : taskTypeOrContract;
  return executeWithFallback(taskContract, payload, gatewayRunVision, opts);
}
