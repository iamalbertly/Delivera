import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { formatDayLabel, formatNumber } from './Delivera-Shared-Format-DateNumber-Helpers.js';
import { deriveSprintVerdict } from './Delivera-CurrentSprint-Alert-Banner.js';
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
  const remainingDays = daysMeta.daysRemainingWorking != null ? daysMeta.daysRemainingWorking : daysMeta.daysRemainingCalendar;
  const summary = data.summary || {};
  const summaryTotalSP = Number(summary.totalSP || 0);
  const summaryTotalAllSP = Number(summary.totalAllSP || 0);
  const completedAfterEnd = Number(summary.completedAfterSprintEndCount || 0);
  const hasMultiSpFields = Array.isArray(summary.storyPointsFieldCandidates) && summary.storyPointsFieldCandidates.length > 1;
  const verdictInfo = deriveSprintVerdict(data);
  const sprintState = String(data?.sprint?.state || '').toLowerCase();
  const collapseBurndown = sprintState !== 'active' || verdictInfo.trackingHealth === 'Weak';

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
  html += '<div class="section-inline-header section-inline-header-compact">';
  html += '<div><h2>Flow over time</h2></div>';
  html += '<div class="section-inline-stats">';
  html += '<span>SP complete ' + formatNumber(doneSP, 1, '-') + '</span>';
  html += '<span>SP remaining ' + formatNumber(lastRemaining, 1, '-') + '</span>';
  if (remainingDays != null) html += '<span>' + escapeHtml(getTimeLabel(remainingDays, sprintEnded)) + '</span>';
  html += '</div>';
  html += '</div>';

  if (sprintJustStarted) {
    html += '<p class="burndown-status-card burndown-status-info">Sprint just started. Burndown will update as work is completed.</p>';
  } else if (noWorkDone && remaining.length > 2) {
    html += '<div class="burndown-status-card burndown-status-empty">';
    html += '<p><strong>No story points completed.</strong> ' + formatNumber(lastRemaining, 1, '-') + ' SP remaining.' + (sprintEnded ? ' Sprint ended.' : '') + '</p>';
    html += '<a href="#stories-card" class="btn btn-secondary btn-compact">View work items</a>';
    html += '</div>';
  } else {
    html += '<p class="burndown-metric-inline"><strong>' + pct + '%</strong> complete</p>';
    const health = burndownHealth(remaining, ideal, totalSP);
    if (health.label) html += '<p class="burndown-health ' + health.class + '"><span class="burndown-health-label">' + escapeHtml(health.label) + '</span></p>';
    if (hasMultiSpFields) {
      html += '<p class="burndown-annotation"><small>Multiple Jira story point fields exist; this burndown uses the primary field only. If numbers look off for some projects, align on a single story-points field.</small></p>';
    }
    if (completedAfterEnd > 0) {
      html += '<p class="burndown-annotation"><small>' + escapeHtml(String(completedAfterEnd)) + ' stor' + (completedAfterEnd === 1 ? 'y' : 'ies') + ' completed after sprint end; burndown shows sprint-only completion.</small></p>';
    }
    if (burstDelivery) html += '<p class="burndown-annotation"><small>Burst delivery: work completed on final day.</small></p>';
    if (collapseBurndown) {
      html += '<details class="burndown-summary-drawer" data-mobile-collapse="true">';
      html += '<summary class="btn btn-secondary btn-compact">Open flow details</summary>';
      html += buildBurndownChart(remaining, ideal, 'Remaining SP');
      html += '</details>';
    } else {
      html += buildBurndownChart(remaining, ideal, 'Remaining SP');
    }
  }

  html += '<details class="burndown-details-drawer"' + (collapseBurndown ? '' : '') + '>';
  html += '<summary class="btn btn-secondary btn-compact">View burndown table</summary>';
  html += '<table class="data-table" id="burndown-table">';
  html += '<thead><tr><th>Date</th><th>Remaining SP</th><th>Ideal Remaining</th></tr></thead><tbody>';
  for (let i = 0; i < remaining.length; i++) {
      const row = remaining[i];
      const idealRow = ideal[i] || ideal[ideal.length - 1] || {};
      html += '<tr>';
      html += '<td>' + escapeHtml(formatDayLabel(row.date)) + '</td>';
      html += '<td>' + formatNumber(row.remainingSP ?? 0, 1, '-') + '</td>';
      html += '<td>' + formatNumber(idealRow.remainingSP ?? 0, 1, '-') + '</td>';
      html += '</tr>';
  }
  html += '</tbody></table>';
  html += '</details>';

  html += '</div>';
  return html;
}

function getTimeLabel(remainingDays, sprintEnded) {
  if (remainingDays == null) return 'Window unknown';
  if (sprintEnded || remainingDays <= 0) return 'Ended';
  if (remainingDays < 1) return 'Ends today';
  return remainingDays + 'd left';
}