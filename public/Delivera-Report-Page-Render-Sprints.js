import { reportState } from './Reporting-App-Report-Page-State.js';
import { renderEmptyState, getSafeMeta } from './Reporting-App-Report-Page-Render-Helpers.js';
import { sortSprintsLatestFirst } from './Reporting-App-Report-Page-Sorting.js';
import { formatDateForDisplay, formatNumber, formatPercent } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';

function computeSprintTimeTotals(rows) {
  const totals = new Map();
  for (const row of rows || []) {
    if (!totals.has(row.sprintId)) {
      totals.set(row.sprintId, {
        estimateHours: 0,
        spentHours: 0,
        remainingHours: 0,
        varianceHours: 0,
        subtaskEstimateHours: 0,
        subtaskSpentHours: 0,
        subtaskRemainingHours: 0,
        subtaskVarianceHours: 0,
      });
    }
    const totalsEntry = totals.get(row.sprintId);
    totalsEntry.estimateHours += Number(row.timeOriginalEstimateHours) || 0;
    totalsEntry.spentHours += Number(row.timeSpentHours) || 0;
    totalsEntry.remainingHours += Number(row.timeRemainingEstimateHours) || 0;
    totalsEntry.varianceHours += Number(row.timeVarianceHours) || 0;
    totalsEntry.subtaskEstimateHours += Number(row.subtaskTimeOriginalEstimateHours) || 0;
    totalsEntry.subtaskSpentHours += Number(row.subtaskTimeSpentHours) || 0;
    totalsEntry.subtaskRemainingHours += Number(row.subtaskTimeRemainingEstimateHours) || 0;
    totalsEntry.subtaskVarianceHours += Number(row.subtaskTimeVarianceHours) || 0;
  }
  return totals;
}

