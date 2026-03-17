import { updateHeader } from './Reporting-App-CurrentSprint-Render-Overview.js';
import { renderBurndown, renderStories } from './Reporting-App-CurrentSprint-Render-Progress.js';
import { renderDataAvailabilitySummaryHtml, renderEmptyStateHtml, renderNoActiveSprintEmptyState, renderNoIssuesForContextEmptyState, renderNoProjectsSelectedEmptyState } from './Reporting-App-Shared-Empty-State-Helpers.js';
import { renderHeaderBar } from './Reporting-App-CurrentSprint-Header-Bar.js';
import { renderRisksAndInsights } from './Reporting-App-CurrentSprint-Risks-Insights.js';
import { buildCapacitySummary } from './Reporting-App-CurrentSprint-Capacity-Allocation.js';
import { deriveSprintVerdict } from './Reporting-App-CurrentSprint-Alert-Banner.js';
import { getUnifiedRiskCounts } from './Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';

export function renderCurrentSprintPage(data) {
  const hasProjectContext = String(data?.meta?.projects || data?.board?.projectKeys?.join(',') || '').trim();
  if (!hasProjectContext) {
    updateHeader(null);
    return '<div class="transparency-card">' + renderNoProjectsSelectedEmptyState() + '</div>';
  }
  if (!data.sprint) {
    updateHeader(null);
    return (
      '<div class="transparency-card">' +
      renderNoActiveSprintEmptyState() +
      '</div>'
    );
  }

  updateHeader(data.sprint);

  let html = '';
  const summary = data.summary || {};
  const availabilityGaps = [];
  const hasStories = Array.isArray(data.stories) && data.stories.length > 0;
  const hasDailyCompletions = Array.isArray(data?.dailyCompletions?.stories) && data.dailyCompletions.stories.length > 0;
  const hasBurndownSeries = Array.isArray(data.remainingWorkByDay) && data.remainingWorkByDay.length > 0;
  const hasBurndownData = hasBurndownSeries || hasStories;
  if (!hasStories) availabilityGaps.push({ source: 'Data', label: 'Work items hidden', reason: 'No sprint issues returned for this board.' });
  if (!hasDailyCompletions) availabilityGaps.push({ source: 'Window', label: 'Daily completion hidden', reason: 'No completed items in this sprint window yet.' });
  if (!hasBurndownData) availabilityGaps.push({ source: hasBurndownSeries ? 'Workflow' : 'Data', label: 'Burndown hidden', reason: hasBurndownSeries ? 'No planned story points for this sprint.' : 'No story-point history available.' });

  html += renderHeaderBar(data);
  if (data?.meta?.noActiveSprintFallback && data?.meta?.explanatoryLine) {
    html += '<div class="transparency-card"><p><strong>No active sprint</strong> - ' + data.meta.explanatoryLine + '</p></div>';
  }

  const allSectionsHidden = !hasStories && !hasDailyCompletions && !hasBurndownData;
  if (allSectionsHidden) {
    html += renderDataAvailabilitySummaryHtml({ title: 'Hidden sections', items: availabilityGaps });
    if (!hasStories) {
      html += renderNoIssuesForContextEmptyState();
    } else {
      const isHistoricalSprint = String(data?.sprint?.state || '').toLowerCase() !== 'active';
      const isJustStartedSprint = Number(summary.percentDone || 0) === 0 && (summary.totalStories || 0) > 0;
      const title = isHistoricalSprint
        ? 'Historical snapshot with limited trackable signals'
        : (isJustStartedSprint ? 'Sprint just started - evidence not formed yet' : 'No trackable work in this sprint yet');
      const message = isHistoricalSprint
        ? 'This sprint snapshot does not include enough trackable time or issue movement to render health sections.'
        : (isJustStartedSprint
          ? 'Stories exist, but logs and movement have not formed enough evidence yet.'
          : 'This sprint has no stories, estimates, or logged work. Add stories in Jira to see health metrics here.');
      const hint = isHistoricalSprint
        ? 'Pick an active sprint from the carousel for live signals.'
        : 'Check the board configuration or select a different sprint from the carousel.';
      html += renderEmptyStateHtml(title, message, hint, isHistoricalSprint ? 'View report' : 'Pick a board', isHistoricalSprint ? { href: '/report' } : {});
    }
    try {
      const sprintState = (data.sprint?.state || '').toLowerCase();
      const freshLabel = sprintState === 'active' ? 'Live sprint data' : 'Snapshot: ' + (data.sprint?.name || '');
      window.dispatchEvent(new CustomEvent('app:data-freshness', { detail: { label: freshLabel, state: sprintState === 'active' ? 'live' : 'stale' } }));
    } catch (_) {}
    return html;
  }

  const jumpLinks = [];
  const outcomeProjects = Array.isArray(data?.board?.projectKeys) && data.board.projectKeys.length
    ? data.board.projectKeys.join(',')
    : String(data?.meta?.projects || '');
  const outcomeContext = [
    data?.board?.name || 'Current sprint board',
    data?.sprint?.name || 'Current sprint',
    data?.sprint?.startDate && data?.sprint?.endDate
      ? `${String(data.sprint.startDate).slice(0, 10)} - ${String(data.sprint.endDate).slice(0, 10)}`
      : '',
  ].filter(Boolean).join(' | ');
  if (hasStories) jumpLinks.push('<a href="#stories-card">Work & flow</a>');
  if (hasBurndownData) jumpLinks.push('<a href="#burndown-card">Flow over time</a>');
  jumpLinks.push('<a href="#risks-insights-card">Insights</a>');
  const sectionActions = [];
  sectionActions.push('<button type="button" class="btn btn-secondary btn-compact sprint-section-inline-action" data-open-outcome-modal data-outcome-context="' + String(outcomeContext || 'Create work from the current sprint menu.').replace(/"/g, '&quot;') + '" data-outcome-projects="' + String(outcomeProjects).replace(/"/g, '&quot;') + '">Create work from insight</button>');
  const sectionLinksHtml = '<div class="sprint-section-links sprint-section-links-compact" role="navigation" aria-label="Jump to section">'
    + jumpLinks.join('')
    + (sectionActions.length ? '<div class="sprint-section-inline-actions">' + sectionActions.join('') + '</div>' : '')
    + '</div>';

  const verdict = deriveSprintVerdict(data);
  const capacitySummary = buildCapacitySummary(data);

  html += '<div class="current-sprint-grid-layout">';
  html += buildUnifiedSprintHud(data, verdict, capacitySummary, sectionLinksHtml);

  if (hasStories) {
    html += '<div class="sprint-cards-column full-width">';
    html += renderStories(data);
    html += '</div>';
  }

  if (hasBurndownData) {
    html += '<div class="sprint-cards-row risks-row">';
    html += '<div class="card-column burndown-column">' + renderBurndown(data) + '</div>';
    html += '</div>';
  }

  html += '<div class="sprint-cards-row secondary-row">';
  html += '<div class="card-column risks-insights-column">' + renderRisksAndInsights(data) + '</div>';
  html += '</div>';
  html += '</div>';

  try {
    const sprintState = (data.sprint?.state || '').toLowerCase();
    const freshLabel = sprintState === 'active' ? 'Live sprint data' : 'Snapshot: ' + (data.sprint?.name || '');
    window.dispatchEvent(new CustomEvent('app:data-freshness', { detail: { label: freshLabel, state: sprintState === 'active' ? 'live' : 'stale' } }));
  } catch (_) {}

  return html;
}

