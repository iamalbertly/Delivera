/**
 * Fixed Header Bar Component
 * Displays sprint metadata: name, date range, days remaining, total SP, status badge
 * Sticky positioning on desktop, relative on mobile
 * Rationale: Customer - Context always visible. Simplicity - Eliminates duplication. Trust - Countdown builds urgency awareness.
 */

import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDate } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { renderExportButton } from './Reporting-App-CurrentSprint-Export-Dashboard.js';
import { deriveSprintVerdict } from './Reporting-App-CurrentSprint-Alert-Banner.js';
import { readNotificationSummary } from './Reporting-App-Shared-Notifications-Dock-Manager.js';
import { renderCountdownTimer } from './Reporting-App-CurrentSprint-Countdown-Timer.js';
import { getUnifiedRiskCounts } from './Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';
import { buildCapacitySummary } from './Reporting-App-CurrentSprint-Capacity-Allocation.js';
import { SPRINT_COPY } from './Reporting-App-CurrentSprint-Copy.js';
function getHeaderStatusSummary({ statusBadge, freshnessLabel, exportReadiness }) {
  const freshnessText = freshnessLabel || (statusBadge === SPRINT_COPY.statusLive ? 'Live data' : 'Snapshot');
  return `${freshnessText} | ${exportReadiness}`;
}

function getVerdictPresentation({ verdictInfo, remainingChipLabel, remainingDays, donePercentage }) {
  const compactProgress = remainingDays == null
    ? `${donePercentage}% done`
    : `${remainingChipLabel} | ${donePercentage}% done`;
  return {
    verdict: verdictInfo.verdict,
    color: verdictInfo.color,
    remainingChipLabel,
    compactProgress,
  };
}

function buildHeaderInsights(data, { isHistoricalSprint = false } = {}) {
  const stories = Array.isArray(data?.stories) ? data.stories : [];
  if (!stories.length) return [];

  const summary = data?.summary || {};
  const allSubtasks = stories.flatMap((story) => (Array.isArray(story?.subtasks) ? story.subtasks : []));
  const subtaskEstimatedHrs = allSubtasks.reduce((sum, subtask) => sum + (Number(subtask?.estimateHours) || 0), 0);
  const subtaskLoggedHrs = allSubtasks.reduce((sum, subtask) => sum + (Number(subtask?.loggedHours) || 0), 0);
  const subtasksNoLog = allSubtasks.filter((subtask) => Number(subtask?.estimateHours || 0) > 0 && !(Number(subtask?.loggedHours || 0) > 0)).length;
  const recentSubtaskMovement = Number(summary.recentSubtaskMovementCount || 0);
  const movingParents = Number(summary.parentsWithRecentSubtaskMovement || 0);
  const noSubtasksParents = stories.filter((story) => !Array.isArray(story?.subtasks) || story.subtasks.length === 0).length;
  const subtaskCoveragePct = stories.length > 0 ? Math.round(((stories.length - noSubtasksParents) / stories.length) * 100) : 0;
  const capacity = buildCapacitySummary(data);

  let evidenceState = 'neutral';
  let evidenceLabel = 'Evidence is building';
  let evidenceDetail = 'Time signals will sharpen as work updates land.';

  if (isHistoricalSprint) {
    evidenceLabel = 'Historical evidence snapshot';
    evidenceDetail = recentSubtaskMovement > 0
      ? `${recentSubtaskMovement} recent update${recentSubtaskMovement === 1 ? '' : 's'} were captured before sprint close.`
      : 'This is a read-only summary of the final sprint state.';
  } else if (!allSubtasks.length && subtaskEstimatedHrs === 0 && subtaskLoggedHrs === 0) {
    evidenceLabel = 'Time evidence not started';
    evidenceDetail = 'No subtasks or logs yet; tracking will appear once work begins.';
  } else if (subtaskEstimatedHrs > 0 && subtaskLoggedHrs === 0) {
    evidenceState = 'warning';
    evidenceLabel = 'Plans entered, logs missing';
    evidenceDetail = `${subtasksNoLog} estimated subtask${subtasksNoLog === 1 ? '' : 's'} still have no actual work logged.`;
  } else if (subtaskCoveragePct > 0 && subtaskCoveragePct < 60) {
    evidenceState = 'warning';
    evidenceLabel = 'Time evidence is partial';
    evidenceDetail = `Only ${subtaskCoveragePct}% of stories use subtasks, so time signals are incomplete.`;
  } else if (recentSubtaskMovement > 0) {
    evidenceState = 'healthy';
    evidenceLabel = `${recentSubtaskMovement} subtask update${recentSubtaskMovement === 1 ? '' : 's'} in 24h`;
    evidenceDetail = `${movingParents} parent stor${movingParents === 1 ? 'y' : 'ies'} moved recently.`;
  } else if (subtaskLoggedHrs > 0) {
    evidenceState = 'healthy';
    evidenceLabel = 'Actual logs are flowing';
    evidenceDetail = `Tracking is active across ${Math.max(0, subtaskCoveragePct)}% of stories.`;
  }

  return [
    {
      key: 'evidence',
      eyebrow: 'Evidence',
      state: evidenceState,
      label: evidenceLabel,
      detail: evidenceDetail,
    },
    {
      key: 'capacity',
      eyebrow: 'Capacity',
      state: capacity.state,
      label: capacity.label,
      detail: capacity.detail,
    },
  ];
}

