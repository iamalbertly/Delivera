import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderJiraWorkItemLink } from './Delivera-Shared-Jira-WorkItem-Link-01Render-UI.js';
import { enrichComparisonForDiffOnly } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';
import {
  clampDeliveryPct,
  gradateCardStatus,
  buildCommitmentSummary,
  buildBentoDecisionLabel,
  buildTrendLabel,
  buildDiagnosisLabel,
  buildWhyText,
} from './Delivera-App-Portfolio-CardStatus-01Gradation-SSOT.js';

function renderBentoCard(card = {}, { commitmentRows = [] } = {}) {
  const m = card.metrics || {};
  const delivered = clampDeliveryPct(m.delivered);
  const proof = clampDeliveryPct(m.proofConfidence);
  // P1 FIX: Gradate the bento card status instead of binary "At risk".
  // Critical (red): <50% delivered or stalled. Watch (amber): 50-79%.
  // On Track (green): ≥80% delivered with ≥40% proof.
  const gradated = gradateCardStatus(card, delivered, proof);
  const statusClass = gradated.statusClass;
  const statusLabel = gradated.statusLabel;
  const displayName = String(card.squadName || card.projectKey || '').replace(/\s+board$/i, '').trim() || card.projectKey;
  const squadLabel = renderJiraWorkItemLink({
    issueKey: card.primaryEpicKey || card.projectKey,
    title: displayName,
    issueUrl: card.primaryEpicUrl || '',
    kind: card.primaryEpicKey ? 'epic' : 'squad',
    className: 'portfolio-bento-squad-link',
  });
  const squadCommitments = commitmentRows.filter((row) =>
    String(row.projectKey || '').toUpperCase() === String(card.projectKey || '').toUpperCase()
  );
  const nextLabel = buildBentoDecisionLabel(card, delivered, proof);
  const commitmentExpandHtml = squadCommitments.length
    ? `<div class="portfolio-bento-commitments" data-bento-commitments hidden>
        <p class="portfolio-bento-commitments-kicker">${squadCommitments.length} missing/unproven PI commitment${squadCommitments.length === 1 ? '' : 's'}</p>
        <ul class="portfolio-bento-commitments-list">
          ${squadCommitments.slice(0, 5).map((row) => `
            <li class="portfolio-bento-commitment-item" data-commitment-issue="${escapeHtml(row.issueKey || '')}" data-issue-key="${escapeHtml(row.issueKey || '')}">
              <strong>${escapeHtml(row.issueKey || row.title?.slice(0, 30) || 'Commitment')}</strong>
              <span class="portfolio-bento-commitment-status">${escapeHtml(row.reality || row.governanceState || '')}</span>
              ${row.owner ? `<span class="portfolio-bento-commitment-owner">👤 ${escapeHtml(row.owner)}</span>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>`
    : '';
  const sprintHref = card.viewSquadHref || `/current-sprint?projects=${encodeURIComponent(card.projectKey || '')}`;
  return `
    <article class="portfolio-bento-card portfolio-bento-card--${escapeHtml(statusClass)}${card.selected ? ' is-selected' : ''}"
      data-squad-key="${escapeHtml(card.projectKey)}"
      data-squad-select="${escapeHtml(card.projectKey)}"
      data-squad-drill="${escapeHtml(card.projectKey)}"
      data-hover-proof="status"
      data-testid="portfolio-bento-card"
      role="button"
      tabindex="0"
      title="${escapeHtml(card.proofDetail || card.explanation || 'Open squad deep dive')}">
      <header class="portfolio-bento-card-head">
        <strong class="portfolio-bento-squad">${squadLabel}</strong>
        <span class="portfolio-squad-status portfolio-squad-status--${escapeHtml(statusClass)}" data-hover-proof="status">${escapeHtml(statusLabel)}</span>
      </header>
      <div class="portfolio-bento-compact">
        <p class="portfolio-bento-delivered" data-bento-metric="delivered" data-hover-proof="evidence-count">${delivered}% delivered</p>
        <p class="portfolio-bento-commitments-summary" data-bento-metric="commitments" data-hover-proof="owner-lane">${escapeHtml(buildCommitmentSummary(card, squadCommitments, statusClass))}</p>
        <p class="portfolio-bento-trend" data-bento-metric="trend">Trend: ${escapeHtml(buildTrendLabel(card))}</p>
        <p class="portfolio-bento-diagnosis" data-bento-metric="diagnosis">${escapeHtml(buildDiagnosisLabel(card, delivered, proof))}</p>
        <p class="portfolio-bento-next" data-hover-proof="owner-lane"><strong>Do next:</strong> ${escapeHtml(nextLabel)}</p>
      </div>
      <div class="portfolio-bento-why" data-bento-why hidden>
        <p class="portfolio-bento-why-label">Why Delivera says this</p>
        <p class="portfolio-bento-why-text">${escapeHtml(buildWhyText(card, delivered, proof))}</p>
      </div>
      <div class="portfolio-bento-card-actions">
        <a class="portfolio-bento-details-link" href="${escapeHtml(sprintHref)}" data-testid="portfolio-bento-details">Open sprint →</a>
      </div>
      ${commitmentExpandHtml}
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
        <span class="portfolio-squad-status portfolio-squad-status--skeleton">—</span>
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

export function renderPortfolioCarousel(comparison = {}, { commitmentRows = [] } = {}) {
  const enriched = enrichComparisonForDiffOnly(comparison);
  const cards = enriched.cards || [];
  if (!cards.length) return '';
  const peerDelivered = cards
    .filter((c) => !c.selected)
    .map((c) => Number(c.metrics?.delivered) || 0)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const peerMedianDelivered = peerDelivered.length
    ? peerDelivered[Math.floor(peerDelivered.length / 2)]
    : 0;
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
        ${cards.map((c) => renderBentoCard(c, { peerMedianDelivered, commitmentRows })).join('')}
      </div>
    </section>`;
}

export function bindPortfolioCarousel(root, { onSelectSquad, onDrillIntoSquad } = {}) {
  if (!root) return;
  const cards = Array.from(root.querySelectorAll('[data-squad-key]'));
  const selectCard = (row) => {
    if (!row) return;
    onSelectSquad?.(row.getAttribute('data-squad-key'));
  };
  // P1 FIX: Whole-card hover reveals "Why Delivera says this" panel.
  // Also: raise the hovered card by 2-3px with increased shadow.
  // Respect reduced-motion settings.
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  cards.forEach((card) => {
    const whyPanel = card.querySelector('[data-bento-why]');
    const commitments = card.querySelector('[data-bento-commitments]');
    if (whyPanel) {
      const show = () => { whyPanel.hidden = false; card.classList.add('is-hovered'); };
      const hide = () => { whyPanel.hidden = true; card.classList.remove('is-hovered'); };
      card.addEventListener('mouseenter', show);
      card.addEventListener('mouseleave', hide);
      card.addEventListener('focusin', show);
      card.addEventListener('focusout', hide);
    }
    if (commitments) {
      card.addEventListener('mouseenter', () => { commitments.hidden = false; });
      card.addEventListener('mouseleave', () => { commitments.hidden = true; });
      card.addEventListener('focusin', () => { commitments.hidden = false; });
      card.addEventListener('focusout', () => { commitments.hidden = true; });
    }
    // P1 FIX: Metric hover highlights same metric on all cards.
    card.querySelectorAll('[data-bento-metric]').forEach((metric) => {
      const metricType = metric.getAttribute('data-bento-metric');
      metric.addEventListener('mouseenter', () => {
        root.querySelectorAll(`[data-bento-metric="${metricType}"]`).forEach((m) => m.classList.add('is-metric-highlighted'));
      });
      metric.addEventListener('mouseleave', () => {
        root.querySelectorAll(`[data-bento-metric="${metricType}"]`).forEach((m) => m.classList.remove('is-metric-highlighted'));
      });
    });
  });
  root.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-jira-work-item-link], .portfolio-bento-details-link, a')) return;
    // Whole card = deep dive (direct-to-value). Peer select kept via scope bar.
    const drillEl = ev.target.closest('[data-squad-drill]');
    if (drillEl) {
      ev.preventDefault();
      ev.stopPropagation();
      onDrillIntoSquad?.(drillEl.getAttribute('data-squad-drill'));
      return;
    }
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
