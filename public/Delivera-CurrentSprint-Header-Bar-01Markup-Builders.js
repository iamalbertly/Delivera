import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { formatDate } from './Delivera-Shared-Format-DateNumber-Helpers.js';
import { renderExportButton } from './Delivera-CurrentSprint-Export-Dashboard.js';
import { deriveSprintVerdict } from './Delivera-CurrentSprint-Alert-Banner.js';
import { readNotificationSummary } from './Delivera-Shared-Notifications-Dock-Manager.js';
import { buildDistinctSprintFilterViews, getUnifiedRiskCounts } from './Delivera-CurrentSprint-Data-WorkRisk-Rows.js';
import { renderHealthDashboard, buildEvidenceLine } from './Delivera-CurrentSprint-Health-Dashboard.js';
import { getContextPieces, renderContextSegments } from './Delivera-Shared-Context-From-Storage.js';
import { formatProjectsCsvForDisplay } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';
import { isSprintCommentSendAllowed } from './Delivera-CurrentSprint-Action-Bridge.js';
import {
  buildSprintAtAGlanceBriefing,
  renderMissionBriefingHtml,
  resolvePrimaryBlockerKey,
} from './Delivera-CurrentSprint-Summary-03AtAGlance-Briefing-SSOT.js';
import {
  formatRiskCountsRollup,
  nudgeActionLabel,
} from './Delivera-CurrentSprint-Risk-Vocabulary-01Terms-SSOT.js';
import {
  SPRINT_COPY,
  formatSprintRemainingLabel,
  formatFreshnessAgeLabel,
} from './Delivera-CurrentSprint-Copy.js';

function getHeaderStatusSummary({ statusBadge, freshnessLabel, exportReadiness, isHistoricalSprint = false, closedDateLabel = '' }) {
  if (isHistoricalSprint) {
    const closed = closedDateLabel ? ` · closed ${closedDateLabel}` : '';
    return `Snapshot${closed} · ${exportReadiness}`;
  }
  const freshnessText = freshnessLabel || SPRINT_COPY.liveDataShort;
  return `Live · ${freshnessText} · ${exportReadiness}`;
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
  const showHours = (Number(logH) > 0 || Number(estH) > 0);
  let row = '<div class="header-identity-metrics" role="group" aria-label="' + escapeHtml(SPRINT_COPY.ariaSprintMetrics) + '" data-header-metric-row="1">'
    + '<div class="header-metric header-metric-tile" data-metric="done">'
    + '<span class="metric-label">' + escapeHtml(SPRINT_COPY.metricDone) + '</span>'
    + '<span class="metric-value">' + doneInner + '</span>'
    + '</div>'
    + '<div class="header-metric header-metric-tile" data-metric="issues">'
    + '<span class="metric-label">' + escapeHtml(SPRINT_COPY.metricWorkItems) + '</span>'
    + '<span class="metric-value">' + escapeHtml(String(issuesCount)) + '</span>'
    + '</div>';
  if (showHours) {
    row += '<div class="header-metric header-metric-tile" data-metric="hours">'
      + '<span class="metric-label">' + escapeHtml(SPRINT_COPY.metricLoggedEst) + '</span>'
      + '<span class="metric-value">' + escapeHtml(logH.toFixed(1)) + 'h / ' + escapeHtml(estH.toFixed(1)) + 'h</span>'
      + '</div>';
  }
  row += '</div>';
  return row;
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

  const scopeLabel = [
    (selectedProjects ? formatProjectsCsvForDisplay(selectedProjects) || selectedProjects : SPRINT_COPY.allProjects),
    board.name || SPRINT_COPY.boardFallback,
    sprint.name || SPRINT_COPY.sprintFallback,
  ].filter(Boolean).join(' | ');
  return '<div class="header-context-strip">'
    + '<span class="header-context-segment">'
    + '<span class="header-context-segment-label">' + escapeHtml(SPRINT_COPY.segmentLabelContext) + '</span>'
    + '<span class="header-context-segment-value">' + escapeHtml(scopeLabel) + '</span>'
    + '</span>'
    + '</div>';
}

