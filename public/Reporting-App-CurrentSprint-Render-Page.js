import { updateHeader } from './Reporting-App-CurrentSprint-Render-Overview.js';
import { renderDailyCompletion, renderBurndown, renderStories } from './Reporting-App-CurrentSprint-Render-Progress.js';
import { renderWorkRisksMerged } from './Reporting-App-CurrentSprint-Render-Subtasks.js';
import { renderDataAvailabilitySummaryHtml, renderEmptyStateHtml } from './Reporting-App-Shared-Empty-State-Helpers.js';
// New redesign components
import { renderHeaderBar } from './Reporting-App-CurrentSprint-Header-Bar.js';
import { renderHealthDashboard } from './Reporting-App-CurrentSprint-Health-Dashboard.js';
import { renderAlertBanner, renderVerdictBar } from './Reporting-App-CurrentSprint-Alert-Banner.js';
import { renderRisksAndInsights } from './Reporting-App-CurrentSprint-Risks-Insights.js';
import { renderCapacityAllocation } from './Reporting-App-CurrentSprint-Capacity-Allocation.js';
import { renderSprintCarousel } from './Reporting-App-CurrentSprint-Navigation-Carousel.js';
import { renderCountdownTimer } from './Reporting-App-CurrentSprint-Countdown-Timer.js';

