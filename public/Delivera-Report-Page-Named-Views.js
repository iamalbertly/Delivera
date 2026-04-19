import {
  REPORT_LAST_VIEW_KEY,
  REPORT_NAMED_VIEWS_KEY,
} from './Reporting-App-Shared-Storage-Keys.js';

const DEFAULT_REPORT_VIEWS = [
  {
    id: 'leadership-snapshot',
    label: 'Leadership snapshot',
    projects: ['MPSA', 'MAS'],
    predictability: true,
    predictabilityMode: 'strict',
    requireResolvedBySprintEnd: false,
    includeActiveOrMissingEndDateSprints: false,
  },
  {
    id: 'quarterly-board',
    label: 'Quarterly board',
    projects: ['MPSA', 'MAS', 'SD'],
    predictability: true,
    predictabilityMode: 'approx',
    requireResolvedBySprintEnd: false,
    includeActiveOrMissingEndDateSprints: true,
  },
  {
    id: 'resolved-only',
    label: 'Resolved only',
    projects: ['MPSA', 'MAS'],
    predictability: false,
    requireResolvedBySprintEnd: true,
    includeActiveOrMissingEndDateSprints: false,
  },
];

function readSavedViews() {
  try {
    const raw = localStorage.getItem(REPORT_NAMED_VIEWS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeSavedViews(views) {
  try {
    localStorage.setItem(REPORT_NAMED_VIEWS_KEY, JSON.stringify(views));
  } catch (_) {}
}

function setChecked(id, checked) {
  const input = document.getElementById(id);
  if (input) input.checked = !!checked;
}

export function applyReportNamedView(view) {
  if (!view) return;
  const projects = Array.isArray(view.projects) ? view.projects : [];
  document.querySelectorAll('.project-checkbox[data-project]').forEach((input) => {
    input.checked = projects.includes(input.dataset.project);
  });
  setChecked('include-predictability', view.predictability === true);
  const mode = document.querySelector(`input[name="predictability-mode"][value="${view.predictabilityMode || 'approx'}"]`);
  if (mode) mode.checked = true;
  setChecked('require-resolved-by-sprint-end', view.requireResolvedBySprintEnd === true);
  setChecked('include-active-or-missing-end-date-sprints', view.includeActiveOrMissingEndDateSprints === true);
  try {
    localStorage.setItem(REPORT_LAST_VIEW_KEY, view.id || '');
  } catch (_) {}
}

export function getAllReportNamedViews() {
  const saved = readSavedViews();
  return [...DEFAULT_REPORT_VIEWS, ...saved];
}

export function renderReportNamedViewsBar() {
  const views = getAllReportNamedViews();
  const lastView = (() => {
    try { return localStorage.getItem(REPORT_LAST_VIEW_KEY) || ''; } catch (_) { return ''; }
  })();
  return ''
    + '<section class="named-views-bar" aria-label="Named views">'
    + views.map((view) => {
      const active = lastView && lastView === view.id;
      return `<button type="button" class="named-view-chip${active ? ' is-active' : ''}" data-report-view-id="${view.id}" data-report-named-view="${view.id}">${view.label}</button>`;
    }).join('')
    + '<button type="button" class="named-view-chip named-view-chip-save" data-report-view-save>Save current view</button>'
    + '</section>';
}

export function wireReportNamedViews({ onChange } = {}) {
  document.addEventListener('click', (event) => {
    const viewBtn = event.target?.closest?.('[data-report-view-id]');
    if (viewBtn) {
      const id = viewBtn.getAttribute('data-report-view-id');
      const view = getAllReportNamedViews().find((item) => item.id === id);
      applyReportNamedView(view);
      if (typeof onChange === 'function') onChange(view);
      return;
    }
    const saveBtn = event.target?.closest?.('[data-report-view-save]');
    if (!saveBtn) return;
    const saved = readSavedViews();
    const nextIndex = saved.length + 1;
    const projects = Array.from(document.querySelectorAll('.project-checkbox[data-project]:checked')).map((input) => input.dataset.project);
    const current = {
      id: `saved-view-${Date.now()}`,
      label: `Saved view ${nextIndex}`,
      projects,
      predictability: document.getElementById('include-predictability')?.checked === true,
      predictabilityMode: document.querySelector('input[name="predictability-mode"]:checked')?.value || 'approx',
      requireResolvedBySprintEnd: document.getElementById('require-resolved-by-sprint-end')?.checked === true,
      includeActiveOrMissingEndDateSprints: document.getElementById('include-active-or-missing-end-date-sprints')?.checked === true,
    };
    writeSavedViews([...saved, current]);
    try { localStorage.setItem(REPORT_LAST_VIEW_KEY, current.id); } catch (_) {}
    if (typeof onChange === 'function') onChange(current);
  });
}
