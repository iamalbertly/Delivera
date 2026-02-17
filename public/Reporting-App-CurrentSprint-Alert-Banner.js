/**
 * Current sprint verdict SSOT.
 * Legacy verdict/alert banner rendering was removed in favor of a single
 * header command center summary.
 */

function getRiskCounts(data) {
  const summary = data?.summary || {};
  return {
    stuckCount: Number((data?.stuckCandidates || []).length || 0),
    missingEstimate: Number(summary.subtaskMissingEstimate || 0),
    missingLogged: Number(summary.subtaskMissingLogged || 0),
    totalStories: Number(summary.totalStories || (data?.stories || []).length || 0),
    doneStories: Number(summary.doneStories || 0),
  };
}

/**
 * Sprint Health is an operational signal:
 * Healthy -> Caution -> At Risk -> Critical.
 */
export function deriveSprintVerdict(data) {
  const counts = getRiskCounts(data);
  const donePct = counts.totalStories > 0
    ? Math.round((counts.doneStories / counts.totalStories) * 100)
    : 0;

  const riskScore =
    (counts.stuckCount * 3)
    + (counts.missingEstimate * 2)
    + counts.missingLogged
    + (donePct < 45 && counts.totalStories > 0 ? 3 : 0);

  let verdict = 'Healthy';
  let color = 'green';
  if (riskScore >= 14) {
    verdict = 'Critical';
    color = 'red';
  } else if (riskScore >= 8) {
    verdict = 'At Risk';
    color = 'orange';
  } else if (riskScore >= 3) {
    verdict = 'Caution';
    color = 'yellow';
  }

  let detail = donePct + '% done';
  if (counts.stuckCount > 0) detail += ' · ' + counts.stuckCount + ' blockers';
  if (counts.missingEstimate > 0) detail += ' · ' + counts.missingEstimate + ' missing estimates';
  if (counts.missingLogged > 0) detail += ' · ' + counts.missingLogged + ' no log';

  return {
    verdict,
    color,
    detail,
    stuckCount: counts.stuckCount,
    missingEstimate: counts.missingEstimate,
    missingLogged: counts.missingLogged,
  };
}
