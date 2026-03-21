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
import { buildDistinctSprintFilterViews, getUnifiedRiskCounts } from './Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';
import { renderSprintCarousel } from './Reporting-App-CurrentSprint-Navigation-Carousel.js';
import { renderHealthDashboard, buildEvidenceLine } from './Reporting-App-CurrentSprint-Health-Dashboard.js';
import { getContextPieces, renderContextSegments } from './Reporting-App-Shared-Context-From-Storage.js';
import { SPRINT_COPY } from './Reporting-App-CurrentSprint-Copy.js';

const headerFilterUiState = {
  roleMode: 'all',
  riskTags: [],
  dayKey: '',
};

function renderHeaderActiveFilterLabel() {
  const activeEls = document.querySelectorAll('#current-sprint-content .current-sprint-header-bar [data-header-active-filter-value]');
  const fallbackEls = activeEls.length
    ? []
    : document.querySelectorAll('.current-sprint-header-bar [data-header-active-filter-value]');
  const nodes = activeEls.length ? Array.from(activeEls) : Array.from(fallbackEls);
  if (!nodes.length) return;
  const role = headerFilterUiState.roleMode || 'all';
  const tags = Array.isArray(headerFilterUiState.riskTags) ? headerFilterUiState.riskTags : [];
  const day = headerFilterUiState.dayKey || '';

  let roleLabel = 'All work';
  if (role === 'developer') roleLabel = 'Dev lens';
  else if (role === 'scrum-master') roleLabel = 'SM lens';
  else if (role === 'product-owner') roleLabel = 'PO lens';
  else if (role === 'line-manager') roleLabel = 'Leads lens';

  let label = roleLabel;
  if (tags.length) label += ' | ' + tags.join(', ');
  if (day) label += ' | ' + day;

  nodes.forEach((activeStateValueEl) => {
    activeStateValueEl.textContent = label;
  });
  const headerBars = document.querySelectorAll('#current-sprint-content .current-sprint-header-bar');
  const headerBarList = headerBars.length ? Array.from(headerBars) : Array.from(document.querySelectorAll('.current-sprint-header-bar'));
  headerBarList.forEach((headerBar) => {
    headerBar.classList.add('header-active-filter-state-highlight');
    window.setTimeout(() => headerBar.classList.remove('header-active-filter-state-highlight'), 900);
  });
}

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

/** Delta vs timeline prior sprint; server sets previousSprint.completionPercent from prior sprint issues. */
function computeDoneDeltaVsPriorClosed(data, currentPct) {
  const prev = data.previousSprint;
  if (!prev || prev.completionPercent == null || Number.isNaN(Number(prev.completionPercent))) return null;
  const prevPct = Number(prev.completionPercent);
  const raw = Math.round(Number(currentPct) - prevPct);
  const sign = raw > 0 ? '+' : '';
  let className = 'header-metric-delta-stable';
  if (raw > 3) className = 'header-metric-delta-up';
  else if (raw < -3) className = 'header-metric-delta-down';
  return {
    short: `${sign}${raw}%`,
    title: `vs prior closed sprint (${prevPct}% done)`,
    className,
  };
}

/** Role lens presets: secondary strip below verdict/context (plan todo-header-role-strip). */
function renderHeaderRoleModesRow(roleViews) {
  if (!Array.isArray(roleViews) || !roleViews.length) return '';
  const pills = roleViews.map((item) => {
    const mode = String(item.roleMode || '').trim();
    const label = String(item.label || '').trim();
    if (!mode) return '';
    return '<button type="button" class="role-mode-pill" data-work-risk-role-mode="' + escapeHtml(mode) + '" data-role-mode="' + escapeHtml(mode) + '" aria-pressed="false">' + escapeHtml(label) + '</button>';
  }).filter(Boolean).join('');
  if (!pills) return '';
  return '<div class="header-role-modes-row" role="group" aria-label="View work as role">'
    + '<span class="header-role-modes-label">View as</span>'
    + '<div class="header-role-modes">' + pills + '</div>'
    + '</div>';
}