export function renderCurrentSprintPage(data) {
  if (!data.sprint) {
    updateHeader(null);
    return (
      '<div class="transparency-card">' +
      renderEmptyStateHtml(
        'No active sprint',
        'There is no active sprint on this board right now.',
        'Try the previous sprint tab in the carousel above or select a different board.'
      ) +
      '</div>'
    );
  }

  updateHeader(data.sprint);

  let html = '';
  const summary = data.summary || {};
  const tracking = data.subtaskTracking || {};
  const trackingRows = tracking.rows || [];
  const stuckCount = (data.stuckCandidates || []).length || 0;
  const missingEstimates = trackingRows.filter((r) => !r.estimateHours || r.estimateHours === 0).length;
  const missingLoggedItems = trackingRows.filter((r) => !r.loggedHours || r.loggedHours === 0).length;
  const percentDone = typeof summary.percentDone === 'number' ? summary.percentDone : 0;

  const signals = [];
  if (stuckCount > 0) signals.push(stuckCount + ' stuck >24h');
  if (missingEstimates > 0) signals.push(missingEstimates + ' missing estimates');
  if (missingLoggedItems > 0) signals.push(missingLoggedItems + ' with no log');
  if (percentDone < 50 && (summary.totalStories || 0) > 0) signals.push('less than half of stories done');

  const riskCount = signals.length;
  const availabilityGaps = [];
  const hasStories = Array.isArray(data.stories) && data.stories.length > 0;
  const hasDailyCompletions = Array.isArray(data?.dailyCompletions?.stories) && data.dailyCompletions.stories.length > 0;
  const hasBurndownSeries = Array.isArray(data.remainingWorkByDay) && data.remainingWorkByDay.length > 0;
  const hasBurndownData = hasBurndownSeries && Number(summary.totalSP || 0) > 0;
  const hasCapacityData = hasStories && Number(summary.totalSP || 0) > 0;
  const hasHealthData = hasStories || hasBurndownSeries || trackingRows.length > 0;
  if (!hasStories) availabilityGaps.push({ source: 'Data', label: 'Work items hidden', reason: 'No sprint issues returned for this board.' });
  if (!hasDailyCompletions) availabilityGaps.push({ source: 'Window', label: 'Daily completion hidden', reason: 'No completed items in this sprint window yet.' });
  if (!hasBurndownData) availabilityGaps.push({ source: hasBurndownSeries ? 'Workflow' : 'Data', label: 'Burndown hidden', reason: hasBurndownSeries ? 'No planned story points for this sprint.' : 'No story-point history available.' });
  if (!hasCapacityData) availabilityGaps.push({ source: 'Workflow', label: 'Capacity hidden', reason: 'Not enough assigned story-point data.' });
  if (!hasHealthData) availabilityGaps.push({ source: 'Data', label: 'Health dashboard hidden', reason: 'No sprint telemetry available yet.' });

  // Flaw 3: Single-line verdict bar first (one sentence, one color, one action)
  html += renderVerdictBar(data);

  // Edge Case #1: All sections hidden → single full-page empty state instead of a wall of hidden-section chips
  const allSectionsHidden = !hasStories && !hasDailyCompletions && !hasBurndownData && !hasCapacityData && !hasHealthData;
  if (allSectionsHidden) {
    html += renderDataAvailabilitySummaryHtml({ title: 'Hidden sections', items: availabilityGaps });
    html += renderEmptyStateHtml(
      'No trackable work in this sprint yet',
      'This sprint has no stories, estimates, or logged work. Add stories in Jira to see health metrics here.',
      'Check the board configuration or select a different sprint from the carousel.'
    );
    try {
      const sprintState = (data.sprint?.state || '').toLowerCase();
      const freshLabel = sprintState === 'active' ? 'Live sprint data' : 'Snapshot: ' + (data.sprint?.name || '');
      window.dispatchEvent(new CustomEvent('app:data-freshness', { detail: { label: freshLabel, state: sprintState === 'active' ? 'live' : 'stale' } }));
    } catch (_) {}
    return html;
  }

  html += renderHeaderBar(data);
  html += renderAlertBanner(data);
  html += renderSprintCarousel(data);

  const jumpLinks = [];
  const hasRisks = riskCount > 0 || stuckCount > 0 || (data.stuckCandidates || []).length > 0;
  if (hasRisks) jumpLinks.push('<a href="#stuck-card">Risks</a>');
  if (hasBurndownData) jumpLinks.push('<a href="#burndown-card">Burndown</a>');
  jumpLinks.push('<a href="#risks-insights-card">Insights</a>');
  if (hasStories) jumpLinks.push('<a href="#stories-card">Work items</a>');
  html += '<div class="sprint-section-links" role="navigation" aria-label="Jump to section">' + jumpLinks.join('<span aria-hidden="true"> | </span>') + '</div>';

  html += '<div class="current-sprint-grid-layout">';

  // Priority order: Blockers/Risks first, then burndown/scope, then details (progressive disclosure)
  // Edge Case #3: When zero risks, skip the risks row entirely — no empty table
  if (hasRisks || hasBurndownData) {
    html += '<div class="sprint-cards-row risks-row">';
    if (hasRisks) html += '<div class="card-column risks-stuck-column">' + renderWorkRisksMerged(data) + '</div>';
    if (hasBurndownData) html += '<div class="card-column burndown-column">' + renderBurndown(data) + '</div>';
    html += '</div>';
  }

  html += '<div class="sprint-cards-row secondary-row">';
  html += '<div class="card-column countdown-column">' + renderCountdownTimer(data) + '</div>';
  html += '<div class="card-column risks-insights-column">' + renderRisksAndInsights(data) + '</div>';
  html += '</div>';

  const detailsCollapsed = riskCount >= 1 ? ' card-details-collapsed' : '';
  if (hasHealthData || hasCapacityData) {
    html += '<div class="sprint-cards-row top-row card-details-toggle-wrap' + detailsCollapsed + '" data-region="details">';
    html += '<button type="button" class="card-details-toggle btn btn-secondary btn-compact" aria-expanded="' + (riskCount >= 1 ? 'false' : 'true') + '" aria-controls="card-details-region">' + (riskCount >= 1 ? 'Show details (countdown, health, capacity)' : 'Hide details') + '</button>';
    html += '</div>';
    html += '<div class="sprint-cards-row top-row" id="card-details-region" aria-hidden="' + (riskCount >= 1 ? 'true' : 'false') + '">';
    if (hasHealthData) html += '<div class="card-column health-column">' + renderHealthDashboard(data) + '</div>';
    if (hasCapacityData) html += '<div class="card-column capacity-column">' + renderCapacityAllocation(data) + '</div>';
    html += '</div>';
  }

  html += '<div class="sprint-cards-column full-width">';
  if (hasDailyCompletions) {
    html += '<details class="mobile-secondary-details" data-mobile-collapse="true" open>';
    html += '<summary>Daily completion trend</summary>';
    html += renderDailyCompletion(data);
    html += '</details>';
  }
  if (hasStories) html += renderStories(data);
  html += '</div>';

  html += '</div>';

  try {
    const sprintState = (data.sprint?.state || '').toLowerCase();
    const freshLabel = sprintState === 'active' ? 'Live sprint data' : 'Snapshot: ' + (data.sprint?.name || '');
    window.dispatchEvent(new CustomEvent('app:data-freshness', { detail: { label: freshLabel, state: sprintState === 'active' ? 'live' : 'stale' } }));
  } catch (_) {}

  return html;
}
