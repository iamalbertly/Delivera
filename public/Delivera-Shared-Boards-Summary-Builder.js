/**
 * SSOT for board summary aggregation used by Report and Leadership views.
 * Canonical shape must match server sprintsIncluded (sprintWorkDays, sprintCalendarDays, etc.).
 * Use only server-provided fields; no client-only computed fields that can drift.
 */

function calculateSprintDays(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return null;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Build board summaries from boards, sprintsIncluded, rows, meta, and predictability.
 * Returns a Map<boardId, summary>. Summary shape includes all fields needed by Report;
 * Leadership consumes the subset it needs (sprintCount, doneStories, doneSP, totalSprintDays,
 * validSprintDaysCount, doneBySprintEnd, earliestStart, latestEnd, committedSP, deliveredSP).
 * @param {Array} boards
 * @param {Array} sprintsIncluded - server-provided; use sprintWorkDays/sprintCalendarDays when present
 * @param {Array} rows
 * @param {Object} meta
 * @param {Object} predictabilityPerSprint
 * @returns {Map<number|string, Object>}
 */
export function buildBoardSummaries(boards, sprintsIncluded, rows, meta, predictabilityPerSprint = null) {
  const summaries = new Map();
  const boardIds = (boards || []).map((board) => board.id);
  boardIds.forEach((id) => {
      summaries.set(id, {
        sprintCount: 0,
        doneStories: 0,
        doneSP: 0,
        registeredWorkHours: 0,
        estimatedWorkHours: 0,
        committedSP: 0,
        deliveredSP: 0,
        earliestStart: null,
        latestEnd: null,
        totalSprintDays: 0,
        validSprintDaysCount: 0,
        doneBySprintEnd: 0,
        sprintSpValues: [],
        epicStories: 0,
        nonEpicStories: 0,
        epicSP: 0,
        nonEpicSP: 0,
        assignees: new Set(),
        assigneeStoryCounts: new Map(),
        assigneeSpTotals: new Map(),
        nonEpicAssignees: new Set(),
      });
    });

  const spEnabled = !!meta?.discoveredFields?.storyPointsFieldId;
  const sprintSpTotals = new Map();
  for (const row of rows || []) {
    if (!summaries.has(row.boardId)) {
      summaries.set(row.boardId, {
        sprintCount: 0,
        doneStories: 0,
        doneSP: 0,
        registeredWorkHours: 0,
        estimatedWorkHours: 0,
        committedSP: 0,
        deliveredSP: 0,
        earliestStart: null,
        latestEnd: null,
        totalSprintDays: 0,
        validSprintDaysCount: 0,
        doneBySprintEnd: 0,
        sprintSpValues: [],
        epicStories: 0,
        nonEpicStories: 0,
        epicSP: 0,
        nonEpicSP: 0,
        assignees: new Set(),
        assigneeStoryCounts: new Map(),
        assigneeSpTotals: new Map(),
        nonEpicAssignees: new Set(),
      });
    }
    const summary = summaries.get(row.boardId);
    summary.doneStories += 1;
    summary.registeredWorkHours += (Number(row.subtaskTimeSpentHours) || Number(row.timeSpentHours) || 0);
    summary.estimatedWorkHours += (Number(row.subtaskTimeOriginalEstimateHours) || Number(row.timeOriginalEstimateHours) || 0);
    const rowSp = spEnabled ? (parseFloat(row.storyPoints) || 0) : 0;
    if (spEnabled) {
      summary.doneSP += rowSp;
    }
    if (row.epicKey) {
      summary.epicStories += 1;
      if (spEnabled) summary.epicSP += rowSp;
    } else {
      summary.nonEpicStories += 1;
      if (spEnabled) summary.nonEpicSP += rowSp;
    }

    const assigneeName = (row.assigneeDisplayName || '').trim();
    if (assigneeName) {
      summary.assignees.add(assigneeName);
      summary.assigneeStoryCounts.set(assigneeName, (summary.assigneeStoryCounts.get(assigneeName) || 0) + 1);
      if (spEnabled) {
        summary.assigneeSpTotals.set(
          assigneeName,
          (summary.assigneeSpTotals.get(assigneeName) || 0) + rowSp
        );
      }
      if (!row.epicKey) {
        summary.nonEpicAssignees.add(assigneeName);
      }
    }

    if (row.sprintId) {
      const sprintTotal = sprintSpTotals.get(row.sprintId) || 0;
      sprintSpTotals.set(row.sprintId, sprintTotal + (parseFloat(row.storyPoints) || 0));
    }
  }

  for (const sprint of sprintsIncluded || []) {
    if (!summaries.has(sprint.boardId)) {
      summaries.set(sprint.boardId, {
        sprintCount: 0,
        doneStories: 0,
        doneSP: 0,
        registeredWorkHours: 0,
        estimatedWorkHours: 0,
        committedSP: 0,
        deliveredSP: 0,
        earliestStart: null,
        latestEnd: null,
        totalSprintDays: 0,
        validSprintDaysCount: 0,
        doneBySprintEnd: 0,
        sprintSpValues: [],
        epicStories: 0,
        nonEpicStories: 0,
        epicSP: 0,
        nonEpicSP: 0,
        assignees: new Set(),
        assigneeStoryCounts: new Map(),
        assigneeSpTotals: new Map(),
        nonEpicAssignees: new Set(),
      });
    }
    const summary = summaries.get(sprint.boardId);
    summary.sprintCount += 1;
    summary.doneBySprintEnd += sprint.doneStoriesBySprintEnd || 0;

    if (predictabilityPerSprint && predictabilityPerSprint[sprint.id]) {
      const predictData = predictabilityPerSprint[sprint.id];
      summary.committedSP += Number(predictData.committedSP) || 0;
      summary.deliveredSP += Number(predictData.deliveredSP) || 0;
    }

    const sprintDays = calculateSprintDays(sprint.startDate, sprint.endDate);
    if (sprintDays !== null) {
      summary.totalSprintDays += sprintDays;
      summary.validSprintDaysCount += 1;
    }

    const sprintStart = sprint.startDate ? new Date(sprint.startDate) : null;
    const sprintEnd = sprint.endDate ? new Date(sprint.endDate) : null;
    if (sprintStart && !Number.isNaN(sprintStart.getTime())) {
      if (!summary.earliestStart || sprintStart < summary.earliestStart) {
        summary.earliestStart = sprintStart;
      }
    }
    if (sprintEnd && !Number.isNaN(sprintEnd.getTime())) {
      if (!summary.latestEnd || sprintEnd > summary.latestEnd) {
        summary.latestEnd = sprintEnd;
      }
    }

    if (spEnabled && sprintSpTotals.has(sprint.id)) {
      summary.sprintSpValues.push(sprintSpTotals.get(sprint.id));
    }
  }

  return summaries;
}
