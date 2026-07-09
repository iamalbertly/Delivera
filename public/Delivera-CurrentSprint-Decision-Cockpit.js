import { escapeHtml, renderIssueKeyLink } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { resolvePrimaryBlockerKey } from './Delivera-CurrentSprint-Summary-03AtAGlance-Briefing-SSOT.js';
import { cockpitRisksToAttentionItems, renderAttentionQueueTable } from './Delivera-Shared-Attention-Queue.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { formatDayLabel, formatNumber } from './Delivera-Shared-Format-DateNumber-Helpers.js';
import { buildDeliveredImpactBullets, deriveSprintGoal } from './Delivera-CurrentSprint-Value-Helpers.js';

function getToneClass(tone) {
  if (tone === 'critical') return 'is-critical';
  if (tone === 'warning') return 'is-warning';
  return 'is-positive';
}

function getInteractiveTargetAttrs(riskTags = [], targetSelector = '#stories-card') {
  const tags = Array.isArray(riskTags) ? riskTags.filter(Boolean).join(' ') : '';
  const target = targetSelector || '#stories-card';
  return ` role="button" tabindex="0" data-cockpit-risk-tags="${escapeHtml(tags)}" data-cockpit-target="${escapeHtml(target)}"`;
}

function renderMetricCard(label, value, meta = '', progress = null, tone = '') {
  const normalizedTone = String(tone || '').trim();
  const toneClass = normalizedTone ? ` ${normalizedTone}` : '';
  const progressValue = progress == null ? null : Math.max(0, Math.min(100, Number(progress) || 0));
  return ''
    + `<article class="decision-metric-card${toneClass}">`
    + `<p class="decision-metric-label">${escapeHtml(label)}</p>`
    + `<p class="decision-metric-value">${escapeHtml(value)}</p>`
    + (meta ? `<p class="decision-metric-meta">${escapeHtml(meta)}</p>` : '')
    + (progressValue != null
      ? `<div class="decision-metric-bar"><span style="width:${progressValue}%;"></span></div>`
      : '')
    + '</article>';
}

function renderSparkline(points = [], tone = 'neutral') {
  const series = Array.isArray(points) && points.length ? points : [0];
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
    + `<svg class="decision-sparkline tone-${escapeHtml(tone)}" viewBox="0 0 ${width} ${height}" aria-hidden="true">`
    + `<path d="${path}"></path>`
    + '</svg>';
}

function normalizeActionLabel(label = '') {
  return String(label || '')
    .replace(/^Unblock issues$/i, 'Need unblock')
    .replace(/^Add estimates$/i, 'Need estimate')
    .replace(/^Review scope changes$/i, 'Added work')
    .replace(/^Assign owners$/i, 'Need owner')
    .replace(/^Balance workload$/i, 'Balance load')
    .trim() || 'Review';
}

function aggregateScopeByDay(scopeChanges = []) {
  const map = new Map();
  scopeChanges.forEach((change) => {
    const key = String(change?.date || '').slice(0, 10);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + (Number(change?.storyPoints) || 0));
  });
  return map;
}

function buildWorkMovementSeries(data) {
  const completions = Array.isArray(data?.dailyCompletions?.stories) ? data.dailyCompletions.stories : [];
  const scopeByDay = aggregateScopeByDay(data?.scopeChanges || []);
  const allDates = new Set();
  completions.forEach((row) => allDates.add(String(row?.date || '').slice(0, 10)));
  scopeByDay.forEach((_value, key) => allDates.add(key));
  if (!allDates.size && Array.isArray(data?.remainingWorkByDay)) {
    data.remainingWorkByDay.forEach((row) => allDates.add(String(row?.date || '').slice(0, 10)));
  }
  return [...allDates]
    .filter(Boolean)
    .sort()
    .map((date) => {
      const completion = completions.find((row) => String(row?.date || '').slice(0, 10) === date);
      const remainingPoint = (data?.remainingWorkByDay || []).find((row) => String(row?.date || '').slice(0, 10) === date);
      return {
        date,
        completed: Number(completion?.spCompleted || completion?.count || 0),
        added: Number(scopeByDay.get(date) || 0),
        remaining: Number(remainingPoint?.remainingSP || 0),
      };
    });
}

