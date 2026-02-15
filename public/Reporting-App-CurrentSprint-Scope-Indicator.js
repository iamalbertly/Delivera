/**
 * Scope Change Indicator Chip
 * Displays scope % growth with color coding
 * Green: ≤5% scope growth, Yellow: 5-15%, Red: >15%
 * Modal shows added issues grouped by epic
 * Rationale: Customer - Scope creep is sprint killer; visible immediately. Simplicity - One chip vs. tab. Trust - Transparent tracking.
 */

import { escapeHtml, renderIssueKeyLink } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatNumber } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { createModalBehavior } from './Reporting-App-Core-UI-02Primitives-Modal.js';
import { buildJiraIssueUrl, getResolvedJiraHostFromMeta } from './Reporting-App-Report-Utils-Jira-Helpers.js';

export function renderScopeIndicator(data) {
  const scopeChanges = data.scopeChanges || [];
  const summary = data.summary || {};
  const totalSP = summary.totalSP ?? 0;

  if (scopeChanges.length === 0 || totalSP === 0) {
    return '';
  }

  // Calculate scope growth
  const scopeSP = scopeChanges.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
  const scopePercent = (scopeSP / totalSP) * 100;
  
  // Determine color
  let color = 'green';
  if (scopePercent > 15) {
    color = 'red';
  } else if (scopePercent > 5) {
    color = 'yellow';
  }

  // Count by type (feature vs bug)
  const features = scopeChanges.filter(i => (i.issuetype || '').toLowerCase() !== 'bug').length;
  const bugs = scopeChanges.filter(i => (i.issuetype || '').toLowerCase() === 'bug').length;

  let html = '<div class="scope-indicator-card" id="scope-changes-card">';
  html += '<div class="scope-indicator-chip ' + color + '" id="scope-indicator">';
  html += '<span class="scope-icon">📈</span>';
  html += '<span class="scope-text">Scope: +' + scopePercent.toFixed(0) + '% (' + scopeChanges.length + ' item' + (scopeChanges.length !== 1 ? 's' : '') + ')</span>';
  
  if (features > 0 || bugs > 0) {
    html += '<span class="scope-breakdown">';
    if (features > 0) html += features + ' stories';
    if (features > 0 && bugs > 0) html += ' | ';
    if (bugs > 0) html += bugs + ' bug' + (bugs !== 1 ? 's' : '');
    html += '</span>';
  }

  const jiraHost = getResolvedJiraHostFromMeta(data?.meta);
  const showInline = scopeChanges.length <= 15;
  const inlineLimit = 15;
  const itemsToShow = showInline ? scopeChanges : scopeChanges.slice(0, inlineLimit);

  if (scopeChanges.length > 15) {
    html += '<button class="scope-details-btn scope-view-all-btn" aria-label="View all scope changes">View all (' + scopeChanges.length + ')</button>';
  } else if (scopeChanges.length > 0) {
    html += '<button class="scope-details-btn scope-view-all-btn" aria-label="View scope details" style="display: none;">Details</button>';
  }
  html += '</div>';
  html += '</div>';

  const unestimatedCount = scopeChanges.filter(i => i.storyPoints == null || i.storyPoints === '').length;
  if (unestimatedCount > 0) {
    html += '<p class="scope-risk-line"><small>' + unestimatedCount + ' unestimated item' + (unestimatedCount !== 1 ? 's' : '') + ' added mid-sprint — commitment reliability unknown.</small></p>';
  }

  if (itemsToShow.length > 0) {
    html += '<p class="scope-impact-line"><strong>Scope added: ' + scopeChanges.length + ' item' + (scopeChanges.length !== 1 ? 's' : '') + ', +' + formatNumber(scopeSP, 1, '0') + ' SP (+' + scopePercent.toFixed(0) + '% of committed).</strong></p>';
    html += '<div class="scope-inline-table-wrap"><table class="scope-inline-table"><thead><tr><th>Issue</th><th class="cell-wrap">Summary</th><th>Type</th><th>SP</th><th>Status</th></tr></thead><tbody>';
    itemsToShow.forEach(issue => {
      const key = issue.key || issue.issueKey || '';
      const url = issue.issueUrl || buildJiraIssueUrl(jiraHost, key);
      const summary = issue.summary || issue.title || '';
      const spVal = issue.storyPoints;
      const spCell = (spVal != null && spVal !== '') ? formatNumber(Number(spVal), 1, String(spVal)) : '<span class="scope-unestimated">Unestimated</span>';
      html += '<tr>';
      html += '<td>' + renderIssueKeyLink(key, url) + '</td>';
      html += '<td class="cell-wrap" title="' + escapeHtml(summary) + '">' + escapeHtml(summary || '-').slice(0, 60) + (summary.length > 60 ? '…' : '') + '</td>';
      html += '<td>' + escapeHtml(issue.issuetype || '-') + '</td>';
      html += '<td>' + spCell + '</td>';
      html += '<td>' + escapeHtml(issue.status || '-') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    if (scopeChanges.length > inlineLimit) {
      html += '<p class="scope-inline-more"><small>Showing first ' + inlineLimit + '. Use View all for full list.</small></p>';
    }
    html += '</div>';
  }

  return html;
}

/**
 * Render scope changes modal (shown when clicking Details)
 */
export function renderScopeModal(data) {
  const scopeChanges = data.scopeChanges || [];
  const jiraHost = getResolvedJiraHostFromMeta(data?.meta);

  if (scopeChanges.length === 0) {
    return '';
  }

  // Group by epic
  const byEpic = {};
  scopeChanges.forEach(issue => {
    const epic = issue.epicName || issue.epicKey || '(No Epic)';
    if (!byEpic[epic]) {
      byEpic[epic] = [];
    }
    byEpic[epic].push(issue);
  });

  let html = '<div class="scope-modal-overlay" id="scope-modal" style="display: none;">';
  html += '<div class="scope-modal-content">';
  html += '<div class="modal-header">';
  html += '<h3>Scope Changes - New Issues Added</h3>';
  html += '<button class="modal-close-btn" aria-label="Close modal">✕</button>';
  html += '</div>';

  html += '<div class="modal-body">';
  Object.entries(byEpic).forEach(([epicName, issues]) => {
    const epicSP = issues.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
    html += '<div class="scope-epic-group">';
    html += '<h4>' + escapeHtml(epicName) + ' (' + epicSP + ' SP)</h4>';
    html += '<table class="scope-issues-table">';
    html += '<thead><tr><th>Issue</th><th class="cell-wrap">Summary</th><th>Type</th><th>SP</th><th>Status</th></tr></thead>';
    html += '<tbody>';
    issues.forEach(issue => {
      const key = issue.key || issue.issueKey || '';
      const url = issue.issueUrl || buildJiraIssueUrl(jiraHost, key);
      const summary = issue.summary || issue.title || '';
      const spVal = issue.storyPoints;
      const spCell = (spVal != null && spVal !== '') ? formatNumber(Number(spVal), 1, String(spVal)) : '<span class="scope-unestimated">Unestimated</span>';
      html += '<tr>';
      html += '<td>' + renderIssueKeyLink(key, url) + '</td>';
      html += '<td class="cell-wrap" title="' + escapeHtml(summary) + '">' + escapeHtml(summary || '-') + '</td>';
      html += '<td>' + escapeHtml(issue.issuetype || '-') + '</td>';
      html += '<td>' + spCell + '</td>';
      html += '<td>' + escapeHtml(issue.status || '-') + '</td>';
      html += '</tr>';
    });
    html += '</tbody>';
    html += '</table>';
    html += '</div>';
  });
  html += '</div>';

  html += '</div>';
  html += '</div>';

  return html;
}

/**
 * Wire scope indicator handlers (View all opens modal when many items)
 */
export function wireScopeIndicatorHandlers() {
  const indicator = document.querySelector('#scope-indicator');
  if (!indicator) return;
  const viewAllBtn = indicator.querySelector('.scope-view-all-btn');
  if (viewAllBtn && viewAllBtn.style.display !== 'none') {
    let modalController = null;
    viewAllBtn.addEventListener('click', () => {
      const modalEl = document.querySelector('#scope-modal');
      if (!modalEl) return;
      if (!modalController) {
        modalController = createModalBehavior('#scope-modal', {
          onOpen: () => { modalEl.style.display = 'flex'; },
          onClose: () => { modalEl.style.display = 'none'; }
        });
      }
      modalController.open();
    });
  }
}
