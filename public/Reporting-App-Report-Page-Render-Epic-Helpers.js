import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDateForDisplay, formatNumber } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { buildJiraIssueUrl, getEpicStoryItems, getResolvedJiraHostFromMeta, getJiraLinkAvailability, hasResolvedJiraHost, isJiraIssueKey } from './Reporting-App-Report-Utils-Jira-Helpers.js';

export function buildPredictabilityTableHeaderHtml() {
  return '<table class="data-table"><thead><tr>' +
    '<th title="Sprint name.">Sprint</th>' +
    '<th title="Stories planned at sprint start (scope commitment).">Committed Stories</th>' +
    '<th title="Story points planned at sprint start (scope commitment).">Committed SP</th>' +
    '<th title="Stories completed by sprint end.">Delivered Stories</th>' +
    '<th title="Story points completed by sprint end.">Delivered SP</th>' +
    '<th title="Delivered stories that were committed at sprint start (created before sprint start).">Planned Carryover</th>' +
    '<th title="Delivered stories that were added mid-sprint (created after sprint start). Not a failure metric.">Unplanned Spillover</th>' +
    '<th title="Delivered Stories / Committed Stories. Higher means closer to plan; low suggests scope churn or over-commit.">Predictability % (Stories)</th>' +
    '<th title="Delivered SP / Committed SP. Higher means closer to plan; low suggests estimation drift or unstable capacity.">Predictability % (SP)</th>' +
    '</tr></thead><tbody>';
}

export function buildEpicAdhocRows(rows) {
  const nonEpicRows = (rows || []).filter(row => !row.epicKey);
  if (nonEpicRows.length === 0) return [];
  const byBoard = new Map();
  for (const row of nonEpicRows) {
    const boardId = row.boardId ?? '';
    const boardName = (row.boardName || '').trim();
    const projectKey = (row.projectKey || '').trim();
    const groupKey = String(boardId || boardName || projectKey || 'unknown');
    const displayLabel = boardName || projectKey || (boardId ? `Board-${boardId}` : 'Unknown');
    if (!byBoard.has(groupKey)) {
      byBoard.set(groupKey, { displayLabel: displayLabel.trim() || groupKey, rows: [] });
    }
    byBoard.get(groupKey).rows.push(row);
  }
  const result = [];
  for (const { displayLabel, rows: groupRows } of byBoard.values()) {
    const earliestStart = groupRows.reduce((acc, row) => {
      const created = row.created ? new Date(row.created) : null;
      if (!created || Number.isNaN(created.getTime())) return acc;
      return !acc || created < acc ? created : acc;
    }, null);
    const latestEnd = groupRows.reduce((acc, row) => {
      const resolved = row.resolutionDate ? new Date(row.resolutionDate) : null;
      if (!resolved || Number.isNaN(resolved.getTime())) return acc;
      return !acc || resolved > acc ? resolved : acc;
    }, null);
    if (!earliestStart || !latestEnd) continue;
    const calendarTTMdays = Math.ceil((latestEnd.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24));
    result.push({
      epicKey: `${displayLabel}-ad-hoc`,
      epicName: 'Ad-hoc work',
      storyCount: groupRows.length,
      startDate: earliestStart.toISOString(),
      endDate: latestEnd.toISOString(),
      calendarTTMdays,
      workingTTMdays: calendarTTMdays,
      storyItems: groupRows.map(row => ({
        key: row.issueKey,
        summary: row.issueSummary,
        subtaskTimeSpentHours: row.subtaskTimeSpentHours,
      })),
      subtaskSpentHours: groupRows.reduce((sum, row) => sum + (Number(row.subtaskTimeSpentHours) || 0), 0),
    });
  }
  return result;
}

export function renderEpicKeyCell(epic, meta) {
  const key = epic.epicKey || '';
  if (!isJiraIssueKey(key)) {
    return `<span class="epic-key">${escapeHtml(key)}</span>`;
  }
  const host = getResolvedJiraHostFromMeta(meta);
  const url = buildJiraIssueUrl(host, key);
  if (url) {
    const aria = ` aria-label="Open issue ${escapeHtml(key)} in Jira"`;
    const title = ` title="Open in Jira: ${escapeHtml(key)}"`;
    return `<span class="epic-key"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"${title}${aria}>${escapeHtml(key)}</a></span>`;
  }
  return `<span class="epic-key epic-key--unlinked" title="Jira host unavailable">${escapeHtml(key)}</span>`;
}

export function renderEpicTitleCell(epic) {
  if (epic?.epicTitle && String(epic.epicTitle).trim() !== '') {
    return escapeHtml(epic.epicTitle);
  }
  return '<span class="data-quality-warning" title="Title may be missing due to Jira permissions or Epic key access.">Epic title unavailable</span>';
}

export function renderEpicStoryList(epic, meta, rows) {
  const host = getResolvedJiraHostFromMeta(meta);
  const items = getEpicStoryItems(epic, rows);
  if (!items || items.length === 0) return '-';
  const pills = items.map(item => {
    const url = buildJiraIssueUrl(host, item.key);
    const label = escapeHtml(item.key || '');
    const summary = escapeHtml(item.summary || '');
    const titleText = summary ? `Open in Jira: ${item.key} — ${summary}` : `Open in Jira: ${item.key}`;
    const title = ` title="${escapeHtml(titleText)}"`;
    const aria = ` aria-label="Open issue ${escapeHtml(item.key || '')} in Jira"`;
    if (url) {
      return `<a class="story-pill" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"${title}${aria}>${label}</a>`;
    }
    return `<span class="story-pill story-pill--unlinked"${title}>${label}</span>`;
  });
  return pills.join(' ');
}

