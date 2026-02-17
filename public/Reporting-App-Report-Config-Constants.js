export const FALLBACK_CSV_COLUMNS = [
  'projectKey', 'boardId', 'boardName', 'sprintId', 'sprintName', 'sprintState', 'sprintStartDate', 'sprintEndDate',
  'issueKey', 'issueSummary', 'issueStatus', 'issueType', 'issueStatusCategory', 'issuePriority', 'issueLabels',
  'issueComponents', 'issueFixVersions', 'assigneeDisplayName', 'created', 'updated', 'resolutionDate', 'subtaskCount',
  'timeOriginalEstimateHours', 'timeRemainingEstimateHours', 'timeSpentHours', 'timeVarianceHours',
  'subtaskTimeOriginalEstimateHours', 'subtaskTimeRemainingEstimateHours', 'subtaskTimeSpentHours', 'subtaskTimeVarianceHours',
  'ebmTeam', 'ebmProductArea', 'ebmCustomerSegments', 'ebmValue', 'ebmImpact', 'ebmSatisfaction', 'ebmSentiment', 'ebmSeverity',
  'ebmSource', 'ebmWorkCategory', 'ebmGoals', 'ebmTheme', 'ebmRoadmap', 'ebmFocusAreas', 'ebmDeliveryStatus', 'ebmDeliveryProgress',
  'storyPoints', 'epicKey', 'epicTitle', 'epicSummary',
];

let csvColumns = [...FALLBACK_CSV_COLUMNS];

export function getCsvColumns() {
  return csvColumns;
}

export function initCsvColumns() {
  fetch('/api/csv-columns')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(d => {
      if (Array.isArray(d?.columns)) {
        csvColumns = d.columns;
      }
    })
    .catch(() => {});
}

function toLocalInputValue(date) {
  const d = new Date(date);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear()
    + '-' + p(d.getMonth() + 1)
    + '-' + p(d.getDate())
    + 'T' + p(d.getHours())
    + ':' + p(d.getMinutes());
}

function computeDefaultRollingWindow() {
  const end = new Date();
  end.setSeconds(0, 0);
  const start = new Date(end);
  start.setMonth(start.getMonth() - 3);
  start.setHours(0, 0, 0, 0);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startLocal: toLocalInputValue(start),
    endLocal: toLocalInputValue(end),
  };
}

const rollingWindow = computeDefaultRollingWindow();
export const DEFAULT_WINDOW_START = rollingWindow.startIso;
export const DEFAULT_WINDOW_END = rollingWindow.endIso;
export const DEFAULT_WINDOW_START_LOCAL = rollingWindow.startLocal;
export const DEFAULT_WINDOW_END_LOCAL = rollingWindow.endLocal;
export const LOADING_STEP_LIMIT = 6;