function renderHeaderIdentityMetricsRow({ donePct, issuesCount, logH, estH, delta }) {
  const deltaHtml = delta
    ? ('<span class="' + escapeHtml(delta.className) + '" title="' + escapeHtml(delta.title) + '">' + escapeHtml(delta.short) + '</span>')
    : '';
  const doneInner = escapeHtml(String(donePct)) + '%' + (delta ? ' ' + deltaHtml : '');
  return '<div class="header-identity-metrics" role="group" aria-label="Sprint metrics" data-header-metric-row="1">'
    + '<div class="header-metric header-metric-tile" data-metric="done">'
    + '<span class="metric-label">Done</span>'
    + '<span class="metric-value">' + doneInner + '</span>'
    + '</div>'
    + '<div class="header-metric header-metric-tile" data-metric="issues">'
    + '<span class="metric-label">Work items</span>'
    + '<span class="metric-value">' + escapeHtml(String(issuesCount)) + '</span>'
    + '</div>'
    + '<div class="header-metric header-metric-tile" data-metric="hours">'
    + '<span class="metric-label">Logged / est</span>'
    + '<span class="metric-value">' + escapeHtml(logH.toFixed(1)) + 'h / ' + escapeHtml(estH.toFixed(1)) + 'h</span>'
    + '</div>'
    + '</div>';
}

