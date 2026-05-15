import { buildContextSegmentList, getContextPieces, renderContextPartList } from './Delivera-Shared-Context-From-Storage.js';
import { initGlobalOutcomeModal } from './Delivera-Shared-Outcome-Modal.js';
import { PROJECTS_SSOT_KEY } from './Delivera-Shared-Storage-Keys.js';

const LAST_ROUTE_KEY = 'delivera.lastRoute.v1';
const ROUTE_LABELS = {
  '/current-sprint': 'Current Sprint',
  '/report': 'Delivery',
  '/leadership': 'Leadership',
  '/dashboard': 'Dashboard',
  '/home': 'Dashboard',
};

function readLastRoute() {
  try {
    const raw = window.localStorage.getItem(LAST_ROUTE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.path) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function persistLastRoute(path) {
  const normalized = String(path || '').trim();
  if (!normalized || normalized === '/dashboard' || normalized === '/home') return;
  try {
    window.localStorage.setItem(LAST_ROUTE_KEY, JSON.stringify({ path: normalized, at: Date.now() }));
  } catch (_) {}
}

function applyContinueCta() {
  const btn = document.getElementById('surface-continue-cta');
  if (!btn) return;
  const last = readLastRoute();
  const path = last?.path || '/current-sprint';
  const label = ROUTE_LABELS[path] || 'your last view';
  btn.setAttribute('data-surface-nav', path);
  btn.textContent = `Continue to ${label}`;
}

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
    persistLastRoute(href);
    window.location.href = href;
  });
}

try {
  const path = window.location.pathname || '';
  if (path && path !== '/dashboard' && path !== '/home') {
    persistLastRoute(path);
  }
} catch (_) {}

function initSurfacePage() {
  renderSurfaceContext();
  applyContinueCta();
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
