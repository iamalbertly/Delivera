import { currentSprintDom } from './Reporting-App-CurrentSprint-Page-Context.js';

export function updateHeader(sprint) {
  const { titleEl, nameEl, subtitleEl } = currentSprintDom;
  if (!titleEl || !nameEl) return;

  if (!sprint) {
    titleEl.textContent = 'Current Sprint';
    nameEl.textContent = '';
    if (subtitleEl) subtitleEl.textContent = 'Squad view - planned vs observed work, daily completion, scope changes';
    return;
  }

  titleEl.textContent = 'Current Sprint';
  nameEl.textContent = sprint.name ? '- ' + sprint.name : (sprint.id ? '- ' + sprint.id : '');
  if (subtitleEl) subtitleEl.textContent = 'Sprint transparency snapshot (' + (sprint.state || 'unknown') + ')';
}
