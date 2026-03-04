import { reportState } from './Reporting-App-Report-Page-State.js';
import { reportDom } from './Reporting-App-Report-Page-Context.js';
import { buildBoardSummaries } from './Reporting-App-Shared-Boards-Summary-Builder.js';
import { renderEmptyState } from './Reporting-App-Report-Page-Render-Helpers.js';
import { renderProjectEpicLevelTab } from './Reporting-App-Report-Page-Render-Boards.js';
import { renderSprintsTab } from './Reporting-App-Report-Page-Render-Sprints.js';
import { renderDoneStoriesTab } from './Reporting-App-Report-Page-Render-DoneStories.js';
import { updateExportFilteredState } from './Reporting-App-Report-Page-Export-Menu.js';

const REPORT_SEARCH_STORAGE_KEY = 'vodaAgileBoard_reportSearch_v1';
const REPORT_ACTIVE_TAB_SEARCH_KEY = 'vodaAgileBoard_reportSearch_active_v1';
const TAB_SEARCH_CONFIG = {
  'project-epic-level': { field: 'boards', placeholder: 'Search boards...' },
  sprints: { field: 'sprints', placeholder: 'Search sprints...' },
  'done-stories': { field: 'stories', placeholder: 'Search stories...' },
};

function getActiveTabName() {
  const btn = document.querySelector('.tab-btn.active');
  return btn?.dataset?.tab || 'project-epic-level';
}

function getUnifiedSearchInput() {
  return document.getElementById('report-tab-search');
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
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function readCurrentSearchState() {
  return {
    boards: document.getElementById('boards-search-box')?.value || '',
    sprints: document.getElementById('sprints-search-box')?.value || '',
    stories: document.getElementById('search-box')?.value || '',
  };
}

function persistSearchState() {
  try {
    const payload = readCurrentSearchState();
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

export function applyBoardsFilters() {
  const searchText = document.getElementById('boards-search-box')?.value || '';
  const activePills = Array.from(document.querySelectorAll('#boards-project-pills .pill.active')).map(p => p.dataset.project);
  reportState.visibleBoardRows = applyTabFilter(reportState.previewData?.boards || [], searchText, activePills, {
    projectKey: (board) => (board.projectKeys || []).join(','),
    searchText: (board) => `${board.name || ''} ${(board.projectKeys || []).join(',')}`,
  });
  renderProjectEpicLevelTab(reportState.visibleBoardRows, reportState.previewData?.metrics);
  updateExportFilteredState();
}

export function applySprintsFilters() {
  const searchText = document.getElementById('sprints-search-box')?.value || '';
  const activePills = Array.from(document.querySelectorAll('#sprints-project-pills .pill.active')).map(p => p.dataset.project);
  reportState.visibleSprintRows = applyTabFilter(reportState.previewData?.sprintsIncluded || [], searchText, activePills, {
    projectKey: (sprint) => (sprint.projectKey || ''),
    searchText: (sprint) => `${sprint.name || ''} ${sprint.projectKey || ''}`,
  });
  renderSprintsTab(reportState.visibleSprintRows, reportState.previewData?.metrics);
  updateExportFilteredState();
}

export function applyFilters() {
  const searchText = (document.getElementById('search-box')?.value || '').toLowerCase();
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
  const searchBox = document.getElementById('search-box');
  if (searchBox) searchBox.addEventListener('input', () => {
    applyFilters();
    persistSearchState();
  });
  const boardsSearchBox = document.getElementById('boards-search-box');
  if (boardsSearchBox) boardsSearchBox.addEventListener('input', () => {
    applyBoardsFilters();
    persistSearchState();
  });
  const sprintsSearchBox = document.getElementById('sprints-search-box');
  if (sprintsSearchBox) sprintsSearchBox.addEventListener('input', () => {
    applySprintsFilters();
    persistSearchState();
  });
  if (unifiedSearch) {
    unifiedSearch.addEventListener('input', () => {
      const tab = getActiveTabName();
      const cfg = TAB_SEARCH_CONFIG[tab] || TAB_SEARCH_CONFIG['project-epic-level'];
      const value = unifiedSearch.value || '';
      const state = readCurrentSearchState();
      state[cfg.field] = value;
      setLegacySearchValues(state);
      if (cfg.field === 'boards') applyBoardsFilters();
      if (cfg.field === 'sprints') applySprintsFilters();
      if (cfg.field === 'stories') applyFilters();
      persistSearchState();
    });
    window.addEventListener('report:active-tab-changed', () => {
      const activeTab = getActiveTabName();
      const cfg = TAB_SEARCH_CONFIG[activeTab] || TAB_SEARCH_CONFIG['project-epic-level'];
      const state = readCurrentSearchState();
      state[cfg.field] = '';
      setLegacySearchValues(state);
      persistSearchState();
      syncUnifiedSearchUi(state);
      if (cfg.field === 'boards') applyBoardsFilters();
      if (cfg.field === 'sprints') applySprintsFilters();
      if (cfg.field === 'stories') applyFilters();
      try { localStorage.setItem(REPORT_ACTIVE_TAB_SEARCH_KEY, activeTab); } catch (_) {}
    });
  }

  if (searchBox?.value) applyFilters();
  if (boardsSearchBox?.value) applyBoardsFilters();
  if (sprintsSearchBox?.value) applySprintsFilters();
  syncUnifiedSearchUi(readCurrentSearchState());
}
