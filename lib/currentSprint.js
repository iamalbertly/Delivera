/**
 * Current-sprint transparency facade — buildCurrentSprintPayload orchestration.
 * Pure compute helpers live in Delivera-Data-CurrentSprint-Compute-Metrics-SSOT.js.
 */

import { fetchSprintsForBoard } from './sprints.js';
import { fetchSprintIssuesForTransparency } from './issues.js';
import { logger } from './Delivera-Server-Logging-Utility.js';
import { readCurrentSprintNotes, getCurrentSprintNotes } from './Delivera-Data-CurrentSprint-Notes-IO.js';
import { getDefaultPeerWorkItemTypes, isWorkItemIssue } from './Delivera-Data-IssueType-Classification.js';
import {
  computeIdealBurndown,
  resolveSprintFromList,
  resolveRecentSprints,
  computeSprintSummary,
  resolveNextSprint,
} from './Delivera-Data-CurrentSprint-Burndown-Resolve.js';
import { resolveJiraHostFromEnv } from './server-utils.js';
import { collectTeamRosterFromSprintIssues } from './Delivera-Data-CurrentSprint-TeamRoster-01Collect-SSOT.js';
import { attachSquadRealityToPayload } from './Delivera-CurrentSprint-SquadReality-01Verdict-SSOT.js';
import {
  buildDecisionCockpit,
  buildIssueUrl,
  computeDailyCompletions,
  computeDaysMeta,
  computeFlags,
  computeHoursSinceIso,
  computeObservedWorkWindow,
  computeRemainingWorkByDay,
  computeScopeChanges,
  computeStoriesList,
  computeSubtaskTracking,
} from './Delivera-Data-CurrentSprint-Compute-Metrics-SSOT.js';
/** Default assumption set for v1 (completion anchor = resolution date) */
const DEFAULT_ASSUMPTIONS = [
  'Completion anchored to: resolution date.',
  'Observed window from story created/resolution only.',
  'Scope added = created after sprint start (no changelog in v1).',
  'Burndown assumes linear scope; scope changes shown separately.',
];


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
  stuckCandidates.sort((a, b) => Number(b?.hoursInStatus || 0) - Number(a?.hoursInStatus || 0));
  const teamRoster = collectTeamRosterFromSprintIssues(issues);

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
      teamRoster,
    },
  };

  return attachSquadRealityToPayload(payload, {
    requestedSprintId: options?.sprintId != null ? Number(options.sprintId) : null,
  });
}