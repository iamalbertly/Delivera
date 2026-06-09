import { escapeHtml, renderStructuredEvidence } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { renderInvestmentBodyHtml } from './Delivera-App-Governance-Brief-17Render-InvestmentDrawer-UI.js';

export function openEvidenceDrawer(brief, risks = [], { initialTab = 'proof' } = {}) {
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
  const proofActive = initialTab !== 'investment';
  const drawerBody = `
    <div class="gov-drawer-tabs" role="tablist">
      <button type="button" class="gov-drawer-tab${proofActive ? ' is-active' : ''}" data-drawer-tab="proof">${escapeHtml(COPY.drawerTabProof)}</button>
      <button type="button" class="gov-drawer-tab${!proofActive ? ' is-active' : ''}" data-drawer-tab="investment">${escapeHtml(COPY.drawerTabInvestment)}</button>
    </div>
    <div class="gov-drawer-tab-panel${proofActive ? ' is-active' : ''}" data-drawer-panel="proof">${body}</div>
    <div class="gov-drawer-tab-panel${!proofActive ? ' is-active' : ''}" data-drawer-panel="investment">${renderInvestmentBodyHtml(brief)}</div>`;
  const { el } = openRightDrawer({ title: 'Evidence pack', bodyHtml: drawerBody });
  el?.querySelectorAll('[data-drawer-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.getAttribute('data-drawer-tab');
      el.querySelectorAll('[data-drawer-tab]').forEach((t) => t.classList.toggle('is-active', t === tab));
      el.querySelectorAll('[data-drawer-panel]').forEach((p) => {
        p.classList.toggle('is-active', p.getAttribute('data-drawer-panel') === id);
      });
      try { sessionStorage.setItem('gov-drawer-active-tab', id || 'proof'); } catch (_) {}
    });
  });
}
