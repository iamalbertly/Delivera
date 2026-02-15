
import { initFeedbackPanel } from './Reporting-App-Report-UI-Feedback.js';
import { initTabs } from './Reporting-App-Report-UI-Tabs.js';
import { initProjectSelection, getSelectedProjects } from './Reporting-App-Report-Page-Selections-Manager.js';
import { initDateRangeControls, isRangeValid, updateRangeHint } from './Reporting-App-Report-Page-DateRange-Controller.js';
import { initPreviewFlow, clearPreviewOnFilterChange } from './Reporting-App-Report-Page-Preview-Flow.js';
import { initSearchClearButtons } from './Reporting-App-Report-Page-Search-Clear.js';
import { renderNotificationDock } from './Reporting-App-Shared-Notifications-Dock-Manager.js';
import { getValidLastQuery, getContextDisplayString } from './Reporting-App-Shared-Context-From-Storage.js';
import { REPORT_FILTERS_COLLAPSED_KEY, SHARED_DATE_RANGE_KEY, LAST_QUERY_KEY, PROJECTS_SSOT_KEY, REPORT_LAST_META_KEY } from './Reporting-App-Shared-Storage-Keys.js';
import { DEFAULT_WINDOW_START_LOCAL, DEFAULT_WINDOW_END_LOCAL } from './Reporting-App-Report-Config-Constants.js';
import { AUTO_PREVIEW_DELAY_MS } from './Reporting-App-Shared-AutoPreview-Config.js';
import { applyDoneStoriesOptionalColumnsPreference } from './Reporting-App-Report-Page-DoneStories-Column-Preference.js';
import { collectFilterParams } from './Reporting-App-Report-Page-Filter-Params.js';
import { reportState } from './Reporting-App-Report-Page-State.js';
import { initExportMenu as initReportExportMenu } from './Reporting-App-Report-Page-Export-Menu.js';
import { classifyPreviewComplexity } from './Reporting-App-Report-Page-Preview-Complexity-Config.js';

const LEADERSHIP_HASH = '#trends';
const CONTEXT_SEPARATOR = ' | ';

function getShortRangeLabel() {
  const activePill = document.querySelector('.quarter-pill.is-active');
  if (activePill && activePill.dataset.quarter) return activePill.dataset.quarter;
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');
  if (!startInput?.value || !endInput?.value) return '';
  const s = startInput.value.slice(0, 10);
  const e = endInput.value.slice(0, 10);
  if (s && e) return s + ' - ' + e;
  return '';
}

function getRangeDaysFromInputs() {
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');
  const startVal = startInput?.value || '';
  const endVal = endInput?.value || '';
  if (!startVal || !endVal) return null;
  const startMs = new Date(startVal).getTime();
  const endMs = new Date(endVal).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;
  return Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
}

function getCurrentSelectionComplexity() {
  const projects = getSelectedProjects();
  const rangeDays = getRangeDaysFromInputs();
  const { level } = classifyPreviewComplexity({
    rangeDays,
    projectCount: projects.length,
    includePredictability: document.getElementById('include-predictability')?.checked === true,
    includeActiveOrMissingEndDateSprints: document.getElementById('include-active-or-missing-end-date-sprints')?.checked === true,
    requireResolvedBySprintEnd: document.getElementById('require-resolved-by-sprint-end')?.checked === true,
  });
  return { level, isHeavy: level === 'heavy' || level === 'veryHeavy' };
}

function shouldAutoPreviewOnInit() {
  const projects = getSelectedProjects();
  if (!Array.isArray(projects) || projects.length === 0) return false;
  if (!isRangeValid()) return false;
  if (getCurrentSelectionComplexity().isHeavy) return false;
  return true;
}

