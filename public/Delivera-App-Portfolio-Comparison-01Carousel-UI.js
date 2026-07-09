import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderJiraWorkItemLink } from './Delivera-Shared-Jira-WorkItem-Link-01Render-UI.js';

function width(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function renderRow(card = {}) {
  const m = card.metrics || {};
  const statusClass = card.statusClass || 'watch';
  const squadLabel = renderJiraWorkItemLink({
    issueKey: card.primaryEpicKey || card.projectKey,
    title: card.squadName || card.projectKey,
    issueUrl: card.primaryEpicUrl || '',
    kind: card.primaryEpicKey ? 'epic' : 'squad',
    className: 'portfolio-grid-squad-link',
  });
  return `
    <div class="portfolio-performance-grid-row${card.selected ? ' is-selected' : ''}"
      data-squad-key="${escapeHtml(card.projectKey)}"
      title="${escapeHtml(card.proofDetail || card.explanation || '')}">
      <span class="portfolio-grid-squad portfolio-grid-squad-select" role="button" tabindex="0" data-squad-select="${escapeHtml(card.projectKey)}">
        <strong>${squadLabel}</strong>
        <small class="portfolio-squad-status portfolio-squad-status--${escapeHtml(statusClass)}">${escapeHtml(card.status || 'Watch')}</small>
      </span>
      <span class="portfolio-grid-issue">${escapeHtml(card.mainIssue || '')}</span>
      <span class="portfolio-grid-bar" aria-label="Delivered ${width(m.delivered)}%">
        <i style="width:${width(m.delivered)}%"></i>
      </span>
      <span class="portfolio-grid-bar portfolio-grid-bar--proof" aria-label="Proof ${width(m.proofConfidence)}%">
        <i style="width:${width(m.proofConfidence)}%"></i>
      </span>
      <span class="portfolio-grid-number">${Number(card.affectedCommitmentCount) || 0}</span>
      <span class="portfolio-grid-action">${escapeHtml(card.nextAction || card.decisionNeeded || '')}</span>
    </div>`;
}

export function renderPortfolioCarousel(comparison = {}) {
  const cards = comparison.cards || [];
  if (!cards.length) return '';
  return `
    <section class="portfolio-carousel-wrap portfolio-performance-grid" aria-label="Squad performance grid" data-portfolio-carousel>
      <div class="portfolio-carousel-head">
        <h2>Squad performance grid</h2>
        <p class="portfolio-carousel-strip">Delivery / proof / open commitment drift</p>
      </div>
      <div class="portfolio-performance-grid-table" data-carousel-track tabindex="0" role="list">
        <div class="portfolio-performance-grid-head" aria-hidden="true">
          <span>Squad</span><span>Root issue</span><span>Delivery</span><span>Proof</span><span>Gaps</span><span>Next move</span>
        </div>
        ${cards.map(renderRow).join('')}
      </div>
    </section>`;
}

export function bindPortfolioCarousel(root, { onSelectSquad } = {}) {
  if (!root) return;
  const rows = Array.from(root.querySelectorAll('[data-squad-key]'));
  root.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-jira-work-item-link]')) return;
    const row = ev.target.closest('[data-squad-select]')?.closest('[data-squad-key]')
      || ev.target.closest('[data-squad-key]');
    if (!row || !ev.target.closest('[data-squad-select]')) return;
    onSelectSquad?.(row.getAttribute('data-squad-key'));
  });
  root.querySelector('[data-carousel-track]')?.addEventListener('keydown', (ev) => {
    const current = ev.target.closest('[data-squad-select]')?.closest('[data-squad-key]')
      || ev.target.closest('[data-squad-key]');
    const idx = Math.max(0, rows.indexOf(current));
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      rows[Math.min(rows.length - 1, idx + 1)]?.focus();
    }
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') {
      ev.preventDefault();
      rows[Math.max(0, idx - 1)]?.focus();
    }
  });
}
