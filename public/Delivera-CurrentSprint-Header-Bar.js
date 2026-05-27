/**
 * Fixed Header Bar Component
 * Displays sprint metadata: name, date range, days remaining, total SP, status badge
 * Sticky positioning on desktop, relative on mobile
 * Rationale: Customer - Context always visible. Simplicity - Eliminates duplication. Trust - Countdown builds urgency awareness.
 */

import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { formatDate } from './Delivera-Shared-Format-DateNumber-Helpers.js';
import { renderExportButton } from './Delivera-CurrentSprint-Export-Dashboard.js';
import { deriveSprintVerdict } from './Delivera-CurrentSprint-Alert-Banner.js';
import { readNotificationSummary } from './Delivera-Shared-Notifications-Dock-Manager.js';
import { buildDistinctSprintFilterViews, getUnifiedRiskCounts } from './Delivera-CurrentSprint-Data-WorkRisk-Rows.js';
import { renderHealthDashboard, buildEvidenceLine } from './Delivera-CurrentSprint-Health-Dashboard.js';
import { getContextPieces, renderContextSegments } from './Delivera-Shared-Context-From-Storage.js';
import {
  deriveUseCaseFromRiskTags,
  getCurrentSprintPayload,
  getCurrentSprintSummaryContext,
  isSprintCommentSendAllowed,
  showSprintActionToast,
} from './Delivera-CurrentSprint-Action-Bridge.js';
import { openJiraNudgeReviewSheet } from './Delivera-CurrentSprint-JiraNudge-02ReviewSheet-01UI.js';
import {
  buildSprintAtAGlanceBriefing,
  renderMissionBriefingHtml,
} from './Delivera-CurrentSprint-Summary-03AtAGlance-Briefing-SSOT.js';
import {
  formatRiskCountsRollup,
  unblockActionLabel,
} from './Delivera-CurrentSprint-Risk-Vocabulary-01Terms-SSOT.js';
import {
  SPRINT_COPY,
  formatSprintRemainingLabel,
  formatFreshnessAgeLabel,
} from './Delivera-CurrentSprint-Copy.js';

const headerFilterUiState = {
  roleMode: 'all',
  riskTags: [],
  dayKey: '',
};

/** Incremented each time wireHeaderBarHandlers completes a full bind (not early-return). Second+ wires must not reset risk tags from role presets â€” that clobbered Take action / verdict filters after progressive full render. */
let headerBarWireSessionCount = 0;
const headerMiniModeState = {
  activeHeader: null,
  rafPending: false,
  listenersBound: false,
  lastMode: null,
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

  let roleLabel = SPRINT_COPY.allWorkDefault;
  if (role === 'developer') roleLabel = SPRINT_COPY.lensDev;
  else if (role === 'scrum-master') roleLabel = SPRINT_COPY.lensSM;
  else if (role === 'product-owner') roleLabel = SPRINT_COPY.lensPO;
  else if (role === 'line-manager') roleLabel = SPRINT_COPY.lensLeads;

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
  const freshnessText = freshnessLabel || (statusBadge === SPRINT_COPY.statusLive ? SPRINT_COPY.liveDataShort : SPRINT_COPY.statusSnapshot);
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
    title: SPRINT_COPY.vsPriorClosedSprint(prevPct),
    className,
  };
}

/** Role lens presets: secondary strip below verdict/context (plan todo-header-role-strip). */
function renderHeaderRoleModesRow(roleViews) {
  if (!Array.isArray(roleViews) || !roleViews.length) return '';
  const pillsArray = roleViews.map((item) => {
    const mode = String(item.roleMode || '').trim();
    const label = String(item.label || '').trim();
    if (!mode) return '';
    return '<button type="button" class="role-mode-pill" data-work-risk-role-mode="' + escapeHtml(mode) + '" data-role-mode="' + escapeHtml(mode) + '" aria-pressed="false">' + escapeHtml(label) + '</button>';
  }).filter(Boolean);
  if (!pillsArray.length) return '';
  // If many pills, show first 4 and collapse the rest into a "more" list to reduce clutter.
  const visible = pillsArray.slice(0, 4).join('');
  const hidden = pillsArray.slice(4).join('');
  const moreCount = Math.max(0, pillsArray.length - 4);
  const moreHtml = moreCount > 0 ? ('<button type="button" class="role-mode-more" data-action="show-more-roles" aria-expanded="false">+' + String(moreCount) + '</button>') : '';
  const hiddenWrapper = moreCount > 0 ? ('<div class="role-mode-more-list" style="display:none">' + hidden + '</div>') : '';
  return '<div class="header-role-modes-row" data-strip="role-lens" role="group" aria-label="' + escapeHtml(SPRINT_COPY.ariaViewAsRole) + '">'
    + '<span class="header-role-modes-label">' + escapeHtml(SPRINT_COPY.viewAsLabel) + '</span>'
    + '<div class="header-role-modes" data-header-lens-select="true">' + visible + moreHtml + hiddenWrapper + '</div>'
    + '</div>';
}

