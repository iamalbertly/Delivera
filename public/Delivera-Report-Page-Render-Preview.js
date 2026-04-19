import { reportDom } from './Reporting-App-Report-Page-Context.js';
import { reportState } from './Reporting-App-Report-Page-State.js';
import { getSafeMeta } from './Reporting-App-Report-Page-Render-Helpers.js';
import { buildPreviewMetaAndStatus } from './Reporting-App-Report-Page-Render-Preview-01Meta.js';
import {
  buildActiveFiltersContextLabel,
  buildReportRangeLabel,
  getContextDisplayString,
  renderSidebarContextCard,
} from './Reporting-App-Shared-Context-From-Storage.js';
import { renderContextBar } from './Reporting-App-Shared-ContextBar-Renderer.js';
import { REPORT_CONTEXT_BAR_TITLE, buildUnifiedReportContextChips } from './Reporting-App-Report-Page-ContextBar-Build.js';
import { scheduleRender } from './Reporting-App-Report-Page-Loading-Steps.js';
import { updateDateDisplay } from './Reporting-App-Report-Page-DateRange-Controller.js';
import {
  populateBoardsPills,
  populateSprintsPills,
  renderProjectEpicLevelTab,
  renderSprintsTab,
  renderDoneStoriesTab,
  renderUnusableSprintsTab,
  renderTrendsTab,
  updateExportFilteredState,
} from './Reporting-App-Report-Page-Render-Registry.js';
import { applyDoneStoriesOptionalColumnsPreference } from './Reporting-App-Report-Page-DoneStories-Column-Preference.js';

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
    const filtersPanel = document.getElementById('filters-panel');
    const filtersToggle = document.querySelector('[data-action="toggle-filters"]');
    const openFiltersPanel = () => {
      if (filtersPanel?.classList.contains('collapsed') && filtersToggle) {
        filtersToggle.click();
      }
    };
    if (action === 'open-projects') {
      event.preventDefault();
      openFiltersPanel();
      document.getElementById('project-search')?.focus();
      return;
    }
    if (action === 'open-range') {
      event.preventDefault();
      openFiltersPanel();
      document.getElementById('start-date')?.focus();
      return;
    }
    if (action === 'focus-config') {
      event.preventDefault();
      openFiltersPanel();
      const rulesTile = document.getElementById('report-rules-tile');
      const advanced = document.getElementById('advanced-options-toggle');
      if (rulesTile && !rulesTile.open) rulesTile.open = true;
      advanced?.focus();
      return;
    }
    const tabMap = {
      'open-boards': 'tab-btn-project-epic-level',
      'open-sprints': 'tab-btn-sprints',
      'open-done-stories': 'tab-btn-done-stories',
      'open-unusable-sprints': 'tab-btn-unusable-sprints',
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
      if (action === 'open-done-stories') {
        try {
          if (window.location.pathname.endsWith('/report')) {
            history.replaceState(null, '', '/report#tab-done-stories');
          }
        } catch (_) {}
        window.setTimeout(() => {
          const firstSprintHeader = document.querySelector('#done-stories-content .sprint-header');
          firstSprintHeader?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        }, 80);
      }
    }
  });
}

