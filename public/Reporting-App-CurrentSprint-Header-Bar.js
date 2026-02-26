/**
 * Fixed Header Bar Component
 * Displays sprint metadata: name, date range, days remaining, total SP, status badge
 * Sticky positioning on desktop, relative on mobile
 * Rationale: Customer - Context always visible. Simplicity - Eliminates "Sprint Window" duplication. Trust - Countdown builds urgency awareness.
 */

import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDate } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { renderExportButton } from './Reporting-App-CurrentSprint-Export-Dashboard.js';
import { deriveSprintVerdict } from './Reporting-App-CurrentSprint-Alert-Banner.js';
import { buildActiveFiltersContextLabel } from './Reporting-App-Shared-Context-From-Storage.js';
import { readNotificationSummary } from './Reporting-App-Shared-Notifications-Dock-Manager.js';
import { renderCountdownTimer } from './Reporting-App-CurrentSprint-Countdown-Timer.js';
import { buildMergedWorkRiskRows } from './Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';

export function renderHeaderBar(data) {
  const sprint = data.sprint || {};
  const summary = data.summary || {};
  const days = data.daysMeta || {};
  const planned = data.plannedWindow || {};
  const meta = data.meta || {};
  const scopeCount = Array.isArray(data.scopeChanges) ? data.scopeChanges.length : 0;
  const excludedParents = Number(summary.stuckExcludedParentsWithActiveSubtasks || 0);
  const subtaskEstimatedHrs = Number(summary.subtaskEstimatedHours || 0);
  const subtaskLoggedHrs = Number(summary.subtaskLoggedHours || 0);

  const donePercentage = summary.percentDone ?? 0;
  const remainingDays = days.daysRemainingWorking != null ? days.daysRemainingWorking : days.daysRemainingCalendar;

  const statusBadge = meta.fromSnapshot ? 'Snapshot' : (meta.snapshotAt == null ? 'Live' : 'Snapshot');
  const statusClass = statusBadge === 'Live' ? 'status-live' : 'status-snapshot';

  let remainingLabel = '-';
  let remainingClass = '';
  if (remainingDays != null) {
    if (remainingDays <= 0) {
      remainingLabel = 'Sprint ended';
      remainingClass = 'critical';
    } else if (remainingDays < 1 && remainingDays > 0) {
      remainingLabel = '<1 day';
      remainingClass = 'critical';
    } else {
      remainingLabel = String(remainingDays) + ' day' + (remainingDays !== 1 ? 's' : '');
      if (remainingDays > 5) {
        remainingClass = 'green';
      } else if (remainingDays > 2) {
        remainingClass = 'yellow';
      } else {
        remainingClass = 'critical';
      }
    }
  }

  const issuesCount = (data.stories || []).length;
  const verdictInfo = deriveSprintVerdict(data);
  const mergedRiskRows = buildMergedWorkRiskRows(data);
  const stuckCount = new Set(
    mergedRiskRows
      .filter((row) => String(row.riskType || '').toLowerCase().includes('stuck >24h'))
      .map((row) => String(row.issueKey || '').toUpperCase())
      .filter(Boolean)
  ).size;
  const missingEstimates = Number(verdictInfo.missingEstimate || 0);
  const missingLoggedItems = Number(verdictInfo.missingLogged || 0);
  const compactRiskParts = [];
  if (stuckCount > 0) compactRiskParts.push(stuckCount + ' blockers');
  if (excludedParents > 0) compactRiskParts.push(excludedParents + ' parent stor' + (excludedParents === 1 ? 'y' : 'ies') + ' flowing via subtasks');
  if (missingEstimates > 0) compactRiskParts.push(missingEstimates + ' missing est');
  if (missingLoggedItems > 0) compactRiskParts.push(missingLoggedItems + ' no log');
  if (scopeCount > 0) compactRiskParts.push(scopeCount + ' scope additions');
  const remainingChipLabel = remainingDays == null
    ? 'Ends ?'
    : (remainingDays <= 0 ? 'Ended' : (remainingDays < 1 ? 'Ends today' : ('Ends in ' + Math.floor(remainingDays) + 'd')));

  let html = '<div class="current-sprint-header-bar" data-sprint-id="' + (sprint.id || '') + '">';
  html += '<div class="sprint-verdict-line sprint-verdict-' + escapeHtml(verdictInfo.color) + '" aria-live="polite">';
  html += '<strong>' + escapeHtml(verdictInfo.verdict) + '</strong>';
  html += '<span class="sprint-verdict-explain">';
  if (compactRiskParts.length) {
    html += ' · ';
    html += '<span class="verdict-pill verdict-pill-muted" title="Sprint end timing">' + escapeHtml(remainingChipLabel) + '</span>';
    if (stuckCount > 0) {
      html += '<button type="button" class="verdict-pill" data-risk-tags="blocker" aria-label="Filter Work risks to blockers">' + escapeHtml(String(stuckCount)) + ' blockers</button>';
    }
    if (missingEstimates > 0) {
      html += '<button type="button" class="verdict-pill" data-risk-tags="missing-estimate" aria-label="Filter Work risks to missing estimates">' + escapeHtml(String(missingEstimates)) + ' missing est</button>';
    }
    if (missingLoggedItems > 0) {
      html += '<button type="button" class="verdict-pill" data-risk-tags="no-log" aria-label="Filter Work risks to no-log rows">' + escapeHtml(String(missingLoggedItems)) + ' no log</button>';
    }
  } else {
    html += ' · <span class="verdict-pill verdict-pill-muted">' + escapeHtml(remainingChipLabel) + '</span>';
    html += '<span class="verdict-pill verdict-pill-muted">No active delivery risks</span>';
  }
  html += '</span>';
  html += '</div>';

  const boardName = (data.board && data.board.name) ? data.board.name : '';
  const selectedProject = (data.board && Array.isArray(data.board.projectKeys) && data.board.projectKeys.length > 0)
    ? data.board.projectKeys[0]
    : (meta.projects || '');
  const contextProjects = (meta.projects || '')
    ? String(meta.projects).split(',').map((p) => String(p).trim()).filter(Boolean).join(', ')
    : '';
  const contextStart = meta.windowStart ? formatDate(meta.windowStart) : '';
  const contextEnd = meta.windowEnd ? formatDate(meta.windowEnd) : '';
  const reportContextLine = buildActiveFiltersContextLabel(contextProjects || '', meta.windowStart, meta.windowEnd);
  const hasContextWindow = contextStart && contextEnd;
  const sprintDatesLabel = (formatDate(planned.start || sprint.startDate) + ' - ' + formatDate(planned.end || sprint.endDate)).replace(/^-\s-\s-$/, 'No active sprint window');
  html += '<div class="header-bar-left">';
  html += '<div class="header-inline-summary">';
  html += '<span class="header-context-chip header-context-chip-active" title="Active filters driving this sprint view">Active: ' + escapeHtml(selectedProject || 'n/a') + (boardName ? ' | ' + escapeHtml(boardName) : '') + '</span>';
  html += '<span class="header-sprint-name">' + escapeHtml(sprint.name || (sprint.id ? ('Sprint ' + sprint.id) : 'No active sprint')) + '</span>';
  html += '<span class="header-sprint-dates">' + escapeHtml(sprintDatesLabel) + '</span>';
  if (hasContextWindow || contextProjects) {
    html += '<span class="header-context-chip header-context-chip-cache" title="Cached report context for reference only">From report cache: '
      + escapeHtml(reportContextLine)
      + '</span>';
  }
  html += '</div>';
  html += '</div>';

  html += '<div class="header-bar-center">';
  html += '<div class="header-metric">';
  html += '<span class="metric-label">Progress</span>';
  html += '<span class="metric-value">' + donePercentage + '%</span>';
  html += '</div>';
  html += '<a href="#stories-card" class="header-metric-link" title="Jump to issues in this sprint">';
  html += '<span class="metric-label">Work items</span>';
  html += '<span class="metric-value">' + issuesCount + '</span>';
  html += '</a>';
  html += '<a href="#stories-card" class="header-metric-link" title="Subtask logged hours versus estimated hours">';
  html += '<span class="metric-label">Log/Est</span>';
  html += '<span class="metric-value">' + subtaskLoggedHrs.toFixed(1) + 'h / ' + subtaskEstimatedHrs.toFixed(1) + 'h</span>';
  html += '</a>';
  html += '</div>';

  const generatedAt = meta && (meta.generatedAt || meta.snapshotAt) ? new Date(meta.generatedAt || meta.snapshotAt) : null;
  let freshnessLabel = '';
  if (generatedAt) {
    const ageMs = Date.now() - generatedAt.getTime();
    const ageMin = Math.max(0, Math.round(ageMs / 60000));
    freshnessLabel = ageMin < 1 ? 'Updated just now' : 'Updated ' + ageMin + ' min ago';
  }
  const hasExportableRows = issuesCount > 0;
  const exportReadiness = hasExportableRows ? 'Export ready' : 'No exportable rows';
  let loggingAlertTotal = 0;
  try {
    loggingAlertTotal = Number(readNotificationSummary()?.total || 0);
  } catch (_) {}
  html += '<div class="header-bar-right">';
  html += renderCountdownTimer(data, { compact: true, inlineHeader: true });
  html += '<div class="status-badge ' + statusClass + '" role="status" aria-label="Data status: ' + escapeHtml(statusBadge) + '">' + escapeHtml(statusBadge) + '</div>';
  if (loggingAlertTotal > 0) {
    html += '<button type="button" class="header-alert-chip" data-header-action="open-logging-alerts" aria-label="Open logging alerts">Logging alerts: ' + escapeHtml(String(loggingAlertTotal)) + '</button>';
  }
  html += '<div class="header-role-modes" role="radiogroup" aria-label="Sprint view mode">';
  html += '<button type="button" class="role-mode-pill" data-role-mode="all" aria-pressed="true">All</button>';
  html += '<button type="button" class="role-mode-pill" data-role-mode="developer" aria-pressed="false">Dev</button>';
  html += '<button type="button" class="role-mode-pill" data-role-mode="scrum-master" aria-pressed="false">SM</button>';
  html += '<button type="button" class="role-mode-pill" data-role-mode="product-owner" aria-pressed="false">PO</button>';
  html += '<button type="button" class="role-mode-pill" data-role-mode="line-manager" aria-pressed="false">Leads</button>';
  html += '</div>';
  html += '<small class="header-role-mode-hint" title="Role mode applies one preset across Work risks and Issues evidence">Filters Work risks + Issues together.</small>';
  html += '<div class="header-active-filter-state" aria-live="polite"><span class="header-active-filter-state-label">Active view:</span> <span data-header-active-filter-value>All work</span></div>';
  html += '<div class="header-updated">' + (freshnessLabel ? '<small class="last-updated">' + escapeHtml(freshnessLabel) + '</small>' : '') + '</div>';
  html += '<button type="button" class="btn btn-compact btn-secondary header-action-cta" data-header-action="take-action" title="Focus highest priority risk rows">Take action</button>';
  html += '<button class="btn btn-compact header-refresh-btn" title="Refresh sprint data">Refresh</button>';
  html += renderExportButton(true);
  html += '</div>';

  html += '</div>';
  return html;
}

