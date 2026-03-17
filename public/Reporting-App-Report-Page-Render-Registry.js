export { populateBoardsPills, populateSprintsPills, populateProjectsPills, applyBoardsFilters, applySprintsFilters, applyFilters } from './Reporting-App-Report-Page-Filters-Pills-Manager.js';
export { renderProjectEpicLevelTab } from './Reporting-App-Report-Page-Render-Boards.js';
export { renderSprintsTab } from './Reporting-App-Report-Page-Render-Sprints.js';
export { renderDoneStoriesTab, toggleSprint } from './Reporting-App-Report-Page-Render-DoneStories.js';
export { renderUnusableSprintsTab } from './Reporting-App-Report-Page-Render-Unusable.js';
export { updateExportFilteredState } from './Reporting-App-Report-Page-Export-Menu.js';

export function renderTrendsTab(previewData) {
  const container = document.getElementById('leadership-content');
  if (!container) return;
  const meta = previewData?.meta || {};
  const projectLabel = Array.isArray(meta.selectedProjects) && meta.selectedProjects.length
    ? meta.selectedProjects.join(', ')
    : (meta.projects || 'Selected portfolio');
  const start = meta.windowStart ? String(meta.windowStart).slice(0, 10) : '';
  const end = meta.windowEnd ? String(meta.windowEnd).slice(0, 10) : '';
  const boards = Array.isArray(previewData?.boards) ? previewData.boards.length : 0;
  const outcomes = Array.isArray(previewData?.rows) ? previewData.rows.length : 0;
  const unusable = Array.isArray(previewData?.sprintsUnusable) ? previewData.sprintsUnusable.length : 0;
  const partial = meta.partial === true;
  const statusLine = partial
    ? 'Partial window. Leadership HUD carries the same scope with the full trust and anomaly breakdown.'
    : 'Same scope, tighter leadership view.';
  container.innerHTML = ''
    + '<section class="transparency-card leadership-bridge-card leadership-bridge-card-compact" aria-label="Leadership snapshot">'
    + '<div class="leadership-bridge-copy leadership-bridge-copy-row"><strong>Leadership HUD</strong><span>' + statusLine + '</span></div>'
    + '<div class="leadership-bridge-metrics leadership-bridge-metrics-compact">'
    + '<span><strong>' + boards + '</strong> boards</span>'
    + '<span><strong>' + outcomes + '</strong> outcomes</span>'
    + '<span><strong>' + unusable + '</strong> repair items</span>'
    + '<span><strong>' + projectLabel + '</strong>' + (start && end ? ' · ' + start + ' - ' + end : '') + '</span>'
    + '</div>'
    + '<div class="leadership-bridge-actions">'
    + '<a class="btn btn-primary btn-compact" href="/leadership">Open Leadership HUD</a>'
    + '<a class="btn btn-secondary btn-compact" href="/current-sprint">Open current sprint</a>'
    + '</div>'
    + '</section>';
}
