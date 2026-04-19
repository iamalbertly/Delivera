import { leadershipDom, leadershipKeys } from './Reporting-App-Leadership-Page-Context.js';
import { renderLeadershipPage } from './Reporting-App-Leadership-Page-Render.js';
import { buildBoardSummaries } from './Reporting-App-Shared-Boards-Summary-Builder.js';
import { initQuarterStrip } from './Reporting-App-Shared-Quarter-Range-Helpers.js';
import { SHARED_DATE_RANGE_KEY } from './Reporting-App-Shared-Storage-Keys.js';
import { AUTO_PREVIEW_DELAY_MS } from './Reporting-App-Shared-AutoPreview-Config.js';
import { getValidLastQuery, getFallbackContext } from './Reporting-App-Shared-Context-From-Storage.js';
import { showLoadingView, showErrorView, clearErrorView, showContentView } from './Reporting-App-Shared-Status-View-Helpers.js';
import { startRotatingMessages, stopRotatingMessages } from './Reporting-App-Shared-Loading-Theater.js';

const LEADERSHIP_FILTERS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function parseLeadershipFilters(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.payload && typeof parsed.savedAt === 'number') {
      if ((Date.now() - parsed.savedAt) > LEADERSHIP_FILTERS_TTL_MS) return null;
      return parsed.payload;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

function setDefaultDates() {
  const { startInput, endInput } = leadershipDom;
  if (!startInput || !endInput) return;
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 3);
  startInput.value = start.toISOString().slice(0, 10);
  endInput.value = end.toISOString().slice(0, 10);
}

function loadSavedFilters() {
  const { projectsSelect, startInput, endInput } = leadershipDom;
  const { storageKey, projectsKey } = leadershipKeys;
  try {
    const ssotProjects = localStorage.getItem(projectsKey);
    if (ssotProjects && projectsSelect) {
      const val = String(ssotProjects).trim();
      const options = Array.from(projectsSelect.options);
      const hasOption = options.some(o => o.value === val);
      if (hasOption) {
        projectsSelect.value = val;
      } else if (val) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = 'Current: ' + val.replace(/,/g, ', ');
        projectsSelect.appendChild(opt);
        projectsSelect.value = val;
      }
    }
    const sharedRangeRaw = localStorage.getItem(SHARED_DATE_RANGE_KEY);
    if (sharedRangeRaw) {
      const shared = JSON.parse(sharedRangeRaw);
      if (shared?.start && startInput) startInput.value = String(shared.start).slice(0, 10);
      if (shared?.end && endInput) endInput.value = String(shared.end).slice(0, 10);
      return true;
    }
    const raw = localStorage.getItem(storageKey);
    if (!raw) return Boolean(ssotProjects);
    const saved = parseLeadershipFilters(raw);
    if (!saved) {
      localStorage.removeItem(storageKey);
      return Boolean(ssotProjects);
    }
    if (saved?.projects && projectsSelect) {
      projectsSelect.value = saved.projects;
    }
    if (saved?.start && startInput) {
      startInput.value = saved.start;
    }
    if (saved?.end && endInput) {
      endInput.value = saved.end;
    }
    return Boolean(saved?.start || saved?.end || saved?.projects);
  } catch (_) {
    return false;
  }
}

function saveFilters() {
  const { projectsSelect, startInput, endInput } = leadershipDom;
  const { storageKey, projectsKey } = leadershipKeys;
  try {
    const projectsVal = projectsSelect?.value || '';
    if (projectsVal) localStorage.setItem(projectsKey, projectsVal);
    const payload = {
      projects: projectsVal,
      start: startInput?.value || '',
      end: endInput?.value || '',
    };
      localStorage.setItem(storageKey, JSON.stringify({
        savedAt: Date.now(),
        payload,
      }));
    if (payload.start && payload.end) {
      localStorage.setItem(SHARED_DATE_RANGE_KEY, JSON.stringify({
        start: payload.start + 'T00:00:00.000Z',
        end: payload.end + 'T23:59:59.999Z',
      }));
    }
  } catch (_) {}
}

const LEADERSHIP_LOADING_MESSAGES = ['Fetching quarter data...', 'Computing trends...', 'Preparing view...'];

function showLoading(msg) {
  stopRotatingMessages();
  showLoadingView(leadershipDom, msg || 'Loading...');
  if (leadershipDom.loadingEl) {
    startRotatingMessages(leadershipDom.loadingEl, LEADERSHIP_LOADING_MESSAGES, 1200);
  }
}

function showError(msg) {
  stopRotatingMessages();
  showErrorView(leadershipDom, msg);
}

function clearError() {
  clearErrorView(leadershipDom);
}

function showContent(html) {
  stopRotatingMessages();
  showContentView(leadershipDom, html);
}

function buildPreviewUrl() {
  const { projectsSelect, startInput, endInput } = leadershipDom;
  const projects = (projectsSelect?.value || 'MPSA,MAS').trim();
  const start = startInput?.value || '';
  const end = endInput?.value || '';
  const startISO = start ? new Date(start + 'T00:00:00.000Z').toISOString() : '';
  const endISO = end ? new Date(end + 'T23:59:59.999Z').toISOString() : '';
  const params = new URLSearchParams({
    projects,
    start: startISO,
    end: endISO,
    includeStoryPoints: 'true',
    includeBugsForRework: 'true',
    includePredictability: 'true',
    includeEpicTTM: 'true',
    includeQuarterlyKpiSummary: 'true',
  });
  return '/preview.json?' + params.toString();
}

