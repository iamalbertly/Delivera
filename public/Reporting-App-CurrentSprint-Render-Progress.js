import { escapeHtml, renderIssueKeyLink } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDate, formatDayLabel, formatNumber } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { renderEmptyStateHtml } from './Reporting-App-Shared-Empty-State-Helpers.js';
import { resolveResponsiveRowLimit } from './Reporting-App-Shared-Responsive-Helpers.js';
import { wireShowMoreHandler } from './Reporting-App-Shared-ShowMore-Handlers.js';
import { buildDataTableHtml } from './Reporting-App-Shared-Table-Renderer.js';

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

export function renderDailyCompletion(data) {
  const daily = data.dailyCompletions || { stories: [], subtasks: [] };
  let html = '<div class="transparency-card" id="daily-completion-card">';
  html += '<h2>Daily completion</h2>';
  if (!daily.stories || daily.stories.length === 0) {
    html += '<p>No work item completions by day in this sprint yet.</p>';
  } else {
    const dailyColumns = [
      { key: 'date', label: 'Date', title: '', renderer: (r) => formatDayLabel(r.date) },
      { key: 'count', label: 'Items', title: '' },
      { key: 'spCompleted', label: 'SP completed', title: '', renderer: (r) => formatNumber(r.spCompleted ?? 0, 1, '-') },
      { key: 'nps', label: 'NPS', title: '', renderer: (r) => (r.nps == null ? '-' : formatNumber(r.nps, 1, '-')) },
    ];
    html += buildDataTableHtml(dailyColumns, daily.stories);
  }
  html += '</div>';
  return html;
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
    return '<div class="transparency-card" id="burndown-card"><h2>Burndown</h2><p class="meta-row"><small>Burndown will appear when story points and resolutions are available.</small></p></div>';
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
    html += '<h2>Burndown</h2>';
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
    return '<div class="transparency-card" id="burndown-card"><h2>Burndown</h2><p class="burndown-status-card">' + escapeHtml(message) + '</p></div>';
  }

  const sprintJustStarted = remaining.length <= 2 && doneSP === 0;
  const noWorkDone = doneSP === 0;
  const burstDelivery = remaining.length >= 2 && doneSP > 0 && lastRemaining === 0 && (remaining[remaining.length - 2].remainingSP || 0) > 0;

  let html = '<div class="transparency-card" id="burndown-card">';
  html += '<h2>Burndown</h2>';

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
  const planned = data.plannedWindow || {};
  let html = '<div class="transparency-card" id="stories-card">';
  html += '<div class="stories-dom-guardrail" data-story-count="' + stories.length + '" aria-hidden="true"></div>';
  html += '<h2>Issues in this sprint</h2>';
  html += '<p class="meta-row"><span>Planned:</span> <strong>' + formatDate(planned.start) + ' - ' + formatDate(planned.end) + '</strong></p>';
  html += '<p class="meta-row"><small>Type guide: Parent issues carry outcome fields (story points, ownership). Sub-tasks are shown as child rows focused on time tracking.</small></p>';

  function renderStoryRow(row) {
    let rowHtml = '<tr class="story-parent-row">';
    rowHtml += '<td>' + renderIssueKeyLink(row.issueKey || row.key, row.issueUrl) + '</td>';
    rowHtml += '<td>' + escapeHtml(row.issueType || '-') + '</td>';
    rowHtml += '<td class="cell-wrap">' + escapeHtml(row.summary || '-') + '</td>';
    rowHtml += '<td>' + escapeHtml(row.status || '-') + '</td>';
    rowHtml += '<td>' + escapeHtml(row.reporter || '-') + '</td>';
    rowHtml += '<td>' + escapeHtml(row.assignee || '-') + '</td>';
    rowHtml += '<td>' + formatNumber(row.storyPoints ?? 0, 1, '-') + '</td>';
    rowHtml += '<td>' + formatNumber(row.subtaskEstimateHours ?? 0, 1, '-') + '</td>';
    rowHtml += '<td>' + formatNumber(row.subtaskLoggedHours ?? 0, 1, '-') + '</td>';
    rowHtml += '<td>' + escapeHtml(formatDate(row.created)) + '</td>';
    rowHtml += '<td>' + escapeHtml(formatDate(row.resolved)) + '</td>';
    rowHtml += '</tr>';
    return rowHtml;
  }

  function renderSubtaskRows(row) {
    const subtasks = Array.isArray(row.subtasks) ? row.subtasks : [];
    if (!subtasks.length) return '';
    let rowsHtml = '';
    for (const child of subtasks) {
      const owner = child.assignee || row.assignee || row.reporter || '-';
      const parentKey = child.parentIssueKey || row.issueKey || row.key || '-';
      rowsHtml += '<tr class="subtask-child-row">';
      rowsHtml += '<td class="subtask-child-issue"><span class="subtask-parent-context" title="Parent issue">' + escapeHtml(parentKey) + '</span>' + renderIssueKeyLink(child.issueKey || '-', child.issueUrl) + '</td>';
      rowsHtml += '<td>' + escapeHtml(child.issueType || 'Sub-task') + '</td>';
      rowsHtml += '<td class="cell-wrap subtask-child-summary">' + escapeHtml(child.summary || '-') + '</td>';
      rowsHtml += '<td>' + escapeHtml(child.status || '-') + '</td>';
      rowsHtml += '<td>-</td>';
      rowsHtml += '<td>' + escapeHtml(owner) + '</td>';
      rowsHtml += '<td>-</td>';
      rowsHtml += '<td>' + formatNumber(child.estimateHours ?? 0, 1, '-') + '</td>';
      rowsHtml += '<td>' + formatNumber(child.loggedHours ?? 0, 1, '-') + '</td>';
      rowsHtml += '<td>-</td>';
      rowsHtml += '<td>-</td>';
      rowsHtml += '</tr>';
    }
    return rowsHtml;
  }

  if (!stories.length) {
    html += renderEmptyStateHtml('No work items', 'No work items in this sprint.', '');
  } else {
    // Prevent rendering all rows to avoid large initial DOM
    const initialLimit = resolveResponsiveRowLimit(10, 6);
    const toShow = stories.slice(0, initialLimit);
    const remaining = stories.slice(initialLimit);

    html += '<div class="data-table-scroll-wrap">';
    html += '<table class="data-table" id="stories-table"><thead><tr><th>Issue</th><th>Type</th><th class="cell-wrap">Summary</th><th>Status</th><th>Reporter</th><th>Assignee</th><th>Story Points</th><th>Subtask Est Hrs</th><th>Subtask Logged Hrs</th><th>Created</th><th>Resolved</th></tr></thead><tbody>';
    for (const row of toShow) {
      html += renderStoryRow(row);
      html += renderSubtaskRows(row);
    }
    html += '</tbody></table>';
    html += '</div>';

    if (remaining.length > 0) {
      html += '<button class="btn btn-secondary btn-compact stories-show-more" data-count="' + remaining.length + '">Show ' + remaining.length + ' more</button>';
      html += '<template id="stories-more-template">';
      for (const row of remaining) {
        html += renderStoryRow(row);
        html += renderSubtaskRows(row);
      }
      html += '</template>';
    }
  }
  html += '</div>';
  return html;
}

export function wireProgressShowMoreHandlers() {
  wireShowMoreHandler('.stories-show-more', 'stories-more-template', '#stories-table tbody');
  wireShowMoreHandler('.burndown-show-more', 'burndown-more-template', '#burndown-table tbody');
}
