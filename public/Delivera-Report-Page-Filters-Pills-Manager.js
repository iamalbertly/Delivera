import { reportState } from './Delivera-Report-Page-State.js';
import { reportDom } from './Delivera-Report-Page-Context.js';
import { buildBoardSummaries } from './Delivera-Shared-Boards-Summary-Builder.js';
import { renderEmptyState } from './Delivera-Report-Page-Render-Helpers.js';
import { renderProjectEpicLevelTab } from './Delivera-Report-Page-Render-Boards.js';
import { renderSprintsTab } from './Delivera-Report-Page-Render-Sprints.js';
import { renderDoneStoriesTab } from './Delivera-Report-Page-Render-DoneStories.js';
import { updateExportFilteredState } from './Delivera-Report-Page-Export-Menu.js';
import { REPORT_SEARCH_STORAGE_KEY, REPORT_ACTIVE_TAB_SEARCH_KEY } from './Delivera-Shared-Storage-Keys.js';
const TAB_SEARCH_CONFIG = {
  'project-epic-level': { field: 'boards', placeholder: 'Search current view' },
  sprints: { field: 'sprints', placeholder: 'Search current view' },
  'done-stories': { field: 'stories', placeholder: 'Search current view' },
};

function getActiveTabName() {
  const btn = document.querySelector('.tab-btn.active');
  return btn?.dataset?.tab || 'project-epic-level';
}

function getUnifiedSearchInput() {
  return document.getElementById('report-tab-search');
}

function getStoredSearchState() {
  try {
    const raw = localStorage.getItem(REPORT_SEARCH_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      boards: typeof parsed?.boards === 'string' ? parsed.boards : '',
      sprints: typeof parsed?.sprints === 'string' ? parsed.sprints : '',
      stories: typeof parsed?.stories === 'string' ? parsed.stories : '',
    };
  } catch (_) {
    return { boards: '', sprints: '', stories: '' };
  }
}

function setLegacySearchValues(values) {
  const boardsSearch = document.getElementById('boards-search-box');
  const sprintsSearch = document.getElementById('sprints-search-box');
  const storiesSearch = document.getElementById('search-box');
  if (boardsSearch) boardsSearch.value = values.boards || '';
  if (sprintsSearch) sprintsSearch.value = values.sprints || '';
  if (storiesSearch) storiesSearch.value = values.stories || '';
}

function syncUnifiedSearchUi(searchState) {
  const input = getUnifiedSearchInput();
  if (!input) return;
  const activeTab = getActiveTabName();
  const cfg = TAB_SEARCH_CONFIG[activeTab] || TAB_SEARCH_CONFIG['project-epic-level'];
  input.placeholder = cfg.placeholder;
  input.value = String(searchState[cfg.field] || '');
}

function readCurrentSearchState() {
  const input = getUnifiedSearchInput();
  const tab = getActiveTabName();
  const cfg = TAB_SEARCH_CONFIG[tab] || TAB_SEARCH_CONFIG['project-epic-level'];
  const state = getStoredSearchState();
  state[cfg.field] = input?.value || state[cfg.field] || '';
  return state;
}