function renderSprintInterventionQueueHtml(stuckCount, missingEstimates, unassignedParents, missingLogged = 0) {
  const rollup = formatRiskCountsRollup({
    stale: stuckCount,
    missingEst: missingEstimates,
    missingLog: missingLogged,
    unowned: unassignedParents,
  });
  if (!rollup) return '';
  return '<div class="sprint-intervention-queue" aria-label="Intervention queue">'
    + '<span class="sprint-intervention-item sprint-intervention-rollup"><span class="metric-label">' + escapeHtml(rollup) + '</span></span>'
    + '</div>';
}

function renderHeaderIdentityMetricsRow({ donePct, issuesCount, logH, estH, delta }) {
  const deltaHtml = delta
    ? ('<span class="' + escapeHtml(delta.className) + '" title="' + escapeHtml(delta.title) + '">' + escapeHtml(delta.short) + '</span>')
    : '';
  const doneInner = escapeHtml(String(donePct)) + '%' + (delta ? ' ' + deltaHtml : '');
  return '<div class="header-identity-metrics" role="group" aria-label="' + escapeHtml(SPRINT_COPY.ariaSprintMetrics) + '" data-header-metric-row="1">'
    + '<div class="header-metric header-metric-tile" data-metric="done">'
    + '<span class="metric-label">' + escapeHtml(SPRINT_COPY.metricDone) + '</span>'
    + '<span class="metric-value">' + doneInner + '</span>'
    + '</div>'
    + '<div class="header-metric header-metric-tile" data-metric="issues">'
    + '<span class="metric-label">' + escapeHtml(SPRINT_COPY.metricWorkItems) + '</span>'
    + '<span class="metric-value">' + escapeHtml(String(issuesCount)) + '</span>'
    + '</div>'
    + '<div class="header-metric header-metric-tile" data-metric="hours">'
    + '<span class="metric-label">' + escapeHtml(SPRINT_COPY.metricLoggedEst) + '</span>'
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
  /* ALB-76: scope + freshness live on the persistent context strip; drawer keeps board-only line (no duplicate project/freshness row). */
  const contextPieces = getContextPieces({
    projects: selectedProjects || undefined,
    rangeStart: start,
    rangeEnd: end,
    freshness: freshnessLabel || '',
    freshnessIsStale: !!meta.fromSnapshot,
  });
  const stripHtml = renderContextSegments(contextPieces, {
    className: 'header-context-strip',
    segmentClass: 'header-context-segment',
    refreshAction: 'refresh-current-sprint-context',
    listSemantics: true,
    stripAriaLabel: SPRINT_COPY.stripScopeReportContext,
  });
  if (stripHtml) return stripHtml;

  const scopeLabel = [selectedProjects || SPRINT_COPY.allProjects, board.name || SPRINT_COPY.boardFallback, sprint.name || SPRINT_COPY.sprintFallback].filter(Boolean).join(' | ');
  return '<div class="header-context-strip">'
    + '<span class="header-context-segment">'
    + '<span class="header-context-segment-label">' + escapeHtml(SPRINT_COPY.segmentLabelContext) + '</span>'
    + '<span class="header-context-segment-value">' + escapeHtml(scopeLabel) + '</span>'
    + '</span>'
    + '</div>';
}

