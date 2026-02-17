/**
 * Current-sprint transparency: active sprint resolution, observed work window,
 * daily completion histogram, scope-change list, and flags.
 * Used by GET /api/current-sprint.json (snapshot-first when Phase 3 is active).
 * SIZE-EXEMPT: Payload-building compute helpers (observed window, days meta, daily completions,
 * stories list, subtask tracking, remaining work by day, scope changes) are tightly coupled to
 * buildCurrentSprintPayload; splitting further would scatter orchestration and increase coordination bugs.
 */

import { fetchSprintsForBoard } from './sprints.js';
import { fetchSprintIssuesForTransparency } from './issues.js';
import { calculateWorkDays } from './kpiCalculations.js';
import { logger } from './Jira-Reporting-App-Server-Logging-Utility.js';
import { readCurrentSprintNotes, getCurrentSprintNotes } from './Jira-Reporting-App-Data-CurrentSprint-Notes-IO.js';
import { isStoryIssue, isWorkItemIssue, isSubtaskIssue } from './Jira-Reporting-App-Data-IssueType-Classification.js';
import {
  computeIdealBurndown,
  resolveSprintFromList,
  resolveRecentSprints,
  computeSprintSummary,
  resolveNextSprint,
} from './Jira-Reporting-App-Data-CurrentSprint-Burndown-Resolve.js';
import { resolveJiraHostFromEnv } from './server-utils.js';

/** Default assumption set for v1 (completion anchor = resolution date) */
const DEFAULT_ASSUMPTIONS = [
  'Completion anchored to: resolution date.',
  'Observed window from story created/resolution only.',
  'Scope added = created after sprint start (no changelog in v1).',
  'Burndown assumes linear scope; scope changes shown separately.',
];

/**
 * Normalize ISO timestamp to date-only string (YYYY-MM-DD) for grouping
 * @param {string} iso
 * @returns {string}
 */
