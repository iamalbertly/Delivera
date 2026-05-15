// SIZE-EXEMPT: Cohesive metrics domain logic (throughput, done comparison,
// rework, predictability, epic TTM) is kept in a single module to avoid
// scattering cross-related calculations and increasing coordination bugs.
// JSON-facing callers should convert any Map fields to plain objects or
// arrays before serialisation.

import { calculateWorkDays } from './kpiCalculations.js';

/**
 * Calculates throughput metrics (story points per sprint, per project, and per issue type)
 * @param {Array} rows - Drill-down rows
 * @param {boolean} includeStoryPoints - Whether story points are included
 * @returns {Object} - {perSprint: Object, perProject: Object, perIssueType: Object}
 */
export function calculateThroughput(rows, includeStoryPoints) {
  if (!includeStoryPoints) {
    return { perSprint: {}, perProject: {}, perIssueType: {} };
  }

  const perSprint = new Map();
  const perProject = {};
  const perIssueType = {};

  for (const row of rows) {
    const storyPoints = parseFloat(row.storyPoints) || 0;
    const issueType = row.issueType || 'Unknown';
    
    // Per sprint
    if (!perSprint.has(row.sprintId)) {
      perSprint.set(row.sprintId, {
        sprintId: row.sprintId,
        sprintName: row.sprintName,
        totalSP: 0,
        storyCount: 0,
      });
    }
    const sprintData = perSprint.get(row.sprintId);
    sprintData.totalSP += storyPoints;
    sprintData.storyCount += 1;

    // Per project
    if (!perProject[row.projectKey]) {
      perProject[row.projectKey] = {
        projectKey: row.projectKey,
        totalSP: 0,
        sprintCount: 0,
        storyCount: 0,
        sprints: new Set(),
      };
    }
    const projectData = perProject[row.projectKey];
    projectData.totalSP += storyPoints;
    projectData.storyCount += 1;
    projectData.sprints.add(row.sprintId);

    // Per issue type
    if (!perIssueType[issueType]) {
      perIssueType[issueType] = {
        issueType: issueType,
        totalSP: 0,
        issueCount: 0,
      };
    }
    const typeData = perIssueType[issueType];
    typeData.totalSP += storyPoints;
    typeData.issueCount += 1;
  }

  // Convert Set to count
  for (const projectKey in perProject) {
    perProject[projectKey].sprintCount = perProject[projectKey].sprints.size;
    perProject[projectKey].averageSPPerSprint = 
      perProject[projectKey].sprintCount > 0
        ? perProject[projectKey].totalSP / perProject[projectKey].sprintCount
        : 0;
    delete perProject[projectKey].sprints;
  }

  const perSprintObject = Object.fromEntries(perSprint);
  return { perSprint: perSprintObject, perProject, perIssueType };
}

/**
 * Calculates done now vs done by sprint end comparison
 * @param {Array} rows - Drill-down rows (all are "done now")
 * @param {boolean} requireResolvedBySprintEnd - Whether to calculate "done by end"
 * @returns {Object} - {doneNow: number, doneByEnd: number, perSprint: Map}
 */
export function calculateDoneComparison(rows, requireResolvedBySprintEnd) {
  const doneNow = rows.length;
  let doneByEnd = 0;
  const perSprint = new Map();

  for (const row of rows) {
    if (!perSprint.has(row.sprintId)) {
      perSprint.set(row.sprintId, {
        sprintId: row.sprintId,
        sprintName: row.sprintName,
        doneNow: 0,
        doneByEnd: 0,
      });
    }
    const sprintData = perSprint.get(row.sprintId);
    sprintData.doneNow += 1;

    if (requireResolvedBySprintEnd) {
      if (row.resolutionDate && row.sprintEndDate) {
        const resolutionTime = new Date(row.resolutionDate).getTime();
        const sprintEndTime = new Date(row.sprintEndDate).getTime();
        if (resolutionTime <= sprintEndTime) {
          sprintData.doneByEnd += 1;
          doneByEnd += 1;
        }
      }
    } else {
      // If toggle not enabled, doneByEnd equals doneNow
      sprintData.doneByEnd += 1;
      doneByEnd += 1;
    }
  }

  return { doneNow, doneByEnd, perSprint };
}

/**
 * Calculates rework ratio (bugs vs stories)
 * @param {Array} storyRows - Story rows
 * @param {Array} bugIssues - Bug issues from fetchBugsForSprints
 * @param {boolean} includeStoryPoints - Whether story points are available
 * @param {string} storyPointsFieldId - Story Points field ID
 * @returns {Object} - {reworkRatio: number, bugSP: number, storySP: number, bugCount: number, storyCount: number, spAvailable: boolean}
 */
