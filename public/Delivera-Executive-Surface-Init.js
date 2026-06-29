import { buildContextSegmentList, getContextPieces, renderContextPartList } from './Delivera-Shared-Context-From-Storage.js';
import { initWorkDraftDrawer as initGlobalOutcomeModal } from './Delivera-Work-Draft-Canvas.js';
import { PROJECTS_SSOT_KEY, readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import { formatProjectsCsvForDisplay, ensureProjectCatalogLoaded } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';

const LAST_ROUTE_KEY = 'delivera.lastRoute.v1';
const ROUTE_LABELS = {
  '/governance': 'Brief',
  '/brief': 'Brief',
  '/current-sprint': 'Sprint',
  '/report': 'Evidence',
  '/leadership': 'Brief',
  '/dashboard': 'Today',
  '/home': 'Today',
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
  const btn = document.getElementById('surface-primary-cta');
  if (!btn) return;
  const last = readLastRoute();
  const path = last?.path || '/governance';
  const label = ROUTE_LABELS[path] || 'your last view';
  if (path !== '/governance') {
    btn.setAttribute('data-surface-nav', path);
    btn.textContent = `Continue to ${label}`;
  }
}

async function initHomeBriefMicro() {
  const micro = document.getElementById('surface-verdict-micro');
  if (!micro) return;
  const projects = readSelectedProjects();
  if (!projects.length) return;
  try {
    const qs = new URLSearchParams({ projects: projects.join(',') }).toString();
    const res = await fetch(`/api/governance-brief.json?${qs}`, { credentials: 'same-origin' });
    if (!res.ok) return;
    const brief = await res.json();
    const tier = brief?.executiveView?.verdictTier || brief?.meta?.verdictTier || 'watch';
    const sentence = brief?.meta?.commandAnswerSentence || brief?.leadershipNarrative?.meetingAnswer || '';
    micro.textContent = sentence ? `${String(tier).toUpperCase()} · ${sentence.slice(0, 120)}` : '';
    micro.hidden = !micro.textContent;
    const eyebrow = document.querySelector('.surface-eyebrow');
    if (eyebrow && tier) eyebrow.textContent = `Brief · ${String(tier).replace(/([A-Z])/g, ' $1').trim()}`;
  } catch (_) { /* non-blocking */ }
}

const readSelectedProjects = readSharedProjectsCsv;

function buildSurfaceSummary(projects) {
  const pageName = document.body.getAttribute('data-surface-name') || 'Executive surface';
  const keys = projects.map((p) => String(p).trim().toUpperCase()).filter(Boolean);
  const projectLabel = keys.length
    ? formatProjectsCsvForDisplay(keys.join(',')) || keys.join(', ')
    : 'No project focus selected';
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
    const isSettings = document.body?.classList?.contains('settings-page');
    summaryEl.textContent = isSettings ? '' : buildSurfaceSummary(projects);
    summaryEl.hidden = isSettings;
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
  return false;
}

try {
  const path = window.location.pathname || '';
  if (path && path !== '/dashboard' && path !== '/home') {
    persistLastRoute(path);
  }
} catch (_) {}

function initSurfacePage() {
  ensureProjectCatalogLoaded().finally(() => renderSurfaceContext());
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
    const [sprintRes, squadRes] = await Promise.all([
      fetch(`/api/current-sprint.json?${qs}`, { credentials: 'same-origin', signal: ctrl.signal }),
      fetch(`/api/leadership-summary.json?${qs}`, { credentials: 'same-origin', signal: ctrl.signal }).catch(() => null),
    ]);
    clearTimeout(timeout);
    if (!sprintRes.ok) return;
    const data = await sprintRes.json().catch(() => null);
    if (!data) return;
    let stalledCount = 0;
    if (squadRes?.ok) {
      const squadData = await squadRes.json().catch(() => null);
      stalledCount = Array.isArray(squadData?.squads)
        ? squadData.squads.filter((s) => s?.hasActiveSprintFallback).length
        : 0;
    }
    const noActive = data?.meta?.noActiveSprintFallback || data?.meta?.suggestStartSprint;
    if (stalledCount > 0 || noActive) {
      pulseEl.innerHTML = `
        <div class="home-sprint-pulse-inner home-sprint-pulse-inner--stalled">
          <span class="home-sprint-pulse-name">Team idle</span>
          <span class="home-sprint-pulse-risk">${stalledCount || 1} squad${(stalledCount || 1) > 1 ? 's' : ''} without active sprint</span>
          <a href="/current-sprint" class="home-sprint-pulse-cta">Open sprint cockpit →</a>
        </div>`;
      pulseEl.hidden = false;
      const continueBtn = document.getElementById('surface-primary-cta');
      if (continueBtn) {
        continueBtn.setAttribute('data-surface-nav', '/current-sprint');
        continueBtn.textContent = 'Resolve sprint stall';
        continueBtn.classList.add('btn-primary');
        continueBtn.classList.remove('btn-secondary');
      }
      return;
    }
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
  initHomeBriefMicro();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootExecutiveSurface);
} else {
  bootExecutiveSurface();
}
