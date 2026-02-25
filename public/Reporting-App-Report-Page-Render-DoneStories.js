
import { reportState } from './Reporting-App-Report-Page-State.js';
import { reportDom } from './Reporting-App-Report-Page-Context.js';
import { getSafeMeta, renderEmptyState } from './Reporting-App-Report-Page-Render-Helpers.js';
import { formatDateForDisplay } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { buildJiraIssueUrl, getResolvedJiraHostFromMeta } from './Reporting-App-Report-Utils-Jira-Helpers.js';
import { VirtualScroller } from './Reporting-App-Shared-Virtual-Scroller.js';

const VIRTUALIZATION_ROW_THRESHOLD = 250;
export function toggleSprint(id) {
  const content = document.getElementById(id);
  if (!content) return;
  const isVisible = content.style.display !== 'none';
  content.style.display = isVisible ? 'none' : 'block';
  const header = content.previousElementSibling;

  if (header) {
    const icon = header.querySelector('.toggle-icon');
    if (icon) icon.textContent = isVisible ? '>' : 'v';
    // If opening, trigger layout check for virtual scroller if needed
    if (!isVisible) {
      window.dispatchEvent(new Event('resize'));
    }
  }
}

export function renderDoneStoriesTab(rows) {
  const content = document.getElementById('done-stories-content');
  const totalsBar = document.getElementById('done-stories-totals');
  const meta = getSafeMeta(reportState.previewData);
  const jiraHost = getResolvedJiraHostFromMeta(meta);

  if (!rows || rows.length === 0) {
    const requireByEnd = document.getElementById('require-resolved-by-sprint-end')?.checked === true;
    const reason = requireByEnd
      ? 'No done stories matched this strict rule: resolved by sprint end. Jira may still show done items resolved after sprint end.'
      : 'No done stories in this window.';
    renderEmptyState(content, 'No done stories', reason, '', 'Adjust filters');
    if (totalsBar) totalsBar.innerHTML = '';
    return;
  }

  // Group by Sprint
  const sprintGroups = new Map();
  for (const row of rows) {
    if (!sprintGroups.has(row.sprintId)) {
      sprintGroups.set(row.sprintId, {
        sprint: { id: row.sprintId, name: row.sprintName, startDate: row.sprintStartDate, endDate: row.sprintEndDate },
        rows: [],
      });
    }
    sprintGroups.get(row.sprintId).rows.push(row);
  }

  const sortedSprints = Array.from(sprintGroups.values()).sort((a, b) => {
    return new Date(b.sprint.startDate || 0).getTime() - new Date(a.sprint.startDate || 0).getTime();
  });

  content.innerHTML = `<div class="sprint-groups-container"></div>`;
  const container = content.querySelector('.sprint-groups-container');

  // Render Sprint Headers (Not virtualized, usually < 50 sprints)
  // Inside each sprint, we use Virtual Scroller for the table body if > VIRTUALIZATION_ROW_THRESHOLD items

  for (const group of sortedSprints) {
    const sprintId = group.sprint.id;
    const sprintKey = `sprint-${sprintId}`;
    const headerHtml = `
      <button class="sprint-header" data-sprint-target="${sprintKey}">
        <span class="toggle-icon">></span>
        <strong>${escapeHtml(group.sprint.name)}</strong>
        <span class="sprint-meta">${formatDateForDisplay(group.sprint.startDate)} to ${formatDateForDisplay(group.sprint.endDate)}</span>
        <span class="story-count">${group.rows.length} stories</span>
      </button>
      <div class="sprint-content" id="${sprintKey}" style="display: none; height: 500px;"></div>
    `;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'sprint-group';
    groupDiv.innerHTML = headerHtml;
    container.appendChild(groupDiv);

    // Initial Toggle Handler
    const btn = groupDiv.querySelector('.sprint-header');
    btn.addEventListener('click', () => {
      const target = document.getElementById(sprintKey);
      if (target.style.display === 'none') {
        target.style.display = 'block';
        btn.querySelector('.toggle-icon').textContent = 'v';

        // Initialize Virtual Scroller ONLY when opened and if meaningful size
        if (!target.dataset.scrollerInitialized && group.rows.length > 0) {
          target.dataset.scrollerInitialized = 'true';
          if (group.rows.length < VIRTUALIZATION_ROW_THRESHOLD) {
            target.style.height = 'auto';
            target.innerHTML = renderTableHtml(group.rows, meta, jiraHost);
          } else {
            // Virtual Path
            target.innerHTML = `
                <div class="virtual-header">
                  ${renderTableHeader(meta)} 
                </div>
                <div class="virtual-body-container" style="height: 400px; overflow-y: auto;"></div>
             `;
            const bodyContainer = target.querySelector('.virtual-body-container');
            new VirtualScroller(bodyContainer, group.rows, (row) => renderRowHtml(row, meta, jiraHost), { rowHeight: 40 });
          }
        }
      } else {
        target.style.display = 'none';
        btn.querySelector('.toggle-icon').textContent = '>';
      }
    });
  }
}

