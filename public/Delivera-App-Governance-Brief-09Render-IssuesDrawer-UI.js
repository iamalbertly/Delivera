import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

function issueKeyLink(risk) {
  const key = risk.issueKey || '';
  if (!key) return escapeHtml(risk.squad || 'Portfolio');
  const url = risk.issueUrl || '';
  const id = `gov-risk-${escapeHtml(key)}`;
  if (url) {
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" id="${id}" data-issue-key="${escapeHtml(key)}" class="gov-issue-key-link">${escapeHtml(key)}</a>`;
  }
  return `<button type="button" class="gov-issue-key-link btn btn-link btn-compact" id="${id}" data-issue-key="${escapeHtml(key)}">${escapeHtml(key)}</button>`;
}

export function renderIssuesDrawer(surfaces) {
  const issues = (surfaces?.drawerIssues || []).filter((r) => r.issueKey || r.squad);
  if (!issues.length) return '';
  const rows = issues.map((r, idx) => `
    <li class="gov-issue-row" data-drawer-risk="${idx}">
      <div class="gov-issue-row-compact">
        <span class="gov-issue-key">${issueKeyLink(r)}</span>
        <span class="gov-issue-title">${escapeHtml(r.displayTitle || r.summary || '')}</span>
        <span class="gov-issue-impact-chip">${escapeHtml(r.impactLine || '')}</span>
      </div>
      <div class="gov-issue-row-detail">
        <span><strong>${escapeHtml(COPY.owner)}:</strong> ${escapeHtml(r.decisionNeededFrom || r.assigneeName || '—')}</span>
        <span><strong>${escapeHtml(COPY.nextMove)}:</strong> ${escapeHtml(r.recommendedAction || 'Review in Jira')}</span>
      </div>
    </li>`).join('');
  return `
    <details class="gov-issues-drawer" open>
      <summary class="gov-issues-drawer-summary">${escapeHtml(COPY.seeIssues)} (${issues.length})</summary>
      <ul class="gov-issues-drawer-list">${rows}</ul>
    </details>`;
}
