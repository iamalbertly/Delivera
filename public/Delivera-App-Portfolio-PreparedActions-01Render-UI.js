import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

export function renderPortfolioPreparedActions(decision = {}) {
  const prepared = decision.preparedActions || {};
  const groups = prepared.groups || [];
  const items = prepared.items || [];
  if (!groups.length && !items.length) {
    return `
      <section class="portfolio-prepared-actions portfolio-prepared-actions--empty" aria-label="Prepared actions" data-portfolio-prepared-actions>
        <h2 class="portfolio-prepared-title">Prepared actions</h2>
        <p class="portfolio-prepared-empty">No prepared nudges for this squad yet.</p>
      </section>`;
  }
  return `
    <section class="portfolio-prepared-actions" aria-label="Prepared actions" data-portfolio-prepared-actions>
      <h2 class="portfolio-prepared-title">Ready now</h2>
      <ul class="portfolio-prepared-groups">
        ${groups.map((g) => `<li class="portfolio-prepared-group">${escapeHtml(g.label || `${g.count} ${g.role}`)}</li>`).join('')}
      </ul>
      <button type="button" class="btn btn-secondary btn-compact portfolio-prepared-drawer-cta" data-portfolio-action="view-prepared-items">View prepared items</button>
      <div class="portfolio-prepared-footer">
        ${prepared.nextDeadline ? `<p class="portfolio-prepared-deadline">Next response due: <strong>${escapeHtml(prepared.nextDeadline)}</strong></p>` : ''}
        ${prepared.escalationReady ? '<p class="portfolio-prepared-escalation">Escalation ready if no response</p>' : ''}
      </div>
    </section>`;
}
