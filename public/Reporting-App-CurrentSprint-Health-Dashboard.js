import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatNumber } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { deriveSprintVerdict } from './Reporting-App-CurrentSprint-Alert-Banner.js';

function buildEvidenceLine({
  verdict,
  stuckCount,
  missingEstimates,
  missingLoggedItems,
  unassignedParents,
  supportOpsSP,
  totalSP,
  remainingDays,
}) {
  const parts = [];
  if (stuckCount > 0) parts.push(`${stuckCount} blocker${stuckCount === 1 ? '' : 's'}`);
  if (missingEstimates > 0) parts.push(`${missingEstimates} missing est`);
  if (missingLoggedItems > 0) parts.push(`${missingLoggedItems} no log`);
  if (unassignedParents > 0) parts.push(`${unassignedParents} unowned`);
  if (supportOpsSP > 0 && totalSP > 0) parts.push(`${Math.round((supportOpsSP / totalSP) * 100)}% support`);
  if (!parts.length) {
    if (verdict.verdict === 'Healthy') {
      return remainingDays > 0
        ? `No material risks. Next check-in in ${Math.floor(remainingDays)}d.`
        : 'No material risks in this snapshot.';
    }
    return verdict.summary || verdict.tagline || 'Evidence is still forming.';
  }
  return parts.join(' | ');
}