function refreshPreviewButtonLabel() {
  const previewBtn = document.getElementById('preview-btn');
  const rangeHintEl = document.getElementById('range-hint');
  if (!previewBtn) return;
  const projects = getSelectedProjects();
  const n = projects.length;
  const rangeLabel = getShortRangeLabel();
  const complexity = getCurrentSelectionComplexity();
  if (n === 0) {
    previewBtn.textContent = 'Preview';
    previewBtn.title = 'Select at least one project to preview.';
    previewBtn.disabled = true;
    if (rangeHintEl) rangeHintEl.style.display = 'none';
    return;
  }
  if (reportState.previewInProgress) {
    previewBtn.disabled = true;
    previewBtn.title = 'Generating preview...';
    return;
  }
  if (!isRangeValid()) {
    previewBtn.disabled = false;
    previewBtn.title = 'End date must be after start date.';
    previewBtn.textContent = 'Preview';
    if (rangeHintEl) {
      rangeHintEl.style.display = 'block';
      rangeHintEl.textContent = 'Fix date range before preview.';
    }
    return;
  }
  previewBtn.disabled = false;
  const rangePart = rangeLabel ? ', ' + rangeLabel : '';
  if (complexity.isHeavy) {
    previewBtn.textContent = 'Preview now (' + n + ' project' + (n !== 1 ? 's' : '') + rangePart + ')';
    previewBtn.title = 'Large range detected. Manual preview prevents surprise auto-loads.';
    if (rangeHintEl) {
      rangeHintEl.style.display = 'block';
      rangeHintEl.textContent = 'Large selection detected. Preview runs manually for speed and reliability.';
    }
    return;
  }
  previewBtn.textContent = 'Preview (' + n + ' project' + (n !== 1 ? 's' : '') + rangePart + ')';
  previewBtn.title = 'Generate report for selected filters.';
  updateRangeHint();
}

function updateAppliedFiltersSummary() {
  const el = document.getElementById('applied-filters-summary');
  const chipsEl = document.getElementById('applied-filters-chips');
  const projects = getSelectedProjects();
  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');
  const startVal = startInput?.value || '';
  const endVal = endInput?.value || '';
  const opts = [];
  if (document.getElementById('require-resolved-by-sprint-end')?.checked) opts.push('Require resolved by sprint end');
  if (document.getElementById('include-predictability')?.checked) opts.push('Include Predictability');
  const projLabel = projects.length ? projects.join(', ') : 'None';
  const rangeLabel = startVal && endVal ? startVal.slice(0, 10) + ' - ' + endVal.slice(0, 10) : '';
  const summaryText = (projLabel !== 'None' && rangeLabel)
    ? 'Applied: ' + projLabel + CONTEXT_SEPARATOR + rangeLabel + (opts.length ? CONTEXT_SEPARATOR + opts.join(', ') : '')
    : 'Select projects and dates, then preview.';
  if (el) el.textContent = summaryText;
  if (chipsEl) {
    const primaryProject = projects.length === 0 ? 'No project' : projects[0] + (projects.length > 1 ? ' +' + (projects.length - 1) : '');
    const chips = [];
    if (projects.length > 0) chips.push('Projects: ' + primaryProject);
    if (rangeLabel) chips.push('Range: ' + rangeLabel);
    if (opts.length > 0) chips.push('+Advanced (' + opts.length + ')');
    chipsEl.textContent = chips.length ? chips.join(' | ') : 'No filters selected';
  }

  // M5: Truncated summary for mobile — first project + "+N more" saves horizontal space
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  if (el && isMobile && projects.length > 1) {
    const truncProjLabel = projects[0] + ' +' + (projects.length - 1) + ' more';
    const truncSummary = (truncProjLabel !== 'None' && rangeLabel)
      ? 'Applied: ' + truncProjLabel + CONTEXT_SEPARATOR + rangeLabel
      : summaryText;
    el.textContent = truncSummary;
  }

  // M12: Filter count badge — shows how many filters are active for prominence
  const activeCount = projects.length + (startVal && endVal ? 1 : 0) + opts.length;
  const countBadge = document.querySelector('.filters-active-count-badge');
  if (countBadge) countBadge.textContent = activeCount > 0 ? activeCount + ' active' : '';
  refreshPreviewButtonLabel();
  const loadLatestWrapSync = document.getElementById('report-load-latest-wrap');
  const previewBtnSync = document.getElementById('preview-btn');
  if (loadLatestWrapSync && previewBtnSync && previewBtnSync.disabled) loadLatestWrapSync.style.display = 'none';
  const reportContextLineSync = document.getElementById('report-context-line');
  if (reportContextLineSync && projects.length === 0) {
    reportContextLineSync.textContent = 'Select at least one project to see results.';
  }
}

