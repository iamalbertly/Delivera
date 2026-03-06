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
import { readNotificationSummary } from './Reporting-App-Shared-Notifications-Dock-Manager.js';
import { renderCountdownTimer } from './Reporting-App-CurrentSprint-Countdown-Timer.js';
import { getUnifiedRiskCounts } from './Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';

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

  const sprintState = String(sprint.state || '').toLowerCase();
  const statusBadge = (meta.fromSnapshot || sprintState !== 'active') ? 'Snapshot' : 'Live';
  const statusClass = statusBadge === 'Live' ? 'status-live' : 'status-snapshot';
  const isHistoricalSprint = String(sprint.state || '').toLowerCase() && String(sprint.state || '').toLowerCase() !== 'active';
  const activeSprintCount = Number(
    meta.activeSprintCount
    || (Array.isArray(data.recentSprints) ? data.recentSprints.filter((s) => String(s?.state || '').toLowerCase() === 'active').length : 0)
    || 0
  );

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
  const riskCounts = getUnifiedRiskCounts(data);
  const stuckCount = Number(riskCounts.blockersOwned || 0);
  const missingEstimates = Number(verdictInfo.missingEstimate || 0);
  const missingLoggedItems = Number(verdictInfo.missingLogged || 0);
  const unassignedParents = Number(riskCounts.unownedOutcomes || verdictInfo.unassignedParents || 0);
  const compactRiskParts = [];
  if (stuckCount > 0) compactRiskParts.push(stuckCount + ' blockers');
  if (excludedParents > 0) compactRiskParts.push(excludedParents + ' parent stor' + (excludedParents === 1 ? 'y' : 'ies') + ' flowing via subtasks');
  if (missingEstimates > 0) compactRiskParts.push(missingEstimates + ' missing est');
  if (missingLoggedItems > 0) compactRiskParts.push(missingLoggedItems + ' no log');
  if (unassignedParents > 0) compactRiskParts.push(unassignedParents + ' unowned outcomes');
  if (scopeCount > 0) compactRiskParts.push(scopeCount + ' scope additions');
  const remainingChipLabel = remainingDays == null
    ? 'Ends ?'
    : (remainingDays <= 0 ? 'Ended' : (remainingDays < 1 ? 'Ends today' : ('Ends in ' + Math.floor(remainingDays) + 'd')));
  const verdictRiskChips = [];
  if (stuckCount > 0) {
    verdictRiskChips.push({
      tags: ['blocker'],
      label: String(stuckCount) + ' blockers',
      aria: 'Filter issues to owned blockers',
    });
  }
  if (missingEstimates > 0) {
    verdictRiskChips.push({
      tags: ['missing-estimate'],
      label: String(missingEstimates) + ' missing est',
      aria: 'Filter issues to missing estimates',
    });
  }
  if (missingLoggedItems > 0) {
    verdictRiskChips.push({
      tags: ['no-log'],
      label: String(missingLoggedItems) + ' no log',
      aria: 'Filter issues to estimated, no log',
    });
  }
  if (unassignedParents > 0) {
    verdictRiskChips.push({
      tags: ['unassigned'],
      label: String(unassignedParents) + ' unowned',
      aria: 'Filter issues to unowned outcomes',
    });
  }

  let html = '<div class="current-sprint-header-bar" data-sprint-id="' + (sprint.id || '') + '">';
  html += '<div class="header-bar-left">';
  html += '<div class="sprint-verdict-line sprint-verdict-' + escapeHtml(verdictInfo.color) + '" aria-live="polite">';
  html += '<strong>' + escapeHtml(verdictInfo.verdict) + '</strong>';
  html += '<span class="verdict-pill verdict-pill-muted" title="Sprint end timing">' + escapeHtml(remainingChipLabel) + '</span>';
  const maxRiskChips = verdictRiskChips.slice(0, 3);
  if (maxRiskChips.length) {
    maxRiskChips.forEach((chip) => {
      const tagsAttr = chip.tags.join(' ');
      html += '<button type="button" class="verdict-pill" data-risk-tags="' + escapeHtml(tagsAttr) + '" aria-label="' + escapeHtml(chip.aria) + '">' + escapeHtml(chip.label) + '</button>';
    });
  } else {
    html += '<span class="verdict-pill verdict-pill-muted">No risks</span>';
  }
  html += '</div>';
  const boardName = (data.board && data.board.name) ? data.board.name : '';
  const selectedProject = (data.board && Array.isArray(data.board.projectKeys) && data.board.projectKeys.length > 0)
    ? data.board.projectKeys[0]
    : (meta.projects || '');
  const sprintDatesLabel = (formatDate(planned.start || sprint.startDate) + ' - ' + formatDate(planned.end || sprint.endDate)).replace(/^-\s-\s-$/, 'No active sprint window');
  html += '<div class="header-inline-summary">';
  html += '<span class="header-context-chip header-context-chip-active" title="Active board and project for this sprint view">' + escapeHtml(selectedProject || 'n/a') + (boardName ? ' · ' + escapeHtml(boardName) : '') + '</span>';
  const sprintNameLabel = sprint.name || (sprint.id ? ('Sprint ' + sprint.id) : 'No active sprint');
  const sprintNameCompact = sprintNameLabel.length > 40 ? (sprintNameLabel.slice(0, 40).trimEnd() + '...') : sprintNameLabel;
  html += '<span class="header-sprint-name" title="' + escapeHtml(sprintNameLabel) + '">' + escapeHtml(sprintNameCompact) + '</span>';
  html += '<span class="header-sprint-dates">' + escapeHtml(sprintDatesLabel) + '</span>';
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
    const prefix = statusBadge === 'Live' ? 'Live data' : 'Snapshot';
    freshnessLabel = ageMin < 1 ? (prefix + ' · updated just now') : (prefix + ' · updated ' + ageMin + ' min ago');
  }
  const hasExportableRows = issuesCount > 0;
  const exportReadiness = hasExportableRows ? 'Export ready' : 'No exportable rows';
  let loggingAlertTotal = 0;
  try {
    loggingAlertTotal = Number(readNotificationSummary()?.total || 0);
  } catch (_) {}
  html += '<div class="header-bar-right">';
  html += '<div class="header-controls-row">';
  html += renderCountdownTimer(data, { compact: true, inlineHeader: true });
  html += '<div class="status-badge ' + statusClass + '" role="status" aria-label="Data status: ' + escapeHtml(statusBadge) + '">' + escapeHtml(statusBadge) + '</div>';
  if (loggingAlertTotal > 0 && !isHistoricalSprint) {
    html += '<button type="button" class="header-alert-chip" data-header-action="open-logging-alerts" aria-label="Open logging alerts and self-serve nudge templates" title="Open logging alerts and copy standard Jira update nudges">Logging alerts: ' + escapeHtml(String(loggingAlertTotal)) + '</button>';
  }
  html += '<div class="header-role-modes" role="radiogroup" aria-label="Sprint view mode">';
  html += '<span class="header-role-modes-label">View as:</span>';
  html += '<button type="button" class="role-mode-pill" data-role-mode="all" aria-pressed="true">All</button>';
  html += '<button type="button" class="role-mode-pill" data-role-mode="developer" aria-pressed="false">Dev</button>';
  html += '<button type="button" class="role-mode-pill" data-role-mode="scrum-master" aria-pressed="false">SM</button>';
  html += '<button type="button" class="role-mode-pill" data-role-mode="product-owner" aria-pressed="false">PO</button>';
  html += '<button type="button" class="role-mode-pill" data-role-mode="line-manager" aria-pressed="false">Leads</button>';
  html += '</div>';
  html += '<small class="header-role-mode-hint" title="Role mode applies one preset across issues and risks">One view preset for Issues + risks.</small>';
  html += '<div class="header-active-filter-state" aria-live="polite"><span class="header-active-filter-state-label">View:</span> <span data-header-active-filter-value>All</span><button type="button" class="header-active-filter-reset" data-header-action="reset-filters" aria-label="Reset to all work" title="Reset filters to All">Reset</button></div>';
  if (freshnessLabel || !hasExportableRows) {
    const freshnessText = freshnessLabel || (statusBadge === 'Live' ? 'Live data' : 'Snapshot');
    const exportText = hasExportableRows ? '' : ' · No export';
    html += '<div class="header-export-readiness">' + escapeHtml(freshnessText + exportText) + '</div>';
  }
  html += '</div>';
  html += '<div class="header-actions-row">';
  const takeActionLabel = compactRiskParts.length ? 'Take action' : 'Review Work risks anyway';
  html += '<button type="button" class="btn btn-compact btn-secondary header-action-cta" data-header-action="take-action"'
    + (isHistoricalSprint ? ' disabled aria-disabled="true"' : '')
    + ' title="' + escapeHtml(isHistoricalSprint ? 'Historical sprint snapshot: live remediation actions are disabled.' : 'Focus highest priority risk rows') + '">'
    + escapeHtml(isHistoricalSprint ? 'View historical risks' : takeActionLabel)
    + '</button>';
  html += '<button class="btn btn-compact header-refresh-btn" title="Refresh sprint data"' + (isHistoricalSprint ? ' disabled aria-disabled="true"' : '') + '>Refresh</button>';
  html += renderExportButton(true);
  html += '</div>';
  html += '</div>';

  html += '</div>';
  const previous = data?.previousSprint || null;
  if (previous && previous.name) {
    const currentStories = Number(summary.doneStories || 0);
    const currentSpPerDay = Number(summary.totalSprintDays || 0) > 0 ? (Number(summary.doneSP || 0) / Number(summary.totalSprintDays || 1)) : 0;
    const prevStories = Number(previous.doneStories || 0);
    const prevSpPerDay = Number(previous.doneSP || 0);
    const storiesDelta = currentStories - prevStories;
    const spDayDelta = Math.round((currentSpPerDay - prevSpPerDay) * 100) / 100;
    html += '<div class="header-vs-last-sprint" role="note">vs ' + escapeHtml(previous.name)
      + ': ' + (storiesDelta >= 0 ? '+' : '') + storiesDelta + ' stories'
      + ' · ' + (spDayDelta >= 0 ? '+' : '') + spDayDelta + ' SP/day'
      + ' · now ' + donePercentage + '% done</div>';
  }
  if (isHistoricalSprint) {
    const histLabel = (sprint.name || 'Historical sprint') + ' · ' + sprintDatesLabel;
    html += '<div class="current-sprint-history-banner" role="note">Viewing historical sprint snapshot (' + escapeHtml(histLabel) + ') · Some actions disabled</div>';
  }
  return html;
}

