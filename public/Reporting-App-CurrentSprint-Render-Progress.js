import { escapeHtml, renderIssueKeyLink } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDate, formatDayLabel, formatNumber } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { renderEmptyStateHtml } from './Reporting-App-Shared-Empty-State-Helpers.js';
import { resolveResponsiveRowLimit } from './Reporting-App-Shared-Responsive-Helpers.js';
import { wireShowMoreHandler } from './Reporting-App-Shared-ShowMore-Handlers.js';
import { buildMergedWorkRiskRows, getUnifiedRiskCounts } from './Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';
import { hasOutcomeLabel, isOutcomeStoryLike } from './Reporting-App-Shared-Outcome-Risk-Semantics.js';
import { renderWorkRisksMerged } from './Reporting-App-CurrentSprint-Render-Subtasks.js';
import { buildCapacitySummary } from './Reporting-App-CurrentSprint-Capacity-Allocation.js';

function buildBurndownChart(remaining, ideal, yAxisLabel = 'Remaining SP') {
  if (!remaining || remaining.length === 0) return '';
  const width = 640;
  const height = 220;
  const padding = 24;
  const maxY = Math.max(
    1,
    ...remaining.map(r => r.remainingSP || 0),
    ...(ideal || []).map(r => r.remainingSP || 0)
  );
  const maxX = remaining.length - 1;

  function pointForIndex(idx, value) {
    const x = maxX > 0 ? padding + (idx / maxX) * (width - padding * 2) : padding;
    const y = height - padding - (value / maxY) * (height - padding * 2);
    return x.toFixed(2) + ',' + y.toFixed(2);
  }

  const now = Date.now();
  let currentIndex = remaining.length - 1;
  let foundFuture = false;
  for (let i = 0; i < remaining.length; i++) {
    const ts = new Date(remaining[i].date).getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts > now) {
      currentIndex = Math.max(0, i - 1);
      foundFuture = true;
      break;
    }
  }
  // If every point is in the future (timezone/window edge case), anchor marker at first point.
  if (!foundFuture) {
    const firstTs = new Date(remaining[0]?.date).getTime();
    if (Number.isFinite(firstTs) && firstTs > now) currentIndex = 0;
  }

  const actualSeries = remaining.slice(0, currentIndex + 1);
  const projectionSeries = remaining.slice(Math.max(0, currentIndex), remaining.length);
  const actualPoints = actualSeries.map((row, idx) => pointForIndex(idx, row.remainingSP || 0)).join(' ');
  const projectionPoints = projectionSeries.map((row, offset) => pointForIndex(Math.max(0, currentIndex) + offset, row.remainingSP || 0)).join(' ');
  const idealPoints = (ideal || remaining).map((row, idx) => pointForIndex(idx, row.remainingSP || 0)).join(' ');
  const startLabel = formatDayLabel(remaining[0].date);
  const midIndex = Math.floor(remaining.length / 2);
  const midLabel = formatDayLabel(remaining[midIndex].date);
  const endLabel = formatDayLabel(remaining[remaining.length - 1].date);

  return (
    '<div class="burndown-chart-wrap">' +
    '<svg class="burndown-chart" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Burndown chart with ideal line">' +
    '<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="var(--card-muted)"></rect>' +
    '<polyline points="' + idealPoints + '" class="burndown-ideal" />' +
    (projectionSeries.length > 1 ? '<polyline points="' + projectionPoints + '" class="burndown-projection" />' : '') +
    '<polyline points="' + actualPoints + '" class="burndown-actual" />' +
    (currentIndex < maxX
      ? '<line x1="' + (maxX > 0 ? (padding + (currentIndex / maxX) * (width - padding * 2)).toFixed(2) : padding) + '" y1="' + padding + '" x2="' + (maxX > 0 ? (padding + (currentIndex / maxX) * (width - padding * 2)).toFixed(2) : padding) + '" y2="' + (height - padding) + '" class="burndown-today-marker" />'
      : '') +
    '</svg>' +
    '<div class="burndown-axis">' +
    '<span class="burndown-axis-y">' + escapeHtml(yAxisLabel) + '</span>' +
    '<div class="burndown-axis-x">' +
    '<span>' + escapeHtml(startLabel) + '</span>' +
    '<span>' + escapeHtml(midLabel) + '</span>' +
    '<span>' + escapeHtml(endLabel) + '</span>' +
    '</div>' +
    '</div>' +
    '<div class="burndown-legend">' +
    '<span><span class="legend-swatch actual"></span>Actual</span>' +
    '<span><span class="legend-swatch projection"></span>Projection</span>' +
    '<span><span class="legend-swatch ideal"></span>Ideal</span>' +
    '</div>' +
    '</div>'
  );
}

function burndownHealth(remaining, ideal, total) {
  if (!remaining.length || !ideal.length || total <= 0) return { label: '', class: '' };
  const actualLast = remaining[remaining.length - 1].remainingSP || 0;
  const idealLast = ideal[ideal.length - 1]?.remainingSP ?? 0;
  const diff = actualLast - idealLast;
  const threshold = total * 0.1;
  if (diff > threshold) return { label: 'Behind', class: 'burndown-behind' };
  if (diff < -threshold) return { label: 'Ahead', class: 'burndown-ahead' };
  return { label: 'On track', class: 'burndown-on-track' };
}

