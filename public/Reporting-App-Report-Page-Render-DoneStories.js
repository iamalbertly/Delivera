
import { reportState } from './Reporting-App-Report-Page-State.js';
import { getCurrentSelectionComplexity } from './Reporting-App-Report-Page-Filters-Summary-Helpers.js';
import { reportDom } from './Reporting-App-Report-Page-Context.js';
import { getSafeMeta, renderEmptyState } from './Reporting-App-Report-Page-Render-Helpers.js';
import { formatDateForDisplay } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { escapeHtml } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { buildJiraIssueUrl, getResolvedJiraHostFromMeta } from './Reporting-App-Report-Utils-Jira-Helpers.js';
import { VirtualScroller } from './Reporting-App-Shared-Virtual-Scroller.js';
import { parseIssueLabels, isOutcomeStoryLike, isFlowStatus } from './Reporting-App-Shared-Outcome-Risk-Semantics.js';

const VIRTUALIZATION_ROW_THRESHOLD = 250;

function deriveDoneStoryRiskTags(row) {
  const tags = [];
  const labels = parseIssueLabels(row?.issueLabels).map((l) => l.toLowerCase());
  const hasOwner = String(row?.assigneeDisplayName || '').trim() !== '';
  const isOutcome = isOutcomeStoryLike({ labels, epicKey: row?.epicKey });
  if (isOutcome && !hasOwner) tags.push('unassigned');
  if (labels.includes('blocker') && hasOwner && isFlowStatus(row?.issueStatus)) tags.push('blocker');
  if (isOutcome) tags.push('outcome');
  return Array.from(new Set(tags));
}

