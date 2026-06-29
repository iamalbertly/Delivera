
import { initFeedbackPanel } from './Delivera-Report-UI-Feedback.js';
import { initTabs } from './Delivera-Report-UI-Tabs.js';
import { initProjectSelection, getSelectedProjects } from './Delivera-Report-Page-Selections-Manager.js';
import { initDateRangeControls } from './Delivera-Report-Page-DateRange-Controller.js';
import { initPreviewFlow, clearPreviewOnFilterChange, restoreLastPreviewFromStorage, showReportError } from './Delivera-Report-Page-Preview-Flow.js';
import { wirePreviewContextActions } from './Delivera-Report-Page-Render-Preview.js';
import { initSearchClearButtons } from './Delivera-Report-Page-Search-Clear.js';
import { initFilters } from './Delivera-Report-Page-Filters-Pills-Manager.js';
import { refreshNotificationDockFromStore } from './Delivera-Shared-Notifications-Dock-Manager.js';
import { getValidLastQuery, getContextDisplayString, renderSidebarContextCard } from './Delivera-Shared-Context-From-Storage.js';
import {
  REPORT_FILTERS_COLLAPSED_KEY,
  SHARED_DATE_RANGE_KEY,
  LAST_QUERY_KEY,
  PROJECTS_SSOT_KEY,
  REPORT_FILTERS_STALE_KEY,
  REPORT_FILTERS_STALE_REASON_KEY,
  REPORT_CONTEXT_KEY,
} from './Delivera-Shared-Storage-Keys.js';
import { DEFAULT_WINDOW_START_LOCAL, DEFAULT_WINDOW_END_LOCAL } from './Delivera-Report-Config-Constants.js';
import { AUTO_PREVIEW_DELAY_MS } from './Delivera-Shared-AutoPreview-Config.js';
import { applyDoneStoriesOptionalColumnsPreference } from './Delivera-Report-Page-DoneStories-Column-Preference.js';
import { collectFilterParams } from './Delivera-Report-Page-Filter-Params.js';
import { reportState } from './Delivera-Report-Page-State.js';
import { initExportMenu as initReportExportMenu } from './Delivera-Report-Page-Export-Menu.js';
import { getCurrentSelectionComplexity, shouldAutoPreviewOnInit, refreshPreviewButtonLabel, updateAppliedFiltersSummary, hydrateFromLastQuery } from './Delivera-Report-Page-Filters-Summary-Helpers.js';
import { initSharedPageIdentityObserver, initSharedTableScrollIndicators } from './Delivera-Shared-Page-Identity-Scroll-Helpers.js';
import { initReportFiltersPanelState } from './Delivera-Report-Page-Init-Filters-Panel-State-Helpers.js';
import { mountReportProofSummary } from './Delivera-Report-Proof-Summary-01Bridge.js';
import { initWorkDraftDrawer as initGlobalOutcomeModal } from './Delivera-Work-Draft-Canvas.js';
import { renderReportNamedViewsBar, wireReportNamedViews } from './Delivera-Report-Page-Named-Views.js';
import { initOverlayManager } from './Delivera-Shared-Overlay-Manager.js';
import { wireLeadershipContentInteractions } from './Delivera-Leadership-Shared-Actions.js';

const LEADERSHIP_HASH = '#trends';

