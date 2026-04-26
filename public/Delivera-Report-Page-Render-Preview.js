import { reportDom } from './Delivera-Report-Page-Context.js';
import { reportState } from './Delivera-Report-Page-State.js';
import { getSafeMeta } from './Delivera-Report-Page-Render-Helpers.js';
import { buildPreviewMetaAndStatus } from './Delivera-Report-Page-Render-Preview-01Meta.js';
import { renderSidebarContextCard } from './Delivera-Shared-Context-From-Storage.js';
import { scheduleRender } from './Delivera-Report-Page-Loading-Steps.js';
import { updateDateDisplay } from './Delivera-Report-Page-DateRange-Controller.js';
import {
  populateBoardsPills,
  populateSprintsPills,
  renderProjectEpicLevelTab,
  renderSprintsTab,
  renderDoneStoriesTab,
  renderUnusableSprintsTab,
  renderTrendsTab,
  updateExportFilteredState,
} from './Delivera-Report-Page-Render-Registry.js';
import { applyDoneStoriesOptionalColumnsPreference } from './Delivera-Report-Page-DoneStories-Column-Preference.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { emitTelemetry } from './Delivera-Shared-Telemetry.js';
import { updateAppliedFiltersSummary } from './Delivera-Report-Page-Filters-Summary-Helpers.js';

/**
 * Aligns `body.preview-active` with whether the preview shell is actually shown and has payload.
 * Keeps sidebar compact/trust card from sticking when preview is hidden or cleared.
 */
export function syncReportPreviewActiveFromDom() {
  try {
    if (typeof document === 'undefined' || !document.body?.classList.contains('report-page')) return;
    const pc = document.getElementById('preview-content');
    const display = pc ? String(pc.style.display || '').trim() : 'none';
    const notHidden = display !== 'none';
    const laidOut = !!pc && pc.offsetParent !== null;
    const should = notHidden && laidOut && !!reportState.previewData;
    document.body.classList.toggle('preview-active', should);
    renderSidebarContextCard();
  } catch (_) {}
}

try {
  if (typeof window !== 'undefined' && window.__DELIVERA_TEST_DISABLE_AUTO_PREVIEW) {
    window.__DELIVERA_SYNC_PREVIEW_ACTIVE_FOR_TESTS = syncReportPreviewActiveFromDom;
  }
} catch (_) {}

export function wirePreviewContextActions() {
  if (typeof document === 'undefined' || document.body?.dataset.previewContextActionsBound === '1') return;
  document.body.dataset.previewContextActionsBound = '1';
  document.addEventListener('click', (event) => {
    // Details toggle for collapsed meta panel
    const detailsToggle = event.target.closest('.preview-context-details-toggle');
    if (detailsToggle) {
      event.preventDefault();
      const panelId = detailsToggle.getAttribute('aria-controls');
      const panel = panelId ? document.getElementById(panelId) : null;
      if (panel) {
        const expanded = detailsToggle.getAttribute('aria-expanded') === 'true';
        panel.hidden = expanded;
        detailsToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        detailsToggle.textContent = expanded ? 'Details' : 'Details x';
      }
      return;
    }
    const trigger = event.target.closest('[data-preview-context-action], [data-attention-action]');
    if (!trigger) return;
    const action = trigger.getAttribute('data-preview-context-action') || trigger.getAttribute('data-attention-action') || '';
    const sharedHandler = typeof window !== 'undefined' ? window.__deliveraHandleReportChromeAction : null;
    if (typeof sharedHandler === 'function' && sharedHandler(action)) {
      event.preventDefault();
      if (action === 'open-owned-blockers' || action === 'open-unowned-outcomes') {
        const riskTags = action === 'open-owned-blockers' ? ['blocker'] : ['unassigned'];
        window.setTimeout(() => {
          try {
            window.dispatchEvent(new CustomEvent('report:applyOutcomeRiskFilter', {
              detail: { riskTags, source: action },
            }));
          } catch (_) {}
        }, 80);
      }
      if (action === 'open-done-stories') {
        try {
          if (window.location.pathname.endsWith('/report')) {
            history.replaceState(null, '', '/report#tab-done-stories');
          }
        } catch (_) {}
      }
      return;
    }
    const tabMap = {
      'open-sprints': 'tab-btn-sprints',
      'open-owned-blockers': 'tab-btn-done-stories',
      'open-unowned-outcomes': 'tab-btn-done-stories',
    };
    if (tabMap[action]) {
      event.preventDefault();
      document.getElementById(tabMap[action])?.click();
      if (action === 'open-owned-blockers' || action === 'open-unowned-outcomes') {
        const riskTags = action === 'open-owned-blockers' ? ['blocker'] : ['unassigned'];
        window.setTimeout(() => {
          try {
            window.dispatchEvent(new CustomEvent('report:applyOutcomeRiskFilter', {
              detail: { riskTags, source: action },
            }));
          } catch (_) {}
        }, 80);
      }
    }
  });
}