export function renderSprintsTab(sprints, metrics) {
  const content = document.getElementById('sprints-content');
  const meta = getSafeMeta(reportState.previewData);
  const spEnabled = !!meta?.discoveredFields?.storyPointsFieldId;
  const orderedSprints = sortSprintsLatestFirst(sprints);

  if (!orderedSprints || orderedSprints.length === 0) {
    const windowInfo = meta
      ? `${new Date(meta.windowStart).toLocaleDateString()} to ${new Date(meta.windowEnd).toLocaleDateString()}`
      : 'selected date range';
    const title = 'No sprints found';
    let message;
    let hint;
    if (reportState.previewData?.sprintsIncluded?.length > 0) {
      message = 'No sprints match the current filters.';
      hint = 'Adjust search or project filters.';
    } else {
      message = `No sprints overlap with the selected date window (${windowInfo}).`;
      hint = 'Try adjusting your date range or enable "Include Active/Missing End Date Sprints" if you want to include active sprints.';
    }
    renderEmptyState(content, title, message, hint);
    return;
  }

  const throughputMap = new Map();
  if (metrics?.throughput?.perSprint) {
    for (const data of Object.values(metrics.throughput.perSprint)) {
      if (data?.sprintId) {
        throughputMap.set(data.sprintId, data);
      }
    }
  }

  const predictabilityMap = new Map();
  if (metrics?.predictability?.perSprint) {
    for (const data of Object.values(metrics.predictability.perSprint)) {
      if (data?.sprintId) {
        predictabilityMap.set(data.sprintId, data);
      }
    }
  }

  const timeTotals = computeSprintTimeTotals(reportState.previewRows);
  const hasTimeTracking = Array.from(timeTotals.values()).some(total =>
    total.estimateHours || total.spentHours || total.remainingHours || total.varianceHours
  );
  const hasSubtaskTimeTracking = Array.from(timeTotals.values()).some(total =>
    total.subtaskEstimateHours || total.subtaskSpentHours || total.subtaskRemainingHours || total.subtaskVarianceHours
  );

  let html = '<div class="data-table-scroll-wrap"><table class="data-table data-table--mobile-scroll"><thead><tr>' +
    '<th title="Projects included for this sprint.">Project</th>' +
    '<th title="Board that owns the sprint.">Board</th>' +
    '<th title="Sprint name.">Sprint</th>' +
    '<th title="Sprint start date (local display)."><span>Start</span></th>' +
    '<th title="Sprint end date (local display)."><span>End</span></th>' +
    '<th title="Sprint state in Jira.">State</th>' +
    '<th title="Stories marked Done in this sprint.">Done Stories</th>';

  if (metrics?.doneComparison) {
    html += '<th title="Stories resolved by the sprint end date.">On-Time Stories</th>';
  }

  if (metrics?.throughput) {
    html += '<th title="Story points completed in this sprint. If SP is not configured, this will show N/A.">Done SP</th><th title="Total SP recorded for this sprint in throughput.">Total SP</th><th title="Story count used in throughput.">Story Count</th>';
  }

  if (metrics?.predictability) {
    html += '<th title="Story points committed at sprint start (estimate).">Committed SP</th>' +
      '<th title="Story points delivered by sprint end (actual).">Delivered SP</th>' +
      '<th title="Delivered SP / Committed SP. 100% means delivery matched plan; below 100% suggests over-commit or scope churn; above 100% suggests scope growth.">SP Estimation %</th>';
  }

  if (hasTimeTracking) {
    html += '<th title="Sum of original estimates.">Est Hrs</th><th title="Sum of time spent.">Spent Hrs</th><th title="Sum of remaining estimates.">Remaining Hrs</th><th title="Actual hours minus estimate. Positive = over estimate; negative = under. Large swings signal estimation risk.">Variance Hrs</th>';
  }

  if (hasSubtaskTimeTracking) {
    html += '<th title="Sum of subtask estimates.">Subtask Est Hrs</th><th title="Sum of subtask time spent.">Subtask Spent Hrs</th><th title="Sum of subtask remaining estimates.">Subtask Remaining Hrs</th><th title="Subtask hours minus estimate. Large swings signal hidden work or poor slicing.">Subtask Variance Hrs</th>';
  }

  html += '</tr></thead><tbody>';

  for (const sprint of orderedSprints) {
    const throughputData = throughputMap.get(sprint.id);
    const timeData = timeTotals.get(sprint.id) || {
      estimateHours: 0,
      spentHours: 0,
      remainingHours: 0,
      varianceHours: 0,
      subtaskEstimateHours: 0,
      subtaskSpentHours: 0,
      subtaskRemainingHours: 0,
      subtaskVarianceHours: 0,
    };

    const sprintStartDisplay = formatDateForDisplay(sprint.startDate);
    const sprintEndDisplay = formatDateForDisplay(sprint.endDate);
    html += `
      <tr>
        <td>${escapeHtml((sprint.projectKeys || []).join(', '))}</td>
        <td>${escapeHtml(sprint.boardName || '')}</td>
        <td>${escapeHtml(sprint.name || '')}</td>
        <td title="${escapeHtml(sprintStartDisplay)}">${escapeHtml(sprintStartDisplay)}</td>
        <td title="${escapeHtml(sprintEndDisplay)}">${escapeHtml(sprintEndDisplay)}</td>
        <td>${escapeHtml(sprint.state || '')}</td>
        <td>${sprint.doneStoriesNow || 0}</td>
    `;

    if (metrics?.doneComparison) {
      html += `<td>${sprint.doneStoriesBySprintEnd || 0}</td>`;
    }

    if (metrics?.throughput) {
      html += `<td>${spEnabled ? (sprint.doneSP || 0) : 'N/A'}</td>`;
      if (throughputData) {
        html += `<td>${throughputData.totalSP || 0}</td>`;
        html += `<td>${throughputData.storyCount || 0}</td>`;
      } else {
        html += '<td>N/A</td>';
        html += '<td>N/A</td>';
      }
    }

    if (metrics?.predictability) {
      const predictData = predictabilityMap.get(sprint.id);
      const committedSP = predictData ? predictData.committedSP : null;
      const deliveredSP = predictData ? predictData.deliveredSP : null;
      const estimationPct = committedSP > 0 ? (deliveredSP / committedSP) * 100 : null;
      html += `<td>${formatNumber(committedSP, 2)}</td>`;
      html += `<td>${formatNumber(deliveredSP, 2)}</td>`;
      html += `<td>${formatPercent(estimationPct)}</td>`;
    }

    if (hasTimeTracking) {
      html += `<td>${timeData.estimateHours.toFixed(2)}</td>`;
      html += `<td>${timeData.spentHours.toFixed(2)}</td>`;
      html += `<td>${timeData.remainingHours.toFixed(2)}</td>`;
      html += `<td>${timeData.varianceHours.toFixed(2)}</td>`;
    }

    if (hasSubtaskTimeTracking) {
      html += `<td>${timeData.subtaskEstimateHours.toFixed(2)}</td>`;
      html += `<td>${timeData.subtaskSpentHours.toFixed(2)}</td>`;
      html += `<td>${timeData.subtaskRemainingHours.toFixed(2)}</td>`;
      html += `<td>${timeData.subtaskVarianceHours.toFixed(2)}</td>`;
    }

    html += '</tr>';
  }

  const totalDoneStoriesNow = orderedSprints.reduce((sum, sprint) => sum + (sprint.doneStoriesNow || 0), 0);
  const totalDoneByEnd = orderedSprints.reduce((sum, sprint) => sum + (sprint.doneStoriesBySprintEnd || 0), 0);
  const totalDoneSP = orderedSprints.reduce((sum, sprint) => sum + (sprint.doneSP || 0), 0);
  const totalThroughputSP = metrics?.throughput?.perSprint
    ? Object.values(metrics.throughput.perSprint).reduce((sum, data) => sum + (data.totalSP || 0), 0)
    : 0;
  const totalThroughputCount = metrics?.throughput?.perSprint
    ? Object.values(metrics.throughput.perSprint).reduce((sum, data) => sum + (data.storyCount || 0), 0)
    : 0;
  const totalCommittedSP = metrics?.predictability?.perSprint
    ? Object.values(metrics.predictability.perSprint).reduce((sum, data) => sum + (data.committedSP || 0), 0)
    : 0;
  const totalDeliveredSP = metrics?.predictability?.perSprint
    ? Object.values(metrics.predictability.perSprint).reduce((sum, data) => sum + (data.deliveredSP || 0), 0)
    : 0;
  const totalEstimationPct = totalCommittedSP > 0
    ? (totalDeliveredSP / totalCommittedSP) * 100
    : null;
  const totalTime = Array.from(timeTotals.values()).reduce(
    (acc, val) => ({
      estimateHours: acc.estimateHours + val.estimateHours,
      spentHours: acc.spentHours + val.spentHours,
      remainingHours: acc.remainingHours + val.remainingHours,
      varianceHours: acc.varianceHours + val.varianceHours,
    }),
    { estimateHours: 0, spentHours: 0, remainingHours: 0, varianceHours: 0 }
  );
  const totalSubtaskTime = Array.from(timeTotals.values()).reduce(
    (acc, val) => ({
      estimateHours: acc.estimateHours + val.subtaskEstimateHours,
      spentHours: acc.spentHours + val.subtaskSpentHours,
      remainingHours: acc.remainingHours + val.subtaskRemainingHours,
      varianceHours: acc.varianceHours + val.subtaskVarianceHours,
    }),
    { estimateHours: 0, spentHours: 0, remainingHours: 0, varianceHours: 0 }
  );

  html += '<tr class="totals-row">';
  html += '<td colspan="6"><strong>Totals</strong></td>';
  html += `<td><strong>${totalDoneStoriesNow}</strong></td>`;
  if (metrics?.doneComparison) {
    html += `<td><strong>${totalDoneByEnd}</strong></td>`;
  }
  if (metrics?.throughput) {
    html += `<td><strong>${spEnabled ? totalDoneSP : 'N/A'}</strong></td>`;
    html += `<td><strong>${spEnabled ? totalThroughputSP : 'N/A'}</strong></td>`;
    html += `<td><strong>${totalThroughputCount}</strong></td>`;
  }
  if (metrics?.predictability) {
    html += `<td><strong>${formatNumber(totalCommittedSP, 2)}</strong></td>`;
    html += `<td><strong>${formatNumber(totalDeliveredSP, 2)}</strong></td>`;
    html += `<td><strong>${formatPercent(totalEstimationPct)}</strong></td>`;
  }
  if (hasTimeTracking) {
    html += `<td><strong>${totalTime.estimateHours.toFixed(2)}</strong></td>`;
    html += `<td><strong>${totalTime.spentHours.toFixed(2)}</strong></td>`;
    html += `<td><strong>${totalTime.remainingHours.toFixed(2)}</strong></td>`;
    html += `<td><strong>${totalTime.varianceHours.toFixed(2)}</strong></td>`;
  }
  if (hasSubtaskTimeTracking) {
    html += `<td><strong>${totalSubtaskTime.estimateHours.toFixed(2)}</strong></td>`;
    html += `<td><strong>${totalSubtaskTime.spentHours.toFixed(2)}</strong></td>`;
    html += `<td><strong>${totalSubtaskTime.remainingHours.toFixed(2)}</strong></td>`;
    html += `<td><strong>${totalSubtaskTime.varianceHours.toFixed(2)}</strong></td>`;
  }
  html += '</tr>';

  html += '</tbody></table></div>';
  content.innerHTML = html;
  try { import('./Reporting-App-Shared-Dom-Escape-Helpers.js').then(({ addTitleForTruncatedCells }) => addTitleForTruncatedCells('#tab-sprints table.data-table th, #tab-sprints table.data-table td')).catch(() => {}); } catch (e) {}
} 