function toDateOnly(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function toHoursFromSeconds(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return 0;
  return Math.round((seconds / 3600) * 10) / 10;
}

function extractTimeTrackingSeconds(issue) {
  const fields = issue?.fields || {};
  const tracking = fields.timetracking || {};
  const original = tracking.originalEstimateSeconds ?? fields.timeoriginalestimate ?? null;
  const spent = tracking.timeSpentSeconds ?? fields.timespent ?? null;
  const remaining = tracking.remainingEstimateSeconds ?? fields.timeestimate ?? null;
  return {
    original: original != null ? Number(original) : null,
    spent: spent != null ? Number(spent) : null,
    remaining: remaining != null ? Number(remaining) : null,
  };
}

function buildIssueUrl(issueKey) {
  const host = resolveJiraHostFromEnv();
  if (!host || !issueKey) return '';
  return `${host}/browse/${issueKey}`;
}

/**
 * Compute observed work window from issues (created + resolutionDate only in v1)
 * @param {Array} issues - Raw Jira issue objects
 * @param {string} sprintStartDate - ISO
 * @param {string} sprintEndDate - ISO
 * @returns {{ start: string | null, end: string | null }}
 */
function computeObservedWorkWindow(issues, sprintStartDate, sprintEndDate) {
  let observedStart = null;
  let observedEnd = null;
  const startTime = sprintStartDate ? new Date(sprintStartDate).getTime() : null;
  const endTime = sprintEndDate ? new Date(sprintEndDate).getTime() : null;

  for (const issue of issues) {
    const created = issue.fields?.created;
    const resolution = issue.fields?.resolutiondate;
    if (created) {
      const t = new Date(created).getTime();
      const minVal = resolution ? Math.min(t, new Date(resolution).getTime()) : t;
      if (observedStart === null || minVal < observedStart) observedStart = minVal;
    }
    if (resolution) {
      const t = new Date(resolution).getTime();
      if (observedEnd === null || t > observedEnd) observedEnd = t;
    }
  }

  return {
    start: observedStart != null ? new Date(observedStart).toISOString() : null,
    end: observedEnd != null ? new Date(observedEnd).toISOString() : null,
  };
}

/**
 * Compute flags: observed before/after sprint dates; sprint dates changed (v1: false)
 */
function computeFlags(observedWindow, plannedStart, plannedEnd) {
  const obsStart = observedWindow.start ? new Date(observedWindow.start).getTime() : null;
  const obsEnd = observedWindow.end ? new Date(observedWindow.end).getTime() : null;
  const planStart = plannedStart ? new Date(plannedStart).getTime() : null;
  const planEnd = plannedEnd ? new Date(plannedEnd).getTime() : null;

  return {
    observedBeforeSprintStart: planStart != null && obsStart != null && obsStart < planStart,
    observedAfterSprintEnd: planEnd != null && obsEnd != null && obsEnd > planEnd,
    sprintDatesChanged: false, // v1: best-effort deferred
  };
}

/**
 * Compute calendar days and working days for sprint; days elapsed/remaining from now
 */
function computeDaysMeta(sprint, now = new Date()) {
  const start = sprint.startDate ? new Date(sprint.startDate) : null;
  const end = sprint.endDate ? new Date(sprint.endDate) : null;
  if (!start || !end) {
    return {
      calendarDays: null,
      workingDays: null,
      daysElapsedCalendar: null,
      daysRemainingCalendar: null,
      daysElapsedWorking: null,
      daysRemainingWorking: null,
    };
  }

  const calendarDays = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
  const workingDays = calculateWorkDays(sprint.startDate, sprint.endDate);
  const workingDaysNum = typeof workingDays === 'number' ? workingDays : null;

  const nowTime = now.getTime();
  const startTime = start.getTime();
  const endTime = end.getTime();

  let daysElapsedCalendar = null;
  let daysRemainingCalendar = null;
  let daysElapsedWorking = null;
  let daysRemainingWorking = null;

  if (nowTime >= startTime && nowTime <= endTime) {
    daysElapsedCalendar = Math.ceil((nowTime - startTime) / (24 * 60 * 60 * 1000));
    daysRemainingCalendar = Math.ceil((endTime - nowTime) / (24 * 60 * 60 * 1000));
    const elapsedStart = new Date(startTime);
    const elapsedEnd = new Date(nowTime);
    const remainingStart = new Date(nowTime);
    const remainingEnd = new Date(endTime);
    daysElapsedWorking = typeof workingDaysNum === 'number' ? calculateWorkDays(elapsedStart, elapsedEnd) : null;
    daysRemainingWorking = typeof workingDaysNum === 'number' ? calculateWorkDays(remainingStart, remainingEnd) : null;
  } else if (nowTime > endTime) {
    daysElapsedCalendar = calendarDays;
    daysRemainingCalendar = 0;
    daysElapsedWorking = typeof workingDaysNum === 'number' ? workingDaysNum : null;
    daysRemainingWorking = 0;
  }

  return {
    calendarDays,
    workingDays: workingDaysNum,
    daysElapsedCalendar,
    daysRemainingCalendar,
    daysElapsedWorking,
    daysRemainingWorking,
  };
}

/**
 * Daily completion histogram: stories completed per day (resolutionDate). Subtasks v1: empty (proxy deferred).
 * @param {Array} issues - Raw Jira issues
 * @param {string|null} storyPointsFieldId
 * @returns {{ stories: Array<{ date: string, count: number, spCompleted: number, nps: null }>, subtasks: Array<{ date: string, count: number }> }}
 */
function computeDailyCompletions(issues, storyPointsFieldId) {
  const storyCountByDate = new Map();
  const storySpByDate = new Map();
  const spField = storyPointsFieldId || '';
  for (const issue of issues) {
    if (!isWorkItemIssue(issue)) continue;
    const res = issue.fields?.resolutiondate;
    if (!res) continue;
    const date = toDateOnly(res);
    if (!date) continue;
    storyCountByDate.set(date, (storyCountByDate.get(date) || 0) + 1);
    const sp = spField ? (parseFloat(issue.fields?.[spField]) || 0) : 0;
    storySpByDate.set(date, (storySpByDate.get(date) || 0) + sp);
  }
  const stories = [...storyCountByDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({
      date,
      count,
      spCompleted: storySpByDate.get(date) || 0,
      nps: null,
    }));
  return { stories, subtasks: [] };
}

function computeStoriesList(issues, storyPointsFieldId) {
  const spField = storyPointsFieldId || '';
  const subtaskHoursByParent = new Map();
  const subtasksByParent = new Map();
  for (const issue of issues) {
    if (!isSubtaskIssue(issue)) continue;
    const parentKey = issue.fields?.parent?.key || '';
    if (!parentKey) continue;
    const tracking = extractTimeTrackingSeconds(issue);
    const estHrs = toHoursFromSeconds(tracking.original || 0);
    const logHrs = toHoursFromSeconds(tracking.spent || 0);
    const entry = subtaskHoursByParent.get(parentKey) || { estimateHours: 0, loggedHours: 0 };
    entry.estimateHours += estHrs;
    entry.loggedHours += logHrs;
    subtaskHoursByParent.set(parentKey, entry);
    // Collect subtask details for hierarchical rendering
    const children = subtasksByParent.get(parentKey) || [];
    children.push({
      issueKey: issue.key || '',
      summary: (issue.fields?.summary || '').slice(0, 120),
      status: issue.fields?.status?.name || '',
      issueType: issue.fields?.issuetype?.name || '',
      assignee: issue.fields?.assignee?.displayName || issue.fields?.reporter?.displayName || '',
      estimateHours: estHrs,
      loggedHours: logHrs,
      remainingHours: toHoursFromSeconds(tracking.remaining || 0),
      issueUrl: buildIssueUrl(issue.key || ''),
    });
    subtasksByParent.set(parentKey, children);
  }
  const stories = [];
  for (const issue of issues) {
    if (!isWorkItemIssue(issue)) continue;
    const sp = spField ? (parseFloat(issue.fields?.[spField]) || 0) : 0;
    const isDone = issue.fields?.status?.statusCategory?.key === 'done';
    const storyTracking = extractTimeTrackingSeconds(issue);
    const subtaskTotals = subtaskHoursByParent.get(issue.key || '') || { estimateHours: 0, loggedHours: 0 };
    const subtasks = subtasksByParent.get(issue.key || '') || [];
    stories.push({
      issueKey: issue.key || '',
      summary: (issue.fields?.summary || '').slice(0, 120),
      storyPoints: sp,
      completionPct: isDone ? 100 : 0,
      status: issue.fields?.status?.name || '',
      issueType: issue.fields?.issuetype?.name || '',
      reporter: issue.fields?.reporter?.displayName || '',
      assignee: issue.fields?.assignee?.displayName || '',
      created: issue.fields?.created || '',
      resolved: issue.fields?.resolutiondate || '',
      estimateHours: toHoursFromSeconds(storyTracking.original || 0),
      loggedHours: toHoursFromSeconds(storyTracking.spent || 0),
      subtaskEstimateHours: Math.round((subtaskTotals.estimateHours || 0) * 10) / 10,
      subtaskLoggedHours: Math.round((subtaskTotals.loggedHours || 0) * 10) / 10,
      subtasks,
      issueUrl: buildIssueUrl(issue.key || ''),
    });
  }
  stories.sort((a, b) => a.issueKey.localeCompare(b.issueKey));
  return stories;
}

function computeSubtaskTracking(issues) {
  const subtasks = [];
  let totalEstimateHours = 0;
  let totalLoggedHours = 0;
  let missingEstimate = 0;
  let missingLogged = 0;
  let stuckOver24hCount = 0;
  const stuckOver24h = [];
  const byAssignee = new Map();
  const byReporter = new Map();
  const now = Date.now();
  const stuckThresholdHours = 24;

  function pickStatusChangedAt(issue) {
    return issue.fields?.statuscategorychangedate || issue.fields?.updated || issue.fields?.created || null;
  }

  function hoursSince(iso) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    return Math.round(((now - t) / (1000 * 60 * 60)) * 10) / 10;
  }

  function ensureGroup(map, name) {
    if (!map.has(name)) {
      map.set(name, { recipient: name, missingEstimate: [], missingLogged: [] });
    }
    return map.get(name);
  }

  for (const issue of issues) {
    if (!isSubtaskIssue(issue)) continue;
    const tracking = extractTimeTrackingSeconds(issue);
    const estimateHours = toHoursFromSeconds(tracking.original || 0);
    const loggedHours = toHoursFromSeconds(tracking.spent || 0);
    const remainingHours = toHoursFromSeconds(tracking.remaining || 0);
    totalEstimateHours += estimateHours;
    totalLoggedHours += loggedHours;

    const assignee = issue.fields?.assignee?.displayName || 'Unassigned';
    const reporter = issue.fields?.reporter?.displayName || 'Unassigned';
    const parentKey = issue.fields?.parent?.key || '';
    const parentSummary = issue.fields?.parent?.fields?.summary || '';
    const created = issue.fields?.created || '';
    const updated = issue.fields?.updated || '';
    const status = issue.fields?.status?.name || '';
    const statusCategoryKey = issue.fields?.status?.statusCategory?.key || '';
    const statusChangedAt = pickStatusChangedAt(issue);
    const hoursInStatus = hoursSince(statusChangedAt);
    const issueUrl = buildIssueUrl(issue.key || '');
    const parentUrl = parentKey ? buildIssueUrl(parentKey) : '';

    if (estimateHours === 0) missingEstimate += 1;
    if (estimateHours > 0 && loggedHours === 0) missingLogged += 1;

    const row = {
      issueKey: issue.key || '',
      summary: (issue.fields?.summary || '').slice(0, 140),
      assignee,
      reporter,
      status,
      statusCategoryKey,
      statusChangedAt,
      hoursInStatus,
      estimateHours,
      loggedHours,
      remainingHours,
      created,
      updated,
      parentKey,
      parentSummary,
      issueUrl,
      parentUrl,
    };
    subtasks.push(row);

    if (statusCategoryKey !== 'done' && hoursInStatus != null && hoursInStatus >= stuckThresholdHours) {
      stuckOver24hCount += 1;
      stuckOver24h.push(row);
    }

    const assigneeGroup = ensureGroup(byAssignee, assignee);
    const reporterGroup = ensureGroup(byReporter, reporter);
    if (estimateHours === 0) {
      assigneeGroup.missingEstimate.push(row);
      reporterGroup.missingEstimate.push(row);
    } else if (loggedHours === 0) {
      assigneeGroup.missingLogged.push(row);
      reporterGroup.missingLogged.push(row);
    }
  }

  return {
    summary: {
      totalEstimateHours: Math.round(totalEstimateHours * 10) / 10,
      totalLoggedHours: Math.round(totalLoggedHours * 10) / 10,
      missingEstimate,
      missingLogged,
      stuckOver24hCount,
    },
    subtasks,
    stuckOver24h,
    notifications: [...byAssignee.entries()].map(([name, groups]) => ({
      recipient: name,
      missingEstimate: groups.missingEstimate,
      missingLogged: groups.missingLogged,
    })),
    notificationsByReporter: [...byReporter.entries()].map(([name, groups]) => ({
      recipient: name,
      missingEstimate: groups.missingEstimate,
      missingLogged: groups.missingLogged,
    })),
  };
}

