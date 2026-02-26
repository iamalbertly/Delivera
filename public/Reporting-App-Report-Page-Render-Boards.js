import { reportState } from './Reporting-App-Report-Page-State.js';
import { buildBoardSummaries } from './Reporting-App-Shared-Boards-Summary-Builder.js';
import { renderEmptyState, getSafeMeta } from './Reporting-App-Report-Page-Render-Helpers.js';
import { renderDataAvailabilitySummaryHtml, renderEmptyStateHtml } from './Reporting-App-Shared-Empty-State-Helpers.js';
import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDateForDisplay, formatPercent, formatNumber } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import {
  computeBoardRowFromSummary,
  computeBoardsSummaryRow,
  deriveDeliveryGrade,
  DELIVERY_GRADE_TOOLTIP,
} from './Reporting-App-Report-Page-Render-Boards-Summary-Helpers.js';
import { buildPredictabilityTableHeaderHtml, buildEpicTtmSectionHtml } from './Reporting-App-Report-Page-Render-Epic-Helpers.js';
import { buildDataTableHtml } from './Reporting-App-Shared-Table-Renderer.js';

const BOARD_TABLE_COLUMN_ORDER = [
  'Board', 'Projects', 'Sprints', 'Sprint Days', 'Avg Sprint Days', 'Done Stories', 'Throughput Stories', 'Registered Work Hours', 'Estimated Work Hours', 'Done SP', 'Throughput SP',
  'Committed SP', 'Delivered SP', 'SP Estimation %', 'Delivery Grade', 'Stories / Sprint', 'SP / Story', 'Stories / Day',
  'SP / Day', 'SP / Sprint', 'SP Variance', 'Indexed Delivery', 'On-Time %', 'Planned', 'Ad-hoc',
  'Active Assignees', 'Stories / Assignee', 'SP / Assignee', 'Assumed Capacity (PD)', 'Assumed Waste %',
  'Sprint Window', 'Latest End'
];
const BOARD_COLUMNS_PREF_KEY = 'report-boards-columns-expanded';
const CORE_BOARD_COLUMNS = new Set(['Board', 'Sprints', 'Done Stories', 'Done SP', 'SP / Day', 'On-Time %', 'Delivery Grade']);

const BOARD_TABLE_HEADER_TOOLTIPS = {
  'Board': 'Board name in Jira.',
  'Projects': 'Projects linked to the board.',
  'Sprints': 'Count of sprints in window.',
  'Sprint Days': 'Total working days across sprints.',
  'Avg Sprint Days': 'Average sprint length (working days).',
  'Done Stories': 'Stories completed in window.',
  'Throughput Stories': 'Stories from throughput snapshots across included sprints.',
  'Registered Work Hours': 'Sum of work logged from subtasks (and story) in window.',
  'Estimated Work Hours': 'Sum of estimated hours from subtasks (and story) in window.',
  'Done SP': 'Story points completed (if configured).',
  'Throughput SP': 'Story points from throughput snapshots across included sprints.',
  'Committed SP': 'Story points committed at sprint start.',
  'Delivered SP': 'Story points delivered by sprint end.',
  'SP Estimation %': 'Delivered SP / Committed SP.',
  'Stories / Sprint': 'Avg stories per sprint.',
  'SP / Story': 'Avg SP per story.',
  'Stories / Day': 'Stories per day.',
  'SP / Day': 'SP per day.',
  'SP / Sprint': 'SP per sprint.',
  'SP Variance': 'Variance of SP by sprint.',
  'Indexed Delivery': 'Current SP/day vs own baseline.',
  'On-Time %': 'Stories done by sprint end.',
  'Planned': 'Stories with epic links.',
  'Ad-hoc': 'Stories without epic links.',
  'Active Assignees': 'Unique assignees in window.',
  'Stories / Assignee': 'Stories per assignee.',
  'SP / Assignee': 'SP per assignee.',
  'Assumed Capacity (PD)': 'Assumed capacity based on 18 PD/assignee/month.',
  'Assumed Waste %': 'Assumed unused capacity (estimate).',
  'Sprint Window': 'Earliest to latest sprint dates.',
  'Latest End': 'Latest sprint end date.',
};

