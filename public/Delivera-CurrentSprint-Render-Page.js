import { updateHeader } from './Delivera-CurrentSprint-Render-Overview.js';
import { renderBurndown, renderStories } from './Delivera-CurrentSprint-Render-Progress.js';
import { renderDataAvailabilitySummaryHtml, renderEmptyStateHtml, renderNoActiveSprintEmptyState, renderNoIssuesForContextEmptyState, renderNoProjectsSelectedEmptyState } from './Delivera-Shared-Empty-State-Helpers.js';
import { renderHeaderBar } from './Delivera-CurrentSprint-Header-Bar.js';
import { renderRisksAndInsights } from './Delivera-CurrentSprint-Risks-Insights.js';
import { renderSprintCarousel } from './Delivera-CurrentSprint-Navigation-Carousel.js';
import { renderCountdownTimer } from './Delivera-CurrentSprint-Countdown-Timer.js';
import { renderDecisionCockpit } from './Delivera-CurrentSprint-Decision-Cockpit.js';
import { deriveSprintPhase } from './Delivera-CurrentSprint-Summary-01Facts-Verdict-SSOT.js';
import { resolvePrimaryBlockerKey } from './Delivera-CurrentSprint-Summary-03AtAGlance-Briefing-SSOT.js';
import { renderTopBlockerCard } from './Delivera-CurrentSprint-TopBlocker-01Card-UI.js';
import { cockpitRisksToAttentionItems } from './Delivera-Shared-Attention-Queue.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function renderNextUpStrip(data) {
  const meta = data?.meta || {};
  if (!meta.limbo && !meta.noActiveSprintFallback) return '';
  const nc = meta.nextSprintCandidate;
  if (!nc?.name && !meta.cadenceLine) return '';
  const ncName = String(nc?.name || 'Upcoming sprint').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ncGoal = String(nc?.goal || '').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const overdue = meta.nextSprintStartOverdue === true;
  return ''
    + '<section class="sprint-next-up-strip transparency-card" data-testid="sprint-next-up" aria-label="Next sprint">'
    + '<p class="sprint-next-up-kicker">What is next</p>'
    + '<strong class="sprint-next-up-title">' + escapeHtml(ncName) + '</strong>'
    + (meta.cadenceLine ? '<p class="sprint-next-up-cadence">' + escapeHtml(meta.cadenceLine) + '</p>' : '')
    + (ncGoal ? '<p class="sprint-next-up-goal">' + ncGoal + '</p>' : '')
    + (overdue ? '<p class="sprint-next-up-overdue">Planned start has passed — activate sprint in Jira.</p>' : '')
    + '</section>';
}

