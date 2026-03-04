import { currentSprintDom } from './Reporting-App-CurrentSprint-Page-Context.js';

export function updateHeader(sprint) {
  const { titleEl, nameEl, subtitleEl } = currentSprintDom;
  const pageHeader = document.querySelector('header .current-sprint-header');
  if (!titleEl || !nameEl) return;

  if (!sprint) {
    document.body.classList.remove('current-sprint-has-live-content');
    pageHeader?.classList.remove('current-sprint-header-compact');
    titleEl.textContent = 'Current Sprint';
    nameEl.textContent = '';
    if (subtitleEl) subtitleEl.textContent = 'Squad view - planned vs observed work, daily completion, scope changes';
    return;
  }

  document.body.classList.add('current-sprint-has-live-content');
  pageHeader?.classList.add('current-sprint-header-compact');
  titleEl.textContent = 'Current Sprint';
  nameEl.textContent = sprint.name ? '- ' + sprint.name : (sprint.id ? '- ' + sprint.id : '');
  if (subtitleEl) subtitleEl.textContent = 'Sprint transparency snapshot (' + (sprint.state || 'unknown') + ')';
}
