import { buildHumanNudgeDraft, shortenIssueSummary as shortenIssueSummaryHuman } from './Delivera-CurrentSprint-JiraNudge-01HumanText-SSOT.js';

const SUMMARY_CONTEXT_KEY = 'delivera.currentSprint.summaryContext.v1';
const NUDGE_RATE_LIMIT_PREFIX = 'delivera.currentSprint.nudgeRateLimit.v1.';
const SIMPLE_ENGLISH_KEY = 'delivera.simpleEnglishMode.v1';
const COACHING_LEVEL_KEY = 'delivera.coachingLevel.v1';

function asText(value) {
  return String(value == null ? '' : value).trim();
}

function safeFirstLine(text) {
  const line = asText(text).split('\n').map((row) => row.trim()).find(Boolean);
  return line || '';
}

function extractLineByPrefix(text, prefix) {
  const normalizedPrefix = String(prefix || '').toLowerCase();
  const rows = asText(text).split('\n').map((row) => row.trim()).filter(Boolean);
  const hit = rows.find((row) => row.toLowerCase().startsWith(normalizedPrefix));
  return hit || '';
}

function truncate(text, max = 220) {
  const value = asText(text);
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}

function readSimpleEnglishMode() {
  try {
    const value = window.localStorage.getItem(SIMPLE_ENGLISH_KEY);
    if (value == null) return true;
    return String(value).trim().toLowerCase() !== 'false';
  } catch (_) {
    return true;
  }
}

function readCoachingLevel() {
  try {
    const raw = String(window.localStorage.getItem(COACHING_LEVEL_KEY) || '').trim().toLowerCase();
    if (raw === 'guide' || raw === 'assist' || raw === 'concise') return raw;
  } catch (_) {}
  return 'concise';
}

function deriveTopAction(summaryText, fallbackAction = '') {
  const explicit = extractLineByPrefix(summaryText, 'Next:')
    || extractLineByPrefix(summaryText, 'Risks:')
    || extractLineByPrefix(summaryText, 'Scope:')
    || extractLineByPrefix(summaryText, 'Capacity:');
  if (explicit) return explicit.replace(/^[A-Za-z]+\s*:\s*/, '').trim();
  return asText(fallbackAction) || 'Unblock the top active risk in this sprint.';
}

function readRoleMode() {
  try {
    const mode = String(window.localStorage.getItem('current_sprint_role_mode') || '').trim().toLowerCase();
    if (!mode) return 'all';
    if (mode === 'scrum-master' || mode === 'developer' || mode === 'product-owner' || mode === 'line-manager') return mode;
    return 'all';
  } catch (_) {
    return 'all';
  }
}

function roleLabel(roleMode) {
  if (roleMode === 'scrum-master') return 'Scrum Master';
  if (roleMode === 'developer') return 'Developer';
  if (roleMode === 'product-owner') return 'Product Owner';
  if (roleMode === 'line-manager') return 'Line Manager';
  return 'Team';
}

function roleActionHint(roleMode) {
  if (roleMode === 'scrum-master') return 'Unblock the issue now, assign DRI, and confirm stand-up follow-up.';
  if (roleMode === 'developer') return 'Update in-progress signal and log effort against the estimate baseline.';
  if (roleMode === 'product-owner') return 'Confirm scope impact and decide keep, split, or defer.';
  if (roleMode === 'line-manager') return 'Close ownership gaps and align staffing for stuck work.';
  return 'Resolve the top risk with one clear owner and next step.';
}

function simplifyLine(line, simpleEnglishMode) {
  const text = asText(line);
  if (!text || !simpleEnglishMode) return text;
  return text
    .replace(/validate[d]?\s+after\s+action/ig, 'check after action')
    .replace(/recommended action now/ig, 'Do now')
    .replace(/confidence:/ig, 'Trust:')
    .replace(/historical snapshot/ig, 'old data snapshot')
    .replace(/insufficient/ig, 'not enough')
    .replace(/ownership/ig, 'owner');
}

function deriveEvidenceBand({ health, risks, capacity }) {
  const h = asText(health).toLowerCase();
  const r = asText(risks).toLowerCase();
  const c = asText(capacity).toLowerCase();
  if (h.includes('historical snapshot')) return 'snapshot';
  if (h.includes('just started') || h.includes('evidence not formed')) return 'low';
  if (r.includes('stale') || r.includes('unassigned') || c.includes('0h')) return 'actionable';
  return 'emerging';
}

