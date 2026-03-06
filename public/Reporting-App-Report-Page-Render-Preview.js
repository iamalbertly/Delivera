import { reportDom } from './Reporting-App-Report-Page-Context.js';
import { reportState } from './Reporting-App-Report-Page-State.js';
import { getSafeMeta } from './Reporting-App-Report-Page-Render-Helpers.js';
import { buildPreviewMetaAndStatus } from './Reporting-App-Report-Page-Render-Preview-01Meta.js';
import { getContextDisplayString, renderSidebarContextCard } from './Reporting-App-Shared-Context-From-Storage.js';
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

function wirePreviewContextActions() {
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
        detailsToggle.textContent = expanded ? 'Details' : 'Details ✕';
      }
      return;
    }
    const trigger = event.target.closest('[data-preview-context-action]');
    if (!trigger) return;
    const action = trigger.getAttribute('data-preview-context-action') || '';
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
      const advanced = document.getElementById('advanced-options-toggle');
      if (advanced && advanced.getAttribute('aria-expanded') !== 'true') advanced.click();
      advanced?.focus();
      return;
    }
    const tabMap = {
      'open-boards': 'tab-btn-project-epic-level',
      'open-sprints': 'tab-btn-sprints',
      'open-done-stories': 'tab-btn-done-stories',
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
  if (loadLatestWrap) loadLatestWrap.style.display = 'none';
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
      ? 'See results fast. Change filters when needed.'
      : 'Preview updates with filters. Use Preview for heavy ranges.';
    reportSubtitleEl.style.display = rowsCount > 0 ? 'none' : '';
  }
  const outcomeLineEl = document.getElementById('preview-outcome-line');
  if (outcomeLineEl) outcomeLineEl.innerHTML = metaBlock.outcomeLineHTML;
  if (previewMeta) previewMeta.innerHTML = metaBlock.previewMetaHTML;
  if (reportContextLine) {
    const strictEnabled = meta.requireResolvedBySprintEnd === true;
    const contextBase = getContextDisplayString();
    reportContextLine.textContent = strictEnabled ? `${contextBase} | Strict rules: On` : contextBase;
    reportContextLine.removeAttribute('aria-hidden');
    reportContextLine.style.display = '';
  }
  if (oneClickWrap) oneClickWrap.style.display = rowsCount > 0 ? 'none' : '';
  if (previewBtn && rowsCount > 0) {
    previewBtn.classList.remove('btn-primary');
    previewBtn.classList.add('btn-secondary');
    previewBtn.textContent = 'Refresh preview';
    previewBtn.title = 'Refresh report results for current filters.';
  }
  const stickyEl = document.getElementById('preview-summary-sticky');
  if (stickyEl) {
    stickyEl.textContent = '';
    stickyEl.setAttribute('aria-hidden', 'true');
    // M4: Add body class so mobile CSS can hide duplicate applied-filters-summary
    document.body.classList.add('preview-active');
  }
  wirePreviewContextActions();
  const statusEl = document.getElementById('preview-status');
  if (statusEl) {
    statusEl.innerHTML = '';
    statusEl.style.display = 'none';
  }
  const statusStripEl = document.getElementById('preview-status-strip');
  if (statusStripEl) {
    statusStripEl.textContent = partial ? 'Results: partial data' : (meta.reducedScope ? 'Results: closest match' : 'Results: up to date');
    statusStripEl.setAttribute('data-state', partial ? 'partial' : (meta.reducedScope ? 'closest' : 'fresh'));
    statusStripEl.style.display = '';
  }

  const hasRows = rowsCount > 0;
  if (exportDropdownTrigger) exportDropdownTrigger.disabled = !hasRows;
  if (exportExcelBtn) exportExcelBtn.disabled = !hasRows;

  const exportHint = document.getElementById('export-hint');
  if (exportHint) {
    const modeDetails = [];
    if (meta.fromCache) modeDetails.push('cache');
    if (meta.recentSplitReason) modeDetails.push('split by ' + meta.recentSplitReason);
    if (meta.reducedScope) modeDetails.push('closest available scope');
    if (meta.partial) modeDetails.push('partial payload');
    const modeSuffix = modeDetails.length ? (' Data mode: ' + modeDetails.join(', ') + '.') : '';
    if (!hasRows) {
      exportHint.innerHTML = '<small>Generate a report with data to enable export.</small>';
    } else if (partial) {
      exportHint.innerHTML = '<small>Export matches the partial preview shown.</small>';
    } else if (meta.reducedScope) {
      exportHint.innerHTML = '<small>Export matches the closest available scope shown.</small>';
    } else {
      exportHint.innerHTML = '';
    }
    exportHint.title = modeSuffix ? modeSuffix.replace(/^ Data mode:\s*/, '').trim() : '';
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

  updateDateDisplay();
  renderSidebarContextCard();

  try {
    const ageMs = meta.cacheAgeMs ?? 0;
    const ageMins = Math.round(ageMs / 60000);
    const freshLabel = meta.fromCache
      ? (ageMins < 1 ? 'Updated just now' : (ageMins < 60 ? 'Updated ' + ageMins + 'm ago' : 'Updated >1h ago'))
      : 'Updated just now';
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
    setTabLabel(tabBoards, 'Overview (' + boardsCountForTab + ')', '📊 ' + boardsCountForTab);
    setTabLabel(tabSprints, 'Sprints (' + sprintsCountForTab + ')', '📅 ' + sprintsCountForTab);
    if (tabDoneStories) {
      const totalDoneStories = Array.isArray(reportState.previewRows) ? reportState.previewRows.length : rowsCount;
      const baseLabel = totalDoneStories === 0 ? 'Outcomes (0)' : ('Outcomes (Total: ' + totalDoneStories + ')');
      setTabLabel(tabDoneStories, baseLabel, '✅ ' + totalDoneStories);
      tabDoneStories.title = totalDoneStories === 0
        ? 'No done stories in this window; check dates or Jira hygiene.'
        : (meta.partial ? 'Partial preview: count reflects loaded outcomes only.' : 'Total done stories in the selected window.');
    }
    setTabLabel(tabUnusable, 'Excluded (' + unusableCountForTab + ')', '⛔ ' + unusableCountForTab);
    const tabTrends = document.getElementById('tab-btn-trends');
    setTabLabel(tabTrends, 'Leadership HUD →', '👥');
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
    statusStripElAfter.textContent = 'Results: up to date';
    statusStripElAfter.setAttribute('data-state', 'fresh');
    statusStripElAfter.style.display = '';
  }
}