function initReportPage() {
  try { document.body.classList.add('report-page'); } catch (_) {}
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (!window.location.hash) {
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    }
  } catch (_) {}
  initOverlayManager();
  wireLeadershipContentInteractions(document);
  let autoPreviewTimer = null;
  let autoPreviewInProgress = false;
  let allowHashTabSync = false;

  function syncHeaderLoadLatestVisibility(visible) {
    const loadLatestWrap = document.getElementById('report-load-latest-wrap');
    const headerBtn = document.getElementById('report-header-load-latest-btn');
    const show = !!visible;
    // Keep one SSOT affordance: header button only.
    if (loadLatestWrap) loadLatestWrap.style.display = 'none';
    if (headerBtn) headerBtn.hidden = !show;
  }

  function setReportActionStatus(message, tone = 'neutral') {
    const statusEl = document.getElementById('report-header-actions-status');
    if (!statusEl) return;
    const text = String(message || '').trim();
    statusEl.textContent = text;
    statusEl.setAttribute('data-tone', tone);
  }

  function runReportPreviewFromHeader(reason = 'manual-refresh') {
    const previewBtn = document.getElementById('preview-btn');
    if (!previewBtn) {
      setReportActionStatus('Preview unavailable - open filters first.', 'warning');
      return false;
    }
    if (reportState.previewInProgress || previewBtn.disabled) {
      setReportActionStatus('Preview already running - please wait.', 'warning');
      return false;
    }
    try {
      collectFilterParams();
    } catch (error) {
      const message = (error && typeof error.message === 'string') ? error.message : 'Complete scope and date filters before refresh.';
      showReportError('Check filters', message);
      setReportActionStatus(message, 'warning');
      return false;
    }
    setReportActionStatus('Refreshing live report context...', 'info');
    scheduleAutoPreview(0);
    window.setTimeout(() => {
      const fresh = reportState.previewInProgress ? 'Preview running...' : 'Refresh queued';
      setReportActionStatus(fresh, 'info');
    }, 120);
    try {
      window.dispatchEvent(new CustomEvent('delivera:report-header-refresh', { detail: { reason } }));
    } catch (_) {}
    return true;
  }

  function mountReportNamedViewsBar() {
    const filterStrip = document.getElementById('report-filter-strip');
    if (!filterStrip) return;
    let viewsWrap = document.getElementById('report-named-views');
    if (!viewsWrap) {
      viewsWrap = document.createElement('div');
      viewsWrap.id = 'report-named-views';
      viewsWrap.className = 'report-header-named-views';
      filterStrip.appendChild(viewsWrap);
    } else if (viewsWrap.parentElement !== filterStrip) {
      filterStrip.appendChild(viewsWrap);
    }
    viewsWrap.innerHTML = renderReportNamedViewsBar();
  }

  function closeReportHeaderMoreMenu() {
    const menu = document.querySelector('.report-header-more-menu');
    if (menu && typeof menu.removeAttribute === 'function') {
      menu.removeAttribute('open');
    }
  }

  function ensureReportFiltersPanelOpen() {
    const panel = document.getElementById('filters-panel');
    const panelBody = document.getElementById('filters-panel-body');
    const collapsedBar = document.getElementById('filters-panel-collapsed-bar');
    if (!panel) return null;
    if (!panel.classList.contains('collapsed')) return panel;
    panel.hidden = false;
    panel.classList.remove('collapsed');
    panel.classList.add('overlay-drawer');
    try {
      const desktop = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(min-width: 1025px)').matches;
      panel.classList.toggle('expanded', desktop);
      panel.classList.toggle('is-open', !desktop);
    } catch (_) {
      panel.classList.add('expanded');
    }
    if (panelBody) panelBody.style.display = '';
    if (collapsedBar) {
      collapsedBar.style.display = 'none';
      collapsedBar.setAttribute('aria-hidden', 'true');
    }
    document.querySelectorAll('[data-action="toggle-filters"]').forEach((button) => {
      button.textContent = 'Hide filters';
      button.setAttribute('aria-expanded', 'true');
    });
    return panel;
  }

  function setReportContextLineText(contextText) {
    const reportContextLine = document.getElementById('report-context-line');
    if (!reportContextLine) return;
    const raw = String(contextText || '').trim() || 'No report run yet';
    const sentence = raw.split(/\s*\|\s*/)[0].trim();
    reportContextLine.textContent = sentence;
    reportContextLine.classList.remove('visually-hidden');
    reportContextLine.removeAttribute('aria-hidden');
  }

  function openFiltersPanelAndFocus(targetId) {
    try {
      const panel = ensureReportFiltersPanelOpen();
      if (!panel) return false;
      closeReportHeaderMoreMenu();
      const target = targetId ? document.getElementById(targetId) : panel;
      window.setTimeout(() => {
        target?.focus?.();
        target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }, 0);
      return true;
    } catch (_) {
      return false;
    }
  }

  function handleReportChromeAction(action) {
    const normalized = String(action || '').trim();
    if (!normalized) return false;
    if (normalized === 'toggle-filters' || normalized === 'open-filters') {
      const panel = document.getElementById('filters-panel');
      if (panel?.classList.contains('collapsed')) {
        return openFiltersPanelAndFocus('project-search');
      }
      return openFiltersPanelAndFocus();
    }
    if (normalized === 'refresh-context') {
      return runReportPreviewFromHeader('context-action');
    }
    if (normalized === 'load-latest-preview') {
      return runReportPreviewFromHeader('load-latest');
    }
    if (normalized === 'open-project-filters' || normalized === 'open-projects') {
      return openFiltersPanelAndFocus('project-search');
    }
    if (normalized === 'open-range-filters' || normalized === 'open-range') {
      return openFiltersPanelAndFocus('start-date');
    }
    if (normalized === 'focus-config') {
      const opened = openFiltersPanelAndFocus('advanced-options-toggle');
      try {
        document.getElementById('report-rules-tile')?.setAttribute('open', 'open');
      } catch (_) {}
      return opened;
    }
    if (normalized === 'open-boards' || normalized === 'open-boards-tab') {
      const boardTab = document.getElementById('tab-btn-project-epic-level');
      if (boardTab) {
        boardTab.click();
        boardTab.focus();
        return true;
      }
      return false;
    }
    if (normalized === 'open-done-stories') {
      const doneStoriesTab = document.getElementById('tab-btn-done-stories');
      if (doneStoriesTab) {
        doneStoriesTab.click();
        doneStoriesTab.focus();
        window.setTimeout(() => {
          const firstSprintHeader = document.querySelector('#done-stories-content .sprint-header');
          firstSprintHeader?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        }, 80);
        return true;
      }
      return false;
    }
    if (normalized === 'open-unusable-sprints') {
      const unusableTab = document.getElementById('tab-btn-unusable-sprints');
      if (unusableTab) {
        unusableTab.click();
        unusableTab.focus();
        return true;
      }
      return false;
    }
    if (normalized === 'open-current-sprint') {
      window.location.href = '/current-sprint';
      return true;
    }
    if (normalized === 'open-sprints' || normalized === 'open-sprints-tab') {
      const sprintsTab = document.getElementById('tab-btn-sprints');
      if (sprintsTab) {
        sprintsTab.click();
        sprintsTab.focus();
        return true;
      }
      return false;
    }
    if (normalized === 'reset-filters') {
      try {
        localStorage.removeItem(SHARED_DATE_RANGE_KEY);
        localStorage.removeItem(LAST_QUERY_KEY);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(REPORT_FILTERS_STALE_KEY, '1');
        }
      } catch (_) {}
      document.querySelectorAll('.project-checkbox').forEach((cb) => { cb.checked = false; });
      const startInput = document.getElementById('start-date');
      const endInput = document.getElementById('end-date');
      if (startInput) startInput.value = DEFAULT_WINDOW_START_LOCAL;
      if (endInput) endInput.value = DEFAULT_WINDOW_END_LOCAL;
      updateAppliedFiltersSummary();
      clearPreviewOnFilterChange();
      return true;
    }
    if (normalized === 'explain-freshness') {
      const statusEl = document.getElementById('report-header-actions-status');
      if (statusEl) {
        statusEl.textContent = 'Freshness reflects the last successful preview run for the active report context.';
      }
      return true;
    }
    return false;
  }

  try {
    window.__deliveraHandleReportChromeAction = handleReportChromeAction;
  } catch (_) {}

  try {
    window.__reportSyncHeaderLoadLatestVisibility = syncHeaderLoadLatestVisibility;
  } catch (_) {}

  function scheduleAutoPreview(delayMs = AUTO_PREVIEW_DELAY_MS) {
    const previewBtn = document.getElementById('preview-btn');
    if (!previewBtn) return;
    try {
      if (window.__DELIVERA_TEST_DISABLE_AUTO_PREVIEW) return;
    } catch (_) {}
    if (autoPreviewTimer) clearTimeout(autoPreviewTimer);
    if (delayMs === 0) {
      if (autoPreviewInProgress || previewBtn.disabled) return;
      try { collectFilterParams(); } catch (_) { return; }
      autoPreviewInProgress = true;
      previewBtn.click();
      setTimeout(() => { autoPreviewInProgress = false; }, 250);
      setReportActionStatus('Preview requested...', 'info');
      return;
    }
    autoPreviewTimer = setTimeout(() => {
      autoPreviewTimer = null;
      if (autoPreviewInProgress || previewBtn.disabled) return;
      try { collectFilterParams(); } catch (_) { return; }
      autoPreviewInProgress = true;
      previewBtn.click();
      setTimeout(() => { autoPreviewInProgress = false; }, 250);
      setReportActionStatus('Preview requested...', 'info');
    }, delayMs);
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const boardId = params.get('boardId') || '';
    const sprintId = params.get('sprintId') || '';
    const projects = params.get('projects') || '';
    if (boardId || sprintId || projects) {
      if (projects) {
        try {
          localStorage.setItem(PROJECTS_SSOT_KEY, projects);
        } catch (_) {}
      }
      localStorage.setItem(REPORT_CONTEXT_KEY, JSON.stringify({
        boardId,
        sprintId,
        projects,
        updatedAt: new Date().toISOString(),
      }));
      fetch('/api/user-context/report', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ boardId, sprintId, projects, reportPath: '/report' }),
      }).catch(() => {});
    }
  } catch (_) {}
  function syncHashWithTab(tabName) {
    if (!allowHashTabSync) return;
    const onLeadershipTab = tabName === 'trends';
    const hasLeadershipHash = window.location.hash === LEADERSHIP_HASH;
    if (onLeadershipTab && !hasLeadershipHash) {
      history.replaceState(null, '', '/report' + LEADERSHIP_HASH);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    if (!onLeadershipTab && hasLeadershipHash) {
      history.replaceState(null, '', '/report');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }

  function activateTabFromHash() {
    try {
      const hash = window.location.hash;
      if (hash === LEADERSHIP_HASH) {
        const trendsBtn = document.getElementById('tab-btn-trends');
        if (trendsBtn && !trendsBtn.classList.contains('active')) trendsBtn.click();
        return;
      }
      if (!hash) {
        const activeBtn = document.querySelector('.tab-btn.active');
        if (!activeBtn) {
          const preferOutcomes = document.body?.classList?.contains('has-top-chrome');
          const defaultBtn = preferOutcomes
            ? (document.getElementById('tab-btn-done-stories') || document.getElementById('tab-btn-project-epic-level'))
            : (document.getElementById('tab-btn-project-epic-level') || document.getElementById('tab-btn-done-stories'));
          if (defaultBtn) defaultBtn.click();
        }
      }
      const projectCount = getSelectedProjects().length;
      const trendsBtn = document.getElementById('tab-btn-trends');
      if (trendsBtn && projectCount > 0 && projectCount < 3) {
        trendsBtn.hidden = true;
        trendsBtn.setAttribute('aria-hidden', 'true');
      } else if (trendsBtn) {
        trendsBtn.hidden = false;
        trendsBtn.removeAttribute('aria-hidden');
      }
    } catch (_) {}
  }

  initTabs(() => initReportExportMenu(), (tabName) => {
    if (tabName === 'done-stories') applyDoneStoriesOptionalColumnsPreference();
    syncHashWithTab(tabName);
  });
  // initExportMenu is called later

  try { window.__reportPreviewButtonSync = refreshPreviewButtonLabel; } catch (_) { }
  try {
    const previewBtnInitial = document.getElementById('preview-btn');
    if (previewBtnInitial) {
      previewBtnInitial.style.visibility = 'visible';
    }
  } catch (_) {}
  initProjectSelection();
  initDateRangeControls(() => {
    if (!getCurrentSelectionComplexity().isHeavy) scheduleAutoPreview(AUTO_PREVIEW_DELAY_MS);
  }, () => { refreshPreviewButtonLabel(); });
  hydrateFromLastQuery();
  const hasProjects = getSelectedProjects().length > 0;
  setReportContextLineText(getContextDisplayString());
  if (hasProjects && getContextDisplayString() === 'No report run yet') {
    syncHeaderLoadLatestVisibility(true);
  }
  updateAppliedFiltersSummary();
  initPreviewFlow();
  wirePreviewContextActions();
  const cacheRestored = restoreLastPreviewFromStorage();
  const hasTopChrome = document.body?.classList?.contains('has-top-chrome');
  if (hasTopChrome) {
    try {
      const panel = document.getElementById('filters-panel');
      if (panel && !panel.classList.contains('collapsed')) {
        panel.classList.add('collapsed');
        try { localStorage.setItem(REPORT_FILTERS_COLLAPSED_KEY, '1'); } catch (_) {}
      }
    } catch (_) {}
  }
  if (!cacheRestored && shouldAutoPreviewOnInit()) {
    const previewBtn = document.getElementById('preview-btn');
    if (previewBtn && !previewBtn.disabled) {
      scheduleAutoPreview(hasTopChrome ? 0 : 1000);
    }
  } else if (hasTopChrome && shouldAutoPreviewOnInit() && cacheRestored) {
    const previewBtn = document.getElementById('preview-btn');
    if (previewBtn && !previewBtn.disabled && !reportState.previewData) {
      scheduleAutoPreview(400);
    }
  }
  initFilters();
  initSearchClearButtons();
  refreshNotificationDockFromStore();
  applyDoneStoriesOptionalColumnsPreference();

  function initOutcomeIntake() {
    const wrap = document.getElementById('report-header-actions');
    if (!wrap) return;
    initGlobalOutcomeModal({
      getSelectedProjects,
      getOutcomeDraftContext: () => {
        try {
          const raw = localStorage.getItem(REPORT_CONTEXT_KEY);
          const parsed = raw ? JSON.parse(raw) : {};
          const bid = parsed?.boardId != null ? Number(parsed.boardId) : null;
          return {
            boardId: Number.isFinite(bid) ? bid : null,
            quarterHint: '',
          };
        } catch (_) {
          return { boardId: null, quarterHint: '' };
        }
      },
    });
    let currentSprintHref = '/current-sprint';
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const raw = localStorage.getItem(REPORT_CONTEXT_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const params = new URLSearchParams();
      const boardId = urlParams.get('boardId') || parsed?.boardId;
      const sprintId = urlParams.get('sprintId') || parsed?.sprintId;
      const projects = urlParams.get('projects') || parsed?.projects;
      if (boardId) params.set('boardId', boardId);
      if (sprintId) params.set('sprintId', sprintId);
      if (projects) params.set('projects', projects);
      const query = params.toString();
      if (query) currentSprintHref += '?' + query;
    } catch (_) {}
    const hasTopChrome = document.body?.classList?.contains('has-top-chrome');
    const hasSprintContext = currentSprintHref.includes('?');
    const sprintLinkHtml = '<a href="' + currentSprintHref + '" class="btn btn-secondary btn-compact" data-report-sprint-context-link="1">Sprint context</a>';
    const showInlineSprintLink = !hasTopChrome || hasSprintContext;
    wrap.innerHTML = ''
      + '<button type="button" id="report-header-preview-btn" class="btn btn-secondary btn-compact" data-shared-action-tier="secondary" data-report-refresh-proof="1">Refresh proof</button>'
      + '<button type="button" id="report-header-load-latest-btn" class="btn btn-secondary btn-compact" data-shared-action-tier="secondary" data-action="load-latest-preview" hidden>Refresh latest</button>'
      + (hasTopChrome ? '' : '<div class="report-outcome-intake report-outcome-intake-inline">'
      + '<span id="report-header-actions-status" class="report-outcome-intake-status" aria-live="polite"></span>'
      + '<button type="button" class="btn btn-primary btn-compact report-outcome-intake-create-btn" data-shared-action-tier="primary" data-open-outcome-modal data-outcome-context="Create work from the active report context." data-outcome-projects="' + getSelectedProjects().join(',') + '">Create work</button>'
      + '</div>')
      + '<button type="button" id="report-header-export-btn" class="btn btn-secondary btn-compact" data-shared-action-tier="secondary">Export</button>'
      + (showInlineSprintLink ? sprintLinkHtml : '')
      + '<details class="report-header-more-menu">'
      + '<summary class="btn btn-secondary btn-compact" aria-label="More report actions">More</summary>'
      + '<div class="report-header-more-panel" role="group" aria-label="Secondary report actions">'
      + (hasTopChrome && !hasSprintContext ? sprintLinkHtml : '')
      + (hasTopChrome ? '' : '<button type="button" id="feedback-toggle" class="btn btn-secondary btn-compact" aria-expanded="false" aria-controls="feedback-panel">Feedback</button>')
      + '</div>'
      + '</details>';
    wrap.querySelector('#report-header-preview-btn')?.addEventListener('click', () => {
      runReportPreviewFromHeader('header-refresh');
    });
    wrap.querySelector('#report-header-export-btn')?.addEventListener('click', () => {
      document.getElementById('export-excel-btn')?.click();
    });
    syncHeaderLoadLatestVisibility(getSelectedProjects().length > 0 && getContextDisplayString() === 'No report run yet');
    mountReportNamedViewsBar();
    setReportActionStatus('Ready for decision review.', 'neutral');
  }

  // Keep the persisted report dataset filters in sync across tabs.
  function syncFromSharedStorage(event) {
    try {
      if (!event || event.storageArea !== localStorage) return;
      if (event.key !== PROJECTS_SSOT_KEY && event.key !== SHARED_DATE_RANGE_KEY && event.key !== LAST_QUERY_KEY) return;

      if (event.key === PROJECTS_SSOT_KEY) {
        const projects = (event.newValue || '').split(',').map((p) => p.trim()).filter(Boolean);
        document.querySelectorAll('.project-checkbox[data-project]').forEach((input) => {
          input.checked = projects.includes(input.dataset.project);
        });
      }

      if (event.key === SHARED_DATE_RANGE_KEY || event.key === LAST_QUERY_KEY) {
        let range = null;
        if (event.key === SHARED_DATE_RANGE_KEY) {
          range = event.newValue ? JSON.parse(event.newValue) : null;
        } else {
          const parsed = event.newValue ? JSON.parse(event.newValue) : null;
          range = parsed ? { start: parsed.start, end: parsed.end } : null;
        }
        if (range && typeof range.start === 'string' && typeof range.end === 'string') {
          const startInput = document.getElementById('start-date');
          const endInput = document.getElementById('end-date');
          if (startInput) startInput.value = range.start.slice(0, 16);
          if (endInput) endInput.value = range.end.slice(0, 16);
        }
      }

      updateAppliedFiltersSummary();
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(REPORT_FILTERS_STALE_KEY, '1');
          sessionStorage.setItem(REPORT_FILTERS_STALE_REASON_KEY, 'storage-event');
        }
        setReportContextLineText(getContextDisplayString());
      } catch (_) {}
      if (!reportState.previewInProgress && !getCurrentSelectionComplexity().isHeavy) {
        scheduleAutoPreview(250);
      }
    } catch (_) {}
  }

  function initKeyboardViewportGuard() {
    try {
      const vv = window.visualViewport;
      if (!vv) return;
      const apply = () => {
        const keyboardOpen = (window.innerHeight - vv.height) > 120;
        document.body.classList.toggle('keyboard-open', keyboardOpen);
      };
      vv.addEventListener('resize', apply, { passive: true });
      vv.addEventListener('scroll', apply, { passive: true });
      apply();
    } catch (_) {}
  }

  const filterPanelState = initReportFiltersPanelState({
    collapsedStorageKey: REPORT_FILTERS_COLLAPSED_KEY,
    skipTabRestoreForHash: LEADERSHIP_HASH,
  });

  function onFilterChange() {
    if (autoPreviewTimer) {
      clearTimeout(autoPreviewTimer);
      autoPreviewTimer = null;
    }
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(REPORT_FILTERS_STALE_KEY, '1');
        sessionStorage.setItem(REPORT_FILTERS_STALE_REASON_KEY, 'local-change');
      }
    } catch (_) {}
    updateAppliedFiltersSummary();
    filterPanelState.refreshCollapsedSummary();
    try {
      setReportContextLineText(getContextDisplayString());
    } catch (_) {}
    syncHeaderLoadLatestVisibility(getSelectedProjects().length > 0 && getContextDisplayString() === 'No report run yet');
    document.querySelector('[data-open-outcome-modal].report-outcome-intake-create-btn')
      ?.setAttribute('data-outcome-projects', getSelectedProjects().join(','));
    clearPreviewOnFilterChange();
    if (!getCurrentSelectionComplexity().isHeavy) {
      scheduleAutoPreview();
    }
  }
  wireReportNamedViews({
    onChange() {
      updateAppliedFiltersSummary();
      scheduleAutoPreview(0);
      mountReportNamedViewsBar();
    },
  });
  document.getElementById('start-date')?.addEventListener('change', onFilterChange);
  document.getElementById('end-date')?.addEventListener('change', onFilterChange);
  document.getElementById('start-date')?.addEventListener('input', onFilterChange);
  document.getElementById('end-date')?.addEventListener('input', onFilterChange);
  document.getElementById('require-resolved-by-sprint-end')?.addEventListener('change', onFilterChange);
  document.getElementById('include-predictability')?.addEventListener('change', onFilterChange);
  document.getElementById('include-active-or-missing-end-date-sprints')?.addEventListener('change', onFilterChange);
  document.querySelectorAll('.project-checkbox').forEach((cb) => cb.addEventListener('change', onFilterChange));

  document.addEventListener('click', (ev) => {
    const actionTrigger = ev.target.closest && ev.target.closest('[data-context-action], [data-preview-context-action]');
    if (actionTrigger) {
      const action = actionTrigger.getAttribute('data-preview-context-action')
        || actionTrigger.getAttribute('data-context-action')
        || '';
      if (handleReportChromeAction(action)) {
        ev.preventDefault();
        return;
      }
    }
    const btn = ev.target.closest && ev.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (handleReportChromeAction(action)) {
      ev.preventDefault();
    }
  });

  document.addEventListener('keydown', (ev) => {
    const active = document.activeElement && document.activeElement.tagName;
    if (ev.key === '/' && active !== 'INPUT' && active !== 'TEXTAREA') {
      ev.preventDefault();
      const search = document.getElementById('report-tab-search');
      if (search) search.focus();
    }
  });

  window.addEventListener('storage', syncFromSharedStorage);
  window.addEventListener('report-preview-shown', () => {
    const delta = typeof window.__reportPreviewDeltaMessage === 'string'
      ? window.__reportPreviewDeltaMessage
      : 'Preview updated.';
    setReportActionStatus(delta, 'success');
  });
  window.addEventListener('report-preview-failed', () => {
    setReportActionStatus('Preview failed - adjust filters and retry.', 'danger');
  });
  initKeyboardViewportGuard();

  const prevRefresh = window.__refreshReportingContextBar;
  window.__refreshReportingContextBar = function () {
    updateAppliedFiltersSummary();
    filterPanelState.refreshCollapsedSummary();
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(REPORT_FILTERS_STALE_KEY);
        sessionStorage.removeItem(REPORT_FILTERS_STALE_REASON_KEY);
      }
    } catch (_) {}
    if (typeof prevRefresh === 'function') prevRefresh();
  };

  try {
    activateTabFromHash();
    setTimeout(() => { allowHashTabSync = true; activateTabFromHash(); }, 0);
    const leadershipContent = document.getElementById('leadership-content');
    const hasTrendsContent = !!(leadershipContent && leadershipContent.children && leadershipContent.children.length > 0);
    if (window.location && window.location.hash === LEADERSHIP_HASH && !hasTrendsContent) {
      scheduleAutoPreview(200);
    }
    window.addEventListener('hashchange', activateTabFromHash);
    window.addEventListener('app:navigate', activateTabFromHash);
  } catch (_) { }

  initOutcomeIntake();
  initFeedbackPanel();
  mountReportProofSummary();
  window.addEventListener('delivera:scope-changed', () => {
    mountReportProofSummary();
    updateAppliedFiltersSummary();
    renderSidebarContextCard();
  });
}

// M2: Scroll-aware page identity — inject compact page name into sticky header when H1 scrolls away (X.com pattern)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initReportPage();
    initSharedPageIdentityObserver({
      titleSelector: 'main h1, .page-title, h1',
      headerSelector: 'header .header-row',
      fallbackHeaderSelector: 'header',
      trimLength: 30,
    });
    initSharedTableScrollIndicators();
  });
} else {
  initReportPage();
  initSharedPageIdentityObserver({
    titleSelector: 'main h1, .page-title, h1',
    headerSelector: 'header .header-row',
    fallbackHeaderSelector: 'header',
    trimLength: 30,
  });
  initSharedTableScrollIndicators();
}