export function renderHealthDashboard(data, options = {}) {
  const compact = options?.compact === true;
  const summary = data.summary || {};
  const tracking = data.subtaskTracking || {};
  const trackingSummary = tracking.summary || {};
  const trackingRows = Array.isArray(tracking.rows) ? tracking.rows : [];

  const totalSP = Number(summary.totalSP || 0);
  const doneSP = Number(summary.doneSP || 0);
  const percentDone = Number(summary.percentDone || 0);
  const newFeaturesSP = Number(summary.newFeaturesSP || 0);
  const supportOpsSP = Number(summary.supportOpsSP || 0);
  const daysMeta = data.daysMeta || {};
  const remainingDays = daysMeta.daysRemainingWorking != null ? daysMeta.daysRemainingWorking : daysMeta.daysRemainingCalendar;
  const totalEstimate = formatNumber(trackingSummary.totalEstimateHours || 0, 1, '0');
  const totalLogged = formatNumber(trackingSummary.totalLoggedHours || 0, 1, '0');
  const totalRemaining = formatNumber(trackingSummary.totalRemainingHours || 0, 1, '0');
  const missingEstimates = trackingRows.filter((row) => !(Number(row?.estimateHours || 0) > 0)).length;
  const missingLoggedItems = trackingRows.filter((row) => !(Number(row?.loggedHours || 0) > 0)).length;
  const verdict = deriveSprintVerdict(data);
  const stuckCount = Number((data.stuckCandidates || []).length || 0);
  const unassignedParents = Number(verdict.unassignedParents || 0);
  const riskColor = verdict.color || 'green';
  const donePercent = totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : 0;
  const inProgressPercent = totalSP > 0 ? Math.max(0, 100 - donePercent) : 0;
  const featurePercent = totalSP > 0 ? Math.round((newFeaturesSP / totalSP) * 100) : 0;
  const supportPercent = totalSP > 0 ? Math.round((supportOpsSP / totalSP) * 100) : 0;
  const evidenceLine = buildEvidenceLine({
    verdict,
    stuckCount,
    missingEstimates,
    missingLoggedItems,
    unassignedParents,
    supportOpsSP,
    totalSP,
    remainingDays,
  });

  const breakdownReasons = [];
  if (stuckCount > 0) breakdownReasons.push(`${stuckCount} issue${stuckCount === 1 ? '' : 's'} stuck >24h.`);
  if (missingEstimates > 0) breakdownReasons.push(`${missingEstimates} sub-task${missingEstimates === 1 ? '' : 's'} missing estimates.`);
  if (missingLoggedItems > 0) breakdownReasons.push(`${missingLoggedItems} sub-task${missingLoggedItems === 1 ? '' : 's'} with no time logged.`);
  if (unassignedParents > 0) breakdownReasons.push(`${unassignedParents} unowned outcome item${unassignedParents === 1 ? '' : 's'}.`);
  if (supportOpsSP > 0 && totalSP > 0) breakdownReasons.push(`${supportPercent}% of story points are support / ops.`);
  const breakdownText = breakdownReasons.length ? breakdownReasons.join(' ') : 'No material risk signals.';

  let html = '<div class="' + (compact ? 'sprint-hud-health-details health-dashboard-card-compact' : 'transparency-card health-dashboard-card') + '"' + (compact ? '' : ' id="health-dashboard-card"') + '>';
  if (!compact) html += '<h2>Sprint health</h2>';

  html += '<div class="health-hud-strip">';
  html += '<div class="health-status-row">';
  html += '<div class="health-status-chip ' + escapeHtml(riskColor) + '" title="' + escapeHtml(breakdownText) + '" id="health-status-chip">' + escapeHtml(verdict.verdict || 'Health unknown') + '</div>';
  html += '<span class="health-inline-metric">' + escapeHtml(String(percentDone)) + '% done</span>';
  if (remainingDays != null) {
    html += '<span class="health-inline-metric">' + escapeHtml(remainingDays <= 0 ? 'Ended' : `${Math.floor(remainingDays)}d left`) + '</span>';
  }
  html += '<span class="health-inline-metric">' + escapeHtml(formatNumber(doneSP, 1, '0')) + '/' + escapeHtml(formatNumber(totalSP, 1, '0')) + ' SP</span>';
  html += '</div>';
  html += '<div class="health-evidence-line" title="' + escapeHtml(breakdownText) + '">' + escapeHtml(evidenceLine) + '</div>';
  html += '<div class="health-inline-pills">';
  html += '<span class="health-inline-pill">Features ' + escapeHtml(String(featurePercent)) + '% SP</span>';
  html += '<span class="health-inline-pill">Support ' + escapeHtml(String(supportPercent)) + '% SP</span>';
  html += '</div>';
  html += '<div class="health-actions">';
  html += '<button type="button" class="btn btn-secondary btn-compact health-breakdown-toggle" aria-expanded="false" aria-controls="health-breakdown-detail" data-action="toggle-health-breakdown">More</button>';
  html += '<a class="btn btn-secondary btn-compact health-detail-link" href="#stories-card">View risk details</a>';
  html += '</div>';
  html += '</div>';

  html += '<div id="health-breakdown-detail" class="health-breakdown-detail" hidden>';
  html += '<div class="health-progress-section">';
  html += '<div class="progress-bar-container">';
  if (donePercent > 0) {
    html += '<div class="progress-bar done" style="width: ' + donePercent + '%;" title="' + escapeHtml(formatNumber(doneSP, 1, '0')) + ' SP done">'
      + (donePercent > 10 ? '<span class="progress-text">' + escapeHtml(formatNumber(doneSP, 1, '0')) + ' SP (' + donePercent + '%)</span>' : '')
      + '</div>';
  }
  if (inProgressPercent > 0) {
    html += '<div class="progress-bar inprogress" style="width: ' + inProgressPercent + '%;" title="' + escapeHtml(formatNumber(totalSP - doneSP, 1, '0')) + ' SP in progress">'
      + (inProgressPercent > 10 ? '<span class="progress-text">' + escapeHtml(formatNumber(totalSP - doneSP, 1, '0')) + ' SP in flow</span>' : '')
      + '</div>';
  }
  html += '</div>';
  html += '</div>';

  html += '<div class="health-tracking-section">';
  html += '<div class="tracking-items">';
  html += '<div class="tracking-item"><span>Est</span><strong>' + totalEstimate + 'h</strong></div>';
  html += '<div class="tracking-item"><span>Logged</span><strong>' + totalLogged + 'h</strong></div>';
  html += '<div class="tracking-item"><span>Remain</span><strong>' + totalRemaining + 'h</strong></div>';
  html += '</div>';
  html += '<p class="health-breakdown-reasons">' + escapeHtml(breakdownText) + '</p>';
  html += '<p class="health-breakdown-formula"><small>Rule & signals: see tooltip. Use the work list for exact items.</small></p>';
  html += '</div>';
  html += '</div>';

  html += '</div>';
  return html;
}

export function wireHealthDashboardHandlers() {
  const dashboard = document.querySelector('.health-dashboard-card, .sprint-hud-health-details');
  if (!dashboard || dashboard.dataset.wiredHealthDashboard === '1') return;
  dashboard.dataset.wiredHealthDashboard = '1';

  const breakdownBtn = dashboard.querySelector('.health-breakdown-toggle');
  const breakdown = dashboard.querySelector('#health-breakdown-detail');
  if (breakdownBtn && breakdown) {
    breakdownBtn.addEventListener('click', () => {
      const expanded = breakdownBtn.getAttribute('aria-expanded') === 'true';
      breakdownBtn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      breakdown.hidden = expanded;
    });
  }
}