export function renderPreview() {
  const { previewData, previewRows, visibleRows, visibleBoardRows, visibleSprintRows } = reportState;
  const { errorEl, previewContent, previewMeta, exportExcelBtn, exportDropdownTrigger } = reportDom;
  if (!previewData) return;

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
    return;
  }

  const boardsCount = previewData.boards?.length || 0;
  const sprintsCount = previewData.sprintsIncluded?.length || 0;
  const rowsCount = (previewData.rows || []).length;
  const unusableCount = previewData.sprintsUnusable?.length || 0;
  const partial = meta.partial === true;

  const metaBlock = buildPreviewMetaAndStatus({ meta, previewRows, boardsCount, sprintsCount, rowsCount, unusableCount });
  const reportSubtitleEl = document.getElementById('report-subtitle');
  if (reportSubtitleEl) {
    reportSubtitleEl.textContent = rowsCount > 0
      ? ('View: ' + metaBlock.reportSubtitleText.replace(/^Projects:\s*/i, ''))
      : 'History mission control for squads, range, and delivery signals.';
    reportSubtitleEl.style.display = '';
  }
  if (previewMeta) {
    // Shared SSOT ContextBar: one rail (same chip builder as header strip pre-preview).
    let contextBarHtml = '';
    try {
      const chips = buildUnifiedReportContextChips({ outcomesCount: rowsCount });
      const secondary = rowsCount > 0
        ? `${rowsCount} stor${rowsCount === 1 ? 'y' : 'ies'} | ${sprintsCount} sprint${sprintsCount === 1 ? '' : 's'} | ${boardsCount} board${boardsCount === 1 ? '' : 's'}`
        : 'Run preview to see outcome stories, sprints, and boards.';
      contextBarHtml = renderContextBar({
        title: REPORT_CONTEXT_BAR_TITLE,
        chips,
        secondary,
      });
    } catch (_) {
      contextBarHtml = '';
    }
    previewMeta.innerHTML = `
      ${contextBarHtml}
      ${metaBlock.previewMetaHTML}
    `;
  }
  if (reportContextLine) {
    reportContextLine.textContent = '';
    reportContextLine.setAttribute('aria-hidden', 'true');
    reportContextLine.style.display = 'none';
  }
  if (oneClickWrap) oneClickWrap.style.display = rowsCount > 0 ? 'none' : '';
  const filterStripSummary = document.getElementById('report-filter-strip-summary');
  if (filterStripSummary) {
    filterStripSummary.textContent = rowsCount > 0 ? 'Saved views' : 'Filter by: projects, range, rules';
  }
  if (previewBtn && rowsCount > 0) {
    previewBtn.classList.remove('btn-primary');
    previewBtn.classList.add('btn-secondary');
    previewBtn.textContent = 'Refresh';
    previewBtn.title = 'Refresh report results for current filters.';
  }
  const stickyEl = document.getElementById('preview-summary-sticky');
  if (stickyEl) {
    stickyEl.textContent = '';
    stickyEl.setAttribute('aria-hidden', 'true');
    // M4: Add body class so mobile CSS can hide duplicate applied-filters-summary
    document.body.classList.add('preview-active');
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
    const hasAlertState = partial || meta.reducedScope;
    statusStripEl.textContent = partial ? 'Results: partial data' : (meta.reducedScope ? 'Results: closest match' : '');
    statusStripEl.setAttribute('data-state', partial ? 'partial' : (meta.reducedScope ? 'closest' : 'fresh'));
    statusStripEl.style.display = hasAlertState ? '' : 'none';
  }

  const hasRows = rowsCount > 0;
  if (exportDropdownTrigger) exportDropdownTrigger.disabled = !hasRows;
  if (exportExcelBtn) exportExcelBtn.disabled = !hasRows;

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
    const freshLabel = ageMins < 1 ? 'Just updated' : (ageMins < 60 ? 'Updated ' + ageMins + ' min ago' : 'Stale - refresh recommended');
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
    setTabLabel(tabSprints, 'Sprints (' + sprintsCountForTab + ')', 'Sprints ' + sprintsCountForTab);
    if (tabDoneStories) {
      const totalDoneStories = Array.isArray(reportState.previewRows) ? reportState.previewRows.length : rowsCount;
      const baseLabel = totalDoneStories === 0 ? 'Outcomes (0)' : ('Outcomes (Total: ' + totalDoneStories + ')');
      setTabLabel(tabDoneStories, baseLabel, 'Outcomes ' + totalDoneStories);
      tabDoneStories.title = totalDoneStories === 0
        ? 'No done stories in this window; check dates or Jira hygiene.'
        : (meta.partial ? 'Partial preview: count reflects loaded outcomes only.' : 'Total done stories in the selected window.');
    }
    setTabLabel(tabUnusable, 'Repair center (' + unusableCountForTab + ')', 'Repair ' + unusableCountForTab);
    const tabTrends = document.getElementById('tab-btn-trends');
    setTabLabel(tabTrends, 'Leadership HUD ->', 'Leadership');
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
  });

  const statusStripElAfter = document.getElementById('preview-status-strip');
  if (statusStripElAfter && !statusStripElAfter.textContent) {
    const ageMs = Number(meta.cacheAgeMs || 0);
    const ageMins = Math.round(ageMs / 60000);
    statusStripElAfter.textContent = ageMins > 30 ? 'Stale - refresh recommended' : 'Just updated';
    statusStripElAfter.setAttribute('data-state', ageMins > 30 ? 'stale' : 'fresh');
    statusStripElAfter.style.display = '';
  }
}