function hydrateFromLastQuery() {
  // Try to load context (Smart Context Engine)
  let ctx = getValidLastQuery();
  let fallbackProjects = [];
  try {
    const rawMeta = sessionStorage.getItem(REPORT_LAST_META_KEY);
    const parsedMeta = rawMeta ? JSON.parse(rawMeta) : null;
    if (parsedMeta && Array.isArray(parsedMeta.projects)) {
      fallbackProjects = parsedMeta.projects.map((p) => String(p || '').trim()).filter(Boolean);
    }
  } catch (_) {}
  if (!fallbackProjects.length) {
    try {
      const ssot = localStorage.getItem(PROJECTS_SSOT_KEY);
      if (ssot) fallbackProjects = ssot.split(',').map((p) => p.trim()).filter(Boolean);
    } catch (_) {}
  }
  if (fallbackProjects.length) {
    fallbackProjects = Array.from(new Set(fallbackProjects));
  }

  // If no history, use widest available cached project scope before falling back to defaults.
  if (!ctx || !ctx.projects) {
    ctx = { projects: fallbackProjects.length ? fallbackProjects.join(',') : 'MPSA,MAS' };
  }

  const startInput = document.getElementById('start-date');
  const endInput = document.getElementById('end-date');
  if (ctx) {
    if (startInput && ctx.start) startInput.value = ctx.start.slice(0, 16);
    if (endInput && ctx.end) endInput.value = ctx.end.slice(0, 16);

    // Checkboxes
    const projects = (ctx.projects || '').split(',').map(p => p.trim()).filter(Boolean);
    document.querySelectorAll('.project-checkbox[data-project]').forEach((input) => {
      const p = input.dataset.project;
      input.checked = projects.includes(p);
    });
  }
}

function initReportPage() {
  let autoPreviewTimer = null;
  let autoPreviewInProgress = false;
  let allowHashTabSync = false;

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
          const defaultBtn = document.getElementById('tab-btn-done-stories') || document.getElementById('tab-btn-project-epic-level');
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
    loadLatestWrap.style.display = 'inline';
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
  initSearchClearButtons();
  renderNotificationDock({ pageContext: 'report', collapsedByDefault: true });
  applyDoneStoriesOptionalColumnsPreference();

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

  function onFilterChange() {
    if (autoPreviewTimer) {
      clearTimeout(autoPreviewTimer);
      autoPreviewTimer = null;
    }
    updateAppliedFiltersSummary();
    if (panel?.classList.contains('collapsed')) setFiltersPanelCollapsed(true);
    clearPreviewOnFilterChange();
    if (!getCurrentSelectionComplexity().isHeavy) {
      scheduleAutoPreview();
    }
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
      const boardsSearch = document.getElementById('boards-search-box') || document.getElementById('search-box');
      if (boardsSearch) boardsSearch.focus();
    }
  });

  const panel = document.getElementById('filters-panel');
  const panelBody = document.getElementById('filters-panel-body');
  const collapsedBar = document.getElementById('filters-panel-collapsed-bar');
  const collapsedSummary = document.getElementById('filters-collapsed-summary');
  const appliedSummary = document.getElementById('applied-filters-summary');

  function getActiveFiltersCount() {
    let count = 0;
    count += document.querySelectorAll('.project-checkbox:checked').length;

    const startVal = document.getElementById('start-date')?.value || '';
    const endVal = document.getElementById('end-date')?.value || '';
    if (startVal || endVal) count += 1;

    if (document.getElementById('require-resolved-by-sprint-end')?.checked) count += 1;
    const includePredictability = document.getElementById('include-predictability')?.checked;
    if (includePredictability) {
      count += 1;
      if (document.querySelector('input[name="predictability-mode"][value="strict"]')?.checked) count += 1;
    }
    if (document.getElementById('include-active-or-missing-end-date-sprints')?.checked) count += 1;

    return count;
  }

  function setFiltersPanelCollapsed(collapsed) {
    if (!panel || !panelBody || !collapsedBar) return;
    try {
      if (collapsed) sessionStorage.setItem(REPORT_FILTERS_COLLAPSED_KEY, '1');
      else sessionStorage.removeItem(REPORT_FILTERS_COLLAPSED_KEY);
    } catch (_) { }
    panel.classList.toggle('collapsed', collapsed);
    panelBody.style.display = collapsed ? 'none' : '';
    collapsedBar.style.display = collapsed ? 'flex' : 'none';
    collapsedBar.setAttribute('aria-hidden', collapsed ? 'false' : 'true');
    if (collapsed && collapsedSummary && appliedSummary) {
      const base = appliedSummary.textContent || 'Applied filters';
      const activeCount = getActiveFiltersCount();
      collapsedSummary.textContent = base + ' (' + activeCount + ' active)';
    }
  }

  function applyStoredFiltersCollapsed() {
    if (!panel || !panelBody || !collapsedBar) return;
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
    if (isMobile) {
      setFiltersPanelCollapsed(true);
      return;
    }
    const previewContent = document.getElementById('preview-content');
    const isPreviewVisible = previewContent && previewContent.style.display !== 'none';
    try {
      const stored = sessionStorage.getItem(REPORT_FILTERS_COLLAPSED_KEY);
      if (stored === '1' && isPreviewVisible) setFiltersPanelCollapsed(true);
    } catch (_) { }
  }

  document.addEventListener('click', (ev) => {
    const toggle = ev.target.closest && ev.target.closest('[data-action="toggle-filters"]');
    if (toggle && panel) {
      ev.preventDefault();
      setFiltersPanelCollapsed(false);
    }
  });

  window.addEventListener('report-preview-shown', (ev) => {
    if (!panel || !panelBody || !collapsedBar) return;
    try {
      sessionStorage.setItem(REPORT_FILTERS_COLLAPSED_KEY, '1');
      setFiltersPanelCollapsed(true);
      if (window.location.hash === LEADERSHIP_HASH) return;
      const savedTab = sessionStorage.getItem('report-active-tab');
      if (savedTab) {
        const tabBtn = document.querySelector('.tab-btn[data-tab="' + savedTab + '"]');
        if (tabBtn && !tabBtn.classList.contains('active')) tabBtn.click();
      }
    } catch (_) { }
  });

  setTimeout(applyStoredFiltersCollapsed, 0);
  window.addEventListener('storage', syncFromSharedStorage);
  initKeyboardViewportGuard();

  const prevRefresh = window.__refreshReportingContextBar;
  window.__refreshReportingContextBar = function () {
    updateAppliedFiltersSummary();
    if (panel?.classList.contains('collapsed')) setFiltersPanelCollapsed(true);
    if (typeof prevRefresh === 'function') prevRefresh();
  };

  try {
    activateTabFromHash();
    setTimeout(() => { allowHashTabSync = true; activateTabFromHash(); }, 0);
    const lastQuery = getValidLastQuery();
    const leadershipContent = document.getElementById('leadership-content');
    const hasTrendsContent = !!(leadershipContent && leadershipContent.children && leadershipContent.children.length > 0);
    if (window.location && window.location.hash === LEADERSHIP_HASH && lastQuery && !hasTrendsContent) {
      scheduleAutoPreview(200);
    }
    window.addEventListener('hashchange', activateTabFromHash);
    window.addEventListener('app:navigate', activateTabFromHash);
  } catch (_) { }
}

