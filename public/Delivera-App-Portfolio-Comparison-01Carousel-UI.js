import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderJiraWorkItemLink } from './Delivera-Shared-Jira-WorkItem-Link-01Render-UI.js';
import { enrichComparisonForDiffOnly } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';
import { movementLabel } from './Delivera-App-Portfolio-Signal-01Render-UI.js';

function width(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function metricTone(value, invert = false) {
  const v = Number(value) || 0;
  if (invert) {
    if (v >= 40) return 'critical';
    if (v >= 25) return 'watch';
    return 'healthy';
  }
  if (v < 30) return 'critical';
  if (v < 55) return 'watch';
  return 'healthy';
}

function renderBentoCard(card = {}) {
  const m = card.metrics || {};
  const statusClass = card.statusClass || 'watch';
  const delivered = width(m.delivered);
  const offPlan = width(m.offPlanLoad);
  const proof = width(m.proofConfidence);
  const movement = movementLabel(delivered);
  const decisionLabel = card.decisionNeeded || card.nextAction || 'Continue monitoring';
  const squadLabel = renderJiraWorkItemLink({
    issueKey: card.primaryEpicKey || card.projectKey,
    title: card.squadName || card.projectKey,
    issueUrl: card.primaryEpicUrl || '',
    kind: card.primaryEpicKey ? 'epic' : 'squad',
    className: 'portfolio-bento-squad-link',
  });
  return `
    <article class="portfolio-bento-card portfolio-bento-card--${escapeHtml(statusClass)}${card.selected ? ' is-selected' : ''}"
      data-squad-key="${escapeHtml(card.projectKey)}"
      data-squad-select="${escapeHtml(card.projectKey)}"
      data-testid="portfolio-bento-card"
      role="button"
      tabindex="0"
      title="${escapeHtml(card.proofDetail || card.explanation || 'Select squad')}">
      <header class="portfolio-bento-card-head">
        <strong class="portfolio-bento-squad">${squadLabel}</strong>
        <span class="portfolio-squad-status portfolio-squad-status--${escapeHtml(statusClass)}">${escapeHtml(card.status || 'Watch')}</span>
      </header>
      <dl class="portfolio-bento-metrics">
        <div><dt>Promised impact</dt><dd>${Number(m.commitments) || 0}</dd></div>
        <div class="portfolio-bento-metric--${metricTone(delivered)}"><dt>Delivered</dt><dd>${delivered}%</dd></div>
        <div><dt>Movement</dt><dd>${escapeHtml(movement)}</dd></div>
        <div class="portfolio-bento-metric--${metricTone(offPlan, true)}"><dt>Off-plan load</dt><dd>${offPlan}%</dd></div>
        <div class="portfolio-bento-metric--${metricTone(proof)}"><dt>Proof confidence</dt><dd>${proof}%</dd></div>
      </dl>
      <div class="portfolio-bento-decision portfolio-bento-decision--${escapeHtml(statusClass)}">
        <span>Decision</span>
        <strong>${escapeHtml(decisionLabel)}</strong>
      </div>
      ${card.viewSquadHref ? `<a class="portfolio-bento-details-link" href="${escapeHtml(card.viewSquadHref)}" data-testid="portfolio-bento-details">View details →</a>` : ''}
    </article>`;
}

function renderSkeletonBentoCard({ projectKey = '', squadName = '', selected = false } = {}) {
  return `
    <article class="portfolio-bento-card portfolio-bento-card--skeleton${selected ? ' is-selected' : ''}"
      data-squad-key="${escapeHtml(projectKey)}"
      data-testid="portfolio-bento-card"
      aria-busy="true">
      <header class="portfolio-bento-card-head">
        <strong class="portfolio-bento-squad">${escapeHtml(squadName || projectKey)}</strong>
        <span class="portfolio-squad-status portfolio-squad-status--watch">Loading</span>
      </header>
      <dl class="portfolio-bento-metrics portfolio-bento-metrics--skeleton">
        <div><dt>Promised impact</dt><dd>—</dd></div>
        <div><dt>Delivered</dt><dd>—</dd></div>
        <div><dt>Movement</dt><dd>—</dd></div>
        <div><dt>Off-plan load</dt><dd>—</dd></div>
        <div><dt>Proof confidence</dt><dd>—</dd></div>
      </dl>
    </article>`;
}

export function renderPortfolioCarouselSkeleton({ anchor = '', compare = [], resolveName } = {}) {
  const nameFor = typeof resolveName === 'function'
    ? resolveName
    : (key) => key;
  const keys = [anchor, ...compare.filter((k) => String(k).toUpperCase() !== String(anchor).toUpperCase())].slice(0, 4);
  if (!keys.length) return '';
  return `
    <section class="portfolio-carousel-wrap portfolio-bento-grid" aria-label="Squad comparison" data-portfolio-carousel id="portfolio-compare" data-portfolio-carousel-skeleton="1">
      <div class="portfolio-carousel-head">
        <h2>Squad comparison</h2>
        <p class="portfolio-carousel-strip">Delivery, proof, and investment posture across peers</p>
      </div>
      <div class="portfolio-bento-grid-track" data-carousel-track role="list">
        ${keys.map((key) => renderSkeletonBentoCard({
          projectKey: key,
          squadName: nameFor(key),
          selected: String(key).toUpperCase() === String(anchor).toUpperCase(),
        })).join('')}
      </div>
    </section>`;
}

export function renderPortfolioCarousel(comparison = {}) {
  const enriched = enrichComparisonForDiffOnly(comparison);
  const cards = enriched.cards || [];
  if (!cards.length) return '';
  const sharedBanner = enriched.sharedRootIssue
    ? `<p class="portfolio-compare-shared-root" data-testid="portfolio-compare-shared-root">Shared root issue: ${escapeHtml(enriched.sharedRootIssue)}</p>`
    : '';
  return `
    <section class="portfolio-carousel-wrap portfolio-bento-grid" aria-label="Squad comparison" data-portfolio-carousel id="portfolio-compare">
      <div class="portfolio-carousel-head">
        <h2>Squad comparison</h2>
        <p class="portfolio-carousel-strip">Delivery, proof, and investment posture across peers</p>
      </div>
      ${sharedBanner}
      <div class="portfolio-bento-grid-track" data-carousel-track role="list">
        ${cards.map(renderBentoCard).join('')}
      </div>
    </section>`;
}

export function bindPortfolioCarousel(root, { onSelectSquad } = {}) {
  if (!root) return;
  const cards = Array.from(root.querySelectorAll('[data-squad-key]'));
  const selectCard = (row) => {
    if (!row) return;
    onSelectSquad?.(row.getAttribute('data-squad-key'));
  };
  root.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-jira-work-item-link]')) return;
    const row = ev.target.closest('[data-squad-key]');
    if (!row) return;
    selectCard(row);
  });
  root.querySelector('[data-carousel-track]')?.addEventListener('keydown', (ev) => {
    const current = ev.target.closest('[data-squad-key]');
    const idx = Math.max(0, cards.indexOf(current));
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      selectCard(current);
      return;
    }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      cards[Math.min(cards.length - 1, idx + 1)]?.focus();
    }
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') {
      ev.preventDefault();
      cards[Math.max(0, idx - 1)]?.focus();
    }
  });
}
