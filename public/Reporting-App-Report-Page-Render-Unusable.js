import { renderEmptyState } from './Reporting-App-Report-Page-Render-Helpers.js';
import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';

function getReasonGuidance(reason) {
  const lower = String(reason || '').toLowerCase();
  if (lower.includes('missing end') || lower.includes('no end date')) {
    return 'Add an end date in Jira for this sprint so it can be included in performance calculations.';
  }
  if (lower.includes('missing start') || lower.includes('no start date')) {
    return 'Add a start date in Jira for this sprint so it can be included in performance calculations.';
  }
  if (lower.includes('overlap')) {
    return 'Adjust sprint dates in Jira so they do not overlap with other sprints on the same board.';
  }
  if (lower.includes('future') || lower.includes('not started')) {
    return 'Wait until the sprint has valid start and end dates before including it in historical reports.';
  }
  return 'Review this sprint’s dates and configuration in Jira so it can be included in reports.';
}

export function renderUnusableSprintsTab(unusable) {
  const content = document.getElementById('unusable-sprints-content');

  if (!unusable || unusable.length === 0) {
    renderEmptyState(
      content,
      'No unusable sprints',
      'All sprints in the selected date range have valid start and end dates.',
      'Add start/end dates in Jira for these sprints, or expand the date window.'
    );
    return;
  }

  const total = unusable.length;
  const byReason = new Map();
  for (const sprint of unusable) {
    const reason = sprint.reason || 'Unspecified';
    const key = reason;
    byReason.set(key, (byReason.get(key) || 0) + 1);
  }

  let html = '<div class="unusable-sprints-summary">';
  html += '<p><strong>' + total + ' sprint' + (total === 1 ? '' : 's') + ' excluded from metrics.</strong> These sprints do not affect your Performance overview numbers.</p>';
  if (byReason.size > 0) {
    html += '<ul>';
    for (const [reason, count] of byReason.entries()) {
      const guidance = getReasonGuidance(reason);
      html += '<li><strong>' + count + '</strong> with reason "' + escapeHtml(reason) + '" — Fix in Jira: ' + escapeHtml(guidance) + '</li>';
    }
    html += '</ul>';
  }
  html += '</div>';

  html += '<table class="data-table"><thead><tr><th>Board</th><th>Sprint</th><th>Reason</th></tr></thead><tbody>';

  for (const sprint of unusable) {
    html += `
      <tr>
        <td>${escapeHtml(sprint.boardName || '')}</td>
        <td>${escapeHtml(sprint.name || '')}</td>
        <td>${escapeHtml(sprint.reason || '')}</td>
      </tr>
    `;
  }

  html += '</tbody></table>';
  content.innerHTML = html;
}
