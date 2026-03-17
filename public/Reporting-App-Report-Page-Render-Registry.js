export { populateBoardsPills, populateSprintsPills, populateProjectsPills, applyBoardsFilters, applySprintsFilters, applyFilters } from './Reporting-App-Report-Page-Filters-Pills-Manager.js';
export { renderProjectEpicLevelTab } from './Reporting-App-Report-Page-Render-Boards.js';
export { renderSprintsTab } from './Reporting-App-Report-Page-Render-Sprints.js';
export { renderDoneStoriesTab, toggleSprint } from './Reporting-App-Report-Page-Render-DoneStories.js';
export { renderUnusableSprintsTab } from './Reporting-App-Report-Page-Render-Unusable.js';
export { updateExportFilteredState } from './Reporting-App-Report-Page-Export-Menu.js';

import { renderLeadershipPage } from './Reporting-App-Leadership-Page-Render.js';
import { buildBoardSummaries } from './Reporting-App-Shared-Boards-Summary-Builder.js';

export function renderTrendsTab(previewData) {
  const container = document.getElementById('leadership-content');
  if (!container) return;

  const boards = Array.isArray(previewData?.boards) ? previewData.boards : [];
  const sprintsIncluded = Array.isArray(previewData?.sprintsIncluded) ? previewData.sprintsIncluded : [];
  const rows = Array.isArray(previewData?.rows) ? previewData.rows : [];
  const meta = previewData?.meta || {};
  const predictabilityPerSprint = previewData?.metrics?.predictability?.perSprint || null;
  const boardSummaries = previewData?.boardSummaries || buildBoardSummaries(boards, sprintsIncluded, rows, meta, predictabilityPerSprint);

  container.innerHTML = renderLeadershipPage({
    ...previewData,
    boardSummaries,
    meta: {
      ...meta,
      projects: Array.isArray(meta.selectedProjects) && meta.selectedProjects.length
        ? meta.selectedProjects.join(',')
        : (meta.projects || ''),
    },
  });
}