const BOARD_SUMMARY_TOOLTIPS = {
  'Board': 'Totals across boards.',
  'Projects': 'Aggregate across selected projects.',
  'Sprints': 'Total sprints in window.',
  'Sprint Days': 'Total sprint days.',
  'Avg Sprint Days': 'Average sprint length.',
  'Done Stories': 'Total done stories.',
  'Throughput Stories': 'Total throughput stories.',
  'Registered Work Hours': 'Total registered work hours.',
  'Estimated Work Hours': 'Total estimated work hours.',
  'Done SP': 'Total done SP.',
  'Throughput SP': 'Total throughput SP.',
  'Committed SP': 'Total committed SP.',
  'Delivered SP': 'Total delivered SP.',
  'SP Estimation %': 'Average estimation accuracy.',
  'Delivery Grade': DELIVERY_GRADE_TOOLTIP,
  'Stories / Sprint': 'Average stories per sprint.',
  'SP / Story': 'Average SP per story.',
  'Stories / Day': 'Average stories per day.',
  'SP / Day': 'Average SP per day.',
  'SP / Sprint': 'Average SP per sprint.',
  'SP Variance': 'Average variance across boards.',
  'Indexed Delivery': 'Not computed for totals.',
  'On-Time %': 'Average on-time %.',
  'Planned': 'Total planned stories.',
  'Ad-hoc': 'Total ad-hoc stories.',
  'Active Assignees': 'Sum of active assignees.',
  'Stories / Assignee': 'Average stories per assignee.',
  'SP / Assignee': 'Average SP per assignee.',
  'Assumed Capacity (PD)': 'Total assumed capacity.',
  'Assumed Waste %': 'Average waste %.',
  'Sprint Window': 'Overall window.',
  'Latest End': 'Latest end date.',
};

function buildSignalsRailHtml(metrics, meta) {
  if (!metrics) return '';
  const items = [];

  if (metrics.rework) {
    const r = metrics.rework;
    const label = r.spAvailable
      ? `Rework ${formatPercent(r.reworkRatio)}`
      : 'Rework (SP unavailable)';
    items.push({
      id: 'rework-signals-tile',
      href: '#rework-section',
      title: 'Rework',
      label,
    });
  }

  if (metrics.predictability) {
    const modeLabel = metrics.predictability.mode ? String(metrics.predictability.mode) : '';
    items.push({
      id: 'predictability-signals-tile',
      href: '#predictability-section',
      title: 'Predictability',
      label: modeLabel ? `Mode: ${escapeHtml(modeLabel)}` : 'Predictability',
    });
  }

  const epicTTMRows = Array.isArray(metrics.epicTTM) ? metrics.epicTTM : [];
  const epicHygiene = meta?.epicHygiene;
  if (metrics.epicTTM || epicTTMRows.length === 0) {
    let label = 'Epic TTM';
    if (epicHygiene && epicHygiene.ok === false) {
      label = 'Epic TTM hidden (hygiene)';
    } else if (epicTTMRows.length === 0) {
      label = 'Epic TTM (no data)';
    }
    items.push({
      id: 'epic-ttm-signals-tile',
      href: '#epic-ttm-section',
      title: 'Epic TTM',
      label,
    });
  }

  if (!items.length) return '';

  let html = '<section class="performance-signals-rail" aria-label="Key performance signals">';
  html += '<div class="performance-signals-rail-inner">';
  items.forEach((item) => {
    html += '<a'
      + ' id="' + escapeHtml(item.id) + '"'
      + ' class="signals-rail-tile"'
      + ' href="' + escapeHtml(item.href) + '">';
    html += '<span class="signals-rail-title">' + escapeHtml(item.title) + '</span>';
    html += '<span class="signals-rail-label">' + escapeHtml(item.label) + '</span>';
    html += '</a>';
  });
  html += '</div>';
  html += '</section>';
  return html;
}