function setQuarterStripEnabled(enabled) {
  document.querySelectorAll('.quarter-pill').forEach(b => { b.disabled = !enabled; });
}

let leadershipRequestSeq = 0;
let leadershipInFlightController = null;
let retryLeadershipIntent = () => {};

async function loadPreview() {
  const { startInput, endInput, projectsSelect } = leadershipDom;
  const startVal = startInput?.value || '';
  const endVal = endInput?.value || '';
  if (!startVal || !endVal || startVal > endVal) {
    showError({
      title: 'Invalid date range.',
      message: 'Start date must be before end date.',
      primaryLabel: 'Retry preview',
      primaryAction: 'retry-leadership-preview',
    });
    return;
  }
  const url = buildPreviewUrl();
  saveFilters();
  showLoading('Loading preview...');
  retryLeadershipIntent = () => loadPreview();
  leadershipRequestSeq += 1;
  const requestId = leadershipRequestSeq;
  if (leadershipInFlightController) {
    try { leadershipInFlightController.abort(); } catch (_) {}
  }
  leadershipInFlightController = new AbortController();
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: leadershipInFlightController.signal,
    });
    if (requestId !== leadershipRequestSeq) return;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        showError({
          title: 'Session expired.',
          message: 'Sign in again to continue.',
          primaryLabel: 'Retry preview',
          primaryAction: 'retry-leadership-preview',
        });
        const errorEl = document.getElementById('leadership-error');
        if (errorEl) {
          const link = document.createElement('a');
          link.href = '/?redirect=/sprint-leadership';
          link.className = 'nav-link';
          link.textContent = 'Sign in';
          link.style.marginLeft = '4px';
          errorEl.appendChild(link);
        }
        setQuarterStripEnabled(true);
        return;
      }
      const msg = (body && (body.message || body.error)) || response.statusText || 'Preview failed';
      throw new Error(msg);
    }
    const boards = body.boards || [];
    const sprintsIncluded = body.sprintsIncluded || [];
    const rows = body.rows || [];
    const meta = body.meta || {};
    if (!boards || boards.length === 0 || (sprintsIncluded && sprintsIncluded.length === 0)) {
      showError({
        title: 'No sprint data in this range.',
        message: 'Widen the date range or check project access.',
        primaryLabel: 'Retry preview',
        primaryAction: 'retry-leadership-preview',
      });
      setQuarterStripEnabled(true);
      return;
    }
    meta.windowStart = startInput?.value ? new Date(startInput.value + 'T00:00:00.000Z').toISOString() : '';
    meta.windowEnd = endInput?.value ? new Date(endInput.value + 'T23:59:59.999Z').toISOString() : new Date().toISOString();
    meta.projects = projectsSelect?.value || '';
    const predictabilityPerSprint = body.metrics?.predictability?.perSprint || null;
    const boardSummaries = buildBoardSummaries(boards, sprintsIncluded, rows, meta, predictabilityPerSprint);
    body.boardSummaries = boardSummaries;
    body.meta = meta;
    showContent(renderLeadershipPage(body));
    setQuarterStripEnabled(true);
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    showError({
      title: 'Could not load trends.',
      message: err.message || 'Failed to load preview.',
      primaryLabel: 'Retry preview',
      primaryAction: 'retry-leadership-preview',
    });
    setQuarterStripEnabled(true);
  } finally {
    if (requestId === leadershipRequestSeq) {
      leadershipInFlightController = null;
    }
  }
}

export function initLeadershipFilters() {
  const { projectsSelect, startInput, endInput, previewBtn } = leadershipDom;
  let autoPreviewTimer = null;
  const scheduleAutoPreview = (delayMs = AUTO_PREVIEW_DELAY_MS) => {
    if (autoPreviewTimer) clearTimeout(autoPreviewTimer);
    autoPreviewTimer = setTimeout(() => {
      autoPreviewTimer = null;
      loadPreview();
    }, delayMs);
  };

  if (previewBtn) previewBtn.addEventListener('click', () => {
    setQuarterStripEnabled(false);
    loadPreview();
  });
  if (projectsSelect) projectsSelect.addEventListener('change', () => {
    saveFilters();
    scheduleAutoPreview();
  });
  if (startInput) startInput.addEventListener('change', () => {
    saveFilters();
    scheduleAutoPreview();
  });
  if (endInput) endInput.addEventListener('change', () => {
    saveFilters();
    scheduleAutoPreview();
  });
  if (leadershipDom.errorEl) {
    leadershipDom.errorEl.addEventListener('click', (event) => {
      const btn = event.target?.closest?.('[data-action="retry-leadership-preview"]');
      if (!btn) return;
      retryLeadershipIntent();
    });
  }

  initQuarterStrip('.quarter-strip-inner-leadership', startInput, endInput, {
    formatInputValue: (date) => date.toISOString().slice(0, 10),
    onApply: () => {
      saveFilters();
      loadPreview();
    },
  });
}

export function initLeadershipDefaults() {
  if (!loadSavedFilters()) {
    setDefaultDates();
  }
}

/**
 * If we have valid stored context (last query or projects + date range), trigger preview once.
 * Call after initLeadershipFilters() so the UI is wired.
 */
export function tryAutoRunPreviewOnce() {
  const ctx = getValidLastQuery() || getFallbackContext();
  if (!ctx || !ctx.projects || !ctx.start || !ctx.end) return;
  loadPreview();
}

export function renderLeadershipLoading() {
  showLoading('Trends load when you pick a quarter or date range.');
}
