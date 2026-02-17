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
  html += '<div class="meta-row"><small id="scope-changes-card">Merged risk view: scope, blockers, tracking, and ownership.</small></div>';
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
      blockerPreview.forEach((row) => { html += renderIssueKeyLink(row.issueKey || '-', row.issueUrl) + ' '; });
      if (blockerRows.length > blockerPreview.length) {
        html += '<span class="work-risk-blocker-more">+' + (blockerRows.length - blockerPreview.length) + ' more</span>';
      }
      html += '</span>';
    }
    if (groupedReasons.size > 0) {
      const reasonText = [...groupedReasons.entries()].slice(0, 3).map(([reason, count]) => reason + ': ' + count).join(' | ');
      html += '<div class="work-risk-blocker-reasons">Why: ' + escapeHtml(reasonText) + '</div>';
    }
    html += '</div>';
  }
  html += '<p class="section-definition"><small>Single risk table: scope changes, blockers, tracking gaps, and ownership gaps.</small></p>';
  if (scopeChanges.length > 0) {
    html += '<p class="meta-row"><small>Scope impact: ' + scopeChanges.length + ' added mid-sprint, +' + formatNumber(scopeSP, 1, '0') + ' SP' + (scopeUnestimated > 0 ? ' (' + scopeUnestimated + ' unestimated)' : '') + '.</small></p>';
  }
  html += '<p class="meta-row"><small>Blocker threshold: in-progress for more than 24 hours.</small></p>';

  if (!rows.length) {
    html += '<p>No risks detected from scope changes, flow, sub-task tracking, or issue ownership.</p></div>';
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

export function wireSubtasksShowMoreHandlers() {
  wireShowMoreHandler('.work-risks-show-more', 'work-risks-more-template', '#work-risks-table tbody');
}
