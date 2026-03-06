import { escapeHtml, renderIssueKeyLink } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDateTime, formatNumber } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { resolveResponsiveRowLimit } from './Reporting-App-Shared-Responsive-Helpers.js';
import { wireShowMoreHandler } from './Reporting-App-Shared-ShowMore-Handlers.js';
import { buildMergedWorkRiskRows } from './Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';

function riskPriorityWeight(row) {
  const risk = String(row?.riskType || '').toLowerCase();
  const status = String(row?.status || '').toLowerCase();
  const source = String(row?.source || '').toLowerCase();
  const hours = Number(row?.hoursInStatus || 0);
  const updatedTs = new Date(row?.updated || 0).getTime();
  let score = 0;
  if (risk.includes('stuck >24h')) score += 1000;
  if (risk.includes('missing estimate')) score += 350;
  if (risk.includes('no log yet')) score += 300;
  if (risk.includes('added mid-sprint')) score += 200;
  if (!row?.assignee || row.assignee === '-' || String(row.assignee).toLowerCase() === 'unassigned') score += 220;
  if (source === 'flow') score += 80;
  if (status.includes('in progress')) score += 60;
  if (status.includes('done')) score -= 40;
  score += Math.min(120, Math.round(hours));
  if (Number.isFinite(updatedTs) && updatedTs > 0) {
    const ageHours = Math.max(0, (Date.now() - updatedTs) / (1000 * 60 * 60));
    score += Math.min(80, Math.round(ageHours));
  }
  return score;
}

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
  topLevelRows.sort((a, b) => {
    const diff = riskPriorityWeight(b) - riskPriorityWeight(a);
    if (diff !== 0) return diff;
    const aHours = Number(a?.hoursInStatus || 0);
    const bHours = Number(b?.hoursInStatus || 0);
    if (aHours !== bHours) return bHours - aHours;
    return String(a?.issueKey || '').localeCompare(String(b?.issueKey || ''));
  });

  const initialLimit = resolveResponsiveRowLimit(20, 8);
  const toShow = topLevelRows.slice(0, initialLimit);
  const remainingParents = topLevelRows.slice(initialLimit);

  let html = '<div class="transparency-card" id="stuck-card">';
  // Short headline; avoid re-enumerating all risk types already explained below.
  html += '<div class="meta-row"><small id="scope-changes-card">One merged view for sprint risks.</small></div>';
  const blockerRows = rows.filter((row) => row.isOwnedBlocker);
  const blockerInProgress = blockerRows.filter((row) => {
    const st = String(row.status || '').toLowerCase();
    return st && st !== 'to do' && st !== 'open' && st !== 'backlog';
  }).length;
  const blockerNotStarted = Math.max(0, blockerRows.length - blockerInProgress);
  const noLogRows = rows.filter((row) => String(row.riskType || '').toLowerCase().includes('no log yet')).length;
  const noEstimateRows = rows.filter((row) => String(row.riskType || '').toLowerCase().includes('missing estimate')).length;
  const unassignedRows = rows.filter((row) => row.isUnownedOutcome).length;
  const blockerPreview = blockerRows.slice(0, 6);
  const groupedReasons = blockerRows.reduce((acc, row) => {
    const key = String(row.riskType || 'Risk');
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());
  html += '<h2>Work risks</h2>';
  if (blockerRows.length > 0) {
    html += '<div class="work-risk-blocker-strip" aria-live="polite">';
    html += '<strong>Blockers (owned)</strong>';
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
  } else {
    html += '<p class="meta-row"><small>No owned blockers in this sprint.</small></p>';
  }
  // Compact meta: one-line context only, definitions moved to table header tooltips
  const metaParts = [];
  if (scopeChanges.length > 0) metaParts.push('+' + scopeChanges.length + ' scope (' + formatNumber(scopeSP, 1, '0') + ' SP)');
  if (excludedParents > 0) metaParts.push(excludedParents + ' parent' + (excludedParents > 1 ? 's' : '') + ' via subtasks');
  if (metaParts.length > 0) {
    html += '<p class="meta-row"><small>' + escapeHtml(metaParts.join(' | ')) + '</small></p>';
  }
  html += '<p class="meta-row"><small>Use header <strong>View as</strong> to filter Work risks and Issues together.</small></p>';
  if (noEstimateRows > 0 || noLogRows > 0) {
    html += '<p class="meta-row"><small>Interpretation rule: "Missing estimate" = no planning baseline; "No log yet" = baseline exists, actual effort missing.</small></p>';
  }

  if (!rows.length) {
    html += '<p>No risks detected from scope changes, flow, sub-task tracking, or issue ownership.</p></div>';
    return html;
  }

  const headers = ['Source', 'Risk', 'Issue', 'Summary', 'Type', 'SP', 'Status', 'Reporter', 'Assignee', 'Est Hrs', 'Logged Hrs', 'Hours in status', 'Updated'];
  html += '<p class="meta-row"><small>Each issue is counted once as a blocker even when multiple risks apply; counts dedupe by issue key.</small></p>';
  html += '<div class="data-table-scroll-wrap data-table-scroll-wrap--with-vertical-limit"><table class="data-table" id="work-risks-table" style="table-layout: auto;">';
  html += '<thead><tr>'
    + '<th data-sort-key="source" tabindex="0" role="button" aria-label="Sort by source">Source</th>'
    + '<th data-sort-key="risk" tabindex="0" role="button" aria-label="Sort by risk" title="Blocker: owned in-progress item with no movement >24h. Unowned outcomes are tracked separately.">Risk</th>'
    + '<th data-sort-key="issue" tabindex="0" role="button" aria-label="Sort by issue">Issue</th>'
    + '<th data-sort-key="summary" class="cell-wrap" tabindex="0" role="button" aria-label="Sort by summary">Summary</th>'
    + '<th data-sort-key="type" tabindex="0" role="button" aria-label="Sort by type">Type</th>'
    + '<th data-sort-key="sp" tabindex="0" role="button" aria-label="Sort by story points">SP</th>'
    + '<th data-sort-key="status" tabindex="0" role="button" aria-label="Sort by status">Status</th>'
    + '<th data-sort-key="reporter" tabindex="0" role="button" aria-label="Sort by reporter">Reporter</th>'
    + '<th data-sort-key="assignee" tabindex="0" role="button" aria-label="Sort by assignee">Assignee</th>'
    + '<th data-sort-key="est" tabindex="0" role="button" aria-label="Sort by estimated hours">Est Hrs</th>'
    + '<th data-sort-key="logged" tabindex="0" role="button" aria-label="Sort by logged hours">Logged Hrs</th>'
    + '<th data-sort-key="hours" tabindex="0" role="button" aria-label="Sort by hours in status">Hours in status</th>'
    + '<th data-sort-key="updated" tabindex="0" role="button" aria-label="Sort by updated time">Updated</th>'
    + '</tr></thead><tbody>';
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
    const riskTags = Array.isArray(row.riskTags) ? row.riskTags : [];
    html += '<tr class="' + parentClasses + '" data-parent-key="' + escapeHtml(parentKey) + '"' + (hasChildren ? ' aria-expanded="true"' : '') + (riskTags.length ? ' data-risk-tags="' + escapeHtml(riskTags.join(' ')) + '"' : '') + '>';
    let sourceLabel = escapeHtml(row.source || '-');
    if (hasChildren) {
      sourceLabel = '<button type="button" class="work-risks-toggle" aria-label="Toggle subtask risks" aria-expanded="true">v</button>' + sourceLabel;
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
        const childRiskTags = Array.isArray(child.riskTags) ? child.riskTags : [];
        html += '<tr class="work-risk-subtask-row" data-parent-key="' + escapeHtml(parentKey) + '"' + (childRiskTags.length ? ' data-risk-tags="' + escapeHtml(childRiskTags.join(' ')) + '"' : '') + '>';
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
      const riskTags = Array.isArray(row.riskTags) ? row.riskTags : [];
      html += '<tr class="' + parentClasses + '" data-parent-key="' + escapeHtml(parentKey) + '"' + (hasChildren ? ' aria-expanded="true"' : '') + (riskTags.length ? ' data-risk-tags="' + escapeHtml(riskTags.join(' ')) + '"' : '') + '>';
      let sourceLabel = escapeHtml(row.source || '-');
      if (hasChildren) {
        sourceLabel = '<button type="button" class="work-risks-toggle" aria-label="Toggle subtask risks" aria-expanded="true">v</button>' + sourceLabel;
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
          const childRiskTags = Array.isArray(child.riskTags) ? child.riskTags : [];
          html += '<tr class="work-risk-subtask-row" data-parent-key="' + escapeHtml(parentKey) + '"' + (childRiskTags.length ? ' data-risk-tags="' + escapeHtml(childRiskTags.join(' ')) + '"' : '') + '>';
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
    const card = document.getElementById('stuck-card');
    const table = document.getElementById('work-risks-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    const sortState = { key: '', dir: '' };
    const filterState = { activeTags: [] };
    const sortStorageKey = 'current_sprint_work_risks_sort';

    function parseSortValue(parentRow, key) {
      if (!parentRow) return '';
      const cellMap = {
        source: 0, risk: 1, issue: 2, summary: 3, type: 4, sp: 5, status: 6, reporter: 7, assignee: 8, est: 9, logged: 10, hours: 11, updated: 12,
      };
      const idx = cellMap[key];
      const cell = Number.isInteger(idx) ? parentRow.cells[idx] : null;
      const raw = (cell?.innerText || cell?.textContent || '').trim();
      if (['sp', 'est', 'logged', 'hours'].includes(key)) {
        const n = Number(String(raw).replace(/[^\d.-]/g, ''));
        return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
      }
      if (key === 'updated') {
        const t = new Date(raw).getTime();
        return Number.isFinite(t) ? t : 0;
      }
      return raw.toLowerCase();
    }

    function ensureDefaultOrder() {
      const parentRows = Array.from(table.querySelectorAll('.work-risk-parent-row'));
      let maxOrder = parentRows.reduce((max, row) => {
        const cur = Number(row.dataset.defaultOrder || 0);
        return Number.isFinite(cur) ? Math.max(max, cur) : max;
      }, 0);
      parentRows.forEach((row) => {
        if (!row.dataset.defaultOrder) {
          maxOrder += 1;
          row.dataset.defaultOrder = String(maxOrder);
        }
      });
    }

    function rowGroupForParent(parentRow) {
      const nodes = [parentRow];
      let next = parentRow.nextElementSibling;
      while (next && next.classList.contains('work-risk-subtask-row')) {
        if ((next.getAttribute('data-parent-key') || '') !== (parentRow.getAttribute('data-parent-key') || '')) break;
        nodes.push(next);
        next = next.nextElementSibling;
      }
      return nodes;
    }

    function applyRiskTableSort(key, dir) {
      if (!tbody) return;
      ensureDefaultOrder();
      const parentRows = Array.from(tbody.querySelectorAll('.work-risk-parent-row'));
      const groups = parentRows.map((parentRow) => ({
        parentRow,
        nodes: rowGroupForParent(parentRow),
      }));
      groups.sort((a, b) => {
        if (!key || !dir) {
          return Number(a.parentRow.dataset.defaultOrder || 0) - Number(b.parentRow.dataset.defaultOrder || 0);
        }
        const av = parseSortValue(a.parentRow, key);
        const bv = parseSortValue(b.parentRow, key);
        let cmp = 0;
        if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
        else cmp = String(av).localeCompare(String(bv));
        if (cmp === 0) {
          cmp = Number(a.parentRow.dataset.defaultOrder || 0) - Number(b.parentRow.dataset.defaultOrder || 0);
        }
        return dir === 'asc' ? cmp : -cmp;
      });
      const frag = document.createDocumentFragment();
      groups.forEach((group) => group.nodes.forEach((node) => frag.appendChild(node)));
      tbody.appendChild(frag);
      const headers = Array.from(table.querySelectorAll('thead th[data-sort-key]'));
      headers.forEach((th) => {
        const isActive = th.getAttribute('data-sort-key') === key && !!dir;
        th.classList.toggle('is-sorted', isActive);
        th.setAttribute('aria-sort', !isActive ? 'none' : (dir === 'asc' ? 'ascending' : 'descending'));
        th.dataset.sortDir = isActive ? dir : '';
      });
      sortState.key = key || '';
      sortState.dir = dir || '';
      try {
        const payload = (!sortState.key || !sortState.dir) ? '' : JSON.stringify({ key: sortState.key, dir: sortState.dir });
        if (payload) window.localStorage.setItem(sortStorageKey, payload);
        else window.localStorage.removeItem(sortStorageKey);
      } catch (_) {}
    }

    function cycleSortForHeader(th) {
      const key = th.getAttribute('data-sort-key') || '';
      if (!key) return;
      let nextDir = 'desc';
      if (sortState.key === key && sortState.dir === 'desc') nextDir = 'asc';
      else if (sortState.key === key && sortState.dir === 'asc') nextDir = '';
      applyRiskTableSort(nextDir ? key : '', nextDir);
    }

    function renderFilterBanner(activeTags, source) {
      if (!card) return;
      let banner = card.querySelector('.work-risks-filter-banner');
      if (!activeTags.length) {
        banner?.remove();
        return;
      }
      const visibleParents = Array.from(table.querySelectorAll('.work-risk-parent-row')).filter((row) => row.style.display !== 'none').length;
      if (visibleParents > 0) {
        banner?.remove();
        return;
      }
      if (!banner) {
        banner = document.createElement('div');
        banner.className = 'work-risks-filter-banner';
        banner.setAttribute('role', 'status');
        const title = card.querySelector('h2');
        if (title && title.nextSibling) card.insertBefore(banner, title.nextSibling);
        else card.prepend(banner);
      }
      const sourceLabel = String(source || '').startsWith('role-mode-')
        ? (String(source).replace('role-mode-', '').replace('scrum-master', 'SM').replace('product-owner', 'PO').replace('line-manager', 'Leads').replace('developer', 'Dev'))
        : 'current view';
      banner.innerHTML = 'No risks for ' + escapeHtml(sourceLabel) + ' view · <button type=\"button\" class=\"link-style\" data-work-risks-reset>Switch to All work</button>';
      banner.querySelector('[data-work-risks-reset]')?.addEventListener('click', () => {
        try {
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags: [], source: 'work-risks-banner-reset' } }));
        } catch (_) {}
      }, { once: true });
    }

    function renderNoMatchPresetBanner(mode) {
      if (!card) return;
      let banner = card.querySelector('.work-risks-filter-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.className = 'work-risks-filter-banner';
        banner.setAttribute('role', 'status');
        const title = card.querySelector('h2');
        if (title && title.nextSibling) card.insertBefore(banner, title.nextSibling);
        else card.prepend(banner);
      }
      const label = String(mode || '').replace('scrum-master', 'SM').replace('product-owner', 'PO').replace('line-manager', 'Leads').replace('developer', 'Dev');
      banner.textContent = 'No matching risks for ' + label + ' preset. Showing All work.';
    }

    table.addEventListener('click', (event) => {
      const sortableHeader = event.target.closest('thead th[data-sort-key]');
      if (sortableHeader && table.contains(sortableHeader)) {
        cycleSortForHeader(sortableHeader);
        return;
      }
      const toggle = event.target.closest('.work-risks-toggle');
      if (!toggle || !table.contains(toggle)) return;
      const parentRow = toggle.closest('.work-risk-parent-row');
      if (!parentRow) return;
      const parentKey = parentRow.getAttribute('data-parent-key') || '';
      const expanded = parentRow.getAttribute('aria-expanded') === 'true';
      const next = !expanded;
      parentRow.setAttribute('aria-expanded', next ? 'true' : 'false');
      toggle.setAttribute('aria-expanded', next ? 'true' : 'false');
      toggle.textContent = next ? 'v' : '>';
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
    table.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const sortableHeader = event.target.closest('thead th[data-sort-key]');
      if (!sortableHeader || !table.contains(sortableHeader)) return;
      event.preventDefault();
      cycleSortForHeader(sortableHeader);
    });
    const personaClickHandler = (event) => {
      const personaBlock = event.target.closest('[data-persona]');
      if (!personaBlock || !(card || table).contains(personaBlock)) return;
      const persona = personaBlock.getAttribute('data-persona') || '';
      const personaMap = {
        developer: ['no-log'],
        'scrum-master': ['blocker'],
        'product-owner': ['scope'],
        'release-train': ['parent-flow'],
        'line-manager': ['unassigned'],
      };
      const riskTags = personaMap[persona] || [];
      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags, source: 'persona-' + persona } }));
        }
      } catch (_) {}
      try {
        table.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (_) {}
    };
    (card || table).addEventListener('click', personaClickHandler);
    (card || table).addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const personaBlock = event.target.closest('[data-persona]');
      if (!personaBlock || !(card || table).contains(personaBlock)) return;
      event.preventDefault();
      personaBlock.click();
    });
    if (!window.__currentSprintWorkRisksFilterBound) {
      window.__currentSprintWorkRisksFilterBound = true;
      window.addEventListener('currentSprint:applyWorkRiskFilter', (event) => {
        const detail = event && event.detail ? event.detail : {};
        const activeTags = Array.isArray(detail.riskTags)
          ? detail.riskTags.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean)
          : [];
        filterState.activeTags = activeTags;
        const allParentRows = table.querySelectorAll('.work-risk-parent-row');
        const allChildRows = table.querySelectorAll('.work-risk-subtask-row');
        if (!activeTags.length) {
          allParentRows.forEach((row) => { row.style.display = ''; });
          allChildRows.forEach((row) => { row.style.display = ''; });
          renderFilterBanner([], detail.source || '');
          return;
        }
        allParentRows.forEach((row) => {
          const tags = (row.getAttribute('data-risk-tags') || '').toLowerCase().split(/\s+/).filter(Boolean);
          const matches = activeTags.some((tag) => tags.includes(tag));
          row.style.display = matches ? '' : 'none';
        });
        allChildRows.forEach((row) => {
          const parentKey = row.getAttribute('data-parent-key') || '';
          const parentRow = parentKey ? table.querySelector('.work-risk-parent-row[data-parent-key="' + parentKey + '"]') : null;
          if (parentRow && parentRow.style.display === 'none') {
            row.style.display = 'none';
            return;
          }
          const tags = (row.getAttribute('data-risk-tags') || '').toLowerCase().split(/\s+/).filter(Boolean);
          const matches = activeTags.some((tag) => tags.includes(tag));
          row.style.display = matches ? '' : 'none';
        });
        renderFilterBanner(activeTags, detail.source || '');
      });
    }
    if (!window.__currentSprintRoleModeNoMatchBound) {
      window.__currentSprintRoleModeNoMatchBound = true;
      window.addEventListener('currentSprint:roleModeNoMatch', (event) => {
        const mode = event?.detail?.mode || '';
        renderNoMatchPresetBanner(mode);
      });
    }
    const showMoreBtn = document.querySelector('.work-risks-show-more');
    if (showMoreBtn) {
      showMoreBtn.addEventListener('click', () => {
        window.setTimeout(() => {
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            try {
              window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags: filterState.activeTags, source: 'work-risks-show-more' } }));
            } catch (_) {}
          }
          if (sortState.key && sortState.dir) applyRiskTableSort(sortState.key, sortState.dir);
          else applyRiskTableSort('', '');
        }, 0);
      });
    }
    let initialSort = null;
    try {
      initialSort = JSON.parse(window.localStorage.getItem(sortStorageKey) || 'null');
    } catch (_) {}
    if (initialSort && initialSort.key && initialSort.dir) applyRiskTableSort(String(initialSort.key), String(initialSort.dir));
    else applyRiskTableSort('', '');
  } catch (_) {}
}