function renderMiniBurndownRail(data) {
  const remaining = Array.isArray(data?.remainingWorkByDay) ? data.remainingWorkByDay : [];
  if (remaining.length < 2) return '';
  const series = remaining.map((r) => Number(r.remainingSP) || 0);
  const width = 120;
  const height = 34;
  const padding = 4;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const spread = Math.max(1, max - min);
  const path = series.map((value, index) => {
    const x = padding + ((width - padding * 2) * index) / Math.max(1, series.length - 1);
    const y = height - padding - (((value - min) / spread) * (height - padding * 2));
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
  return ''
    + '<div class="sprint-proof-rail-burndown" data-testid="sprint-rail-burndown">'
    + '<p class="sprint-proof-rail-kicker">Flow</p>'
    + `<svg class="decision-sparkline" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path d="${path}"></path></svg>`
    + '</div>';
}

function renderSprintProofRail(data) {
  const meta = data?.meta || {};
  const blockerKey = resolvePrimaryBlockerKey(data);
  const nba = data?.decisionCockpit?.nextBestAction || {};
  const topRisks = cockpitRisksToAttentionItems(data?.decisionCockpit?.topRisks || []).slice(0, 3);
  const burndownHtml = renderMiniBurndownRail(data);
  const defaultTab = blockerKey ? 'work' : (topRisks.length ? 'risks' : 'flow');

  const stuckHours = Math.round(Number(data?.stuckCandidates?.find((c) => c.issueKey === blockerKey)?.hoursInStatus || 0));
  const nudgeDraft = blockerKey
    ? `${blockerKey}: blocked ${stuckHours}h — can we unblock today?`
    : '';

  let workBody = '<p class="sprint-proof-rail-empty">No blocker — sprint work is moving.</p>';
  if (blockerKey) {
    workBody = ''
      + '<p class="sprint-proof-rail-kicker">Unblock today</p>'
      + '<strong class="sprint-proof-rail-key" data-primary-blocker-key="' + escapeHtml(blockerKey) + '">' + escapeHtml(blockerKey) + '</strong>'
      + '<p class="sprint-proof-rail-summary">' + escapeHtml(nba.summary || nba.reason || '') + '</p>'
      + '<div class="sprint-proof-rail-nudge-inline" data-testid="sprint-rail-nudge-inline">'
      + '<label class="visually-hidden" for="sprint-rail-nudge-draft">Nudge draft</label>'
      + '<textarea id="sprint-rail-nudge-draft" class="sprint-proof-rail-nudge-draft" rows="2" placeholder="Quick unblock ask — press Enter to review…">' + escapeHtml(nudgeDraft) + '</textarea>'
      + '<p class="sprint-proof-rail-nudge-hint">Press Enter to open nudge review</p>'
      + '</div>';
  } else if (meta.limbo && meta.nextSprintCandidate?.name) {
    workBody = ''
      + '<p class="sprint-proof-rail-kicker">Next sprint</p>'
      + '<strong class="sprint-proof-rail-key">' + escapeHtml(meta.nextSprintCandidate.name) + '</strong>'
      + '<p class="sprint-proof-rail-summary">' + escapeHtml(meta.explanatoryLine || meta.cadenceLine || '') + '</p>';
  }

  const riskRows = topRisks.length
    ? topRisks.map((r) => ''
      + '<li class="sprint-proof-rail-risk">'
      + '<strong>' + escapeHtml(r.issue) + '</strong>'
      + '<span>' + escapeHtml(r.reason) + '</span>'
      + '</li>').join('')
    : '<li class="sprint-proof-rail-empty">No critical risks flagged.</li>';

  const flowBody = burndownHtml || '<p class="sprint-proof-rail-empty">Flow chart loads when burndown data is available.</p>';

  const tabBtn = (id, label) => {
    const active = defaultTab === id;
    return '<button type="button" role="tab" class="sprint-proof-rail-tab' + (active ? ' is-active' : '') + '" data-rail-tab="' + id + '" aria-selected="' + (active ? 'true' : 'false') + '">' + escapeHtml(label) + '</button>';
  };
  const panel = (id, body) => {
    const active = defaultTab === id;
    return '<div class="sprint-proof-rail-panel' + (active ? ' is-active' : '') + '" data-rail-panel="' + id + '" role="tabpanel"' + (active ? '' : ' hidden') + '>' + body + '</div>';
  };

  return ''
    + '<aside class="sprint-proof-rail" id="sprint-proof-rail" data-testid="sprint-proof-rail" data-default-rail-tab="' + escapeHtml(defaultTab) + '">'
    + '<div class="sprint-proof-rail-tabs" role="tablist" aria-label="Sprint focus">'
    + tabBtn('work', 'Work')
    + tabBtn('risks', 'Risks')
    + tabBtn('flow', 'Flow')
    + '</div>'
    + panel('work', workBody)
    + panel('risks', '<ul class="sprint-proof-rail-risk-list">' + riskRows + '</ul>')
    + panel('flow', flowBody)
    + '</aside>';
}

function renderSprintSwitcher(data) {
  if (!Array.isArray(data.recentSprints) || data.recentSprints.length <= 1) return '';
  // Auto-expand when there's no active sprint — user shouldn't need a click to see history
  const noActiveSprint = !data.sprint;
  const openAttr = noActiveSprint ? ' open' : '';
  return ''
    + '<details class="sprint-history-fold sprint-switcher-card sprint-switcher-card-inline" aria-label="Switch sprint"' + openAttr + '>'
    + '<summary class="header-drawer-section-label">Past sprints</summary>'
    + renderSprintCarousel(data, { viewportLean: true })
    + '</details>';
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

  const headerOpts = { sectionLinksHtml: '', viewportLean: true, sectionLinksInDrawer: true };
  html += renderHeaderBar(data, headerOpts);
  html += renderTopBlockerCard(data);
  html += renderNextUpStrip(data);
  html += renderSprintSwitcher(data);
  if (data?.meta?.noActiveSprintFallback || data?.meta?.limbo) {
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

  html += '<div id="sprint-alignment-strip-mount" data-alignment-above-fold="1"></div>';
  const blockerKey = resolvePrimaryBlockerKey(data);
  // Show the right rail on desktop whenever there are stories — not just when
  // there's a blocker. This moves the proof rail + signals beside the main
  // column instead of stacking 4000px+ of vertical scroll.
  const showRail = blockerKey || data?.meta?.limbo || hasStories;
  html += '<div class="current-sprint-grid-layout current-sprint-viewport-lean' + (showRail ? ' sprint-rail-visible' : '') + '">';
  html += '<div class="sprint-main-column">';

  if (hasStories) {
    html += '<div class="sprint-cards-column full-width" id="stories-card-wrap">';
    html += renderStories(data);
    html += '</div>';
  }

  html += '<div class="sprint-cockpit-column full-width">';
  html += renderDecisionCockpit(data, { viewportLean: true });
  html += '</div>';

  const belowFold = (hasBurndownData ? ('<div class="sprint-cards-row risks-row">'
    + '<div class="card-column burndown-column">' + renderBurndown(data) + '</div>'
    + '</div>') : '')
    + '<div class="sprint-cards-row secondary-row">'
    + '<div class="card-column risks-insights-column">' + renderRisksAndInsights(data) + '</div>'
    + '</div>';

  if (belowFold.trim()) {
    const healthStatus = String(data?.decisionCockpit?.health?.status || '');
    const isBlockedView = /blocked|needs attention/i.test(healthStatus);
    const daysElapsed = Number(data?.daysMeta?.daysElapsedWorking ?? data?.daysMeta?.daysElapsedCalendar ?? 0);
    const daysRemaining = Number(data?.daysMeta?.daysRemainingWorking ?? data?.daysMeta?.daysRemainingCalendar ?? 0);
    const daysTotal = daysElapsed + daysRemaining;
    const pctElapsed = daysTotal > 0 ? (daysElapsed / daysTotal) * 100 : (Number(data?.summary?.percentDone) || 0);
    const foldOpen = isBlockedView || pctElapsed >= 50 ? ' open' : '';
    html += '<details class="sprint-full-sprint-fold sprint-full-sprint-fold--desktop-inline"' + foldOpen + '>';
    html += '<summary>Full sprint</summary>';
    html += '<div class="sprint-full-sprint-fold-body">';
    html += belowFold;
    html += '</div></details>';
  } else if (/blocked|needs attention/i.test(String(data?.decisionCockpit?.health?.status || ''))) {
    html += '<details class="sprint-full-sprint-fold">';
    html += '<summary>Full sprint</summary>';
    html += '<div class="sprint-full-sprint-fold-body"></div></details>';
  }

  html += '</div>';
  html += renderSprintProofRail(data);
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