function renderWorkMovementChart(data) {
  const series = buildWorkMovementSeries(data).slice(-8);
  if (!series.length) {
    return '<div class="decision-workmovement-empty">Work movement will appear when sprint progress signals are available.</div>';
  }
  const width = 760;
  const height = 240;
  const chartTop = 16;
  const chartBottom = 174;
  const step = width / Math.max(1, series.length);
  const maxValue = Math.max(1, ...series.flatMap((row) => [row.completed, row.added, row.remaining]));
  const remainingPath = series.map((row, index) => {
    const x = step * index + step * 0.5;
    const y = chartBottom - ((row.remaining / maxValue) * (chartBottom - chartTop));
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
  const annotations = Array.isArray(data?.decisionCockpit?.workMovementAnnotations) ? data.decisionCockpit.workMovementAnnotations : [];

  let barsHtml = '';
  series.forEach((row, index) => {
    const completedHeight = (row.completed / maxValue) * (chartBottom - chartTop);
    const addedHeight = (row.added / maxValue) * (chartBottom - chartTop);
    const baseX = step * index + step * 0.22;
    barsHtml += `<rect class="decision-bar-completed" x="${baseX.toFixed(2)}" y="${(chartBottom - completedHeight).toFixed(2)}" width="${(step * 0.22).toFixed(2)}" height="${completedHeight.toFixed(2)}" rx="6"></rect>`;
    barsHtml += `<rect class="decision-bar-added" x="${(baseX + step * 0.28).toFixed(2)}" y="${(chartBottom - addedHeight).toFixed(2)}" width="${(step * 0.22).toFixed(2)}" height="${addedHeight.toFixed(2)}" rx="6"></rect>`;
  });

  const annotationsHtml = annotations.slice(0, 4).map((item) => {
    const index = series.findIndex((row) => row.date === item.date);
    if (index < 0) return '';
    const x = step * index + step * 0.5;
    return ''
      + `<g class="decision-chart-annotation ${escapeHtml(item.type || '')}">`
      + `<line x1="${x.toFixed(2)}" y1="${chartTop}" x2="${x.toFixed(2)}" y2="${chartBottom}" />`
      + `<text x="${x.toFixed(2)}" y="${chartTop - 2}" text-anchor="middle">${escapeHtml(item.label || '')}</text>`
      + '</g>';
  }).join('');

  const labelsHtml = series.map((row, index) => {
    const x = step * index + step * 0.5;
    return `<text class="decision-chart-label" x="${x.toFixed(2)}" y="206" text-anchor="middle">${escapeHtml(formatDayLabel(row.date))}</text>`;
  }).join('');

  return ''
    + '<div class="decision-workmovement-chart-wrap">'
    + `<svg class="decision-workmovement-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Work movement showing completed work, added scope, and remaining story points">`
    + `<line class="decision-chart-baseline" x1="0" y1="${chartBottom}" x2="${width}" y2="${chartBottom}" />`
    + barsHtml
    + `<path class="decision-line-remaining" d="${remainingPath}"></path>`
    + annotationsHtml
    + labelsHtml
    + '</svg>'
    + '<div class="decision-chart-legend">'
    + '<span><i class="legend-block done"></i>Completed</span>'
    + '<span><i class="legend-block added"></i>Added</span>'
    + '<span><i class="legend-block remaining"></i>Remaining</span>'
    + '</div>'
    + '</div>';
}

function renderTopRisks(topRisks = []) {
  if (!topRisks.length) {
    return '<div class="decision-empty-card">No hidden blockers. Keep sprint value moving.</div>';
  }
  return topRisks.slice(0, 3).map((risk) => {
    const severityClass = risk.severity === 'High' ? 'is-critical' : (risk.severity === 'Medium' ? 'is-warning' : '');
    const actionAttrs = getInteractiveTargetAttrs(risk.riskTags || [], '#stories-card');
    return ''
      + `<article class="decision-risk-card ${severityClass}"${actionAttrs}>`
      + `<div class="decision-risk-head">`
      + `<div>${renderIssueKeyLink(risk.issueKey, risk.issueUrl)} <strong>${escapeHtml(risk.summary || '')}</strong></div>`
      + `<span class="decision-severity-badge">${escapeHtml(risk.severity || 'Review')}</span>`
      + '</div>'
      + `<p class="decision-risk-meta">${escapeHtml(risk.reason || '')}</p>`
      + `<div class="decision-risk-tags">${(risk.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>`
      + '</article>';
  }).join('');
}

function renderQuickActions(actions = []) {
  if (!actions.length) {
    return '<p class="decision-action-empty">No urgent cleanup queue.</p>';
  }
  return '<ul class="decision-action-queue" aria-label="Action queue">'
    + actions.slice(0, 4).map((action) => ''
    + `<li${getInteractiveTargetAttrs(action.riskTags || [], '#stories-card')}>`
    + `<span>${escapeHtml(normalizeActionLabel(action.label || ''))}</span>`
    + `<strong>${escapeHtml(String(action.count || 0))}</strong>`
    + '</li>').join('')
    + '</ul>';
}

function renderInsights(insights = {}) {
  const cards = [
    { key: 'completionClustering', label: 'Completion Clustering' },
    { key: 'scopeImpact', label: 'Scope Change Impact' },
    { key: 'plannedActualVariance', label: 'Planned vs Actual' },
    { key: 'confidence', label: 'Confidence' },
  ];
  return cards.map(({ key, label }) => {
    const item = insights[key] || {};
    const toneClass = getToneClass(item.tone);
    const numericValue = key === 'completionClustering'
      ? `${item.value || 0}%`
      : (key === 'scopeImpact'
        ? `${formatNumber(item.value || 0, 1, '0')} SP`
        : (key === 'plannedActualVariance'
          ? `${formatNumber(item.value || 0, 1, '0')} SP`
          : String(item.value || '-')));
    return ''
      + `<article class="decision-insight-card ${toneClass}">`
      + `<div>`
      + `<p class="decision-insight-label">${escapeHtml(label)}</p>`
      + `<h3>${escapeHtml(numericValue)}</h3>`
      + `<p>${escapeHtml(item.interpretation || '')}</p>`
      + '</div>'
      + renderSparkline(item.trend || [], item.tone || 'neutral')
      + '</article>';
  }).join('');
}

function buildSummaryStrip(data, cockpit) {
  const sprint = data?.sprint || {};
  const summary = data?.summary || {};
  const health = cockpit?.health || {};
  const totalStories = Number(summary.totalStories || 0);
  const doneStories = Number(summary.doneStories || 0);
  const completedPct = totalStories > 0 ? Math.round((doneStories / totalStories) * 100) : 0;
  const spilloverPct = totalStories > 0 ? Math.max(0, Math.round(((totalStories - doneStories) / totalStories) * 100)) : 0;
  const impacts = buildDeliveredImpactBullets(Array.isArray(data?.stories) ? data.stories : [], new Map()).slice(0, 3);
  const fallbackImpact = impacts.length ? impacts : [deriveSprintGoal(data)];
  const toneClass = getToneClass(health.tone);

  return ''
    + `<section class="decision-summary-strip ${toneClass}" aria-label="Sprint value summary">`
    + '<div class="decision-summary-cell decision-summary-cell-primary">'
    + '<span class="decision-summary-label">Value answer</span>'
    + `<strong>${escapeHtml(sprint.name || 'Current sprint')}</strong>`
    + `<p>${escapeHtml(deriveSprintGoal(data))}</p>`
    + '</div>'
    + '<div class="decision-summary-cell">'
    + '<span class="decision-summary-label">Done</span>'
    + `<strong>${completedPct}% complete</strong>`
    + `<p>${spilloverPct}% may spill over</p>`
    + '</div>'
    + '<div class="decision-summary-cell decision-summary-cell-impact">'
    + '<span class="decision-summary-label">Customer impact</span>'
    + '<div class="decision-impact-chip-row">'
    + fallbackImpact.map((item) => `<span class="decision-impact-chip">${escapeHtml(item)}</span>`).join('')
    + '</div>'
    + '</div>'
    + '<div class="decision-summary-cell">'
    + '<span class="decision-summary-label">Risk</span>'
    + `<strong class="decision-risk-indicator ${toneClass}">${escapeHtml(health.status || 'On Track')}</strong>`
    + '<p>Are we delivering value this sprint?</p>'
    + '</div>'
    + '</section>';
}

export function renderDecisionCockpit(data, options = {}) {
  const { viewportLean = false } = options;
  const cockpit = data?.decisionCockpit || {};
  const health = cockpit.health || {};
  const nextBestAction = cockpit.nextBestAction || {};
  const metrics = cockpit.metrics || {};
  const keySignals = cockpit.keySignals || {};
  const topRisks = Array.isArray(cockpit.topRisks) ? cockpit.topRisks : [];
  const quickActions = Array.isArray(cockpit.quickActions) ? cockpit.quickActions : [];
  const sprint = data?.sprint || {};
  const dateLabel = [formatDayLabel(sprint.startDate), formatDayLabel(sprint.endDate)].filter(Boolean).join(' - ');
  const remainingDaysLabel = metrics?.daysRemaining == null ? 'Window unknown' : `${metrics.daysRemaining} days left`;
  const completedSignal = keySignals?.completedRecent?.storyPoints > 0
    ? `+${formatNumber(keySignals.completedRecent.storyPoints, 1, '0')} SP recently`
    : `+${keySignals?.completedRecent?.count || 0} done`;
  const totalStories = Number(data?.summary?.totalStories || 0);
  const doneStories = Number(data?.summary?.doneStories || 0);
  const valueDoneLabel = totalStories > 0 ? `${doneStories}/${totalStories} value stories` : 'Value stories loading';
  const stuckCount = Array.isArray(data?.stuckCandidates) ? data.stuckCandidates.length : 0;
  const hasBlockers = stuckCount > 0 || topRisks.length > 0;
  const riskQueueTotal = topRisks.length + quickActions.reduce((sum, item) => sum + Number(item?.count || 0), 0);
  const riskQueueLabel = riskQueueTotal > 0 ? `${riskQueueTotal} action${riskQueueTotal === 1 ? '' : 's'} waiting` : 'No hidden blockers';
  const trustLabel = data?.meta?.partialPermissions ? 'Limited' : (metrics?.timeLogged?.ratioPct === 0 ? 'Needs evidence' : 'Usable');
  const nextActionTitle = nextBestAction.summary
    ? `${nextBestAction.issueKey ? `${nextBestAction.issueKey} - ` : ''}${nextBestAction.summary}`
    : (riskQueueTotal > 0 ? 'Review risk queue' : 'No urgent action');
  const nextActionReason = nextBestAction.reason
    || (riskQueueTotal > 0 ? 'Use the risk queue to remove friction from the sprint.' : 'Sprint signals do not show an urgent cleanup queue right now.');
  const nextActionCta = nextBestAction.ctaLabel || (riskQueueTotal > 0 ? 'Review work' : 'Review sprint work');
  const collapseSummary = `${health.status || 'On Track'} — ${health.message || 'Expand for sprint drill-down.'}`;

  const leanClass = viewportLean ? ' decision-cockpit-shell--viewport-lean' : '';
  const quickCreateChip = '<button type="button" class="cs-cockpit-quick-create btn btn-primary btn-compact" data-open-outcome-modal data-outcome-context="Create work from current sprint context." style="margin-bottom:6px;font-size:0.78rem;">+ Create work</button>';
  const primaryBlockerKey = resolvePrimaryBlockerKey(data);
  const blocker = topRisks.find((risk) => String(risk.issueKey || '').toUpperCase() === primaryBlockerKey)
    || (primaryBlockerKey ? { issueKey: primaryBlockerKey, assignee: nextBestAction.assignee, summary: nextBestAction.summary } : topRisks[0] || {});
  const verdictLabel = health.tone === 'critical'
    ? COPY.verdictBlocked
    : health.tone === 'warning'
      ? COPY.verdictWatch
      : COPY.verdictOnTrack;
  const sprintTodayHero = ''
    + '<section class="sprint-today-hero" aria-label="Sprint today">'
    + '<h2>Sprint today</h2>'
    + `<p class="sprint-today-verdict"><strong>${escapeHtml(verdictLabel)}</strong></p>`
    + `<p class="sprint-today-answer">${escapeHtml(health.message || 'Review sprint signals.')}</p>`
    + (blocker.issueKey ? `<p data-testid="cockpit-main-blocker"><strong>Main blocker:</strong> ${escapeHtml(blocker.issueKey)}</p>` : '')
    + (nextBestAction.assignee && nextBestAction.issueKey !== primaryBlockerKey ? `<p><strong>Who to chase:</strong> ${escapeHtml(nextBestAction.assignee)}</p>` : '')
    + (!nextBestAction.assignee && nextBestAction.issueKey && nextBestAction.issueKey !== primaryBlockerKey ? `<p><strong>Who to chase:</strong> ${escapeHtml(nextBestAction.issueKey)}</p>` : '')
    + `<p><strong>Next move:</strong> ${escapeHtml(nextBestAction.ctaLabel || nextBestAction.summary || 'Review work queue')}</p>`
    + (viewportLean && hasBlockers ? '<p class="sprint-today-scroll-note" data-testid="cockpit-blockers-below">Showing blockers below</p>' : '')
    + '</section>';
  const attentionQueueHtml = viewportLean ? '' : renderAttentionQueueTable({
    title: COPY.attentionQueue,
    items: cockpitRisksToAttentionItems(topRisks),
    maxRows: 5,
  });
  const nextActionLinkHtml = viewportLean && hasBlockers
    ? ''
    : `<a href="#stories-card" class="decision-primary-link" data-cockpit-risk-tags="${escapeHtml((nextBestAction.riskTags || []).join(' '))}" data-cockpit-target="#stories-card">${escapeHtml(nextActionCta)}</a>`;
  return ''
    + sprintTodayHero
    + attentionQueueHtml
    + '<section class="decision-cockpit-shell' + leanClass + '">'
    + (viewportLean ? buildSummaryStrip(data, cockpit) : buildSummaryStrip(data, cockpit))
    + '<details class="decision-cockpit-details">'
    + `<summary class="decision-cockpit-details-summary">${escapeHtml(collapseSummary)}</summary>`
    + '<div class="decision-cockpit-details-body">'
    + `<p class="decision-cockpit-subtitle">${escapeHtml(dateLabel)} <span>|</span> ${escapeHtml(remainingDaysLabel)}</p>`
    + '<div class="decision-cockpit-grid">'
    + `<article class="decision-answer-card decision-health-card ${getToneClass(health.tone)}">`
    + '<div class="decision-card-icon" aria-hidden="true">~</div>'
    + '<div>'
    + '<p class="decision-card-label">Sprint answer</p>'
    + `<h2>${escapeHtml(health.status || 'On Track')}</h2>`
    + `<p>${escapeHtml(health.message || 'Keep customer value moving and remove blockers quickly.')}</p>`
    + `<p class="decision-plain-line">${escapeHtml(dateLabel)} | ${escapeHtml(remainingDaysLabel)} | ${escapeHtml(valueDoneLabel)}</p>`
    + '</div>'
    + '</article>'
    + '<article class="decision-action-card">'
    + '<p class="decision-card-label">Next action</p>'
    + `<h2>${escapeHtml(nextActionTitle)}</h2>`
    + `<p>${escapeHtml(nextActionReason)}</p>`
    + nextActionLinkHtml
    + '</article>'
    + '<article class="decision-signals-card">'
    + '<p class="decision-card-label">Signals</p>'
    + '<div class="decision-signal-list">'
    + `<div><span class="signal-dot positive"></span><strong>${escapeHtml(completedSignal)}</strong><small>Done now</small></div>`
    + `<div><span class="signal-dot critical"></span><strong>${escapeHtml(String(keySignals.blockers || 0))}</strong><small>Blockers</small></div>`
    + `<div><span class="signal-dot warning"></span><strong>${escapeHtml(String(keySignals.scopeChanges || 0))}</strong><small>Added work</small></div>`
    + `<div><span class="signal-dot ${(keySignals.inactivity ? 'critical' : 'positive')}"></span><strong>${keySignals.inactivity ? 'Inactive' : 'Moving'}</strong><small>Last 24h</small></div>`
    + '</div>'
    + '</article>'
    + '<aside class="decision-rail">'
    + '<section class="decision-rail-card">'
    + `<div class="decision-rail-header"><h2>Risk queue</h2><span>${escapeHtml(riskQueueLabel)}</span></div>`
    + renderTopRisks(topRisks)
    + renderQuickActions(quickActions)
    + '</section>'
    + (viewportLean ? '' : ('<details class="decision-rail-card decision-automation-card">'
    + '<summary>Paste tasks -> structure work</summary>'
    + '<p>Turn notes into clean Jira-ready work aligned to outcomes, owners, and next actions.</p>'
    + '<button type="button" class="btn btn-primary btn-compact" data-open-outcome-modal data-outcome-context="Structure sprint notes into realistic Jira work for this squad.">Structure now</button>'
    + '</details>'))
    + '</aside>'
    + '</div>'
    + '<div class="decision-metrics-row">'
    + renderMetricCard('Value done', valueDoneLabel, `${metrics?.progressPct?.value ?? 0}% complete`, metrics?.progressPct?.value ?? 0)
    + renderMetricCard('Work left', `${metrics?.workItems?.remaining || 0}`, `${metrics?.workItems?.done || 0}/${metrics?.workItems?.total || 0} done`, metrics?.workItems?.total > 0 ? ((metrics.workItems.done / metrics.workItems.total) * 100) : 0)
    + renderMetricCard('Risk queue', `${riskQueueTotal}`, `${topRisks.length} top risks | ${keySignals.blockers || 0} blockers`, Math.min(100, riskQueueTotal * 12), riskQueueTotal > 0 ? ' is-warning' : '')
    + renderMetricCard('Trust', trustLabel, `${metrics?.timeLogged?.ratioPct || 0}% estimate evidence`, metrics?.timeLogged?.ratioPct || 0, data?.meta?.partialPermissions ? ' is-warning' : '')
    + '</div>'
    + '<section class="decision-workmovement-card">'
    + '<div class="decision-card-heading">'
    + '<div><p class="decision-card-label">Value progress</p><h2>Done vs added work</h2></div>'
    + '<p>One evidence chart for movement, added work, and confidence change.</p>'
    + '</div>'
    + renderWorkMovementChart(data)
    + '</section>'
    + '<section class="decision-insights-row">'
    + renderInsights(cockpit.insights || {})
    + '</section>'
    + '</div>'
    + '</details>'
    + '</section>';
}

export function wireDecisionCockpitHandlers() {
  const root = document.querySelector('.decision-cockpit-shell');
  if (!root || root.dataset.wiredDecisionCockpit === '1') return;
  root.dataset.wiredDecisionCockpit = '1';
  function activateCockpitTarget(event) {
    const trigger = event.target.closest('[data-cockpit-risk-tags], [data-cockpit-target]');
    if (!trigger || !root.contains(trigger)) return;
    const riskTags = String(trigger.getAttribute('data-cockpit-risk-tags') || '').split(/\s+/).filter(Boolean);
    const targetSelector = trigger.getAttribute('data-cockpit-target') || '#stories-card';
    if (riskTags.length) {
      try {
        window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', {
          detail: { riskTags, source: 'decision-cockpit' },
        }));
      } catch (_) {}
    }
    const details = root.querySelector('.decision-cockpit-details');
    if (details && !details.open) details.open = true;
    const target = document.querySelector(targetSelector);
    if (target) {
      event.preventDefault();
      if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(target);
      else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  root.addEventListener('click', activateCockpitTarget);
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const trigger = event.target.closest('[data-cockpit-risk-tags], [data-cockpit-target]');
    if (!trigger || !root.contains(trigger)) return;
    event.preventDefault();
    activateCockpitTarget(event);
  });
}