export function renderHeaderBar(data) {
  const sprint = data.sprint || {};
  const summary = data.summary || {};
  const days = data.daysMeta || {};
  const planned = data.plannedWindow || {};
  const meta = data.meta || {};
  const subtaskEstimatedHrs = Number(summary.subtaskEstimatedHours || 0);
  const subtaskLoggedHrs = Number(summary.subtaskLoggedHours || 0);
  const donePercentage = summary.percentDone ?? 0;
  const remainingDays = days.daysRemainingWorking != null ? days.daysRemainingWorking : days.daysRemainingCalendar;
  const sprintState = String(sprint.state || '').toLowerCase();
  const statusBadge = (meta.fromSnapshot || sprintState !== 'active') ? SPRINT_COPY.statusSnapshot : SPRINT_COPY.statusLive;
  const statusClass = statusBadge === SPRINT_COPY.statusLive ? 'status-live' : 'status-snapshot';
  const isHistoricalSprint = sprintState && sprintState !== 'active';
  const closedSprintCount = Array.isArray(data.recentSprints)
    ? data.recentSprints.filter((s) => String(s?.state || '').toLowerCase() === 'closed').length
    : 0;
  const issuesCount = (data.stories || []).length;
  const verdictInfo = deriveSprintVerdict(data);
  const riskCounts = getUnifiedRiskCounts(data);
  const stuckCount = Number(riskCounts.blockersOwned || 0);
  const missingEstimates = Number(verdictInfo.missingEstimate || 0);
  const missingLoggedItems = Number(verdictInfo.missingLogged || 0);
  const unassignedParents = Number(riskCounts.unownedOutcomes || verdictInfo.unassignedParents || 0);
  const remainingChipLabel = remainingDays == null
    ? 'Ends ?'
    : (remainingDays <= 0 ? 'Ended' : (remainingDays < 1 ? 'Ends today' : `Ends in ${Math.floor(remainingDays)}d`));

  const verdictRiskChips = [];
  if (stuckCount > 0) {
    verdictRiskChips.push({
      tags: ['blocker'],
      label: `${stuckCount} blockers`,
      aria: 'Filter issues to owned blockers',
    });
  }
  if (missingEstimates > 0) {
    verdictRiskChips.push({
      tags: ['missing-estimate'],
      label: `${missingEstimates} missing est`,
      aria: 'Filter issues to missing estimates',
    });
  }
  if (missingLoggedItems > 0) {
    verdictRiskChips.push({
      tags: ['no-log'],
      label: `${missingLoggedItems} no log`,
      aria: 'Filter issues to estimated, no log',
    });
  }
  if (unassignedParents > 0) {
    verdictRiskChips.push({
      tags: ['unassigned'],
      label: `${unassignedParents} unowned`,
      aria: 'Filter issues to unowned outcomes',
    });
  }

  const boardName = data.board?.name || '';
  const selectedProject = Array.isArray(data.board?.projectKeys) && data.board.projectKeys.length > 0
    ? data.board.projectKeys[0]
    : (meta.projects || '');
  const sprintDatesLabel = (formatDate(planned.start || sprint.startDate) + ' - ' + formatDate(planned.end || sprint.endDate))
    .replace(/^-\s-\s-$/, 'No active sprint window');
  const sprintNameLabel = sprint.name || (sprint.id ? `Sprint ${sprint.id}` : 'No active sprint');
  const sprintNameCompact = sprintNameLabel.length > 40 ? `${sprintNameLabel.slice(0, 40).trimEnd()}...` : sprintNameLabel;
  const hasNoHealthSignals = verdictRiskChips.length === 0;
  const isJustStartedSprint = !isHistoricalSprint && Number(donePercentage || 0) === 0 && hasNoHealthSignals && issuesCount > 0;
  const lowConfidence = closedSprintCount > 0 && closedSprintCount < 3;

  const generatedAt = meta && (meta.generatedAt || meta.snapshotAt) ? new Date(meta.generatedAt || meta.snapshotAt) : null;
  let freshnessLabel = '';
  if (generatedAt) {
    const ageMs = Date.now() - generatedAt.getTime();
    const ageMin = Math.max(0, Math.round(ageMs / 60000));
    const prefix = statusBadge === SPRINT_COPY.statusLive ? 'Live data' : 'Snapshot';
    freshnessLabel = ageMin < 1 ? `${prefix} - updated just now` : `${prefix} - updated ${ageMin} min ago`;
  }

  const hasExportableRows = issuesCount > 0;
  const exportReadiness = hasExportableRows ? SPRINT_COPY.exportReady : SPRINT_COPY.exportEmpty;
  let loggingAlertTotal = 0;
  try {
    loggingAlertTotal = Number(readNotificationSummary()?.total || 0);
  } catch (_) {}

  const verdictPresentation = getVerdictPresentation({
    verdictInfo,
    remainingChipLabel,
    remainingDays,
    donePercentage,
  });
  const statusSummary = getHeaderStatusSummary({ statusBadge, freshnessLabel, exportReadiness });
  const headerInsights = buildHeaderInsights(data, { isHistoricalSprint });
  const evidenceSummary = headerInsights.map((item) => item.label).filter(Boolean).join(' | ');

  let html = `<div class="current-sprint-header-bar" data-sprint-id="${escapeHtml(sprint.id || '')}">`;

  html += '<div class="header-row header-row-identity">';
  html += '<div class="header-identity-main">';
  html += '<div class="header-inline-summary">';
  html += `<span class="header-context-chip header-context-chip-active" title="Active board and project for this sprint view">${escapeHtml(selectedProject || 'n/a')}${boardName ? ` - ${escapeHtml(boardName)}` : ''} | Single project mode</span>`;
  html += `<span class="header-sprint-name" title="${escapeHtml(sprintNameLabel)}">${escapeHtml(sprintNameCompact)}</span>`;
  html += `<span class="header-sprint-dates">${escapeHtml(sprintDatesLabel)}</span>`;
  html += `<span class="verdict-pill verdict-pill-${escapeHtml(verdictPresentation.color)}">${escapeHtml(verdictPresentation.verdict)} | ${escapeHtml(verdictPresentation.remainingChipLabel)}</span>`;
  html += '</div>';
  if (isHistoricalSprint) {
    html += `<div class="header-health-note">${escapeHtml(SPRINT_COPY.historical)}</div>`;
  } else if (isJustStartedSprint) {
    html += `<div class="header-health-note">${escapeHtml(SPRINT_COPY.justStarted)}</div>`;
  }
  html += '</div>';
  html += '<div class="header-primary-action-group">';
  html += '<button type="button" class="btn btn-primary btn-compact header-action-cta header-action-primary" data-header-action="take-action"'
    + (isHistoricalSprint ? ' disabled aria-disabled="true"' : '')
    + ` title="${escapeHtml(isHistoricalSprint ? 'Historical sprint snapshot: live remediation actions are disabled.' : 'Focus highest priority risk rows')}">`
    + escapeHtml(isHistoricalSprint ? SPRINT_COPY.historicalAction : 'Review sprint health')
    + '</button>';
  html += '</div>';
  html += '</div>';

  html += '<div class="header-row header-row-health">';
  html += '<div class="header-identity-metrics" aria-label="Sprint summary metrics">';
  html += '<button type="button" class="header-metric" data-metric="progress" title="Sprint completion"><span class="metric-label">Done</span><span class="metric-value">' + donePercentage + '%</span></button>';
  html += '<button type="button" class="header-metric" data-metric="work-items" title="Jump to issues in this sprint"><span class="metric-label">Issues</span><span class="metric-value">' + issuesCount + '</span></button>';
  html += '<button type="button" class="header-metric" data-metric="log-est" title="Subtask logged hours versus estimated hours"><span class="metric-label">Log/Est</span><span class="metric-value">' + subtaskLoggedHrs.toFixed(1) + 'h / ' + subtaskEstimatedHrs.toFixed(1) + 'h</span></button>';
  html += '</div>';
  html += '<div class="header-health-main">';
  html += `<div class="sprint-verdict-line sprint-verdict-${escapeHtml(verdictPresentation.color)}" aria-live="polite">`;
  html += `<strong>Lens quick filters</strong>`;
  verdictRiskChips.slice(0, 3).forEach((chip) => {
    html += `<button type="button" class="verdict-pill" data-risk-tags="${escapeHtml(chip.tags.join(' '))}" aria-label="${escapeHtml(chip.aria)}">${escapeHtml(chip.label)}</button>`;
  });
  if (!verdictRiskChips.length) {
    html += `<span class="verdict-pill verdict-pill-muted">${escapeHtml(SPRINT_COPY.noRisks)}</span>`;
  }
  html += '</div>';
  html += '</div>';
  html += '<div class="header-health-countdown">';
  html += renderCountdownTimer(data, { compact: true, inlineHeader: true });
  html += '</div>';
  html += '</div>';

  html += '<div class="header-row header-row-controls">';
  html += '<div class="header-controls-row">';
  html += `<div class="status-badge ${statusClass}" role="status" aria-label="Data status: ${escapeHtml(statusBadge)}">${escapeHtml(statusBadge)}</div>`;
  html += '<label class="header-lens-select-wrap">Lens <select class="header-lens-select" data-header-lens-select aria-label="Choose sprint lens">'
    + '<option value="all">All lens</option>'
    + '<option value="developer">Dev lens</option>'
    + '<option value="scrum-master">SM lens</option>'
    + '<option value="product-owner">PO lens</option>'
    + '<option value="line-manager">Leads lens</option>'
    + '</select></label>';
  html += '<div class="header-active-filter-state" aria-live="polite"><span class="header-active-filter-state-label">Lens:</span> <span data-header-active-filter-value>All lens | none</span><button type="button" class="header-active-filter-reset" data-header-action="reset-filters" aria-label="Reset to all work" title="Reset filters to All">Reset</button></div>';
  html += `<div class="header-export-readiness"><span class="last-updated">${escapeHtml(statusSummary)}</span></div>`;
  html += '<details class="header-more-details">';
  html += '<summary>More</summary>';
  html += '<div class="header-more-panel">';
  if (evidenceSummary) {
    html += '<p class="header-more-summary"><strong>Evidence & Capacity:</strong> ' + escapeHtml(evidenceSummary) + '</p>';
  }
  html += '<p class="header-more-summary">' + escapeHtml(!isHistoricalSprint
    ? (loggingAlertTotal > 0 ? SPRINT_COPY.loggingNudges(loggingAlertTotal) : SPRINT_COPY.loggingHealthy)
    : SPRINT_COPY.historical) + '</p>';
  html += '<div class="header-actions-row">';
  if (!isHistoricalSprint) {
    html += '<button type="button" class="btn btn-secondary btn-compact" data-open-outcome-modal'
      + ' data-outcome-context="Create an outcome from the current sprint context."'
      + ' data-outcome-projects="' + escapeHtml((selectedProject || meta.projects || '').replace(/\s+/g, '')) + '">Create outcome</button>';
    if ((verdictPresentation.verdict === 'Critical' || verdictPresentation.verdict === 'At Risk') && selectedProject && boardName) {
      html += '<a class="btn btn-secondary btn-compact header-leadership-link" href="/leadership?project=' + encodeURIComponent(selectedProject) + '&board=' + encodeURIComponent(boardName) + '" data-header-action="open-leadership-trend">Leadership trend</a>';
    }
  }
  html += '<button class="btn btn-secondary btn-compact header-refresh-btn" title="Refresh sprint data"' + (isHistoricalSprint ? ' disabled aria-disabled="true"' : '') + '>Refresh</button>';
  html += renderExportButton(true);
  html += '<a class="btn btn-secondary btn-compact" href="/report" data-header-action="open-report-context">Open report</a>';
  html += '</div>';
  html += '</div>';
  html += '</details>';
  html += '</div>';
  html += '</div>';

  html += '<div class="header-mini-strip" aria-hidden="true">';
  html += `<span class="header-mini-strip-name">${escapeHtml(sprintNameCompact)}</span>`;
  html += `<span class="header-mini-strip-verdict header-mini-strip-verdict-${escapeHtml(verdictPresentation.color)}">${escapeHtml(verdictPresentation.verdict)}</span>`;
  html += `<span class="header-mini-strip-days">${escapeHtml(verdictPresentation.compactProgress)}</span>`;
  html += '</div>';
  html += '</div>';

  if (isHistoricalSprint) {
    const histLabel = `${sprint.name || 'Historical sprint'} - ${sprintDatesLabel}`;
    html += `<div class="current-sprint-history-banner" role="note">${escapeHtml(SPRINT_COPY.historical)} (${escapeHtml(histLabel)})</div>`;
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
  const lensSelect = headerBar.querySelector('[data-header-lens-select]');

  function setRiskTagsState(tags) {
    uiState.riskTags = Array.isArray(tags) ? tags.map((t) => String(t || '').trim()).filter(Boolean) : [];
    renderActiveState();
  }

  function renderActiveState() {
    if (!activeStateValueEl) return;
    const role = uiState.roleMode || 'all';
    const tags = Array.isArray(uiState.riskTags) ? uiState.riskTags : [];
    const day = uiState.dayKey || '';

    let roleLabel = 'All lens';
    if (role === 'developer') roleLabel = 'Dev lens';
    else if (role === 'scrum-master') roleLabel = 'SM lens';
    else if (role === 'product-owner') roleLabel = 'PO lens';
    else if (role === 'line-manager') roleLabel = 'Leads lens';

    let label = roleLabel;
    label += ' | ' + (tags.length ? tags.join(', ') : 'none');
    if (day) label += ' | ' + day;

    activeStateValueEl.textContent = label;
    headerBar.classList.add('header-active-filter-state-highlight');
    window.setTimeout(() => headerBar.classList.remove('header-active-filter-state-highlight'), 900);
  }

  function applyHeaderRiskAction(preferredTags, source) {
    const candidates = Array.isArray(preferredTags) ? preferredTags : [];
    if (source === 'header-take-action') {
      const selected = candidates.length ? candidates : ['blocker', 'missing-estimate', 'no-log', 'unassigned'];
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
      return;
    }
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
      const leadershipLink = event.target.closest('[data-header-action="open-leadership-trend"]');
      if (leadershipLink && headerBar.contains(leadershipLink)) {
        try {
          const url = new URL(leadershipLink.href, window.location.origin);
          window.localStorage.setItem('leadership_focus_context', JSON.stringify({
            project: url.searchParams.get('project') || '',
            board: url.searchParams.get('board') || '',
            source: 'current-sprint',
          }));
        } catch (_) {}
      }
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
        applyRoleMode('all');
        try {
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags: [], source: 'header-reset-filters' } }));
        } catch (_) {}
        renderActiveState();
        return;
      }

      const refreshContext = event.target.closest('[data-context-action="refresh-current-sprint-context"]');
      if (refreshContext && headerBar.contains(refreshContext)) {
        event.preventDefault();
        document.dispatchEvent(new Event('refreshSprint'));
        return;
      }

      const openReportContext = event.target.closest('[data-context-action="open-report-context"]');
      if (openReportContext && headerBar.contains(openReportContext)) {
        event.preventDefault();
        window.location.href = '/report';
        return;
      }

      const metricTarget = event.target.closest('.header-metric, .header-metric-link');
      if (metricTarget && headerBar.contains(metricTarget)) {
        event.preventDefault();
        const metricKeyAttr = (metricTarget.getAttribute('data-metric') || '').trim().toLowerCase();
        const label = (metricTarget.querySelector('.metric-label')?.textContent || '').trim().toLowerCase();
        const metricKey = metricKeyAttr || label;
        if (metricKey === 'work-items' || metricKey === 'work items') {
          try {
            window.dispatchEvent(new CustomEvent('currentSprint:focusStoriesEvidence', { detail: { source: 'header-work-items' } }));
          } catch (_) {}
        } else if (metricKey === 'log-est' || metricKey === 'log/est') {
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

  function syncMiniMode() {
    const threshold = window.innerWidth <= 560
      ? 24
      : Math.max(180, (headerBar.offsetTop || 0) + 120);
    headerBar.classList.toggle('header-mini-mode', window.scrollY > threshold);
  }
  syncMiniMode();
  window.addEventListener('scroll', syncMiniMode, { passive: true });
  window.addEventListener('resize', syncMiniMode);

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
        window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags, source: 'header-verdict' } }));
      } catch (_) {}
      try {
        const stories = document.getElementById('stories-card') || document.getElementById('stuck-card');
        stories?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } catch (_) {}
    });
  }

  const roleModeKey = 'current_sprint_role_mode';

  function applyRoleMode(mode) {
    let active = mode || 'all';
    if (!['all', 'developer', 'scrum-master', 'product-owner', 'line-manager'].includes(active)) {
      active = 'all';
    }
    if (lensSelect) lensSelect.value = active;
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
      window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags, source: 'role-mode-' + active } }));
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

  lensSelect?.addEventListener('change', () => {
    const mode = lensSelect.value || 'all';
    try {
      window.localStorage.setItem(roleModeKey, mode);
    } catch (_) {}
    applyRoleMode(mode);
  });

  renderActiveState();
}