function renderTableHeader(meta) {
  // Styles for Div-Table alignment matching original CSS would be needed. 
  return `<div class="table-header-row" style="display: flex; font-weight: bold; padding: 10px; border-bottom: 2px solid #ddd;">
      <div style="flex: 1">Key</div>
      <div style="flex: 3">Summary</div>
      <div style="flex: 1">Status</div>
      <div style="flex: 1">Type</div>
      ${meta?.discoveredFields?.storyPointsFieldId ? '<div style="flex: 0.5">SP</div>' : ''}
      <div style="flex: 1">Assignee</div>
  </div>`;
}

function renderTableHtml(rows, meta, jiraHost) {
  return `<table class="data-table">
    <thead>
       <tr>
       <th>Key</th>
       <th>Summary</th>
       <th>Status</th>
       <th>Type</th>
       ${meta?.discoveredFields?.storyPointsFieldId ? '<th>SP</th>' : ''}
       <th>Assignee</th>
       </tr>
    </thead>
    <tbody>${rows.map(r => renderRowHtmlAsTr(r, meta, jiraHost)).join('')}</tbody>
  </table>`;
}

function renderRowHtml(row, meta, jiraHost) {
  const issueUrl = buildJiraIssueUrl(jiraHost, row.issueKey);
  const issueKeyHtml = issueUrl
    ? `<a href="${escapeHtml(issueUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.issueKey || '')}</a>`
    : `<span class="issue-key-unlinked">${escapeHtml(row.issueKey || '')}</span>`;
  return `<div style="display: flex; padding: 5px 10px; border-bottom: 1px solid #eee; height: 40px; align-items: center;">
     <div style="flex: 1">${issueKeyHtml}</div>
     <div style="flex: 3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(row.issueSummary)}</div>
     <div style="flex: 1">${escapeHtml(row.issueStatus)}</div>
     <div style="flex: 1">${escapeHtml(row.issueType)}</div>
     ${meta?.discoveredFields?.storyPointsFieldId ? `<div style="flex: 0.5">${row.storyPoints || ''}</div>` : ''}
     <div style="flex: 1">${escapeHtml(row.assigneeDisplayName || '')}</div>
  </div>`;
}

function renderRowHtmlAsTr(row, meta, jiraHost) {
  const issueUrl = buildJiraIssueUrl(jiraHost, row.issueKey);
  const issueKeyHtml = issueUrl
    ? `<a href="${escapeHtml(issueUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.issueKey || '')}</a>`
    : `<span class="issue-key-unlinked">${escapeHtml(row.issueKey || '')}</span>`;
  return `<tr>
     <td>${issueKeyHtml}</td>
     <td>${escapeHtml(row.issueSummary)}</td>
     <td>${escapeHtml(row.issueStatus)}</td>
     <td>${escapeHtml(row.issueType)}</td>
     ${meta?.discoveredFields?.storyPointsFieldId ? `<td>${row.storyPoints || ''}</td>` : ''}
     <td>${escapeHtml(row.assigneeDisplayName || '')}</td>
  </tr>`;
}