export function wireHeaderBarHandlers() {
  const headerBar = document.querySelector('.current-sprint-header-bar');
  if (!headerBar) return;
  if (headerBar.dataset.headerBarHandlersWired === '1') return;
  headerBar.dataset.headerBarHandlersWired = '1';

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
    const role = uiState.roleMode || 'all';
    const tags = Array.isArray(uiState.riskTags) ? uiState.riskTags : [];
    const day = uiState.dayKey || '';

    let roleLabel = 'All';
    if (role === 'developer') roleLabel = 'Dev';
    else if (role === 'scrum-master') roleLabel = 'SM';
    else if (role === 'product-owner') roleLabel = 'PO';
    else if (role === 'line-manager') roleLabel = 'Leads';

    let focusLabel = '';
    if (tags.length) {
      focusLabel = tags.join(', ');
    }

    let label = roleLabel;
    if (focusLabel) {
      label += ' · ' + focusLabel;
    }
    if (day) {
      label += ' · ' + day;
    }

    activeStateValueEl.textContent = label;
    headerBar.classList.add('header-active-filter-state-highlight');
    window.setTimeout(() => headerBar.classList.remove('header-active-filter-state-highlight'), 900);
  }

  function applyHeaderRiskAction(preferredTags, source) {
    const candidates = Array.isArray(preferredTags) ? preferredTags : [];
    const tagsByPriority = [candidates, ['no-log'], ['missing-estimate'], ['scope'], []];
    let selected = [];
    for (const option of tagsByPriority) {
      if (!option.length) {
        selected = [];
        break;
      }
      selected = option;
      break;
    }
    setRiskTagsState(selected);
    try {
      window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', {
        detail: { riskTags: selected, source: source || 'header-action' }
      }));
    } catch (_) {}
    try {
      const stories = document.getElementById('stories-card') || document.getElementById('stuck-card');
      stories?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } catch (_) {}
  }

  if (headerBar.dataset.headerActionDelegationWired !== '1') {
    headerBar.dataset.headerActionDelegationWired = '1';
    headerBar.addEventListener('click', (event) => {
      const takeAction = event.target.closest('[data-header-action="take-action"]');
      if (takeAction && headerBar.contains(takeAction)) {
        event.preventDefault();
        if (takeAction.hasAttribute('disabled') || takeAction.getAttribute('aria-disabled') === 'true') {
          document.getElementById('stuck-card')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
          return;
        }
        applyHeaderRiskAction(['blocker'], 'header-take-action');
        return;
      }
      const resetFilters = event.target.closest('[data-header-action="reset-filters"]');
      if (resetFilters && headerBar.contains(resetFilters)) {
        event.preventDefault();
        setRiskTagsState([]);
        uiState.dayKey = '';
        const allRole = headerBar.querySelector('.role-mode-pill[data-role-mode="all"]');
        allRole?.click?.();
        try {
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags: [], source: 'header-reset-filters' } }));
        } catch (_) {}
        renderActiveState();
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
          applyHeaderRiskAction(['no-log'], 'header-log-est');
          return;
        }
        document.getElementById('stories-card')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  if (!window.__currentSprintHeaderStateBridgeBound) {
    window.__currentSprintHeaderStateBridgeBound = true;
    try {
      window.addEventListener('currentSprint:applyWorkRiskFilter', (event) => {
        const detail = event?.detail || {};
        const riskTags = Array.isArray(detail.riskTags) ? detail.riskTags.map((t) => String(t || '').trim()).filter(Boolean) : [];
        uiState.riskTags = riskTags;
        renderActiveState();
      });
      window.addEventListener('currentSprint:storiesDayFilterChanged', (event) => {
        const activeHeader = document.querySelector('.current-sprint-header-bar');
        if (!activeHeader) return;
        const detail = event?.detail || {};
        const dayKey = String(detail.dayKey || '').trim();
        activeHeader.setAttribute('data-active-day-key', dayKey);
        uiState.dayKey = dayKey;
        renderActiveState();
      });
    } catch (_) {}
  }

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
      if (refreshBtn.hasAttribute('disabled') || refreshBtn.getAttribute('aria-disabled') === 'true') return;
      document.dispatchEvent(new Event('refreshSprint'));
    });
  }

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
        const stories = document.getElementById('stories-card') || document.getElementById('stuck-card');
        if (stories) stories.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags, source: 'role-mode-' + active } }));
      }
    } catch (_) {}
    renderActiveState();
    try {
      const stories = document.getElementById('stories-card') || document.getElementById('stuck-card');
      stories?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } catch (_) {}
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
