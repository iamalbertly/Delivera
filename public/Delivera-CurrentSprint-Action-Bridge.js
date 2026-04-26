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
  return 'assist';
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

function shortenIssueSummary(summaryText) {
  const summary = asText(summaryText);
  if (!summary) return 'Please review this issue';
  const agileTemplatePattern = /^as a .*? i should be able to\s*/i;
  const stripped = summary.replace(agileTemplatePattern, '');
  const compact = stripped
    .replace(/\s+/g, ' ')
    .replace(/\s*\(to do\)\s*/ig, ' ')
    .trim();
  return truncate(compact || summary, 140);
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

export function buildGuidedNudgeText({
  issueKey = '',
  issueSummary = '',
  issueStatus = '',
  issueUrl = '',
  summaryContext = null,
} = {}) {
  const key = asText(issueKey);
  const summary = shortenIssueSummary(issueSummary);
  const status = asText(issueStatus) || 'status unknown';
  const url = asText(issueUrl);
  const context = summaryContext && typeof summaryContext === 'object' ? summaryContext : null;
  const roleMode = asText(context?.roleMode || '').toLowerCase() || readRoleMode();
  const roleName = roleLabel(roleMode);
  const simpleEnglishMode = context?.simpleEnglishMode !== false;
  const coachingLevel = asText(context?.coachingLevel || '').toLowerCase() || 'assist';
  const contextHeader = context?.header ? simplifyLine(`Sprint context: ${truncate(context.header, 240)}`, simpleEnglishMode) : '';
  const contextHealth = context?.health ? simplifyLine(`Health signal: ${truncate(context.health, 220)}`, simpleEnglishMode) : '';
  const contextRisk = context?.risks ? simplifyLine(`Risk signal: ${truncate(context.risks, 220)}`, simpleEnglishMode) : '';
  const contextScope = context?.scope ? simplifyLine(`Scope signal: ${truncate(context.scope, 200)}`, simpleEnglishMode) : '';
  const contextCapacity = context?.capacity ? simplifyLine(`Capacity signal: ${truncate(context.capacity, 200)}`, simpleEnglishMode) : '';
  const action = context?.topAction
    ? simplifyLine(`Recommended action now: ${truncate(context.topAction, 220)}`, simpleEnglishMode)
    : simplifyLine(`Recommended action now: ${roleActionHint(roleMode)}`, simpleEnglishMode);
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
  const doneCriteriaDetailed = simpleEnglishMode
    ? 'Done: set owner + add next unblock step + update Jira state/time + check trend after action.'
    : 'Done criteria: set owner + set next unblock step + update Jira state/time so trend can be validated after action.';
  const doneCriteriaConcise = 'Done: owner set, next step set, Jira updated.';
  const doneCriteria = coachingLevel === 'concise' ? doneCriteriaConcise : doneCriteriaDetailed;
  const bodyParts = [
    opening,
    confidence,
    action,
    coachingLevel === 'guide' ? contextHeader : '',
    coachingLevel !== 'concise' ? contextHealth : '',
    coachingLevel !== 'concise' ? contextRisk : '',
    coachingLevel === 'guide' ? contextScope : '',
    coachingLevel === 'guide' ? contextCapacity : '',
    doneCriteria,
    antiSpamNote,
    url,
  ];
  return bodyParts.filter(Boolean).join(' ');
}

export function buildBasicNudgeText({
  issueKey = '',
  issueSummary = '',
  issueStatus = '',
  issueUrl = '',
  summaryContext = null,
} = {}) {
  const key = asText(issueKey);
  const summary = shortenIssueSummary(issueSummary);
  const status = asText(issueStatus) || 'status unknown';
  const context = summaryContext && typeof summaryContext === 'object' ? summaryContext : {};
  const roleName = roleLabel(asText(context.roleMode || '').toLowerCase() || readRoleMode());
  const simpleEnglishMode = context.simpleEnglishMode !== false;
  const action = context?.topAction
    ? truncate(context.topAction, 120)
    : roleActionHint(asText(context.roleMode || '').toLowerCase() || readRoleMode());
  const actionLine = simpleEnglishMode
    ? `Do now: ${action}.`
    : `Action now: ${action}.`;
  const opening = key
    ? `[System basic nudge][${roleName}] ${key}: ${summary} (${status}).`
    : `[System basic nudge][${roleName}] ${summary} (${status}).`;
  return [opening, actionLine, asText(issueUrl)].filter(Boolean).join(' ');
}
