/**
 * Drill-down row building and Epic key resolution for report rows.
 * SSOT for buildDrillDownRow, resolveEpicKey, extractTimeTrackingSeconds. Used by lib/issues.js and server.
 */

import { logger } from './Jira-Reporting-App-Server-Logging-Utility.js';

function toHours(valueSeconds) {
  if (valueSeconds === null || valueSeconds === undefined) {
    return '';
  }
  const seconds = Number(valueSeconds);
  if (Number.isNaN(seconds)) {
    return '';
  }
  return Number((seconds / 3600).toFixed(2));
}

export function extractTimeTrackingSeconds(issue) {
  return {
    original:
      issue.fields?.aggregatetimeoriginalestimate ??
      issue.fields?.timeoriginalestimate ??
      issue.fields?.timetracking?.originalEstimateSeconds ??
      null,
    spent:
      issue.fields?.aggregatetimespent ??
      issue.fields?.timespent ??
      issue.fields?.timetracking?.timeSpentSeconds ??
      null,
    remaining:
      issue.fields?.aggregatetimeestimate ??
      issue.fields?.timeestimate ??
      issue.fields?.timetracking?.remainingEstimateSeconds ??
      null,
  };
}

function formatFieldValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value
      .map(entry => {
        if (entry?.name) return entry.name;
        if (entry?.value) return entry.value;
        if (entry?.displayName) return entry.displayName;
        return String(entry);
      })
      .filter(Boolean)
      .join('; ');
  }
  if (typeof value === 'object') {
    if (value?.name) return value.name;
    if (value?.value) return value.value;
    if (value?.displayName) return value.displayName;
    return '';
  }
  return String(value);
}

export function resolveEpicKey(issue, epicLinkFieldId) {
  if (issue.fields?.parent?.fields?.issuetype?.name === 'Epic') {
    return issue.fields.parent.key || '';
  }
  if (epicLinkFieldId && issue.fields?.[epicLinkFieldId]) {
    const epicLink = issue.fields[epicLinkFieldId];
    if (typeof epicLink === 'string') {
      return epicLink;
    }
    if (epicLink?.key) {
      return epicLink.key;
    }
  }
  return '';
}

/**
 * Builds a drill-down row object from issue, sprint, and board data
 */