export function calculateReworkRatio(storyRows, bugIssues, includeStoryPoints, storyPointsFieldId) {
  const storyCount = storyRows.length;
  const bugCount = bugIssues.length;

  if (!includeStoryPoints || !storyPointsFieldId) {
    return {
      reworkRatio: null,
      bugSP: 0,
      storySP: 0,
      bugCount,
      storyCount,
      spAvailable: false,
    };
  }

  let storySP = 0;
  for (const row of storyRows) {
    storySP += parseFloat(row.storyPoints) || 0;
  }

  let bugSP = 0;
  for (const issue of bugIssues) {
    const sp = issue.fields?.[storyPointsFieldId];
    bugSP += parseFloat(sp) || 0;
  }

  const totalSP = bugSP + storySP;
  const reworkRatio = totalSP > 0 ? (bugSP / totalSP) * 100 : 0;

  return {
    reworkRatio,
    bugSP,
    storySP,
    bugCount,
    storyCount,
    spAvailable: true,
  };
}

/**
 * Calculates predictability metrics (committed vs delivered)
 * @param {Array} rows - Drill-down rows
 * @param {Array} sprints - Sprint objects with startDate/endDate
 * @param {string} predictabilityMode - 'approx' or 'strict'
 * @param {Version3Client} version3Client - For changelog access in strict mode
 * @returns {Promise<Object>} - Predictability metrics
 */
import { logger } from './Delivera-Server-Logging-Utility.js';

export async function calculatePredictability(rows, sprints, predictabilityMode, version3Client) {
  if (predictabilityMode === 'strict') {
    // Strict mode: use changelog to detect sprint membership at sprint start
    // This is complex and may be slow, so we'll implement a best-effort approach
    // For now, fall back to approx mode with a note
    logger.warn('Strict predictability mode not fully implemented, falling back to approx mode');
    return calculatePredictabilityApprox(rows, sprints);
  }

  return calculatePredictabilityApprox(rows, sprints);
}

/**
 * Approximate predictability calculation
 * @param {Array} rows - Drill-down rows
 * @param {Array} sprints - Sprint objects
 * @returns {Object} - Predictability metrics
 */
function calculatePredictabilityApprox(rows, sprints) {
  const sprintMap = new Map();
  for (const sprint of sprints) {
    sprintMap.set(sprint.id, sprint);
  }

  const perSprint = new Map();

  for (const row of rows) {
    const sprint = sprintMap.get(row.sprintId);
    if (!sprint) continue;

    if (!perSprint.has(row.sprintId)) {
      perSprint.set(row.sprintId, {
        sprintId: row.sprintId,
        sprintName: row.sprintName,
        committedStories: 0,
        committedSP: 0,
        deliveredStories: 0,
        deliveredSP: 0,
        plannedCarryoverStories: 0,
        plannedCarryoverSP: 0,
        unplannedSpilloverStories: 0,
        unplannedSpilloverSP: 0,
      });
    }

    const sprintData = perSprint.get(row.sprintId);
    const sprintStartTime = new Date(sprint.startDate).getTime();
    const sprintEndTime = new Date(sprint.endDate).getTime();
    const createdTime = new Date(row.created).getTime();
    const resolutionTime = row.resolutionDate ? new Date(row.resolutionDate).getTime() : null;
    const sp = parseFloat(row.storyPoints) || 0;

    // Committed: created <= sprintStartDate
    if (createdTime <= sprintStartTime) {
      sprintData.committedStories += 1;
      sprintData.committedSP += sp;
    }

    // Delivered: resolutionDate <= sprintEndDate; split into planned carryover vs unplanned spillover
    if (resolutionTime && resolutionTime <= sprintEndTime) {
      sprintData.deliveredStories += 1;
      sprintData.deliveredSP += sp;
      if (createdTime <= sprintStartTime) {
        sprintData.plannedCarryoverStories += 1;
        sprintData.plannedCarryoverSP += sp;
      } else {
        sprintData.unplannedSpilloverStories += 1;
        sprintData.unplannedSpilloverSP += sp;
      }
    }
  }

  // Calculate predictability percentage and planned/unplanned breakdown
  for (const [, data] of perSprint.entries()) {
    if (data.committedStories > 0) {
      data.predictabilityStories = (data.deliveredStories / data.committedStories) * 100;
    } else {
      data.predictabilityStories = 0;
    }

    if (data.committedSP > 0) {
      data.predictabilitySP = (data.deliveredSP / data.committedSP) * 100;
    } else {
      data.predictabilitySP = 0;
    }

    data.plannedCarryoverPct = data.deliveredStories > 0
      ? (data.plannedCarryoverStories / data.deliveredStories) * 100
      : null;
    data.unplannedSpilloverPct = data.deliveredStories > 0
      ? (data.unplannedSpilloverStories / data.deliveredStories) * 100
      : null;
  }

  const perSprintObject = Object.fromEntries(perSprint);
  return {
    mode: 'approx',
    perSprint: perSprintObject,
  };
}

