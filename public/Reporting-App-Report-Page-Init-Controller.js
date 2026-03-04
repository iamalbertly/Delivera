
import { initFeedbackPanel } from './Reporting-App-Report-UI-Feedback.js';
import { initTabs } from './Reporting-App-Report-UI-Tabs.js';
import { initProjectSelection, getSelectedProjects } from './Reporting-App-Report-Page-Selections-Manager.js';
import { initDateRangeControls } from './Reporting-App-Report-Page-DateRange-Controller.js';
import { initPreviewFlow, clearPreviewOnFilterChange, restoreLastPreviewFromStorage } from './Reporting-App-Report-Page-Preview-Flow.js';
import { initSearchClearButtons } from './Reporting-App-Report-Page-Search-Clear.js';
import { renderNotificationDock } from './Reporting-App-Shared-Notifications-Dock-Manager.js';
import { getValidLastQuery, getContextDisplayString } from './Reporting-App-Shared-Context-From-Storage.js';
import {
  REPORT_FILTERS_COLLAPSED_KEY,
  SHARED_DATE_RANGE_KEY,
  LAST_QUERY_KEY,
  PROJECTS_SSOT_KEY,
  REPORT_FILTERS_STALE_KEY,
  REPORT_FILTERS_STALE_REASON_KEY,
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
import { isJiraIssueKey } from './Reporting-App-Report-Utils-Jira-Helpers.js';

const LEADERSHIP_HASH = '#trends';

function initReportPage() {
  try { document.body.classList.add('report-page'); } catch (_) {}
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
  restoreLastPreviewFromStorage();
  initSearchClearButtons();
  renderNotificationDock({ pageContext: 'report', collapsedByDefault: true });
  applyDoneStoriesOptionalColumnsPreference();

  function initOutcomeIntake() {
    const wrap = document.getElementById('report-outcome-intake');
    const textarea = document.getElementById('report-outcome-text');
    const statusEl = document.getElementById('report-outcome-intake-status');
    const createBtn = document.getElementById('report-outcome-intake-create');
    if (!wrap || !textarea || !createBtn) return;

    function findFirstJiraKey(text) {
      if (!text || typeof text !== 'string') return '';
      const tokens = text.split(/[\s,;()\[\]{}<>]+/);
      for (const raw of tokens) {
        const t = (raw || '').trim();
        if (!t) continue;
        if (isJiraIssueKey(t)) return t.toUpperCase();
      }
      return '';
    }

    function setCreateButtonState(disabled, label) {
      createBtn.disabled = !!disabled;
      if (typeof label === 'string' && label) {
        createBtn.textContent = label;
      } else {
        createBtn.textContent = 'Create Jira Epic from this narrative';
      }
    }

    function setStatusText(message) {
      if (!statusEl) return;
      statusEl.textContent = message || '';
    }

    function updateUi() {
      const value = textarea.value || '';
      const trimmed = value.trim();
      if (!trimmed) {
        setStatusText('');
        setCreateButtonState(true);
        return;
      }
      const key = findFirstJiraKey(trimmed);
      if (key) {
        setStatusText('This already has a Jira issue: ' + key + ' - use it.');
        setCreateButtonState(true);
      } else {
        setStatusText('No Jira key detected. Create Jira Epic from this narrative.');
        setCreateButtonState(false);
      }
    }

    textarea.addEventListener('input', () => {
      updateUi();
    });
    textarea.addEventListener('change', () => {
      updateUi();
    });

    createBtn.addEventListener('click', async () => {
      const narrative = (textarea.value || '').trim();
      if (!narrative) {
        updateUi();
        return;
      }

      const projects = getSelectedProjects();
      let primaryProject = Array.isArray(projects) && projects.length ? String(projects[0] || '').trim() : '';
      if (Array.isArray(projects) && projects.length > 1) {
        const chosenRaw = window.prompt(
          'Multiple projects are active. Enter the project key for this epic: ' + projects.join(', '),
          String(projects[0] || '')
        );
        const chosen = String(chosenRaw || '').trim().toUpperCase();
        if (!chosen) {
          setStatusText('Choose a project key to create the epic when multiple projects are active.');
          setCreateButtonState(false);
          return;
        }
        if (!projects.map((p) => String(p || '').toUpperCase()).includes(chosen)) {
          setStatusText('Project key not in active context. Choose one of: ' + projects.join(', '));
          setCreateButtonState(false);
          return;
        }
        primaryProject = chosen;
      }

      setCreateButtonState(true, 'Creating...');
      setStatusText('');

      const createRequest = async (createAnyway = false) => fetch('/api/outcome-from-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrative,
          projectKey: primaryProject || null,
          selectedProjects: projects,
          createAnyway: !!createAnyway,
        }),
      });

      try {
        const res = await createRequest(false);
        if (res.status === 409) {
          let conflict = null;
          try { conflict = await res.json(); } catch (_) {}
          if (conflict?.code === 'NARRATIVE_HAS_EXISTING_KEY') {
            setStatusText(conflict.message || 'This narrative already references a Jira issue. Use it.');
            setCreateButtonState(true);
            return;
          }
          if (conflict?.code === 'POSSIBLE_DUPLICATE_OUTCOME' && conflict?.duplicate?.key && statusEl) {
            const dup = conflict.duplicate;
            const linkHtml = dup.url
              ? '<a href="' + String(dup.url).replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">' + dup.key + '</a>'
              : dup.key;
            statusEl.innerHTML = 'Looks like ' + linkHtml + ' already exists - <button type="button" class="link-style" data-outcome-action="use-existing">Use existing</button> / <button type="button" class="link-style" data-outcome-action="create-anyway">Create anyway</button>';
            statusEl.querySelector('[data-outcome-action="use-existing"]')?.addEventListener('click', () => {
              setStatusText('Using existing Jira issue ' + dup.key + '.');
              setCreateButtonState(false);
            }, { once: true });
            statusEl.querySelector('[data-outcome-action="create-anyway"]')?.addEventListener('click', async () => {
              setCreateButtonState(true, 'Creating...');
              try {
                const forcedRes = await createRequest(true);
                if (!forcedRes.ok) throw new Error('Create anyway failed');
                const forcedJson = await forcedRes.json().catch(() => ({}));
                const forcedKey = (forcedJson && (forcedJson.key || forcedJson.issueKey)) || '';
                const forcedUrl = (forcedJson && (forcedJson.url || forcedJson.issueUrl)) || '';
                if (forcedKey && forcedUrl && statusEl) {
                  statusEl.innerHTML = 'Created Jira epic <a href="' + forcedUrl.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">' + forcedKey + '</a>.';
                } else if (forcedKey) {
                  setStatusText('Created Jira epic ' + forcedKey + '.');
                } else {
                  setStatusText('Created Jira epic from narrative.');
                }
                textarea.value = '';
              } catch (error) {
                setStatusText('Failed to create Jira epic: ' + (error && error.message ? error.message : 'Network error'));
              } finally {
                setCreateButtonState(false);
                updateUi();
              }
            }, { once: true });
            setCreateButtonState(false);
            return;
          }
        }

        if (!res.ok) {
          let msg = 'Could not create Jira epic from this narrative.';
          try {
            const json = await res.json();
            if (json && json.message) msg = String(json.message);
          } catch (_) {}
          setStatusText(msg);
          setCreateButtonState(false);
          return;
        }

        let key = '';
        let url = '';
        try {
          const json = await res.json();
          key = (json && (json.key || json.issueKey)) || '';
          url = (json && (json.url || json.issueUrl)) || '';
        } catch (_) {}

        if (key && statusEl) {
          if (url) {
            statusEl.innerHTML = 'Created Jira epic <a href="' + url.replace(/"/g, '&quot;') + '" target="_blank" rel="noopener">' + key + '</a>. Update details in Jira if needed.';
          } else {
            setStatusText('Created Jira epic ' + key + '. Update details in Jira if needed.');
          }
          textarea.value = '';
        } else {
          setStatusText('Created Jira epic from narrative.');
        }
        setCreateButtonState(false);
      } catch (error) {
        setStatusText('Failed to create Jira epic: ' + (error && error.message ? error.message : 'Network error'));
        setCreateButtonState(false);
      }

      updateUi();
    });

    updateUi();
  }

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
      const search = document.getElementById('report-tab-search')
        || document.getElementById('boards-search-box')
        || document.getElementById('search-box');
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
