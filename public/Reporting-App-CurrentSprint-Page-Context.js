import { PROJECTS_SSOT_KEY, CURRENT_SPRINT_BOARD_KEY, CURRENT_SPRINT_SPRINT_KEY, CURRENT_SPRINT_SPRINT_SELECTED_AT_KEY } from './Reporting-App-Shared-Storage-Keys.js';

export const currentSprintDom = {
  projectsSelect: document.getElementById('current-sprint-projects'),
  boardSelect: document.getElementById('board-select'),
  loadingEl: document.getElementById('current-sprint-loading'),
  errorEl: document.getElementById('current-sprint-error'),
  contentEl: document.getElementById('current-sprint-content'),
  titleEl: document.getElementById('current-sprint-title'),
  nameEl: document.getElementById('current-sprint-name'),
  subtitleEl: document.getElementById('current-sprint-subtitle'),
};

export const currentSprintKeys = {
  projectsKey: PROJECTS_SSOT_KEY,
  boardKey: CURRENT_SPRINT_BOARD_KEY,
  sprintKey: CURRENT_SPRINT_SPRINT_KEY,
  sprintTsKey: CURRENT_SPRINT_SPRINT_SELECTED_AT_KEY,
};
