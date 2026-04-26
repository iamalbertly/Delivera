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
import { logger } from './Delivera-Server-Logging-Utility.js';
import { readCurrentSprintNotes, getCurrentSprintNotes } from './Delivera-Data-CurrentSprint-Notes-IO.js';
import { classifyIssueTypeForSplit, getDefaultPeerWorkItemTypes, isWorkItemIssue, isSubtaskIssue } from './Delivera-Data-IssueType-Classification.js';
import {
  computeIdealBurndown,
  resolveSprintFromList,
  resolveRecentSprints,
  computeSprintSummary,
  resolveNextSprint,
} from './Delivera-Data-CurrentSprint-Burndown-Resolve.js';
import { resolveJiraHostFromEnv } from './server-utils.js';
import { buildJiraIssueUrl } from './Delivera-Server-Url-And-Escape-Helpers.js';

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

function computeHoursSinceIso(iso, nowMs = Date.now()) {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.round(((nowMs - ts) / (1000 * 60 * 60)) * 10) / 10;
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
  return buildJiraIssueUrl(resolveJiraHostFromEnv(), issueKey);
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

function computeStoriesList(issues, storyPointsFieldId, epicLinkFieldId) {
  const spField = storyPointsFieldId || '';
  const epicField = epicLinkFieldId || '';
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
      parentIssueKey: parentKey,
      summary: (issue.fields?.summary || '').slice(0, 120),
      status: issue.fields?.status?.name || '',
      issueType: issue.fields?.issuetype?.name || '',
      assignee: issue.fields?.assignee?.displayName || issue.fields?.reporter?.displayName || '',
      estimateHours: estHrs,
      loggedHours: logHrs,
      remainingHours: toHoursFromSeconds(tracking.remaining || 0),
      issueUrl: buildIssueUrl(issue.key || ''),
    });
    children.sort((a, b) => String(a.issueKey || '').localeCompare(String(b.issueKey || '')));
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
    const rawEpicLink = epicField ? issue.fields?.[epicField] : '';
    const epicKey = typeof rawEpicLink === 'string'
      ? rawEpicLink
      : (rawEpicLink?.key || '');
    stories.push({
      issueKey: issue.key || '',
      summary: (issue.fields?.summary || '').slice(0, 120),
      storyPoints: sp,
      labels: Array.isArray(issue.fields?.labels) ? issue.fields.labels : [],
      epicKey,
      isOutcomeStory: Array.isArray(issue.fields?.labels) && issue.fields.labels.some((l) => String(l || '').toLowerCase() === 'outcomestory'),
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
    const hoursInStatus = computeHoursSinceIso(statusChangedAt, now);
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

    const classification = classifyIssueTypeForSplit(issue);
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

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clampNumber(value, min = 0, max = Number.POSITIVE_INFINITY) {
  return Math.min(max, Math.max(min, safeNumber(value)));
}

function roundOne(value) {
  return Math.round(safeNumber(value) * 10) / 10;
}

function isStoryDone(story) {
  return safeNumber(story?.completionPct, 0) >= 100 || String(story?.status || '').toLowerCase() === 'done';
}

function getCurrentBurndownIndex(remainingWorkByDay) {
  if (!Array.isArray(remainingWorkByDay) || !remainingWorkByDay.length) return -1;
  const todayKey = toDateOnly(new Date().toISOString());
  let currentIndex = remainingWorkByDay.length - 1;
  remainingWorkByDay.forEach((row, index) => {
    const rowKey = toDateOnly(row?.date || '');
    if (rowKey && rowKey <= todayKey) currentIndex = index;
  });
  return currentIndex;
}

function buildSparklineFromSeries(series, limit = 6) {
  const normalized = Array.isArray(series)
    ? series.map((value) => roundOne(value)).filter((value) => Number.isFinite(value))
    : [];
  return normalized.slice(Math.max(0, normalized.length - limit));
}

function buildDecisionCockpit({
  sprint,
  summary,
  stories,
  stuckCandidates,
  scopeChanges,
  dailyCompletions,
  remainingWorkByDay,
  idealBurndown,
  daysMeta,
  previousSprint,
  recentSubtaskMovementRows,
  meta,
}) {
  const totalSP = clampNumber(summary?.totalSP, 0);
  const doneSP = clampNumber(summary?.doneSP, 0, totalSP || Number.POSITIVE_INFINITY);
  const totalStories = clampNumber(summary?.totalStories, 0);
  const doneStories = clampNumber(summary?.doneStories, 0, totalStories || Number.POSITIVE_INFINITY);
  const percentDone = clampNumber(summary?.percentDone, 0, 100);
  const subtaskEstimateHours = roundOne(summary?.subtaskEstimatedHours);
  const subtaskLoggedHours = roundOne(summary?.subtaskLoggedHours);
  const missingEstimate = clampNumber(summary?.subtaskMissingEstimate, 0);
  const missingLogged = clampNumber(summary?.subtaskMissingLogged, 0);
  const daysRemaining = daysMeta?.daysRemainingWorking ?? daysMeta?.daysRemainingCalendar ?? null;
  const activeStories = Array.isArray(stories) ? stories.filter((story) => !isStoryDone(story)) : [];
  const recentStoryCompletions = Array.isArray(dailyCompletions?.stories) ? dailyCompletions.stories : [];
  const latestCompletion = recentStoryCompletions.length ? recentStoryCompletions[recentStoryCompletions.length - 1] : null;
  const completedRecent = clampNumber(latestCompletion?.count, 0);
  const completedRecentSp = roundOne(latestCompletion?.spCompleted || 0);
  const scopeAddedSp = roundOne((Array.isArray(scopeChanges) ? scopeChanges : []).reduce((sum, row) => sum + safeNumber(row?.storyPoints, 0), 0));
  const scopeDeltaPct = totalSP > 0 ? Math.round((scopeAddedSp / totalSP) * 100) : 0;
  const inactivity = !recentSubtaskMovementRows?.length && completedRecent === 0;
  const partialPermissions = meta?.partialPermissions === true;
  const storyPointTrustWeak = totalSP === 0 || summary?.storyPointsFieldWarning;

  const riskRegistry = new Map();
  function ensureRiskEntry(issueKey, seed = {}) {
    const key = String(issueKey || '').trim().toUpperCase();
    if (!key) return null;
    if (!riskRegistry.has(key)) {
      riskRegistry.set(key, {
        issueKey: key,
        summary: String(seed.summary || '').trim(),
        status: String(seed.status || '').trim(),
        assignee: String(seed.assignee || '').trim(),
        issueUrl: String(seed.issueUrl || '').trim(),
        tags: [],
        riskTags: [],
        score: 0,
        reason: '',
      });
    }
    return riskRegistry.get(key);
  }

  function addRisk(entry, {
    tag,
    riskTag,
    score = 0,
    reason = '',
  }) {
    if (!entry) return;
    if (tag && !entry.tags.includes(tag)) entry.tags.push(tag);
    if (riskTag && !entry.riskTags.includes(riskTag)) entry.riskTags.push(riskTag);
    entry.score += score;
    if (!entry.reason && reason) entry.reason = reason;
  }

  activeStories.forEach((story) => {
    const entry = ensureRiskEntry(story.issueKey, story);
    if (!entry) return;
    if (!String(story.assignee || '').trim()) {
      addRisk(entry, {
        tag: 'No assignee',
        riskTag: 'unassigned',
        score: 70,
        reason: 'No owner is visible for work still inside the sprint.',
      });
    }
    if (safeNumber(story.storyPoints, 0) <= 0 && safeNumber(story.subtaskEstimateHours, 0) <= 0) {
      addRisk(entry, {
        tag: 'No estimate',
        riskTag: 'missing-estimate',
        score: 58,
        reason: 'Sizing is missing, so predictability is weak.',
      });
    }
    if (safeNumber(story.subtaskEstimateHours, 0) > 0 && safeNumber(story.subtaskLoggedHours, 0) <= 0) {
      addRisk(entry, {
        tag: 'No log',
        riskTag: 'no-log',
        score: 46,
        reason: 'Work has an estimate but no execution evidence yet.',
      });
    }
  });

  (Array.isArray(stuckCandidates) ? stuckCandidates : []).forEach((issue) => {
    const entry = ensureRiskEntry(issue.issueKey, issue);
    if (!entry) return;
    addRisk(entry, {
      tag: 'No movement 24h',
      riskTag: 'blocker',
      score: 92,
      reason: `The item has been stale for ${roundOne(issue.hoursInStatus || 24)}h and is likely blocking sprint flow.`,
    });
  });

  (Array.isArray(scopeChanges) ? scopeChanges : []).forEach((change) => {
    const entry = ensureRiskEntry(change.issueKey, change);
    if (!entry) return;
    addRisk(entry, {
      tag: 'Scope change',
      riskTag: 'scope',
      score: 34,
      reason: 'Scope was added after sprint start and needs explicit trade-off handling.',
    });
  });

  const topRisks = [...riskRegistry.values()]
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || safeNumber(b.storyPoints, 0) - safeNumber(a.storyPoints, 0) || a.issueKey.localeCompare(b.issueKey))
    .slice(0, 3)
    .map((entry) => {
      const severity = entry.score >= 90 ? 'High' : (entry.score >= 60 ? 'Medium' : 'Low');
      return {
        issueKey: entry.issueKey,
        summary: entry.summary || 'Sprint item',
        status: entry.status || 'To Do',
        assignee: entry.assignee || '',
        issueUrl: entry.issueUrl || buildIssueUrl(entry.issueKey),
        severity,
        reason: entry.reason || 'Needs review',
        tags: entry.tags,
        riskTags: entry.riskTags,
      };
    });

  const nextBestActionRisk = topRisks[0] || null;
  const nextBestAction = nextBestActionRisk
    ? {
        issueKey: nextBestActionRisk.issueKey,
        summary: nextBestActionRisk.summary,
        reason: nextBestActionRisk.reason,
        issueUrl: nextBestActionRisk.issueUrl,
        ctaLabel: 'Take Action',
        riskTags: nextBestActionRisk.riskTags,
      }
    : {
        issueKey: '',
        summary: 'No critical Jira issue needs intervention right now.',
        reason: 'Protect the sprint by keeping current work moving and watching for late scope or ownership drift.',
        issueUrl: '',
        ctaLabel: 'Review Work',
        riskTags: [],
      };

  let healthStatus = 'On Track';
  let healthTone = 'positive';
  if (topRisks.some((risk) => risk.severity === 'High') || percentDone < 40) {
    healthStatus = 'Needs Attention';
    healthTone = 'critical';
  } else if (topRisks.some((risk) => risk.severity === 'Medium') || scopeAddedSp > 0 || inactivity) {
    healthStatus = 'Watch Closely';
    healthTone = 'warning';
  }
  if (partialPermissions) {
    healthStatus = 'Limited View';
    healthTone = 'warning';
  }
  const healthMessageParts = [];
  if (partialPermissions) healthMessageParts.push('Some Jira fields are hidden, so the view is conservative.');
  else if (healthTone === 'positive') healthMessageParts.push('Good sprint momentum with no dominant execution risk.');
  else if (healthTone === 'warning') healthMessageParts.push('The sprint is still recoverable, but scope, hygiene, or movement needs explicit follow-up.');
  else healthMessageParts.push('Sprint outcomes are at risk unless the top issue is resolved quickly.');
  if (scopeAddedSp > 0) healthMessageParts.push(`${scopeAddedSp.toFixed(1)} SP was added after sprint start.`);
  if (inactivity) healthMessageParts.push('No recent movement is visible in the last 24h.');

  const currentBurndownIndex = getCurrentBurndownIndex(remainingWorkByDay);
  const actualRemainingToday = currentBurndownIndex >= 0 ? safeNumber(remainingWorkByDay?.[currentBurndownIndex]?.remainingSP, totalSP - doneSP) : totalSP - doneSP;
  const idealRemainingToday = currentBurndownIndex >= 0 ? safeNumber(idealBurndown?.[currentBurndownIndex]?.remainingSP, actualRemainingToday) : actualRemainingToday;
  const actualDoneToday = Math.max(0, totalSP - actualRemainingToday);
  const idealDoneToday = Math.max(0, totalSP - idealRemainingToday);
  const plannedActualVariance = roundOne(actualDoneToday - idealDoneToday);

  const completionSeries = buildSparklineFromSeries(recentStoryCompletions.map((row) => safeNumber(row?.spCompleted, row?.count)));
  const scopeSeries = buildSparklineFromSeries((Array.isArray(scopeChanges) ? scopeChanges : []).map((row) => safeNumber(row?.storyPoints, 0)));
  const varianceSeries = buildSparklineFromSeries((remainingWorkByDay || []).map((row, index) => {
    const actualRemaining = safeNumber(row?.remainingSP, 0);
    const idealRemaining = safeNumber(idealBurndown?.[index]?.remainingSP, actualRemaining);
    return roundOne((totalSP - actualRemaining) - (totalSP - idealRemaining));
  }));

  const completionLastTwo = recentStoryCompletions.slice(-2).reduce((sum, row) => sum + safeNumber(row?.spCompleted, row?.count), 0);
  const completionClusterPct = totalSP > 0 ? Math.round((completionLastTwo / totalSP) * 100) : (totalStories > 0 ? Math.round((completionLastTwo / Math.max(1, totalStories)) * 100) : 0);

  let confidenceValue = 'High';
  let confidenceTone = 'positive';
  if (partialPermissions || storyPointTrustWeak) {
    confidenceValue = 'Medium';
    confidenceTone = 'warning';
  }
  if (topRisks.some((risk) => risk.severity === 'High') || inactivity) {
    confidenceValue = 'Low';
    confidenceTone = 'critical';
  }

  const progressDeltaVsPrior = previousSprint?.doneSP != null
    ? roundOne(doneSP - safeNumber(previousSprint.doneSP, 0))
    : null;

  const workMovementAnnotations = [];
  const scopeByDate = new Map();
  (scopeChanges || []).forEach((row) => {
    const dateKey = toDateOnly(row?.date || '');
    if (!dateKey) return;
    scopeByDate.set(dateKey, roundOne((scopeByDate.get(dateKey) || 0) + safeNumber(row?.storyPoints, 0)));
  });
  scopeByDate.forEach((sp, dateKey) => {
    workMovementAnnotations.push({
      type: 'scope-change',
      date: dateKey,
      label: `Scope change +${sp.toFixed(1)} SP`,
      detail: `${sp.toFixed(1)} SP entered after sprint start.`,
    });
  });
  if (inactivity) {
    workMovementAnnotations.push({
      type: 'inactivity',
      date: toDateOnly(new Date().toISOString()),
      label: 'Inactivity',
      detail: 'No recent sprint movement is visible in the last 24h.',
    });
  }

  const quickActions = [
    {
      id: 'unblock',
      label: 'Unblock issues',
      count: clampNumber(stuckCandidates?.length, 0),
      riskTags: ['blocker'],
    },
    {
      id: 'estimate',
      label: 'Add estimates',
      count: missingEstimate,
      riskTags: ['missing-estimate'],
    },
    {
      id: 'scope',
      label: 'Review scope changes',
      count: clampNumber(scopeChanges?.length, 0),
      riskTags: ['scope'],
    },
    {
      id: 'ownership',
      label: 'Assign owners',
      count: topRisks.filter((risk) => risk.riskTags.includes('unassigned')).length,
      riskTags: ['unassigned'],
    },
  ];

  return {
    health: {
      status: healthStatus,
      tone: healthTone,
      message: healthMessageParts.join(' '),
    },
    nextBestAction,
    keySignals: {
      completedRecent: {
        count: completedRecent,
        storyPoints: completedRecentSp,
      },
      blockers: clampNumber(stuckCandidates?.length, 0),
      scopeChanges: clampNumber(scopeChanges?.length, 0),
      inactivity,
    },
    metrics: {
      progressPct: {
        value: percentDone,
        deltaVsPrior: progressDeltaVsPrior,
      },
      storyPoints: {
        completed: roundOne(doneSP),
        planned: roundOne(totalSP),
        variance: plannedActualVariance,
      },
      workItems: {
        done: doneStories,
        total: totalStories,
        remaining: Math.max(0, totalStories - doneStories),
      },
      timeLogged: {
        logged: subtaskLoggedHours,
        estimated: subtaskEstimateHours,
        ratioPct: subtaskEstimateHours > 0 ? Math.round((subtaskLoggedHours / subtaskEstimateHours) * 100) : 0,
      },
      scopeDelta: {
        storyPoints: scopeAddedSp,
        count: clampNumber(scopeChanges?.length, 0),
        percent: scopeDeltaPct,
      },
      daysRemaining: daysRemaining != null ? Math.max(0, Math.floor(daysRemaining)) : null,
    },
    topRisks,
    quickActions,
    insights: {
      completionClustering: {
        value: completionClusterPct,
        tone: completionClusterPct >= 60 ? 'warning' : 'positive',
        interpretation: completionClusterPct >= 60
          ? `${completionClusterPct}% of completion landed in the last 2 checkpoints. Delivery is bunching late.`
          : 'Completion is spreading more evenly through the sprint.',
        trend: completionSeries,
      },
      scopeImpact: {
        value: scopeAddedSp,
        tone: scopeAddedSp > 0 ? 'warning' : 'positive',
        interpretation: scopeAddedSp > 0
          ? `${scopeAddedSp.toFixed(1)} SP (${scopeDeltaPct}%) was added after sprint start.`
          : 'No material mid-sprint scope increase is visible.',
        trend: scopeSeries.length ? scopeSeries : [0],
      },
      plannedActualVariance: {
        value: plannedActualVariance,
        tone: plannedActualVariance < 0 ? 'critical' : 'positive',
        interpretation: plannedActualVariance < 0
          ? `Behind by ${Math.abs(plannedActualVariance).toFixed(1)} SP against the ideal line.`
          : `Ahead by ${plannedActualVariance.toFixed(1)} SP versus the ideal line.`,
        trend: varianceSeries.length ? varianceSeries : [plannedActualVariance],
      },
      confidence: {
        value: confidenceValue,
        tone: confidenceTone,
        interpretation: partialPermissions
          ? 'Confidence is moderated because some Jira fields are hidden.'
          : (storyPointTrustWeak
            ? 'Confidence is moderated because sizing evidence is incomplete.'
            : 'Confidence is backed by visible movement, sizing, and sprint evidence.'),
        trend: buildSparklineFromSeries([
          confidenceValue === 'High' ? 3 : (confidenceValue === 'Medium' ? 2 : 1),
          partialPermissions ? 2 : 3,
          inactivity ? 1 : 3,
          topRisks.some((risk) => risk.severity === 'High') ? 1 : 3,
          storyPointTrustWeak ? 2 : 3,
        ]),
      },
    },
    workMovementAnnotations,
  };
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
    getDefaultPeerWorkItemTypes(),
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
  const stories = computeStoriesList(issues, fields?.storyPointsFieldId || null, fields?.epicLinkFieldId || null);
  const summary = computeSprintSummary(stories, issues, fields?.storyPointsFieldId || null);
  summary.subtaskEstimatedHours = subtaskTracking.summary.totalEstimateHours;
  summary.subtaskLoggedHours = subtaskTracking.summary.totalLoggedHours;
  summary.subtaskMissingEstimate = subtaskTracking.summary.missingEstimate;
  summary.subtaskMissingLogged = subtaskTracking.summary.missingLogged;
  summary.subtaskStuckOver24h = subtaskTracking.summary.stuckOver24hCount;

  // Post-sprint completion tracking: how many stories completed after sprint end.
  const sprintEndTime = sprint.endDate ? new Date(sprint.endDate).getTime() : null;
  let completedAfterSprintEndCount = 0;
  if (sprintEndTime != null) {
    for (const story of stories) {
      const resolved = story.resolved;
      if (!resolved) continue;
      const resolvedTime = new Date(resolved).getTime();
      if (!Number.isNaN(resolvedTime) && resolvedTime > sprintEndTime) {
        completedAfterSprintEndCount += 1;
      }
    }
  }
  summary.completedAfterSprintEndCount = completedAfterSprintEndCount;

  // Multi-story-points-field hint: if Jira exposes multiple candidate SP fields, surface a gentle warning.
  const spCandidates = Array.isArray(fields?.storyPointsFieldCandidates)
    ? fields.storyPointsFieldCandidates
    : [];
  summary.storyPointsFieldCandidates = spCandidates;
  summary.storyPointsFieldWarning = spCandidates.length > 1;

  const parentKeysInSprint = new Set((subtaskTracking.subtasks || []).map((row) => row.parentKey).filter(Boolean));
  const recentSubtaskMovementRows = (subtaskTracking.subtasks || [])
    .filter((row) => row && row.hoursInStatus != null && row.hoursInStatus < 24);
  const parentsWithRecentSubtaskMovement = new Set(
    recentSubtaskMovementRows.map((row) => row.parentKey).filter(Boolean)
  );
  const stuckThreshold = Date.now() - 24 * 60 * 60 * 1000;
  const excludedParentBlockers = [];
  const stuckCandidates = issues
    .filter((issue) => issue.fields?.status?.statusCategory?.key !== 'done')
    .filter((issue) => {
      const lastChange = issue.fields?.statuscategorychangedate || issue.fields?.updated;
      if (!lastChange) return false;
      const isStuckByAge = new Date(lastChange).getTime() < stuckThreshold;
      if (!isStuckByAge) return false;
      const issueKey = issue.key || '';
      if (issueKey && parentKeysInSprint.has(issueKey) && parentsWithRecentSubtaskMovement.has(issueKey)) {
        excludedParentBlockers.push(issueKey);
        return false;
      }
      return true;
    })
    .map((issue) => ({
      issueKey: issue.key || '',
      summary: (issue.fields?.summary || '').slice(0, 80),
      status: issue.fields?.status?.name || '',
      issueType: issue.fields?.issuetype?.name || '',
      assignee: issue.fields?.assignee?.displayName || '',
      reporter: issue.fields?.reporter?.displayName || '',
      updated: issue.fields?.statuscategorychangedate || issue.fields?.updated || '',
      hoursInStatus: computeHoursSinceIso(issue.fields?.statuscategorychangedate || issue.fields?.updated || ''),
      issueUrl: buildIssueUrl(issue.key || ''),
    }));
  summary.stuckExcludedParentsWithActiveSubtasks = excludedParentBlockers.length;
  summary.recentSubtaskMovementCount = recentSubtaskMovementRows.length;
  summary.parentsWithRecentSubtaskMovement = parentsWithRecentSubtaskMovement.size;

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
        getDefaultPeerWorkItemTypes(),
        fields
      );
      const spField = fields?.storyPointsFieldId || '';
      let doneSP = 0;
      let doneStories = 0;
      for (const issue of prevIssues) {
        if (!isWorkItemIssue(issue)) continue;
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
    stuckExclusions: {
      parentsWithActiveSubtasks: Array.from(new Set(excludedParentBlockers)),
      recentSubtaskMovementCount: recentSubtaskMovementRows.length,
      parentsWithRecentSubtaskMovement: parentsWithRecentSubtaskMovement.size,
    },
    previousSprint,
    recentSprints: resolveRecentSprints(sprints, sprint),
    nextSprint: resolveNextSprint(sprints, sprint),
    stories,
    decisionCockpit: buildDecisionCockpit({
      sprint,
      summary,
      stories,
      stuckCandidates,
      scopeChanges,
      dailyCompletions,
      remainingWorkByDay,
      idealBurndown,
      daysMeta,
      previousSprint,
      recentSubtaskMovementRows,
      meta: {
        partialPermissions: false,
      },
    }),
    notes,
    assumptions,
    meta: {
      fromSnapshot: false,
      snapshotAt: null,
      generatedAt: new Date().toISOString(),
      dataMode: String(sprint.state || '').toLowerCase() === 'active' ? 'live' : 'snapshot',
      activeSprintCount: Array.isArray(sprints) ? sprints.filter((s) => String(s?.state || '').toLowerCase() === 'active').length : 0,
      jiraHost: jiraHostResolved,
      jiraHostResolved,
    },
  };

  return payload;
}
