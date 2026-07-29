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

function firstNameFrom(value) {
  const raw = asText(value).replace(/^@/, '');
  if (!raw) return '';
  const token = raw.split(/\s+/)[0];
  return token.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
}

function stalledLabelList(stalledSubtasks = []) {
  return (Array.isArray(stalledSubtasks) ? stalledSubtasks : [])
    .map((row) => {
      if (typeof row === 'string') return asText(row);
      const key = asText(row?.issueKey || row?.key);
      const summary = asText(row?.summary).slice(0, 40);
      if (key && summary) return `${key} (${summary})`;
      return key || summary;
    })
    .filter(Boolean)
    .slice(0, 3);
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
  'done-probe': (key) => `can ${key} be moved to Done?`,
};

/**
 * @param {object} opts
 * @param {string} [opts.issueKey]
 * @param {string} [opts.issueSummary]
 * @param {string} [opts.issueStatus]
 * @param {string} [opts.useCase]
 * @param {number} [opts.staleHours]
 * @param {string} [opts.assigneeFirstName]
 * @param {Array<{issueKey?:string,summary?:string}|string>} [opts.stalledSubtasks]
 */
export function buildHumanNudgeDraft({
  issueKey = '',
  issueSummary = '',
  issueStatus = '',
  useCase = '',
  staleHours = null,
  tone = 'supportive',
  intervention = null,
  assigneeFirstName = '',
  stalledSubtasks = null,
} = {}) {
  const key = asText(issueKey);
  const summary = shortenIssueSummary(issueSummary);
  const status = asText(issueStatus);
  const normalizedUseCase = asText(useCase).toLowerCase() || 'ownership';
  const stale = formatStaleLabel(staleHours);
  const effectiveTone = ['supportive', 'information-only', 'urgent'].includes(asText(tone).toLowerCase())
    ? asText(tone).toLowerCase() : 'supportive';
  const evidenceAsk = asText(intervention?.recommendedAction || intervention?.nextAction);
  const value = asText(intervention?.humanImpact?.statement || intervention?.businessImpact);
  const fromIntervention = Array.isArray(intervention?.swarmPlan?.stalledSubtasks)
    ? intervention.swarmPlan.stalledSubtasks
    : (Array.isArray(intervention?.doneProbe?.stalledSubtasks) ? intervention.doneProbe.stalledSubtasks : []);
  const stalled = stalledLabelList(stalledSubtasks != null ? stalledSubtasks : fromIntervention);
  const mention = firstNameFrom(
    assigneeFirstName
    || intervention?.doneProbe?.assigneeFirstName
    || intervention?.assigneeFirstName
    || '',
  );
  const preferDoneProbe = normalizedUseCase === 'done-probe'
    || Boolean(intervention?.doneProbe?.prefer)
    || (stalled.length > 0 && (normalizedUseCase === 'blocker' || intervention?.interventionType === 'done-probe'));

  if (preferDoneProbe && key && stalled.length) {
    const hey = mention ? `Hey @${mention} — ` : '';
    const stalledBit = stalled.join(', ');
    return truncate(`${hey}can ${key} be moved to Done? I can see ${stalledBit} still stalled.`, HUMAN_NUDGE_MAX);
  }
  // Thin evidence: never invent @mentions for Done-probe.
  if (preferDoneProbe && key && !stalled.length) {
    const builder = USE_CASE_LINES.blocker;
    return truncate(builder(key, stale), HUMAN_NUDGE_MAX);
  }

  const builder = USE_CASE_LINES[normalizedUseCase] || USE_CASE_LINES.ownership;
  let line = key ? builder(key, stale) : `Please review: ${summary}.`;
  if (evidenceAsk) {
    const lead = effectiveTone === 'urgent' ? 'Time-sensitive facilitation needed'
      : effectiveTone === 'information-only' ? 'For team visibility'
        : 'Could the squad help restore flow';
    line = `${lead}: ${key}. ${value ? `${value} ` : ''}${evidenceAsk}`;
  }
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
  assigneeFirstName = '',
  stalledSubtasks = null,
} = {}) {
  return buildHumanNudgeDraft({
    useCase,
    issueKey,
    issueSummary,
    issueStatus,
    staleHours,
    assigneeFirstName,
    stalledSubtasks,
  });
}
