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
import { renderCountdownTimer } from './Reporting-App-CurrentSprint-Countdown-Timer.js';
import { buildActiveFiltersContextLabel } from './Reporting-App-Shared-Context-From-Storage.js';
import { getUnifiedBlockerCount } from './Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';

export function renderHeaderBar(data) {
  const sprint = data.sprint || {};
  const summary = data.summary || {};
  const days = data.daysMeta || {};
  const planned = data.plannedWindow || {};
  const meta = data.meta || {};
  const trackingRows = Array.isArray(data?.subtaskTracking?.rows) ? data.subtaskTracking.rows : [];
  const stuckCount = getUnifiedBlockerCount(data);
  const excludedParents = Number(summary.stuckExcludedParentsWithActiveSubtasks || 0);
  const missingEstimates = trackingRows.filter((r) => !r.estimateHours || r.estimateHours === 0).length;
  const missingLoggedItems = trackingRows.filter((r) => !r.loggedHours || r.loggedHours === 0).length;

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
  const remainingText = remainingLabel === '-' ? remainingLabel : (remainingLabel === 'Sprint ended' || remainingLabel === '<1 day' ? remainingLabel : remainingLabel + ' left');
  const outcomeParts = [
    donePercentage + '% done',
    remainingText,
    issuesCount + ' issues'
  ];
  const outcomeLine = outcomeParts.join(' · ');
  const verdictInfo = deriveSprintVerdict(data);
  const compactRiskParts = [];
  if (stuckCount > 0) compactRiskParts.push(stuckCount + ' blockers');
  if (excludedParents > 0) compactRiskParts.push(excludedParents + ' parent stor' + (excludedParents === 1 ? 'y' : 'ies') + ' flowing via subtasks');
  if (missingEstimates > 0) compactRiskParts.push(missingEstimates + ' missing est');
  if (missingLoggedItems > 0) compactRiskParts.push(missingLoggedItems + ' no log');
  const compactRiskLine = compactRiskParts.length ? compactRiskParts.join(' · ') : 'No active delivery risks';
  const blockerDrillDown = stuckCount > 0
    ? '<a href="#work-risks-table" class="sprint-verdict-drilldown">' + stuckCount + ' blockers - open list</a>'
    : '<span class="sprint-verdict-drilldown sprint-verdict-drilldown-ok">No blockers</span>';

  let html = '<div class="current-sprint-header-bar" data-sprint-id="' + (sprint.id || '') + '">';
  html += '<div class="sprint-outcome-line" aria-live="polite">' + escapeHtml(outcomeLine) + '</div>';
  html += '<div class="sprint-verdict-line sprint-verdict-' + escapeHtml(verdictInfo.color) + '" aria-live="polite">';
  html += '<strong>' + escapeHtml(verdictInfo.verdict) + '</strong> · ' + escapeHtml(compactRiskLine);
  html += ' · ' + blockerDrillDown;
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
  html += '<div class="header-bar-left">';
  html += '<div class="header-context-row">';
  html += '<span class="header-context-chip header-context-chip-active" title="Active filters driving this sprint view">Active: ' + escapeHtml(selectedProject || 'n/a') + (boardName ? ' · ' + escapeHtml(boardName) : '') + '</span>';
  if (hasContextWindow || contextProjects) {
    html += '<span class="header-context-chip header-context-chip-cache" title="Cached report context for reference only">From report cache: '
      + escapeHtml(reportContextLine)
      + '</span>';
  }
  html += '</div>';
  if (boardName) html += '<div class="header-board-label" aria-label="Current board">Board: ' + escapeHtml(boardName) + '</div>';
  html += '<div class="header-sprint-name">' + escapeHtml(sprint.name || 'Sprint ' + sprint.id) + '</div>';
  html += '<div class="header-sprint-dates">';
  html += formatDate(planned.start || sprint.startDate) + ' - ' + formatDate(planned.end || sprint.endDate);
  html += '</div>';
  html += '</div>';

  html += '<div class="header-bar-center">';
  html += '<div class="header-metric">';
  html += '<span class="metric-label">Remaining</span>';
  html += '<span class="metric-value ' + remainingClass + '">' + remainingLabel + '</span>';
  html += '</div>';
  html += '<a href="#work-risks-table" class="header-metric header-metric-link" title="Jump to blocker list">';
  html += '<span class="metric-label">Blockers</span>';
  html += '<span class="metric-value">' + stuckCount + '</span>';
  html += '</a>';
  html += '<div class="header-metric">';
  html += '<span class="metric-label">Progress</span>';
  html += '<span class="metric-value">' + donePercentage + '%</span>';
  html += '</div>';
  html += '<a href="#stories-card" class="header-metric-link" title="Jump to issues in this sprint">';
  html += '<span class="metric-label">Work items</span>';
  html += '<span class="metric-value">' + issuesCount + '</span>';
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
  html += '<div class="header-bar-right">';
  html += renderCountdownTimer(data, { compact: true });
  html += '<div class="status-badge ' + statusClass + '" role="status" aria-label="Data status: ' + escapeHtml(statusBadge) + '">' + escapeHtml(statusBadge) + '</div>';
  html += '<small class="header-export-readiness">' + escapeHtml(exportReadiness) + '</small>';
  html += '<div class="header-updated">' + (freshnessLabel ? '<small class="last-updated">' + escapeHtml(freshnessLabel) + '</small>' : '') + '</div>';
  html += '<button class="btn btn-compact header-refresh-btn" title="Refresh sprint data">Refresh</button>';
  html += renderExportButton(true);
  html += '</div>';

  html += '</div>';
  return html;
}

export function wireHeaderBarHandlers() {
  const headerBar = document.querySelector('.current-sprint-header-bar');
  if (!headerBar) return;

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

  const remainingMetric = headerBar.querySelector('.header-metric:first-of-type .metric-value');
  if (remainingMetric) {
    remainingMetric.title = 'Days remaining in sprint (working days)';
  }

  const refreshBtn = headerBar.querySelector('.header-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      document.dispatchEvent(new Event('refreshSprint'));
    });
  }
}