export function renderCurrentSprintPageParts(data) {
  const fullHtml = renderCurrentSprintPage(data);
  const hasProjectContext = String(data?.meta?.projects || data?.board?.projectKeys?.join(',') || '').trim();
  if (!hasProjectContext || !data?.sprint) {
    return {
      initialHtml: fullHtml,
      fullHtml,
      hasDeferredSections: false,
    };
  }

  const verdict = deriveSprintVerdict(data);
  const capacitySummary = buildCapacitySummary(data);
  const initialHtml = ''
    + renderHeaderBar(data)
    + '<div class="current-sprint-grid-layout current-sprint-grid-layout-phased">'
    + buildUnifiedSprintHud(data, verdict, capacitySummary, '<div class="sprint-section-links sprint-section-links-compact" role="navigation" aria-label="Jump to section"><span class="sprint-section-inline-link is-disabled">Work &amp; flow</span><span class="sprint-section-inline-link is-disabled">Burndown</span><div class="sprint-section-inline-actions"><button type="button" class="btn btn-secondary btn-compact sprint-section-inline-action" disabled>Create work from insight</button></div></div>', true)
    + '<div class="transparency-card sprint-progressive-shell" data-progressive-shell="deferred">'
    + '<h2>Loading sprint work</h2>'
    + '<p>HUD is ready. Stories and flow load next.</p>'
    + '</div>'
    + '</div>';

  return {
    initialHtml,
    fullHtml,
    hasDeferredSections: true,
  };
}

