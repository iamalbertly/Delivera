
import { initFeedbackPanel } from './Reporting-App-Report-UI-Feedback.js';
import { initTabs } from './Reporting-App-Report-UI-Tabs.js';
import { initProjectSelection, getSelectedProjects } from './Reporting-App-Report-Page-Selections-Manager.js';
import { initDateRangeControls } from './Reporting-App-Report-Page-DateRange-Controller.js';
import { initPreviewFlow, clearPreviewOnFilterChange, restoreLastPreviewFromStorage } from './Reporting-App-Report-Page-Preview-Flow.js';
import { initSearchClearButtons } from './Reporting-App-Report-Page-Search-Clear.js';
import { initFilters } from './Reporting-App-Report-Page-Filters-Pills-Manager.js';
import { renderNotificationDock } from './Reporting-App-Shared-Notifications-Dock-Manager.js';
import { getValidLastQuery, getContextDisplayString } from './Reporting-App-Shared-Context-From-Storage.js';
import {
  REPORT_FILTERS_COLLAPSED_KEY,
  SHARED_DATE_RANGE_KEY,
  LAST_QUERY_KEY,
  PROJECTS_SSOT_KEY,
  REPORT_FILTERS_STALE_KEY,
  REPORT_FILTERS_STALE_REASON_KEY,
  REPORT_CONTEXT_KEY,
} from './Reporting-App-Shared-Storage-Keys.js';
import { DEFAULT_WINDOW_START_LOCAL, DEFAULT_WINDOW_END_LOCAL } from './Reporting-App-Report-Config-Constants.js';
import { AUTO_PREVIEW_DELAY_MS } from './Reporting-App-Shared-AutoPreview-Config.js';
import { applyDoneStoriesOptionalColumnsPreference } from './Reporting-App-Report-Page-DoneStories-Column-Preference.js';
import { collectFilterParams } from './Reporting-App-Report-Page-Filter-Params.js';
import { reportState } from './Reporting-App-Report-Page-State.js';
import { initExportMenu as initReportExportMenu } from './Reporting-App-Report-Page-Export-Menu.js';
import { getCurrentSelectionComplexity, shouldAutoPreviewOnInit, refreshPreviewButtonLabel, updateAppliedFiltersSummary, hydrateFromLastQuery } from './Reporting-App-Report-Page-Filters-Summary-Helpers.js';
import { initSharedPageIdentityObserver, initSharedTableScrollIndicators } from './Reporting-App-Shared-Page-Identity-Scroll-Helpers.js';
import { initReportFiltersPanelState } from './Reporting-App-Report-Page-Init-Filters-Panel-State-Helpers.js';
import { initGlobalOutcomeModal } from './Reporting-App-Shared-Outcome-Modal.js';

const LEADERSHIP_HASH = '#trends';

