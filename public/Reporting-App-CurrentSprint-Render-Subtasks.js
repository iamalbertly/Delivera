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
  const excludedParents = Number(data?.summary?.stuckExcludedParentsWithActiveSubtasks || 0);

  // Group subtask risk rows under their parent issue key when available.
  const childrenByParentKey = new Map();
  const topLevelRows = [];
  for (const row of rows) {
    const isSubtaskSource = String(row.source || '').toLowerCase() === 'subtask';
    const parentKey = String(row.parentKey || '').trim().toUpperCase();
    if (isSubtaskSource && parentKey) {
      const list = childrenByParentKey.get(parentKey) || [];
      list.push(row);
      childrenByParentKey.set(parentKey, list);
    } else {
      topLevelRows.push(row);
    }
  }

  const initialLimit = resolveResponsiveRowLimit(20, 8);
  const toShow = topLevelRows.slice(0, initialLimit);
  const remainingParents = topLevelRows.slice(initialLimit);

  let html = '<div class="transparency-card" id="stuck-card">';
  // Short headline; avoid re-enumerating all risk types already explained below.
  html += '<div class="meta-row"><small id="scope-changes-card">One merged view for sprint risks.</small></div>';
  const blockerRows = rows.filter((row) => String(row.riskType || '').toLowerCase().includes('stuck >24h'));
  const blockerPreview = blockerRows.slice(0, 6);
  const groupedReasons = blockerRows.reduce((acc, row) => {
    const key = String(row.riskType || 'Risk');
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());
  html += '<h2>Work risks (Scope + Stuck + Sub-task + Sprint issues)</h2>';
  if (blockerRows.length > 0) {
    html += '<div class="work-risk-blocker-strip" aria-live="polite">';
    // Header already exposes the blocker count; keep this line focused on the list.
    html += '<strong>Blocker issues</strong>';
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
  html += '<p class="section-definition"><small>Single risk table for scope changes, blockers, tracking gaps, and ownership gaps.</small></p>';
  if (scopeChanges.length > 0) {
    html += '<p class="meta-row"><small>Scope impact: ' + scopeChanges.length + ' added mid-sprint, +' + formatNumber(scopeSP, 1, '0') + ' SP' + (scopeUnestimated > 0 ? ' (' + scopeUnestimated + ' unestimated)' : '') + '.</small></p>';
  }
  html += '<p class="meta-row"><small>Blocker threshold: in-progress for more than 24 hours with no movement on the issue or any of its subtasks.</small></p>';
  html += '<p class="meta-row"><small>Each issue is counted once as a blocker even when multiple risks apply; counts dedupe by issue key.</small></p>';
  if (excludedParents > 0) {
    html += '<p class="meta-row"><small>' + escapeHtml(String(excludedParents)) + ' parent stor' + (excludedParents === 1 ? 'y' : 'ies') + ' are flowing via subtasks and are not counted as blockers.</small></p>';
  }

  if (!rows.length) {
    html += '<p>No risks detected from scope changes, flow, sub-task tracking, or issue ownership.</p></div>';
    return html;
  }

  const headers = ['Source', 'Risk', 'Issue', 'Summary', 'Type', 'SP', 'Status', 'Reporter', 'Assignee', 'Est Hrs', 'Logged Hrs', 'Hours in status', 'Updated'];
  html += '<div class="data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit"><table class="data-table" id="work-risks-table" style="table-layout: auto;">';
  html += '<thead><tr><th>Source</th><th>Risk</th><th>Issue</th><th class="cell-wrap">Summary</th><th>Type</th><th>SP</th><th>Status</th><th>Reporter</th><th>Assignee</th><th>Est Hrs</th><th>Logged Hrs</th><th>Hours in status</th><th>Updated</th></tr></thead><tbody>';
  for (const row of toShow) {
    const riskTypeLower = String(row.riskType || '').toLowerCase();
    const isStuck = riskTypeLower.includes('stuck >24h');
    const isParentBlocker = isStuck && String(row.source || '').toLowerCase() === 'flow';
    const isSubtaskBlocker = isStuck && String(row.source || '').toLowerCase() === 'subtask';
    const riskLabel = isParentBlocker
      ? (row.riskType || 'Stuck >24h') + ' (Parent)'
      : (isSubtaskBlocker ? (row.riskType || 'Stuck >24h') + ' (Subtask)' : (row.riskType || '-'));
    const parentKey = String(row.issueKey || '').trim().toUpperCase();
    const childRows = parentKey ? (childrenByParentKey.get(parentKey) || []) : [];
    const hasChildren = childRows.length > 0;
    const parentClasses = hasChildren ? 'work-risk-parent-row work-risk-parent-has-children' : 'work-risk-parent-row';
    html += '<tr class="' + parentClasses + '" data-parent-key="' + escapeHtml(parentKey) + '"' + (hasChildren ? ' aria-expanded="true"' : '') + '>';
    let sourceLabel = escapeHtml(row.source || '-');
    if (hasChildren) {
      sourceLabel = '<button type="button" class="work-risks-toggle" aria-label="Toggle subtask risks" aria-expanded="true">▾</button>' + sourceLabel;
    }
    html += '<td data-label="' + escapeHtml(headers[0]) + '">' + sourceLabel + '</td>';
    html += '<td data-label="' + escapeHtml(headers[1]) + '">' + escapeHtml(riskLabel) + '</td>';
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
    if (hasChildren) {
      for (const child of childRows) {
        const childRiskTypeLower = String(child.riskType || '').toLowerCase();
        const childIsStuck = childRiskTypeLower.includes('stuck >24h');
        const childIsSubtaskBlocker = childIsStuck && String(child.source || '').toLowerCase() === 'subtask';
        const childRiskLabel = childIsSubtaskBlocker
          ? (child.riskType || 'Stuck >24h') + ' (Subtask)'
          : (child.riskType || '-');
        html += '<tr class="work-risk-subtask-row" data-parent-key="' + escapeHtml(parentKey) + '">';
        html += '<td data-label="' + escapeHtml(headers[0]) + '">' + escapeHtml(child.source || 'Subtask') + '</td>';
        html += '<td data-label="' + escapeHtml(headers[1]) + '">' + escapeHtml(childRiskLabel) + '</td>';
        html += '<td data-label="' + escapeHtml(headers[2]) + '">' + renderIssueKeyLink(child.issueKey || '-', child.issueUrl) + '</td>';
        html += '<td class="cell-wrap" data-label="' + escapeHtml(headers[3]) + '">' + escapeHtml(child.summary || '-') + '</td>';
        html += '<td data-label="' + escapeHtml(headers[4]) + '">' + escapeHtml(child.issueType || 'Sub-task') + '</td>';
        html += '<td data-label="' + escapeHtml(headers[5]) + '">' + (child.storyPoints == null ? '-' : formatNumber(child.storyPoints, 1, '-')) + '</td>';
        html += '<td data-label="' + escapeHtml(headers[6]) + '">' + escapeHtml(child.status || '-') + '</td>';
        html += '<td data-label="' + escapeHtml(headers[7]) + '">' + escapeHtml(child.reporter || '-') + '</td>';
        html += '<td data-label="' + escapeHtml(headers[8]) + '">' + escapeHtml(child.assignee || '-') + '</td>';
        html += '<td data-label="' + escapeHtml(headers[9]) + '">' + (child.estimateHours == null ? '-' : formatNumber(child.estimateHours, 1, '-')) + '</td>';
        html += '<td data-label="' + escapeHtml(headers[10]) + '">' + (child.loggedHours == null ? '-' : formatNumber(child.loggedHours, 1, '-')) + '</td>';
        html += '<td data-label="' + escapeHtml(headers[11]) + '">' + (child.hoursInStatus == null ? '-' : formatNumber(child.hoursInStatus, 1, '-')) + '</td>';
        html += '<td data-label="' + escapeHtml(headers[12]) + '">' + escapeHtml(formatDateTime(child.updated)) + '</td>';
        html += '</tr>';
      }
    }
  }
  html += '</tbody></table></div>';

  if (remainingParents.length > 0) {
    html += '<button class="btn btn-secondary btn-compact work-risks-show-more" data-count="' + remainingParents.length + '">Show ' + remainingParents.length + ' more</button>';
    html += '<template id="work-risks-more-template">';
    for (const row of remainingParents) {
      const riskTypeLower = String(row.riskType || '').toLowerCase();
      const isStuck = riskTypeLower.includes('stuck >24h');
      const isParentBlocker = isStuck && String(row.source || '').toLowerCase() === 'flow';
      const isSubtaskBlocker = isStuck && String(row.source || '').toLowerCase() === 'subtask';
      const riskLabel = isParentBlocker
        ? (row.riskType || 'Stuck >24h') + ' (Parent)'
        : (isSubtaskBlocker ? (row.riskType || 'Stuck >24h') + ' (Subtask)' : (row.riskType || '-'));
      const parentKey = String(row.issueKey || '').trim().toUpperCase();
      const childRows = parentKey ? (childrenByParentKey.get(parentKey) || []) : [];
      const hasChildren = childRows.length > 0;
      const parentClasses = hasChildren ? 'work-risk-parent-row work-risk-parent-has-children' : 'work-risk-parent-row';
      html += '<tr class="' + parentClasses + '" data-parent-key="' + escapeHtml(parentKey) + '"' + (hasChildren ? ' aria-expanded="true"' : '') + '>';
      let sourceLabel = escapeHtml(row.source || '-');
      if (hasChildren) {
        sourceLabel = '<button type="button" class="work-risks-toggle" aria-label="Toggle subtask risks" aria-expanded="true">▾</button>' + sourceLabel;
      }
      html += '<td data-label="Source">' + sourceLabel + '</td>';
      html += '<td data-label="Risk">' + escapeHtml(riskLabel) + '</td>';
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
      if (hasChildren) {
        for (const child of childRows) {
          const childRiskTypeLower = String(child.riskType || '').toLowerCase();
          const childIsStuck = childRiskTypeLower.includes('stuck >24h');
          const childIsSubtaskBlocker = childIsStuck && String(child.source || '').toLowerCase() === 'subtask';
          const childRiskLabel = childIsSubtaskBlocker
            ? (child.riskType || 'Stuck >24h') + ' (Subtask)'
            : (child.riskType || '-');
          html += '<tr class="work-risk-subtask-row" data-parent-key="' + escapeHtml(parentKey) + '">';
          html += '<td data-label="Source">' + escapeHtml(child.source || 'Subtask') + '</td>';
          html += '<td data-label="Risk">' + escapeHtml(childRiskLabel) + '</td>';
          html += '<td data-label="Issue">' + renderIssueKeyLink(child.issueKey || '-', child.issueUrl) + '</td>';
          html += '<td class="cell-wrap" data-label="Summary">' + escapeHtml(child.summary || '-') + '</td>';
          html += '<td data-label="Type">' + escapeHtml(child.issueType || 'Sub-task') + '</td>';
          html += '<td data-label="SP">' + (child.storyPoints == null ? '-' : formatNumber(child.storyPoints, 1, '-')) + '</td>';
          html += '<td data-label="Status">' + escapeHtml(child.status || '-') + '</td>';
          html += '<td data-label="Reporter">' + escapeHtml(child.reporter || '-') + '</td>';
          html += '<td data-label="Assignee">' + escapeHtml(child.assignee || '-') + '</td>';
          html += '<td data-label="Est Hrs">' + (child.estimateHours == null ? '-' : formatNumber(child.estimateHours, 1, '-')) + '</td>';
          html += '<td data-label="Logged Hrs">' + (child.loggedHours == null ? '-' : formatNumber(child.loggedHours, 1, '-')) + '</td>';
          html += '<td data-label="Hours in status">' + (child.hoursInStatus == null ? '-' : formatNumber(child.hoursInStatus, 1, '-')) + '</td>';
          html += '<td data-label="Updated">' + escapeHtml(formatDateTime(child.updated)) + '</td>';
          html += '</tr>';
        }
      }
    }
    html += '</template>';
  }

  html += '</div>';
  return html;
}

export function wireSubtasksShowMoreHandlers() {
  wireShowMoreHandler('.work-risks-show-more', 'work-risks-more-template', '#work-risks-table tbody');
  try {
    const table = document.getElementById('work-risks-table');
    if (!table) return;
    table.addEventListener('click', (event) => {
      const toggle = event.target.closest('.work-risks-toggle');
      if (!toggle || !table.contains(toggle)) return;
      const parentRow = toggle.closest('.work-risk-parent-row');
      if (!parentRow) return;
      const parentKey = parentRow.getAttribute('data-parent-key') || '';
      const expanded = parentRow.getAttribute('aria-expanded') === 'true';
      const next = !expanded;
      parentRow.setAttribute('aria-expanded', next ? 'true' : 'false');
      toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
      if (!parentKey) return;
      const childRows = table.querySelectorAll('.work-risk-subtask-row[data-parent-key="' + parentKey + '"]');
      childRows.forEach((row) => {
        if (next) {
          row.removeAttribute('hidden');
        } else {
          row.setAttribute('hidden', 'hidden');
        }
      });
    });
  } catch (_) {}
}
