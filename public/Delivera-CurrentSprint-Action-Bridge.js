const SUMMARY_CONTEXT_KEY = 'delivera.currentSprint.summaryContext.v1';
const NUDGE_RATE_LIMIT_PREFIX = 'delivera.currentSprint.nudgeRateLimit.v1.';

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

export function buildGuidedNudgeText({
  issueKey = '',
  issueSummary = '',
  issueStatus = '',
  issueUrl = '',
  summaryContext = null,
} = {}) {
  const key = asText(issueKey);
  const summary = asText(issueSummary) || 'Please review';
  const status = asText(issueStatus) || 'status unknown';
  const url = asText(issueUrl);
  const context = summaryContext && typeof summaryContext === 'object' ? summaryContext : null;
  const roleMode = asText(context?.roleMode || '').toLowerCase() || readRoleMode();
  const roleName = roleLabel(roleMode);
  const contextHeader = context?.header ? `Sprint context: ${truncate(context.header, 240)}` : '';
  const contextHealth = context?.health ? `Health signal: ${truncate(context.health, 220)}` : '';
  const contextRisk = context?.risks ? `Risk signal: ${truncate(context.risks, 220)}` : '';
  const contextScope = context?.scope ? `Scope signal: ${truncate(context.scope, 200)}` : '';
  const contextCapacity = context?.capacity ? `Capacity signal: ${truncate(context.capacity, 200)}` : '';
  const action = context?.topAction ? `Recommended action now: ${truncate(context.topAction, 220)}` : `Recommended action now: ${roleActionHint(roleMode)}`;
  const evidenceBand = asText(context?.evidenceBand || '');
  const confidence = evidenceBand === 'actionable'
    ? 'Confidence: High'
    : (evidenceBand === 'snapshot'
      ? 'Confidence: Low (historical snapshot)'
      : (evidenceBand === 'low' ? 'Confidence: Low (early evidence)' : 'Confidence: Medium'));
  const opening = key
    ? `[System guided nudge][${roleName}] ${key}: ${summary} (${status}).`
    : `[System guided nudge][${roleName}] ${summary} (${status}).`;
  const suppress = shouldSuppressNudge(key, context?.topAction || action);
  const antiSpamNote = suppress ? 'Duplicate nudge suppressed recently; send only if ownership changed.' : '';
  return [
    opening,
    contextHeader,
    contextHealth,
    contextRisk,
    contextScope,
    contextCapacity,
    confidence,
    action,
    'Done criteria: set owner + set next unblock step + update Jira state/time so trend can be validated after action.',
    antiSpamNote,
    url,
  ].filter(Boolean).join(' ');
}
