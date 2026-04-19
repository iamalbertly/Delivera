import { updateHeader } from './Delivera-CurrentSprint-Render-Overview.js';
import { renderBurndown, renderStories } from './Delivera-CurrentSprint-Render-Progress.js';
import { renderDataAvailabilitySummaryHtml, renderEmptyStateHtml, renderNoActiveSprintEmptyState, renderNoIssuesForContextEmptyState, renderNoProjectsSelectedEmptyState } from './Delivera-Shared-Empty-State-Helpers.js';
import { renderHeaderBar } from './Delivera-CurrentSprint-Header-Bar.js';
import { renderRisksAndInsights } from './Delivera-CurrentSprint-Risks-Insights.js';

export function renderCurrentSprintPage(data) {
  const hasProjectContext = String(data?.meta?.projects || data?.board?.projectKeys?.join(',') || '').trim();
  if (!hasProjectContext) {
    updateHeader(null);
    return '<div class="transparency-card">' + renderNoProjectsSelectedEmptyState() + '</div>';
  }
  if (!data.sprint) {
    updateHeader(null);
    const projectsCsv = String(data?.meta?.projects || data?.board?.projectKeys?.join(',') || '').trim();
    return (
      '<div class="transparency-card">' +
      renderNoActiveSprintEmptyState(projectsCsv) +
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

  const jumpLinks = [];
  if (hasStories) jumpLinks.push('<a href="#stories-card">Work & flow</a>');
  if (hasBurndownData) jumpLinks.push('<a href="#burndown-card">Flow over time</a>');
  jumpLinks.push('<a href="#risks-insights-card">Insights</a>');
  const sectionLinksHtml = '<div class="sprint-section-links sprint-section-links-compact" role="navigation" aria-label="Jump to section">'
    + jumpLinks.join('')
    + '</div>';

  html += renderHeaderBar(data, { sectionLinksHtml });
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

  html += '<div class="current-sprint-grid-layout">';

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

  const initialHtml = ''
    + renderHeaderBar(data, { isLoadingShell: true })
    + '<div class="current-sprint-grid-layout current-sprint-grid-layout-phased">'
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
