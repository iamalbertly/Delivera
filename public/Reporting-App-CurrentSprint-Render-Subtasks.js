import { escapeHtml, renderIssueKeyLink } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDateTime, formatNumber } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
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
  const blockerRows = rows.filter((row) => row.isOwnedBlocker);
  const blockerInProgress = blockerRows.filter((row) => {
    const st = String(row.status || '').toLowerCase();
    return st && st !== 'to do' && st !== 'open' && st !== 'backlog';
  }).length;
  const blockerNotStarted = Math.max(0, blockerRows.length - blockerInProgress);
  const noLogRows = rows.filter((row) => String(row.riskType || '').toLowerCase().includes('no log yet')).length;
  const noEstimateRows = rows.filter((row) => String(row.riskType || '').toLowerCase().includes('missing estimate')).length;
  const unassignedRows = rows.filter((row) => row.isUnownedOutcome).length;

  let html = '<div class="transparency-card" id="stuck-card">';
  html += '<h2>Work risks – how this view is calculated</h2>';

  // Compact meta: one-line context only, deeper semantics live in the stories card.
  const metaParts = [];
  if (scopeChanges.length > 0) metaParts.push('+' + scopeChanges.length + ' scope (' + formatNumber(scopeSP, 1, '0') + ' SP)');
  if (excludedParents > 0) metaParts.push(excludedParents + ' parent' + (excludedParents > 1 ? 's' : '') + ' via subtasks');
  if (metaParts.length > 0) {
    html += '<p class="meta-row"><small>' + escapeHtml(metaParts.join(' | ')) + '</small></p>';
  }
  html += '<p class="meta-row"><small>Use header <strong>View as</strong> and the risk chips on <strong>Issues in this sprint</strong> to slice Work risks by role and focus.</small></p>';
  if (noEstimateRows > 0 || noLogRows > 0) {
    html += '<p class="meta-row"><small>Interpretation: <strong>Missing estimate</strong> = no planning baseline; <strong>No log yet</strong> = plan exists, actual effort missing.</small></p>';
  }

  if (!rows.length) {
    html += '<p class="meta-row"><small>No risks detected from scope changes, flow, sub-task tracking, or issue ownership. Check <a href="#stories-card">Issues in this sprint</a> to confirm.</small></p>';
    html += '</div>';
    return html;
  }

  html += '<ul class="meta-list">';
  html += '<li><small><strong>' + blockerInProgress + '</strong> active owned blocker' + (blockerInProgress === 1 ? '' : 's') + '</small></li>';
  html += '<li><small><strong>' + blockerNotStarted + '</strong> blocker candidate' + (blockerNotStarted === 1 ? '' : 's') + ' not yet in flow</small></li>';
  html += '<li><small><strong>' + noLogRows + '</strong> items with time planned but no logs</small></li>';
  html += '<li><small><strong>' + noEstimateRows + '</strong> items with logs but no estimate</small></li>';
  html += '<li><small><strong>' + unassignedRows + '</strong> unowned outcomes</small></li>';
  html += '</ul>';

  html += '<div class="work-risks-shortcuts" aria-label="Jump to stories filtered by risk">';
  html += '<p class="meta-row"><small>Shortcuts below jump to <a href="#stories-card">Issues in this sprint</a> with risk filters applied.</small></p>';
  html += '<div class="work-risks-shortcut-chips">';
  if (blockerInProgress + blockerNotStarted > 0) {
    html += '<button type="button" class="btn btn-secondary btn-compact" data-work-risk-shortcut data-risk-tags="blocker">View blocker risks in stories</button>';
  }
  if (noLogRows > 0) {
    html += '<button type="button" class="btn btn-secondary btn-compact" data-work-risk-shortcut data-risk-tags="no-log">View estimated, no log in stories</button>';
  }
  if (noEstimateRows > 0) {
    html += '<button type="button" class="btn btn-secondary btn-compact" data-work-risk-shortcut data-risk-tags="missing-estimate">View logged, no estimate in stories</button>';
  }
  if (unassignedRows > 0) {
    html += '<button type="button" class="btn btn-secondary btn-compact" data-work-risk-shortcut data-risk-tags="unassigned">View unowned outcomes in stories</button>';
  }
  html += '<button type="button" class="btn btn-tertiary btn-compact" data-work-risk-shortcut data-risk-tags="">Clear risk filter</button>';
  html += '</div>';
  html += '</div>';

  html += '</div>';
  return html;
}

export function wireSubtasksShowMoreHandlers() {
  try {
    const card = document.getElementById('stuck-card');
    if (!card) return;
    if (!window.__currentSprintWorkRisksFilterBound) {
      window.__currentSprintWorkRisksFilterBound = true;
      window.addEventListener('currentSprint:applyWorkRiskFilter', (event) => {
        const detail = event && event.detail ? event.detail : {};
        const activeTags = Array.isArray(detail.riskTags)
          ? detail.riskTags.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean)
          : [];
        // Stuck card no longer owns filtering UI; rely on stories card + header to visualise filters.
        if (!activeTags.length) {
          const banner = card.querySelector('.work-risks-filter-banner');
          banner?.remove();
          return;
        }
        let banner = card.querySelector('.work-risks-filter-banner');
        if (!banner) {
          banner = document.createElement('div');
          banner.className = 'work-risks-filter-banner';
          banner.setAttribute('role', 'status');
          const title = card.querySelector('h2');
          if (title && title.nextSibling) card.insertBefore(banner, title.nextSibling);
          else card.prepend(banner);
        }
        const sourceLabel = String(detail.source || '').startsWith('role-mode-')
          ? (String(detail.source).replace('role-mode-', '').replace('scrum-master', 'SM').replace('product-owner', 'PO').replace('line-manager', 'Leads').replace('developer', 'Dev'))
          : 'current view';
        banner.textContent = 'Showing risks for ' + sourceLabel + ' in Issues in this sprint.';
      });
    }

    card.addEventListener('click', (event) => {
      const shortcut = event.target.closest('[data-work-risk-shortcut]');
      if (!shortcut || !card.contains(shortcut)) return;
      const tagsAttr = (shortcut.getAttribute('data-risk-tags') || '').trim();
      const riskTags = tagsAttr ? tagsAttr.split(/\s+/).filter(Boolean) : [];
      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags, source: 'work-risks-shortcut' } }));
        }
      } catch (_) {}
      try {
        const stories = document.getElementById('stories-card');
        if (stories) stories.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.location.hash = '#stories-card';
      } catch (_) {}
    });
  } catch (_) {}
}