/**
 * Burndown context: remaining SP by day (initial total SP minus cumulative completed by that day).
 * @param {Array} issues - Raw Jira issues
 * @param {string} sprintStartDate - ISO
 * @param {string} sprintEndDate - ISO
 * @param {string|null} storyPointsFieldId - Custom field ID for story points
 * @returns {Array<{ date: string, remainingSP: number }>}
 */
function computeRemainingWorkByDay(issues, sprintStartDate, sprintEndDate, storyPointsFieldId) {
  if (!sprintStartDate || !sprintEndDate) return [];
  const start = new Date(sprintStartDate);
  const end = new Date(sprintEndDate);
  const spField = storyPointsFieldId || '';

  let totalSP = 0;
  const spResolvedByDate = new Map();
  for (const issue of issues) {
    const sp = spField ? (parseFloat(issue.fields?.[spField]) || 0) : 0;
    totalSP += sp;
    const res = issue.fields?.resolutiondate;
    if (!res) continue;
    const date = toDateOnly(res);
    if (!date) continue;
    spResolvedByDate.set(date, (spResolvedByDate.get(date) || 0) + sp);
  }

  const result = [];
  const current = new Date(start);
  let cumulative = 0;
  while (current <= end) {
    const dateStr = toDateOnly(current.toISOString());
    const daySP = spResolvedByDate.get(dateStr) || 0;
    cumulative += daySP;
    result.push({ date: dateStr, remainingSP: Math.max(0, totalSP - cumulative) });
    current.setDate(current.getDate() + 1);
  }
  return result;
}

