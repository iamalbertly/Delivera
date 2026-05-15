export { populateBoardsPills, populateSprintsPills, populateProjectsPills, applyBoardsFilters, applySprintsFilters, applyFilters } from './Delivera-Report-Page-Filters-Pills-Manager.js';
export { renderProjectEpicLevelTab } from './Delivera-Report-Page-Render-Boards.js';
export { renderSprintsTab } from './Delivera-Report-Page-Render-Sprints.js';
export { renderDoneStoriesTab, toggleSprint } from './Delivera-Report-Page-Render-DoneStories.js';
export { renderUnusableSprintsTab } from './Delivera-Report-Page-Render-Unusable.js';
export { updateExportFilteredState } from './Delivera-Report-Page-Export-Menu.js';

import { renderLeadershipPage } from './Delivera-Leadership-Page-Render.js';
import { buildBoardSummaries } from './Delivera-Shared-Boards-Summary-Builder.js';

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
