import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderStructuredEvidence } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { openRightDrawer } from './Delivera-App-Shared-RightDrawer-01UI.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { renderInvestmentBodyHtml } from './Delivera-App-Governance-Brief-17Render-InvestmentDrawer-UI.js';
import { ensureLegacyBriefSurfacesHydrated } from './Delivera-Governance-Brief-Page-03Load-Controller.js';
import {
  GOV_DRAWER_TAB_KEY,
  activateTabStrip,
  bindTabStrip,
  readStoredTab,
} from './Delivera-Shared-TabStrip-01Activate-Helper.js';

const DRAWER_TAB_KEYS = ['proof', 'investment'];

export function openEvidenceDrawer(brief, risks = [], { initialTab = 'proof' } = {}) {
  try { sessionStorage.setItem('delivera:legacy-brief-needed', '1'); } catch (_) { /* ignore */ }
  ensureLegacyBriefSurfacesHydrated(brief);
  const rows = brief?.evidencePack?.rows || [];
  const keys = new Set(risks.map((r) => String(r.issueKey || '').toUpperCase()).filter(Boolean));
  const filtered = keys.size
    ? rows.filter((row) => keys.has(String(row.issueKey).toUpperCase()))
    : rows;
  let body = '';
  if (!filtered.length) {
    body = '<p class="governance-empty">No proof packet is ready for these items yet. Delivera keeps the Jira watch in the background; this is not a second backlog to browse.</p>';
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
  // Inline investment summary above proof list — no tabs, one scroll.
  const investmentStrip = `<div class="gov-evidence-investment-strip" data-evidence-investment-strip>${renderInvestmentBodyHtml(brief)}</div>`;
  const drawerBody = `
    <p class="gov-evidence-drawer-framing">Proof is not another Jira table or PowerBI view. It is the defendable trail for why a PI commitment is blocked, diverted, or not traceable.</p>
    ${investmentStrip}
    <div class="gov-evidence-proof-list" data-evidence-proof-list>${body}</div>`;
  const { el } = openRightDrawer({ title: 'Evidence pack', bodyHtml: drawerBody });
  return { el };
}
