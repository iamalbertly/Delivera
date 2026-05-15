/**
 * SSOT: plain-language Jira comment drafts (never posted with system/role stacking).
 */

const HUMAN_NUDGE_MAX = 280;

function asText(value) {
  return String(value == null ? '' : value).trim();
}

function truncate(text, max = HUMAN_NUDGE_MAX) {
  const value = asText(text);
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function shortenIssueSummary(summaryText) {
  const summary = asText(summaryText);
  if (!summary) return 'this work item';
  const stripped = summary
    .replace(/^as a .*? i should be able to\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\(to do\)\s*/ig, ' ')
    .trim();
  return truncate(stripped || summary, 100);
}

function formatStaleLabel(staleHours) {
  const h = Number(staleHours);
  if (!Number.isFinite(h) || h <= 0) return '';
  if (h < 24) return `${Math.round(h)}h with no update`;
  const days = Math.round(h / 24);
  return `${days} day${days === 1 ? '' : 's'} with no update`;
}

const USE_CASE_LINES = {
  blocker: (key, stale) => {
    const staleBit = stale ? ` (${stale})` : '';
    return `${key} looks blocked${staleBit}. Who owns the next step today?`;
  },
  'no-log': (key) => `${key} is in progress but has no time logged. Please log work or fix the estimate.`,
  'missing-estimate': (key) => `${key} needs an estimate so we can plan capacity. Please add one or split the work.`,
  unassigned: (key) => `${key} has no owner. Please assign someone and note the next step.`,
  scope: (key) => `${key} was added mid-sprint. Please confirm with PO: keep, split, or defer.`,
  ownership: (key) => `${key} needs a clear owner and next step before stand-up.`,
};

/**
 * @param {object} opts
 * @param {string} [opts.issueKey]
 * @param {string} [opts.issueSummary]
 * @param {string} [opts.issueStatus]
 * @param {string} [opts.useCase]
 * @param {number} [opts.staleHours]
 */
export function buildHumanNudgeDraft({
  issueKey = '',
  issueSummary = '',
  issueStatus = '',
  useCase = '',
  staleHours = null,
} = {}) {
  const key = asText(issueKey);
  const summary = shortenIssueSummary(issueSummary);
  const status = asText(issueStatus);
  const normalizedUseCase = asText(useCase).toLowerCase() || 'ownership';
  const stale = formatStaleLabel(staleHours);
  const builder = USE_CASE_LINES[normalizedUseCase] || USE_CASE_LINES.ownership;
  let line = key ? builder(key, stale) : `Please review: ${summary}.`;
  if (key && summary && summary !== 'this work item' && line.length < 200) {
    line = `${line} (${summary}${status ? ` · ${status}` : ''})`;
  }
  return truncate(line, HUMAN_NUDGE_MAX);
}

/** @deprecated Use buildHumanNudgeDraft — kept for imports that still call buildCommentForUseCase. */
export function buildCommentForUseCase({
  useCase = '',
  issueKey = '',
  issueSummary = '',
  issueStatus = '',
  staleHours = null,
} = {}) {
  return buildHumanNudgeDraft({ useCase, issueKey, issueSummary, issueStatus, staleHours });
}
