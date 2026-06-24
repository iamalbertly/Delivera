import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

export function renderPortfolioCommitments(decision = {}) {
  const rows = decision.affectedCommitments || [];
  const maxVisible = 3;
  const visible = rows.slice(0, maxVisible);
  const overflow = Math.max(0, rows.length - maxVisible);
  if (!rows.length) {
    return `
      <section class="portfolio-commitments portfolio-commitments--empty" aria-label="Affected commitments" data-portfolio-commitments>
        <h2 class="portfolio-commitments-title">Affected commitments</h2>
        <p class="portfolio-commitments-empty">No exposed commitments detected for the selected squad.</p>
      </section>`;
  }
  return `
    <section class="portfolio-commitments" aria-label="Affected commitments" data-portfolio-commitments>
      <h2 class="portfolio-commitments-title">Affected commitments</h2>
      <ul class="portfolio-commitments-list">
        ${visible.map((c) => `
          <li class="portfolio-commitment-row" data-commitment-id="${escapeHtml(c.id || '')}">
            <div class="portfolio-commitment-head">
              <strong class="portfolio-commitment-title">${escapeHtml(c.title || '')}</strong>
              <span class="portfolio-commitment-status portfolio-commitment-status--${escapeHtml(String(c.status || '').toLowerCase().replace(/\s+/g, '-'))}">${escapeHtml(c.status || '')}</span>
            </div>
            <p class="portfolio-commitment-meta">${escapeHtml(c.periodKey || decision.periodKey || '')}${c.projectKey ? ` · ${escapeHtml(c.projectKey)}` : ''}</p>
            <p class="portfolio-commitment-reason"><span>Reason:</span> ${escapeHtml(c.reason || '')}</p>
            <p class="portfolio-commitment-decision"><span>Decision:</span> ${escapeHtml(c.decisionNeeded || '')}</p>
          </li>`).join('')}
        ${overflow > 0 ? `
          <li class="portfolio-commitments-more">
            <button type="button" class="btn btn-secondary btn-compact" data-portfolio-action="expand-commitments">+${overflow} more commitment${overflow === 1 ? '' : 's'}</button>
            <ul class="portfolio-commitments-overflow" hidden>
              ${rows.slice(maxVisible).map((c) => `
                <li class="portfolio-commitment-row" data-commitment-id="${escapeHtml(c.id || '')}">
                  <div class="portfolio-commitment-head">
                    <strong class="portfolio-commitment-title">${escapeHtml(c.title || '')}</strong>
                    <span class="portfolio-commitment-status">${escapeHtml(c.status || '')}</span>
                  </div>
                  <p class="portfolio-commitment-reason">${escapeHtml(c.reason || '')}</p>
                </li>`).join('')}
            </ul>
          </li>` : ''}
      </ul>
    </section>`;
}
