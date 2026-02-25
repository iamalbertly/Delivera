export { populateBoardsPills, populateSprintsPills, populateProjectsPills, applyBoardsFilters, applySprintsFilters, applyFilters } from './Reporting-App-Report-Page-Filters-Pills-Manager.js';
export { renderProjectEpicLevelTab } from './Reporting-App-Report-Page-Render-Boards.js';
export { renderSprintsTab } from './Reporting-App-Report-Page-Render-Sprints.js';
export { renderDoneStoriesTab, toggleSprint } from './Reporting-App-Report-Page-Render-DoneStories.js';
export { renderUnusableSprintsTab } from './Reporting-App-Report-Page-Render-Unusable.js';
export { updateExportFilteredState } from './Reporting-App-Report-Page-Export-Menu.js';

import { renderLeadershipContent } from './Reporting-App-Leadership-Page-Render.js';

/**
 * Render the Leadership "Trends" view into the Report page tab.
 * This uses the same renderer as the standalone Leadership page
 * but targets the tab-trends / leadership-content container.
 */
export function renderTrendsTab(previewData) {
  if (!previewData) return;
  const container = document.getElementById('leadership-content');
  if (!container) return;
  renderLeadershipContent(previewData, container);
  let intro = container.querySelector('.trends-intro');
  if (!intro) {
    intro = document.createElement('p');
    intro.className = 'trends-intro';
    intro.innerHTML = '<small>Use Trends to answer leadership questions about change over time:</small><ul><li><small>Are delivery and predictability improving or slipping across sprints?</small></li><li><small>Which squads changed the most in throughput or rework in this window?</small></li><li><small>Where did risk or late scope spike compared with previous sprints?</small></li></ul>';
    container.prepend(intro);
  }
  try {
    if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) {
      container.querySelectorAll('details[data-mobile-collapse="true"]').forEach((el) => {
        el.open = false;
      });
    }
  } catch (_) {}

  const meta = previewData.meta || {};
  const isPartial = meta.partial === true;
  if (isPartial) {
    const existingNotice = container.querySelector('.trends-partial-notice');
    if (!existingNotice) {
      const notice = document.createElement('div');
      notice.className = 'trends-partial-notice';
      notice.setAttribute('role', 'status');
      notice.innerHTML = 'Trends are based on partial data. Wait for the full load or use a smaller date range for accurate grades.';
      const introEl = container.querySelector('.trends-intro');
      if (introEl && introEl.nextSibling) {
        container.insertBefore(notice, introEl.nextSibling);
      } else {
        container.prepend(notice);
      }
    }
  }
}
