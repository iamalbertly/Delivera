/**
 * Report page preview flow: init, event handlers, fetch, and apply payload.
 * SIZE-EXEMPT: Cohesive preview flow (DOM events, fetch, AbortController, applyPayload, timeout UI)
 * kept in one module to avoid scattering and duplicate state handling; complexity config split to
 * Reporting-App-Report-Page-Preview-Complexity-Config.js.
 */
import { reportDom } from './Reporting-App-Report-Page-Context.js';
import { persistDoneStoriesOptionalColumnsPreference } from './Reporting-App-Report-Page-DoneStories-Column-Preference.js';
import { triggerExcelExport } from './Reporting-App-Report-Page-Export-Menu.js';
import { reportState } from './Reporting-App-Report-Page-State.js';
import { collectFilterParams } from './Reporting-App-Report-Page-Filter-Params.js';
import { LAST_QUERY_KEY, REPORT_HAS_RUN_PREVIEW_KEY, REPORT_LAST_RUN_KEY, REPORT_LAST_META_KEY, REPORT_FILTERS_STALE_KEY, REPORT_LAST_PREVIEW_KEY } from './Reporting-App-Shared-Storage-Keys.js';
import { updateLoadingMessage, clearLoadingSteps, readResponseJson, hideLoadingIfVisible, setLoadingVisible, setLoadingStage, startTheaterGathering, stopTheaterGathering, resetLoadingBarToZero } from './Reporting-App-Report-Page-Loading-Steps.js';
import { emitTelemetry } from './Reporting-App-Shared-Telemetry.js';
import { renderPreview } from './Reporting-App-Report-Page-Render-Preview.js';
import { updateExportFilteredState, updateExportHint } from './Reporting-App-Report-Page-Export-Menu.js';
import { updateRangeHint } from './Reporting-App-Report-Page-DateRange-Controller.js';
import { sortSprintsLatestFirst } from './Reporting-App-Report-Page-Sorting.js';
import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { setActionErrorOnEl } from './Reporting-App-Shared-Status-Helpers.js';
import { resetPerfMarks, markPerf } from './Reporting-App-Shared-Perf-Marks.js';
import { warmCurrentSprintJourney } from './Reporting-App-Shared-Journey-Warmup.js';
import {
  RECENT_SPLIT_DEFAULT_DAYS,
  PREVIEW_TIMEOUT_LIGHT_MS,
  classifyPreviewComplexity,
  getClientBudgetMs,
} from './Reporting-App-Report-Page-Preview-Complexity-Config.js';

function setQuickRangeButtonsDisabled(disabled) {
  document.querySelectorAll('.quick-range-btn[data-quarter], .quarter-pill').forEach((button) => {
    button.disabled = disabled;
  });
}

