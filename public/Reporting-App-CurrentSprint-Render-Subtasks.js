import { escapeHtml, renderIssueKeyLink } from './Reporting-App-Shared-Dom-Escape-Helpers.js';
import { formatDateTime, formatNumber } from './Reporting-App-Shared-Format-DateNumber-Helpers.js';
import { buildDistinctSprintFilterViews, buildMergedWorkRiskRows } from './Reporting-App-CurrentSprint-Data-WorkRisk-Rows.js';
import { deriveSprintVerdict } from './Reporting-App-CurrentSprint-Alert-Banner.js';

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
  const verdictInfo = deriveSprintVerdict(data);
  const sprintState = String(data?.sprint?.state || '').toLowerCase();
  const isHistoricalSprint = sprintState && sprintState !== 'active';
  const scopeChanges = data.scopeChanges || [];
  const scopeSP = scopeChanges.reduce((sum, row) => sum + (Number(row.storyPoints) || 0), 0);
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
  const scopeRows = rows.filter((row) => String(row.riskType || '').toLowerCase().includes('added mid-sprint')).length;
  const hasShortcuts = blockerInProgress + blockerNotStarted > 0 || noLogRows > 0 || noEstimateRows > 0 || unassignedRows > 0 || scopeRows > 0;
  if (!hasShortcuts && isHistoricalSprint) {
    return '';
  }
  const distinctViews = buildDistinctSprintFilterViews(data, verdictInfo);
  const visibleRiskViews = Array.isArray(distinctViews?.distinctRiskViews) ? distinctViews.distinctRiskViews.slice(0, 3) : [];
  const remediationLine = verdictInfo.topRemediation || 'Top focus: no urgent remediation';

  let html = '<div class="work-risks-inline-explainer" id="stuck-card" data-mobile-collapse="true">';
  html += '<div class="work-risks-inline-summary">';
  html += '<span class="work-risks-inline-label">Remediation queue</span>';
  html += '<span class="work-risks-inline-copy">' + escapeHtml(remediationLine) + '</span>';
  if (scopeChanges.length > 0 || excludedParents > 0) {
    const metaParts = [];
    if (scopeChanges.length > 0) metaParts.push('+' + scopeChanges.length + ' scope (' + formatNumber(scopeSP, 1, '0') + ' SP)');
    if (excludedParents > 0) metaParts.push(excludedParents + ' parent' + (excludedParents > 1 ? 's' : '') + ' via subtasks');
    html += '<span class="work-risks-shortcut-meta">' + escapeHtml(metaParts.join(' | ')) + '</span>';
  }
  if (visibleRiskViews.length > 0) {
    html += '<div class="work-risks-shortcut-chips" data-work-risk-inline-details aria-label="Jump to stories filtered by risk">';
    html += '<button type="button" class="btn btn-tertiary btn-compact" data-work-risk-shortcut data-risk-tags="">All</button>';
    visibleRiskViews.forEach((item) => {
      html += '<button type="button" class="btn btn-secondary btn-compact" data-work-risk-shortcut data-risk-tags="' + escapeHtml((item.riskTags || []).join(' ')) + '">' + escapeHtml(item.label) + '</button>';
    });
    html += '</div>';
  }
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
        const banner = card.querySelector('.work-risks-filter-banner');
        if (!activeTags.length) {
          banner?.remove();
          return;
        }
        banner?.remove();
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
        if (stories && typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(stories);
        else if (stories) stories.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.location.hash = '#stories-card';
      } catch (_) {}
    });

    card.querySelectorAll('[data-work-risk-role-mode]').forEach((button) => {
      if (button.dataset.roleModeWired === '1') return;
      button.dataset.roleModeWired = '1';
      button.addEventListener('click', () => {
        const mode = button.getAttribute('data-work-risk-role-mode') || 'all';
        try {
          window.dispatchEvent(new CustomEvent('currentSprint:applyRoleMode', { detail: { mode } }));
        } catch (_) {}
      });
    });
  } catch (_) {}
}
