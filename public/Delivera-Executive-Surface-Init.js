import { buildContextSegmentList, getContextPieces, renderContextPartList } from './Delivera-Shared-Context-From-Storage.js';
import { initGlobalOutcomeModal } from './Delivera-Shared-Outcome-Modal.js';
import { PROJECTS_SSOT_KEY } from './Delivera-Shared-Storage-Keys.js';

function readSelectedProjects() {
  try {
    return (window.localStorage.getItem(PROJECTS_SSOT_KEY) || '')
      .split(',')
      .map((value) => String(value || '').trim())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function buildSurfaceSummary(projects) {
  const pageName = document.body.getAttribute('data-surface-name') || 'Executive surface';
  const projectLabel = projects.length ? projects.join(', ') : 'No project focus selected';
  return `${pageName} aligned to customer outcomes, realistic decision-making, and faster trusted follow-through. Focus: ${projectLabel}.`;
}

function renderSurfaceContext() {
  const contextEl = document.getElementById('surface-context-bar');
  const summaryEl = document.getElementById('surface-summary-line');
  if (!contextEl && !summaryEl) return;
  const projects = readSelectedProjects();
  const segments = getContextPieces({
    projects: projects.join(', '),
    freshness: projects.length ? 'Using shared Delivera context' : 'Choose a report context for sharper decisions',
    freshnessIsStale: !projects.length,
  });
  const parts = buildContextSegmentList(segments);
  if (contextEl) {
    contextEl.innerHTML = renderContextPartList(parts, {
      className: 'surface-context-strip',
      segmentClass: 'surface-context-segment',
    });
  }
  if (summaryEl) {
    summaryEl.textContent = buildSurfaceSummary(projects);
  }
}

function initQuickNavigation() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-surface-nav]');
    if (!trigger) return;
    const href = trigger.getAttribute('data-surface-nav');
    if (!href) return;
    event.preventDefault();
    window.location.href = href;
  });
}

function initSurfacePage() {
  renderSurfaceContext();
  initQuickNavigation();
  initGlobalOutcomeModal({
    getSelectedProjects: () => {
      const selected = readSelectedProjects();
      return selected.length ? selected : ['MPSA'];
    },
    getOutcomeDraftContext: () => ({ boardId: null, quarterHint: '' }),
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSurfacePage);
} else {
  initSurfacePage();
}
