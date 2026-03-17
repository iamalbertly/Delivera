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
import { getUnifiedRiskCounts } from './Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';
import { buildCapacitySummary } from './Reporting-App-CurrentSprint-Capacity-Allocation.js';
import { renderSprintCarousel } from './Reporting-App-CurrentSprint-Navigation-Carousel.js';
import { renderHealthDashboard } from './Reporting-App-CurrentSprint-Health-Dashboard.js';
import { renderAttentionQueue } from './Reporting-App-Shared-Attention-Queue.js';
import { renderContextSummaryStrip } from './Reporting-App-Shared-Context-Summary-Strip.js';
import { SPRINT_COPY } from './Reporting-App-CurrentSprint-Copy.js';
function getHeaderStatusSummary({ statusBadge, freshnessLabel, exportReadiness }) {
  const freshnessText = freshnessLabel || (statusBadge === SPRINT_COPY.statusLive ? 'Live data' : 'Snapshot');
  return `${freshnessText} | ${exportReadiness}`;
}

function getVerdictPresentation({ verdictInfo, remainingChipLabel, remainingDays, donePercentage }) {
  return {
    verdict: verdictInfo.verdict,
    color: verdictInfo.color,
    remainingChipLabel,
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

function buildMissionContextChips({
  selectedProject,
  boardName,
  sprintDatesLabel,
  freshnessLabel,
  statusBadge,
  exportReadiness,
  isHistoricalSprint,
}) {
  const chips = [];
  chips.push(`<span class="mission-context-chip" title="Current project and board">${escapeHtml(selectedProject || 'n/a')}${boardName ? ` | ${escapeHtml(boardName)}` : ''}</span>`);
  chips.push(`<span class="mission-context-chip" title="Sprint date window">${escapeHtml(sprintDatesLabel)}</span>`);
  const freshnessTone = statusBadge === SPRINT_COPY.statusLive && !isHistoricalSprint ? ' is-live' : ' is-stale';
  chips.push(`<span class="mission-context-chip${freshnessTone}" title="Freshness and export readiness">${escapeHtml(freshnessLabel || statusBadge)} | ${escapeHtml(exportReadiness)}</span>`);
  return chips.join('');
}

function buildMissionContextRibbon({
  selectedProject,
  boardName,
  sprintDatesLabel,
  statusBadge,
  freshnessLabel,
  exportReadiness,
}) {
  return renderContextSummaryStrip({
    chips: [
      { label: 'Scope', value: [selectedProject || 'n/a', boardName || 'Board'].filter(Boolean).join(' | ') },
      { label: 'Window', value: sprintDatesLabel || 'No active sprint window' },
      { label: 'Trust', value: `${freshnessLabel || statusBadge} | ${exportReadiness}`, tone: statusBadge === SPRINT_COPY.statusLive ? 'success' : 'warning' },
    ],
  });
}

function buildMissionAttentionRail(verdictRiskChips, remainingChipLabel) {
  const items = Array.isArray(verdictRiskChips) && verdictRiskChips.length
    ? verdictRiskChips.slice(0, 3).map((chip) => ({
        label: chip.label,
        tone: chip.tags.includes('blocker') ? 'danger' : 'warning',
        detail: chip.tags.includes('blocker') ? 'Open now' : 'Review',
        action: chip.tags[0] === 'blocker'
          ? 'open-blockers'
          : (chip.tags[0] === 'missing-estimate'
            ? 'open-missing-estimate'
            : (chip.tags[0] === 'unassigned' ? 'open-unassigned' : 'open-blockers')),
      }))
    : [{ label: remainingChipLabel || SPRINT_COPY.noRisks, tone: 'muted' }];
  return renderAttentionQueue({ title: '', items, compact: true });
}

export function renderHeaderBar(data, options = {}) {
  const { sectionLinksHtml = '', isLoadingShell = false } = options;
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
  const boardId = data.board?.id || '';
  const sprintId = sprint.id || '';
  const selectedProject = Array.isArray(data.board?.projectKeys) && data.board.projectKeys.length > 0
    ? data.board.projectKeys[0]
    : (meta.projects || '');
  const sprintDatesLabel = (formatDate(planned.start || sprint.startDate) + ' - ' + formatDate(planned.end || sprint.endDate))
    .replace(/^-\s-\s-$/, 'No active sprint window');
  const sprintNameLabel = sprint.name || (sprint.id ? `Sprint ${sprint.id}` : 'No active sprint');
  const sprintNameCompact = sprintNameLabel.length > 40 ? `${sprintNameLabel.slice(0, 40).trimEnd()}...` : sprintNameLabel;
  const sprintIdentityLine = [sprintNameCompact, sprintDatesLabel, verdictInfo.verdict].filter(Boolean).join(' | ');
  const hasNoHealthSignals = verdictRiskChips.length === 0;
  const isJustStartedSprint = !isHistoricalSprint && Number(donePercentage || 0) === 0 && hasNoHealthSignals && issuesCount > 0;
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
  const followUpSummary = !isHistoricalSprint
    ? (loggingAlertTotal > 0 ? SPRINT_COPY.loggingNudges(loggingAlertTotal) : SPRINT_COPY.loggingHealthy)
    : SPRINT_COPY.historical;
  const missionContextRibbon = buildMissionContextRibbon({
    selectedProject,
    boardName,
    sprintDatesLabel,
    freshnessLabel: freshnessLabel || (statusBadge === SPRINT_COPY.statusLive ? 'Live data' : 'Snapshot'),
    statusBadge,
    exportReadiness,
  });
  const missionAttentionRail = buildMissionAttentionRail(verdictRiskChips, remainingChipLabel);
  const hasPriorityInterventions = stuckCount > 0 || missingEstimates > 0 || unassignedParents > 0;

  let html = `<div class="current-sprint-header-bar" data-context-bar="true" data-sprint-id="${escapeHtml(sprint.id || '')}">`;
  html += '<div class="header-band">';
  html += '<div class="header-band-main">';
  html += `<span class="header-sprint-name" title="${escapeHtml(sprintIdentityLine)}">${escapeHtml(sprintIdentityLine)}</span>`;
  html += '<div class="sprint-verdict-line sprint-verdict-' + escapeHtml(verdictPresentation.color) + '">';
  html += '<strong>' + escapeHtml(verdictPresentation.verdict) + '</strong>';
  html += '<span class="sprint-verdict-explain">' + escapeHtml(verdictInfo.tagline || verdictInfo.summary || followUpSummary) + '</span>';
  html += '</div>';
  html += '</div>';
  html += '<div class="header-band-metrics" aria-label="Sprint summary metrics">';
  html += '<button type="button" class="header-metric" data-metric="progress" title="Sprint completion"><span class="metric-label">Done</span><span class="metric-value">' + donePercentage + '%</span><span class="metric-meta">' + escapeHtml(remainingChipLabel) + '</span></button>';
  html += '<button type="button" class="header-metric" data-metric="work-items" title="Jump to sprint work"><span class="metric-label">Issues</span><span class="metric-value">' + issuesCount + '</span></button>';
  html += '<button type="button" class="header-metric" data-metric="log-est" title="Subtask logged versus estimated hours"><span class="metric-label">Log/Est</span><span class="metric-value">' + subtaskLoggedHrs.toFixed(1) + ' / ' + subtaskEstimatedHrs.toFixed(1) + 'h</span></button>';
  html += '</div>';
  html += '<div class="header-band-actions">';
  html += '<button type="button" class="btn btn-primary btn-compact header-action-cta header-action-primary" data-header-action="take-action"'
    + (isHistoricalSprint ? ' disabled aria-disabled="true"' : '')
    + ` title="${escapeHtml(isHistoricalSprint ? 'Historical sprint snapshot: live remediation actions are disabled.' : 'Focus highest priority risk rows')}">`
    + escapeHtml(isHistoricalSprint ? SPRINT_COPY.historicalAction : 'Focus risk work')
    + '</button>';
  if (!isHistoricalSprint) {
    html += '<button type="button" class="btn btn-secondary btn-compact header-create-work-btn" data-open-outcome-modal'
      + ' data-outcome-context="Create work from the current sprint context."'
      + ' data-outcome-projects="' + escapeHtml((selectedProject || meta.projects || '').replace(/\s+/g, '')) + '">Create work</button>';
  }
  html += '<button class="btn btn-secondary btn-compact header-refresh-btn" title="Refresh sprint data and context"' + (isHistoricalSprint ? ' disabled aria-disabled="true"' : '') + '>Refresh</button>';
  html += '<details class="header-view-drawer">';
  html += '<summary><span class="header-status-dot ' + escapeHtml(statusClass) + '" aria-hidden="true"></span><span>More</span><span data-header-active-filter-value>Lens: All | none</span></summary>';
  html += '<div class="header-view-drawer-panel">';
  html += '<div class="header-view-summary" title="' + escapeHtml(statusSummary) + '"><span class="header-view-summary-label">Status</span><span class="header-view-summary-value">' + escapeHtml(statusBadge === SPRINT_COPY.statusLive ? 'Live' : 'Snapshot') + '</span></div>';
  html += '<label class="header-lens-select-wrap">View as <select class="header-lens-select" data-header-lens-select aria-label="Choose sprint lens">'
    + '<option value="all">All lens</option>'
    + '<option value="developer">Dev lens</option>'
    + '<option value="scrum-master">SM lens</option>'
    + '<option value="product-owner">PO lens</option>'
    + '<option value="line-manager">Leads lens</option>'
    + '</select></label>';
  html += '<div class="header-drawer-risks">';
  verdictRiskChips.slice(0, 4).forEach((chip) => {
    html += `<button type="button" class="verdict-pill" data-risk-tags="${escapeHtml(chip.tags.join(' '))}" aria-label="${escapeHtml(chip.aria)}">${escapeHtml(chip.label)}</button>`;
  });
  if (!verdictRiskChips.length) html += `<span class="verdict-pill verdict-pill-muted">${escapeHtml(SPRINT_COPY.noRisks)}</span>`;
  html += '</div>';
  html += '<div class="header-drawer-meta" title="' + escapeHtml(statusSummary) + '">';
  html += '<span>' + escapeHtml(followUpSummary) + '</span>';
  headerInsights.forEach((item) => {
    html += '<span title="' + escapeHtml(item.detail || '') + '">' + escapeHtml(item.eyebrow + ': ' + item.label) + '</span>';
  });
  html += '</div>';
  if (sectionLinksHtml || isLoadingShell) {
    html += '<div class="header-drawer-section">';
    html += '<div class="header-drawer-section-label">Jump to</div>';
    html += (sectionLinksHtml || '<div class="sprint-section-links sprint-section-links-compact" aria-hidden="true"><span class="sprint-section-inline-link is-disabled">Work &amp; flow</span><span class="sprint-section-inline-link is-disabled">Flow over time</span><span class="sprint-section-inline-link is-disabled">Insights</span></div>');
    html += '</div>';
  }
  html += renderExportButton(true);
  html += '<div class="header-drawer-evidence">';
  html += '<div class="header-drawer-section">';
  html += '<div class="header-drawer-section-label">Why this verdict</div>';
  html += renderHealthDashboard(data, { compact: true });
  html += '</div>';
  html += '<div class="header-drawer-section">';
  html += '<div class="header-drawer-section-label">Switch sprint</div>';
  html += renderSprintCarousel(data);
  html += '</div>';
  html += '</div>';
  html += '<div class="header-drawer-links">';
  html += '<button type="button" class="header-follow-up-link" data-header-action="reset-filters">Reset lens</button>';
  if (!isHistoricalSprint) {
    if (selectedProject && boardName) {
      html += '<a class="header-follow-up-link header-leadership-link" href="/leadership?project=' + encodeURIComponent(selectedProject) + '&board=' + encodeURIComponent(boardName) + '" data-header-action="open-leadership-trend">Leadership trend</a>';
    }
  }
  const reportHref = boardId
    ? ('/report?boardId=' + encodeURIComponent(String(boardId)) + (sprintId ? '&sprintId=' + encodeURIComponent(String(sprintId)) : '') + (selectedProject ? '&projects=' + encodeURIComponent(String(selectedProject)) : ''))
    : '/report';
  html += '<a class="header-follow-up-link" href="' + reportHref + '" data-header-action="open-report-context">Open report</a>';
  html += '</div>';
  html += '</div>';
  html += '</details>';
  html += '</div>';
  html += '</div>';
  html += '<div class="mission-strip-secondary" aria-label="Sprint mission strip detail">';
  html += '<div class="mission-context-ribbon">' + missionContextRibbon + '</div>';
  if (hasPriorityInterventions) {
    html += '<div class="sprint-intervention-queue" aria-label="Top intervention queue">';
    html += '<button type="button" class="sprint-intervention-item" data-risk-tags="blocker"><span class="metric-label">Your blockers now</span><span class="metric-value">' + stuckCount + '</span></button>';
    html += '<button type="button" class="sprint-intervention-item" data-risk-tags="missing-estimate"><span class="metric-label">Missing estimates</span><span class="metric-value">' + missingEstimates + '</span></button>';
    html += '<button type="button" class="sprint-intervention-item" data-risk-tags="unassigned"><span class="metric-label">Ownership gaps</span><span class="metric-value">' + unassignedParents + '</span></button>';
    html += '</div>';
  }
  const showAttentionRail = verdictRiskChips.length > 0 && isHistoricalSprint;
  if (showAttentionRail) {
    html += '<div class="mission-attention-rail">' + missionAttentionRail + '</div>';
  }
  if (isHistoricalSprint) {
    const histLabel = `${sprint.name || 'Historical sprint'} - ${sprintDatesLabel}`;
    html += `<span class="current-sprint-history-banner current-sprint-history-banner-inline" role="note">${escapeHtml(SPRINT_COPY.historical)} (${escapeHtml(histLabel)})</span>`;
  }
  if (!hasPriorityInterventions && !isHistoricalSprint) {
    html += '<span class="header-export-readiness header-export-readiness--quiet" title="' + escapeHtml(statusSummary) + '"><span>Healthy</span><span class="header-export-readiness-sep">|</span><span>No urgent intervention</span></span>';
  }
  html += '</div>';
  html += '<div class="header-mini-strip" aria-hidden="true">';
  html += `<span class="header-mini-strip-name">${escapeHtml(sprintNameCompact)}</span>`;
  html += `<span class="header-mini-strip-verdict header-mini-strip-verdict-${escapeHtml(verdictPresentation.color)}">${escapeHtml(verdictPresentation.verdict)}</span>`;
  html += `<span class="header-mini-strip-days">${escapeHtml(remainingChipLabel)} | ${escapeHtml(donePercentage)}% done</span>`;
  html += '</div>';
  html += '</div>';
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

    let label = 'Lens: ' + roleLabel;
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
    const threshold = window.innerWidth <= 720
      ? 8
      : Math.max(120, (headerBar.offsetTop || 0) + 72);
    headerBar.classList.toggle('header-mini-mode', window.scrollY > threshold);
  }
  syncMiniMode();
  window.addEventListener('scroll', syncMiniMode, { passive: true });
  window.addEventListener('resize', syncMiniMode);

  const sprintName = headerBar.querySelector('.header-sprint-name');
  if (sprintName) {
    sprintName.style.cursor = 'pointer';
    sprintName.addEventListener('click', () => {
      const switcher = document.querySelector('.sprint-switcher-card, .sprint-hud-details');
      if (switcher) {
        switcher.open = true;
      }
      const carousel = document.querySelector('.sprint-hud-carousel-inline, .sprint-carousel, .sprint-switcher-card');
      if (carousel) {
        carousel.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
