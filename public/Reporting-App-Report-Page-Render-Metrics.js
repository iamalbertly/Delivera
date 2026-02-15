import { reportState } from './Reporting-App-Report-Page-State.js';
import { getSafeMeta, renderEmptyState } from './Reporting-App-Report-Page-Render-Helpers.js';
import { formatNumber, formatPercent } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { buildPredictabilityTableHeaderHtml, buildEpicTtmSectionHtml } from './Reporting-App-Report-Page-Render-Epic-Helpers.js';
import { renderDataAvailabilitySummaryHtml } from './Reporting-App-Shared-Empty-State-Helpers.js';

export function renderMetricsTab(metrics) {
  const content = document.getElementById('metrics-content');
  const meta = getSafeMeta(reportState.previewData);
  const safeMetrics = metrics || {};
  let html = '';
  let hasMetrics = false;
  const hiddenSections = [];
  const hintHtml = '<p class="metrics-hint"><small>Metrics sections depend on options in the filters panel (e.g. Story Points for Throughput, Bugs for Rework, Epic TTM for Epic Time-To-Market).</small></p>';

  if (safeMetrics.throughput) {
    hasMetrics = true;
    html += '<h3>Throughput</h3>';
    html += '<p class="metrics-hint"><small>Note: Per Sprint data is shown in the Sprints tab. Below are aggregated views.</small></p>';
    // If Boards are present, we merge per-project throughput into the Boards table and avoid duplicate tables here.
    if (reportState.previewData && Array.isArray(reportState.previewData.boards) && reportState.previewData.boards.length > 0) {
      html += '<h4>Per Project</h4>';
      html += '<p><em>Per-project throughput has been merged into the <strong>Boards</strong> table for a unified view. <button type="button" class="btn-ghost" data-action="open-boards-tab">Open Boards</button></em></p>';
    } else {
      html += '<h4>Per Project</h4>';
      html += '<div class="data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit"><table class="data-table"><thead><tr>' +
        '<th title="Project key.">Project</th>' +
        '<th title="Total story points delivered for this project.">Total SP</th>' +
        '<th title="Number of sprints included for this project.">Sprint Count</th>' +
        '<th title="Average story points delivered per sprint.">Average SP/Sprint</th>' +
        '<th title="Number of stories completed for this project.">Story Count</th>' +
        '</tr></thead><tbody>';
      for (const projectKey in safeMetrics.throughput.perProject) {
        const data = safeMetrics.throughput.perProject[projectKey];
        html += `<tr><td>${escapeHtml(data.projectKey)}</td><td>${data.totalSP}</td><td>${data.sprintCount}</td><td>${formatNumber(data.averageSPPerSprint)}</td><td>${data.storyCount}</td></tr>`;
      }
      html += '</tbody></table></div>';
    }

    if (safeMetrics.throughput.perIssueType && Object.keys(safeMetrics.throughput.perIssueType).length > 0) {
      html += '<h4>Per Issue Type</h4>';
      html += '<div class="data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit"><table class="data-table"><thead><tr>' +
        '<th title="Issue category as reported by Jira.">Issue Type</th>' +
        '<th title="Total story points delivered for this issue type.">Total SP</th>' +
        '<th title="Total number of done issues for this type in the window.">Issue Count</th>' +
        '</tr></thead><tbody>';
      for (const issueType in safeMetrics.throughput.perIssueType) {
        const data = safeMetrics.throughput.perIssueType[issueType];
        html += `<tr><td>${escapeHtml(data.issueType || 'Unknown')}</td><td>${data.totalSP}</td><td>${data.issueCount}</td></tr>`;
      }
      html += '</tbody></table></div>';
    } else if (safeMetrics.throughput && meta?.discoveredFields?.storyPointsFieldId) {
      html += '<h4>Per Issue Type</h4>';
      html += '<p><em>No issue type breakdown available. Enable "Include Bugs for Rework" to see Bug vs Story breakdown.</em></p>';
    }
  }

  if (safeMetrics.rework) {
    hasMetrics = true;
    html += '<h3>Rework Ratio</h3>';
    const r = safeMetrics.rework;
    if (r.spAvailable) {
      html += `<p>Rework: ${formatPercent(r.reworkRatio)} (Bug SP: ${r.bugSP}, Story SP: ${r.storySP})</p>`;
    } else {
      html += `<p>Rework: SP unavailable (Bug Count: ${r.bugCount}, Story Count: ${r.storyCount})</p>`;
    }
  }

  if (safeMetrics.predictability) {
    hasMetrics = true;
    html += '<h3>Predictability</h3>';
    html += `<p>Mode: ${safeMetrics.predictability.mode}</p>`;
    html += buildPredictabilityTableHeaderHtml();
    const predictPerSprint = safeMetrics.predictability.perSprint || {};
    for (const data of Object.values(predictPerSprint)) {
      if (!data) continue;
      html += `<tr>
        <td>${escapeHtml(data.sprintName)}</td>
        <td>${data.committedStories}</td>
        <td>${data.committedSP}</td>
        <td>${data.deliveredStories}</td>
        <td>${data.deliveredSP}</td>
        <td>${formatPercent(data.predictabilityStories)}</td>
        <td>${formatPercent(data.predictabilitySP)}</td>
      </tr>`;
    }
    html += '</tbody></table>';
  }

  const epicRowsInput = Array.isArray(safeMetrics.epicTTM) ? safeMetrics.epicTTM : [];
  if (safeMetrics.epicTTM) {
    const epicHygiene = meta?.epicHygiene;
    if (epicHygiene && epicHygiene.ok === false) {
      hiddenSections.push({
        source: 'Config',
        label: 'Epic TTM hidden',
        reason: epicHygiene.message || 'Epic hygiene is below threshold.'
      });
    } else if (epicRowsInput.length === 0) {
      hiddenSections.push({
        source: 'Window',
        label: 'Epic TTM hidden',
        reason: 'No epics with usable timing data in this window.'
      });
    } else {
      hasMetrics = true;
      html += buildEpicTtmSectionHtml(epicRowsInput, meta, reportState.previewRows, {
        includeCompletionAnchor: false,
        wrapperClass: 'data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit',
      });
    }
  }

  if (!hasMetrics) {
    const epicHygieneFailed = meta?.epicHygiene?.ok === false;
    const title = epicHygieneFailed ? 'Epic TTM not available' : 'No metrics available';
    const message = epicHygieneFailed
      ? (meta.epicHygiene?.message || 'Epic TTM is not available because epic hygiene is below threshold.')
      : 'Metrics are only calculated when the corresponding options are enabled in the filters panel.';
    const hint = epicHygieneFailed
      ? 'Check Epic Link usage and epic span in Jira, or adjust project configuration.'
      : 'Enable options like "Include Story Points", "Include Predictability", "Include Epic TTM", or "Include Bugs for Rework" to see metrics.';
    renderEmptyState(content, title, message, hint);
  } else {
    const hiddenSummaryHtml = renderDataAvailabilitySummaryHtml({ title: 'Hidden sections', items: hiddenSections });
    content.innerHTML = hiddenSummaryHtml + hintHtml + html;
    try { import('./Reporting-App-Shared-Dom-Escape-Helpers.js').then(({ addTitleForTruncatedCells }) => addTitleForTruncatedCells('#metrics-content table.data-table th, #metrics-content table.data-table td')).catch(() => {}); } catch (e) {}
  }
} 
