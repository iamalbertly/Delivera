/**
 * Unified Health Dashboard Component
 * Consolidates: summary card (stories/SP), new features vs support split, burndown status, sub-task tracking
 * Single card with risk indicators, visual progress bar, expandable details
 * Rationale: Customer - Single screenshot shows sprint health. Simplicity - 4 cards → 1. Trust - Risk indicators visible immediately.
 */

import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatNumber } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { deriveSprintVerdict } from './Reporting-App-CurrentSprint-Alert-Banner.js';

export function renderHealthDashboard(data) {
  const summary = data.summary || {};
  const tracking = data.subtaskTracking || {};
  const trackingSummary = tracking.summary || {};

  // Core metrics
  const totalStories = summary.totalStories ?? 0;
  const doneStories = summary.doneStories ?? 0;
  const totalSP = summary.totalSP ?? 0;
  const doneSP = summary.doneSP ?? 0;
  const percentDone = summary.percentDone ?? 0;
  const newFeaturesSP = summary.newFeaturesSP || 0;
  const supportOpsSP = summary.supportOpsSP || 0;
  const daysMeta = data.daysMeta || {};
  const remainingDays = daysMeta.daysRemainingWorking != null ? daysMeta.daysRemainingWorking : daysMeta.daysRemainingCalendar;

  // Sub-task tracking
  const totalEstimate = formatNumber(trackingSummary.totalEstimateHours || 0, 1, '0');
  const totalLogged = formatNumber(trackingSummary.totalLoggedHours || 0, 1, '0');
  const totalRemaining = formatNumber(trackingSummary.totalRemainingHours || 0, 1, '0');

  // Risk indicators
  const missingEstimates = (tracking.rows || []).filter(r => !r.estimateHours || r.estimateHours === 0).length;
  const missingLoggedItems = (tracking.rows || []).filter(r => !r.loggedHours || r.loggedHours === 0).length;
  const stuckCount = (data.stuckCandidates || []).length;
  // Shared risk verdict logic (SSOT with verdict bar + alert banner).
  const verdict = deriveSprintVerdict(data);
  const riskColor = verdict.color || 'green';
  const riskMessage = verdict.verdict === 'Healthy'
    ? 'All systems healthy'
    : (verdict.verdict + ' delivery risk');

  // Story point distribution percentage
  const donePercent = totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : 0;
  const inProgressPercent = totalSP > 0 ? Math.round(((totalSP - doneSP) / totalSP) * 100) : 0;

  let html = '<div class="transparency-card health-dashboard-card" id="health-dashboard-card">';
  html += '<h2>Sprint health: Why?</h2>';
  html += '<div class="health-snapshot-row">';
  html += '<strong>Header is the sprint summary.</strong> This card explains the verdict and evidence only.';
  html += '</div>';

  const breakdownReasons = [];
  if (stuckCount > 0) {
    const stuckKeys = (data.stuckCandidates || []).slice(0, 5).map(s => s.issueKey || s.key).filter(Boolean);
    breakdownReasons.push('(' + stuckCount + ') issues stuck >24h. Fix: Unblock ' + (stuckKeys.length ? stuckKeys.join(', ') : '—') + '.');
  }
  const scopeCount = (data.scopeChanges || []).length;
  if (scopeCount > 0) breakdownReasons.push('Scope grew: ' + scopeCount + ' item(s) added mid-sprint.');
  if (missingEstimates > 0) breakdownReasons.push(missingEstimates + ' sub-task(s) missing estimates.');
  if (missingLoggedItems > 0) breakdownReasons.push(missingLoggedItems + ' sub-task(s) with no time logged.');
  const breakdownText = breakdownReasons.length ? breakdownReasons.join(' ') : 'No risks.';
  const formulaText = 'Health = 2+ risks → red, 1 risk → yellow, 0 → green.';

  html += '<div class="health-status-row">';
  html += '<div class="health-status-chip ' + riskColor + '" title="' + escapeHtml(breakdownText) + '" id="health-status-chip">' + riskMessage + '</div>';
  html += '<button type="button" class="btn btn-compact health-breakdown-toggle" aria-expanded="false" aria-controls="health-breakdown-detail" data-action="toggle-health-breakdown">Why?</button>';
  html += '</div>';
  html += '<div id="health-breakdown-detail" class="health-breakdown-detail" hidden>';
  html += '<p class="health-breakdown-reasons">' + escapeHtml(breakdownText) + '</p>';
  html += '<p class="health-breakdown-formula"><small>' + escapeHtml(formulaText) + '</small></p>';
  html += '</div>';

  // Progress bar (story points)
  html += '<div class="health-progress-section">';
  html += '<div class="progress-label">Story Point Distribution</div>';
  html += '<div class="progress-bar-container">';
  if (donePercent > 0) {
    html += '<div class="progress-bar done" style="width: ' + donePercent + '%;" title="' + doneSP + ' SP done">' +
      (donePercent > 10 ? '<span class="progress-text">' + doneSP + ' SP done (' + donePercent + '%)</span>' : '') +
      '</div>';
  }
  if (inProgressPercent > 0) {
    html += '<div class="progress-bar inprogress" style="width: ' + inProgressPercent + '%;" title="' + (totalSP - doneSP) + ' SP in progress">' +
      (inProgressPercent > 10 ? '<span class="progress-text">' + (totalSP - doneSP) + ' SP in progress</span>' : '') +
      '</div>';
  }
  html += '</div>';
  html += '<div class="progress-summary">';
  html += '<span>' + percentDone + '% complete (detailed snapshot is in the header)</span>';
  html += '</div>';
  html += '</div>';

  // Feature vs Support split
  html += '<div class="health-split-section">';
  html += '<div class="split-label">Scope Distribution</div>';
  html += '<div class="split-bars">';
  const featurePercent = totalSP > 0 ? Math.round((newFeaturesSP / totalSP) * 100) : 0;
  const supportPercent = totalSP > 0 ? Math.round((supportOpsSP / totalSP) * 100) : 0;
  html += '<div class="split-item">';
  html += '<span class="split-name">New Features</span>';
  html += '<div class="split-bar-container">';
  html += '<div class="split-bar feature" style="width: ' + featurePercent + '%;" title="' + newFeaturesSP + ' SP"></div>';
  html += '</div>';
  html += '<span class="split-value">' + newFeaturesSP + ' SP (' + featurePercent + '%)</span>';
  html += '</div>';
  html += '<div class="split-item">';
  html += '<span class="split-name">Support & Ops</span>';
  html += '<div class="split-bar-container">';
  html += '<div class="split-bar support" style="width: ' + supportPercent + '%;" title="' + supportOpsSP + ' SP"></div>';
  html += '</div>';
  html += '<span class="split-value">' + supportOpsSP + ' SP (' + supportPercent + '%)</span>';
  html += '</div>';
  html += '</div>';
  html += '</div>';

  // Time tracking status
  html += '<div class="health-tracking-section">';
  html += '<div class="tracking-label">Sub-task Time Tracking</div>';
  html += '<div class="tracking-items">';
  html += '<div class="tracking-item">';
  html += '<span>Estimated Hours</span>';
  html += '<strong>' + totalEstimate + ' h</strong>';
  html += '</div>';
  html += '<div class="tracking-item">';
  html += '<span>Logged Hours</span>';
  html += '<strong>' + totalLogged + ' h</strong>';
  html += '</div>';
  html += '<div class="tracking-item">';
  html += '<span>Remaining Hours</span>';
  html += '<strong>' + totalRemaining + ' h</strong>';
  html += '</div>';
  html += '</div>';

  // Risk status
  const statusHtml = [];
  if (trackingSummary.totalEstimateHours > 0) {
    statusHtml.push('✓ Complete');
  } else if (missingEstimates > 0) {
    statusHtml.push('⚠️ ' + missingEstimates + ' missing estimate');
  }

  if (missingLoggedItems > 0) {
    statusHtml.push('⚠️ ' + missingLoggedItems + ' no log');
  }

  if (statusHtml.length > 0) {
    html += '<div class="tracking-status">' + statusHtml.join(' | ') + '</div>';
  }
  html += '</div>';
  // Stuck risk details are shown in the dedicated risks card to avoid repeating warnings.

  // Action buttons (snapshot already visible above; Details = optional expand, Copy = clipboard)
  html += '<div class="health-actions">';
  html += '<button class="btn btn-compact health-detail-btn" data-action="expand-details" title="Show more detailed metrics">More details</button>';
  html += '<button class="btn btn-compact health-copy-btn" data-action="copy-metrics" title="Copy why-this-status evidence for stakeholders">Copy why + evidence</button>';
  html += '</div>';

  html += '</div>';
  return html;
}

