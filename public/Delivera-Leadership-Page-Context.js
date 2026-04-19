import { PROJECTS_SSOT_KEY, LEADERSHIP_FILTERS_KEY } from './Reporting-App-Shared-Storage-Keys.js';

export const leadershipDom = {
  projectsSelect: document.getElementById('leadership-projects'),
  startInput: document.getElementById('leadership-start'),
  endInput: document.getElementById('leadership-end'),
  previewBtn: document.getElementById('leadership-preview'),
  loadingEl: document.getElementById('leadership-loading'),
  errorEl: document.getElementById('leadership-error'),
  contentEl: document.getElementById('leadership-content'),
};

export const leadershipKeys = {
  storageKey: LEADERSHIP_FILTERS_KEY,
  projectsKey: PROJECTS_SSOT_KEY,
};
