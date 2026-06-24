import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml, buildDecisionsRows } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

const DUE_BY_ESCALATION = {
  escalate: 'Today',
  'act-today': 'Today',
  watch: 'Next check-in',
};

function actionKey(row) {
  return row.issueKey && row.issueKey !== '—' && row.issueKey !== 'Portfolio'
    ? String(row.issueKey).toUpperCase()
    : `portfolio:${row.owner}:${row.action}`;
}

export function buildTopActionCards(brief, max = 3) {
  const rows = buildDecisionsRows(brief);
  const seen = new Set();
  const cards = [];
  for (const r of rows) {
    const key = actionKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    const risk = (brief?.topRisks || []).find(
      (x) => x.issueKey && String(x.issueKey).toUpperCase() === String(r.issueKey).toUpperCase(),
    ) || (brief?.portfolioRisks || []).find((x) => (x.squad || '') === r.issueKey);
    cards.push({
      owner: r.owner,
      action: r.action,
      proof: r.issueKey !== '—' ? (risk?.evidence || r.issueKey) : (risk?.evidence || ''),
      due: DUE_BY_ESCALATION[risk?.escalation] || 'Next check-in',
    });
    if (cards.length >= max) break;
  }
  return cards;
}

export function renderActionCards(brief) {
  const cards = buildTopActionCards(brief);
  if (!cards.length) {
    return '<p class="governance-empty">No actions flagged for this scope.</p>';
  }
  const html = cards.map((c, i) => `
    <article class="gov-action-card" data-action-card="${i}">
      <p class="gov-action-card-owner">${escapeHtml(c.owner)}</p>
      <p class="gov-action-card-action">${escapeHtml(c.action)}</p>
      <p class="gov-action-card-due">Due: ${escapeHtml(c.due)}</p>
      ${c.proof ? `<p class="gov-risk-proof-line"><strong>${escapeHtml(COPY.proofLine)}:</strong> ${escapeHtml(c.proof)}</p>` : ''}
    </article>`).join('');
  return `<div class="gov-action-cards">${html}</div>`;
}