/**
 * Calculates Epic Time-To-Market (TTM) metrics using Epic issues' actual dates
 * @param {Array} rows - Drill-down rows
 * @param {Array} epicIssues - Array of Epic issue objects from Jira (optional, for accurate dates)
 * @returns {Object} - Epic TTM data
 */
export function calculateEpicTTM(rows, epicIssues = []) {
  const epicMap = new Map();
  const epicIssuesMap = new Map();

  // Create map of Epic issues by key for quick lookup
  for (const epic of epicIssues) {
    if (epic?.key) {
      epicIssuesMap.set(epic.key, epic);
    }
  }

  // Collect story counts and dates per Epic
  for (const row of rows) {
    if (!row.epicKey) continue;

    if (!epicMap.has(row.epicKey)) {
      epicMap.set(row.epicKey, {
        epicKey: row.epicKey,
        storyCount: 0,
        storyCreatedDates: [],
        storyResolutionDates: [],
        storyItems: new Map(),
        subtaskSpentHoursTotal: 0,
        subtaskSpentHoursEntries: 0,
        epicTitleFromRows: '',
      });
    }

    const epicData = epicMap.get(row.epicKey);
    epicData.storyCount += 1;
    if (row.epicTitle && !epicData.epicTitleFromRows) {
      epicData.epicTitleFromRows = row.epicTitle;
    }

    if (row.created) {
      epicData.storyCreatedDates.push(new Date(row.created));
    }
    if (row.resolutionDate) {
      epicData.storyResolutionDates.push(new Date(row.resolutionDate));
    }
    if (row.issueKey && !epicData.storyItems.has(row.issueKey)) {
      epicData.storyItems.set(row.issueKey, {
        issueKey: row.issueKey,
        summary: row.issueSummary || '',
      });
    }
    if (row.subtaskTimeSpentHours != null && row.subtaskTimeSpentHours !== '') {
      const hours = Number(row.subtaskTimeSpentHours);
      if (!Number.isNaN(hours)) {
        epicData.subtaskSpentHoursTotal += hours;
        epicData.subtaskSpentHoursEntries += 1;
      }
    }
  }

  const epicTTM = [];
  let fallbackCount = 0;
  
  for (const [epicKey, data] of epicMap.entries()) {
    const epicIssue = epicIssuesMap.get(epicKey);
    
    // Prefer Epic issue dates, fallback to story dates if Epic not available
    let startDate = null;
    let endDate = null;
    let usedFallback = false;

    if (epicIssue?.fields?.created) {
      // Use Epic creation date as start (more accurate than story dates)
      startDate = new Date(epicIssue.fields.created);
    } else if (Array.isArray(data.storyCreatedDates) && data.storyCreatedDates.length > 0) {
      // Fallback to earliest story creation date
      startDate = new Date(Math.min(...data.storyCreatedDates));
      usedFallback = true;
      logger.warn(`Epic ${epicKey}: Using story creation dates (Epic issue not available)`);
    } else {
      logger.warn(`Epic ${epicKey}: No Epic created date or storyCreatedDates array available, skipping TTM calculation`);
    }

    if (!startDate) {
      // Skip if no start date available
      logger.warn(`Epic ${epicKey}: No start date available, skipping TTM calculation`);
      continue;
    }

    // For end date, prefer Epic resolution date, then latest story resolution date
    if (epicIssue?.fields?.resolutiondate) {
      endDate = new Date(epicIssue.fields.resolutiondate);
    } else if (Array.isArray(data.storyResolutionDates) && data.storyResolutionDates.length > 0) {
      endDate = new Date(Math.max(...data.storyResolutionDates));
      if (!usedFallback) {
        usedFallback = true;
      }
    } else {
      logger.warn(`Epic ${epicKey}: No Epic resolution date or storyResolutionDates array available, TTM will have open end date`);
    }

    if (usedFallback) {
      fallbackCount++;
    }

    const epicTitle = epicIssue?.fields?.summary || data.epicTitleFromRows || '';
    const subtaskSpentHours =
      data.subtaskSpentHoursEntries > 0 ? data.subtaskSpentHoursTotal : null;

    if (!endDate) {
      epicTTM.push({
        epicKey,
        epicTitle,
        storyCount: data.storyCount,
        storyItems: [...data.storyItems.values()],
        subtaskSpentHours,
        startDate: startDate.toISOString(),
        endDate: '',
        calendarTTMdays: null,
        workingTTMdays: null,
      });
      continue;
    }

    const calendarTTMdays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const wd = calculateWorkDays(startDate, endDate);
    const workingTTMdays = typeof wd === 'number' ? wd : null;

    epicTTM.push({
      epicKey,
      epicTitle,
      storyCount: data.storyCount,
      storyItems: [...data.storyItems.values()],
      subtaskSpentHours,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      calendarTTMdays,
      workingTTMdays,
    });
  }

  return { epicTTM, fallbackCount };
}