function initReportPage() {
  try { document.body.classList.add('report-page'); } catch (_) {}
  let autoPreviewTimer = null;
  let autoPreviewInProgress = false;
  let allowHashTabSync = false;

  function syncHeaderLoadLatestVisibility(visible) {
    const loadLatestWrap = document.getElementById('report-load-latest-wrap');
    const headerBtn = document.getElementById('report-header-load-latest-btn');
    const show = !!visible;
    if (loadLatestWrap) loadLatestWrap.style.display = show ? 'inline' : 'none';
    if (headerBtn) headerBtn.hidden = !show;
  }

  try {
    window.__reportSyncHeaderLoadLatestVisibility = syncHeaderLoadLatestVisibility;
  } catch (_) {}

  function scheduleAutoPreview(delayMs = AUTO_PREVIEW_DELAY_MS) {
    const previewBtn = document.getElementById('preview-btn');
    if (!previewBtn) return;
    if (autoPreviewTimer) clearTimeout(autoPreviewTimer);
    if (delayMs === 0) {
      if (autoPreviewInProgress || previewBtn.disabled) return;
      try { collectFilterParams(); } catch (_) { return; }
      autoPreviewInProgress = true;
      previewBtn.click();
      setTimeout(() => { autoPreviewInProgress = false; }, 250);
      return;
    }
    autoPreviewTimer = setTimeout(() => {
      autoPreviewTimer = null;
      if (autoPreviewInProgress || previewBtn.disabled) return;
      try { collectFilterParams(); } catch (_) { return; }
      autoPreviewInProgress = true;
      previewBtn.click();
      setTimeout(() => { autoPreviewInProgress = false; }, 250);
    }, delayMs);
  }

  initFeedbackPanel();
  try {
    const params = new URLSearchParams(window.location.search);
    const boardId = params.get('boardId') || '';
    const sprintId = params.get('sprintId') || '';
    const projects = params.get('projects') || '';
    if (boardId || sprintId || projects) {
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
          const defaultBtn = document.getElementById('tab-btn-project-epic-level') || document.getElementById('tab-btn-done-stories');
          if (defaultBtn) defaultBtn.click();
        }
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
  const reportContextLine = document.getElementById('report-context-line');
  const hasProjects = getSelectedProjects().length > 0;
  if (reportContextLine) {
    reportContextLine.textContent = hasProjects
      ? getContextDisplayString()
      : 'Select at least one project to see results.';
  }
  const loadLatestWrap = document.getElementById('report-load-latest-wrap');
  const loadLatestBtn = document.getElementById('report-load-latest-btn');
  if (hasProjects && getContextDisplayString() === 'No report run yet' && loadLatestWrap) {
    syncHeaderLoadLatestVisibility(true);
  }
  if (loadLatestBtn) {
    loadLatestBtn.addEventListener('click', () => {
      const pb = document.getElementById('preview-btn');
      if (pb && !pb.disabled) {
        pb.click();
        if (typeof pb.focus === 'function') pb.focus();
      }
    });
  }
  updateAppliedFiltersSummary();
  if (shouldAutoPreviewOnInit()) {
    const previewBtn = document.getElementById('preview-btn');
    if (previewBtn && !previewBtn.disabled) scheduleAutoPreview(1000);
  }
  initReportExportMenu();
  initPreviewFlow();
  restoreLastPreviewFromStorage();
  initFilters();
  initSearchClearButtons();
  renderNotificationDock({ pageContext: 'report', collapsedByDefault: true });
  applyDoneStoriesOptionalColumnsPreference();

  function initOutcomeIntake() {
    const wrap = document.getElementById('report-header-actions');
    if (!wrap) return;
    initGlobalOutcomeModal({
      getSelectedProjects,
    });
    let currentSprintHref = '/current-sprint';
    try {
      const raw = localStorage.getItem(REPORT_CONTEXT_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const params = new URLSearchParams();
      if (parsed?.boardId) params.set('boardId', parsed.boardId);
      if (parsed?.sprintId) params.set('sprintId', parsed.sprintId);
      if (parsed?.projects) params.set('projects', parsed.projects);
      const query = params.toString();
      if (query) currentSprintHref += '?' + query;
    } catch (_) {}
    wrap.innerHTML = ''
      + '<button type="button" class="btn btn-secondary btn-compact" data-action="toggle-filters">Edit filters</button>'
      + '<a href="' + currentSprintHref + '" class="btn btn-secondary btn-compact">Open current sprint</a>'
      + '<button type="button" id="report-header-load-latest-btn" class="btn btn-secondary btn-compact" data-action="load-latest-preview" hidden>Load latest</button>'
      + '<div class="report-outcome-intake report-outcome-intake-inline">'
      + '<span id="report-header-actions-status" class="report-outcome-intake-status" aria-live="polite"></span>'
      + '<button type="button" class="btn btn-compact report-outcome-intake-create-btn" data-open-outcome-modal data-outcome-context="Create an outcome from the active report context." data-outcome-projects="' + getSelectedProjects().join(',') + '">Create outcome</button>'
      + '</div>';
    syncHeaderLoadLatestVisibility(getSelectedProjects().length > 0 && getContextDisplayString() === 'No report run yet');
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
        const reportContextLine = document.getElementById('report-context-line');
        if (reportContextLine) {
          reportContextLine.textContent = getContextDisplayString();
        }
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
      const reportContextLine = document.getElementById('report-context-line');
      if (reportContextLine) {
        reportContextLine.textContent = getContextDisplayString();
      }
    } catch (_) {}
    syncHeaderLoadLatestVisibility(getSelectedProjects().length > 0 && getContextDisplayString() === 'No report run yet');
    clearPreviewOnFilterChange();
    if (!getCurrentSelectionComplexity().isHeavy) {
      scheduleAutoPreview();
    }
  }
  function refreshPreviewNow() {
    if (reportState.previewInProgress) return;
    scheduleAutoPreview(0);
  }

  function openFiltersPanelAndFocus(targetId) {
    try {
      const toggleBtn = document.querySelector('[data-action="toggle-filters"]');
      const panel = document.getElementById('filters-panel');
      if (toggleBtn && panel?.classList.contains('collapsed')) {
        toggleBtn.click();
      }
      const target = targetId ? document.getElementById(targetId) : null;
      target?.focus?.();
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    } catch (_) {}
  }
  document.getElementById('start-date')?.addEventListener('change', onFilterChange);
  document.getElementById('end-date')?.addEventListener('change', onFilterChange);
  document.getElementById('start-date')?.addEventListener('input', onFilterChange);
  document.getElementById('end-date')?.addEventListener('input', onFilterChange);
  document.getElementById('require-resolved-by-sprint-end')?.addEventListener('change', onFilterChange);
  document.getElementById('include-predictability')?.addEventListener('change', onFilterChange);
  document.getElementById('include-active-or-missing-end-date-sprints')?.addEventListener('change', onFilterChange);
  document.querySelectorAll('.project-checkbox').forEach((cb) => cb.addEventListener('change', onFilterChange));

  document.addEventListener('click', (ev) => {
    if (ev.target?.getAttribute('data-action') !== 'reset-filters') return;
    try {
      localStorage.removeItem(SHARED_DATE_RANGE_KEY);
      localStorage.removeItem(LAST_QUERY_KEY);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(REPORT_FILTERS_STALE_KEY, '1');
      }
    } catch (_) { }
    document.querySelectorAll('.project-checkbox').forEach((cb) => { cb.checked = false; });
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    if (startInput) startInput.value = DEFAULT_WINDOW_START_LOCAL;
    if (endInput) endInput.value = DEFAULT_WINDOW_END_LOCAL;
    updateAppliedFiltersSummary();
    clearPreviewOnFilterChange();
  });

  document.addEventListener('click', (ev) => {
    const contextActionEl = ev.target.closest && ev.target.closest('[data-context-action]');
    if (contextActionEl) {
      const contextAction = contextActionEl.getAttribute('data-context-action');
      if (contextAction === 'refresh-context') {
        refreshPreviewNow();
        return;
      }
      if (contextAction === 'open-project-filters') {
        openFiltersPanelAndFocus('project-search');
        return;
      }
      if (contextAction === 'open-range-filters') {
        openFiltersPanelAndFocus('start-date');
        return;
      }
      if (contextAction === 'explain-freshness') {
        const statusEl = document.getElementById('report-header-actions-status');
        if (statusEl) {
          statusEl.textContent = 'Freshness reflects the last successful preview run for the active report context.';
        }
        return;
      }
    }
    const btn = ev.target.closest && ev.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (action === 'open-boards-tab') {
      const boardTab = document.getElementById('tab-btn-project-epic-level');
      if (boardTab) { boardTab.click(); boardTab.focus(); }
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