function applyDoneStoriesRiskFilter(root, activeTags) {
  if (!root) return;
  const tags = Array.isArray(activeTags) ? activeTags.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean) : [];
  const rows = Array.from(root.querySelectorAll('[data-done-story-risk-tags]'));
  if (!tags.length) {
    rows.forEach((row) => {
      row.style.display = '';
      row.style.opacity = '';
    });
    return;
  }
  rows.forEach((row) => {
    const rowTags = String(row.getAttribute('data-done-story-risk-tags') || '').toLowerCase().split(/\s+/).filter(Boolean);
    const match = tags.some((tag) => rowTags.includes(tag));
    row.style.display = match ? '' : 'none';
    row.style.opacity = match ? '' : '0.35';
  });
}
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
  const visibilitySummary = document.getElementById('done-stories-visibility-summary');
  const tabBtn = document.getElementById('tab-btn-done-stories');
  const quarterToggleBtn = document.getElementById('done-stories-quarter-review-toggle');
  const meta = getSafeMeta(reportState.previewData);
  const jiraHost = getResolvedJiraHostFromMeta(meta);
  const totalRows = Array.isArray(reportState.previewRows) ? reportState.previewRows.length : (Array.isArray(rows) ? rows.length : 0);
  const visibleRows = Array.isArray(rows) ? rows.length : 0;
  const totalSP = (rows || []).reduce((sum, r) => sum + (Number(r.storyPoints) || 0), 0);
  const isPartial = meta?.partial === true;
  const strictEnabled = meta?.requireResolvedBySprintEnd === true;

  if (tabBtn) {
    tabBtn.textContent = totalRows === 0 ? 'Outcomes (0)' : ('Outcomes (Total: ' + totalRows + ')');
  }
  if (visibilitySummary) {
    let summaryText = `Showing ${visibleRows} of ${totalRows} stor${totalRows === 1 ? 'y' : 'ies'}`;
    if (strictEnabled) summaryText += ' · Strict: resolved by sprint end';
    if (isPartial) summaryText += ' · Partial preview';
    visibilitySummary.textContent = summaryText;
  }
  if (totalsBar) {
    const sprintCount = new Set((rows || []).map((r) => r.sprintId).filter(Boolean)).size;
    totalsBar.innerHTML = [
      `<span><strong>${visibleRows}</strong> visible outcomes</span>`,
      `<span><strong>${totalRows}</strong> total in window</span>`,
      sprintCount > 0 ? `<span><strong>${sprintCount}</strong> sprint${sprintCount === 1 ? '' : 's'}</span>` : '',
      totalSP > 0 ? `<span><strong>${totalSP.toFixed(0)}</strong> SP done</span>` : '',
      isPartial ? '<span class="totals-bar-note">Partial preview</span>' : '',
    ].filter(Boolean).join('<span aria-hidden="true">·</span>');
  }

  if (!rows || rows.length === 0) {
    const requireByEnd = document.getElementById('require-resolved-by-sprint-end')?.checked === true;
    const reason = requireByEnd
      ? 'No done stories matched this strict rule: resolved by sprint end. Jira may still show done items resolved after sprint end.'
      : 'No done stories in this window; check dates or Jira hygiene.';
    renderEmptyState(content, 'No done stories', reason, '', 'Adjust filters');
    if (totalsBar && totalRows === 0) {
      totalsBar.innerHTML = '<span class="totals-bar-note">No done stories in this window; check dates or Jira hygiene.</span>';
    }
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

  const doneStoriesTab = document.getElementById('tab-done-stories');
  const windowStartMs = meta?.windowStart ? new Date(meta.windowStart).getTime() : NaN;
  const windowEndMs = meta?.windowEnd ? new Date(meta.windowEnd).getTime() : NaN;
  const rangeDays = Number.isFinite(windowStartMs) && Number.isFinite(windowEndMs) && windowEndMs >= windowStartMs
    ? Math.round((windowEndMs - windowStartMs) / (24 * 60 * 60 * 1000))
    : 0;
  const shouldAutoQuarterReview = rangeDays >= 90 && sortedSprints.length > 1;
  if (doneStoriesTab && shouldAutoQuarterReview && !doneStoriesTab.classList.contains('quarter-review-mode')) {
    doneStoriesTab.classList.add('quarter-review-mode');
    quarterToggleBtn?.setAttribute('aria-pressed', 'true');
    if (quarterToggleBtn) quarterToggleBtn.textContent = 'Exit quarter review';
  }
  const isQuarterReview = !!(doneStoriesTab && doneStoriesTab.classList.contains('quarter-review-mode'));
  let prefixHtml = '';
  if (isQuarterReview) {
    const topEpics = buildTopEpicsSummary(rows);
    prefixHtml += '<div class="quarter-review-hint" id="quarter-review-hint"><strong>Quarter review mode:</strong> Reviewing all done stories in this window, sprint by sprint.</div>';
    prefixHtml += '<div class="done-stories-sticky-review-bar"><span>Total outcomes: <strong>' + visibleRows + '</strong></span><span>SP done: <strong>' + totalSP.toFixed(0) + '</strong></span><span>Top epics: <strong>' + escapeHtml(topEpics || 'N/A') + '</strong></span></div>';
    prefixHtml += buildSprintJumpChipsHtml(sortedSprints);
    try {
      const complexity = getCurrentSelectionComplexity();
      if (complexity?.isHeavy) {
        prefixHtml += '<p class="quarter-review-heavy-hint">Large range; narrow dates for a faster review.</p>';
      }
    } catch (_) {}
  }

  content.innerHTML = `${prefixHtml}<div class="sprint-groups-container"></div>`;
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

    if (isQuarterReview) {
      const body = groupDiv.querySelector('.sprint-content');
      if (body) {
        btn.click();
        body.style.height = 'auto';
      }
    }
  }

  if (isQuarterReview) {
    content.querySelectorAll('.done-stories-sprint-jump-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const target = document.getElementById(chip.getAttribute('data-target-sprint') || '');
        if (!target) return;
        if (target.style.display === 'none') {
          const header = target.previousElementSibling;
          header?.click?.();
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  if (!window.__reportDoneStoriesRiskFilterBound) {
    window.__reportDoneStoriesRiskFilterBound = true;
    window.addEventListener('report:applyOutcomeRiskFilter', (event) => {
      const detail = event?.detail || {};
      const tags = Array.isArray(detail.riskTags) ? detail.riskTags : [];
      reportState.outcomeRiskFocusTags = tags;
      applyDoneStoriesRiskFilter(content, tags);
    });
  }
  applyDoneStoriesRiskFilter(content, reportState.outcomeRiskFocusTags || []);
}

function buildSprintJumpChipsHtml(sortedSprints) {
  if (!Array.isArray(sortedSprints) || sortedSprints.length <= 1) return '';
  const chips = sortedSprints.map((group) => {
    const key = 'sprint-' + group.sprint.id;
    return '<button type="button" class="done-stories-sprint-jump-chip" data-target-sprint="' + escapeHtml(key) + '">' + escapeHtml(group.sprint.name || 'Sprint') + '</button>';
  }).join('');
  return '<div class="done-stories-sprint-jump-row" role="navigation" aria-label="Jump to sprint section">' + chips + '</div>';
}

function buildTopEpicsSummary(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const counts = new Map();
  for (const row of rows) {
    const epic = String(row.epicName || row.epicKey || 'No epic').trim() || 'No epic';
    counts.set(epic, (counts.get(epic) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} (${count})`)
    .join(', ');
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
  const riskTags = deriveDoneStoryRiskTags(row);
  const outcomeBadge = riskTags.includes('outcome') ? '<span class="story-row-flag">Outcome</span>' : '';
  return `<div data-done-story-risk-tags="${escapeHtml(riskTags.join(' '))}" style="display: flex; padding: 5px 10px; border-bottom: 1px solid #eee; height: 40px; align-items: center;">
     <div style="flex: 1">${issueKeyHtml}</div>
     <div style="flex: 3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(row.issueSummary)}${outcomeBadge}</div>
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
  const riskTags = deriveDoneStoryRiskTags(row);
  const outcomeBadge = riskTags.includes('outcome') ? '<span class="story-row-flag">Outcome</span>' : '';
  return `<tr data-done-story-risk-tags="${escapeHtml(riskTags.join(' '))}">
     <td>${issueKeyHtml}</td>
     <td>${escapeHtml(row.issueSummary)}${outcomeBadge}</td>
     <td>${escapeHtml(row.issueStatus)}</td>
     <td>${escapeHtml(row.issueType)}</td>
     ${meta?.discoveredFields?.storyPointsFieldId ? `<td>${row.storyPoints || ''}</td>` : ''}
     <td>${escapeHtml(row.assigneeDisplayName || '')}</td>
  </tr>`;
}