export function shouldShowJiraHostWarning(meta) {
  return !hasResolvedJiraHost(meta);
}

export function renderJiraLinksStatusLine(meta) {
  const availability = getJiraLinkAvailability(meta);
  const statusClass = availability.enabled ? 'jira-link-status--enabled' : 'jira-link-status--disabled';
  const statusText = availability.enabled ? 'Enabled' : 'Unavailable';
  const detail = availability.enabled
    ? 'Issue keys open directly in Jira.'
    : 'Issue keys are text only. Set JIRA_HOST to enable one-click navigation.';
  const mismatch = availability.mismatch
    ? '<small class="data-quality-warning">Host updated since cache generation; using latest configured Jira host.</small>'
    : '';
  return '<p class="metrics-hint jira-link-status-line">' +
    'Jira links: <span class="jira-link-status ' + statusClass + '">' + statusText + '</span> ' +
    escapeHtml(detail) +
    '</p>' + mismatch;
}

export function buildEpicTtmSectionHtml(epicRowsInput, meta, rows, options = {}) {
  const includeCompletionAnchor = options.includeCompletionAnchor === true;
  const wrapperClass = options.wrapperClass || 'data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit';
  let html = '';
  html += '<h3>Epic Time-To-Market</h3>';
  html += '<p class="metrics-hint"><strong>Definition:</strong> Epic Time-To-Market measures days from Epic creation to Epic resolution (or first story created to last story resolved if Epic dates unavailable).</p>';
  if (includeCompletionAnchor) {
    html += '<p class="metrics-hint"><small>Completion anchored to: Resolution date.</small></p>';
  }
  if (meta?.epicTTMFallbackCount > 0) {
    html += `<p class="data-quality-warning"><small>Note: ${meta.epicTTMFallbackCount} epic(s) used story date fallback (Epic issues unavailable).</small></p>`;
  }
  if (meta?.epicTitleMissingCount > 0) {
    html += `<p class="data-quality-warning"><small>Note: ${meta.epicTitleMissingCount} epic(s) are missing titles. Check Jira permissions or Epic keys.</small></p>`;
  }
  html += renderJiraLinksStatusLine(meta);
  html += '<div class="' + escapeHtml(wrapperClass) + '"><table class="data-table data-table--mobile-scroll"><thead><tr>' +
    '<th title="Epic identifier in Jira." data-tooltip="Epic identifier in Jira.">Epic Key</th>' +
    '<th class="cell-wrap" title="Epic summary/title." data-tooltip="Epic summary/title.">Epic Name</th>' +
    '<th class="cell-wrap" title="User stories linked to this epic in the window. Hover to see summaries." data-tooltip="User stories linked to this epic in the window. Hover to see summaries.">Story IDs</th>' +
    '<th title="Number of stories linked to the epic in this window." data-tooltip="Number of stories linked to the epic in this window.">Story Count</th>' +
    '<th title="Epic start date (Epic created or first story created if Epic dates missing)." data-tooltip="Epic start date (Epic created or first story created if Epic dates missing).">Start Date</th>' +
    '<th title="Epic end date (Epic resolved or last story resolved if Epic dates missing)." data-tooltip="Epic end date (Epic resolved or last story resolved if Epic dates missing).">End Date</th>' +
    '<th title="Calendar days from start to end (includes weekends)." data-tooltip="Calendar days from start to end (includes weekends).">Calendar TTM (days)</th>' +
    '<th title="Working days from start to end (excludes weekends). Use this to compare team flow." data-tooltip="Working days from start to end (excludes weekends). Use this to compare team flow.">Working TTM (days)</th>' +
    '<th title="Sum of subtask time spent (hours) across stories in this epic." data-tooltip="Sum of subtask time spent (hours) across stories in this epic.">Subtask Spent (Hrs)</th>' +
    '</tr></thead><tbody>';
  const epicRows = [...epicRowsInput, ...buildEpicAdhocRows(rows)];
  for (const epic of epicRows) {
    html += `<tr>
      <td>${renderEpicKeyCell(epic, meta)}</td>
      <td class="cell-wrap">${renderEpicTitleCell(epic)}</td>
      <td class="cell-wrap">${renderEpicStoryList(epic, meta, rows)}</td>
      <td>${epic.storyCount}</td>
      <td>${escapeHtml(formatDateForDisplay(epic.startDate))}</td>
      <td>${escapeHtml(formatDateForDisplay(epic.endDate || ''))}</td>
      <td>${epic.calendarTTMdays ?? ''}</td>
      <td>${epic.workingTTMdays ?? ''}</td>
      <td>${renderEpicSubtaskHours(epic)}</td>
    </tr>`;
  }
  html += '</tbody></table></div>';
  return html;
}

export function renderEpicSubtaskHours(epic) {
  if (epic?.subtaskSpentHours != null) {
    return formatNumber(Number(epic.subtaskSpentHours), 2);
  }
  return '';
}
