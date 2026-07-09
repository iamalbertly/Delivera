/**
 * SSOT: AI budget guard — per-run call/token limits and stale-data safety.
 */

const DEFAULT_LIMITS = Object.freeze({
  maxCallsPerRun: 12,
  maxTokensPerTask: 4096,
  maxRetries: 1,
  providerTimeoutMs: 45000,
});

const TASK_LIMITS = Object.freeze({
  'governance-narration': { maxCallsPerRun: 3, maxTokensPerTask: 2048 },
  'pi-baseline-classify': { maxCallsPerRun: 4, maxTokensPerTask: 2048 },
  'pi-slide-vision': { maxCallsPerRun: 4, maxTokensPerTask: 4096 },
  'epic-hygiene-suggest': { maxCallsPerRun: 2, maxTokensPerTask: 1536 },
  'feedback-triage': { maxCallsPerRun: 2, maxTokensPerTask: 2048 },
  'simple-mode-copy': { maxCallsPerRun: 6, maxTokensPerTask: 512 },
  'action-plan': { maxCallsPerRun: 2, maxTokensPerTask: 2048 },
  'risk-explanation': { maxCallsPerRun: 4, maxTokensPerTask: 1024 },
  'translation-helper': { maxCallsPerRun: 8, maxTokensPerTask: 512 },
});

/** In-memory per-run counters (reset per worker tick or request scope). */
const runCounters = new Map();

export function resetBudgetRun(runId = 'default') {
  runCounters.set(runId, { calls: 0, tokens: 0, byTask: {} });
}

function getRunState(runId = 'default') {
  if (!runCounters.has(runId)) resetBudgetRun(runId);
  return runCounters.get(runId);
}

function limitsForTask(taskType) {
  return { ...DEFAULT_LIMITS, ...(TASK_LIMITS[taskType] || {}) };
}

/**
 * Throws if budget exceeded or data too dangerous for AI.
 * @param {string} taskType
 * @param {object} [opts]
 * @param {string} [opts.runId]
 * @param {object} [opts.payload]
 * @param {object} [opts.taskContract]
 */
export function checkBudget(taskType, { runId = 'default', payload = {}, taskContract = {} } = {}) {
  const limits = limitsForTask(taskType);
  const state = getRunState(runId);

  if (state.calls >= limits.maxCallsPerRun) {
    throw new Error(`AI budget exceeded: max ${limits.maxCallsPerRun} calls per run`);
  }

  const taskCalls = state.byTask[taskType] || 0;
  const taskLimit = limits.maxCallsPerRun;
  if (taskCalls >= taskLimit) {
    throw new Error(`AI budget exceeded for task ${taskType}`);
  }

  const freshness = payload?.contract?.freshness || payload?.factContract?.freshness || payload?.freshness;
  if (freshness?.confidenceLimit === 'stale' && taskType === 'governance-narration') {
    throw new Error('AI disabled: stale data — use template narration');
  }

  const maxTokens = taskContract.maxTokens || limits.maxTokensPerTask;
  if (maxTokens > limits.maxTokensPerTask) {
    throw new Error(`Task maxTokens ${maxTokens} exceeds guard limit`);
  }

  return { limits, maxTokens, timeoutMs: limits.providerTimeoutMs };
}

export function recordBudgetUsage(taskType, { runId = 'default', promptTokens = 0, completionTokens = 0 } = {}) {
  const state = getRunState(runId);
  state.calls += 1;
  state.tokens += (Number(promptTokens) || 0) + (Number(completionTokens) || 0);
  state.byTask[taskType] = (state.byTask[taskType] || 0) + 1;
}

export function getBudgetSnapshot(runId = 'default') {
  return { ...(getRunState(runId)) };
}
