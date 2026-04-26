import { escapeHtml, renderIssueKeyLink } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { formatDayLabel, formatNumber } from './Delivera-Shared-Format-DateNumber-Helpers.js';

function getToneClass(tone) {
  if (tone === 'critical') return 'is-critical';
  if (tone === 'warning') return 'is-warning';
  return 'is-positive';
}

function renderMetricCard(label, value, meta = '', progress = null, tone = '') {
  const toneClass = tone ? ` ${tone}` : '';
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
    return '<div class="decision-empty-card">No material top risks are active right now.</div>';
  }
  return topRisks.map((risk) => {
    const severityClass = risk.severity === 'High' ? 'is-critical' : (risk.severity === 'Medium' ? 'is-warning' : '');
    return ''
      + `<article class="decision-risk-card ${severityClass}">`
      + `<div class="decision-risk-head">`
      + `<div>${renderIssueKeyLink(risk.issueKey, risk.issueUrl)} <strong>${escapeHtml(risk.summary || '')}</strong></div>`
      + `<span class="decision-severity-badge">${escapeHtml(risk.severity || 'Review')}</span>`
      + '</div>'
      + `<p class="decision-risk-meta">${escapeHtml(risk.reason || '')}</p>`
      + `<div class="decision-risk-tags">${(risk.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>`
      + `<button type="button" class="btn btn-secondary btn-compact" data-cockpit-risk-tags="${escapeHtml((risk.riskTags || []).join(' '))}" data-cockpit-target="#stories-card">Focus in work list</button>`
      + '</article>';
  }).join('');
}

