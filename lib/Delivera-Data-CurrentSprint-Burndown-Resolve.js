/**
 * Current-sprint burndown and sprint resolution helpers.
 * SSOT for ideal burndown, resolve sprint from list, recent sprints, sprint summary. Used by lib/currentSprint.js.
 */

import { classifyIssueTypeForSplit } from './Jira-Reporting-App-Data-IssueType-Classification.js';

/**
 * @param {Array<{ date: string, remainingSP: number }>} remainingWorkByDay
 * @returns {Array<{ date: string, remainingSP: number }>}
 */
export function computeIdealBurndown(remainingWorkByDay) {
  if (!remainingWorkByDay || remainingWorkByDay.length === 0) return [];
  const totalSP = remainingWorkByDay[0].remainingSP || 0;
  const days = remainingWorkByDay.length;
  if (days === 1) {
    return [{ date: remainingWorkByDay[0].date, remainingSP: totalSP }];
  }
  return remainingWorkByDay.map((row, index) => {
    const pct = index / (days - 1);
    const remaining = Math.max(0, Math.round((totalSP - totalSP * pct) * 100) / 100);
    return { date: row.date, remainingSP: remaining };
  });
}

/**
 * @param {Array} sprints
 * @param {{ sprintId?: number, useRecentClosedIfNoActive?: boolean, recentClosedWithinDays?: number }} options
 * @returns {Object | null}
 */
export function resolveSprintFromList(sprints, options) {
  const sprintId = options?.sprintId != null ? Number(options.sprintId) : null;
  const useRecentClosedIfNoActive = options?.useRecentClosedIfNoActive ?? true;
  const recentClosedWithinDays = options?.recentClosedWithinDays ?? 14;
  const now = Date.now();

  let sprint = null;
  if (sprintId != null && !Number.isNaN(sprintId)) {
    sprint = sprints.find(s => Number(s.id) === sprintId) || null;
  }

  if (!sprint) {
    const active = [...sprints]
      .filter(s => (s.state || '').toLowerCase() === 'active')
      .sort((a, b) => {
        const aTime = new Date(a.startDate || a.endDate || 0).getTime();
        const bTime = new Date(b.startDate || b.endDate || 0).getTime();
        return bTime - aTime;
      })[0];
    sprint = active || null;
  }

  if (!sprint && useRecentClosedIfNoActive) {
    const cutoff = now - recentClosedWithinDays * 24 * 60 * 60 * 1000;
    const closed = sprints.filter(s => (s.state || '').toLowerCase() === 'closed');
    const recent = closed
      .filter(s => s.endDate && new Date(s.endDate).getTime() >= cutoff)
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
    sprint = recent[0] || null;
  }

  return sprint;
}

/**
 * @param {Array} sprints
 * @param {Object | null} currentSprint
 * @param {number} maxItems
 * @returns {Array<{ id, name, state, startDate, endDate }>}
 */
export function resolveRecentSprints(sprints, currentSprint, maxItems = 6) {
  if (!Array.isArray(sprints)) return [];
  const normalized = new Map();
  const currentState = currentSprint?.state ? String(currentSprint.state).toLowerCase() : '';
  const current = currentSprint ? { ...currentSprint, state: currentState || currentSprint.state } : null;
  if (current) normalized.set(current.id, current);

  for (const sprint of sprints) {
    if (!sprint || sprint.id == null) continue;
    const state = (sprint.state || '').toLowerCase();
    if (state !== 'active' && state !== 'closed') continue;
    if (!normalized.has(sprint.id)) {
      normalized.set(sprint.id, { ...sprint, state });
    }
  }

  const sorted = [...normalized.values()]
    .sort((a, b) => {
      const aTime = new Date(a.endDate || a.startDate || 0).getTime();
      const bTime = new Date(b.endDate || b.startDate || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, maxItems);

  return sorted.map(s => ({
    id: s.id,
    name: s.name || '',
    state: s.state || '',
    startDate: s.startDate || '',
    endDate: s.endDate || '',
  }));
}

/**
 * @param {Array} sprints
 * @param {Object | null} currentSprint
 * @returns {Object | null} { id, name, goal, startDate, endDate }
 */
export function resolveNextSprint(sprints, currentSprint) {
  if (!currentSprint || !Array.isArray(sprints)) return null;
  const currentEnd = currentSprint.endDate ? new Date(currentSprint.endDate).getTime() : null;
  const future = sprints.filter(s => {
    const state = (s.state || '').toLowerCase();
    if (state === 'future') return true;
    if (!currentEnd || !s.startDate) return false;
    return new Date(s.startDate).getTime() > currentEnd;
  });
  if (future.length === 0) return null;
  future.sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
  const next = future[0];
  return {
    id: next.id,
    name: next.name || '',
    goal: next.goal || '',
    startDate: next.startDate || '',
    endDate: next.endDate || '',
  };
}

/**
 * @param {Array} stories - From computeStoriesList
 * @param {Array} allIssues - Raw Jira issues
 * @param {string|null} storyPointsFieldId
 */
export function computeSprintSummary(stories, allIssues, storyPointsFieldId) {
  const spField = storyPointsFieldId || '';
  const totalStories = stories.length;
  const doneStories = stories.filter(s => s.completionPct === 100).length;
  const totalSP = stories.reduce((sum, s) => sum + (parseFloat(s.storyPoints) || 0), 0);
  const doneSP = stories.reduce((sum, s) => sum + (s.completionPct === 100 ? (parseFloat(s.storyPoints) || 0) : 0), 0);
  const percentDone = totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : (totalStories > 0 ? Math.round((doneStories / totalStories) * 100) : 0);

  let newFeaturesSP = 0;
  let supportOpsSP = 0;
  let totalAllSP = 0;
  for (const issue of allIssues) {
    const sp = spField ? (parseFloat(issue.fields?.[spField]) || 0) : 0;
    totalAllSP += sp;
    const bucket = classifyIssueTypeForSplit(issue);
    if (bucket === 'feature') newFeaturesSP += sp;
    else supportOpsSP += sp;
  }

  return {
    totalStories,
    doneStories,
    totalSP,
    doneSP,
    percentDone,
    newFeaturesSP,
    supportOpsSP,
    totalAllSP,
  };
}