export function buildHeaderBarMarkup(data, options = {}) {
  const {
    sectionLinksHtml = '',
    isLoadingShell = false,
    viewportLean = true,
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
  const topStuckHours = Number(data?.stuckCandidates?.[0]?.hoursInStatus || 0);
  const statusBadge = topStuckHours > 72
    ? 'Stale work'
    : ((meta.fromSnapshot || sprintState !== 'active') ? SPRINT_COPY.statusSnapshot : SPRINT_COPY.statusLive);
  const statusClass = statusBadge === SPRINT_COPY.statusLive ? 'status-live' : (topStuckHours > 72 ? 'status-stale' : 'status-snapshot');
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
  const commitment = meta.commitmentRisk || verdictInfo.commitmentRisk || {};
  const offPiCount = Number(commitment.offPi || 0);
  if (offPiCount > 0) {
    verdictRiskChips.push({
      tags: ['off-pi'],
      label: `${offPiCount} off-PI`,
      aria: 'Open alignment studio for off-PI work',
    });
  }
  const hasCommitmentRisk = commitment.hasCommitmentRisk || offPiCount > 0;
  const showNoRisksPill = verdictRiskChips.length === 0 && !hasCommitmentRisk && !meta.limbo;
  const boardId = data.board?.id || '';
  const sprintId = sprint.id || '';
  const selectedProject = Array.isArray(data.board?.projectKeys) && data.board.projectKeys.length > 0
    ? data.board.projectKeys[0]
    : (meta.projects || '');
  const sprintDatesLabel = (formatDate(planned.start || sprint.startDate) + ' - ' + formatDate(planned.end || sprint.endDate))
    .replace(/^-\s-\s-$/, SPRINT_COPY.noActiveSprintWindow);
  const squadLabel = formatProjectsCsvForDisplay(selectedProject) || selectedProject || '';
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
  const statusSummary = getHeaderStatusSummary({
    statusBadge,
    freshnessLabel,
    exportReadiness,
    isHistoricalSprint,
    closedDateLabel: isHistoricalSprint ? sprintDatesLabel.split(' - ')[1]?.trim() || '' : '',
  });
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
  const suppressMissionDupChrome = viewportLean && missionBriefing && edgeStateAttr === 'none';
  const smartQueueActive = viewportLean && stuckCount > 0;
  const suppressDuplicateRiskChrome = suppressMissionDupChrome || smartQueueActive;
  const verdictExplainTitle =
    edgeStateAttr === 'low-confidence' ? SPRINT_COPY.lowConfidenceHint : verdictInfo.trackingReasons || '';
  const doneDelta = computeDoneDeltaVsPriorClosed(data, donePercentage);
  const heroLineHtml = viewportLean
    ? ('<p class="header-hero-line" data-testid="sprint-hero-line">'
      + escapeHtml(verdictPresentation.verdict) + ' · ' + escapeHtml(String(donePercentage)) + '% done · '
      + escapeHtml(String(issuesCount)) + ' items · ' + escapeHtml(remainingChipLabel)
      + (meta.cadenceLine && meta.limbo ? (' · ' + escapeHtml(meta.cadenceLine)) : '')
      + '</p>')
    : '';

  const boardName = data.board?.name || '';
  const identityMetricsHtml = viewportLean
    ? heroLineHtml
    : renderHeaderIdentityMetricsRow({
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
  html += '<div class="header-scope-mount" id="current-sprint-scope-mount" aria-label="Sprint scope"></div>';
  html += '<div class="header-band">';
  html += '<div class="header-band-main">';
  if (squadLabel) {
    html += `<span class="header-squad-label" data-testid="sprint-squad-label">${escapeHtml(squadLabel)}</span>`;
  }
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
    } else if (showNoRisksPill) {
      html += `<span class="verdict-pill verdict-pill-muted">${escapeHtml(SPRINT_COPY.noRisks)}</span>`;
    }
  }
  html += '</div>';
  html += '</div>';
  html += '<span class="header-active-filter-chip" data-header-active-filter-chip data-testid="sprint-active-filter-chip" hidden aria-live="polite"></span>';
  html += '</div>';
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
    if (!verdictRiskChips.length && showNoRisksPill) html += `<span class="verdict-pill verdict-pill-muted">${escapeHtml(SPRINT_COPY.noRisks)}</span>`;
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
  if (viewportLean && hasPriorityInterventions && !suppressMissionDupChrome
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
    const topBlockerKey = resolvePrimaryBlockerKey(data);
    const stuckRow = (data.stuckCandidates || []).find((c) => String(c.issueKey || '').toUpperCase() === String(topBlockerKey || '').toUpperCase());
    const suppressHeaderNudge = stuckCount > 0 && Boolean(topBlockerKey);
    const takeActionLabel = nudgeActionLabel(topBlockerKey, stuckRow?.assignee) || SPRINT_COPY.takeAction;
    html += `<span class="sprint-intervention-blocker-key" data-primary-blocker-key="${escapeHtml(topBlockerKey)}" hidden aria-hidden="true"></span>`;
    const sendAllowed = isSprintCommentSendAllowed(meta, sprint);
    const takeActionTitle = sendAllowed ? SPRINT_COPY.takeAction : SPRINT_COPY.historical;
    if (!suppressHeaderNudge) {
      html += '<button type="button" class="sprint-intervention-item sprint-intervention-item-primary" data-header-action="focus-remediation"'
        + (sendAllowed ? '' : ' disabled aria-disabled="true"')
        + ' title="' + escapeHtml(takeActionTitle) + '">' + escapeHtml(takeActionLabel) + '</button>';
    } else {
      html += `<a class="sprint-intervention-item sprint-intervention-item-link" href="#stuck-card">${stuckCount} blocker${stuckCount === 1 ? '' : 's'} below</a>`;
    }
    if (primaryTags && !suppressDuplicateRiskChrome) {
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
  const showIntelligenceStrip = issuesCount > 0 && !viewportLean && stuckCount === 0 && (edgeStateAttr !== 'none');
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
  const missionHtml = (viewportLean && missionBriefing && edgeStateAttr === 'none')
    ? renderMissionBriefingHtml(missionBriefing, escapeHtml)
    : '';
  if (viewportLean && (missionHtml || roleModesRowHtml)) {
    html += '<details class="header-mobile-filters-fold"><summary>Briefing &amp; filters</summary><div class="header-mobile-filters-body">';
    if (missionHtml) html += '<div class="header-mission-briefing-wrap">' + missionHtml + '</div>';
    if (roleModesRowHtml) {
      html += '<div class="header-role-modes-row-wrap" aria-label="' + escapeHtml(SPRINT_COPY.ariaViewAsRole) + '">' + roleModesRowHtml + '</div>';
    }
    html += '</div></details>';
  } else if (roleModesRowHtml) {
    html += roleModesRowHtml;
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