function renderQuickActions(actions = []) {
  return actions.map((action) => ''
    + `<button type="button" class="decision-quick-action" data-cockpit-risk-tags="${escapeHtml((action.riskTags || []).join(' '))}" data-cockpit-target="#stories-card">`
    + `<span>${escapeHtml(action.label || '')}</span>`
    + `<strong>${escapeHtml(String(action.count || 0))}</strong>`
    + '</button>').join('');
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

export function renderDecisionCockpit(data) {
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
    : `+${keySignals?.completedRecent?.count || 0} tasks completed`;

  return ''
    + '<section class="decision-cockpit-shell">'
    + '<div class="decision-cockpit-header">'
    + '<div>'
    + '<p class="decision-cockpit-eyebrow">Current Sprint</p>'
    + `<h1>${escapeHtml(sprint.name || 'Sprint')}</h1>`
    + `<p class="decision-cockpit-subtitle">${escapeHtml(dateLabel)} <span>•</span> ${escapeHtml(remainingDaysLabel)}</p>`
    + '</div>'
    + '<div class="decision-cockpit-status">'
    + `<span class="decision-health-pill ${getToneClass(health.tone)}">${escapeHtml(health.status || 'On Track')}</span>`
    + '<span class="decision-health-caption">Outcome-focused sprint cockpit</span>'
    + '</div>'
    + '</div>'
    + '<div class="decision-cockpit-grid">'
    + `<article class="decision-health-card ${getToneClass(health.tone)}">`
    + '<div class="decision-card-icon">~</div>'
    + '<div>'
    + '<p class="decision-card-label">Sprint Health</p>'
    + `<h2>${escapeHtml(health.status || 'On Track')}</h2>`
    + `<p>${escapeHtml(health.message || '')}</p>`
    + '</div>'
    + '</article>'
    + '<article class="decision-action-card">'
    + '<p class="decision-card-label">Next Best Action</p>'
    + `<h2>${nextBestAction.issueKey ? escapeHtml(nextBestAction.issueKey) + ' - ' : ''}${escapeHtml(nextBestAction.summary || '')}</h2>`
    + `<p>${escapeHtml(nextBestAction.reason || '')}</p>`
    + '<div class="decision-action-row">'
    + `<button type="button" class="btn btn-primary" data-cockpit-risk-tags="${escapeHtml((nextBestAction.riskTags || []).join(' '))}" data-cockpit-target="#stories-card">${escapeHtml(nextBestAction.ctaLabel || 'Take Action')}</button>`
    + '<button type="button" class="btn btn-secondary" data-open-outcome-modal data-outcome-context="Create structured work from the sprint next-best-action and top risks.">Create work</button>'
    + '</div>'
    + '</article>'
    + '<article class="decision-signals-card">'
    + '<p class="decision-card-label">Key Signals</p>'
    + '<div class="decision-signal-list">'
    + `<div><span class="signal-dot positive"></span><strong>${escapeHtml(completedSignal)}</strong><small>Recent completion</small></div>`
    + `<div><span class="signal-dot critical"></span><strong>${escapeHtml(String(keySignals.blockers || 0))}</strong><small>Blockers</small></div>`
    + `<div><span class="signal-dot warning"></span><strong>${escapeHtml(String(keySignals.scopeChanges || 0))}</strong><small>Scope changes</small></div>`
    + `<div><span class="signal-dot ${(keySignals.inactivity ? 'critical' : 'positive')}"></span><strong>${keySignals.inactivity ? 'Inactive' : 'Moving'}</strong><small>Last 24h</small></div>`
    + '</div>'
    + '</article>'
    + '<aside class="decision-rail">'
    + '<section class="decision-rail-card">'
    + '<div class="decision-rail-header"><h2>Top Risks</h2></div>'
    + renderTopRisks(topRisks)
    + '</section>'
    + '<section class="decision-rail-card">'
    + '<div class="decision-rail-header"><h2>Quick Actions</h2></div>'
    + renderQuickActions(quickActions)
    + '</section>'
    + '<section class="decision-rail-card decision-automation-card">'
    + '<p class="decision-card-label">Automation</p>'
    + '<h2>Paste tasks -> we structure them</h2>'
    + '<p>Turn notes into clean Jira-ready work aligned to outcomes, owners, and next actions.</p>'
    + '<button type="button" class="btn btn-primary" data-open-outcome-modal data-outcome-context="Structure sprint notes into realistic Jira work for this squad.">Try it now</button>'
    + '</section>'
    + '</aside>'
    + '</div>'
    + '<div class="decision-metrics-row">'
    + renderMetricCard('Progress %', `${metrics?.progressPct?.value ?? 0}%`, metrics?.progressPct?.deltaVsPrior != null ? `${formatNumber(metrics.progressPct.deltaVsPrior, 1, '0')} SP vs prior sprint` : 'Sprint progress', metrics?.progressPct?.value ?? 0)
    + renderMetricCard('Story Points', `${formatNumber(metrics?.storyPoints?.completed || 0, 1, '0')} / ${formatNumber(metrics?.storyPoints?.planned || 0, 1, '0')}`, metrics?.storyPoints?.variance != null ? `${formatNumber(metrics.storyPoints.variance, 1, '0')} SP variance` : '', metrics?.storyPoints?.planned > 0 ? ((metrics.storyPoints.completed / metrics.storyPoints.planned) * 100) : 0)
    + renderMetricCard('Work Items', `${metrics?.workItems?.done || 0} / ${metrics?.workItems?.total || 0}`, `${metrics?.workItems?.remaining || 0} remaining`, metrics?.workItems?.total > 0 ? ((metrics.workItems.done / metrics.workItems.total) * 100) : 0)
    + renderMetricCard('Logged vs Estimate', `${formatNumber(metrics?.timeLogged?.logged || 0, 1, '0')}h / ${formatNumber(metrics?.timeLogged?.estimated || 0, 1, '0')}h`, `${metrics?.timeLogged?.ratioPct || 0}% of estimate`, metrics?.timeLogged?.ratioPct || 0, metrics?.timeLogged?.ratioPct > 110 ? ' is-warning' : '')
    + renderMetricCard('Scope Delta', `${formatNumber(metrics?.scopeDelta?.storyPoints || 0, 1, '0')} SP`, `${metrics?.scopeDelta?.count || 0} changes | ${metrics?.scopeDelta?.percent || 0}% of plan`, metrics?.scopeDelta?.percent || 0, metrics?.scopeDelta?.storyPoints > 0 ? ' is-warning' : '')
    + '</div>'
    + '<section class="decision-workmovement-card">'
    + '<div class="decision-card-heading">'
    + '<div><p class="decision-card-label">Work Movement</p><h2>Completed vs added story points over time</h2></div>'
    + '<p>Use this to explain sprint movement, scope pressure, and where delivery confidence changed.</p>'
    + '</div>'
    + renderWorkMovementChart(data)
    + '</section>'
    + '<section class="decision-insights-row">'
    + renderInsights(cockpit.insights || {})
    + '</section>'
    + '</section>';
}

export function wireDecisionCockpitHandlers() {
  const root = document.querySelector('.decision-cockpit-shell');
  if (!root || root.dataset.wiredDecisionCockpit === '1') return;
  root.dataset.wiredDecisionCockpit = '1';
  root.addEventListener('click', (event) => {
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
    const target = document.querySelector(targetSelector);
    if (target) {
      event.preventDefault();
      if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(target);
      else target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}