function buildHeaderContextStrip(data, freshnessLabel) {
  const board = data?.board || {};
  const sprint = data?.sprint || {};
  const meta = data?.meta || {};
  const selectedProjects = Array.isArray(board.projectKeys) && board.projectKeys.length
    ? board.projectKeys.join(', ')
    : String(meta.projects || '').split(',').map((value) => value.trim()).filter(Boolean).join(', ');
  const start = meta.windowStart || meta.start || '';
  const end = meta.windowEnd || meta.end || '';
  const contextPieces = getContextPieces({
    projects: selectedProjects || undefined,
    rangeStart: start,
    rangeEnd: end,
    freshness: freshnessLabel || (meta.fromSnapshot ? 'Snapshot view' : 'Live sprint'),
    freshnessIsStale: !!meta.fromSnapshot,
  });
  const stripHtml = renderContextSegments(contextPieces, {
    className: 'header-context-strip',
    segmentClass: 'header-context-segment',
    refreshAction: 'refresh-current-sprint-context',
    listSemantics: true,
    stripAriaLabel: 'Sprint scope and report context',
  });
  if (stripHtml) return stripHtml;

  const scopeLabel = [selectedProjects || 'All projects', board.name || 'Board', sprint.name || 'Sprint'].filter(Boolean).join(' | ');
  return '<div class="header-context-strip">'
    + '<span class="header-context-segment">'
    + '<span class="header-context-segment-label">Context</span>'
    + '<span class="header-context-segment-value">' + escapeHtml(scopeLabel) + '</span>'
    + '</span>'
    + '<span class="header-context-segment">'
    + '<span class="header-context-segment-label">Freshness</span>'
    + '<span class="header-context-segment-value">' + escapeHtml(freshnessLabel || (meta.fromSnapshot ? 'Snapshot view' : 'Live sprint')) + '</span>'
    + '</span>'
    + '</div>';
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
  const distinctViews = buildDistinctSprintFilterViews(data, verdictInfo);
  const riskCounts = getUnifiedRiskCounts(data);
  const stuckCount = Number(riskCounts.blockersOwned || 0);
  const missingEstimates = Number(verdictInfo.missingEstimate || 0);
  const missingLoggedItems = Number(verdictInfo.missingLogged || 0);
  const unassignedParents = Number(riskCounts.unownedOutcomes || verdictInfo.unassignedParents || 0);
  const evidenceLine = buildEvidenceLine({
    verdict: verdictInfo,
    stuckCount,
    missingEstimates,
    missingLoggedItems,
    unassignedParents,
    supportOpsSP: Number(summary.supportOpsSP || 0),
    totalSP: Number(summary.totalSP || 0),
    remainingDays,
  });
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
  const sprintIdentityLine = [
    sprintNameCompact,
    sprintDatesLabel,
    (isHistoricalSprint ? 'Historical snapshot' : ''),
  ].filter(Boolean).join(' | ');
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
  const followUpSummary = !isHistoricalSprint
    ? (loggingAlertTotal > 0 ? SPRINT_COPY.loggingNudges(loggingAlertTotal) : SPRINT_COPY.loggingHealthy)
    : SPRINT_COPY.historical;
  const headerContextStripHtml = buildHeaderContextStrip(data, freshnessLabel);
  const interventionItems = Array.isArray(distinctViews?.distinctRiskViews) ? distinctViews.distinctRiskViews.slice(0, 3) : [];
  const distinctRoleViews = Array.isArray(distinctViews?.distinctRoleViews) ? distinctViews.distinctRoleViews : [];
  const headerRoleViews = !isHistoricalSprint
    ? distinctRoleViews.filter((item) => !interventionItems.some((riskView) => riskView.setKey === item.setKey))
    : [];
  const hasPriorityInterventions = interventionItems.length > 0;
  const defaultRiskTags = hasPriorityInterventions ? (interventionItems[0].riskTags || []) : [];
  const compactSummaryBits = [
    `${donePercentage}% done`,
    `${issuesCount} Work items`,
    `${subtaskLoggedHrs.toFixed(1)}h / ${subtaskEstimatedHrs.toFixed(1)}h`,
  ];
  const verdictEvidenceLine = [evidenceLine].filter(Boolean).join(' | ');
  const verdictDisplayLine = verdictEvidenceLine || verdictInfo.summary || followUpSummary || compactSummaryBits.join(' | ');
  const doneDelta = computeDoneDeltaVsPriorClosed(data, donePercentage);
  const identityMetricsHtml = renderHeaderIdentityMetricsRow({
    donePct: donePercentage,
    issuesCount,
    logH: subtaskLoggedHrs,
    estH: subtaskEstimatedHrs,
    delta: doneDelta,
  });

  let html = `<div class="current-sprint-header-bar" data-context-bar="true" data-sprint-id="${escapeHtml(sprint.id || '')}" data-default-risk-tags="${escapeHtml(defaultRiskTags.join(' '))}">`;
  html += '<div class="header-band">';
  html += '<div class="header-band-main">';
  html += `<span class="header-sprint-name" title="${escapeHtml(sprintIdentityLine)}">${escapeHtml(sprintIdentityLine)}</span>`;
  html += identityMetricsHtml;
  html += '<div class="sprint-verdict-line sprint-verdict-' + escapeHtml(verdictPresentation.color) + '">';
  html += '<strong>' + escapeHtml(verdictPresentation.verdict) + '</strong>';
  html += '<span class="sprint-verdict-explain">' + escapeHtml(verdictDisplayLine) + '</span>';
  html += '</div>';
  html += '</div>';
  html += '<div class="header-band-actions">';
  html += renderExportButton(true);
  html += '<details class="header-view-drawer">';
  html += '<summary><span class="header-status-dot ' + escapeHtml(statusClass) + '" aria-hidden="true"></span><span>Context</span><span data-header-active-filter-value>All work</span></summary>';
  html += '<div class="header-view-drawer-panel">';
  html += '<div class="header-view-summary" title="' + escapeHtml(statusSummary) + '"><span class="header-view-summary-label">Status</span><span class="header-view-summary-value">' + escapeHtml(statusBadge === SPRINT_COPY.statusLive ? 'Live' : 'Snapshot') + '</span></div>';
  html += '<div class="header-context-summary-row">';
  html += '<span class="header-drawer-meta-item">' + escapeHtml([selectedProject || 'n/a', boardName || 'Board'].filter(Boolean).join(' | ')) + '</span>';
  html += '<span class="header-drawer-meta-item">' + escapeHtml(freshnessLabel || statusBadge) + '</span>';
  html += '<span class="header-drawer-meta-item">' + escapeHtml(verdictInfo.trustLabel) + '</span>';
  html += '</div>';
  html += '<div class="header-drawer-risks">';
  verdictRiskChips.slice(0, 4).forEach((chip) => {
    html += `<button type="button" class="verdict-pill" data-risk-tags="${escapeHtml(chip.tags.join(' '))}" aria-label="${escapeHtml(chip.aria)}">${escapeHtml(chip.label)}</button>`;
  });
  if (!verdictRiskChips.length) html += `<span class="verdict-pill verdict-pill-muted">${escapeHtml(SPRINT_COPY.noRisks)}</span>`;
  html += '</div>';
  html += '<div class="header-drawer-meta" title="' + escapeHtml(statusSummary) + '">';
  html += '<span class="header-hygiene-followup" data-signal="hygiene" title="Time-tracking hygiene (not sprint health)">'
    + '<span class="header-hygiene-followup-label">Hygiene</span>'
    + '<span class="header-hygiene-followup-value">' + escapeHtml(followUpSummary) + '</span>'
    + '</span>';
  html += '<span class="header-remediation-hint" data-signal="risk-followup" title="' + escapeHtml(verdictInfo.trackingReasons || '') + '">' + escapeHtml(verdictInfo.topRemediation || '') + '</span>';
  html += '</div>';
  if (sectionLinksHtml || isLoadingShell) {
    html += '<div class="header-drawer-section">';
    html += '<div class="header-drawer-section-label">Jump to</div>';
    html += (sectionLinksHtml || '<div class="sprint-section-links sprint-section-links-compact" aria-hidden="true"><span class="sprint-section-inline-link is-disabled">Work &amp; flow</span><span class="sprint-section-inline-link is-disabled">Flow over time</span><span class="sprint-section-inline-link is-disabled">Insights</span></div>');
    html += '</div>';
  }
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
    html += '<button type="button" class="header-follow-up-link" data-header-action="focus-remediation-secondary">Open remediation queue</button>';
  }
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
  html += '<div class="header-compact-strip" aria-label="Top sprint summary">';
  if (hasPriorityInterventions) {
    const primaryIntervention = interventionItems[0] || {};
    const interventionText = interventionItems
      .map((item) => (item.label || '') + ' ' + String((item.matchedKeys || []).length || 0))
      .filter(Boolean)
      .join(' | ');
    const primaryTags = Array.isArray(primaryIntervention.riskTags) ? primaryIntervention.riskTags.join(' ') : '';
    html += '<button type="button" class="sprint-intervention-item sprint-intervention-item-primary" data-header-action="focus-remediation">Take action</button>';
    if (primaryTags) {
      html += '<button type="button" class="sprint-intervention-item" data-risk-tags="' + escapeHtml(primaryTags) + '">Focus: ' + escapeHtml(primaryIntervention.label || 'Risk') + '</button>';
    }
    html += '<span class="header-export-readiness" title="' + escapeHtml(statusSummary) + '"><span>' + escapeHtml(verdictInfo.trustLabel) + '</span><span class="header-export-readiness-sep">|</span><span>' + escapeHtml(interventionText) + '</span></span>';
  } else {
    html += '<span class="header-export-readiness header-export-readiness--quiet" title="' + escapeHtml(statusSummary) + '"><span>' + escapeHtml(verdictInfo.trustLabel) + '</span><span class="header-export-readiness-sep">|</span><span>No urgent intervention</span></span>';
  }
  html += '</div>';
  html += headerContextStripHtml;
  html += renderHeaderRoleModesRow(headerRoleViews);
  html += '<div class="header-mini-strip" aria-hidden="true">';
  html += `<span class="header-mini-strip-name">${escapeHtml(sprintNameCompact)}</span>`;
  html += `<span class="header-mini-strip-verdict header-mini-strip-verdict-${escapeHtml(verdictPresentation.color)}">${escapeHtml(verdictPresentation.verdict)}</span>`;
  html += `<span class="header-mini-strip-days">${escapeHtml(remainingChipLabel)} | ${escapeHtml(donePercentage)}% done</span>`;
  html += '</div>';
  html += '</div>';
  html += '</div>';
  return html;
}

