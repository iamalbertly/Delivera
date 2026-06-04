/**
 * Brief/Sprint shared: open Jira or show lightweight preview from evidence row.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function ensurePreviewHost() {
  let el = document.getElementById('delivera-shared-issue-preview');
  if (el) return el;
  el = document.createElement('aside');
  el.id = 'delivera-shared-issue-preview';
  el.className = 'issue-preview-drawer delivera-shared-issue-preview';
  el.setAttribute('aria-live', 'polite');
  el.hidden = true;
  document.body.appendChild(el);
  return el;
}

export function openGovernanceIssuePreview(brief, issueKey) {
  const key = String(issueKey || '').trim().toUpperCase();
  const risk = [...(brief?.topRisks || []), ...(brief?.portfolioRisks || [])]
    .find((r) => String(r.issueKey || '').toUpperCase() === key);
  if (risk?.issueUrl) {
    window.open(risk.issueUrl, '_blank', 'noopener');
    return;
  }
  const ev = (brief?.evidencePack?.rows || []).find(
    (r) => String(r.issueKey).toUpperCase() === key,
  );
  const host = ensurePreviewHost();
  if (!ev && !risk) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  host.innerHTML = `
    <button type="button" class="btn btn-link btn-compact" data-close-preview>Close</button>
    <h3>${escapeHtml(key)}</h3>
    <p>${escapeHtml(ev?.summary || risk?.summary || '')}</p>
    <p><strong>Status:</strong> ${escapeHtml(ev?.statusNow || risk?.status || '')}</p>
    <p>${escapeHtml(ev?.whyFlagged || risk?.evidence || '')}</p>
    ${ev?.issueUrl || risk?.issueUrl
      ? `<a href="${escapeHtml(ev?.issueUrl || risk.issueUrl)}" target="_blank" rel="noopener">Open in Jira</a>`
      : ''}`;
  host.querySelector('[data-close-preview]')?.addEventListener('click', () => { host.hidden = true; });
}

export function wireGovernanceIssuePreview(brief, root = document) {
  root.addEventListener('click', (e) => {
    const link = e.target.closest('.gov-issue-key-link[data-issue-key]');
    if (!link || e.metaKey || e.ctrlKey) return;
    const key = link.getAttribute('data-issue-key');
    if (!key) return;
    e.preventDefault();
    openGovernanceIssuePreview(brief, key);
  });
}
