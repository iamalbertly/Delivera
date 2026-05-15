/**
 * SSOT: one user-facing vocabulary for sprint risk counts (avoid "blockers" x20 on the page).
 * Internal risk tags stay `blocker` for filters; labels use "stale in progress" etc.
 */

export function staleInProgressLabel(count) {
  const n = Number(count || 0);
  if (n <= 0) return '';
  return `${n} stale in progress`;
}

export function missingEstimateLabel(count) {
  const n = Number(count || 0);
  if (n <= 0) return '';
  return `${n} missing est`;
}

export function missingLogLabel(count) {
  const n = Number(count || 0);
  if (n <= 0) return '';
  return `${n} no log`;
}

export function unownedOutcomeLabel(count) {
  const n = Number(count || 0);
  if (n <= 0) return '';
  return `${n} unowned`;
}

/** Single rollup line for chips, drawer, intervention queue. */
export function formatRiskCountsRollup({
  stale = 0,
  missingEst = 0,
  missingLog = 0,
  unowned = 0,
} = {}) {
  return [
    staleInProgressLabel(stale),
    missingEstimateLabel(missingEst),
    missingLogLabel(missingLog),
    unownedOutcomeLabel(unowned),
  ].filter(Boolean).join(' · ');
}

export function formatEvidenceSummary({
  stale = 0,
  missingEst = 0,
  missingLog = 0,
  unowned = 0,
  supportPct = null,
  remainingDays = null,
  verdictHealthy = false,
} = {}) {
  const rollup = formatRiskCountsRollup({ stale, missingEst, missingLog, unowned });
  if (rollup) {
    return supportPct != null && supportPct > 0 ? `${rollup} · ${supportPct}% support` : rollup;
  }
  if (verdictHealthy) {
    return remainingDays > 0
      ? `No material sprint risks. Next check-in in ${Math.floor(remainingDays)}d.`
      : 'No material sprint risks in this snapshot.';
  }
  return '';
}

export function unblockActionLabel(issueKey) {
  const key = String(issueKey || '').trim();
  return key ? `Unblock ${key}` : 'Take action';
}