function buildMergedLeadershipSignalsHtml(boards, boardSummaries, hasPredictability) {
  if (!Array.isArray(boards) || boards.length === 0) return '';
  const cards = boards.map((board) => {
    const summary = boardSummaries.get(board.id) || {};
    const doneStories = Number(summary.doneStories || 0);
    const doneByEnd = Number(summary.doneBySprintEnd || 0);
    const committedSP = Number(summary.committedSP || 0);
    const deliveredSP = Number(summary.deliveredSP || 0);
    const sprintCount = Number(summary.sprintCount || 0);
    const onTimePct = doneStories > 0 ? (doneByEnd / doneStories) * 100 : null;
    const spEstPct = hasPredictability && committedSP > 0 ? (deliveredSP / committedSP) * 100 : null;
    const grade = deriveDeliveryGrade(onTimePct, spEstPct, sprintCount);
    const gradeClass = String(grade || 'insufficient-data').toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '');
    return {
      boardName: board.name || 'Board',
      grade,
      gradeClass,
      onTimePct,
      spEstPct,
      doneStories,
      sprintCount,
      spPerDay: (summary.totalSprintDays > 0) ? (Number(summary.doneSP || 0) / Number(summary.totalSprintDays || 1)) : null,
    };
  });

  const atRiskCount = cards.filter((c) => /weak|critical|insufficient/i.test(c.grade)).length;
  const strongCount = cards.filter((c) => /^strong$/i.test(c.grade)).length;
  let html = '<section class="leadership-merged-section" id="merged-leadership-signals">';
  html += '<p class="leadership-outcome-line" aria-live="polite">' + cards.length + ' boards | ' + strongCount + ' strong | ' + atRiskCount + ' need attention.</p>';
  html += '<div class="leadership-boards-cards" role="region" aria-label="Merged leadership board cards">';
  cards.forEach((card) => {
    const onTime = Number.isFinite(card.onTimePct) ? formatNumber(card.onTimePct, 0, '-') + '%' : '-';
    const spEst = Number.isFinite(card.spEstPct) ? formatNumber(card.spEstPct, 0, '-') + '%' : '-';
    const spDay = Number.isFinite(card.spPerDay) ? formatNumber(card.spPerDay, 2, '-') : '-';
    html += '<article class="leadership-board-card">';
    html += '<div class="leadership-board-card-grade ' + escapeHtml(card.gradeClass) + '">' + escapeHtml(card.grade) + '</div>';
    html += '<div class="leadership-board-card-name">' + escapeHtml(card.boardName) + '</div>';
    html += '<div class="leadership-board-card-metric">On-time: ' + escapeHtml(onTime) + '</div>';
    html += '<div class="leadership-board-card-metric">SP Estimation: ' + escapeHtml(spEst) + '</div>';
    html += '<div class="leadership-board-card-metric">SP/day: ' + escapeHtml(spDay) + '</div>';
    html += '<div class="leadership-board-card-metric">Done stories: ' + card.doneStories + ' | Sprints: ' + card.sprintCount + '</div>';
    html += '</article>';
  });
  html += '</div>';
  html += '</section>';
  return html;
}

function applyBoardsColumnVisibility() {
  const table = document.getElementById('boards-table');
  const toggle = document.getElementById('boards-columns-toggle');
  if (!table || !toggle) return;

  let expanded = false;
  try {
    expanded = localStorage.getItem(BOARD_COLUMNS_PREF_KEY) === '1';
  } catch (_) {}

  const headerCells = Array.from(table.querySelectorAll('thead th'));
  const labels = headerCells.map((th) => (th.textContent || '').trim());

  const render = () => {
    headerCells.forEach((th, colIndex) => {
      const key = labels[colIndex];
      const show = expanded || CORE_BOARD_COLUMNS.has(key);
      th.style.display = show ? '' : 'none';
      table.querySelectorAll('tbody tr').forEach((row) => {
        const cell = row.children[colIndex];
        if (cell) cell.style.display = show ? '' : 'none';
      });
    });
    toggle.textContent = expanded ? 'Show core columns' : 'Show advanced columns';
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  };

  toggle.onclick = () => {
    expanded = !expanded;
    try {
      localStorage.setItem(BOARD_COLUMNS_PREF_KEY, expanded ? '1' : '0');
    } catch (_) {}
    render();
  };

  render();
}

