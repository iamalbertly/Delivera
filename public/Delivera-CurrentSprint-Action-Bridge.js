const SUMMARY_CONTEXT_KEY = 'delivera.currentSprint.summaryContext.v1';

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
  const topAction = deriveTopAction(summaryText, primaryAction);
  return {
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
  };
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
  const contextHeader = context?.header ? `Sprint context: ${truncate(context.header, 240)}` : '';
  const contextHealth = context?.health ? `Health signal: ${truncate(context.health, 220)}` : '';
  const contextRisk = context?.risks ? `Risk signal: ${truncate(context.risks, 220)}` : '';
  const action = context?.topAction ? `Recommended action now: ${truncate(context.topAction, 220)}` : '';
  const opening = key
    ? `[System nudge] ${key}: ${summary} (${status}).`
    : `[System nudge] ${summary} (${status}).`;
  return [
    opening,
    contextHeader,
    contextHealth,
    contextRisk,
    action,
    'Please update Jira status/time today and confirm the immediate unblock step so KPI trend can be validated after action.',
    url,
  ].filter(Boolean).join(' ');
}