function normalizeContradictions(context) {
  const next = { ...context };
  const risksLower = asText(next.risks).toLowerCase();
  const healthLower = asText(next.health).toLowerCase();
  const saysNoRisk = healthLower.includes('no risks yet') || healthLower.includes('no risk');
  const hasRiskSignal = Boolean(risksLower) && !risksLower.includes('none');
  if (saysNoRisk && hasRiskSignal) {
    next.health = 'Early risk detected; evidence is still forming.';
  }
  return next;
}

function shouldSuppressNudge(issueKey, topAction) {
  const key = asText(issueKey).toUpperCase();
  const action = asText(topAction).toLowerCase();
  if (!key || !action) return false;
  const bucket = `${key}:${action.slice(0, 80)}`;
  try {
    if (typeof sessionStorage === 'undefined') return false;
    const storageKey = `${NUDGE_RATE_LIMIT_PREFIX}${bucket}`;
    const now = Date.now();
    const last = Number(sessionStorage.getItem(storageKey) || 0);
    const withinRateLimit = Number.isFinite(last) && last > 0 && (now - last) < (20 * 60 * 1000);
    if (withinRateLimit) return true;
    sessionStorage.setItem(storageKey, String(now));
  } catch (_) {}
  return false;
}

export function shouldSuppressSend(issueKey, commentBody) {
  return shouldSuppressNudge(issueKey, asText(commentBody).slice(0, 80));
}

export function isSprintCommentSendAllowed(meta = null, sprint = null) {
  const snapshot = meta?.fromSnapshot === true;
  const state = String(sprint?.state || '').toLowerCase();
  if (snapshot) return false;
  if (state && state !== 'active') return false;
  return true;
}

export function buildCommentForUseCase({
  useCase = '',
  issueKey = '',
  issueSummary = '',
  issueStatus = '',
  staleHours = null,
} = {}) {
  return buildHumanNudgeDraft({
    useCase,
    issueKey,
    issueSummary,
    issueStatus,
    staleHours,
  });
}

const STALE_SERVER_COMMENT_HINT =
  'Comment API is missing on this server port — stop and restart npm run dev (or redeploy) so POST /api/issues/:key/comment is registered.';

async function readCommentPostFailure(resp) {
  const status = resp?.status || 0;
  const contentType = asText(resp?.headers?.get?.('content-type') || '').toLowerCase();
  let raw = '';
  try {
    raw = await resp.text();
  } catch (_) {
    raw = '';
  }
  const trimmed = asText(raw);
  const looksLikeExpress404 =
    status === 404
    && (
      /cannot\s+post\s+\/api\/issues/i.test(trimmed)
      || (!contentType.includes('application/json') && trimmed.startsWith('<!'))
    );
  if (looksLikeExpress404) {
    const err = new Error(STALE_SERVER_COMMENT_HINT);
    err.code = 'API_ROUTE_MISSING';
    err.httpStatus = status;
    return err;
  }
  let errMsg = 'Failed to post comment';
  if (contentType.includes('application/json') && trimmed) {
    try {
      const data = JSON.parse(trimmed);
      errMsg = data?.error || data?.message || errMsg;
    } catch (_) {}
  } else if (trimmed && trimmed.length < 240) {
    errMsg = trimmed;
  }
  const err = new Error(errMsg);
  err.httpStatus = status;
  if (status === 404) err.code = 'JIRA_COMMENT_FAILED';
  return err;
}