function formatDateTimeLocalValue(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function narrowDateWindow(endDateInputValue, currentStartInputValue) {
  const endDate = endDateInputValue ? new Date(endDateInputValue) : new Date();
  const effectiveEnd = Number.isNaN(endDate.getTime()) ? new Date() : endDate;
  const currentStart = currentStartInputValue ? new Date(currentStartInputValue) : null;
  const hasValidCurrentStart = currentStart && !Number.isNaN(currentStart.getTime());
  const currentRangeDays = hasValidCurrentStart
    ? Math.round((effectiveEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const targetDays = currentRangeDays != null && currentRangeDays <= 31 ? 14 : 30;
  const adjustedStart = new Date(effectiveEnd.getTime() - (targetDays * 24 * 60 * 60 * 1000));
  return { adjustedStart, effectiveEnd };
}

function showReportError(shortText, detailsText) {
  const errorEl = reportDom.errorEl;
  if (!errorEl) return;
  const fullMessage = (detailsText && detailsText.trim()) ? detailsText.trim() : (shortText || 'Please fix the issue above.');
  setActionErrorOnEl(errorEl, {
    title: shortText || 'Check filters',
    message: fullMessage,
    primaryLabel: 'Try smaller date range',
    primaryAction: 'retry-with-smaller-range',
    secondaryActionLabel: 'Retry preview',
    secondaryAction: 'retry-preview',
    dismissible: true,
  });
  const details = document.createElement('div');
  details.className = 'error-details';
  details.style.display = 'none';
  details.textContent = fullMessage;
  errorEl.appendChild(details);
}

export function restoreLastPreviewFromStorage() {
  try {
    resetPerfMarks('report');
    const raw = localStorage.getItem(REPORT_LAST_PREVIEW_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.rows)) return false;
    if (!payload.meta || typeof payload.meta !== 'object') payload.meta = {};
    payload.meta.fromCache = true;
    payload.meta.restoredFromLastSuccess = true;
    reportState.previewData = payload;
    reportState.previewRows = payload.rows || [];
    reportState.visibleRows = [...reportState.previewRows];
    reportState.visibleBoardRows = [...(payload.boards || [])];
    reportState.visibleSprintRows = sortSprintsLatestFirst(payload.sprintsIncluded || []);
    reportState.previewHasRows = reportState.previewRows.length > 0;
    renderPreview();
    markPerf('report', 'firstValueRendered', { firstValueSource: 'last-success-cache' });
    markPerf('report', 'fullRenderComplete');
    if (reportDom.previewContent) reportDom.previewContent.style.display = 'block';
    const statusEl = document.getElementById('preview-status');
    if (statusEl) {
      statusEl.innerHTML = '<div class="status-banner warning">Results may be stale - refresh?<button type="button" class="status-close" aria-label="Dismiss">x</button></div>';
      statusEl.style.display = 'block';
    }
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * When filters change while preview is visible, clear preview and show message so user does not mistake stale data for new selection.
 */
export function clearPreviewOnFilterChange() {
  cancelPreviewRequest();
  const { previewContent, errorEl, exportExcelBtn, exportDropdownTrigger } = reportDom;
  if (!previewContent || previewContent.style.display === 'none') return;
  const statusEl = document.getElementById('preview-status');
  if (statusEl) {
    statusEl.innerHTML = `
      <div class="status-banner warning">
        Filters changed. Refreshing automatically. Showing previous results until the updated preview is ready.
        <button type="button" class="status-close" aria-label="Dismiss">x</button>
      </div>
    `;
    statusEl.style.display = 'block';
  }
  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.innerHTML = '';
  }
  const stickyEl = document.getElementById('preview-summary-sticky');
  if (stickyEl) {
    stickyEl.textContent = '';
    stickyEl.setAttribute('aria-hidden', 'true');
  }
  if (exportExcelBtn) exportExcelBtn.disabled = true;
  if (exportDropdownTrigger) exportDropdownTrigger.disabled = true;
  updateExportHint();
}

let previewRunId = 0;
let currentPreviewController = null;

export function cancelPreviewRequest() {
  if (currentPreviewController) {
    try { currentPreviewController.abort(); } catch (_) {}
    currentPreviewController = null;
  }
}

export function initPreviewFlow() {
  const { previewBtn, exportDropdownTrigger, exportExcelBtn, loadingEl, errorEl, previewContent } = reportDom;
  if (!previewBtn) return;
  const oneClickCta = document.getElementById('report-one-click-cta');
  const oneClickHint = document.getElementById('report-one-click-cta-hint');
  if (oneClickCta && oneClickCta.dataset.bound !== '1') {
    oneClickCta.dataset.bound = '1';
    oneClickCta.addEventListener('click', () => {
      const checkedProjects = Array.from(document.querySelectorAll('.project-checkbox:checked')).length;
      if (checkedProjects === 0) {
        if (oneClickHint) oneClickHint.textContent = 'Pick at least one squad';
        return;
      }
      const lastQuarterPill = document.querySelector('.quarter-strip-inner .quarter-pill.is-current')
        || document.querySelector('.quarter-strip-inner .quarter-pill:not(.quarter-pill-custom)');
      if (lastQuarterPill && typeof lastQuarterPill.click === 'function') {
        lastQuarterPill.click();
      }
      if (oneClickHint) oneClickHint.textContent = '';
      window.setTimeout(() => previewBtn.click(), 40);
    });
  }

  const queueRetryPreview = () => {
    const tryClick = () => {
      if (previewBtn.disabled) return false;
      previewBtn.click();
      return true;
    };
    if (tryClick()) return;
    // Retry within the anti-double-click lock and force once if still blocked.
    let attempts = 0;
    const maxAttempts = 5;
    const retryTimer = setInterval(() => {
      attempts += 1;
      if (tryClick()) {
        clearInterval(retryTimer);
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(retryTimer);
        // Last resort for explicit user retry actions.
        previewBtn.disabled = false;
        tryClick();
      }
    }, 80);
  };

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!target || !('classList' in target)) return;

    if (target.classList.contains('status-close')) {
      const banner = target.closest('.status-banner');
      if (banner && banner.parentElement) {
        const container = banner.parentElement;
        container.innerHTML = '';
        if ('style' in container) {
          container.style.display = 'none';
        }
      }
    }

    if (target.classList.contains('error-close') || target.getAttribute('data-action') === 'dismiss-error') {
      if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.innerHTML = '';
      }
      const previewContentVisible = previewContent && previewContent.style.display !== 'none';
      if (!previewContentVisible) {
        const reportContextLine = document.getElementById('report-context-line');
        const loadLatestWrap = document.getElementById('report-load-latest-wrap');
        if (reportContextLine) reportContextLine.textContent = 'Preview failed. Use Load latest to retry.';
        if (typeof window.__reportSyncHeaderLoadLatestVisibility === 'function') window.__reportSyncHeaderLoadLatestVisibility(true);
        else if (loadLatestWrap) loadLatestWrap.style.display = 'inline';
      }
      if (!previewBtn.disabled && typeof previewBtn.focus === 'function') {
        previewBtn.focus();
      }
    }

    if (target.getAttribute && target.getAttribute('data-action') === 'trigger-export-excel') {
      triggerExcelExport();
    }

    if (target.getAttribute && target.getAttribute('data-action') === 'retry-preview') {
      queueRetryPreview();
    }

    if (target.getAttribute && target.getAttribute('data-action') === 'retry-with-smaller-range') {
      const endInput = document.getElementById('end-date');
      const startInput = document.getElementById('start-date');
      const narrowed = narrowDateWindow(endInput ? endInput.value : '', startInput ? startInput.value : '');
      const adjustedStart = narrowed.adjustedStart;
      const effectiveEnd = narrowed.effectiveEnd;
      if (startInput) {
        startInput.value = formatDateTimeLocalValue(adjustedStart);
        startInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (endInput) {
        endInput.value = formatDateTimeLocalValue(effectiveEnd);
        endInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      try {
        emitTelemetry('preview.retryNarrowedRange', {
          start: formatDateTimeLocalValue(adjustedStart),
          end: formatDateTimeLocalValue(effectiveEnd),
        });
      } catch (_) {}
      queueRetryPreview();
    }

    if (target.getAttribute && target.getAttribute('data-action') === 'toggle-done-stories-optional-columns') {
      const tab = document.getElementById('tab-done-stories');
      if (tab) {
        const show = !tab.classList.contains('show-optional-columns');
        tab.classList.toggle('show-optional-columns', show);
        target.setAttribute('aria-expanded', String(show));
        target.textContent = show ? 'Show fewer columns' : 'Show more columns (4)';
        persistDoneStoriesOptionalColumnsPreference(show);
      }
    }

    if (target.getAttribute && target.getAttribute('data-action') === 'toggle-done-stories-quarter-review') {
      const tab = document.getElementById('tab-done-stories');
      const content = document.getElementById('done-stories-content');
      if (!tab || !content) return;
      const enable = !tab.classList.contains('quarter-review-mode');
      tab.classList.toggle('quarter-review-mode', enable);
      target.setAttribute('aria-pressed', String(enable));
      target.textContent = enable ? 'Exit quarter review' : 'Quarter review mode';
      const sprintGroups = content.querySelectorAll('.sprint-group');
      sprintGroups.forEach((group) => {
        const header = group.querySelector('.sprint-header');
        const body = group.querySelector('.sprint-content');
        if (!header || !body) return;
        const icon = header.querySelector('.toggle-icon');
        if (enable) {
          body.style.display = 'block';
          body.style.height = 'auto';
          if (icon) icon.textContent = 'v';
        } else {
          body.style.display = 'none';
          body.style.height = '500px';
          if (icon) icon.textContent = '>';
        }
      });
    }

    if (target.getAttribute && target.getAttribute('data-action') === 'export-done-stories-focused') {
      const doneStoriesTabBtn = document.getElementById('tab-btn-done-stories');
      doneStoriesTabBtn?.click();
      const exportTrigger = document.getElementById('export-dropdown-trigger');
      if (exportTrigger && !exportTrigger.disabled) {
        exportTrigger.click();
        window.setTimeout(() => {
          document.querySelector('.export-dropdown-item[data-export="csv-active-tab"]')?.click();
        }, 0);
      }
    }
  });

  previewBtn.addEventListener('click', async () => {
    const previewRunStartedAt = Date.now();
    resetPerfMarks('report');
    reportState.previewInProgress = true;
    previewRunId += 1;
    const runIdForThisRequest = previewRunId;
    let timeoutId;
    let timeoutMs = PREVIEW_TIMEOUT_LIGHT_MS;
    let isLoading = true;
    const cachePrefix = 'reportPreview:';
    const bypassCache = previewBtn.dataset.bypassCache === 'true';
    if (bypassCache) {
      previewBtn.dataset.bypassCache = 'false';
    }

    const prevExportFilteredDisabled = exportDropdownTrigger ? exportDropdownTrigger.disabled : true;
    const prevExportExcelDisabled = exportExcelBtn ? exportExcelBtn.disabled : true;

    previewBtn.disabled = true;
    if (exportDropdownTrigger) exportDropdownTrigger.disabled = true;
    if (exportExcelBtn) exportExcelBtn.disabled = true;
    updateExportHint();
    setQuickRangeButtonsDisabled(true);

    if (loadingEl) {
      requestAnimationFrame(() => {
        if (isLoading) {
          setLoadingVisible(true);
          setLoadingStage(0, 'Syncing with Jira…');
          // M3: Show filter context above skeleton so users know WHAT is loading
          try {
            const ctxBar = document.getElementById('loading-context-bar');
            if (ctxBar) {
              const params = typeof collectFilterParams === 'function' ? collectFilterParams() : {};
              const proj = (params.projects || []).join(', ') || 'All projects';
              const start = params.startDate ? params.startDate.slice(0, 10) : '';
              const end = params.endDate ? params.endDate.slice(0, 10) : '';
              const range = start && end ? start + ' – ' + end : '';
              ctxBar.textContent = 'Loading: ' + proj + (range ? ' · ' + range : '');
              ctxBar.classList.add('visible');
            }
          } catch (_) {}
        }
      });
    }
    if (errorEl) errorEl.style.display = 'none';
    cancelPreviewRequest();

    const hasExistingPreview = !!reportState.previewData && previewContent && previewContent.style.display !== 'none';
    const statusEl = document.getElementById('preview-status');
    if (hasExistingPreview && statusEl) {
      statusEl.innerHTML = `
        <div class="status-banner info">
          Refreshing preview... Showing the last successful results while new data loads.
          <button type="button" class="status-close" aria-label="Dismiss">x</button>
        </div>
      `;
      statusEl.style.display = 'block';
    }

    if (!hasExistingPreview && previewContent) {
      previewContent.style.display = 'none';
    }

    let params;
    try {
      params = collectFilterParams();
    } catch (error) {
      reportState.previewInProgress = false;
      if (loadingEl) loadingEl.style.display = 'none';
      showReportError('Check filters', (error && typeof error.message === 'string') ? error.message : 'Please fix the filters above and try again.');
      previewBtn.disabled = false;
      previewBtn.textContent = 'Preview report';
      setQuickRangeButtonsDisabled(false);
      if (exportDropdownTrigger) exportDropdownTrigger.disabled = prevExportFilteredDisabled;
      if (exportExcelBtn) exportExcelBtn.disabled = prevExportExcelDisabled;
      if (error && typeof error.message === 'string') {
        if (error.message.toLowerCase().includes('start date')) {
          const startInput = document.getElementById('start-date');
          if (startInput && typeof startInput.focus === 'function') {
            startInput.focus();
          }
        } else if (error.message.toLowerCase().includes('end date')) {
          const endInput = document.getElementById('end-date');
          if (endInput && typeof endInput.focus === 'function') {
            endInput.focus();
          }
        } else if (error.message.toLowerCase().includes('at least one project')) {
          const firstProject = document.querySelector('.project-checkbox');
          if (firstProject && typeof firstProject.focus === 'function') {
            firstProject.focus();
          }
        }
      }
      return;
    }

    try {
      const previewAnchor =
        document.getElementById('preview-summary-sticky')
        || document.querySelector('.preview-area')
        || loadingEl;
      if (previewAnchor && typeof previewAnchor.scrollIntoView === 'function' && window.scrollY > window.innerHeight) {
        previewAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (_) {}

    if (bypassCache) {
      params.bypassCache = true;
    }

    const startMs = params.start ? new Date(params.start).getTime() : NaN;
    const endMs = params.end ? new Date(params.end).getTime() : NaN;
    const rangeDays = (!Number.isNaN(startMs) && !Number.isNaN(endMs))
      ? Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24))
      : null;

    const projectCount = params.projects
      ? params.projects.split(',').map((p) => p.trim()).filter(Boolean).length
      : 0;

    const { level: complexityLevel } = classifyPreviewComplexity({
      rangeDays,
      projectCount,
      includePredictability: params.includePredictability === true || params.includePredictability === 'true',
      includeActiveOrMissingEndDateSprints:
        params.includeActiveOrMissingEndDateSprints === true
        || params.includeActiveOrMissingEndDateSprints === 'true',
      requireResolvedBySprintEnd:
        params.requireResolvedBySprintEnd === true || params.requireResolvedBySprintEnd === 'true',
    });

    clearLoadingSteps();
    setLoadingStage(0, 'Syncing with Jira…', complexityLevel);

    const rangeHintEl = document.getElementById('range-hint');
    if (rangeHintEl) {
      if (!complexityLevel) {
        rangeHintEl.style.display = 'none';
      } else if (complexityLevel === 'light') {
        rangeHintEl.style.display = 'block';
        rangeHintEl.textContent = 'Fast range — usually under 30s for one quarter.';
      } else if (complexityLevel === 'normal') {
        rangeHintEl.style.display = 'block';
        rangeHintEl.textContent = 'Medium range — expect 30–60s; recent data returns first.';
      } else {
        rangeHintEl.style.display = 'block';
        rangeHintEl.textContent = 'Heavy range — 60–90s; latest 2 weeks first, then history.';
      }
    }

    let previewMode = 'normal';
    if (complexityLevel === 'heavy') {
      previewMode = 'recent-first';
    } else if (complexityLevel === 'veryHeavy') {
      previewMode = 'recent-only';
    }

    if (rangeDays && rangeDays > RECENT_SPLIT_DEFAULT_DAYS && previewMode !== 'recent-only') {
      params.splitRecent = true;
      params.recentDays = RECENT_SPLIT_DEFAULT_DAYS;
    }
    if (previewMode === 'recent-only') {
      params.splitRecent = true;
      params.recentDays = RECENT_SPLIT_DEFAULT_DAYS;
    }

    params.previewMode = previewMode;
    const clientBudgetMs = getClientBudgetMs(previewMode, rangeDays);
    params.clientBudgetMs = clientBudgetMs;
    // Prefer serving any usable cached preview first so users see value faster,
    // especially on heavy ranges, while the server refreshes in the background.
    params.preferCache = 'true';

    const queryString = new URLSearchParams(params).toString();
    const cacheKey = `${cachePrefix}${queryString}`;

    const readCachedPreview = () => {
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (_) {
        return null;
      }
    };

    const writeCachedPreview = (payload) => {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(payload));
      } catch (_) {}
    };

    const applyPreviewPayload = (payload, options = {}) => {
      if (runIdForThisRequest !== previewRunId) return;
      const { finalize = true, fromSessionCache = false } = options;
      if (!payload || typeof payload !== 'object') return;

      if (fromSessionCache && payload.meta) {
        payload.meta.fromCache = true;
      }

      try {
        sessionStorage.setItem(REPORT_HAS_RUN_PREVIEW_KEY, '1');
        const prev = reportState.previewData;
        if (prev && (prev.rows || []).length >= 0) {
          const prevRows = (prev.rows || []).length;
          const prevSprints = (prev.sprintsIncluded || []).length;
          const prevUnusable = (prev.sprintsUnusable || []).length;
          sessionStorage.setItem(
            REPORT_LAST_RUN_KEY,
            JSON.stringify({ doneStories: prevRows, sprintsCount: prevSprints, unusableCount: prevUnusable, at: Date.now() }),
          );
        }
        const meta = payload.meta || {};
        const ctxForHeader = {
          projects: Array.isArray(meta.selectedProjects) ? meta.selectedProjects : [],
          start: meta.windowStart || null,
          end: meta.windowEnd || null,
          generatedAt: meta.generatedAt || null,
          fromCache: meta.fromCache === true,
          partial: meta.partial === true,
          reducedScope: meta.reducedScope === true,
        };
        sessionStorage.setItem(REPORT_LAST_META_KEY, JSON.stringify(ctxForHeader));
      } catch (_) {}
      reportState.previewData = payload;
      reportState.previewRows = reportState.previewData.rows || [];
      reportState.visibleRows = [...reportState.previewRows];
      const boards = reportState.previewData.boards || [];
      const sprintsIncluded = reportState.previewData.sprintsIncluded || [];
      reportState.visibleBoardRows = [...boards];
      reportState.visibleSprintRows = sortSprintsLatestFirst(sprintsIncluded);
      reportState.previewHasRows = reportState.previewRows.length > 0;
      try {
        localStorage.setItem(REPORT_LAST_PREVIEW_KEY, JSON.stringify(payload));
      } catch (_) {}

      try {
        renderPreview();
        markPerf('report', 'firstValueRendered', { firstValueSource: fromSessionCache ? 'session-cache' : 'live' });
      } catch (renderErr) {
        if (errorEl) {
          setActionErrorOnEl(errorEl, {
            title: 'Error',
            message: 'Failed to render preview: ' + (renderErr.message || String(renderErr)),
            primaryLabel: 'Retry preview',
            primaryAction: 'retry-preview',
            dismissible: true,
          });
        }
      }

      if (!finalize) return;
      if (loadingEl) {
        loadingEl.style.display = 'none';
        loadingEl.setAttribute('aria-hidden', 'true');
      }
      if (previewContent) previewContent.style.display = 'block';
      try {
        window.dispatchEvent(new CustomEvent('report-preview-shown', { detail: { hasRows: reportState.previewHasRows } }));
        updateRangeHint();
      } catch (_) {}
      if (exportExcelBtn) {
        exportExcelBtn.disabled = !reportState.previewHasRows;
        exportExcelBtn.style.display = '';
      }
      if (exportDropdownTrigger) {
        exportDropdownTrigger.disabled = !reportState.previewHasRows;
        exportDropdownTrigger.style.display = '';
      }
      updateExportHint();
      updateExportFilteredState();
      markPerf('report', 'fullRenderComplete');
    };

    const cachedPreview = readCachedPreview();
    if (!hasExistingPreview && cachedPreview && statusEl && runIdForThisRequest === previewRunId) {
      applyPreviewPayload(cachedPreview, { finalize: false, fromSessionCache: true });
      statusEl.innerHTML = `
        <div class="status-banner info">
          Showing cached preview while refreshing with the latest data.
          <button type="button" class="status-close" aria-label="Dismiss">x</button>
        </div>
      `;
      statusEl.style.display = 'block';
    }

    const fetchStartMs = Date.now();
    try {
      setLoadingStage(1, 'Gathering sprint history…');
      startTheaterGathering(() => Date.now() - fetchStartMs);

      const controller = new AbortController();
      currentPreviewController = controller;
      timeoutMs = typeof clientBudgetMs === 'number' && clientBudgetMs > 0
        ? clientBudgetMs
        : PREVIEW_TIMEOUT_LIGHT_MS;
      timeoutId = setTimeout(() => {
        try { emitTelemetry('preview.timeout', { timeoutMs }); } catch (_) {}
        controller.abort();
      }, timeoutMs);

      // Emit telemetry that a preview fetch is starting (captured by tests)
      try { emitTelemetry('preview.fetch', { params: queryString }); } catch (_) {}

      const response = await fetch(`/preview.json?${queryString}`, { signal: controller.signal });

      if (timeoutId) clearTimeout(timeoutId);
      stopTheaterGathering();
      currentPreviewController = null;

      setLoadingStage(2, 'Computing delivery metrics…');

      const { data: responseJson, text: responseText } = await readResponseJson(response);

      if (!response.ok) {
        const errorMsg = responseJson?.message || responseJson?.error || responseText || 'Failed to fetch preview';
        const errorCode = responseJson?.code || 'UNKNOWN_ERROR';
        const is401 = response.status === 401;

        let displayMessage = errorMsg;
        if (is401) {
          displayMessage = 'Session expired. Sign in again to continue.';
        } else if (errorCode === 'NO_PROJECTS_SELECTED') {
          displayMessage = 'Please select at least one project before generating a preview.';
        } else if (errorCode === 'INVALID_DATE_FORMAT') {
          displayMessage = 'Invalid date format. Please ensure dates are properly formatted.';
        } else if (errorCode === 'INVALID_DATE_RANGE') {
          displayMessage = 'Invalid date range. The start date must be before the end date.';
        } else if (errorCode === 'AUTH_ERROR') {
          displayMessage = 'Authentication failed. Please check your Jira credentials in the server configuration.';
        } else if (errorCode === 'BOARD_FETCH_ERROR') {
          displayMessage = 'Unable to fetch sprint history for one or more boards. Retry preview or use a smaller date range.';
        } else if (errorCode === 'RATE_LIMIT_ERROR') {
          displayMessage = 'Jira API rate limit exceeded. Please wait a moment and try again.';
        } else if (errorCode === 'RATE_LIMIT_COOLDOWN') {
          displayMessage = 'Jira API has recently rate limited this report. Please wait around a minute and try again, or narrow the date range.';
        } else if (errorCode === 'NETWORK_ERROR') {
          displayMessage = 'Network error. Please check your connection and try again.';
        }

        try { emitTelemetry('preview.error', { code: errorCode, message: displayMessage }); } catch (_) {}
        const err = new Error(displayMessage);
        if (is401) err.sessionExpired = true;
        throw err;
      }

      setLoadingStage(3, 'Preparing your report…');

      if (!responseJson) {
        throw new Error('Preview response was not valid JSON. Please check server logs and try again.');
      }

      writeCachedPreview(responseJson);

      setLoadingStage(4, 'Final checks…');
      if (runIdForThisRequest === previewRunId) applyPreviewPayload(responseJson);
      try {
        warmCurrentSprintJourney(responseJson?.meta?.selectedProjects || []);
      } catch (_) {}
      try {
        const params = collectFilterParams();
        if (params?.projects && params?.start && params?.end) {
          try {
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.removeItem(REPORT_FILTERS_STALE_KEY);
            }
          } catch (_) {}
          localStorage.setItem(LAST_QUERY_KEY, JSON.stringify({
            projects: params.projects,
            start: params.start,
            end: params.end,
          }));
          if (typeof window.__refreshReportingContextBar === 'function') {
            window.__refreshReportingContextBar();
          }
        }
      } catch (_) {}
      const boards = responseJson?.boards || [];
      try { emitTelemetry('preview.complete', { rows: reportState.previewRows.length || 0, boards: (boards || []).length || 0 }); } catch (_) {}
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      stopTheaterGathering();
      resetLoadingBarToZero();
      currentPreviewController = null;

      if (loadingEl) {
        loadingEl.style.display = 'none';
        loadingEl.setAttribute('aria-hidden', 'true');
      }
      if (errorEl) errorEl.style.display = 'block';

      let errorMsg = (error && error.message) ? String(error.message) : 'Failed to fetch preview. Please try again.';
      if (error && error.name === 'AbortError') {
        const seconds = (typeof timeoutMs === 'number' && timeoutMs > 0) ? Math.round(timeoutMs / 1000) : 60;
        if (hasExistingPreview) {
          errorMsg = `Preview timed out after ${seconds}s. Your previous results are still shown below. For a faster answer, use a smaller date window or fewer projects.`;
        } else {
          errorMsg = `Preview timed out after ${seconds}s before any results were ready. Try a smaller date window or fewer projects.`;
        }
      }

      try { emitTelemetry('preview.failure', { message: errorMsg || String(error) }); } catch (_) {}

      let shortText = 'Server error';
      if (error && error.sessionExpired) shortText = 'Session expired';
      else if (error && error.name === 'AbortError') shortText = 'Preview timed out';
      else if (/fetch|network|failed to fetch/i.test(errorMsg || '')) shortText = 'Request failed';

      if (errorEl) {
      try {
          const redirectReport = escapeHtml(window.location.pathname + window.location.search + window.location.hash);
          if (error && error.sessionExpired) {
            setActionErrorOnEl(errorEl, {
              title: 'Session expired',
              message: 'Sign in again to continue.',
              primaryLabel: 'Open sign in',
              primaryAction: '',
              secondaryHref: '/?redirect=' + redirectReport,
              secondaryLabel: 'Sign in',
              dismissible: true,
            });
          } else {
            setActionErrorOnEl(errorEl, {
              title: shortText,
              message: errorMsg,
              primaryLabel: 'Try smaller date range',
              primaryAction: 'retry-with-smaller-range',
              secondaryActionLabel: 'Retry preview',
              secondaryAction: 'retry-preview',
              dismissible: true,
            });
            const details = document.createElement('div');
            details.className = 'error-details';
            details.style.display = 'none';
            details.textContent = errorMsg;
            errorEl.appendChild(details);
          }
        } catch (innerErr) {
          console.error('Error rendering preview error UI', innerErr);
          setActionErrorOnEl(errorEl, {
            title: 'Server error',
            message: 'Please try again or use a smaller date range.',
            primaryLabel: 'Retry preview',
            primaryAction: 'retry-preview',
            dismissible: true,
          });
        }
      }
      if (statusEl) {
        if (hasExistingPreview) {
          statusEl.innerHTML = `
            <div class="status-banner warning">
              Refresh failed. Showing the last successful preview.
              <br><small>Try narrowing date range or projects to reduce load.</small>
              <button type="button" class="status-close" aria-label="Dismiss">x</button>
            </div>
          `;
          statusEl.style.display = 'block';
          if (previewContent) previewContent.style.display = 'block';
        } else {
          statusEl.innerHTML = '';
          statusEl.style.display = 'none';
        }
      }
      if (!hasExistingPreview) {
        const reportContextLine = document.getElementById('report-context-line');
        const loadLatestWrap = document.getElementById('report-load-latest-wrap');
        if (reportContextLine) reportContextLine.textContent = 'Preview failed. Use Load latest to retry.';
        if (loadLatestWrap) loadLatestWrap.style.display = 'inline';
      }
      // Ensure error panel is never blank (trust).
      if (errorEl && errorEl.style.display === 'block' && (!errorEl.textContent || errorEl.textContent.trim() === '')) {
        setActionErrorOnEl(errorEl, {
          title: 'Error',
          message: 'Something went wrong. Please try again or use a smaller date range.',
          primaryLabel: 'Retry preview',
          primaryAction: 'retry-preview',
          dismissible: true,
        });
      }
    } finally {
      isLoading = false;
      currentPreviewController = null;
      try {
        hideLoadingIfVisible();
        clearLoadingSteps();
        const previewArea = document.querySelector('.preview-area');
        if (previewArea) previewArea.setAttribute('aria-busy', 'false');
      } catch (e) {}

      if (timeoutId) clearTimeout(timeoutId);
      stopTheaterGathering();

      const restorePreviewControls = () => {
        reportState.previewInProgress = false;
        previewBtn.disabled = false;
        if (typeof window.__refreshReportingContextBar === 'function') window.__refreshReportingContextBar();
        setQuickRangeButtonsDisabled(false);
      };
      const elapsedMs = Date.now() - previewRunStartedAt;
      const minDisabledMs = 500;
      if (elapsedMs < minDisabledMs) setTimeout(restorePreviewControls, minDisabledMs - elapsedMs);
      else restorePreviewControls();

      const hasRows = Array.isArray(reportState.previewRows) && reportState.previewRows.length > 0;
      if (exportDropdownTrigger) {
        exportDropdownTrigger.disabled = !hasRows;
        exportDropdownTrigger.style.display = '';
      }
      if (exportExcelBtn) {
        exportExcelBtn.disabled = !hasRows;
        exportExcelBtn.style.display = '';
      }
      updateExportHint();
    }
  });

  // Reliability edge case: if user navigates away mid-request, cancel in-flight preview.
  window.addEventListener('pagehide', () => cancelPreviewRequest(), { once: true });
  window.addEventListener('beforeunload', () => cancelPreviewRequest(), { once: true });
}