export function renderProjectEpicLevelTab(boards, metrics) {
  const content = document.getElementById('project-epic-level-content');
  const meta = getSafeMeta(reportState.previewData);
  const hiddenSections = [];
  const spEnabled = !!meta?.discoveredFields?.storyPointsFieldId;
  let html = '';
  const predictabilityPerSprint = metrics?.predictability?.perSprint || null;
  const throughputPerSprint = metrics?.throughput?.perSprint || null;
  const boardSummaries = buildBoardSummaries(boards, reportState.previewData?.sprintsIncluded || [], reportState.previewRows, meta, predictabilityPerSprint);
  const throughputByBoard = new Map();
  const sprintsById = new Map((reportState.previewData?.sprintsIncluded || []).map((s) => [String(s.id), s]));
  if (throughputPerSprint && typeof throughputPerSprint === 'object') {
    for (const item of Object.values(throughputPerSprint)) {
      const sprintId = item?.sprintId != null ? String(item.sprintId) : '';
      const sprint = sprintId ? sprintsById.get(sprintId) : null;
      const boardId = sprint?.boardId != null ? String(sprint.boardId) : '';
      if (!boardId) continue;
      const existing = throughputByBoard.get(boardId) || { totalSP: 0, storyCount: 0 };
      existing.totalSP += Number(item.totalSP) || 0;
      existing.storyCount += Number(item.storyCount) || 0;
      throughputByBoard.set(boardId, existing);
    }
  }

  if (!boards || boards.length === 0) {
    if (!metrics) {
      renderEmptyState(
        content,
        'No boards in this range',
        'No boards were discovered for the selected projects in the date window.',
        'Try a different date range or project selection.'
      );
      return;
    }
    html += '<h3>Boards</h3>';
    if (reportState.previewData?.boards?.length > 0) {
      html += renderEmptyStateHtml('No boards match filters', 'No boards match the current filters. Adjust search or project filters.', '');
    } else {
      html += renderEmptyStateHtml('No boards in this range', 'No boards were discovered for the selected projects in the date window.', 'Try a different date range or project selection.');
    }
  } else {
    const hasPredictability = !!metrics?.predictability;
    if (metrics) {
      const leadershipCardsHtml = buildMergedLeadershipSignalsHtml(boards, boardSummaries, hasPredictability);
      if (leadershipCardsHtml) {
        html += leadershipCardsHtml;
        html += buildSignalsRailHtml(metrics, meta);
      }
    }

    html += '<h3>Boards</h3>';
    const tableContextLabel = (() => {
      const m = getSafeMeta(reportState.previewData);
      const proj = (m?.selectedProjects && m.selectedProjects.length) ? m.selectedProjects.join(', ') : '-';
      const start = m?.windowStart ? formatDateForDisplay(m.windowStart) : '-';
      const end = m?.windowEnd ? formatDateForDisplay(m.windowEnd) : '-';
      return `General Performance - ${escapeHtml(proj)} - ${escapeHtml(start)} to ${escapeHtml(end)}`;
    })();
    html += '<p class="table-context" aria-label="Table context">' + tableContextLabel + '</p>';
    html += '<p class="metrics-hint"><small>Time-normalized metrics (Stories / Day, SP / Day, Indexed Delivery) are shown. Indexed Delivery = current SP/day vs own baseline (last 6 closed sprints). Do not use to rank teams.</small></p>';
    // Build table using shared renderer for consistent behavior
    const columns = BOARD_TABLE_COLUMN_ORDER.map(k => ({ key: k, label: k, title: BOARD_TABLE_HEADER_TOOLTIPS[k] || '' }));
    const rowsForRender = boards.map((board) => {
      const summary = boardSummaries.get(board.id) || { sprintCount: 0, doneStories: 0, doneSP: 0, registeredWorkHours: 0, estimatedWorkHours: 0, committedSP: 0, deliveredSP: 0, earliestStart: null, latestEnd: null, totalSprintDays: 0, validSprintDaysCount: 0, doneBySprintEnd: 0, sprintSpValues: [], epicStories: 0, nonEpicStories: 0, epicSP: 0, nonEpicSP: 0, assignees: new Set(), nonEpicAssignees: new Set() };
      const row = computeBoardRowFromSummary(board, summary, meta, spEnabled, hasPredictability);
      const throughput = throughputByBoard.get(String(board.id));
      row['Throughput Stories'] = throughput ? throughput.storyCount : 'N/A';
      row['Throughput SP'] = throughput ? (spEnabled ? throughput.totalSP : 'N/A') : 'N/A';
      // convert object to expected keys
      const out = {};
      for (const k of BOARD_TABLE_COLUMN_ORDER) out[k] = row[k] ?? '';
      return out;
    });
    const summaryRow = computeBoardsSummaryRow(boards, boardSummaries, meta, spEnabled, hasPredictability);
    if (summaryRow) {
      const throughputTotals = Array.from(throughputByBoard.values()).reduce(
        (acc, cur) => ({ storyCount: acc.storyCount + (cur.storyCount || 0), totalSP: acc.totalSP + (cur.totalSP || 0) }),
        { storyCount: 0, totalSP: 0 },
      );
      summaryRow['Throughput Stories'] = throughputTotals.storyCount;
      summaryRow['Throughput SP'] = spEnabled ? throughputTotals.totalSP : 'N/A';
      summaryRow['Board'] = 'All Boards (Comparison)';
      rowsForRender.unshift({ __rowClass: 'boards-summary-row', ...summaryRow });
    }
    html += buildDataTableHtml(columns, rowsForRender, {
      id: 'boards-table',
      wrapperClass: 'data-table-scroll-wrap--with-vertical-limit',
    });
    html += '<div class="boards-column-toggle-row"><button type="button" class="btn btn-secondary btn-compact" id="boards-columns-toggle" aria-expanded="false">Show advanced columns</button></div>';
    html += '<p class="metrics-hint"><small>Throughput signals are merged into Boards columns (Throughput Stories, Throughput SP). Sprint-level throughput remains in Sprint history.</small></p>';
    html += '<p class="table-scroll-hint metrics-hint" aria-live="polite"><small>Scroll right for more columns. Export includes all columns.</small></p>';
  }

  if (metrics) {
    html += '<hr style="margin: 30px 0;">';

    if (metrics.rework) {
      html += '<h3 id="rework-section">Rework Ratio</h3>';
      const r = metrics.rework;
      if (r.spAvailable) {
        html += `<p>Rework: ${formatPercent(r.reworkRatio)} (Bug SP: ${r.bugSP}, Story SP: ${r.storySP})</p>`;
      } else {
        html += `<p>Rework: SP unavailable (Bug Count: ${r.bugCount}, Story Count: ${r.storyCount})</p>`;
      }
    }

    if (metrics.predictability) {
      html += '<h3 id="predictability-section">Predictability</h3>';
      html += `<p>Mode: ${escapeHtml(metrics.predictability.mode)}</p>`;
      html += '<p class="metrics-hint"><small>Detection: Planned carryover = created before sprint start and delivered. Unplanned spillover = added mid-sprint and delivered. Do not use unplanned spillover as a failure metric.</small></p>';
      html += '<div class="data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit">';
      html += buildPredictabilityTableHeaderHtml();
      const predictPerSprint = metrics.predictability.perSprint || {};
      for (const data of Object.values(predictPerSprint)) {
        if (!data) continue;
        // UX Fix: use explicit "-" for missing predictability data (intentional absence, not error).
        const plannedCell = (data.deliveredStories == null || data.deliveredStories === 0 || data.plannedCarryoverPct == null)
          ? '-'
          : (data.plannedCarryoverStories ?? '-') + ' (' + formatPercent(data.plannedCarryoverPct) + '%)';
        const unplannedCell = (data.deliveredStories == null || data.deliveredStories === 0 || data.unplannedSpilloverPct == null)
          ? '-'
          : (data.unplannedSpilloverStories ?? '-') + ' (' + formatPercent(data.unplannedSpilloverPct) + '%)';
        html += `<tr>
          <td>${escapeHtml(data.sprintName)}</td>
          <td>${data.committedStories}</td>
          <td>${data.committedSP}</td>
          <td>${data.deliveredStories}</td>
          <td>${data.deliveredSP}</td>
          <td>${plannedCell}</td>
          <td>${unplannedCell}</td>
          <td>${formatPercent(data.predictabilityStories)}</td>
          <td>${formatPercent(data.predictabilitySP)}</td>
        </tr>`;
      }
      html += '</tbody></table></div>';
    }

    const epicTTMRows = Array.isArray(metrics.epicTTM) ? metrics.epicTTM : [];
    if (metrics.epicTTM || epicTTMRows.length === 0) {
      const epicHygiene = meta?.epicHygiene;
      if (epicHygiene && epicHygiene.ok === false) {
        hiddenSections.push({
          source: 'Config',
          label: 'Epic TTM hidden',
          reason: epicHygiene.message || 'Epic hygiene is below threshold.'
        });
      } else if (epicTTMRows.length === 0) {
        hiddenSections.push({
          source: 'Window',
          label: 'Epic TTM hidden',
          reason: 'No epics with usable timing data in this window.'
        });
      } else {
        html += '<h3 id="epic-ttm-section" class="visually-hidden">Epic time-to-market</h3>';
        html += buildEpicTtmSectionHtml(epicTTMRows, meta, reportState.previewRows, {
          includeCompletionAnchor: true,
          wrapperClass: 'data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit',
        });
      }
    }
  } else {
    html += '<hr style="margin: 30px 0;">';
    html += '<p><em>No metrics available. Metrics are calculated when the corresponding options are enabled.</em></p>';
  }

  if (hiddenSections.length > 0) {
    html = renderDataAvailabilitySummaryHtml({ title: 'Hidden sections', items: hiddenSections }) + html;
  }

  content.innerHTML = html;
  applyBoardsColumnVisibility();
  // Add hover titles for truncated headers/cells for better discoverability (dynamic import)
  try { import('./Reporting-App-Shared-Dom-Escape-Helpers.js').then(({ addTitleForTruncatedCells }) => addTitleForTruncatedCells('#project-epic-level-content table.data-table th, #project-epic-level-content table.data-table td')).catch(() => {}); } catch (e) {}
}
