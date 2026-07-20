import { updateHeader } from './Delivera-CurrentSprint-Render-Overview.js';
import { renderBurndown, renderStories } from './Delivera-CurrentSprint-Render-Progress.js';
import { renderDataAvailabilitySummaryHtml, renderEmptyStateHtml, renderNoActiveSprintEmptyState, renderNoIssuesForContextEmptyState, renderNoProjectsSelectedEmptyState } from './Delivera-Shared-Empty-State-Helpers.js';
import { renderHeaderBar } from './Delivera-CurrentSprint-Header-Bar.js';
import { renderRisksAndInsights } from './Delivera-CurrentSprint-Risks-Insights.js';
import { renderSprintCarousel } from './Delivera-CurrentSprint-Navigation-Carousel.js';
import { renderCountdownTimer } from './Delivera-CurrentSprint-Countdown-Timer.js';
import { renderDecisionCockpit } from './Delivera-CurrentSprint-Decision-Cockpit.js';
import { deriveSprintPhase } from './Delivera-CurrentSprint-Summary-01Facts-Verdict-SSOT.js';

function renderSprintSwitcher(data) {
  // Squad selector: allows switching the focused squad (board) directly from current-sprint
  const squadSelectorHtml = renderSquadSelector(data);
  if (!Array.isArray(data.recentSprints) || data.recentSprints.length <= 1) return squadSelectorHtml;
  return squadSelectorHtml
    + '<details class="sprint-switcher-card sprint-switcher-card-inline" aria-label="Switch sprint">'
    + '<summary>Switch sprint</summary>'
    + '<div class="header-drawer-section-label">Switch sprint</div>'
    + renderSprintCarousel(data)
    + '</details>';
}

/**
 * Render a squad selector dropdown that switches the board (and thus the focused squad).
 * Reads from the governance registry cached in localStorage (populated by Settings page).
 */
function renderSquadSelector(data) {
  const currentBoardId = String(data?.board?.id || data?.meta?.boardId || '');
  const currentProject = String(data?.meta?.projects || '').split(',')[0]?.trim() || '';
  // Build options from the board list if available, or from the current project
  const boards = Array.isArray(data?.availableBoards) ? data.availableBoards : [];
  const options = boards.length
    ? boards.map((b) => `<option value="${String(b.id || '').replace(/"/g, '')}" ${String(b.id) === currentBoardId ? 'selected' : ''}>${String(b.name || b.id || '').replace(/</g, '&lt;')}</option>`).join('')
    : `<option value="${currentBoardId.replace(/"/g, '')}" selected>${currentProject || currentBoardId || 'Current board'}</option>`;
  return `<div class="squad-selector-card" aria-label="Switch squad">
    <label class="squad-selector-label">Squad focus</label>
    <select class="squad-selector-dropdown" data-squad-select>${options}</select>
  </div>`;
}

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
  jumpLinks.push(
    hasStories
      ? '<a href="#stories-card">Work & flow</a>'
      : '<span class="sprint-section-inline-link is-disabled" aria-disabled="true">Work & flow</span>'
  );
  jumpLinks.push(
    hasBurndownData
      ? '<a href="#burndown-card">Flow over time</a>'
      : '<span class="sprint-section-inline-link is-disabled" aria-disabled="true">Flow over time</span>'
  );
  jumpLinks.push('<a href="#risks-insights-card">Insights</a>');
  const sectionLinksHtml = '<div class="sprint-section-links sprint-section-links-compact" role="navigation" aria-label="Jump to section">'
    + jumpLinks.join('')
    + '<div class="sprint-section-inline-actions">'
    + renderCountdownTimer(data, { compact: true, inlineHeader: true })
    + '</div>'
    + '</div>';

  const headerOpts = { sectionLinksHtml, viewportLean: true, sectionLinksInDrawer: true };
  html += renderHeaderBar(data, headerOpts);
  html += renderSprintSwitcher(data);
  if (data?.meta?.noActiveSprintFallback) {
    const nc = data.meta.nextSprintCandidate;
    if (data.meta.suggestStartSprint && nc) {
      const ncName = String(nc.name || 'Upcoming sprint').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const ncGoal = String(nc.goal || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const overdue = data.meta.nextSprintStartOverdue === true;
      html += '<div class="transparency-card sprint-limbo-card">'
        + '<div class="sprint-limbo-icon">⚡</div>'
        + '<div class="sprint-limbo-content">'
        + '<strong class="sprint-limbo-title">Sprint not started — ' + ncName + '</strong>'
        + '<p class="sprint-limbo-line">' + String(data.meta.explanatoryLine || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p>'
        + (ncGoal ? '<p class="sprint-limbo-goal">“' + ncGoal + '”</p>' : '')
        + (overdue ? '<p class="sprint-limbo-overdue">Planned start date has passed. Your team is waiting on sprint activation to pick up work.</p>' : '')
        + '<p class="sprint-limbo-hint">In Jira: open <strong>' + ncName + '</strong> on your board and click <strong>Start sprint</strong> to activate it.</p>'
        + '</div>'
        + '</div>';
    } else if (data.meta.explanatoryLine) {
      html += '<div class="transparency-card"><p><strong>No active sprint</strong> — ' + String(data.meta.explanatoryLine).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</p></div>';
    }
  }

  if (data?.meta?.stale) {
    const ageMs = Number(data.meta.staleAgeMs) || 0;
    const ageH = ageMs > 0 ? Math.round(ageMs / 3600000) : null;
    const ageText = ageH != null ? ' from ' + ageH + 'h ago' : '';
    html = '<div class="cs-stale-banner">Showing cached sprint data' + ageText + ' — Jira was unreachable. Nudge send is disabled.</div>' + html;
  }

  const allSectionsHidden = !hasStories && !hasDailyCompletions && !hasBurndownData;
  if (allSectionsHidden) {
    html += renderDataAvailabilitySummaryHtml({ title: 'Hidden sections', items: availabilityGaps });
    if (!hasStories) {
      html += renderNoIssuesForContextEmptyState();
    } else {
      const isHistoricalSprint = String(data?.sprint?.state || '').toLowerCase() !== 'active';
      const phaseInfo = deriveSprintPhase(data);
      const isJustStartedSprint = phaseInfo.justStarting;
      const title = isHistoricalSprint
        ? 'Historical snapshot with limited trackable signals'
        : (isJustStartedSprint ? 'Early sprint - evidence still forming' : 'No trackable work in this sprint yet');
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
    html += '<div class="sprint-cockpit-column full-width">';
    html += renderDecisionCockpit(data, { viewportLean: true });
    html += '</div>';
    try {
      const sprintState = (data.sprint?.state || '').toLowerCase();
      const freshLabel = sprintState === 'active' ? 'Live sprint data' : 'Snapshot: ' + (data.sprint?.name || '');
      window.dispatchEvent(new CustomEvent('app:data-freshness', { detail: { label: freshLabel, state: sprintState === 'active' ? 'live' : 'stale' } }));
    } catch (_) {}
    return html;
  }

  html += '<div id="sprint-alignment-strip-mount"></div>';
  html += '<div class="current-sprint-grid-layout current-sprint-viewport-lean">';

  if (hasStories) {
    html += '<div class="sprint-cards-column full-width">';
    html += renderStories(data);
    html += '</div>';
  }

  html += '<div class="sprint-cockpit-column full-width">';
  html += renderDecisionCockpit(data, { viewportLean: true });
  html += '</div>';

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
    + renderSprintSwitcher(data)
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