export async function postIssueCommentToJira(issueKey, commentBody, options = {}) {
  const key = asText(issueKey);
  const body = asText(commentBody);
  if (!key) throw new Error('Issue key is required.');
  if (!body) throw new Error('Comment text is required.');
  if (options.checkRateLimit !== false && shouldSuppressSend(key, body)) {
    const err = new Error('Duplicate send suppressed recently; try again after ownership changes.');
    err.code = 'SEND_RATE_LIMITED';
    throw err;
  }
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 15000;
  const ctrl = new AbortController();
  const timeoutId = window.setTimeout(() => ctrl.abort(), timeoutMs);
  let resp;
  try {
    resp = await fetch(`/api/issues/${encodeURIComponent(key)}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commentBody: body,
        sprintId: options.sprintId ?? getCurrentSprintPayload()?.sprint?.id ?? '',
        boardId: options.boardId ?? getCurrentSprintPayload()?.board?.id ?? '',
      }),
      signal: ctrl.signal,
    });
  } catch (fetchErr) {
    if (fetchErr?.name === 'AbortError') {
      const err = new Error('Comment request timed out — check network and Jira, then retry.');
      err.code = 'SEND_TIMEOUT';
      throw err;
    }
    throw fetchErr;
  } finally {
    window.clearTimeout(timeoutId);
  }
  if (!resp.ok) {
    throw await readCommentPostFailure(resp);
  }
  try {
    const text = await resp.text();
    if (!text) return { success: true };
    return JSON.parse(text);
  } catch (_) {
    return { success: true };
  }
}

export function buildSummaryContext({
  summaryText = '',
  modelMeta = {},
  primaryAction = '',
} = {}) {
  const header = safeFirstLine(summaryText);
  const health = extractLineByPrefix(summaryText, 'Health:');
  const risks = extractLineByPrefix(summaryText, 'Risks:');
  const scope = extractLineByPrefix(summaryText, 'Scope:');
  const capacity = extractLineByPrefix(summaryText, 'Capacity:');
  const next = extractLineByPrefix(summaryText, 'Next:');
  const roleMode = readRoleMode();
  const topAction = deriveTopAction(summaryText, primaryAction) || roleActionHint(roleMode);
  const normalized = normalizeContradictions({
    header,
    health: health.replace(/^Health:\s*/i, ''),
    risks: risks.replace(/^Risks:\s*/i, ''),
    scope: scope.replace(/^Scope:\s*/i, ''),
    capacity: capacity.replace(/^Capacity:\s*/i, ''),
    next: next.replace(/^Next:\s*/i, ''),
    topAction,
    boardName: asText(modelMeta.boardName || ''),
    sprintName: asText(modelMeta.sprintName || ''),
    generatedAt: new Date().toISOString(),
    roleMode,
    roleLabel: roleLabel(roleMode),
    simpleEnglishMode: readSimpleEnglishMode(),
    coachingLevel: readCoachingLevel(),
  });
  normalized.evidenceBand = deriveEvidenceBand(normalized);
  return normalized;
}

export function persistCurrentSprintSummaryContext(context) {
  const payload = context && typeof context === 'object' ? context : {};
  try {
    window.__deliveraCurrentSprintSummaryContext = payload;
  } catch (_) {}
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SUMMARY_CONTEXT_KEY, JSON.stringify(payload));
    }
  } catch (_) {}
}

export function getCurrentSprintSummaryContext() {
  try {
    if (window.__deliveraCurrentSprintSummaryContext) return window.__deliveraCurrentSprintSummaryContext;
  } catch (_) {}
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(SUMMARY_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

export function buildGuidedNudgeText(opts = {}) {
  return buildHumanNudgeDraft({
    issueKey: opts.issueKey,
    issueSummary: opts.issueSummary,
    issueStatus: opts.issueStatus,
    useCase: 'ownership',
    staleHours: opts.staleHours ?? null,
  });
}

export { shortenIssueSummaryHuman as shortenIssueSummary };

export function buildBasicNudgeText(opts = {}) {
  return buildHumanNudgeDraft({
    issueKey: opts.issueKey,
    issueSummary: opts.issueSummary,
    issueStatus: opts.issueStatus,
    useCase: 'ownership',
  });
}

export function showSprintActionToast(message, tone = 'info') {
  const text = asText(message);
  if (!text) return;
  const host = document.querySelector('.current-sprint-header-bar')
    || document.getElementById('current-sprint-content')
    || document.body;
  if (!host) return;
  const toast = document.createElement('div');
  toast.className = 'header-action-toast';
  toast.setAttribute('data-toast-tone', tone);
  toast.setAttribute('role', 'status');
  toast.textContent = text;
  host.appendChild(toast);
  window.setTimeout(() => {
    try { toast.remove(); } catch (_) {}
  }, tone === 'error' ? 5200 : 4200);
}

export function getCurrentSprintPayload() {
  try {
    return window.__deliveraCurrentSprintPayload || null;
  } catch (_) {
    return null;
  }
}

export function deriveUseCaseFromRiskTags(riskTags = []) {
  const tags = Array.isArray(riskTags) ? riskTags : String(riskTags || '').split(/\s+/).filter(Boolean);
  if (tags.includes('blocker')) return 'blocker';
  if (tags.includes('no-log')) return 'no-log';
  if (tags.includes('missing-estimate')) return 'missing-estimate';
  if (tags.includes('unassigned')) return 'unassigned';
  if (tags.includes('scope')) return 'scope';
  return 'ownership';
}