export function wireHeaderBarHandlers() {
  const headerBar = document.querySelector('.current-sprint-header-bar');
  if (!headerBar) return;

  const uiState = {
    roleMode: 'all',
    riskTags: [],
    dayKey: '',
  };
  const activeStateValueEl = headerBar.querySelector('[data-header-active-filter-value]');
  function setRiskTagsState(tags) {
    uiState.riskTags = Array.isArray(tags) ? tags.map((t) => String(t || '').trim()).filter(Boolean) : [];
    renderActiveState();
  }
  function renderActiveState() {
    if (!activeStateValueEl) return;
    const parts = [];
    if (uiState.roleMode && uiState.roleMode !== 'all') {
      const roleMap = {
        developer: 'Dev',
        'scrum-master': 'SM',
        'product-owner': 'PO',
        'line-manager': 'Leads',
      };
      parts.push('Role ' + (roleMap[uiState.roleMode] || uiState.roleMode));
    }
    if (Array.isArray(uiState.riskTags) && uiState.riskTags.length) {
      parts.push('Risk ' + uiState.riskTags.join(', '));
    }
    if (uiState.dayKey) {
      parts.push('Day ' + uiState.dayKey);
    }
    activeStateValueEl.textContent = parts.length ? parts.join(' | ') : 'All work';
  }

  if (headerBar.dataset.headerActionDelegationWired !== '1') {
    headerBar.dataset.headerActionDelegationWired = '1';
    headerBar.addEventListener('click', (event) => {
      const takeAction = event.target.closest('[data-header-action="take-action"]');
      if (takeAction && headerBar.contains(takeAction)) {
        event.preventDefault();
        setRiskTagsState(['blocker']);
        try {
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', {
            detail: { riskTags: ['blocker'], source: 'header-take-action' }
          }));
        } catch (_) {}
        const table = document.getElementById('work-risks-table');
        const firstVisibleRow = table
          ? Array.from(table.querySelectorAll('tbody .work-risk-parent-row')).find((row) => {
              const style = window.getComputedStyle(row);
              return style.display !== 'none' && !row.hasAttribute('hidden');
            })
          : null;
        (firstVisibleRow || table || document.getElementById('stuck-card'))?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        firstVisibleRow?.classList?.add('row-attention-pulse');
        window.setTimeout(() => firstVisibleRow?.classList?.remove('row-attention-pulse'), 1600);
        return;
      }
      const metricLink = event.target.closest('.header-metric-link');
      if (metricLink && headerBar.contains(metricLink)) {
        event.preventDefault();
        const label = (metricLink.querySelector('.metric-label')?.textContent || '').trim().toLowerCase();
        if (label === 'work items') {
          try {
            window.dispatchEvent(new CustomEvent('currentSprint:focusStoriesEvidence', { detail: { source: 'header-work-items' } }));
          } catch (_) {}
        } else if (label === 'log/est') {
          setRiskTagsState(['no-log']);
          try {
            window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags: ['no-log'], source: 'header-log-est' } }));
          } catch (_) {}
        }
        document.getElementById('stories-card')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  try {
    window.addEventListener('currentSprint:applyWorkRiskFilter', (event) => {
      const detail = event?.detail || {};
      setRiskTagsState(detail.riskTags);
    });
    window.addEventListener('currentSprint:storiesDayFilterChanged', (event) => {
      const detail = event?.detail || {};
      uiState.dayKey = String(detail.dayKey || '').trim();
      renderActiveState();
    });
  } catch (_) {}

  const sprintName = headerBar.querySelector('.header-sprint-name');
  if (sprintName) {
    sprintName.style.cursor = 'pointer';
    sprintName.addEventListener('click', () => {
      const carousel = document.querySelector('.sprint-carousel');
      if (carousel) {
        carousel.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  const refreshBtn = headerBar.querySelector('.header-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      document.dispatchEvent(new Event('refreshSprint'));
    });
  }

  const takeActionBtn = headerBar.querySelector('[data-header-action="take-action"]');
  if (takeActionBtn) {
    takeActionBtn.addEventListener('click', () => {
      try {
        setRiskTagsState(['blocker']);
        window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', {
          detail: { riskTags: ['blocker'], source: 'header-take-action' }
        }));
      } catch (_) {}
      try {
        const table = document.getElementById('work-risks-table');
        const firstVisibleRow = table
          ? Array.from(table.querySelectorAll('tbody .work-risk-parent-row')).find((row) => {
              const style = window.getComputedStyle(row);
              return style.display !== 'none' && !row.hasAttribute('hidden');
            })
          : null;
        (firstVisibleRow || table || document.getElementById('stuck-card'))?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        firstVisibleRow?.classList?.add('row-attention-pulse');
        window.setTimeout(() => firstVisibleRow?.classList?.remove('row-attention-pulse'), 1600);
      } catch (_) {}
    });
  }

  Array.from(headerBar.querySelectorAll('.header-metric-link')).forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const label = (link.querySelector('.metric-label')?.textContent || '').trim().toLowerCase();
      if (label === 'work items') {
        try {
          window.dispatchEvent(new CustomEvent('currentSprint:focusStoriesEvidence', { detail: { source: 'header-work-items' } }));
        } catch (_) {}
      } else if (label === 'log/est') {
        try {
          setRiskTagsState(['no-log']);
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags: ['no-log'], source: 'header-log-est' } }));
        } catch (_) {}
      }
      document.getElementById('stories-card')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  });

  const alertsBtn = headerBar.querySelector('[data-header-action="open-logging-alerts"]');
  if (alertsBtn) {
    alertsBtn.addEventListener('click', () => {
      const storiesCard = document.getElementById('stories-card');
      const risksCard = document.getElementById('stuck-card');
      (risksCard || storiesCard)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  }

  const verdictLine = headerBar.querySelector('.sprint-verdict-line');
  if (verdictLine) {
    verdictLine.addEventListener('click', (event) => {
      const pill = event.target.closest('.verdict-pill');
      if (!pill) return;
      const riskTagsAttr = pill.getAttribute('data-risk-tags') || '';
      const riskTags = riskTagsAttr.split(/\s+/).filter(Boolean);
      setRiskTagsState(riskTags);
      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags, source: 'header-verdict' } }));
        }
      } catch (_) {}
      try {
        const table = document.getElementById('work-risks-table');
        if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (_) {}
    });
  }

  const roleModeKey = 'current_sprint_role_mode';
  const roleButtons = Array.from(headerBar.querySelectorAll('.role-mode-pill'));
  function applyRoleMode(mode) {
    let active = mode || 'all';
    if (!['all', 'developer', 'scrum-master', 'product-owner', 'line-manager'].includes(active)) {
      active = 'all';
    }
    roleButtons.forEach((btn) => {
      const btnMode = btn.getAttribute('data-role-mode');
      const isActive = btnMode === active;
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      btn.classList.toggle('role-mode-pill-active', isActive);
    });
    uiState.roleMode = active;
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      const presetMap = {
        all: [],
        developer: ['no-log'],
        'scrum-master': ['blocker'],
        'product-owner': ['scope'],
        'line-manager': ['unassigned'],
      };
      const riskTags = presetMap[active] || [];
      setRiskTagsState(riskTags);
      try {
        window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags, source: 'role-mode-' + active } }));
      } catch (_) {}
    }
    renderActiveState();
  }
  let initialMode = 'all';
  try {
    const stored = window.localStorage.getItem(roleModeKey);
    if (stored) initialMode = stored;
  } catch (_) {}
  applyRoleMode(initialMode);
  roleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-role-mode') || 'all';
      try {
        window.localStorage.setItem(roleModeKey, mode);
      } catch (_) {}
      applyRoleMode(mode);
    });
  });
  renderActiveState();
}