export function buildDrillDownRow(issue, sprint, board, fields, options = {}) {
  const { includeStoryPoints = false, includeEpicTTM = false, epicMap = null } = options;
  const tracking = extractTimeTrackingSeconds(issue);
  const timeOriginalEstimateSeconds = tracking.original;
  const timeSpentSeconds = tracking.spent;
  const timeRemainingSeconds = tracking.remaining;
  const timeVarianceSeconds =
    timeOriginalEstimateSeconds != null && timeSpentSeconds != null
      ? timeSpentSeconds - timeOriginalEstimateSeconds
      : null;
  const subtaskTracking = issue.fields?.subtaskTimeTracking || null;
  const subtaskOriginalEstimateSeconds = subtaskTracking?.originalEstimateSeconds ?? null;
  const subtaskSpentSeconds = subtaskTracking?.spentSeconds ?? null;
  const subtaskRemainingSeconds = subtaskTracking?.remainingSeconds ?? null;
  const subtaskVarianceSeconds =
    subtaskOriginalEstimateSeconds != null && subtaskSpentSeconds != null
      ? subtaskSpentSeconds - subtaskOriginalEstimateSeconds
      : null;
  const labels = Array.isArray(issue.fields?.labels) ? issue.fields.labels : [];
  const components = Array.isArray(issue.fields?.components)
    ? issue.fields.components.map(component => component?.name).filter(Boolean)
    : [];
  const fixVersions = Array.isArray(issue.fields?.fixVersions)
    ? issue.fields.fixVersions.map(version => version?.name).filter(Boolean)
    : [];
  const priorityName = issue.fields?.priority?.name || '';
  const statusCategoryName = issue.fields?.status?.statusCategory?.name || '';
  const subtaskCount = Array.isArray(issue.fields?.subtasks) ? issue.fields.subtasks.length : 0;
  const ebmFieldIds = fields?.ebmFieldIds || {};
  const ebmTeam = formatFieldValue(issue.fields?.[ebmFieldIds['Team']]);
  const ebmProductArea = formatFieldValue(issue.fields?.[ebmFieldIds['Product Area']]);
  const ebmCustomerSegments = formatFieldValue(issue.fields?.[ebmFieldIds['Customer segments']]);
  const ebmValue = formatFieldValue(issue.fields?.[ebmFieldIds['Value']]);
  const ebmImpact = formatFieldValue(issue.fields?.[ebmFieldIds['Impact']]);
  const ebmSatisfaction = formatFieldValue(issue.fields?.[ebmFieldIds['Satisfaction']]);
  const ebmSentiment = formatFieldValue(issue.fields?.[ebmFieldIds['Sentiment']]);
  const ebmSeverity = formatFieldValue(issue.fields?.[ebmFieldIds['Severity']]);
  const ebmSource = formatFieldValue(issue.fields?.[ebmFieldIds['Source']]);
  const ebmWorkCategory = formatFieldValue(issue.fields?.[ebmFieldIds['Work category']]);
  const ebmGoals = formatFieldValue(issue.fields?.[ebmFieldIds['Goals']]);
  const ebmTheme = formatFieldValue(issue.fields?.[ebmFieldIds['Theme']]);
  const ebmRoadmap = formatFieldValue(issue.fields?.[ebmFieldIds['Roadmap']]);
  const ebmFocusAreas = formatFieldValue(issue.fields?.[ebmFieldIds['Focus Areas']]);
  const ebmDeliveryStatus = formatFieldValue(issue.fields?.[ebmFieldIds['Delivery status']]);
  const ebmDeliveryProgress = formatFieldValue(issue.fields?.[ebmFieldIds['Delivery progress']]);

  const row = {
    projectKey: issue.fields?.project?.key || '',
    boardId: board.id || '',
    boardName: board.name || '',
    sprintId: sprint.id || '',
    sprintName: sprint.name || '',
    sprintState: sprint.state || '',
    sprintStartDate: sprint.startDate || '',
    sprintEndDate: sprint.endDate || '',
    issueKey: issue.key || '',
    issueSummary: issue.fields?.summary || '',
    issueStatus: issue.fields?.status?.name || '',
    issueType: issue.fields?.issuetype?.name || '',
    issueStatusCategory: statusCategoryName,
    issuePriority: priorityName,
    issueLabels: labels.join('; '),
    issueComponents: components.join('; '),
    issueFixVersions: fixVersions.join('; '),
    assigneeDisplayName: issue.fields?.assignee?.displayName || '',
    reporterDisplayName: issue.fields?.reporter?.displayName || '',
    created: issue.fields?.created || '',
    updated: issue.fields?.updated || '',
    resolutionDate: issue.fields?.resolutiondate || '',
    subtaskCount,
    timeOriginalEstimateHours: toHours(timeOriginalEstimateSeconds),
    timeRemainingEstimateHours: toHours(timeRemainingSeconds),
    timeSpentHours: toHours(timeSpentSeconds),
    timeVarianceHours: toHours(timeVarianceSeconds),
    subtaskTimeOriginalEstimateHours: toHours(subtaskOriginalEstimateSeconds),
    subtaskTimeRemainingEstimateHours: toHours(subtaskRemainingSeconds),
    subtaskTimeSpentHours: toHours(subtaskSpentSeconds),
    subtaskTimeVarianceHours: toHours(subtaskVarianceSeconds),
    ebmTeam,
    ebmProductArea,
    ebmCustomerSegments,
    ebmValue,
    ebmImpact,
    ebmSatisfaction,
    ebmSentiment,
    ebmSeverity,
    ebmSource,
    ebmWorkCategory,
    ebmGoals,
    ebmTheme,
    ebmRoadmap,
    ebmFocusAreas,
    ebmDeliveryStatus,
    ebmDeliveryProgress,
  };

  if (!issue.fields?.issuetype?.name) {
    logger.warn(`Issue ${issue.key}: Missing issueType field`, {
      issueKey: issue.key,
      projectKey: issue.fields?.project?.key
    });
  }

  if (includeStoryPoints && fields.storyPointsFieldId) {
    const storyPoints = issue.fields?.[fields.storyPointsFieldId];
    row.storyPoints = storyPoints != null ? String(storyPoints) : '';
  } else {
    row.storyPoints = '';
  }

  if (fields.epicLinkFieldId) {
    row.epicKey = resolveEpicKey(issue, fields.epicLinkFieldId);
    if (epicMap && row.epicKey) {
      const epicData = epicMap.get(row.epicKey);
      if (epicData) {
        row.epicTitle = epicData.title || '';
        row.epicSummary = epicData.summary || '';
      } else {
        row.epicTitle = '';
        row.epicSummary = '';
      }
    } else {
      row.epicTitle = '';
      row.epicSummary = '';
    }
  } else {
    row.epicKey = '';
    row.epicTitle = '';
    row.epicSummary = '';
  }

  return row;
}