export function renderHeaderBar(data, options = {}) {
  const {
    sectionLinksHtml = '',
    isLoadingShell = false,
    viewportLean = false,
    sectionLinksInDrawer = false,
  } = options;
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
  const missionBriefing = !isHistoricalSprint ? buildSprintAtAGlanceBriefing(data) : null;
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
  const remainingChipLabel = formatSprintRemainingLabel(remainingDays);

  const verdictRiskChips = [];
  if (stuckCount > 0) {
    verdictRiskChips.push({
      tags: ['blocker'],
      label: SPRINT_COPY.blockersCount(stuckCount),
      aria: 'Filter issues to owned blockers',
    });
  }
  if (missingEstimates > 0) {
    verdictRiskChips.push({
      tags: ['missing-estimate'],
      label: SPRINT_COPY.missingEstCount(missingEstimates),
      aria: 'Filter issues to missing estimates',
    });
  }
  if (missingLoggedItems > 0) {
    verdictRiskChips.push({
      tags: ['no-log'],
      label: SPRINT_COPY.noLogCount(missingLoggedItems),
      aria: 'Filter issues to estimated, no log',
    });
  }
  if (unassignedParents > 0) {
    verdictRiskChips.push({
      tags: ['unassigned'],
      label: SPRINT_COPY.unownedCount(unassignedParents),
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
    .replace(/^-\s-\s-$/, SPRINT_COPY.noActiveSprintWindow);
  const sprintNameLabel = sprint.name || (sprint.id ? SPRINT_COPY.sprintNamed(sprint.id) : SPRINT_COPY.noActiveSprintName);
  const sprintNameCompact = sprintNameLabel.length > 40 ? `${sprintNameLabel.slice(0, 40).trimEnd()}...` : sprintNameLabel;
  const sprintIdentityLine = [
    sprintNameCompact,
    sprintDatesLabel,
    (isHistoricalSprint ? SPRINT_COPY.historicalSnapshotShort : ''),
  ].filter(Boolean).join(' | ');
  const sprintDateLine = [
    sprintDatesLabel,
    (isHistoricalSprint ? SPRINT_COPY.historicalSnapshotShort : ''),
  ].filter(Boolean).join(' | ');
  const generatedAt = meta && (meta.generatedAt || meta.snapshotAt) ? new Date(meta.generatedAt || meta.snapshotAt) : null;
  let freshnessLabel = '';
  if (generatedAt) {
    const ageMs = Date.now() - generatedAt.getTime();
    const ageMin = Math.max(0, Math.round(ageMs / 60000));
    freshnessLabel = formatFreshnessAgeLabel(statusBadge === SPRINT_COPY.statusLive, ageMin);
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
  /* ALB-31: distinctRiskViews can be empty while owned blockers exist (role lenses only). Still surface Take action + blocker chip in the sticky compact strip. */
  const usingBlockerCompactFallback =
    !isHistoricalSprint
    && stuckCount > 0
    && interventionItems.length === 0;
  const compactStripInterventions = usingBlockerCompactFallback
    ? [{
      riskTags: ['blocker'],
      label: SPRINT_COPY.blockersCount(stuckCount),
      matchedKeys: [],
      setKey: '__alb31_blocker_compact_fallback__',
    }]
    : interventionItems;
  const headerRoleViews = !isHistoricalSprint
    ? distinctRoleViews.filter((item) => {
        if (interventionItems.some((riskView) => riskView.setKey === item.setKey)) return false;
        if (usingBlockerCompactFallback && item.roleMode === 'scrum-master') return false;
        return true;
      })
    : [];
  const effectiveHeaderRoleViews = !isHistoricalSprint && headerRoleViews.length === 0
    ? [
        { roleMode: 'all', label: SPRINT_COPY.allWorkDefault },
        { roleMode: 'developer', label: SPRINT_COPY.lensDev },
        { roleMode: 'scrum-master', label: SPRINT_COPY.lensSM },
        { roleMode: 'product-owner', label: SPRINT_COPY.lensPO },
        { roleMode: 'line-manager', label: SPRINT_COPY.lensLeads },
      ]
    : headerRoleViews;
  const hasPriorityInterventions = compactStripInterventions.length > 0;
  const defaultRiskTags = hasPriorityInterventions ? (compactStripInterventions[0].riskTags || []) : [];
  const compactSummaryBits = [
    `${donePercentage}% done`,
    `${issuesCount} Work items`,
    `${subtaskLoggedHrs.toFixed(1)}h / ${subtaskEstimatedHrs.toFixed(1)}h`,
  ];
  const totalSP = Number(summary.totalSP || 0);
  const supportOpsSP = Number(summary.supportOpsSP || 0);
  const capacityTitle = totalSP > 0
    ? `Capacity ${supportOpsSP.toFixed(1)} / ${totalSP.toFixed(1)} SP`
    : `${issuesCount} Work items`;
  const capacityDetail = `${subtaskLoggedHrs.toFixed(1)}h logged / ${subtaskEstimatedHrs.toFixed(1)}h est`;
  const capacityTone = verdictPresentation.color === 'red'
    ? 'critical'
    : (verdictPresentation.color === 'orange' || verdictPresentation.color === 'yellow' ? 'warning' : 'healthy');
  const evidenceDetail = evidenceLine || statusSummary || compactSummaryBits.join(' | ');
  const verdictEvidenceLine = [evidenceLine].filter(Boolean).join(' | ');
  let verdictDisplayLine = verdictEvidenceLine || verdictInfo.summary || followUpSummary || compactSummaryBits.join(' | ');
  const recentSprintsList = Array.isArray(data.recentSprints) ? data.recentSprints : [];
  const closedSprintsInRecent = recentSprintsList.filter((s) => String(s.state || '').toLowerCase() === 'closed').length;
  const sparseHistory =
    !isHistoricalSprint
    && sprintState === 'active'
    && closedSprintsInRecent > 0
    && closedSprintsInRecent < 3;
  const noPriorClosedForDelta =
    !isHistoricalSprint
    && sprintState === 'active'
    && !data.previousSprint
    && issuesCount > 0;
  const showLowConfidence =
    (sparseHistory || noPriorClosedForDelta)
    && !verdictInfo.justStarted
    && issuesCount > 0;
  let edgeStateAttr = 'none';
  if (!isHistoricalSprint && issuesCount === 0) {
    verdictDisplayLine = SPRINT_COPY.noTrackableWork;
    edgeStateAttr = 'empty';
  } else if (verdictInfo.justStarted && !isHistoricalSprint) {
    verdictDisplayLine = SPRINT_COPY.justStarted;
    edgeStateAttr = 'just-started';
  } else if (showLowConfidence) {
    verdictDisplayLine = `${verdictDisplayLine} · ${SPRINT_COPY.lowConfidence}`;
    edgeStateAttr = 'low-confidence';
  } else if (missionBriefing?.headerExplain && edgeStateAttr === 'none') {
    verdictDisplayLine = viewportLean
      ? `${remainingChipLabel} · ${donePercentage}% done`
      : missionBriefing.headerExplain;
  }
  const suppressDuplicateRiskChrome = viewportLean && missionBriefing && edgeStateAttr === 'none';
  const verdictExplainTitle =
    edgeStateAttr === 'low-confidence' ? SPRINT_COPY.lowConfidenceHint : verdictInfo.trackingReasons || '';
  const doneDelta = computeDoneDeltaVsPriorClosed(data, donePercentage);
  const identityMetricsHtml = renderHeaderIdentityMetricsRow({
    donePct: donePercentage,
    issuesCount,
    logH: subtaskLoggedHrs,
    estH: subtaskEstimatedHrs,
    delta: doneDelta,
  });

  const reportHref = boardId
    ? ('/report?boardId=' + encodeURIComponent(String(boardId)) + (sprintId ? '&sprintId=' + encodeURIComponent(String(sprintId)) : '') + (selectedProject ? '&projects=' + encodeURIComponent(String(selectedProject)) : ''))
    : '/report';
  const reportLinkHtml = '<a class="header-follow-up-link header-chrome-history-report" href="' + reportHref + '" data-header-action="open-report-context">' + escapeHtml(SPRINT_COPY.openReport) + '</a>';

  const leanAttr = viewportLean ? ' data-viewport-lean="true"' : '';
  let html = `<div class="current-sprint-header-bar"${leanAttr} data-context-bar="true" data-sprint-id="${escapeHtml(sprint.id || '')}" data-edge-state="${escapeHtml(edgeStateAttr)}" data-default-risk-tags="${escapeHtml(defaultRiskTags.join(' '))}">`;
  html += '<div class="header-band">';
  html += '<div class="header-band-main">';
  html += `<span class="header-sprint-name" title="${escapeHtml(sprintIdentityLine)}">${escapeHtml(sprintNameCompact)}</span>`;
  html += `<span class="header-sprint-dates" title="${escapeHtml(sprintDateLine)}">${escapeHtml(sprintDateLine)}</span>`;
  html += '<span class="status-badge ' + escapeHtml(statusClass) + '" title="' + escapeHtml(statusSummary) + '">' + escapeHtml(statusBadge) + '</span>';
  html += identityMetricsHtml;
  html += '<div class="sprint-verdict-line sprint-verdict-' + escapeHtml(verdictPresentation.color) + '" data-signal="health" role="status" aria-live="polite" aria-label="' + escapeHtml(SPRINT_COPY.ariaSprintHealthVerdict) + '">';
  html += '<strong>' + escapeHtml(verdictPresentation.verdict) + '</strong>';
  html += '<span class="sprint-verdict-explain" title="' + escapeHtml(verdictExplainTitle || verdictDisplayLine) + '">' + escapeHtml(verdictDisplayLine) + '</span>';
  if (!suppressDuplicateRiskChrome) {
    if (verdictRiskChips.length) {
      const primaryVerdictChip = verdictRiskChips[0];
      html += `<button type="button" class="verdict-pill" data-risk-tags="${escapeHtml(primaryVerdictChip.tags.join(' '))}" aria-label="${escapeHtml(primaryVerdictChip.aria)}">${escapeHtml(primaryVerdictChip.label)}</button>`;
    } else {
      html += `<span class="verdict-pill verdict-pill-muted">${escapeHtml(SPRINT_COPY.noRisks)}</span>`;
    }
  }
  html += '</div>';
  html += '</div>';
  if (viewportLean && missionBriefing && edgeStateAttr === 'none') {
    html += renderMissionBriefingHtml(missionBriefing, escapeHtml);
  }
  html += '<div class="header-band-actions">';
  html += renderExportButton(true);
  html += '<details class="header-view-drawer">';
  html += '<summary><span class="header-status-dot ' + escapeHtml(statusClass) + '" aria-hidden="true"></span><span>' + escapeHtml(SPRINT_COPY.drawerContext) + '</span><span data-header-active-filter-value>' + escapeHtml(SPRINT_COPY.allWorkDefault) + '</span></summary>';
  html += '<div class="header-view-drawer-panel">';
  html += '<div class="header-view-summary" title="' + escapeHtml(statusSummary) + '"><span class="header-view-summary-label">' + escapeHtml(SPRINT_COPY.drawerStatusLabel) + '</span><span class="header-view-summary-value">' + escapeHtml(statusBadge === SPRINT_COPY.statusLive ? SPRINT_COPY.statusLive : SPRINT_COPY.statusSnapshot) + '</span></div>';
  const drawerBoardLine = boardName || selectedProject || SPRINT_COPY.boardFallback;
  html += '<div class="header-context-summary-row" data-header-drawer-board-scope="true" aria-label="' + escapeHtml(SPRINT_COPY.drawerBoardScopeAria) + '">';
  html += '<span class="header-drawer-meta-item">' + escapeHtml(drawerBoardLine) + '</span>';
  html += '</div>';
  if (viewportLean && headerContextStripHtml) {
    html += '<div class="header-drawer-context-strip-wrap">' + headerContextStripHtml + '</div>';
  }
  if (!suppressDuplicateRiskChrome) {
    html += '<div class="header-drawer-risks">';
    verdictRiskChips.slice(0, 4).forEach((chip) => {
      html += `<button type="button" class="verdict-pill" data-risk-tags="${escapeHtml(chip.tags.join(' '))}" aria-label="${escapeHtml(chip.aria)}">${escapeHtml(chip.label)}</button>`;
    });
    if (!verdictRiskChips.length) html += `<span class="verdict-pill verdict-pill-muted">${escapeHtml(SPRINT_COPY.noRisks)}</span>`;
    html += '</div>';
  }
  // Hygiene meta in drawer when lean (context strip moved here) or when no inline context strip.
  if (viewportLean || !headerContextStripHtml) {
    html += '<div class="header-drawer-meta" title="' + escapeHtml(statusSummary) + '">';
    html += '<span class="header-hygiene-followup" data-signal="hygiene" title="' + escapeHtml(SPRINT_COPY.drawerHygieneTitle) + '">'
      + '<span class="header-hygiene-followup-label">' + escapeHtml(SPRINT_COPY.hygieneLabel) + '</span>'
      + '<span class="header-hygiene-followup-value">' + escapeHtml(followUpSummary) + '</span>'
      + '</span>';
    html += '<span class="header-remediation-hint" data-signal="risk-followup" title="' + escapeHtml(verdictInfo.trackingReasons || '') + '">' + escapeHtml(verdictInfo.topRemediation || '') + '</span>';
    html += '</div>';
  }
  if (isLoadingShell) {
    html += '<div class="header-drawer-section">';
    html += '<div class="header-drawer-section-label">' + escapeHtml(SPRINT_COPY.jumpTo) + '</div>';
    html += '<div class="sprint-section-links sprint-section-links-compact" aria-hidden="true"><span class="sprint-section-inline-link is-disabled">Work &amp; flow</span><span class="sprint-section-inline-link is-disabled">Flow over time</span><span class="sprint-section-inline-link is-disabled">Insights</span></div>';
    html += '</div>';
  } else if (sectionLinksInDrawer && sectionLinksHtml) {
    html += '<div class="header-drawer-section header-drawer-jump-section">';
    html += '<div class="header-drawer-section-label">' + escapeHtml(SPRINT_COPY.jumpTo) + '</div>';
    html += sectionLinksHtml;
    html += '</div>';
  }
  if (viewportLean && hasPriorityInterventions && !suppressDuplicateRiskChrome
    && (stuckCount > 0 || missingEstimates > 0 || unassignedParents > 0 || missingLoggedItems > 0)) {
    html += '<div class="header-drawer-section header-drawer-intervention-section">';
    html += '<div class="header-drawer-section-label">' + escapeHtml(SPRINT_COPY.openRemediationQueue) + '</div>';
    html += renderSprintInterventionQueueHtml(stuckCount, missingEstimates, unassignedParents, missingLoggedItems);
    html += '</div>';
  }
  html += '<div class="header-drawer-evidence">';
  html += '<div class="header-drawer-section">';
  html += '<div class="header-drawer-section-label">' + escapeHtml(SPRINT_COPY.whyThisVerdict) + '</div>';
  html += renderHealthDashboard(data, { compact: true });
  html += '</div>';
  html += '</div>';
  html += '<div class="header-drawer-links">';
  html += '<button type="button" class="header-follow-up-link" data-header-action="reset-filters">' + escapeHtml(SPRINT_COPY.resetLens) + '</button>';
  if (!isHistoricalSprint) {
    html += '<button type="button" class="header-follow-up-link" data-header-action="focus-remediation-secondary">' + escapeHtml(SPRINT_COPY.openRemediationQueue) + '</button>';
  }
  if (!isHistoricalSprint) {
    if (selectedProject && boardName) {
      html += '<a class="header-follow-up-link header-leadership-link" href="/leadership?project=' + encodeURIComponent(selectedProject) + '&board=' + encodeURIComponent(boardName) + '" data-header-action="open-leadership-trend">' + escapeHtml(SPRINT_COPY.leadershipTrend) + '</a>';
    }
  }
  html += '</div>';
  html += '</div>';
  html += '</details>';
  html += '</div>';
  html += '<div class="header-compact-strip" aria-label="' + escapeHtml(SPRINT_COPY.compactStripAria) + '">';
  html += reportLinkHtml;
  if (hasPriorityInterventions) {
    const primaryIntervention = compactStripInterventions[0] || {};
    const interventionText = compactStripInterventions
      .map((item) => {
        const mk = (item.matchedKeys || []).length;
        if (mk > 0) return `${item.label || ''} ${String(mk)}`.trim();
        return String(item.label || '').trim();
      })
      .filter(Boolean)
      .join(' | ');
    const primaryTags = Array.isArray(primaryIntervention.riskTags) ? primaryIntervention.riskTags.join(' ') : '';
    const topBlockerKey = data?.stuckCandidates?.[0]?.issueKey || '';
    const takeActionLabel = unblockActionLabel(topBlockerKey) || SPRINT_COPY.takeAction;
    const sendAllowed = isSprintCommentSendAllowed(meta, sprint);
    const takeActionTitle = sendAllowed ? SPRINT_COPY.takeAction : SPRINT_COPY.historical;
    html += '<button type="button" class="sprint-intervention-item sprint-intervention-item-primary" data-header-action="focus-remediation"'
      + (sendAllowed ? '' : ' disabled aria-disabled="true"')
      + ' title="' + escapeHtml(takeActionTitle) + '">' + escapeHtml(takeActionLabel) + '</button>';
    if (primaryTags) {
      html += '<button type="button" class="sprint-intervention-item" data-risk-tags="' + escapeHtml(primaryTags) + '">' + escapeHtml(SPRINT_COPY.focusRisk(primaryIntervention.label || SPRINT_COPY.focusRiskFallback)) + '</button>';
    }
    if (!viewportLean) {
      html += renderSprintInterventionQueueHtml(stuckCount, missingEstimates, unassignedParents, missingLoggedItems);
    }
    html += '<span class="header-export-readiness" title="' + escapeHtml(statusSummary) + '"><span>' + escapeHtml(exportReadiness) + '</span><span class="header-export-readiness-sep">|</span><span>' + escapeHtml(verdictInfo.trustLabel) + '</span>' + (viewportLean ? '' : ('<span class="header-export-readiness-sep">|</span><span>' + escapeHtml(interventionText) + '</span>')) + '</span>';
  } else {
    html += '<span class="header-export-readiness header-export-readiness--quiet" title="' + escapeHtml(statusSummary) + '"><span>' + escapeHtml(exportReadiness) + '</span><span class="header-export-readiness-sep">|</span><span>' + escapeHtml(verdictInfo.trustLabel) + '</span><span class="header-export-readiness-sep">|</span><span>' + escapeHtml(SPRINT_COPY.noUrgentIntervention) + '</span></span>';
  }
  html += '</div>';
  if (hasPriorityInterventions && !viewportLean) {
    html += '<div class="header-action-shortlist" aria-label="Top intervention shortlist">';
    compactStripInterventions.slice(0, 2).forEach((item, index) => {
      const tags = Array.isArray(item.riskTags) ? item.riskTags.join(' ') : '';
      const label = String(item.label || SPRINT_COPY.focusRiskFallback).trim();
      html += '<button type="button" class="header-action-shortlist-item"'
        + ' data-header-action="focus-remediation-shortlist"'
        + ' data-shortlist-index="' + escapeHtml(String(index)) + '"'
        + ' data-risk-tags="' + escapeHtml(tags) + '"'
        + '>'
        + escapeHtml(label)
        + '</button>';
    });
    html += '</div>';
  }
  const showIntelligenceStrip = issuesCount > 0 && !viewportLean && (edgeStateAttr !== 'none' || stuckCount > 0);
  if (showIntelligenceStrip) {
    html += '<div class="header-intelligence-strip" aria-label="Sprint evidence and capacity">';
    html += '<div class="header-intelligence-card header-intelligence-card-' + escapeHtml(capacityTone) + '" data-header-insight="capacity">';
    html += '<span class="header-intelligence-eyebrow">Now</span>';
    html += '<span class="header-intelligence-title">' + escapeHtml(capacityTitle) + '</span>';
    html += '<span class="header-intelligence-detail">' + escapeHtml(capacityDetail) + '</span>';
    html += '</div>';
    html += '<div class="header-intelligence-card header-intelligence-card-' + escapeHtml(edgeStateAttr === 'low-confidence' ? 'warning' : 'neutral') + '" data-header-insight="evidence">';
    html += '<span class="header-intelligence-eyebrow">Trust</span>';
    html += '<span class="header-intelligence-title">' + escapeHtml(verdictInfo.trustLabel || exportReadiness) + '</span>';
    html += '<span class="header-intelligence-detail">' + escapeHtml(evidenceDetail) + '</span>';
    html += '</div>';
    html += '</div>';
  }
  if (sectionLinksHtml && !isLoadingShell && !sectionLinksInDrawer) {
    html += sectionLinksHtml;
  }
  if (!viewportLean) {
    html += headerContextStripHtml;
  }
  const roleModesRowHtml = renderHeaderRoleModesRow(effectiveHeaderRoleViews);
  if (roleModesRowHtml) {
    if (viewportLean) {
      html += '<details class="header-role-modes-details"><summary>' + escapeHtml(SPRINT_COPY.viewAsLabel) + '</summary>' + roleModesRowHtml + '</details>';
    } else {
      html += roleModesRowHtml;
    }
  }
  /* ALB-30: Mini mode hides the full compact strip; surface History report first so it stays above squad identity. */
  html += '<div class="header-mini-strip" aria-hidden="true">';
  html += '<div class="header-mini-strip-report-priority">' + reportLinkHtml + '</div>';
  html += '<div class="header-mini-strip-identity">';
  html += `<span class="header-mini-strip-name">${escapeHtml(sprintNameCompact)}</span>`;
  html += `<span class="header-mini-strip-verdict header-mini-strip-verdict-${escapeHtml(verdictPresentation.color)}">${escapeHtml(verdictPresentation.verdict)}</span>`;
  html += `<span class="header-mini-strip-days">${escapeHtml(remainingChipLabel)} | ${escapeHtml(donePercentage)}% done</span>`;
  html += '</div>';
  html += '</div>';
  html += '</div>';
  html += '</div>';
  return html;
}

export function wireHeaderBarHandlers() {
  const headerBar = document.querySelector('#current-sprint-content .current-sprint-header-bar')
    || document.querySelector('.current-sprint-header-bar');
  if (!headerBar) return;
  // Remove duplicate header bars if multiple instances rendered (dedupe visual chrome)
  try {
    const headerBarsAll = Array.from(document.querySelectorAll('#current-sprint-content .current-sprint-header-bar, .current-sprint-header-bar'));
    if (headerBarsAll.length > 1) {
      headerBarsAll.slice(1).forEach((hb) => { try { hb.remove(); } catch (_) {} });
    }
  } catch (_) {}
  if (headerBar.dataset.headerBarHandlersWired === '1') return;
  headerBar.dataset.headerBarHandlersWired = '1';

  headerBar.querySelectorAll('details.header-view-drawer summary').forEach((summaryEl) => {
    if (summaryEl.dataset.drawerSummaryBound === '1') return;
    summaryEl.dataset.drawerSummaryBound = '1';
    summaryEl.addEventListener('click', () => {
      const details = summaryEl.closest('details');
      if (details && !details.open) {
        window.requestAnimationFrame(() => { details.open = true; });
      }
    });
  });

  const isFirstWire = headerBarWireSessionCount === 0;
  headerBarWireSessionCount += 1;

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
        const scrollTarget = document.getElementById('stuck-card') || document.getElementById('stories-card');
        if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(scrollTarget);
        else scrollTarget?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
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
      const scrollTarget = document.getElementById('stuck-card') || document.getElementById('stories-card');
      if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(scrollTarget);
      else scrollTarget?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
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
      if (focusRemediation.disabled) {
        showSprintActionToast(SPRINT_COPY.historical, 'error');
        return true;
      }
      try {
        const row = document.querySelector('#work-risks-table tbody .work-risk-parent-row, #stories-table tbody tr[data-issue-key], #stuck-card tbody tr[data-issue-key]');
        if (row) {
          const link = row.querySelector('a[href*="/browse/"]');
          const key = link ? (link.textContent || '').trim() : (row.getAttribute('data-issue-key') || '');
          const url = link ? link.href : '';
          const summaryCell = row.querySelector('.story-summary-cell, td.subtask-child-summary, td[data-label="Summary"]');
          const statusCell = row.querySelector('.story-status-cell, td[data-label="Status"]');
          const summary = summaryCell ? (summaryCell.textContent || '').trim() : '';
          const status = statusCell ? (statusCell.textContent || '').trim() : '';
          if (key) {
            const payload = getCurrentSprintPayload();
            const riskTags = String(row.getAttribute('data-risk-tags') || '').split(/\s+/).filter(Boolean);
            const staleHours = Number(row.getAttribute('data-hours-in-status') || 0) || null;
            openJiraNudgeReviewSheet({
              issueKey: key,
              issueSummary: summary,
              issueStatus: status,
              issueUrl: url,
              useCase: deriveUseCaseFromRiskTags(riskTags),
              staleHours,
              readOnly: !isSprintCommentSendAllowed(payload?.meta, payload?.sprint),
              meta: payload?.meta,
              sprint: payload?.sprint,
            });
            row.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
            return true;
          }
        }
      } catch (err) {
        showSprintActionToast(err?.message || 'Could not post comment.', 'error');
      }
      applyHeaderRiskAction(['no-log', 'missing-estimate', 'unassigned', 'blocker'], 'header-take-action');
      return true;
    }
    const shortlistRemediation = el.closest?.('[data-header-action="focus-remediation-shortlist"]');
    if (shortlistRemediation) {
      const tags = String(shortlistRemediation.getAttribute('data-risk-tags') || '')
        .split(/\s+/)
        .filter(Boolean);
      applyHeaderRiskAction(tags, 'header-shortlist');
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
      const scrollTarget = document.getElementById('stuck-card') || document.getElementById('stories-card');
      if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(scrollTarget);
      else scrollTarget?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
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
      const showMore = el.closest('[data-action="show-more-roles"]');
      if (showMore && bar.contains(showMore)) {
        event.preventDefault();
        try {
          const parent = showMore.closest('.header-role-modes');
          if (parent) {
            const list = parent.querySelector('.role-mode-more-list');
            const expanded = showMore.getAttribute('aria-expanded') === 'true';
            showMore.setAttribute('aria-expanded', expanded ? 'false' : 'true');
            if (list) list.style.display = expanded ? 'none' : 'block';
          }
        } catch (_) {}
        return;
      }
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

      const remediationSecondary = el.closest('[data-header-action="focus-remediation-secondary"]');
      if (remediationSecondary && bar.contains(remediationSecondary)) {
        event.preventDefault();
        applyHeaderRiskAction(['blocker', 'no-log', 'missing-estimate', 'unassigned'], 'header-remediation-queue');
        const scrollTarget = document.getElementById('stuck-card') || document.getElementById('stories-card');
        if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(scrollTarget);
        else scrollTarget?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
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

  /** Mini collapse: tablets/desktop only. Use one shared listener + hysteresis to avoid threshold flicker. */
  function applyMiniMode(headerEl) {
    if (!headerEl || !headerEl.isConnected) return;
    const miniStrip = headerEl.querySelector('.header-mini-strip');
    if (window.innerWidth <= 720) {
      headerEl.classList.remove('header-mini-mode');
      headerMiniModeState.lastMode = false;
      if (miniStrip) miniStrip.setAttribute('aria-hidden', 'true');
      return;
    }
    const baseThreshold = Math.max(120, (headerEl.offsetTop || 0) + 72);
    const enterThreshold = baseThreshold + 18;
    const exitThreshold = baseThreshold - 18;
    const scrollY = window.scrollY || 0;
    const currentMode = headerMiniModeState.lastMode === true;
    const nextMode = currentMode ? (scrollY > exitThreshold) : (scrollY > enterThreshold);
    if (nextMode !== currentMode) {
      headerEl.classList.toggle('header-mini-mode', nextMode);
      headerMiniModeState.lastMode = nextMode;
      if (miniStrip) miniStrip.setAttribute('aria-hidden', nextMode ? 'false' : 'true');
    }
  }

  function scheduleMiniModeSync() {
    if (headerMiniModeState.rafPending) return;
    headerMiniModeState.rafPending = true;
    window.requestAnimationFrame(() => {
      headerMiniModeState.rafPending = false;
      applyMiniMode(headerMiniModeState.activeHeader);
    });
  }

  headerMiniModeState.activeHeader = headerBar;
  headerMiniModeState.lastMode = null;
  applyMiniMode(headerBar);
  if (!headerMiniModeState.listenersBound) {
    headerMiniModeState.listenersBound = true;
    window.addEventListener('scroll', scheduleMiniModeSync, { passive: true });
    window.addEventListener('resize', scheduleMiniModeSync, { passive: true });
  }

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
    const applyPresetFromRole = options.applyPreset !== false;
    let active = mode || 'all';
    if (!availableRoleModes.has(active)) {
      active = 'all';
    }
    roleButtons.forEach((button) => {
      button.classList.toggle('is-active', button.getAttribute('data-work-risk-role-mode') === active);
      button.setAttribute('aria-pressed', button.classList.contains('is-active') ? 'true' : 'false');
    });
    headerFilterUiState.roleMode = active;
    if (silent && !applyPresetFromRole) {
      renderHeaderActiveFilterLabel();
      return;
    }
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
  if (isFirstWire) {
    applyRoleMode(initialMode, { silent: true, applyPreset: true });
  } else {
    applyRoleMode(headerFilterUiState.roleMode || initialMode, { silent: true, applyPreset: false });
  }

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