// M2: Scroll-aware page identity — inject compact page name into sticky header when H1 scrolls away (X.com pattern)
function initPageIdentityObserver() {
  try {
    const h1 = document.querySelector('main h1, .page-title, h1');
    if (!h1 || typeof IntersectionObserver === 'undefined') return;
    const headerRow = document.querySelector('header .header-row');
    if (!headerRow) return;
    let ctxSpan = document.querySelector('.header-page-context');
    if (!ctxSpan) {
      ctxSpan = document.createElement('span');
      ctxSpan.className = 'header-page-context';
      ctxSpan.setAttribute('aria-hidden', 'true');
      headerRow.appendChild(ctxSpan);
    }
    ctxSpan.textContent = h1.textContent.trim().slice(0, 30);
    const obs = new IntersectionObserver((entries) => {
      const hidden = !entries[0].isIntersecting;
      ctxSpan.classList.toggle('visible', hidden);
    }, { threshold: 0 });
    obs.observe(h1);
  } catch (_) {}
}

// M11: Bidirectional scroll fade — capture-phase delegation so dynamically-rendered wrappers are covered
function initTableScrollIndicators() {
  try {
    document.addEventListener('scroll', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('data-table-scroll-wrap')) {
        e.target.classList.toggle('scrolled-right', e.target.scrollLeft > 8);
      }
    }, { passive: true, capture: true });
  } catch (_) {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initReportPage(); initPageIdentityObserver(); initTableScrollIndicators(); });
} else {
  initReportPage();
  initPageIdentityObserver();
  initTableScrollIndicators();
}