/**
 * Wire health dashboard handlers
 */
export function wireHealthDashboardHandlers() {
  const dashboard = document.querySelector('.health-dashboard-card');
  if (!dashboard) return;

  // Copy metrics to clipboard
  const copyBtn = dashboard.querySelector('.health-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const statusChip = dashboard.querySelector('.health-status-chip');
      const progressSummary = dashboard.querySelector('.progress-summary');
      const trackingItems = dashboard.querySelectorAll('.tracking-item');

      // Build Slack-friendly markdown-like message
      let lines = [];
      lines.push('*Sprint Health Snapshot*');
      if (statusChip?.textContent) {
        lines.push('> ' + statusChip.textContent.trim());
      }
      if (progressSummary?.textContent) {
        lines.push('\n*Progress*: ' + progressSummary.textContent.trim());
      }

      lines.push('\n*Time Tracking:*');
      trackingItems.forEach(item => {
        const label = item.querySelector('span')?.textContent?.trim();
        const value = item.querySelector('strong')?.textContent?.trim();
        if (label && value) lines.push('- ' + label + ': ' + value);
      });

      // Top stuck items (if present) — include issue link text and summary
      const stuckRows = Array.from(document.querySelectorAll('#stuck-card tbody tr'));
      if (stuckRows.length > 0) {
        lines.push('\n*Top stuck items:*');
        const toShow = stuckRows.slice(0, 5);
        toShow.forEach(tr => {
          const issueCell = tr.querySelector('td:first-child');
          const summaryCell = tr.querySelector('td:nth-child(2)');
          let keyText = issueCell ? (issueCell.textContent || '').trim() : '';
          const link = issueCell ? issueCell.querySelector('a') : null;
          if (link && link.href) {
            // Slack-friendly: <url|KEY>
            lines.push('- <' + link.href + '|' + keyText + '> — ' + (summaryCell ? (summaryCell.textContent || '').trim() : ''));
          } else if (keyText) {
            lines.push('- `' + keyText + '` — ' + (summaryCell ? (summaryCell.textContent || '').trim() : ''));
          }
        });
      }

      const text = lines.join('\n');
      navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      });
    });
  }

  // Expand/collapse details
  const detailsBtn = dashboard.querySelector('.health-detail-btn');
  if (detailsBtn) {
    detailsBtn.addEventListener('click', () => {
      const card = detailsBtn.closest('.health-dashboard-card');
      card?.classList.toggle('expanded');
    });
  }
}