function buildSprintAtAGlanceHero(data, verdict, capacitySummary) {
  const summary = data.summary || {};
  const daysMeta = data.daysMeta || {};
  const totalStories = summary.totalStories ?? 0;
  const doneStories = summary.doneStories ?? 0;
  const totalSP = summary.totalSP ?? 0;
  const doneSP = summary.doneSP ?? 0;
  const percentDone = typeof summary.percentDone === 'number' ? summary.percentDone : 0;
  const remainingDays = daysMeta.daysRemainingWorking ?? daysMeta.daysRemainingCalendar;

  const sprintHealthClass = verdict.color === 'red' || verdict.color === 'critical'
    ? 'sprint-health-needs-attention'
    : verdict.color === 'yellow' || verdict.color === 'warning'
      ? 'sprint-health-at-risk'
      : 'sprint-health-healthy';

  const capacityLabel = capacitySummary?.label || 'Capacity status not available yet';
  const narrative = Number(percentDone || 0) === 0 && totalStories > 0
    ? 'Sprint just started. Evidence is still forming.'
    : (verdict.tagline || verdict.summary || 'Health combines blockers, scope, ownership, and time tracking.');

  return ''
    + '<section class="sprint-at-a-glance-hero" aria-label="Sprint at a glance">'
    + '<div class="sprint-at-a-glance-stats">'
    + '<strong>' + percentDone + '% done</strong>'
    + (totalStories ? ' | ' + doneStories + '/' + totalStories + ' stories' : '')
    + (totalSP ? ' | ' + doneSP + '/' + totalSP + ' SP' : '')
    + (remainingDays != null ? ' | Ends in ' + remainingDays + 'd' : '')
    + '</div>'
    + '<p class="sprint-at-a-glance-cta">'
    + '<span class="' + sprintHealthClass + '">' + (verdict.verdict || 'Sprint health') + '</span>'
    + ' | ' + narrative
    + ' | Capacity: ' + capacityLabel
    + '</p>'
    + '</section>';
}

function buildUnifiedSprintHud(data, verdict, capacitySummary, sectionLinksHtml, isLoadingShell = false) {
  const summary = data.summary || {};
  const issueCount = summary.totalStories ?? 0;
  const riskCounts = getUnifiedRiskCounts(data);
  const missingEstimateCount = Number(verdict.missingEstimate || 0);
  const overloadedOwners = Number(capacitySummary?.overloadedAssignees || 0);
  const capacitySignal = capacitySummary?.state === 'critical'
    ? 'Capacity needs intervention'
    : capacitySummary?.state === 'warning'
      ? 'Capacity needs attention'
      : 'Capacity covered';
  let html = '<section class="sprint-jump-rail" aria-label="Sprint navigation and next actions">';
  html += '<p class="sprint-jump-rail-copy"><span class="sprint-hud-verdict">Next actions</span><span>' + (verdict.tagline || verdict.summary || 'Jump straight to work, flow, and unblock paths.') + '</span><span>' + capacitySignal + ' across ' + issueCount + ' issues.</span></p>';
  html += sectionLinksHtml || '';
  if (!isLoadingShell && (Number(riskCounts.blockersOwned || 0) > 0 || missingEstimateCount > 0 || overloadedOwners > 0)) {
    html += '<div class="sprint-jump-rail-signals">';
    html += '<span class="sprint-jump-signal">Blockers ' + Number(riskCounts.blockersOwned || 0) + '</span>';
    html += '<span class="sprint-jump-signal">Missing est ' + missingEstimateCount + '</span>';
    html += '<span class="sprint-jump-signal">Ownership ' + Math.max(Number(riskCounts.unownedOutcomes || 0), overloadedOwners) + '</span>';
    html += '</div>';
  }
  html += '</section>';
  return html;
}

function buildCapacityAllocationCard(capacitySummary, data) {
  const summary = capacitySummary || {};
  const unassignedDetail = summary.unassignedCount > 0
    ? summary.unassignedCount + ' issue' + (summary.unassignedCount === 1 ? '' : 's') + ' unassigned'
    : 'All issues have an owner';

  const baseClass = summary.state === 'critical'
    ? 'capacity-health red'
    : summary.state === 'warning'
      ? 'capacity-health yellow'
      : 'capacity-health green';

  const totalStories = (data.summary && data.summary.totalStories) || 0;

  let html = '<div class="transparency-card capacity-allocation-card" id="capacity-card">';
  html += '<h2>Capacity and ownership</h2>';
  html += '<div class="' + baseClass + '">' + (summary.label || 'Capacity signal loading') + '</div>';
  html += '<div class="capacity-warning">' + (summary.detail || 'Sprint ownership will appear once issues are fully assigned.') + '</div>';
  html += '<div class="capacity-allocations">';
  html += '<div class="allocation-item">';
  html += '<div class="allocation-header">';
  html += '<span class="allocation-name">Ownership coverage</span>';
  html += '<span class="allocation-stats">' + summary.assigneeCount + ' owner' + (summary.assigneeCount === 1 ? '' : 's') +
    (totalStories ? ' · ' + totalStories + ' stories' : '') + '</span>';
  html += '</div>';
  html += '<p>' + unassignedDetail + '.</p>';
  html += '</div>';
  html += '</div>';
  html += '</div>';
  return html;
}
