import { currentSprintDom } from './Reporting-App-CurrentSprint-Page-Context.js';
import { SPRINT_COPY } from './Reporting-App-CurrentSprint-Copy.js';

export function updateHeader(sprint) {
  const { titleEl, nameEl } = currentSprintDom;
  const pageHeader = document.querySelector('header .current-sprint-header');
  if (!titleEl || !nameEl) return;

  if (!sprint) {
    document.body.classList.remove('current-sprint-has-live-content');
    pageHeader?.classList.remove('current-sprint-header-compact');
    titleEl.textContent = SPRINT_COPY.pageTitle;
    nameEl.textContent = '';
    return;
  }

  document.body.classList.add('current-sprint-has-live-content');
  pageHeader?.classList.add('current-sprint-header-compact');
  titleEl.textContent = SPRINT_COPY.pageTitle;
  nameEl.textContent = sprint.name ? '- ' + sprint.name : (sprint.id ? '- ' + sprint.id : '');
}