function persistSearchState(stateOverride = null) {
  try {
    const payload = stateOverride || readCurrentSearchState();
    localStorage.setItem(REPORT_SEARCH_STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}
}

function hydrateSearchState() {
  try {
    const raw = localStorage.getItem(REPORT_SEARCH_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    setLegacySearchValues({
      boards: typeof saved?.boards === 'string' ? saved.boards : '',
      sprints: typeof saved?.sprints === 'string' ? saved.sprints : '',
      stories: typeof saved?.stories === 'string' ? saved.stories : '',
    });
    syncUnifiedSearchUi(readCurrentSearchState());
  } catch (_) {}
}

function applyTabFilter(allItems, searchText, activePills, config) {
  const lower = (searchText || '').toLowerCase();
  let filtered = allItems;
  if (activePills.length > 0) {
    filtered = filtered.filter((item) => activePills.includes(config.projectKey(item)));
  }
  if (lower) {
    filtered = filtered.filter((item) => config.searchText(item).toLowerCase().includes(lower));
  }
  return filtered;
}

export function applyBoardsFilters(searchStateOverride = null) {
  const searchState = searchStateOverride || getStoredSearchState();
  const searchText = searchState.boards;
  const activePills = Array.from(document.querySelectorAll('#boards-project-pills .pill.active')).map(p => p.dataset.project);
  reportState.visibleBoardRows = applyTabFilter(reportState.previewData?.boards || [], searchText, activePills, {
    projectKey: (board) => (board.projectKeys || []).join(','),
    searchText: (board) => `${board.name || ''} ${(board.projectKeys || []).join(',')}`,
  });
  renderProjectEpicLevelTab(reportState.visibleBoardRows, reportState.previewData?.metrics);
  updateExportFilteredState();
}

export function applySprintsFilters(searchStateOverride = null) {
  const searchState = searchStateOverride || getStoredSearchState();
  const searchText = searchState.sprints;
  const activePills = Array.from(document.querySelectorAll('#sprints-project-pills .pill.active')).map(p => p.dataset.project);
  reportState.visibleSprintRows = applyTabFilter(reportState.previewData?.sprintsIncluded || [], searchText, activePills, {
    projectKey: (sprint) => (sprint.projectKey || ''),
    searchText: (sprint) => `${sprint.name || ''} ${sprint.projectKey || ''}`,
  });
  renderSprintsTab(reportState.visibleSprintRows, reportState.previewData?.metrics);
  updateExportFilteredState();
}

export function applyFilters(searchStateOverride = null) {
  const searchState = searchStateOverride || getStoredSearchState();
  const searchText = (searchState.stories || '').toLowerCase();
  const activePills = Array.from(document.querySelectorAll('#project-pills .pill.active')).map(p => p.dataset.project);
  reportState.visibleRows = applyTabFilter(reportState.previewRows || [], searchText, activePills, {
    projectKey: (row) => row.projectKey || '',
    searchText: (row) => `${row.issueKey || ''} ${row.issueSummary || ''} ${row.issueStatus || ''}`,
  });
  renderDoneStoriesTab(reportState.visibleRows);
  updateExportFilteredState();
}

export function populateBoardsPills() {
  const container = document.getElementById('boards-project-pills');
  if (!container) return;
  const projects = new Set();
  (reportState.previewData?.boards || []).forEach(board => {
    (board.projectKeys || []).forEach(key => projects.add(key));
  });
  container.innerHTML = '';
  Array.from(projects).sort().forEach(project => {
    const pill = document.createElement('button');
    pill.className = 'pill';
    pill.dataset.project = project;
    pill.textContent = project;
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
      applyBoardsFilters();
    });
    container.appendChild(pill);
  });
}

export function populateSprintsPills() {
  const container = document.getElementById('sprints-project-pills');
  if (!container) return;
  const projects = new Set();
  (reportState.previewData?.sprintsIncluded || []).forEach(sprint => {
    if (sprint.projectKey) projects.add(sprint.projectKey);
  });
  container.innerHTML = '';
  Array.from(projects).sort().forEach(project => {
    const pill = document.createElement('button');
    pill.className = 'pill';
    pill.dataset.project = project;
    pill.textContent = project;
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
      applySprintsFilters();
    });
    container.appendChild(pill);
  });
}

export function populateProjectsPills() {
  const container = document.getElementById('project-pills');
  if (!container) return;
  const projects = new Set();
  (reportState.previewRows || []).forEach(row => {
    if (row.projectKey) projects.add(row.projectKey);
  });
  container.innerHTML = '';
  Array.from(projects).sort().forEach(project => {
    const pill = document.createElement('button');
    pill.className = 'pill';
    pill.dataset.project = project;
    pill.textContent = project;
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
      applyFilters();
    });
    container.appendChild(pill);
  });
}

export function initFilters() {
  hydrateSearchState();
  const unifiedSearch = getUnifiedSearchInput();
  if (unifiedSearch) {
    unifiedSearch.addEventListener('input', () => {
      const tab = getActiveTabName();
      const cfg = TAB_SEARCH_CONFIG[tab] || TAB_SEARCH_CONFIG['project-epic-level'];
      const value = unifiedSearch.value || '';
      const state = readCurrentSearchState();
      state[cfg.field] = value;
      setLegacySearchValues(state);
      persistSearchState(state);
      if (cfg.field === 'boards') applyBoardsFilters(state);
      if (cfg.field === 'sprints') applySprintsFilters(state);
      if (cfg.field === 'stories') applyFilters(state);
    });
    window.addEventListener('report:active-tab-changed', () => {
      const activeTab = getActiveTabName();
      const cfg = TAB_SEARCH_CONFIG[activeTab] || TAB_SEARCH_CONFIG['project-epic-level'];
      const state = getStoredSearchState();
      syncUnifiedSearchUi(state);
      if (cfg.field === 'boards') applyBoardsFilters();
      if (cfg.field === 'sprints') applySprintsFilters();
      if (cfg.field === 'stories') applyFilters();
      try { localStorage.setItem(REPORT_ACTIVE_TAB_SEARCH_KEY, activeTab); } catch (_) {}
    });
  }

  syncUnifiedSearchUi(readCurrentSearchState());
  applyBoardsFilters();
  applySprintsFilters();
  applyFilters();
}
