/**
 * Shared risk/outcome semantics used across Report, Current Sprint, and Leadership HUD.
 * Pure helpers only (safe for browser + server imports).
 */

const NON_FLOW_STATUSES = new Set(['to do', 'open', 'backlog', 'done']);

function normalizeText(value) {
  return String(value || '').trim();
}

export function normalizeIssueKey(value) {
  return normalizeText(value).toUpperCase();
}

export function normalizePerson(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower === '-' || lower === 'unassigned' || lower === 'none' || lower === 'n/a') return '';
  return raw;
}

export function isUnassignedOwnerValue(value) {
  return !normalizePerson(value);
}

export function parseIssueLabels(input) {
  if (Array.isArray(input)) {
    return input.map((v) => normalizeText(v)).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(/[;,]+/)
      .map((v) => normalizeText(v))
      .filter(Boolean);
  }
  return [];
}

export function hasOutcomeLabel(input) {
  const labels = parseIssueLabels(input).map((l) => l.toLowerCase());
  return labels.includes('outcomestory');
}

export function isOutcomeStoryLike({ labels, epicKey } = {}) {
  if (hasOutcomeLabel(labels)) return true;
  return Boolean(normalizeText(epicKey));
}

export function normalizeIssueStatus(status) {
  return normalizeText(status).toLowerCase();
}

export function isFlowStatus(status) {
  const s = normalizeIssueStatus(status);
  return Boolean(s) && !NON_FLOW_STATUSES.has(s);
}

export function hasOwnershipSignals({ assignee, reporter, subtaskAssignees } = {}) {
  if (normalizePerson(assignee)) return true;
  if (Array.isArray(subtaskAssignees) && subtaskAssignees.some((p) => normalizePerson(p))) return true;
  if (normalizePerson(reporter)) return true;
  return false;
}

export function isOwnedBlockerCandidate({
  riskTags,
  status,
  owner,
  hoursInStatus,
  minAgeHours = 24,
} = {}) {
  const tags = Array.isArray(riskTags)
    ? riskTags.map((t) => normalizeText(t).toLowerCase()).filter(Boolean)
    : [];
  const hasBlockerTag = tags.includes('blocker');
  if (!hasBlockerTag) return false;
  if (!normalizePerson(owner)) return false;
  if (!isFlowStatus(status)) return false;
  const age = Number(hoursInStatus || 0);
  return age >= minAgeHours;
}

export function deriveOutcomeRiskFromPreviewRows(rows) {
  const allRows = Array.isArray(rows) ? rows : [];
  const blockersOwnedKeys = new Set();
  const unownedOutcomeKeys = new Set();

  for (const row of allRows) {
    const key = normalizeIssueKey(row?.issueKey);
    if (!key) continue;
    const labels = parseIssueLabels(row?.issueLabels);
    const status = normalizeIssueStatus(row?.issueStatus);
    const hasOwner = hasOwnershipSignals({
      assignee: row?.assigneeDisplayName,
      reporter: row?.reporterDisplayName,
      subtaskAssignees: [],
    });
    const looksOutcome = isOutcomeStoryLike({ labels, epicKey: row?.epicKey });
    if (looksOutcome && !hasOwner) {
      unownedOutcomeKeys.add(key);
    }
    const labelsLower = labels.map((l) => l.toLowerCase());
    const hasBlockerTag = labelsLower.includes('blocker');
    if (hasBlockerTag && hasOwner && isFlowStatus(status)) {
      blockersOwnedKeys.add(key);
    }
  }

  return {
    blockersOwned: blockersOwnedKeys.size,
    unownedOutcomes: unownedOutcomeKeys.size,
  };
}

/** Progress bar tone for sprint signal cards: success at ≥80%, warning below 40%. */
export function deriveDeliveryProgressTone(percent) {
  const n = Number(percent);
  if (Number.isNaN(n)) return '';
  if (n >= 80) return ' is-success';
  if (n < 40) return ' is-warning';
  return '';
}

/**
 * Spillover bar tone — the INVERSE of delivery progress.
 * Spillover measures how much work is STILL open, so high = bad.
 * 0% spillover → success (green, everything delivered).
 * >0% spillover → warning/critical (never green).
 *
 * This closes the audit trust gap "100% spillover with green bar":
 * deriveDeliveryProgressTone() was being reused for spillover, so a 100%
 * spillover value (>=80) returned is-success (green) — a contradictory
 * visual that told the user everything was fine when nothing was delivered.
 */
export function deriveSpilloverTone(percent) {
  const n = Number(percent);
  if (Number.isNaN(n)) return '';
  if (n <= 0) return ' is-success';      // nothing spilled — genuinely good
  if (n >= 50) return ' is-critical';     // majority of sprint still open
  if (n > 0) return ' is-warning';        // some spillover — needs attention
  return '';
}
