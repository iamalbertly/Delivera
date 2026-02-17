import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatNumber, formatDateShort, parseISO, addMonths } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { renderEmptyStateHtml } from './Reporting-App-Shared-Empty-State-Helpers.js';
import { buildDataTableHtml } from './Reporting-App-Shared-Table-Renderer.js';
import { deriveDeliveryGrade, DELIVERY_GRADE_TOOLTIP } from './Reporting-App-Report-Page-Render-Boards-Summary-Helpers.js';
import { buildActiveFiltersContextLabel } from './Reporting-App-Shared-Context-From-Storage.js';

function computeVelocityWindowStats(sprints, windowEnd, months) {
  const end = parseISO(windowEnd);
  if (!end) return null;
  const start = addMonths(end, -months);
  const closed = sprints.filter(s => (s.state || '').toLowerCase() === 'closed');
  const inWindow = closed.filter(s => {
    const endDate = parseISO(s.endDate);
    return endDate && endDate >= start && endDate <= end;
  });
  const totalSP = inWindow.reduce((sum, s) => sum + (s.doneSP || 0), 0);
  const totalDays = inWindow.reduce((sum, s) => sum + (s.sprintWorkDays || 0), 0);
  const avg = totalDays > 0 ? totalSP / totalDays : null;
  const doneStories = inWindow.reduce((sum, s) => sum + (s.doneStoriesNow || 0), 0);
  const doneByEnd = inWindow.reduce((sum, s) => sum + (s.doneStoriesBySprintEnd || 0), 0);
  const onTimePct = doneStories > 0 ? (doneByEnd / doneStories) * 100 : null;
  return { avg, sprintCount: inWindow.length, onTimePct, inWindow };
}

