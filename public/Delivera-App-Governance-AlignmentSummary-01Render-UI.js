/**
 * Below-fold alignment summary — weighted squad cards, not equal bento.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function cardWeight(attentionState = '') {
  if (attentionState === 'off-plan' || attentionState === 'decision-required') return 'wide';
  if (attentionState === 'proof-required') return 'medium';
  return 'compact';
}

export function renderAlignmentSummary(portfolioJudgment = {}) {
  const squads = portfolioJudgment?.squads || [];
  if (!squads.length) return '';

  const cards = squads.map((s) => {
    const weight = cardWeight(s.attentionState);
    let tone = s.attentionState === 'no-action' || s.attentionState === 'complete' ? 'healthy' : 'watch';
    if (s.attentionState === 'off-plan' || s.attentionState === 'decision-required') tone = 'critical';
    return `
      <article class="gov-alignment-card gov-alignment-card--${weight} gov-alignment-card--${escapeHtml(tone)}"
        data-testid="governance-alignment-card"
        data-squad-key="${escapeHtml(s.projectKey)}">
        <h3>${escapeHtml(s.squadName || s.projectKey)}</h3>
        <p class="gov-alignment-state">${escapeHtml(s.attentionLabel || '')}</p>
        <p class="gov-alignment-meaning">${escapeHtml(s.meaning || '')}</p>
        ${s.offPlanHours ? `<p class="gov-alignment-hours">${Math.round(s.offPlanHours)} hours this quarter</p>` : ''}
      </article>`;
  }).join('');

  return `
    <section class="gov-alignment-summary" data-testid="governance-alignment-summary" aria-label="Portfolio alignment summary">
      <h2 class="gov-below-fold-title">Portfolio alignment</h2>
      <div class="gov-alignment-summary-grid">${cards}</div>
    </section>`;
}
