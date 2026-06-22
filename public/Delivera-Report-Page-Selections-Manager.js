import { reportDom } from './Delivera-Report-Page-Context.js';
import { PROJECTS_SSOT_KEY, REPORT_ADVANCED_OPTIONS_OPEN_KEY } from './Delivera-Shared-Storage-Keys.js';
import { hydrateReportProjectCheckboxes } from './Delivera-Report-Projects-Catalog-01Hydrate.js';
import { notifyScopeChanged } from './Delivera-Shared-Scope-Notify-01Bridge.js';

export function getSelectedProjects() {
  return Array.from(document.querySelectorAll('.project-checkbox[data-project]:checked'))
    .map(input => input.dataset.project)
    .filter(Boolean);
}

export function persistSelectedProjects() {
  try {
    const value = getSelectedProjects().join(',');
    if (value) {
      const prev = localStorage.getItem(PROJECTS_SSOT_KEY);
      localStorage.setItem(PROJECTS_SSOT_KEY, value);
      if (prev !== value) notifyScopeChanged();
    }
  } catch (_) {}
}

/**
 * Updates preview button disabled/title from project selection.
 * When onPreviewButtonSync is provided (by Init), it is called so the single source of truth
 * (refreshPreviewButtonLabel) also updates label and date-validity state.
 */
export function updatePreviewButtonState(onPreviewButtonSync = null) {
  persistSelectedProjects();
  if (typeof onPreviewButtonSync === 'function') {
    onPreviewButtonSync();
    return;
  }
  const { previewBtn } = reportDom;
  if (!previewBtn) return;
  const hasProject = getSelectedProjects().length > 0;
  previewBtn.disabled = !hasProject;
  previewBtn.title = hasProject ? '' : 'Please select at least one project.';
}

function updateProjectSelectionStatus() {
  const statusEl = document.getElementById('projects-selection-status');
  if (!statusEl) return;
  const total = document.querySelectorAll('.project-checkbox[data-project]').length;
  const selected = getSelectedProjects().length;
  statusEl.textContent = `${selected} of ${total} projects selected`;
}

function initProjectSearch() {
  const searchInput = document.getElementById('project-search');
  const noMatchEl = document.getElementById('projects-no-match');
  if (!searchInput) return;
  const labels = Array.from(document.querySelectorAll('.filters-panel .checkbox-label'));
  const applyFilter = () => {
    const query = (searchInput.value || '').trim().toLowerCase();
    let visible = 0;
    labels.forEach(label => {
      const text = (label.textContent || '').toLowerCase();
      const match = !query || text.includes(query);
      label.style.display = match ? '' : 'none';
      if (match) visible += 1;
    });
    if (noMatchEl) {
      noMatchEl.style.display = visible === 0 ? 'block' : 'none';
    }
  };
  searchInput.addEventListener('input', applyFilter);
  applyFilter();
}

function initAdvancedOptionsToggle() {
  const tile = document.getElementById('report-rules-tile');
  const toggleBtn = document.getElementById('advanced-options-toggle');
  const panel = document.getElementById('advanced-options');
  if (!panel) return;
  if (toggleBtn) {
    const primaryLabel = toggleBtn.querySelector('span');
    const setOpen = (open) => {
      if (tile instanceof HTMLDetailsElement) tile.open = open;
      panel.hidden = !open;
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (primaryLabel) primaryLabel.textContent = open ? 'Hide advanced' : 'Rules & strictness';
      try { localStorage.setItem(REPORT_ADVANCED_OPTIONS_OPEN_KEY, open ? '1' : '0'); } catch (_) {}
    };
    let shouldOpen = false;
    try {
      shouldOpen = localStorage.getItem(REPORT_ADVANCED_OPTIONS_OPEN_KEY) === '1';
    } catch (_) {}
    setOpen(shouldOpen);
    toggleBtn.addEventListener('click', (event) => {
      event.preventDefault();
      const isOpen = toggleBtn.getAttribute('aria-expanded') === 'true';
      setOpen(!isOpen);
    });
    if (tile instanceof HTMLDetailsElement) {
      tile.addEventListener('toggle', () => {
        const open = tile.open;
        if ((toggleBtn.getAttribute('aria-expanded') === 'true') !== open) {
          setOpen(open);
        }
      });
    }
  } else {
    panel.hidden = false;
  }
}

export function initProjectSelection() {
  hydrateReportProjectCheckboxes().then(() => {
    try {
      const stored = localStorage.getItem(PROJECTS_SSOT_KEY);
      if (stored && typeof stored === 'string') {
        const list = stored.split(',').map(p => (p || '').trim()).filter(Boolean);
        document.querySelectorAll('.project-checkbox[data-project]').forEach(input => {
          const project = input.dataset?.project || '';
          input.checked = list.includes(project);
        });
      }
    } catch (_) {}
    document.querySelectorAll('.project-checkbox[data-project]').forEach(input => {
      input.addEventListener('change', () => {
        updatePreviewButtonState(window.__reportPreviewButtonSync);
        updateProjectSelectionStatus();
      });
    });
    updatePreviewButtonState(window.__reportPreviewButtonSync);
    updateProjectSelectionStatus();
  });
  initProjectSearch();
  initAdvancedOptionsToggle();

  const predictabilityCheckbox = document.getElementById('include-predictability');
  const predictabilityModeGroup = document.getElementById('predictability-mode-group');
  if (predictabilityCheckbox && predictabilityModeGroup) {
    const applyVisibility = () => {
      predictabilityModeGroup.style.display = predictabilityCheckbox.checked ? 'block' : 'none';
    };
    predictabilityCheckbox.addEventListener('change', applyVisibility);
    applyVisibility();
  }
}