export function renderBurndown(data) {
  const remaining = data.remainingWorkByDay || [];
  const ideal = data.idealBurndown || [];
  const daysMeta = data.daysMeta || {};
  const stories = data.stories || [];
  const daily = data?.dailyCompletions?.stories || [];
  const sprintEnded = daysMeta.daysRemainingCalendar != null && daysMeta.daysRemainingCalendar <= 0;
  const summary = data.summary || {};
  const summaryTotalSP = Number(summary.totalSP || 0);
  const summaryTotalAllSP = Number(summary.totalAllSP || 0);
  const completedAfterEnd = Number(summary.completedAfterSprintEndCount || 0);
  const hasMultiSpFields = Array.isArray(summary.storyPointsFieldCandidates) && summary.storyPointsFieldCandidates.length > 1;

  if (!remaining.length) {
    return '<div class="transparency-card" id="burndown-card"><h2>Flow over time</h2><p class="meta-row"><small>Burndown will appear when story points and resolutions are available.</small></p></div>';
  }

  const seriesTotalSP = remaining[0].remainingSP || 0;
  const totalSP = summaryTotalSP > 0 ? summaryTotalSP : seriesTotalSP;
  const lastRemaining = remaining[remaining.length - 1].remainingSP || 0;
  const doneSP = totalSP - lastRemaining;
  const pct = totalSP > 0 ? Math.round((doneSP / totalSP) * 100) : 0;

  if (totalSP === 0 && stories.length > 0) {
    const sortedDaily = [...daily]
      .filter((r) => r && r.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const series = [];
    let completed = 0;
    if (sortedDaily.length > 0) {
      sortedDaily.forEach((row) => {
        completed += Number(row.count || 0);
        const remainingStories = Math.max(0, stories.length - completed);
        series.push({ date: row.date, remainingSP: remainingStories });
      });
    } else {
      const anchorDate = data?.sprint?.startDate || new Date().toISOString();
      series.push({ date: anchorDate, remainingSP: stories.length });
    }
    const idealSeries = series.map((row, idx) => {
      const target = Math.max(0, stories.length - (idx * (stories.length / Math.max(1, series.length - 1))));
      return { date: row.date, remainingSP: target };
    });
    let html = '<div class="transparency-card" id="burndown-card">';
    html += '<h2>Flow over time</h2>';
    html += '<p class="meta-row"><small>Burndown by story count with daily completion trend.</small></p>';
    const statusMessage = summaryTotalAllSP === 0
      ? 'Burndown by story count (story points field is not configured for this board).'
      : 'Burndown by story count (this sprint\u2019s stories currently total 0 SP).';
    html += '<p class="burndown-status-card">' + escapeHtml(statusMessage) + '</p>';
    html += '<p><strong>' + Math.max(0, Math.round(((stories.length - series[series.length - 1].remainingSP) / Math.max(1, stories.length)) * 100)) + '%</strong> complete (' + (stories.length - series[series.length - 1].remainingSP) + ' done of ' + stories.length + ' stories).</p>';
    html += buildBurndownChart(series, idealSeries, 'Remaining Stories');
    html += '</div>';
    return html;
  }

  if (totalSP === 0) {
    const message = summaryTotalAllSP === 0
      ? 'No story points or story completion history available yet.'
      : 'No story points completed in this sprint yet. Story-point field exists but this sprint currently totals 0 SP.';
    return '<div class="transparency-card" id="burndown-card"><h2>Flow over time</h2><p class="burndown-status-card">' + escapeHtml(message) + '</p></div>';
  }

  const sprintJustStarted = remaining.length <= 2 && doneSP === 0;
  const noWorkDone = doneSP === 0;
  const burstDelivery = remaining.length >= 2 && doneSP > 0 && lastRemaining === 0 && (remaining[remaining.length - 2].remainingSP || 0) > 0;

  let html = '<div class="transparency-card" id="burndown-card">';
  html += '<h2>Flow over time</h2>';
  html += '<p class="meta-row"><small>Burndown of remaining SP plus completion flow.</small></p>';

  if (sprintJustStarted) {
    html += '<p class="burndown-status-card burndown-status-info">Sprint just started. Burndown will update as work is completed.</p>';
    html += '<p><strong>0%</strong> complete (0 SP done of ' + formatNumber(totalSP, 1, '-') + ' SP).</p>';
  } else if (noWorkDone && remaining.length > 2) {
    html += '<div class="burndown-status-card burndown-status-empty">';
    html += '<p><strong>No story points completed.</strong> ' + formatNumber(lastRemaining, 1, '-') + ' SP remaining.' + (sprintEnded ? ' Sprint ended.' : '') + '</p>';
    html += '<a href="#stories-card" class="btn btn-secondary btn-compact">View work items</a>';
    html += '</div>';
  } else {
    html += '<p><strong>' + pct + '%</strong> complete (' + formatNumber(doneSP, 1, '-') + ' SP done of ' + formatNumber(totalSP, 1, '-') + ' SP).</p>';
    const health = burndownHealth(remaining, ideal, totalSP);
    if (health.label) html += '<p class="burndown-health ' + health.class + '"><span class="burndown-health-label">' + escapeHtml(health.label) + '</span></p>';
    if (hasMultiSpFields) {
      html += '<p class="burndown-annotation"><small>Multiple Jira story point fields exist; this burndown uses the primary field only. If numbers look off for some projects, align on a single story-points field.</small></p>';
    }
    if (completedAfterEnd > 0) {
      html += '<p class="burndown-annotation"><small>' + escapeHtml(String(completedAfterEnd)) + ' stor' + (completedAfterEnd === 1 ? 'y' : 'ies') + ' completed after sprint end; burndown shows sprint-only completion.</small></p>';
    }
    if (burstDelivery) html += '<p class="burndown-annotation"><small>Burst delivery: work completed on final day.</small></p>';
    html += buildBurndownChart(remaining, ideal, 'Remaining SP');
  }

  html += '<table class="data-table" id="burndown-table">';
  html += '<thead><tr><th>Date</th><th>Remaining SP</th><th>Ideal Remaining</th></tr></thead><tbody>';
  const burndownInitial = 7;
  const burndownToShow = remaining.slice(0, burndownInitial);
  const burndownRemaining = remaining.slice(burndownInitial);
  for (let i = 0; i < burndownToShow.length; i++) {
    const row = burndownToShow[i];
    const idealRow = ideal[i] || ideal[ideal.length - 1] || {};
    html += '<tr>';
    html += '<td>' + escapeHtml(formatDayLabel(row.date)) + '</td>';
    html += '<td>' + formatNumber(row.remainingSP ?? 0, 1, '-') + '</td>';
    html += '<td>' + formatNumber(idealRow.remainingSP ?? 0, 1, '-') + '</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';

  if (burndownRemaining.length > 0) {
    html += '<button class="btn btn-secondary btn-compact burndown-show-more" data-count="' + burndownRemaining.length + '">Show ' + burndownRemaining.length + ' more</button>';
    html += '<template id="burndown-more-template">';
    for (let i = burndownInitial; i < remaining.length; i++) {
      const row = remaining[i];
      const idealRow = ideal[i] || ideal[ideal.length - 1] || {};
      html += '<tr>';
      html += '<td>' + escapeHtml(formatDayLabel(row.date)) + '</td>';
      html += '<td>' + formatNumber(row.remainingSP ?? 0, 1, '-') + '</td>';
      html += '<td>' + formatNumber(idealRow.remainingSP ?? 0, 1, '-') + '</td>';
      html += '</tr>';
    }
    html += '</template>';
  }

  html += '</div>';
  return html;
}

export function renderStories(data) {
  const stories = data.stories || [];
  const scopeChanges = data.scopeChanges || [];
  const mergedRiskRows = buildMergedWorkRiskRows(data);
  const unifiedRiskCounts = getUnifiedRiskCounts(data);
  const summary = data.summary || {};
  const dailySeries = Array.isArray(data?.dailyCompletions?.stories) ? data.dailyCompletions.stories : [];
  const excludedParents = Number(summary.stuckExcludedParentsWithActiveSubtasks || 0);
  const capacitySummary = buildCapacitySummary(data);
  const parentUnassigned = Number(unifiedRiskCounts.unownedOutcomes || 0);
  const blockerKeys = new Set(
    mergedRiskRows
      .filter((row) => row.isOwnedBlocker)
      .map((row) => String(row?.issueKey || row?.key || '').toUpperCase())
      .filter(Boolean)
  );
  const unownedOutcomeKeys = new Set(
    mergedRiskRows
      .filter((row) => row.isUnownedOutcome)
      .map((row) => String(row?.issueKey || row?.key || '').toUpperCase())
      .filter(Boolean)
  );
  const scopeKeys = new Set((scopeChanges || []).map((s) => String(s?.issueKey || s?.key || '').toUpperCase()).filter(Boolean));

  let html = '<div class="transparency-card" id="stories-card">';
  html += '<div class="stories-dom-guardrail" data-story-count="' + stories.length + '" aria-hidden="true"></div>';
  html += '<div class="section-inline-header">';
  html += '<div><h2>Sprint work &amp; flow</h2><p class="section-inline-hint">One list, one lens, faster risk triage.</p></div>';
  html += '<div class="section-inline-stats"><span>' + stories.length + ' issues</span><span>' + blockerKeys.size + ' blockers</span><span>' + parentUnassigned + ' unowned</span></div>';
  html += '</div>';
  html += renderWorkRisksMerged(data);
  html += '<div class="stories-evidence-inline">Evidence: '
    + escapeHtml(Number(summary.subtaskLoggedHours || 0) > 0 ? 'logs healthy' : 'logs building')
    + ' · Capacity: ' + escapeHtml(capacitySummary?.label || 'watch') + '</div>';

  if (dailySeries.length > 0) {
    const dayKeysSet = new Set();
    dailySeries.forEach((row) => {
      if (!row || !row.date) return;
      try {
        const key = new Date(row.date).toISOString().slice(0, 10);
        if (key) dayKeysSet.add(key);
      } catch (_) {}
    });
    const dayKeys = Array.from(dayKeysSet).sort();
    if (dayKeys.length > 0) {
      html += '<div class="daily-completion-timeline" aria-label="Filter issues by completion day">';
      html += '<button type="button" class="daily-timeline-chip daily-timeline-chip-active" data-day-key="">All</button>';
      dayKeys.forEach((key) => {
        const label = formatDayLabel(key);
        html += '<button type="button" class="daily-timeline-chip" data-day-key="' + escapeHtml(key) + '"><span class="daily-timeline-chip-label">' + escapeHtml(label) + '</span></button>';
      });
      html += '</div>';
    }
  }

  function renderStoryRow(row) {
    const subtasks = Array.isArray(row.subtasks) ? row.subtasks : [];
    const parentKey = String(row.issueKey || row.key || '').toUpperCase();
    const completedDayKey = row && row.resolved ? new Date(row.resolved).toISOString().slice(0, 10) : '';
    const rowTags = [];
    const rowKey = String(row.issueKey || row.key || '').toUpperCase();
    if (blockerKeys.has(rowKey)) rowTags.push('blocker');
    if (scopeKeys.has(rowKey)) rowTags.push('scope');
    if (unownedOutcomeKeys.has(rowKey)) rowTags.push('unassigned');
    const outcomeLabels = Array.isArray(row.labels) ? row.labels : [];
    const isOutcome = isOutcomeStoryLike({ labels: outcomeLabels, epicKey: row.epicKey }) || hasOutcomeLabel(outcomeLabels);
    let rowHtml = '<tr class="story-parent-row" data-parent-key="' + escapeHtml(parentKey) + '"' + (subtasks.length ? ' data-has-children="true" aria-expanded="false"' : '') + '';
    if (completedDayKey) {
      rowHtml += ' data-completed-day="' + escapeHtml(completedDayKey) + '"';
    }
    if (rowTags.length) {
      rowHtml += ' data-risk-tags="' + escapeHtml(rowTags.join(' ')) + '"';
    }
    rowHtml += '>';
    rowHtml += '<td>';
    if (subtasks.length) {
      rowHtml += '<button type="button" class="story-row-toggle" aria-label="Expand subtasks" aria-expanded="false" title="Show subtasks">></button>';
    } else {
      rowHtml += '<span class="story-row-toggle story-row-toggle-placeholder" aria-hidden="true"></span>';
    }
    rowHtml += renderIssueKeyLink(row.issueKey || row.key, row.issueUrl) + '</td>';
    rowHtml += '<td>' + escapeHtml(row.issueType || '-') + '</td>';
    rowHtml += '<td class="cell-wrap">' + escapeHtml(row.summary || '-');
    if (isOutcome) {
      rowHtml += '<span class="story-row-flag">Outcome</span>';
    }
    if (subtasks.length) {
      rowHtml += '<div class="story-subtask-summary"><span class="story-subtask-count">' + subtasks.length + ' subtask' + (subtasks.length === 1 ? '' : 's') + '</span></div>';
    }
    rowHtml += '</td>';
    rowHtml += '<td>' + escapeHtml(row.status || '-') + '</td>';
    rowHtml += '<td>' + escapeHtml(row.reporter || '-') + '</td>';
    rowHtml += '<td>' + escapeHtml(row.assignee || '-') + '</td>';
    rowHtml += '<td>' + formatNumber(row.storyPoints ?? 0, 1, '-') + '</td>';
    rowHtml += '<td>' + formatNumber(row.subtaskEstimateHours ?? 0, 1, '-') + '</td>';
    rowHtml += '<td>' + formatNumber(row.subtaskLoggedHours ?? 0, 1, '-') + '</td>';
    rowHtml += '<td>' + escapeHtml(formatDate(row.created)) + '</td>';
    rowHtml += '<td>' + escapeHtml(formatDate(row.resolved)) + '</td>';
    rowHtml += '<td class="story-risks-cell">';
    if (rowTags.length) {
      rowTags.forEach((tag) => {
        const label = tag === 'blocker' ? 'Blocker' : (tag === 'scope' ? 'Scope' : (tag === 'unassigned' ? 'Unowned' : tag));
        rowHtml += '<span class="story-risk-pill story-risk-pill-' + escapeHtml(tag) + '">' + escapeHtml(label) + '</span>';
      });
    } else {
      rowHtml += '<span class="story-risk-pill-empty" aria-hidden="true">-</span>';
    }
    rowHtml += '</td>';
    rowHtml += '</tr>';
    return rowHtml;
  }

  function renderSubtaskRows(row) {
    const subtasks = Array.isArray(row.subtasks) ? row.subtasks : [];
    if (!subtasks.length) return '';
    let rowsHtml = '';
    const parentRowKey = String(row.issueKey || row.key || '').toUpperCase();
    for (const child of subtasks) {
      const owner = child.assignee || row.assignee || row.reporter || '-';
      const parentKey = child.parentIssueKey || row.issueKey || row.key || '-';
      const est = Number(child.estimateHours || 0);
      const log = Number(child.loggedHours || 0);
      const done = String(child.status || '').toLowerCase().includes('done');
      const rowFlags = [];
      if (est > 0 && !(log > 0)) rowFlags.push('flag-est-no-log');
      if (!(est > 0) && log > 0) rowFlags.push('flag-log-no-est');
      if (est > 0 && log > est) rowFlags.push('flag-overrun');
      if (done && !(log > 0)) rowFlags.push('flag-done-no-log');
      const flagBadges = [];
      if (est > 0 && !(log > 0)) flagBadges.push('Estimated, no log');
      if (!(est > 0) && log > 0) flagBadges.push('Logged, no estimate');
      if (est > 0 && log > est) flagBadges.push('Overrun');
      if (done && !(log > 0)) flagBadges.push('Done, no log');
      const completedDayKey = row && row.resolved ? new Date(row.resolved).toISOString().slice(0, 10) : '';
      const baseClasses = ['subtask-child-row'].concat(rowFlags).filter(Boolean).join(' ');
      const childTags = [];
      if (blockerKeys.has(String(parentKey).toUpperCase()) || blockerKeys.has(String(child.issueKey || '').toUpperCase())) childTags.push('blocker');
      if (scopeKeys.has(String(parentKey).toUpperCase())) childTags.push('scope');
      if (est > 0 && !(log > 0)) childTags.push('no-log');
      if (!(est > 0) && log > 0) childTags.push('missing-estimate');
      if (unownedOutcomeKeys.has(String(parentKey).toUpperCase())) childTags.push('unassigned');
      rowsHtml += '<tr class="' + baseClasses + '" data-parent-key="' + escapeHtml(parentRowKey) + '" hidden';
      if (completedDayKey) {
        rowsHtml += ' data-completed-day="' + escapeHtml(completedDayKey) + '"';
      }
      if (childTags.length) {
        rowsHtml += ' data-risk-tags="' + escapeHtml(Array.from(new Set(childTags)).join(' ')) + '"';
      }
      rowsHtml += '>';
      rowsHtml += '<td class="subtask-child-issue"><span class="subtask-parent-context" title="Parent issue">' + escapeHtml(parentKey) + '</span>' + renderIssueKeyLink(child.issueKey || '-', child.issueUrl) + '</td>';
      rowsHtml += '<td>' + escapeHtml(child.issueType || 'Sub-task') + '</td>';
      rowsHtml += '<td class="cell-wrap subtask-child-summary">' + escapeHtml(child.summary || '-');
      if (flagBadges.length > 0) {
        rowsHtml += '<div class="subtask-row-flags">' + flagBadges.map((f) => '<span class="subtask-row-flag">' + escapeHtml(f) + '</span>').join('') + '</div>';
      }
      rowsHtml += '</td>';
      rowsHtml += '<td>' + escapeHtml(child.status || '-') + '</td>';
      rowsHtml += '<td>-</td>';
      rowsHtml += '<td>' + escapeHtml(owner) + '</td>';
      rowsHtml += '<td>-</td>';
      rowsHtml += '<td>' + formatNumber(child.estimateHours ?? 0, 1, '-') + '</td>';
      rowsHtml += '<td>' + formatNumber(child.loggedHours ?? 0, 1, '-') + '</td>';
      rowsHtml += '<td>-</td>';
      rowsHtml += '<td>-</td>';
      rowsHtml += '<td class="story-risks-cell">-</td>';
      rowsHtml += '</tr>';
    }
    return rowsHtml;
  }

  function renderStoryMobileCard(row) {
    const subtasks = Array.isArray(row.subtasks) ? row.subtasks : [];
    const parentKey = String(row.issueKey || row.key || '').toUpperCase();
    const completedDayKey = row && row.resolved ? new Date(row.resolved).toISOString().slice(0, 10) : '';
    const rowTags = [];
    const rowKey = String(row.issueKey || row.key || '').toUpperCase();
    if (blockerKeys.has(rowKey)) rowTags.push('blocker');
    if (scopeKeys.has(rowKey)) rowTags.push('scope');
    if (unownedOutcomeKeys.has(rowKey)) rowTags.push('unassigned');
    if (Number(row.subtaskEstimateHours || 0) > 0 && !(Number(row.subtaskLoggedHours || 0) > 0)) rowTags.push('no-log');
    if (!(Number(row.subtaskEstimateHours || 0) > 0) && Number(row.subtaskLoggedHours || 0) > 0) rowTags.push('missing-estimate');
    const outcomeLabels = Array.isArray(row.labels) ? row.labels : [];
    const isOutcome = isOutcomeStoryLike({ labels: outcomeLabels, epicKey: row.epicKey }) || hasOutcomeLabel(outcomeLabels);
    const status = String(row.status || '-');
    const assignee = String(row.assignee || '-');
    const sp = formatNumber(row.storyPoints ?? 0, 1, '-');
    const est = formatNumber(row.subtaskEstimateHours ?? 0, 1, '-');
    const log = formatNumber(row.subtaskLoggedHours ?? 0, 1, '-');
    let htmlCard = '<article class="story-mobile-card" data-parent-key="' + escapeHtml(parentKey) + '"';
    if (completedDayKey) {
      htmlCard += ' data-completed-day="' + escapeHtml(completedDayKey) + '"';
    }
    if (rowTags.length) {
      htmlCard += ' data-risk-tags="' + escapeHtml(rowTags.join(' ')) + '"';
    }
    htmlCard += '>';
    htmlCard += '<button type="button" class="story-mobile-main" aria-expanded="false">';
    htmlCard += '<div class="story-mobile-head">';
    htmlCard += '<span class="story-mobile-key">' + renderIssueKeyLink(row.issueKey || row.key, row.issueUrl) + '</span>';
    htmlCard += '<span class="story-mobile-status">' + escapeHtml(status) + '</span>';
    htmlCard += '</div>';
    htmlCard += '<p class="story-mobile-summary">' + escapeHtml(row.summary || '-') + (isOutcome ? '<span class="story-row-flag">Outcome</span>' : '') + '</p>';
    htmlCard += '<div class="story-mobile-meta"><span>' + escapeHtml(assignee) + '</span><span>SP ' + sp + '</span><span>Log/Est ' + log + 'h/' + est + 'h</span></div>';
    if (rowTags.length) {
      htmlCard += '<div class="story-mobile-risk-chips">';
      rowTags.forEach((tag) => {
        const label = tag === 'blocker'
          ? 'Blocker'
          : (tag === 'scope'
            ? 'Scope'
            : (tag === 'unassigned'
              ? 'Unowned'
              : (tag === 'no-log' ? 'No log' : (tag === 'missing-estimate' ? 'No est' : tag))));
        htmlCard += '<span class="story-risk-pill story-risk-pill-' + escapeHtml(tag) + '">' + escapeHtml(label) + '</span>';
      });
      htmlCard += '</div>';
    }
    htmlCard += '</button>';
    htmlCard += '<div class="story-mobile-expand" hidden>';
    htmlCard += '<div class="story-mobile-detail-grid">';
    htmlCard += '<span><strong>Type:</strong> ' + escapeHtml(row.issueType || '-') + '</span>';
    htmlCard += '<span><strong>Reporter:</strong> ' + escapeHtml(row.reporter || '-') + '</span>';
    htmlCard += '<span><strong>Created:</strong> ' + escapeHtml(formatDate(row.created)) + '</span>';
    htmlCard += '<span><strong>Resolved:</strong> ' + escapeHtml(formatDate(row.resolved)) + '</span>';
    htmlCard += '</div>';
    if (subtasks.length) {
      htmlCard += '<ul class="story-mobile-subtasks">';
      for (const child of subtasks) {
        htmlCard += '<li>';
        htmlCard += '<span class="story-mobile-subtask-key">' + renderIssueKeyLink(child.issueKey || '-', child.issueUrl) + '</span>';
        htmlCard += '<span class="story-mobile-subtask-status">' + escapeHtml(child.status || '-') + '</span>';
        htmlCard += '<span class="story-mobile-subtask-hours">' + formatNumber(child.loggedHours ?? 0, 1, '-') + 'h / ' + formatNumber(child.estimateHours ?? 0, 1, '-') + 'h</span>';
        htmlCard += '</li>';
      }
      htmlCard += '</ul>';
    }
    htmlCard += '</div>';
    htmlCard += '</article>';
    return htmlCard;
  }

  if (!stories.length) {
    html += renderEmptyStateHtml('No work items', 'No work items in this sprint.', '');
  } else {
    // Prevent rendering all rows to avoid large initial DOM
    const initialLimit = resolveResponsiveRowLimit(10, 6);
    const toShow = stories.slice(0, initialLimit);
    const remaining = stories.slice(initialLimit);

    html += '<div class="data-table-scroll-wrap stories-table-scroll-wrap">';
    html += '<table class="data-table" id="stories-table"><thead><tr>'
      + '<th title="Issue key and expand subtasks">Issue</th>'
      + '<th>Type</th>'
      + '<th class="cell-wrap">Summary</th>'
      + '<th>Status</th>'
      + '<th>Reporter</th>'
      + '<th>Assignee</th>'
      + '<th title="Parent story points">Story Points</th>'
      + '<th title="Sum of subtask estimated hours">Est Hrs</th>'
      + '<th title="Sum of subtask logged hours">Logged Hrs</th>'
      + '<th>Created</th>'
      + '<th>Resolved</th>'
      + '<th title="Risk tags for this story">Risks</th>'
      + '</tr></thead><tbody>';
    for (const row of toShow) {
      html += renderStoryRow(row);
      html += renderSubtaskRows(row);
    }
    html += '</tbody></table>';
    html += '</div>';
    html += '<div class="stories-mobile-card-list" id="stories-mobile-card-list">';
    for (const row of toShow) {
      html += renderStoryMobileCard(row);
    }
    html += '</div>';

    if (remaining.length > 0) {
      html += '<button class="btn btn-secondary btn-compact stories-show-more" data-count="' + remaining.length + '">Show ' + remaining.length + ' more</button>';
      html += '<template id="stories-more-template">';
      for (const row of remaining) {
        html += renderStoryRow(row);
        html += renderSubtaskRows(row);
      }
      html += '</template>';
      html += '<template id="stories-mobile-more-template">';
      for (const row of remaining) {
        html += renderStoryMobileCard(row);
      }
      html += '</template>';
    }
  }
  html += '<p class="meta-row"><small>Edge rules: subtasks with logs but no estimates = unestimated effort; done subtasks with 0 logged = process gap; parent items can be active via subtask movement and are excluded from blocker count.</small></p>';
  html += '</div>';
  return html;
}

export function wireProgressShowMoreHandlers() {
  const storiesBtn = document.querySelector('.stories-show-more');
  if (storiesBtn && storiesBtn.dataset.wiredShowMore !== '1') {
    storiesBtn.dataset.wiredShowMore = '1';
    storiesBtn.addEventListener('click', () => {
      const tableTemplate = document.getElementById('stories-more-template');
      const mobileTemplate = document.getElementById('stories-mobile-more-template');
      const tbody = document.querySelector('#stories-table tbody');
      const mobileList = document.getElementById('stories-mobile-card-list');
      if (tableTemplate && tbody) {
        const frag = tableTemplate.content.cloneNode(true);
        tbody.appendChild(frag);
      }
      if (mobileTemplate && mobileList) {
        const frag = mobileTemplate.content.cloneNode(true);
        mobileList.appendChild(frag);
      }
      storiesBtn.remove();
    });
  }
  wireShowMoreHandler('.burndown-show-more', 'burndown-more-template', '#burndown-table tbody');
}

export function wireDailyCompletionTimelineHandlers() {
  try {
    const card = document.getElementById('stories-card');
    if (!card) return;
    const timeline = card.querySelector('.daily-completion-timeline');
    const chips = timeline ? Array.from(timeline.querySelectorAll('.daily-timeline-chip')) : [];
    const tableBody = card.querySelector('#stories-table tbody');
    const mobileCardsList = card.querySelector('#stories-mobile-card-list');
    if (!tableBody && !mobileCardsList) return;
    function getRows() {
      return tableBody ? Array.from(tableBody.querySelectorAll('tr')) : [];
    }
    function getMobileCards() {
      return mobileCardsList ? Array.from(mobileCardsList.querySelectorAll('.story-mobile-card')) : [];
    }
    const expandedStateKey = 'current_sprint_expanded_story_rows';
    const dayFilterStateKey = 'current_sprint_stories_day_filter';
    const storyFilterState = { activeRiskTags: [] };
    let expandedParents = new Set();
    try {
      const parsed = JSON.parse(window.localStorage.getItem(expandedStateKey) || '[]');
      if (Array.isArray(parsed)) expandedParents = new Set(parsed.map((v) => String(v || '').toUpperCase()).filter(Boolean));
    } catch (_) {}

    function persistExpandedState() {
      try {
        window.localStorage.setItem(expandedStateKey, JSON.stringify(Array.from(expandedParents)));
      } catch (_) {}
    }

    function getStoryRows() {
      return Array.from(tableBody.querySelectorAll('tr.story-parent-row'));
    }

    function syncParentChildren(parentRow) {
      if (!parentRow) return;
      const parentKey = String(parentRow.getAttribute('data-parent-key') || '').toUpperCase();
      if (!parentKey) return;
      const expanded = parentRow.getAttribute('aria-expanded') === 'true';
      const toggle = parentRow.querySelector('.story-row-toggle');
      if (toggle) {
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        toggle.textContent = expanded ? 'v' : '>';
        toggle.setAttribute('aria-label', expanded ? 'Collapse subtasks' : 'Expand subtasks');
        toggle.title = expanded ? 'Hide subtasks' : 'Show subtasks';
      }
      if (tableBody) {
        const childRows = tableBody.querySelectorAll('tr.subtask-child-row[data-parent-key="' + parentKey + '"]');
        childRows.forEach((row) => {
          if (expanded) row.removeAttribute('hidden');
          else row.setAttribute('hidden', 'hidden');
        });
      }
      parentRow.classList.toggle('story-parent-row-expanded', expanded);
    }

    function initializeStoryHierarchy() {
      getStoryRows().forEach((parentRow) => {
        const parentKey = String(parentRow.getAttribute('data-parent-key') || '').toUpperCase();
        if (!parentRow.hasAttribute('data-has-children')) return;
        const shouldExpand = expandedParents.has(parentKey);
        parentRow.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
        syncParentChildren(parentRow);
      });
    }

    function initializeMobileCards() {
      getMobileCards().forEach((cardEl) => {
        const parentKey = String(cardEl.getAttribute('data-parent-key') || '').toUpperCase();
        const mainBtn = cardEl.querySelector('.story-mobile-main');
        const expandEl = cardEl.querySelector('.story-mobile-expand');
        const shouldExpand = expandedParents.has(parentKey);
        if (mainBtn) mainBtn.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
        if (expandEl) expandEl.hidden = !shouldExpand;
        cardEl.classList.toggle('story-mobile-card-expanded', shouldExpand);
      });
    }

    function applyDayFilter(dayKey) {
      const keyNorm = (dayKey || '').trim();
      chips.forEach((chip) => {
        const chipKey = (chip.getAttribute('data-day-key') || '').trim();
        chip.classList.toggle('daily-timeline-chip-active', chipKey === keyNorm);
      });
      getRows().forEach((row) => {
        const rowKey = (row.getAttribute('data-completed-day') || '').trim();
        const show = !keyNorm || (rowKey && rowKey === keyNorm);
        row.style.display = show ? '' : 'none';
      });
      getMobileCards().forEach((cardEl) => {
        const rowKey = (cardEl.getAttribute('data-completed-day') || '').trim();
        const show = !keyNorm || (rowKey && rowKey === keyNorm);
        cardEl.style.display = show ? '' : 'none';
      });
      initializeStoryHierarchy();
      initializeMobileCards();
      try {
        window.localStorage.setItem(dayFilterStateKey, keyNorm);
      } catch (_) {}
      try {
        window.dispatchEvent(new CustomEvent('currentSprint:storiesDayFilterChanged', { detail: { dayKey: keyNorm } }));
      } catch (_) {}
    }

    if (timeline && chips.length) {
      timeline.addEventListener('click', (event) => {
        const chip = event.target.closest('.daily-timeline-chip');
        if (!chip || !timeline.contains(chip)) return;
        const dayKey = chip.getAttribute('data-day-key') || '';
        applyDayFilter(dayKey);
        try {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_) {}
      });
    }

    card.addEventListener('click', (event) => {
      const riskChip = event.target.closest('.stories-risk-chip, .subtask-chip[data-risk-tags]');
      if (riskChip && card.contains(riskChip)) {
        event.preventDefault();
        const tagsAttr = (riskChip.getAttribute('data-risk-tags') || '').trim();
        const riskTags = tagsAttr ? tagsAttr.split(/\s+/).filter(Boolean) : [];
        try {
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags, source: 'stories-risk-bar' } }));
        } catch (_) {}
      }
    });

    card.addEventListener('click', (event) => {
      const toggle = event.target.closest('.story-row-toggle');
      if (!toggle || !card.contains(toggle) || toggle.classList.contains('story-row-toggle-placeholder')) return;
      const parentRow = toggle.closest('tr.story-parent-row');
      if (!parentRow) return;
      const parentKey = String(parentRow.getAttribute('data-parent-key') || '').toUpperCase();
      const next = parentRow.getAttribute('aria-expanded') !== 'true';
      parentRow.setAttribute('aria-expanded', next ? 'true' : 'false');
      if (next) expandedParents.add(parentKey);
      else expandedParents.delete(parentKey);
      persistExpandedState();
      syncParentChildren(parentRow);
      initializeMobileCards();
    });

    card.addEventListener('click', (event) => {
      const mobileBtn = event.target.closest('.story-mobile-main');
      if (!mobileBtn || !card.contains(mobileBtn)) return;
      const cardEl = mobileBtn.closest('.story-mobile-card');
      if (!cardEl) return;
      const parentKey = String(cardEl.getAttribute('data-parent-key') || '').toUpperCase();
      const next = mobileBtn.getAttribute('aria-expanded') !== 'true';
      mobileBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
      const expandEl = cardEl.querySelector('.story-mobile-expand');
      if (expandEl) expandEl.hidden = !next;
      cardEl.classList.toggle('story-mobile-card-expanded', next);
      if (next) expandedParents.add(parentKey);
      else expandedParents.delete(parentKey);
      persistExpandedState();
      const parentRow = tableBody ? tableBody.querySelector('tr.story-parent-row[data-parent-key="' + parentKey + '"]') : null;
      if (parentRow) {
        parentRow.setAttribute('aria-expanded', next ? 'true' : 'false');
        syncParentChildren(parentRow);
      }
    });

    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const toggle = event.target.closest('.story-row-toggle');
      if (!toggle || !card.contains(toggle)) return;
      event.preventDefault();
      toggle.click();
    });

    try {
      window.addEventListener('currentSprint:focusStoriesEvidence', () => {
        card.classList.add('row-attention-pulse');
        window.setTimeout(() => card.classList.remove('row-attention-pulse'), 1200);
      });
    } catch (_) {}

    if (!window.__currentSprintStoriesRiskFilterBound) {
      window.__currentSprintStoriesRiskFilterBound = true;
      window.addEventListener('currentSprint:applyWorkRiskFilter', (event) => {
        const detail = event && event.detail ? event.detail : {};
        const activeTags = Array.isArray(detail.riskTags)
          ? detail.riskTags.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean)
          : [];
        storyFilterState.activeRiskTags = activeTags;
        getRows().forEach((row) => {
          if (!activeTags.length) {
            row.removeAttribute('data-role-filter-hidden');
            row.style.opacity = '';
            return;
          }
          const tags = (row.getAttribute('data-risk-tags') || '').toLowerCase().split(/\s+/).filter(Boolean);
          const matches = activeTags.some((tag) => tags.includes(tag));
          const isParent = row.classList.contains('story-parent-row');
          if (isParent) {
            row.toggleAttribute('data-role-filter-hidden', !matches);
          } else {
            row.toggleAttribute('data-role-filter-hidden', !matches);
          }
          row.style.opacity = matches ? '' : '0.35';
        });
        getMobileCards().forEach((cardEl) => {
          if (!activeTags.length) {
            cardEl.removeAttribute('data-role-filter-hidden');
            cardEl.style.opacity = '';
            return;
          }
          const tags = (cardEl.getAttribute('data-risk-tags') || '').toLowerCase().split(/\s+/).filter(Boolean);
          const matches = activeTags.some((tag) => tags.includes(tag));
          cardEl.toggleAttribute('data-role-filter-hidden', !matches);
          cardEl.style.opacity = matches ? '' : '0.35';
        });
        initializeStoryHierarchy();
        initializeMobileCards();
      });
    }
    const storiesShowMore = card.querySelector('.stories-show-more');
    if (storiesShowMore) {
      storiesShowMore.addEventListener('click', () => {
        window.setTimeout(() => {
          initializeStoryHierarchy();
          try {
            window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags: storyFilterState.activeRiskTags, source: 'stories-show-more' } }));
          } catch (_) {}
          const activeChip = chips.find((chip) => chip.classList.contains('daily-timeline-chip-active'));
          if (activeChip) applyDayFilter(activeChip.getAttribute('data-day-key') || '');
          else {
            try {
              const storedDay = window.localStorage.getItem(dayFilterStateKey) || '';
              if (storedDay) applyDayFilter(storedDay);
            } catch (_) {}
          }
        }, 0);
      });
    }
    try {
      const storedDay = window.localStorage.getItem(dayFilterStateKey) || '';
      if (storedDay && chips.some((chip) => (chip.getAttribute('data-day-key') || '') === storedDay)) {
        applyDayFilter(storedDay);
      }
    } catch (_) {}
    initializeStoryHierarchy();
    initializeMobileCards();
  } catch (_) {}
}
