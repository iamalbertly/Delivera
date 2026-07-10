/**
 * Portfolio decision outcomes — record + user-facing feedback (intervention-linked).
 */
import { fetchJson, showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { portfolioDecisionLabel, COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

let lastOutcomeToken = 0;

export async function recordPortfolioDecisionOutcome({
  decision = {},
  decisionId = 'review-investment',
  host = document.getElementById('main-content'),
  onUndo,
} = {}) {
  const token = ++lastOutcomeToken;
  const project = decision.anchorProject || '';
  const periodKey = decision.periodKey || '';
  const label = portfolioDecisionLabel(decisionId);
  try {
    const res = await fetchJson('/api/governance/portfolio-decision/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project, periodKey, decisionId }),
    }, 'portfolio-decision-confirm');
    if (token !== lastOutcomeToken) return null;
    const caseId = res?.case?.id || '';
    const suffix = caseId ? ' — open Actions to review' : '';
    showInlineToast(host, `${label} saved${suffix}`, 'info');
    return res;
  } catch (err) {
    showInlineToast(host, err?.message || 'Could not save decision', 'error');
    throw err;
  }
}

export function highlightPortfolioBentoCard(root, projectKey) {
  if (!root || !projectKey) return;
  const key = String(projectKey).toUpperCase();
  root.querySelectorAll('[data-squad-key]').forEach((card) => {
    card.classList.toggle('is-selected', String(card.getAttribute('data-squad-key')).toUpperCase() === key);
  });
}

export function renderBentoPreviewBanner(card = {}) {
  if (!card?.projectKey) return '';
  const m = card.metrics || {};
  const squad = card.squadName || card.projectKey;
  const delivered = Number(m.delivered) || 0;
  return `<p class="portfolio-bento-preview-banner" data-testid="portfolio-bento-preview" aria-live="polite">${escapeHtml(COPY.portfolioBentoPreviewing.replace('{squad}', squad))} · ${delivered}% delivered · <button type="button" class="btn btn-link btn-compact" data-portfolio-bento-focus="${escapeHtml(card.projectKey)}">${escapeHtml(COPY.portfolioBentoFocusSquad)}</button></p>`;
}
