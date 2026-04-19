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

function computeDefaultVodacomQuarterWindow() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  let quarterStart;
  let quarterEnd;
  if (m <= 2) {
    // Q4 Jan-Mar; default to previous completed quarter Q3 Oct-Dec
    quarterStart = new Date(Date.UTC(y - 1, 9, 1, 0, 0, 0, 0));
    quarterEnd = new Date(Date.UTC(y - 1, 11, 31, 23, 59, 59, 999));
  } else if (m <= 5) {
    // Q1 Apr-Jun; default Q4 Jan-Mar
    quarterStart = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
    quarterEnd = new Date(Date.UTC(y, 2, 31, 23, 59, 59, 999));
  } else if (m <= 8) {
    // Q2 Jul-Sep; default Q1 Apr-Jun
    quarterStart = new Date(Date.UTC(y, 3, 1, 0, 0, 0, 0));
    quarterEnd = new Date(Date.UTC(y, 5, 30, 23, 59, 59, 999));
  } else {
    // Q3 Oct-Dec; default Q2 Jul-Sep
    quarterStart = new Date(Date.UTC(y, 6, 1, 0, 0, 0, 0));
    quarterEnd = new Date(Date.UTC(y, 8, 30, 23, 59, 59, 999));
  }
  return {
    startIso: quarterStart.toISOString(),
    endIso: quarterEnd.toISOString(),
    startLocal: toLocalInputValue(quarterStart),
    endLocal: toLocalInputValue(quarterEnd),
  };
}

const defaultWindow = computeDefaultVodacomQuarterWindow();
export const DEFAULT_WINDOW_START = defaultWindow.startIso;
export const DEFAULT_WINDOW_END = defaultWindow.endIso;
export const DEFAULT_WINDOW_START_LOCAL = defaultWindow.startLocal;
export const DEFAULT_WINDOW_END_LOCAL = defaultWindow.endLocal;
export const LOADING_STEP_LIMIT = 6;
