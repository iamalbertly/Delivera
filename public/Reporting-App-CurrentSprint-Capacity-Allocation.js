/**
 * Team Capacity Allocation Component
 * Shows team capacity (% allocated) vs. assigned story points
 * Flags overallocation per team member
 * Rationale: Customer - Prevents sprint overload surprises. Simplicity - Visual bar vs. manual calculation. Trust - Transparent about capacity.
 */

import { escapeHtml, renderIssueKeyLink } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatNumber } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { buildJiraIssueUrl, getResolvedJiraHostFromMeta } from './Reporting-App-Report-Utils-Jira-Helpers.js';

export function renderCapacityAllocation(data) {
  const issues = data.stories || [];
  const summary = data.summary || {};
  const daysMeta = data.daysMeta || {};
  const jiraHost = getResolvedJiraHostFromMeta(data?.meta);

  // Build assignee map
  const assigneeMap = {};
  issues.forEach(issue => {
    const assignee = issue.assignee || 'Unassigned';
    if (!assigneeMap[assignee]) {
      assigneeMap[assignee] = { name: assignee, sp: 0, count: 0 };
    }
    assigneeMap[assignee].sp += issue.storyPoints || 0;
    assigneeMap[assignee].count += 1;
  });

  // Calculate team velocity (simplified: assume ~10 SP per person per 2-week sprint)
  const sprintDurationDays = daysMeta.daysInSprintWorking || 10;
  const avgVelocityPerDay = 2; // Configurable: typically 1-3 SP per person per day
  const expectedCapacitySP = sprintDurationDays * avgVelocityPerDay;

  // Build sorted list
  const assignees = Object.values(assigneeMap)
    .sort((a, b) => b.sp - a.sp)
    .map(a => ({
      ...a,
      allocPercent: Math.round((a.sp / expectedCapacitySP) * 100),
      isOverallocated: a.sp > expectedCapacitySP
    }));

  // Overall stats
  const totalSP = summary.totalSP || 0;
  const unassignedCount = issues.filter(i => !i.assignee).length;
  const unassignedPercent = issues.length > 0 ? Math.round((unassignedCount / issues.length) * 100) : 0;
  const assignedCount = issues.length - unassignedCount;
  const overallocatedCount = assignees.filter(a => a.isOverallocated).length;

  // Determine overall capacity health
  let capacityHealth = 'healthy';
  let capacityColor = 'green';
  let capacityMessage = '✓ Team capacity is well-balanced';

  if (overallocatedCount > assignees.length / 2) {
    capacityHealth = 'critical';
    capacityColor = 'red';
    capacityMessage = '⚠️ Multiple team members overallocated';
  } else if (overallocatedCount > 0) {
    capacityHealth = 'warning';
    capacityColor = 'orange';
    capacityMessage = '⚠️ Some team members overallocated';
  }

  if (unassignedPercent > 20) {
    capacityHealth = 'uncertain';
    capacityColor = 'yellow';
    capacityMessage = '⚠️ ' + unassignedPercent + '% of issues unassigned (capacity estimate may be low confidence)';
  }

  let html = '<div class="transparency-card capacity-allocation-card" id="capacity-card">';
  html += '<h2>Team Capacity Allocation</h2>';

  // Overall health
  html += '<div class="capacity-health ' + capacityColor + '">' + capacityMessage + '</div>';

  // Per-person allocation
  html += '<div class="capacity-allocations">';

  assignees.forEach(assignee => {
    const barPercent = Math.min(assignee.allocPercent, 150); // Cap visual bar at 150%
    const barColor = assignee.isOverallocated ? 'overallocated' : 'normal';
    const overallocFlag = assignee.isOverallocated ? ' (⚠️ ' + assignee.allocPercent + '% allocated)' : '';

    html += '<div class="allocation-item">';
    html += '<div class="allocation-header">';
    html += '<span class="allocation-name">' + escapeHtml(assignee.name) + '</span>';
    html += '<span class="allocation-stats">' + assignee.sp + ' SP, ' + assignee.count + ' issue' + (assignee.count !== 1 ? 's' : '') + '</span>';
    html += '</div>';
    html += '<div class="allocation-bar-container">';
    html += '<div class="allocation-bar ' + barColor + '" style="width: ' + barPercent + '%;" title="' + assignee.allocPercent + '% capacity" role="progressbar" aria-valuenow="' + assignee.allocPercent + '" aria-valuemin="0" aria-valuemax="100"></div>';
    html += '</div>';
    html += '<div class="allocation-percent">' + assignee.allocPercent + '%' + overallocFlag + '</div>';

    // Show issues for this assignee (collapsible)
    if (assignee.count > 0) {
      html += '<button class="allocation-expand-btn" data-assignee="' + escapeHtml(assignee.name) + '" aria-expanded="false">';
      html += 'Show ' + assignee.count + ' issue' + (assignee.count !== 1 ? 's' : '');
      html += '</button>';
      html += '<div class="allocation-issues hidden">';
      const assigneeIssues = issues.filter(i => (i.assignee || 'Unassigned') === assignee.name);
      assigneeIssues.forEach(issue => {
        html += '<div class="allocation-issue">';
        const key = issue.key || '';
        const url = issue.issueUrl || buildJiraIssueUrl(jiraHost, key);
        html += '<span class="issue-key">' + renderIssueKeyLink(key, url) + '</span>';
        html += '<span class="issue-summary">' + escapeHtml(issue.summary || '-') + '</span>';
        html += '<span class="issue-sp">' + (issue.storyPoints || '?') + ' SP</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
  });

  html += '</div>';

  // Rebalancing suggestions
  if (overallocatedCount > 0) {
    html += '<div class="capacity-actions">';
    html += '<h3>Suggestions</h3>';
    html += '<ul>';
    assignees.filter(a => a.isOverallocated).forEach(assignee => {
      html += '<li>Move ' + Math.ceil((assignee.sp - expectedCapacitySP) / 2) + ' SP away from ' + escapeHtml(assignee.name) + '</li>';
    });
    html += '</ul>';
    html += '</div>';
  }

  html += '</div>';
  return html;
}

/**
 * Wire capacity allocation handlers
 */
export function wireCapacityAllocationHandlers() {
  const card = document.querySelector('.capacity-allocation-card');
  if (!card) return;

  // Expand/collapse issues per assignee
  const expandBtns = card.querySelectorAll('.allocation-expand-btn');
  expandBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const issuesDiv = btn.nextElementSibling;
      if (issuesDiv?.classList.contains('allocation-issues')) {
        issuesDiv.classList.toggle('hidden');
        btn.setAttribute('aria-expanded', issuesDiv.classList.contains('hidden') ? 'false' : 'true');
        btn.textContent = issuesDiv.classList.contains('hidden')
          ? btn.textContent.replace('Hide', 'Show')
          : btn.textContent.replace('Show', 'Hide');
      }
    });
  });
}
