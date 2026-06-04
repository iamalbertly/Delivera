import { escapeHtml, renderStructuredEvidence } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';

export function openEvidenceDrawer(brief, risks = []) {
  const rows = brief?.evidencePack?.rows || [];
  const keys = new Set(risks.map((r) => String(r.issueKey || '').toUpperCase()).filter(Boolean));
  const filtered = keys.size
    ? rows.filter((row) => keys.has(String(row.issueKey).toUpperCase()))
    : rows;
  let body = '';
  if (!filtered.length) {
    body = '<p class="governance-empty">No changelog evidence fetched for these items.</p>';
  } else {
    body = filtered.map((row) => {
      const risk = risks.find((r) => String(r.issueKey).toUpperCase() === String(row.issueKey).toUpperCase()) || { issueKey: row.issueKey, evidence: row.whyFlagged };
      return `<div class="gov-evidence-drawer-block">
        <h3>${escapeHtml(row.issueKey)}</h3>
        <p class="gov-evidence-why"><strong>Why flagged:</strong> ${escapeHtml(row.whyFlagged || risk.evidence || '')}</p>
        ${renderStructuredEvidence(row, risk)}
      </div>`;
    }).join('');
  }
  openRightDrawer({ title: 'Evidence pack', bodyHtml: body });
}
