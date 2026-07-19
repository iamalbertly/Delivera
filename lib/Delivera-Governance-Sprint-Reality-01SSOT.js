const DAY_MS = 24 * 60 * 60 * 1000;

function clean(value, max = 240) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function daysBetween(from, to = new Date()) {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.floor((end - start) / DAY_MS)) : 0;
}

/** Canonical sprint truth consumed by both Current Sprint and Governance. */
export function projectSquadSprintTruth(input = {}, { now = new Date() } = {}) {
  if (input?.sprintReality?.contractVersion === 1) return input.sprintReality;
  const sprint = input.sprint || input.activeSprint || input.sprintPulse?.activeSprint || null;
  const meta = input.meta || {};
  const pulse = input.sprintPulse || {};
  const checkedBoards = input.checkedBoards || meta.checkedBoards || [];
  const partial = Boolean(input.partial || meta.partial || checkedBoards.some?.((board) => board?.verified === false));
  const jiraState = clean(sprint?.state || input.sprintState || pulse.state, 40).toLowerCase();
  const startDate = sprint?.startDate || input.sprintStartDate || pulse.startDate || '';
  const endDate = sprint?.endDate || input.sprintEndDate || pulse.endDate || '';
  const endedByDate = endDate && new Date(endDate).getTime() < new Date(now).getTime();
  const noSuccessor = Boolean(meta.noActiveSprintFallback || input.endedWithoutReplacement || pulse.endedWithoutReplacement);
  let state = 'unverified';
  if (partial) state = 'partial';
  else if (sprint && jiraState === 'active' && endedByDate) state = 'active-dates-expired';
  else if (sprint && jiraState === 'active') state = 'active';
  else if (meta.suggestStartSprint || input.plannedNotStarted) state = 'planned-not-started';
  else if (noSuccessor) state = 'ended-no-successor';
  else if (sprint && ['closed', 'complete', 'completed'].includes(jiraState)) state = 'closed';

  const ageDays = Number(input.sprintAgeDays || pulse.sprintAgeDays || pulse.daysElapsed) || daysBetween(startDate, now);
  const daysRemaining = endDate ? Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(now).getTime()) / DAY_MS)) : null;
  const unmoved = Math.max(0, Number(input.stalledCount || pulse.stalled || pulse.staleCount) || 0);
  const carryoverCount = Math.max(0, Number(input.carryoverCount || pulse.carryover) || 0);
  const carryoverRecurrence = Math.max(0, Number(input.carryoverRecurrence || pulse.carryoverRecurrence) || 0);
  const reopened = Math.max(0, Number(input.reopenedCount || pulse.reopened) || 0);
  const completedAfterEnd = Math.max(0, Number(input.completedAfterSprintEnd || pulse.completedAfterEnd) || 0);
  const name = clean(sprint?.name || input.sprintName || pulse.name, 160);
  const facts = [];
  if (state === 'active') facts.push(`${name || 'Sprint'} is active${daysRemaining != null ? `, ${daysRemaining} days remaining` : ageDays ? `, started ${ageDays} days ago` : ''}.`);
  if (state === 'active-dates-expired') facts.push(`${name || 'Sprint'} is active in Jira, but its dates have expired.`);
  if (state === 'ended-no-successor') facts.push('Sprint ended and no active replacement sprint was detected.');
  if (state === 'planned-not-started') facts.push(`${name || 'Next sprint'} is planned but not started.`);
  if (state === 'closed') facts.push(`${name || 'Sprint'} is closed.`);
  if (state === 'partial') facts.push('Sprint evidence is partial across the mapped boards.');
  if (state === 'unverified') facts.push('No active sprint could be verified after checking mapped boards.');
  if (unmoved) facts.push(`${unmoved} PI-linked item${unmoved === 1 ? ' has' : 's have'} not moved.`);
  if (carryoverCount) facts.push(`${carryoverCount} item${carryoverCount === 1 ? '' : 's'} carried over${carryoverRecurrence ? ` across ${carryoverRecurrence} sprints` : ''}.`);
  if (completedAfterEnd) facts.push(`${completedAfterEnd} finished after sprint end.`);
  if (reopened) facts.push(`${reopened} reopened after Done.`);
  return {
    contractVersion: 1,
    state,
    sprintId: sprint?.id || input.sprintId || null,
    sprintName: name,
    startDate,
    endDate,
    ageDays,
    daysRemaining,
    unmoved,
    carryoverCount,
    carryoverRecurrence,
    reopened,
    completedAfterEnd,
    checkedBoards,
    evidenceAt: meta.generatedAt || meta.cachedAt || input.evidenceAt || new Date(now).toISOString(),
    copy: facts.join(' '),
  };
}