/**
 * Scope-change markers (v1 heuristic): issues with created > sprintStartDate. Classify by issueType.
 * @param {Array} issues - Raw Jira issues
 * @param {string} sprintStartDate - ISO
 * @param {string|null} storyPointsFieldId
 * @returns {{ scopeChanges: Array, scopeChangeSummary: Object }}
 */
function computeScopeChanges(issues, sprintStartDate, storyPointsFieldId) {
  const sprintStartTime = sprintStartDate ? new Date(sprintStartDate).getTime() : null;
  const spField = storyPointsFieldId || '';
  const scopeChanges = [];
  const summary = { bug: 0, feature: 0, support: 0 };

  for (const issue of issues) {
    const created = issue.fields?.created;
    if (!created || sprintStartTime == null) continue;
    if (new Date(created).getTime() <= sprintStartTime) continue;

    const issueType = (issue.fields?.issuetype?.name || '').toLowerCase();
    let classification = 'support';
    if (issueType.includes('bug')) classification = 'bug';
    else if (issueType.includes('story') || issueType.includes('feature')) classification = 'feature';
    summary[classification] = (summary[classification] || 0) + 1;

    const sp = spField ? (parseFloat(issue.fields?.[spField]) || 0) : 0;
    scopeChanges.push({
      date: created,
      issueKey: issue.key || '',
      summary: (issue.fields?.summary || '').trim().slice(0, 200),
      status: issue.fields?.status?.name || '',
      issueType: issue.fields?.issuetype?.name || 'Unknown',
      storyPoints: sp,
      classification,
      reporter: issue.fields?.reporter?.displayName || '',
      assignee: issue.fields?.assignee?.displayName || '',
      issueUrl: buildIssueUrl(issue.key || ''),
    });
  }

  scopeChanges.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return { scopeChanges, scopeChangeSummary: summary };
}

