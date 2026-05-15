/**
 * SSOT: factual sprint phase labels (calendar-aware, not "just started" mid-sprint).
 */

function asNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function deriveSprintPhase(data) {
  const summary = data?.summary || {};
  const days = data?.daysMeta || {};
  const meta = data?.meta || {};
  const sprint = data?.sprint || {};
  const pctDone = asNum(summary.percentDone, 0);
  const totalStories = asNum(summary.totalStories, 0);
  const daysElapsed = asNum(days.daysElapsedWorking ?? days.daysElapsedCalendar, 0);
  const daysRemaining = asNum(days.daysRemainingWorking ?? days.daysRemainingCalendar, null);
  const isHistorical = String(sprint.state || '').toLowerCase() !== 'active' || Boolean(meta.fromSnapshot);
  const stuck = Array.isArray(data?.stuckCandidates) ? data.stuckCandidates : [];
  const hasRiskEvidence = stuck.length > 0
    || asNum(summary.subtaskMissingEstimate, 0) > 0
    || asNum(summary.subtaskMissingLogged, 0) > 0;

  if (isHistorical) {
    return { phase: 'historical', label: 'Historical snapshot', justStarting: false, hasRiskEvidence };
  }
  if (totalStories <= 0) {
    return { phase: 'empty', label: 'No stories in sprint', justStarting: false, hasRiskEvidence: false };
  }
  const calendarEarly = daysElapsed < 2 && pctDone === 0 && !hasRiskEvidence;
  const justStarting = calendarEarly;
  if (justStarting) {
    return {
      phase: 'forming',
      label: 'Early sprint · forming signals',
      justStarting: true,
      hasRiskEvidence,
      daysRemaining,
    };
  }
  if (hasRiskEvidence && pctDone === 0 && daysElapsed >= 2) {
    return {
      phase: 'in_progress_risk',
      label: 'In progress · risks need owners',
      justStarting: false,
      hasRiskEvidence: true,
      daysRemaining,
    };
  }
  if (pctDone >= 80) {
    return { phase: 'closing', label: 'Sprint closing', justStarting: false, hasRiskEvidence, daysRemaining };
  }
  return {
    phase: 'in_progress',
    label: pctDone > 0 ? `In progress · ${pctDone}% done` : 'In progress',
    justStarting: false,
    hasRiskEvidence,
    daysRemaining,
  };
}

export function buildHealthLineForPhase(phaseInfo, data) {
  const summary = data?.summary || {};
  const pctDone = asNum(summary.percentDone, 0);
  const doneStories = asNum(summary.doneStories, 0);
  const totalStories = asNum(summary.totalStories, 0);
  const remaining = phaseInfo?.daysRemaining;
  const nextCheck = remaining != null && remaining > 0 ? ` (next check in ${remaining}d)` : '';

  if (phaseInfo?.phase === 'forming') {
    const remaining = phaseInfo?.daysRemaining;
    const timeBit = remaining != null && remaining > 0
      ? ` · ${remaining} working day${remaining === 1 ? '' : 's'} left`
      : '';
    if (phaseInfo.hasRiskEvidence) {
      return `Early risk while signals form${timeBit}${nextCheck}.`;
    }
    return `Sprint started · no risks flagged yet${timeBit}${nextCheck}.`;
  }
  if (phaseInfo?.phase === 'in_progress_risk') {
    const stuck = Array.isArray(data?.stuckCandidates) ? data.stuckCandidates : [];
    const top = [...stuck].sort((a, b) => Number(b?.hoursInStatus || 0) - Number(a?.hoursInStatus || 0))[0];
    if (top?.issueKey) {
      const hrs = Math.round(Number(top.hoursInStatus || 0));
      const who = top.assignee ? ` (${top.assignee})` : ' (unassigned)';
      return `${pctDone}% done · top blocker ${top.issueKey} stuck ${hrs}h${who} — assign owner and unblock today.`;
    }
    return `Work started · ${pctDone}% done · ${stuck.length || 'several'} risks need owners today.`;
  }
  if (phaseInfo?.phase === 'historical') {
    return `${pctDone}% done · ${doneStories}/${totalStories} stories (snapshot).`;
  }
  return `${pctDone}% done · ${doneStories}/${totalStories} stories${nextCheck}.`;
}