function computePredictabilityAverage(perSprint, inWindow) {
  if (!perSprint || !inWindow || inWindow.length === 0) return null;
  const values = inWindow
    .map(s => perSprint[s.id]?.predictabilitySP)
    .filter(v => v != null && !Number.isNaN(v));
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function gradeFromSignals(onTimePct, predictabilityPct, sprintCount = 0) {
  if (onTimePct == null || Number.isNaN(onTimePct)) return 'Insufficient data';
  const predictability = predictabilityPct == null || Number.isNaN(predictabilityPct)
    ? onTimePct
    : predictabilityPct;
  return deriveDeliveryGrade(onTimePct, predictability, sprintCount);
}

export function renderLeadershipPage(data) {
  const boards = data.boards || [];
  const meta = data.meta || {};
  const metrics = data.metrics || {};
  const predictability = metrics.predictability || {};
  const perSprint = predictability.perSprint || {};
  const sprintsIncluded = data.sprintsIncluded || [];
  const windowEnd = meta.windowEnd || new Date().toISOString();
  const windowEndDate = parseISO(windowEnd) || new Date();
  const windowEndIso = windowEndDate.toISOString();

  const rangeStart = meta.windowStart ? formatDateShort(meta.windowStart) : '-';
  const rangeEnd = meta.windowEnd ? formatDateShort(meta.windowEnd) : '-';
  const rangeTooltip = 'Completion anchored to resolution date. Indexed Delivery = current SP/day vs own baseline (last 6 closed sprints). Use for trend visibility, not performance ranking.';
  const rangeStartAttr = meta.windowStart ? formatDateShort(meta.windowStart) : '';
  const rangeEndAttr = meta.windowEnd ? formatDateShort(meta.windowEnd) : '';
  const projectsAttr = (meta.projects || '').replace(/,/g, '-').replace(/\s+/g, '') || '';
  const projectsLabel = (meta.projects || '')
    .split(',')
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ');
  let html = '<div class="leadership-context-sticky">';
  html += '<div class="leadership-meta-attrs" aria-hidden="true" data-range-start="' + escapeHtml(rangeStartAttr) + '" data-range-end="' + escapeHtml(rangeEndAttr) + '" data-projects="' + escapeHtml(projectsAttr) + '"></div>';
  html += '<p class="metrics-hint leadership-context-line">';
  const activeFiltersLine = buildActiveFiltersContextLabel(projectsLabel || '-', meta.windowStart, meta.windowEnd);
  html += '<span class="leadership-range-hint" title="' + escapeHtml(rangeTooltip) + '">' + escapeHtml(activeFiltersLine) + '</span>';
  html += ' <span class="leadership-trust-hint">For trend visibility, not team ranking.</span>';
  html += '</p>';

  let outcomeLine = '';
  if (boards.length > 0) {
    const summaries = data.boardSummaries || new Map();
    let onTime80Plus = 0;
    let needAttention = 0;
    let totalDoneSP = 0;
    let totalRegisteredHours = 0;
    let totalEstimatedHours = 0;
    let minSprintCount = null;
    for (const board of boards) {
      const summary = summaries.get(board.id);
      const doneStories = summary?.doneStories || 0;
      const doneByEnd = summary?.doneBySprintEnd || 0;
      totalDoneSP += Number(summary?.doneSP || 0);
      totalRegisteredHours += Number(summary?.registeredWorkHours || 0);
      totalEstimatedHours += Number(summary?.estimatedWorkHours || 0);
      const onTimePct = doneStories > 0 ? (doneByEnd / doneStories) * 100 : null;
      if (onTimePct != null && onTimePct >= 80) onTime80Plus++;
      if (onTimePct == null || onTimePct < 80) needAttention++;
      const sprintCount = summary?.sprintCount;
      if (typeof sprintCount === 'number') {
        minSprintCount = minSprintCount == null ? sprintCount : Math.min(minSprintCount, sprintCount);
      }
    }
    outcomeLine = boards.length + ' boards | ' + onTime80Plus + ' on-time >=80% | ' + needAttention + ' need attention.';
    if (totalRegisteredHours > 0) {
      const spPerHour = totalDoneSP > 0 ? (totalDoneSP / totalRegisteredHours) : 0;
      outcomeLine += ' | ' + formatNumber(totalDoneSP, 0, '0') + ' SP delivered from ' + formatNumber(totalRegisteredHours, 0, '0') + 'h logged (' + formatNumber(spPerHour, 2, '0') + ' SP/h).';
    }
    if (totalEstimatedHours > 0 && totalRegisteredHours >= 0) {
      const hygienePct = Math.max(0, Math.min(999, (totalRegisteredHours / totalEstimatedHours) * 100));
      if (hygienePct < 60) {
        outcomeLine += ' | Time-tracking hygiene low: logged vs estimated ' + formatNumber(hygienePct, 0, '0') + '%.';
      }
    }
    if (minSprintCount != null && minSprintCount < 3) {
      outcomeLine += ' | Limited history on at least one board (<3 sprints).';
    }
    const recent3 = computeVelocityWindowStats(sprintsIncluded, windowEndIso, 3);
    const previous3End = addMonths(windowEndDate, -3).toISOString();
    const previous3 = computeVelocityWindowStats(sprintsIncluded, previous3End, 3);
    if (recent3?.avg != null && previous3?.avg != null && previous3.avg > 0) {
      const diffPct = ((recent3.avg - previous3.avg) / previous3.avg) * 100;
      const trendLabel = diffPct <= -10 ? 'velocity down' : (diffPct >= 10 ? 'velocity up' : 'velocity stable');
      outcomeLine += ' | 3-month trend: ' + trendLabel + ' (' + formatNumber(diffPct, 1, '0') + '%).';
    }
  }
  if (outcomeLine) {
    html += '<p class="leadership-outcome-line" aria-live="polite">' + escapeHtml(outcomeLine) + '</p>';
  }
  html += '</div>';

  html += '<div class="leadership-card">';
  html += '<div class="leadership-card-header">';
  html += '<h2>Boards - normalized delivery</h2>';
  html += '<p class="leadership-delivery-hint"><small>Delivery % adjusted for scope changes. Use this for within-board trends, not ranking teams.</small></p>';
  html += '<div class="leadership-view-actions">';
  html += '<button type="button" class="btn btn-secondary btn-compact active" data-leadership-view="cards" aria-pressed="true">Cards</button>';
  html += '<button type="button" class="btn btn-secondary btn-compact" data-leadership-view="table" aria-pressed="false">Table</button>';
  html += '<div class="leadership-export-wrap"><button type="button" class="btn btn-secondary btn-compact" data-action="export-leadership-boards-csv" title="Export boards table to CSV">Export CSV</button></div>';
  html += '</div>';
  html += '</div>';
  if (boards.length === 0) {
    const hint = 'Change projects above or open Report to check project configuration.';
    html += renderEmptyStateHtml(
      'No boards in this project set',
      'No boards were returned for the selected projects and date range.',
      hint,
      'Open Report',
      { href: '/report' }
    );
  } else {
    const summaries = data.boardSummaries || new Map();
    let allStrong = boards.length > 0;
    const boardCards = [];
    for (const board of boards) {
      const summary = summaries.get(board.id);
      const onTimePct = summary?.doneStories > 0 ? ((summary.doneBySprintEnd || 0) / summary.doneStories * 100) : null;
      const sprintCount = summary?.sprintCount ?? 0;
      const grade = gradeFromSignals(onTimePct ?? null, null, sprintCount);
      if (grade !== 'Strong') allStrong = false;
      boardCards.push({ board, summary, onTimePct, grade, sprintCount, hasLimitedHistory: sprintCount < 2 });
    }
    if (allStrong && boards.length > 0) {
      html += '<p class="leadership-all-strong">All boards delivering on track.</p>';
    }
    const sufficientCards = boardCards.filter(c => !c.hasLimitedHistory);
    const limitedCards = boardCards.filter(c => c.hasLimitedHistory);
    html += '<div id="leadership-boards-cards" class="leadership-boards-cards" role="region" aria-label="Boards overview">';
    for (const card of sufficientCards) {
      const onTimeStr = card.onTimePct != null ? card.onTimePct.toFixed(0) + '%' : '-';
      const gradeClass = (card.grade || '').toLowerCase().replace(/\s+/g, '-');
      html += '<div class="leadership-board-card">';
      html += '<div class="leadership-board-card-grade ' + gradeClass + '">' + escapeHtml(card.grade || '-') + '</div>';
      html += '<div class="leadership-board-card-name">' + escapeHtml(card.board.name) + '</div>';
      html += '<div class="leadership-board-card-metric">On-time ' + onTimeStr + '</div>';
      html += '</div>';
    }
    html += '</div>';
    if (limitedCards.length > 0) {
      if (sufficientCards.length === 0) {
        html += '<div class="leadership-all-limited-empty">';
        html += '<p>Trend analysis requires 3+ completed sprints. Your boards are building history - check back next sprint.</p>';
        html += '</div>';
        html += '<div id="leadership-limited-cards" class="leadership-boards-cards leadership-limited-cards">';
      } else {
        html += '<div class="leadership-limited-toggle-wrap">';
        html += '<button type="button" class="btn btn-secondary btn-compact" data-action="toggle-limited-boards" aria-expanded="false">' + limitedCards.length + ' board' + (limitedCards.length !== 1 ? 's' : '') + ' hidden (insufficient data) - Show all</button>';
        html += '</div>';
        html += '<div id="leadership-limited-cards" class="leadership-boards-cards leadership-limited-cards" hidden>';
      }
      for (const card of limitedCards) {
        const onTimeStr = card.onTimePct != null ? card.onTimePct.toFixed(0) + '%' : '-';
        const gradeClass = (card.grade || '').toLowerCase().replace(/\s+/g, '-');
        html += '<div class="leadership-board-card leadership-board-card--limited">';
        html += '<div class="leadership-board-card-grade ' + gradeClass + '">' + escapeHtml(card.grade || '-') + '</div>';
        html += '<div class="leadership-board-card-name">' + escapeHtml(card.board.name) + '</div>';
        html += '<div class="leadership-board-card-metric">On-time ' + onTimeStr + '</div>';
        html += '<div class="leadership-board-card-note">Needs 3+ sprints for trends</div>';
        html += '</div>';
      }
      html += '</div>';
    }
    html += '<div id="leadership-boards-table-wrap" class="leadership-boards-table-wrap" hidden>';
    html += '<div id="leadership-sort-label" class="leadership-sort-label" aria-live="polite"></div>';
    html += '<div class="data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit"><table class="data-table data-table--mobile-scroll leadership-boards-table"><thead><tr>';
    html += '<th class="sortable" data-sort="board" scope="col">Board</th>';
    html += '<th class="sortable" data-sort="projects" scope="col">Projects</th>';
    html += '<th class="sortable" data-sort="sprints" scope="col">Sprints</th>';
    html += '<th class="sortable" data-sort="doneStories" scope="col">Done Stories</th>';
    html += '<th class="sortable" data-sort="doneSP" scope="col">Done SP</th>';
    html += '<th class="sortable" data-sort="spPerDay" scope="col">SP / Day</th>';
    html += '<th class="sortable" data-sort="storiesPerDay" scope="col">Stories / Day</th>';
    html += '<th class="sortable" data-sort="indexedDelivery" scope="col" title="Current SP/day vs this board\'s baseline (last 6 sprints).">Indexed Delivery</th>';
    html += '<th class="sortable" data-sort="onTime" scope="col">On-time %</th>';
    html += '</tr></thead><tbody>';
    for (const board of boards) {
      const summary = (data.boardSummaries || new Map()).get(board.id);
      const totalSprintDays = summary?.totalSprintDays || 0;
      const doneStories = summary?.doneStories || 0;
      const doneSP = summary?.doneSP || 0;
      const spPerDay = totalSprintDays > 0 ? doneSP / totalSprintDays : null;
      const storiesPerDay = totalSprintDays > 0 ? doneStories / totalSprintDays : null;
      const idx = board.indexedDelivery;
      const indexStr = idx != null && idx.index != null ? formatNumber(idx.index, 2, '-') : '-';
      const onTimePct = summary?.doneStories > 0
        ? ((summary.doneBySprintEnd || 0) / summary.doneStories * 100)
        : null;
      const onTime = onTimePct != null ? onTimePct.toFixed(1) + '%' : '-';
      const sprintCount = summary?.sprintCount ?? '-';
      const isRiskRow = onTimePct != null && onTimePct < 80;
      const hasLimitedHistory = typeof sprintCount === 'number' && sprintCount < 2;
      const rowClass = isRiskRow ? ' class="leadership-board-row leadership-board-row--risk"' : ' class="leadership-board-row"';
      html += '<tr' + rowClass + '>';
      html += '<td>' + escapeHtml(board.name);
      if (hasLimitedHistory) {
        html += ' <span class="limited-history-note">(Limited history)</span>';
      }
      html += '</td>';
      html += '<td>' + escapeHtml((board.projectKeys || []).join(', ')) + '</td>';
      html += '<td>' + sprintCount + '</td>';
      html += '<td>' + doneStories + '</td>';
      html += '<td>' + doneSP + '</td>';
      html += '<td>' + (spPerDay != null ? formatNumber(spPerDay, 2, '-') : '-') + '</td>';
      html += '<td>' + (storiesPerDay != null ? formatNumber(storiesPerDay, 2, '-') : '-') + '</td>';
      html += '<td>' + indexStr + '</td>';
      html += '<td>' + onTime + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    html += '</div>';
  }
  html += '</div>';

  const velocityWindows = [1, 3, 6, 12].map(months => {
    const current = computeVelocityWindowStats(sprintsIncluded, windowEndIso, months);
    const previousEnd = addMonths(windowEndDate, -months).toISOString();
    const previous = computeVelocityWindowStats(sprintsIncluded, previousEnd, months);
    const diff = current?.avg != null && previous?.avg != null && previous.avg !== 0
      ? ((current.avg - previous.avg) / previous.avg) * 100
      : null;
    const predictabilityAvg = computePredictabilityAverage(perSprint, current?.inWindow || []);
    const grade = gradeFromSignals(current?.onTimePct ?? null, predictabilityAvg ?? null, current?.sprintCount || 0);
    return { months, current, diff, predictabilityAvg, grade };
  });

  html += '<details class="leadership-secondary-details" data-mobile-collapse="true">';
  html += '<summary>Velocity (SP/day) and trend</summary>';
  html += '<div class="leadership-card">';
  html += '<p class="metrics-hint">Rolling averages by sprint end date. Difference compares against the previous window of the same length.</p>';
  const velocityColumns = [
    { key: 'window', label: 'Window', title: '' },
    { key: 'sprintCount', label: 'Sprints', title: '' },
    { key: 'avg', label: 'Avg SP/day', title: '' },
    { key: 'diff', label: 'Difference', title: '' },
    { key: 'onTimePct', label: 'On-time %', title: '' },
    { key: 'grade', label: 'Delivery Grade', title: DELIVERY_GRADE_TOOLTIP },
    { key: 'quality', label: 'Data quality', title: '' },
  ];
  const velocityRows = velocityWindows.map((row) => {
    let diffLabel = '-';
    if (row.diff != null) {
      const arrow = row.diff >= 10 ? '\u2191' : (row.diff <= -10 ? '\u2193' : '\u2192');
      const color = row.diff >= 10 ? 'color:#166534' : (row.diff <= -10 ? 'color:#991b1b' : 'color:#6b7280');
      diffLabel = '<span style="' + color + '">' + arrow + ' ' + formatNumber(row.diff, 1, '-') + '%</span>';
    }
    return {
      window: row.months === 1 ? '1 month' : row.months + ' months',
      sprintCount: row.current?.sprintCount ?? 0,
      avg: row.current?.avg != null ? formatNumber(row.current.avg, 2, '-') : '-',
      diff: diffLabel,
      onTimePct: row.current?.onTimePct != null ? formatNumber(row.current.onTimePct, 1, '-') + '%' : '-',
      grade: row.grade || '-',
      quality: row.current?.sprintCount != null && row.current.sprintCount < 3 ? 'Low sample' : 'OK',
    };
  });
  html += buildDataTableHtml(velocityColumns, velocityRows);
  html += '</div>';
  html += '</details>';

  if (Object.keys(perSprint).length > 0) {
    const sprintIndex = new Map();
    for (const sprint of sprintsIncluded) {
      if (sprint?.id != null) sprintIndex.set(sprint.id, sprint);
    }
    const perSprintRows = Object.values(perSprint)
      .filter(Boolean)
      .map(row => {
        const sprint = sprintIndex.get(row.sprintId);
        return {
          ...row,
          endDate: sprint?.endDate || row.sprintEndDate || '',
          startDate: sprint?.startDate || row.sprintStartDate || '',
        };
      })
      .sort((a, b) => {
        const aTime = new Date(a.endDate || a.startDate || 0).getTime();
        const bTime = new Date(b.endDate || b.startDate || 0).getTime();
        return bTime - aTime;
      });

    html += '<details class="leadership-secondary-details" data-mobile-collapse="true">';
    html += '<summary>Predictability by sprint</summary>';
    html += '<div class="leadership-card">';
    html += '<h2>Predictability by sprint (committed vs delivered)</h2>';
    html += '<p class="metrics-hint">Planned = created before sprint start; unplanned = added after. Detection assumptions apply.</p>';
    html += '<div class="data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit"><table class="data-table data-table--mobile-scroll"><thead><tr><th>Sprint</th><th>Start</th><th>End</th><th>Committed Stories</th><th>Delivered Stories</th><th>Committed SP</th><th>Delivered SP</th><th>Stories %</th><th>SP %</th></tr></thead><tbody>';
    for (const row of perSprintRows) {
      html += '<tr>';
      html += '<td>' + escapeHtml(row.sprintName) + '</td>';
      html += '<td>' + escapeHtml(formatDateShort(row.startDate)) + '</td>';
      html += '<td>' + escapeHtml(formatDateShort(row.endDate)) + '</td>';
      html += '<td>' + (row.committedStories ?? '-') + '</td>';
      html += '<td>' + (row.deliveredStories ?? '-') + '</td>';
      html += '<td>' + (row.committedSP ?? '-') + '</td>';
      html += '<td>' + (row.deliveredSP ?? '-') + '</td>';
      html += '<td>' + (row.predictabilityStories != null ? formatNumber(row.predictabilityStories, 1, '-') + '%' : '-') + '</td>';
      html += '<td>' + (row.predictabilitySP != null ? formatNumber(row.predictabilitySP, 1, '-') + '%' : '-') + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div></div>';
    html += '</details>';
  }

  return html;
}

/**
 * Render Leadership-style content into an arbitrary container.
 * This thin wrapper allows the Leadership view to be embedded
 * inside other pages (for example, the Report "Trends" tab)
 * without depending on the standalone leadership.html layout.
 */
export function renderLeadershipContent(data, container) {
  if (!container) return;
  container.innerHTML = renderLeadershipPage(data || {});
}