export function renderPreview() {
  const { previewData, previewRows, visibleRows, visibleBoardRows, visibleSprintRows } = reportState;
  const { errorEl, previewContent, previewMeta, exportExcelBtn, exportDropdownTrigger } = reportDom;
  if (!previewData) {
    syncReportPreviewActiveFromDom();
    return;
  }

  const reportContextLine = document.getElementById('report-context-line');
  const loadLatestWrap = document.getElementById('report-load-latest-wrap');
  const oneClickWrap = document.getElementById('report-one-click-cta-wrap');
  const previewBtn = document.getElementById('preview-btn');
  if (typeof window.__reportSyncHeaderLoadLatestVisibility === 'function') window.__reportSyncHeaderLoadLatestVisibility(false);
  else if (loadLatestWrap) loadLatestWrap.style.display = 'none';
  const meta = getSafeMeta(previewData);
  if (!meta) {
    const stickyElNoMeta = document.getElementById('preview-summary-sticky');
    if (stickyElNoMeta) {
      stickyElNoMeta.setAttribute('aria-hidden', 'true');
      stickyElNoMeta.textContent = '';
    }
    if (errorEl) {
      errorEl.style.display = 'block';
      errorEl.innerHTML = `
        <strong>Error:</strong> Preview metadata is missing or invalid.
        <br><small>Please refresh the page, run the preview again, or contact an administrator if the problem persists.</small>
        <button type="button" class="error-close" aria-label="Dismiss">x</button>
      `;
    }
    if (previewContent) previewContent.style.display = 'none';
    if (exportExcelBtn) exportExcelBtn.disabled = true;
    if (exportDropdownTrigger) exportDropdownTrigger.disabled = true;
    syncReportPreviewActiveFromDom();
    return;
  }

  const boardsCount = previewData.boards?.length || 0;
  const sprintsCount = previewData.sprintsIncluded?.length || 0;
  const rowsCount = (previewData.rows || []).length;
  const unusableCount = previewData.sprintsUnusable?.length || 0;
  const partial = meta.partial === true;

  const metaBlock = buildPreviewMetaAndStatus({
    meta,
    previewRows,
    boardsCount,
    sprintsCount,
    rowsCount,
    unusableCount,
    compactOutcomeScope: true,
  });
  const reportSubtitleEl = document.getElementById('report-subtitle');
  if (reportSubtitleEl) {
    reportSubtitleEl.textContent = rowsCount > 0
      ? ('View: ' + metaBlock.reportSubtitleText.replace(/^Projects:\s*/i, ''))
      : 'Outcomes, delivery trend, and data trust.';
    reportSubtitleEl.style.display = '';
  }
  if (previewMeta) {
    // Context chips live only in #report-filter-strip-summary (updateAppliedFiltersSummary) to avoid stacked duplicates.
    previewMeta.innerHTML = `
      ${metaBlock.reportExecutiveHeroHtml || ''}
      ${metaBlock.previewHeaderStoryHtml || ''}
      ${metaBlock.outcomeLineHTML || ''}
      ${metaBlock.attentionQueueHtml || ''}
      ${metaBlock.previewMetaHTML}
    `;
  }
  if (reportContextLine) {
    reportContextLine.textContent = '';
    reportContextLine.setAttribute('aria-hidden', 'true');
    reportContextLine.style.display = 'none';
  }
  if (oneClickWrap) oneClickWrap.style.display = rowsCount > 0 ? 'none' : '';
  updateAppliedFiltersSummary();
  if (previewBtn && rowsCount > 0) {
    previewBtn.classList.remove('btn-primary');
    previewBtn.classList.add('btn-secondary');
    previewBtn.textContent = 'Refresh';
    previewBtn.title = 'Refresh report results for current filters.';
  }
  const stickyEl = document.getElementById('preview-summary-sticky');
  if (stickyEl) {
    stickyEl.textContent = metaBlock.previewHeaderStoryHtml
      ? String(metaBlock.previewHeaderStoryHtml).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : `Preview: ${metaBlock.reportSubtitleText}`;
    stickyEl.setAttribute('aria-hidden', 'false');
  }
  const filtersPanel = document.getElementById('filters-panel');
  const filtersPanelBody = document.getElementById('filters-panel-body');
  const filtersCollapsedBar = document.getElementById('filters-panel-collapsed-bar');
  if (filtersPanel) {
    filtersPanel.classList.add('collapsed');
    filtersPanel.classList.remove('expanded');
  }
  if (filtersPanelBody) filtersPanelBody.style.display = 'none';
  if (filtersCollapsedBar) {
    filtersCollapsedBar.style.display = 'none';
    filtersCollapsedBar.setAttribute('aria-hidden', 'true');
  }
  document.querySelectorAll('[data-action="toggle-filters"]').forEach((button) => {
    button.textContent = 'Filters';
    button.setAttribute('aria-expanded', 'false');
  });
  wirePreviewContextActions();
  const statusEl = document.getElementById('preview-status');
  if (statusEl) {
    statusEl.innerHTML = '';
    statusEl.style.display = 'none';
  }
  const statusStripEl = document.getElementById('preview-status-strip');
  if (statusStripEl) {
    const jiraProjErr = Array.isArray(meta.jiraProjectErrors) && meta.jiraProjectErrors.length > 0;
    if (jiraProjErr) {
      const keys = meta.jiraProjectErrors.map((e) => escapeHtml(String(e.projectKey || '?'))).join(', ');
      statusStripEl.textContent =
        `Jira could not load project(s): ${keys}. The report shows other projects only. Deselect failing keys or fix Jira access.`;
      statusStripEl.setAttribute('data-state', 'warning');
      statusStripEl.style.display = '';
      try {
        emitTelemetry('boards.warning', {
          projectKeys: meta.jiraProjectErrors.map((e) => e.projectKey),
          codes: meta.jiraProjectErrors.map((e) => e.code),
        });
      } catch (_) {}
    } else {
      const hasAlertState = partial || meta.reducedScope;
      const stateLabel = partial ? 'Results: partial data' : (meta.reducedScope ? 'Results: closest match' : 'Results: direct-to-value actions available');
      const sprintHref = '/current-sprint';
      statusStripEl.innerHTML = hasAlertState
        ? escapeHtml(stateLabel)
        : `${escapeHtml(stateLabel)} <a class="preview-status-inline-link" href="${escapeHtml(sprintHref)}">Open sprint actions</a>`;
      statusStripEl.setAttribute('data-state', partial ? 'partial' : (meta.reducedScope ? 'closest' : 'fresh'));
      statusStripEl.style.display = '';
    }
  }

  const hasRows = rowsCount > 0;
  const allowPrimaryExport = hasRows && meta.restoredFromLastSuccess !== true;
  if (exportDropdownTrigger) {
    exportDropdownTrigger.disabled = !hasRows;
    exportDropdownTrigger.hidden = true;
  }
  if (exportExcelBtn) {
    exportExcelBtn.disabled = !hasRows;
    exportExcelBtn.hidden = !allowPrimaryExport;
  }

  const exportHint = document.getElementById('export-hint');
  if (exportHint) {
    if (!hasRows) {
      exportHint.innerHTML = '<small>Generate a report with data to enable export.</small>';
    } else if (partial) {
      exportHint.innerHTML = '<small>Export matches the partial preview shown.</small>';
    } else if (meta.reducedScope) {
      exportHint.innerHTML = '<small>Export matches the closest available scope shown.</small>';
    } else {
      exportHint.innerHTML = '';
    }
    exportHint.title = '';
  }
  const tabHintEl = document.getElementById('tab-outcome-hint');
  if (tabHintEl) {
    tabHintEl.style.display = rowsCount > 0 ? 'none' : '';
  }

  const partialExportTitle = 'Export contains only loaded (partial) data.';
  if (exportDropdownTrigger) {
    exportDropdownTrigger.title = partial ? partialExportTitle : '';
    if (partial) exportDropdownTrigger.setAttribute('aria-label', partialExportTitle);
    else exportDropdownTrigger.removeAttribute('aria-label');
  }
  if (exportExcelBtn) {
    exportExcelBtn.title = partial ? partialExportTitle : '';
    if (partial) exportExcelBtn.setAttribute('aria-label', partialExportTitle);
    else exportExcelBtn.removeAttribute('aria-label');
    const exportWrap = exportExcelBtn.parentElement;
    if (exportWrap) {
      const existing = exportWrap.querySelector('.partial-data-inline');
      if (existing) existing.remove();
      if (partial) {
        const span = document.createElement('span');
        span.className = 'partial-data-inline';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = ' (partial data)';
        exportExcelBtn.after(span);
      }
    }
  }
  const exportTriggerEl = document.getElementById('export-dropdown-trigger');
  if (exportTriggerEl) exportTriggerEl.hidden = true;

  updateDateDisplay();
  renderSidebarContextCard();

  try {
    const ageMs = meta.cacheAgeMs ?? 0;
    const ageMins = Math.round(ageMs / 60000);
    const freshLabel = ageMins < 1 ? 'Just updated' : (ageMins < 60 ? 'Updated ' + ageMins + ' min ago' : 'Older snapshot — refresh when ready');
    const freshState = ageMins > 30 ? 'stale' : 'live';
    window.dispatchEvent(new CustomEvent('app:data-freshness', { detail: { label: freshLabel, state: freshState } }));
  } catch (_) {}

  scheduleRender(() => {
    populateBoardsPills();
    populateSprintsPills();
    renderProjectEpicLevelTab(visibleBoardRows, previewData.metrics);
    renderSprintsTab(visibleSprintRows, previewData.metrics);
    renderDoneStoriesTab(visibleRows);
    renderUnusableSprintsTab(previewData.sprintsUnusable);
    renderTrendsTab(previewData);
    applyDoneStoriesOptionalColumnsPreference();

    const boardsCountForTab = previewData.boards?.length ?? 0;
    const sprintsCountForTab = previewData.sprintsIncluded?.length ?? 0;
    const unusableCountForTab = previewData.sprintsUnusable?.length ?? 0;
    const tabBoards = document.getElementById('tab-btn-project-epic-level');
    const tabSprints = document.getElementById('tab-btn-sprints');
    const tabDoneStories = document.getElementById('tab-btn-done-stories');
    const tabUnusable = document.getElementById('tab-btn-unusable-sprints');
    // Update tab label text while preserving subtitle spans
    const compactTabs = !!(window.matchMedia && window.matchMedia('(max-width: 1024px)').matches);
    function setTabLabel(btn, text, compactText) {
      if (!btn) return;
      const finalText = compactTabs && compactText ? compactText : text;
      const labelEl = btn.querySelector('.tab-btn-label');
      if (labelEl) labelEl.textContent = finalText;
      else btn.textContent = finalText;
    }
    setTabLabel(tabBoards, 'Overview (' + boardsCountForTab + ')', 'Overview ' + boardsCountForTab);
    setTabLabel(tabSprints, 'Sprint delivery (' + sprintsCountForTab + ')', 'Sprint delivery ' + sprintsCountForTab);
    if (tabDoneStories) {
      const totalDoneStories = Array.isArray(reportState.previewRows) ? reportState.previewRows.length : rowsCount;
      const baseLabel = totalDoneStories === 0 ? 'Value delivery (0)' : ('Value delivery (Total: ' + totalDoneStories + ')');
      setTabLabel(tabDoneStories, baseLabel, 'Value delivery ' + totalDoneStories);
      tabDoneStories.title = totalDoneStories === 0
        ? 'No done stories in this window; check dates or Jira hygiene.'
        : (meta.partial ? 'Partial preview: count reflects loaded outcomes only.' : 'Total done stories in the selected window.');
    }
    setTabLabel(tabUnusable, 'Data trust (' + unusableCountForTab + ')', 'Data trust ' + unusableCountForTab);
    const tabTrends = document.getElementById('tab-btn-trends');
    setTabLabel(tabTrends, 'Leadership', 'Leadership');
    if (tabTrends) {
      tabTrends.title = 'Predictability, rework, epic time-to-market, and quarterly KPIs for this window.';
    }
    const hash = window.location && window.location.hash ? window.location.hash : '';
    if (hash === '#trends') {
      const trendsBtn = document.getElementById('tab-btn-trends');
      if (trendsBtn && !trendsBtn.classList.contains('active')) trendsBtn.click();
    } else if (hash === '#tab-done-stories') {
      tabDoneStories?.click();
      window.setTimeout(() => {
        document.querySelector('#done-stories-content .sprint-header')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }, 80);
    } else if (tabBoards && !tabBoards.classList.contains('active')) {
      tabBoards.click();
    }

    updateExportFilteredState();

    // Keep the report shell stable after preview render. Users asked for less
    // surprise scrolling; explicit chips and tabs still perform targeted jumps.
  });

  syncReportPreviewActiveFromDom();

  const statusStripElAfter = document.getElementById('preview-status-strip');
  if (statusStripElAfter && !statusStripElAfter.textContent) {
    const ageMs = Number(meta.cacheAgeMs || 0);
    const ageMins = Math.round(ageMs / 60000);
    const statusText = ageMins > 30 ? 'Older snapshot - refresh when ready' : 'Just updated';
    statusStripElAfter.innerHTML = `${escapeHtml(statusText)} <a class="preview-status-inline-link" href="/current-sprint">Open sprint actions</a>`;
    statusStripElAfter.setAttribute('data-state', ageMins > 30 ? 'stale' : 'fresh');
    statusStripElAfter.style.display = '';
  }
}