export function wireHeaderBarHandlers() {
  const headerBar = document.querySelector('#current-sprint-content .current-sprint-header-bar')
    || document.querySelector('.current-sprint-header-bar');
  if (!headerBar) return;
  if (headerBar.dataset.headerBarHandlersWired === '1') return;
  headerBar.dataset.headerBarHandlersWired = '1';

  const roleButtons = Array.from(document.querySelectorAll('[data-work-risk-role-mode]'));
  const availableRoleModes = new Set(['all', ...roleButtons.map((button) => String(button.getAttribute('data-work-risk-role-mode') || '').trim()).filter(Boolean)]);

  function setRiskTagsState(tags) {
    headerFilterUiState.riskTags = Array.isArray(tags) ? tags.map((t) => String(t || '').trim()).filter(Boolean) : [];
    renderHeaderActiveFilterLabel();
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
        if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(stories);
        else stories?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
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
      if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(stories);
      else stories?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } catch (_) {}
  }

  function handleInterventionClick(target, event) {
    const raw = target || event?.target;
    const el = raw && raw.nodeType === 1 ? raw : raw?.parentElement;
    if (!el) return false;
    const bar = el.closest('.current-sprint-header-bar');
    if (!bar) return false;
    if (event) event.preventDefault();
    const focusRemediation = el.closest?.('[data-header-action="focus-remediation"]');
    if (focusRemediation) {
      applyHeaderRiskAction(['no-log', 'missing-estimate', 'unassigned', 'blocker'], 'header-take-action');
      return true;
    }
    const interventionTarget = el.closest?.('.sprint-intervention-item');
    if (interventionTarget) {
      const tags = String(interventionTarget.getAttribute('data-risk-tags') || '').split(/\s+/).filter(Boolean);
      applyHeaderRiskAction(tags, 'header-intervention');
      return true;
    }
    return false;
  }

  function handleVerdictPillClick(target, event) {
    const raw = target || event?.target;
    const el = raw && raw.nodeType === 1 ? raw : raw?.parentElement;
    const pill = el?.matches?.('.verdict-pill') ? el : el?.closest?.('.verdict-pill');
    const bar = pill?.closest?.('.current-sprint-header-bar');
    if (!pill || !bar) return false;
    if (event) event.preventDefault();
    const riskTagsAttr = pill.getAttribute('data-risk-tags') || '';
    const riskTags = riskTagsAttr.split(/\s+/).filter(Boolean);
    setRiskTagsState(riskTags);
    try {
      window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags, source: 'header-verdict' } }));
    } catch (_) {}
    try {
      const stories = document.getElementById('stories-card') || document.getElementById('stuck-card');
      if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(stories);
      else stories?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } catch (_) {}
    return true;
  }

  const contentRoot = document.getElementById('current-sprint-content');
  const delegationHost = contentRoot || headerBar;
  if (delegationHost.dataset.headerBarActionDelegationWired !== '1') {
    delegationHost.dataset.headerBarActionDelegationWired = '1';
    delegationHost.addEventListener('click', (event) => {
      const raw = event.target;
      const el = raw && raw.nodeType === 1 ? raw : raw?.parentElement;
      if (!el) return;
      const bar = el.closest('.current-sprint-header-bar');
      if (!bar) return;
      const leadershipLink = el.closest('[data-header-action="open-leadership-trend"]');
      if (leadershipLink && bar.contains(leadershipLink)) {
        try {
          const url = new URL(leadershipLink.href, window.location.origin);
          window.localStorage.setItem('leadership_focus_context', JSON.stringify({
            project: url.searchParams.get('project') || '',
            board: url.searchParams.get('board') || '',
            source: 'current-sprint',
          }));
        } catch (_) {}
      }
      if (handleInterventionClick(el, event)) {
        return;
      }

      const resetFilters = el.closest('[data-header-action="reset-filters"]');
      if (resetFilters && bar.contains(resetFilters)) {
        event.preventDefault();
        setRiskTagsState([]);
        headerFilterUiState.dayKey = '';
        applyRoleMode('all');
        try {
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags: [], source: 'header-reset-filters' } }));
        } catch (_) {}
        renderHeaderActiveFilterLabel();
        return;
      }

      const refreshContext = el.closest('[data-context-action="refresh-current-sprint-context"]');
      if (refreshContext && bar.contains(refreshContext)) {
        event.preventDefault();
        document.dispatchEvent(new Event('refreshSprint'));
        return;
      }

      const openReportContext = el.closest('[data-context-action="open-report-context"]');
      if (openReportContext && bar.contains(openReportContext)) {
        event.preventDefault();
        window.location.href = '/report';
        return;
      }

    }, true);
  }

  if (!window.__currentSprintHeaderStateBridgeBound) {
    window.__currentSprintHeaderStateBridgeBound = true;
    try {
      window.addEventListener('currentSprint:applyWorkRiskFilter', (event) => {
        const detail = event?.detail || {};
        const riskTags = Array.isArray(detail.riskTags) ? detail.riskTags.map((t) => String(t || '').trim()).filter(Boolean) : [];
        const source = String(detail.source || '');
        if (source.startsWith('role-mode-')) {
          headerFilterUiState.roleMode = source.replace('role-mode-', '');
        }
        headerFilterUiState.riskTags = riskTags;
        renderHeaderActiveFilterLabel();
      });
      window.addEventListener('currentSprint:applyRoleMode', (event) => {
        const detail = event?.detail || {};
        applyRoleMode(String(detail.mode || 'all'));
      });
      window.addEventListener('currentSprint:storiesDayFilterChanged', (event) => {
        const activeHeader = document.querySelector('#current-sprint-content .current-sprint-header-bar');
        if (!activeHeader) return;
        const detail = event?.detail || {};
        const dayKey = String(detail.dayKey || '').trim();
        activeHeader.setAttribute('data-active-day-key', dayKey);
        headerFilterUiState.dayKey = dayKey;
        renderHeaderActiveFilterLabel();
      });
    } catch (_) {}
  }

  /** Mini collapse: tablets/desktop only (plan todo-mini-header-mobile — avoid empty/churn strip on phones). */
  function syncMiniMode() {
    const miniStrip = headerBar.querySelector('.header-mini-strip');
    if (window.innerWidth <= 720) {
      headerBar.classList.remove('header-mini-mode');
      if (miniStrip) miniStrip.setAttribute('aria-hidden', 'true');
      return;
    }
    const threshold = Math.max(120, (headerBar.offsetTop || 0) + 72);
    const hasMiniMode = window.scrollY > threshold;
    headerBar.classList.toggle('header-mini-mode', hasMiniMode);
    if (miniStrip) {
      miniStrip.setAttribute('aria-hidden', hasMiniMode ? 'false' : 'true');
    }
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
        if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(carousel);
        else carousel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  const alertsBtn = headerBar.querySelector('[data-header-action="open-logging-alerts"]');
  if (alertsBtn) {
    alertsBtn.addEventListener('click', () => {
      const storiesCard = document.getElementById('stories-card');
      const risksCard = document.getElementById('stuck-card');
      if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(risksCard || storiesCard);
      else (risksCard || storiesCard)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  }

  const verdictLine = headerBar.querySelector('.sprint-verdict-line');
  if (verdictLine) {
    verdictLine.addEventListener('click', (event) => {
      handleVerdictPillClick(event.target, event);
    });
  }

  headerBar.querySelectorAll('.sprint-intervention-item').forEach((button) => {
    if (button.dataset.headerActionBound === '1') return;
    button.dataset.headerActionBound = '1';
    button.addEventListener('click', (event) => {
      handleInterventionClick(button, event);
    });
  });

  headerBar.querySelectorAll('.verdict-pill').forEach((button) => {
    if (button.dataset.headerVerdictBound === '1') return;
    button.dataset.headerVerdictBound = '1';
    button.addEventListener('click', (event) => {
      handleVerdictPillClick(button, event);
    });
  });

  const roleModeKey = 'current_sprint_role_mode';

  function applyRoleMode(mode, options = {}) {
    const silent = options.silent === true;
    let active = mode || 'all';
    if (!availableRoleModes.has(active)) {
      active = 'all';
    }
    roleButtons.forEach((button) => {
      button.classList.toggle('is-active', button.getAttribute('data-work-risk-role-mode') === active);
      button.setAttribute('aria-pressed', button.classList.contains('is-active') ? 'true' : 'false');
    });
    headerFilterUiState.roleMode = active;
    const presetMap = {
      all: [],
      developer: ['no-log', 'missing-estimate'],
      'scrum-master': ['blocker'],
      'product-owner': ['scope', 'blocker'],
      'line-manager': ['unassigned', 'blocker'],
    };
    const riskTags = presetMap[active] || [];
    setRiskTagsState(riskTags);
    try {
      window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags, source: 'role-mode-' + active } }));
    } catch (_) {}
    renderHeaderActiveFilterLabel();
    if (!silent) {
      try {
        const stories = document.getElementById('stories-card') || document.getElementById('stuck-card');
        if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(stories);
        else stories?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } catch (_) {}
    }
  }

  let initialMode = 'all';
  try {
    const stored = window.localStorage.getItem(roleModeKey);
    if (stored) initialMode = stored;
  } catch (_) {}
  applyRoleMode(initialMode, { silent: true });

  roleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.getAttribute('data-work-risk-role-mode') || 'all';
      try {
        window.localStorage.setItem(roleModeKey, mode);
      } catch (_) {}
      applyRoleMode(mode);
    });
  });

  renderHeaderActiveFilterLabel();
}
