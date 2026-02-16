import { escapeHtml, renderIssueKeyLink } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDateTime, formatNumber } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { resolveResponsiveRowLimit } from './Reporting-App-Shared-Responsive-Helpers.js';
import { wireShowMoreHandler } from './Reporting-App-Shared-ShowMore-Handlers.js';
import { buildMergedWorkRiskRows } from './Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';

export function renderWorkRisksMerged(data) {
  const rows = buildMergedWorkRiskRows(data);
  const scopeChanges = data.scopeChanges || [];
  const scopeSP = scopeChanges.reduce((sum, row) => sum + (Number(row.storyPoints) || 0), 0);
  const scopeUnestimated = scopeChanges.filter((row) => row.storyPoints == null || row.storyPoints === '').length;
  const initialLimit = resolveResponsiveRowLimit(20, 8);
  const toShow = rows.slice(0, initialLimit);
  const remaining = rows.slice(initialLimit);

  let html = '<div class="transparency-card" id="stuck-card">';
  html += '<div class="meta-row"><small id="scope-changes-card">Scope changes merged with stuck flow, sub-task tracking, and sprint ownership.</small></div>';
  const blockerRows = rows.filter((row) => String(row.riskType || '').toLowerCase().includes('stuck') || Number(row.hoursInStatus || 0) >= 24);
  const blockerPreview = blockerRows.slice(0, 6);
  const groupedReasons = blockerRows.reduce((acc, row) => {
    const key = String(row.riskType || 'Risk');
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());
  html += '<h2>Work risks (Scope + Stuck + Sub-task + Sprint issues)</h2>';
  if (blockerRows.length > 0) {
    html += '<div class="work-risk-blocker-strip" aria-live="polite">';
    html += '<strong>Blockers now: ' + blockerRows.length + '</strong>';
    if (blockerPreview.length > 0) {
      html += '<span class="work-risk-blocker-links">';
      blockerPreview.forEach((row) => {
        html += renderIssueKeyLink(row.issueKey || '-', row.issueUrl) + ' ';
      });
      if (blockerRows.length > blockerPreview.length) {
        html += '<span class="work-risk-blocker-more">+' + (blockerRows.length - blockerPreview.length) + ' more</span>';
      }
      html += '</span>';
    }
    if (groupedReasons.size > 0) {
      const reasonText = [...groupedReasons.entries()].slice(0, 3).map(([reason, count]) => reason + ': ' + count).join(' · ');
      html += '<div class="work-risk-blocker-reasons">Why: ' + escapeHtml(reasonText) + '</div>';
    }
    html += '</div>';
  }
  html += '<p class="section-definition"><small>Scope changes, items stuck >24h, sub-task time-tracking risks, and in-sprint ownership gaps in one place.</small></p>';
  if (scopeChanges.length > 0) {
    html += '<p class="meta-row"><small>Scope impact: ' + scopeChanges.length + ' added mid-sprint, +' + formatNumber(scopeSP, 1, '0') + ' SP' + (scopeUnestimated > 0 ? ' (' + scopeUnestimated + ' unestimated)' : '') + '.</small></p>';
  }
  html += '<p class="meta-row"><small>Stuck threshold: in-progress for more than 24 hours.</small></p>';

  if (!rows.length) {
    html += '<p>No risks detected from scope changes, flow, sub-task tracking, or issue ownership.</p>';
    html += '</div>';
    return html;
  }

  const headers = ['Source', 'Risk', 'Issue', 'Summary', 'Type', 'SP', 'Status', 'Reporter', 'Assignee', 'Est Hrs', 'Logged Hrs', 'Hours in status', 'Updated'];
  html += '<div class="data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit"><table class="data-table" id="work-risks-table" style="table-layout: auto;">';
  html += '<thead><tr><th>Source</th><th>Risk</th><th>Issue</th><th class="cell-wrap">Summary</th><th>Type</th><th>SP</th><th>Status</th><th>Reporter</th><th>Assignee</th><th>Est Hrs</th><th>Logged Hrs</th><th>Hours in status</th><th>Updated</th></tr></thead><tbody>';

  for (const row of toShow) {
    html += '<tr>';
    html += '<td data-label="' + escapeHtml(headers[0]) + '">' + escapeHtml(row.source || '-') + '</td>';
    html += '<td data-label="' + escapeHtml(headers[1]) + '">' + escapeHtml(row.riskType || '-') + '</td>';
    html += '<td data-label="' + escapeHtml(headers[2]) + '">' + renderIssueKeyLink(row.issueKey || '-', row.issueUrl) + '</td>';
    html += '<td class="cell-wrap" data-label="' + escapeHtml(headers[3]) + '">' + escapeHtml(row.summary || '-') + '</td>';
    html += '<td data-label="' + escapeHtml(headers[4]) + '">' + escapeHtml(row.issueType || '-') + '</td>';
    html += '<td data-label="' + escapeHtml(headers[5]) + '">' + (row.storyPoints == null ? '-' : formatNumber(row.storyPoints, 1, '-')) + '</td>';
    html += '<td data-label="' + escapeHtml(headers[6]) + '">' + escapeHtml(row.status || '-') + '</td>';
    html += '<td data-label="' + escapeHtml(headers[7]) + '">' + escapeHtml(row.reporter || '-') + '</td>';
    html += '<td data-label="' + escapeHtml(headers[8]) + '">' + escapeHtml(row.assignee || '-') + '</td>';
    html += '<td data-label="' + escapeHtml(headers[9]) + '">' + (row.estimateHours == null ? '-' : formatNumber(row.estimateHours, 1, '-')) + '</td>';
    html += '<td data-label="' + escapeHtml(headers[10]) + '">' + (row.loggedHours == null ? '-' : formatNumber(row.loggedHours, 1, '-')) + '</td>';
    html += '<td data-label="' + escapeHtml(headers[11]) + '">' + (row.hoursInStatus == null ? '-' : formatNumber(row.hoursInStatus, 1, '-')) + '</td>';
    html += '<td data-label="' + escapeHtml(headers[12]) + '">' + escapeHtml(formatDateTime(row.updated)) + '</td>';
    html += '</tr>';
  }

  html += '</tbody></table></div>';

  if (remaining.length > 0) {
    html += '<button class="btn btn-secondary btn-compact work-risks-show-more" data-count="' + remaining.length + '">Show ' + remaining.length + ' more</button>';
    html += '<template id="work-risks-more-template">';
    for (const row of remaining) {
      html += '<tr>';
      html += '<td data-label="Source">' + escapeHtml(row.source || '-') + '</td>';
      html += '<td data-label="Risk">' + escapeHtml(row.riskType || '-') + '</td>';
      html += '<td data-label="Issue">' + renderIssueKeyLink(row.issueKey || '-', row.issueUrl) + '</td>';
      html += '<td class="cell-wrap" data-label="Summary">' + escapeHtml(row.summary || '-') + '</td>';
      html += '<td data-label="Type">' + escapeHtml(row.issueType || '-') + '</td>';
      html += '<td data-label="SP">' + (row.storyPoints == null ? '-' : formatNumber(row.storyPoints, 1, '-')) + '</td>';
      html += '<td data-label="Status">' + escapeHtml(row.status || '-') + '</td>';
      html += '<td data-label="Reporter">' + escapeHtml(row.reporter || '-') + '</td>';
      html += '<td data-label="Assignee">' + escapeHtml(row.assignee || '-') + '</td>';
      html += '<td data-label="Est Hrs">' + (row.estimateHours == null ? '-' : formatNumber(row.estimateHours, 1, '-')) + '</td>';
      html += '<td data-label="Logged Hrs">' + (row.loggedHours == null ? '-' : formatNumber(row.loggedHours, 1, '-')) + '</td>';
      html += '<td data-label="Hours in status">' + (row.hoursInStatus == null ? '-' : formatNumber(row.hoursInStatus, 1, '-')) + '</td>';
      html += '<td data-label="Updated">' + escapeHtml(formatDateTime(row.updated)) + '</td>';
      html += '</tr>';
    }
    html += '</template>';
  }

  html += '</div>';
  return html;
}

export function renderStuckCandidates(data) {
  const stuck = data.stuckCandidates || [];
  let html = '<div class="transparency-card" id="stuck-card">';
  html += '<h2>Items stuck &gt; 24 hours</h2>';
  html += '<p class="section-definition"><small>Stuck: issues in progress &gt;24h.</small></p>';
  html += '<p class="meta-row"><small>Based on last status category change (fallback to last update).</small></p>';
  if (!stuck.length) {
    html += '<p>0 items in progress &gt;24h.</p>';
    html += '<p class="meta-row"><small>No issues in progress &gt;24h. Check back if work is blocked. Nothing stuck. If something is blocked, it will appear here after 24h.</small></p>';
  } else {
    // Limit initial rows to reduce DOM nodes
    const initialLimit = 10;
    html += '<div class="data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit"><table class="data-table" id="stuck-table"><thead><tr><th>Issue</th><th class="cell-wrap">Summary</th><th>Status</th><th>Assignee</th><th>Hours in status</th><th>Updated</th></tr></thead><tbody>';
    const toShow = stuck.slice(0, initialLimit);
    const remaining = stuck.slice(initialLimit);
    for (const row of toShow) {
      html += '<tr>';
      html += '<td>' + renderIssueKeyLink(row.issueKey || row.key, row.issueUrl) + '</td>';
      html += '<td class="cell-wrap">' + escapeHtml(row.summary || '-') + '</td>';
      html += '<td>' + escapeHtml(row.status || '-') + '</td>';
      html += '<td>' + escapeHtml(row.assignee || '-') + '</td>';
      html += '<td>' + formatNumber(row.hoursInStatus ?? 0, 1, '-') + '</td>';
      html += '<td>' + escapeHtml(formatDateTime(row.updated)) + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';

    if (remaining.length > 0) {
      // Provide a show-more button and a template with remaining rows
      html += '<button class="btn btn-secondary btn-compact stuck-show-more" data-count="' + remaining.length + '">Show ' + remaining.length + ' more</button>';
      html += '<template id="stuck-more-template">';
      for (const row of remaining) {
        html += '<tr>';
        html += '<td>' + renderIssueKeyLink(row.issueKey || row.key, row.issueUrl) + '</td>';
        html += '<td class="cell-wrap">' + escapeHtml(row.summary || '-') + '</td>';
        html += '<td>' + escapeHtml(row.status || '-') + '</td>';
        html += '<td>' + escapeHtml(row.assignee || '-') + '</td>';
        html += '<td>' + formatNumber(row.hoursInStatus ?? 0, 1, '-') + '</td>';
        html += '<td>' + escapeHtml(formatDateTime(row.updated)) + '</td>';
        html += '</tr>';
      }
      html += '</template>';
    }
  }
  html += '</div>';
  return html;
}

export function renderSubtaskTracking(data) {
  const tracking = data.subtaskTracking || {};
  const summary = tracking.summary || {};
  const rows = tracking.rows || [];
  let html = '<div class="transparency-card" id="subtask-tracking-card">';
  html += '<h2>Sub-task time tracking</h2>';
  html += '<p class="meta-row"><span>Estimated:</span> <strong>' + formatNumber(summary.totalEstimateHours || 0, 1, '-') + ' h</strong>' +
    ' <span>Logged:</span> <strong>' + formatNumber(summary.totalLoggedHours || 0, 1, '-') + ' h</strong>' +
    ' <span>Remaining:</span> <strong>' + formatNumber(summary.totalRemainingHours || 0, 1, '-') + ' h</strong></p>';
  if (!rows.length) {
    html += '<p>No sub-tasks with time tracking in this sprint.</p>';
  } else {
    const initialLimit = 10;
    const toShow = rows.slice(0, initialLimit);
    const remaining = rows.slice(initialLimit);

    html += '<div class="data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit"><table class="data-table" id="subtask-table">';
    html += '<thead><tr><th>Sub-task</th><th class="cell-wrap">Summary</th><th>Status</th><th>Assignee</th><th>Estimate</th><th>Logged</th><th>Remaining</th><th>Hours in status</th><th>Created</th><th>Updated</th></tr></thead><tbody>';
    for (const row of toShow) {
      const hoursCell = row.hoursInStatus != null
        ? (row.hoursInStatus >= 24 ? '<span class="flag-warn">' + formatNumber(row.hoursInStatus, 1, '-') + '</span>' : formatNumber(row.hoursInStatus, 1, '-'))
        : '-';
      html += '<tr>';
      html += '<td>' + renderIssueKeyLink(row.issueKey || row.key, row.issueUrl) + '</td>';
      html += '<td class="cell-wrap">' + escapeHtml(row.summary || '-') + '</td>';
      html += '<td>' + escapeHtml(row.status || '-') + '</td>';
      html += '<td>' + escapeHtml(row.assignee || '-') + '</td>';
      html += '<td>' + formatNumber(row.estimateHours || 0, 1, '-') + '</td>';
      html += '<td>' + formatNumber(row.loggedHours || 0, 1, '-') + '</td>';
      html += '<td>' + formatNumber(row.remainingHours || 0, 1, '-') + '</td>';
      html += '<td>' + hoursCell + '</td>';
      html += '<td>' + escapeHtml(formatDateTime(row.created)) + '</td>';
      html += '<td>' + escapeHtml(formatDateTime(row.updated)) + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';

    if (remaining.length > 0) {
      html += '<button class="btn btn-secondary btn-compact subtask-show-more" data-count="' + remaining.length + '">Show ' + remaining.length + ' more</button>';
      html += '<template id="subtask-more-template">';
      for (const row of remaining) {
        const hoursCell = row.hoursInStatus != null
          ? (row.hoursInStatus >= 24 ? '<span class="flag-warn">' + formatNumber(row.hoursInStatus, 1, '-') + '</span>' : formatNumber(row.hoursInStatus, 1, '-'))
          : '-';
        html += '<tr>';
        html += '<td>' + renderIssueKeyLink(row.issueKey || row.key, row.issueUrl) + '</td>';
        html += '<td class="cell-wrap">' + escapeHtml(row.summary || '-') + '</td>';
        html += '<td>' + escapeHtml(row.status || '-') + '</td>';
        html += '<td>' + escapeHtml(row.assignee || '-') + '</td>';
        html += '<td>' + formatNumber(row.estimateHours || 0, 1, '-') + '</td>';
        html += '<td>' + formatNumber(row.loggedHours || 0, 1, '-') + '</td>';
        html += '<td>' + formatNumber(row.remainingHours || 0, 1, '-') + '</td>';
        html += '<td>' + hoursCell + '</td>';
        html += '<td>' + escapeHtml(formatDateTime(row.created)) + '</td>';
        html += '<td>' + escapeHtml(formatDateTime(row.updated)) + '</td>';
        html += '</tr>';
      }
      html += '</template>';
    }
  }
  html += '</div>';
  return html;
}

export function buildNotificationMessage(data, group) {
  if (!group) return '';
  const missingEstimate = group.missingEstimate || [];
  const missingLogged = group.missingLogged || [];
  const seen = new Set();
  const items = [];
  for (const row of missingEstimate) {
    const key = row.issueKey || row.key || '';
    if (key && !seen.has(key)) {
      seen.add(key);
      items.push({ ...row, missingEstimate: true, missingLogged: false });
    } else if (key) {
      const existing = items.find((i) => (i.issueKey || i.key) === key);
      if (existing) existing.missingEstimate = true;
    }
  }
  for (const row of missingLogged) {
    const key = row.issueKey || row.key || '';
    if (key && !seen.has(key)) {
      seen.add(key);
      items.push({ ...row, missingEstimate: false, missingLogged: true });
    } else if (key) {
      const existing = items.find((i) => (i.issueKey || i.key) === key);
      if (existing) existing.missingLogged = true;
    }
  }
  const lines = ['Hello team,'];
  lines.push('We have a few items missing time tracking on the current sprint snapshot:');
  for (const item of items) {
    const key = item.issueKey || item.key || '';
    const parentLabel = item.parentKey ? (item.parentKey + (item.parentSummary ? ' - ' + item.parentSummary : '')) : 'N/A';
    if (item.missingEstimate) {
      lines.push(
        `- ${key}: ${item.summary || ''} (Missing estimate)` +
        ` - Created: ${formatDateTime(item.created)}; Updated: ${formatDateTime(item.updated)}; Estimate: - ; Logged: ${formatNumber(item.loggedHours || 0, 1, '-')}h; Parent: ${parentLabel}.`
      );
    }
    if (item.missingLogged) {
      lines.push(
        `- ${key}: ${item.summary || ''} (Missing log)` +
        ` - Created: ${formatDateTime(item.created)}; Updated: ${formatDateTime(item.updated)}; Estimate: ${formatNumber(item.estimateHours || 0, 1, '-')}h; Logged: 0h; Parent: ${parentLabel}.`
      );
    }
    if (item.issueUrl) {
      lines.push(`Open: ${item.issueUrl}`);
    }
  }
  lines.push('If you already updated these since this snapshot, thanks - no further action needed.');
  return lines.join('\n');
}

export function renderNotifications(data) {
  const tracking = data.subtaskTracking || {};
  const notifications = tracking.notifications || [];
  if (!notifications.length) return '';
  const byAssignee = tracking.notificationsByAssignee || [];
  const byReporter = tracking.notificationsByReporter || [];

  let html = '<div class="transparency-card" id="notifications-card">';
  html += '<h2>Time tracking alerts</h2>';
  html += '<p class="meta-row"><small>Missing estimates / No log. Use this message to prompt assignees/reporters to update time tracking. Open Current Sprint to view details.</small></p>';
  const generatedAt = (data.meta && data.meta.generatedAt) ? new Date(data.meta.generatedAt).toISOString() : new Date().toISOString();
  html += '<p class="meta-row generated-at"><small>Generated at ' + generatedAt + ' UTC</small></p>';
  html += '<div class="notification-controls">' +
    '<label>Group by</label>' +
    '<select id="notification-group">' +
    '<option value="assignee">Assignee</option>' +
    '<option value="reporter">Reporter</option>' +
    '</select>' +
    '<label>Recipient</label>' +
    '<select id="notification-recipient"></select>' +
    '<button class="btn btn-secondary btn-compact" type="button" id="notification-copy">Copy message</button>' +
    '</div>';
  html += '<textarea id="notification-message" rows="8"></textarea>';
  html += '<div id="notification-status" class="notification-status"></div>';
  html += '</div>';

  return html;
}

export function wireSubtasksShowMoreHandlers() {
  wireShowMoreHandler('.work-risks-show-more', 'work-risks-more-template', '#work-risks-table tbody');
  wireShowMoreHandler('.stuck-show-more', 'stuck-more-template', '#stuck-table tbody');
  wireShowMoreHandler('.subtask-show-more', 'subtask-more-template', '#subtask-table tbody');
}
