import { buildContextSegmentList, getContextPieces, renderContextPartList } from './Delivera-Shared-Context-From-Storage.js';
import { initWorkDraftDrawer as initGlobalOutcomeModal } from './Delivera-Work-Draft-Canvas.js';
import { PROJECTS_SSOT_KEY, readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';

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

const readSelectedProjects = readSharedProjectsCsv;

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
    contextEl.innerHTML = projects.length
      ? ''
      : renderContextPartList(parts, {
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

const EXECUTIVE_SHELL_REDIRECTS = {
  '/risks-blockers': '/current-sprint#stuck-card',
  '/teams': '/current-sprint',
};

function maybeRedirectExecutiveShell() {
  try {
    const path = window.location.pathname || '';
    const target = EXECUTIVE_SHELL_REDIRECTS[path];
    if (!target) return false;
    document.body.setAttribute('aria-hidden', 'true');
    window.location.replace(target);
    return true;
  } catch (_) {
    return false;
  }
}

function maybeRedirectDashboardToLastRoute() {
  try {
    const path = window.location.pathname || '';
    if (path !== '/dashboard' && path !== '/home') return false;
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('stay') === '1') return false;
    const last = readLastRoute();
    if (!last?.path || last.path === '/dashboard' || last.path === '/home') return false;
    window.location.replace(last.path);
    return true;
  } catch (_) {
    return false;
  }
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
    getSelectedProjects: readSelectedProjects,
    getOutcomeDraftContext: () => ({ boardId: null, quarterHint: '' }),
  });
}

async function initHomeDashboardSprintPulse() {
  const pulseEl = document.getElementById('home-sprint-pulse');
  if (!pulseEl) return;
  const projects = readSelectedProjects();
  if (!projects.length) return;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 5000);
  try {
    const qs = new URLSearchParams({ projects: projects.join(',') }).toString();
    const res = await fetch(`/api/current-sprint.json?${qs}`, { credentials: 'same-origin', signal: ctrl.signal });
    clearTimeout(timeout);
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (!data) return;
    const sprintName = data.sprint?.name || 'Active sprint';
    const totalStories = (data.stories || []).length;
    const doneStories = (data.stories || []).filter((s) => String(s?.status || '').toLowerCase().includes('done')).length;
    const pct = totalStories > 0 ? Math.round((doneStories / totalStories) * 100) : 0;
    const blockersOwned = data.risks?.blockersOwned ?? 0;
    pulseEl.innerHTML = `
      <div class="home-sprint-pulse-inner">
        <span class="home-sprint-pulse-name">${sprintName}</span>
        <span class="home-sprint-pulse-pct home-sprint-pulse-pct--${pct >= 70 ? 'good' : pct >= 40 ? 'mid' : 'low'}">${pct}% done</span>
        <span class="home-sprint-pulse-stories">${totalStories} items</span>
        ${blockersOwned > 0 ? `<span class="home-sprint-pulse-risk">${blockersOwned} blockers</span>` : ''}
        <a href="/current-sprint" class="home-sprint-pulse-cta">Open sprint →</a>
      </div>`;
    pulseEl.hidden = false;
  } catch (_) {
    clearTimeout(timeout);
  }
}

function bootExecutiveSurface() {
  if (maybeRedirectExecutiveShell() || maybeRedirectDashboardToLastRoute()) return;
  initSurfacePage();
  initHomeDashboardSprintPulse();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootExecutiveSurface);
} else {
  bootExecutiveSurface();
}