/**
 * Build full current-sprint transparency payload for one board.
 * @param {Object} params
 * @param {Object} params.board - { id, name, location?: { projectKey } }
 * @param {string[]} params.projectKeys - Project keys to filter issues (e.g. [board.location.projectKey])
 * @param {Object} params.agileClient - Jira Agile client
 * @param {Object} params.fields - { storyPointsFieldId, epicLinkFieldId, ... }
 * @param {Object} params.options - { useRecentClosedIfNoActive?: boolean, recentClosedWithinDays?: number, completionAnchor?: string }
 * @returns {Promise<Object>} - Payload for GET /api/current-sprint.json
 */
export async function buildCurrentSprintPayload({ board, projectKeys, agileClient, fields, options = {} }) {
  const { useRecentClosedIfNoActive = true, recentClosedWithinDays = 14, completionAnchor = 'resolution' } = options;
  const jiraHostResolved = resolveJiraHostFromEnv();
  // v1: only resolution is implemented; lastSubtask and statusDone require subtask/status history

  const boardId = board.id;
  const sprints = await fetchSprintsForBoard(boardId, agileClient);
  const sprint = resolveSprintFromList(sprints, {
    sprintId: options?.sprintId,
    useRecentClosedIfNoActive,
    recentClosedWithinDays,
  });

  if (!sprint) {
    return {
      board: { id: board.id, name: board.name, projectKeys: projectKeys || [] },
      sprint: null,
      plannedWindow: null,
      observedWorkWindow: null,
      flags: null,
      daysMeta: null,
      dailyCompletions: { stories: [], subtasks: [] },
      remainingWorkByDay: [],
      scopeChanges: [],
      scopeChangeSummary: {},
      stuckCandidates: [],
      previousSprint: null,
      recentSprints: [],
      nextSprint: null,
      stories: [],
      summary: null,
      idealBurndown: [],
      notes: { dependencies: [], learnings: [], updatedAt: null },
      assumptions: DEFAULT_ASSUMPTIONS,
      meta: { fromSnapshot: false, snapshotAt: null, jiraHost: jiraHostResolved, jiraHostResolved },
    };
  }

  const issues = await fetchSprintIssuesForTransparency(
    sprint.id,
    agileClient,
    projectKeys || [board.location?.projectKey].filter(Boolean),
    ['Story', 'User Story', 'Bug', 'Task', 'Sub-task', 'Subtask'],
    fields
  );

  const plannedWindow = {
    start: sprint.startDate || null,
    end: sprint.endDate || null,
  };

  const observedWorkWindow = computeObservedWorkWindow(issues, sprint.startDate, sprint.endDate);
  const flags = computeFlags(observedWorkWindow, sprint.startDate, sprint.endDate);
  const daysMeta = computeDaysMeta(sprint);

  const calendarDays = daysMeta.calendarDays;
  const workingDays = daysMeta.workingDays;

  const assumptions = [...DEFAULT_ASSUMPTIONS];
  assumptions.push('Task movement (subtasks): not computed in v1; use stories only.');
  assumptions.push('Completion anchor: Resolution date (last subtask / status Done coming later).');

  const dailyCompletions = computeDailyCompletions(issues, fields?.storyPointsFieldId || null);
  const remainingWorkByDay = computeRemainingWorkByDay(
    issues,
    sprint.startDate,
    sprint.endDate,
    fields?.storyPointsFieldId || null
  );
  const idealBurndown = computeIdealBurndown(remainingWorkByDay);
  const { scopeChanges, scopeChangeSummary } = computeScopeChanges(
    issues,
    sprint.startDate,
    fields?.storyPointsFieldId || null
  );

  const subtaskTracking = computeSubtaskTracking(issues);
  const stories = computeStoriesList(issues, fields?.storyPointsFieldId || null);
  const summary = computeSprintSummary(stories, issues, fields?.storyPointsFieldId || null);
  summary.subtaskEstimatedHours = subtaskTracking.summary.totalEstimateHours;
  summary.subtaskLoggedHours = subtaskTracking.summary.totalLoggedHours;
  summary.subtaskMissingEstimate = subtaskTracking.summary.missingEstimate;
  summary.subtaskMissingLogged = subtaskTracking.summary.missingLogged;
  summary.subtaskStuckOver24h = subtaskTracking.summary.stuckOver24hCount;

  const stuckThreshold = Date.now() - 24 * 60 * 60 * 1000;
  const stuckCandidates = issues
    .filter((issue) => issue.fields?.status?.statusCategory?.key !== 'done')
    .filter((issue) => {
      const lastChange = issue.fields?.statuscategorychangedate || issue.fields?.updated;
      if (!lastChange) return false;
      return new Date(lastChange).getTime() < stuckThreshold;
    })
    .map((issue) => ({
      issueKey: issue.key || '',
      summary: (issue.fields?.summary || '').slice(0, 80),
      status: issue.fields?.status?.name || '',
      assignee: issue.fields?.assignee?.displayName || '',
      reporter: issue.fields?.reporter?.displayName || '',
      updated: issue.fields?.statuscategorychangedate || issue.fields?.updated || '',
      issueUrl: buildIssueUrl(issue.key || ''),
    }));

  let previousSprint = null;
  try {
    const closed = sprints
      .filter(s => (s.state || '').toLowerCase() === 'closed')
      .sort((a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime());
    const currentEnd = sprint.endDate ? new Date(sprint.endDate).getTime() : null;
    const prior = (sprint.state || '').toLowerCase() === 'active'
      ? closed[0]
      : closed.find(s => s.id !== sprint.id && (!currentEnd || new Date(s.endDate || 0).getTime() < currentEnd));
    if (prior && prior.id !== sprint.id) {
      const prevIssues = await fetchSprintIssuesForTransparency(
        prior.id,
        agileClient,
        projectKeys || [board.location?.projectKey].filter(Boolean),
        ['Story', 'User Story', 'Bug', 'Task', 'Sub-task', 'Subtask'],
        fields
      );
      const spField = fields?.storyPointsFieldId || '';
      let doneSP = 0;
      let doneStories = 0;
      for (const issue of prevIssues) {
        if (!isStoryIssue(issue)) continue;
        if (issue.fields?.status?.statusCategory?.key !== 'done') continue;
        doneStories += 1;
        doneSP += spField ? (parseFloat(issue.fields?.[spField]) || 0) : 0;
      }
      previousSprint = {
        name: prior.name || '',
        id: prior.id,
        doneSP,
        doneStories,
      };
    }
  } catch (err) {
    logger.warn('Previous sprint comparison skipped', { boardId, error: err?.message });
  }

  let notes = { dependencies: [], learnings: [], updatedAt: null };
  try {
    const notesData = await readCurrentSprintNotes();
    notes = getCurrentSprintNotes(notesData, boardId, sprint.id);
  } catch (err) {
    logger.warn('Current sprint notes unavailable', { boardId, error: err?.message });
  }

  const payload = {
    board: { id: board.id, name: board.name, projectKeys: projectKeys || [] },
    sprint: {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state || '',
      startDate: sprint.startDate || '',
      endDate: sprint.endDate || '',
      calendarDays,
      workingDays,
    },
    summary,
    plannedWindow,
    observedWorkWindow: observedWorkWindow.start || observedWorkWindow.end ? observedWorkWindow : null,
    flags,
    daysMeta,
    dailyCompletions,
    remainingWorkByDay,
    idealBurndown,
    scopeChanges,
    scopeChangeSummary,
    subtaskTracking,
    stuckCandidates,
    previousSprint,
    recentSprints: resolveRecentSprints(sprints, sprint),
    nextSprint: resolveNextSprint(sprints, sprint),
    stories,
    notes,
    assumptions,
    meta: { fromSnapshot: false, snapshotAt: null, jiraHost: jiraHostResolved, jiraHostResolved },
  };

  return payload;
}
