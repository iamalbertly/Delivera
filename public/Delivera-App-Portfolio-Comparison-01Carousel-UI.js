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
  const readiness = card.readiness || {};
  const gated = Boolean(readiness.gated);
  const m = card.metrics || {};
  const delivered = gated ? null : clampDeliveryPct(m.delivered);
  const proof = gated ? null : clampDeliveryPct(m.proofConfidence);
  const gradated = gated
    ? {
      statusClass: readiness.stage === 0 ? 'gate-critical' : 'gate-watch',
      statusLabel: readiness.label || card.status || 'Setup required',
    }
    : gradateCardStatus(card, delivered, proof);
  const statusClass = gradated.statusClass;
  const statusLabel = gradated.statusLabel;
  const displayName = String(card.squadName || card.projectKey || '').replace(/\s+board$/i, '').trim() || card.projectKey;
  const epicKey = card.primaryEpicKey && /-\d+$/.test(String(card.primaryEpicKey))
    ? card.primaryEpicKey
    : '';
  const squadLabel = epicKey
    ? renderJiraWorkItemLink({
      issueKey: epicKey,
      title: displayName,
      issueUrl: card.primaryEpicUrl || '',
      kind: 'epic',
      className: 'portfolio-bento-squad-link',
    })
    : renderJiraWorkItemLink({
      issueKey: card.projectKey,
      title: displayName,
      issueUrl: '',
      kind: 'squad',
      className: 'portfolio-bento-squad-link',
    });
  const squadCommitments = commitmentRows.filter((row) =>
    String(row.projectKey || '').toUpperCase() === String(card.projectKey || '').toUpperCase()
  );
  const nextLabel = gated ? (readiness.cta || card.nextAction || '') : buildBentoDecisionLabel(card, delivered, proof);
  const gateCta = gated && readiness.cta
    ? `<button type="button" class="btn btn-primary btn-compact portfolio-bento-gate-cta" data-testid="portfolio-readiness-cta" data-portfolio-action="${escapeHtml(readiness.action || 'open-alignment-studio')}" data-squad-key="${escapeHtml(card.projectKey || '')}" data-wizard-mode="${escapeHtml(readiness.wizardMode || 'slide')}">${escapeHtml(readiness.cta)}</button>`
    : '';
  const commitmentExpandHtml = !gated && squadCommitments.length
    ? `<div class="portfolio-bento-commitments" data-bento-commitments hidden>
        <p class="portfolio-bento-commitments-kicker">${squadCommitments.length} missing/unproven PI commitment${squadCommitments.length === 1 ? '' : 's'}</p>
        <ul class="portfolio-bento-commitments-list">
          ${squadCommitments.slice(0, 5).map((row) => `
            <li class="portfolio-bento-commitment-item" data-commitment-issue="${escapeHtml(row.issueKey || '')}" data-issue-key="${escapeHtml(row.issueKey || '')}">
              ${row.issueKey ? renderJiraWorkItemLink({
                issueKey: row.issueKey,
                title: row.issueKey,
                issueUrl: row.issueUrl || '',
                kind: 'epic',
                className: 'portfolio-bento-commitment-link',
              }) : `<strong>${escapeHtml(row.title?.slice(0, 30) || 'Commitment')}</strong>`}
              <span class="portfolio-bento-commitment-status">${escapeHtml(row.reality || row.governanceState || '')}</span>
              ${row.owner ? `<span class="portfolio-bento-commitment-owner">👤 ${escapeHtml(row.owner)}</span>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>`
    : '';
  const sprintHref = card.viewSquadHref || `/current-sprint?projects=${encodeURIComponent(card.projectKey || '')}`;
  const metricsBlock = gated
    ? `<div class="portfolio-bento-compact portfolio-bento-compact--gate">
        <p class="portfolio-bento-gate-reason" data-testid="portfolio-readiness-reason">${escapeHtml(readiness.reason || card.explanation || '')}</p>
        <p class="portfolio-bento-next"><strong>Do next:</strong> ${escapeHtml(nextLabel)}</p>
        ${gateCta}
      </div>`
    : `<div class="portfolio-bento-compact">
        <p class="portfolio-bento-delivered" data-bento-metric="delivered" data-hover-proof="evidence-count">${delivered}% delivered</p>
        <p class="portfolio-bento-commitments-summary" data-bento-metric="commitments" data-hover-proof="owner-lane">${escapeHtml(buildCommitmentSummary(card, squadCommitments, statusClass))}</p>
        <p class="portfolio-bento-trend" data-bento-metric="trend">Trend: ${escapeHtml(buildTrendLabel(card))}</p>
        <p class="portfolio-bento-diagnosis" data-bento-metric="diagnosis">${escapeHtml(buildDiagnosisLabel(card, delivered, proof))}</p>
        <p class="portfolio-bento-next" data-hover-proof="owner-lane"><strong>Do next:</strong> ${escapeHtml(nextLabel)}</p>
      </div>`;
  const rankReason = card.rankReason || card.explanation || '';
  return `
    <article class="portfolio-bento-card portfolio-bento-card--${escapeHtml(statusClass)}${card.selected ? ' is-selected' : ''}${gated ? ' is-gated' : ''}"
      data-squad-key="${escapeHtml(card.projectKey)}"
      data-squad-select="${escapeHtml(card.projectKey)}"
      ${gated ? '' : `data-squad-drill="${escapeHtml(card.projectKey)}"`}
      data-readiness-stage="${escapeHtml(String(readiness.stage ?? ''))}"
      data-hover-proof="status"
      data-testid="portfolio-bento-card"
      role="button"
      tabindex="0"
      title="${escapeHtml(card.proofDetail || card.explanation || 'Open squad deep dive')}">
      <header class="portfolio-bento-card-head">
        <strong class="portfolio-bento-squad">${squadLabel}</strong>
        <span class="portfolio-squad-status portfolio-squad-status--${escapeHtml(statusClass)}" data-hover-proof="status">${escapeHtml(statusLabel)}</span>
      </header>
      ${rankReason ? `<p class="portfolio-bento-rank-reason" data-testid="portfolio-bento-rank-reason">${escapeHtml(rankReason)}</p>` : ''}
      ${metricsBlock}
      ${gated ? '' : `<div class="portfolio-bento-why" data-bento-why hidden>
        <p class="portfolio-bento-why-label">Why Delivera says this</p>
        <p class="portfolio-bento-why-text">${escapeHtml(buildWhyText(card, delivered, proof))}</p>
      </div>`}
      <div class="portfolio-bento-card-actions">
        ${gated ? '' : `<a class="portfolio-bento-details-link" href="${escapeHtml(sprintHref)}" data-testid="portfolio-bento-details">Open sprint →</a>`}
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
        <div><dt>Behind commitment</dt><dd>—</dd></div>
        <div><dt>Proof</dt><dd>—</dd></div>
      </dl>
    </article>`;
}

export function renderPortfolioCarouselSkeleton({ anchor = '', compare = [], resolveName } = {}) {
  const nameFor = typeof resolveName === 'function'
    ? resolveName
    : (key) => key;
  const keys = [anchor, ...compare.filter((k) => String(k).toUpperCase() !== String(anchor).toUpperCase())]
    .map((k) => String(k || '').toUpperCase())
    .filter((k) => k && k !== '__ALL__')
    .slice(0, 4);
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

export function renderPortfolioCarousel(comparison = {}, { commitmentRows = [], isDrill = false } = {}) {
  const enriched = enrichComparisonForDiffOnly(comparison);
  const cards = (enriched.cards || []).filter((c) => {
    const pk = String(c.projectKey || '').toUpperCase();
    return pk && pk !== '__ALL__';
  });
  if (!cards.length) return '';
  const peerDelivered = cards
    .filter((c) => !c.selected && !c.readiness?.gated)
    .map((c) => Number(c.metrics?.delivered) || 0)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const peerMedianDelivered = peerDelivered.length
    ? peerDelivered[Math.floor(peerDelivered.length / 2)]
    : 0;
  const sharedBanner = enriched.sharedRootIssue
    ? `<p class="portfolio-compare-shared-root" data-testid="portfolio-compare-shared-root">Shared root issue: ${escapeHtml(enriched.sharedRootIssue)}</p>`
    : '';
  const readinessLine = comparison.readinessSummary?.line
    || enriched.readinessSummary?.line
    || '';
  const readinessStrip = readinessLine
    ? `<p class="portfolio-readiness-strip" data-testid="portfolio-readiness-strip">${escapeHtml(readinessLine)}</p>`
    : '';
  const modeStrip = Array.isArray(enriched.compareModes) && enriched.compareModes.length
    ? `<div class="portfolio-compare-modes" aria-label="Compare by leading indicator">
        ${enriched.compareModes.map((mode, index) => `
          <button type="button" class="portfolio-compare-mode${index === 0 ? ' is-active' : ''}" data-compare-mode="${escapeHtml(mode.id)}" title="${escapeHtml(mode.meaning || mode.label)}">${escapeHtml(mode.label)}</button>
        `).join('')}
      </div>`
    : '';
  const remainingCards = (enriched.remainingCards || []).filter((c) => {
    const pk = String(c.projectKey || '').toUpperCase();
    return pk && pk !== '__ALL__';
  });
  const lazyCardsHtml = remainingCards.length
    ? remainingCards.map((c) => renderBentoCard(c, { peerMedianDelivered, commitmentRows })
      .replace('portfolio-bento-card ', 'portfolio-bento-card is-lazy-hidden ')
      .replace('<article ', '<article hidden data-lazy-card="1" ')).join('')
    : '';
  const lazyStatus = enriched.lazyLoad?.enabled
    ? `<p class="portfolio-carousel-lazy-status" data-lazy-status>${escapeHtml(String(enriched.lazyLoad.remaining || remainingCards.length))} more squads ready on scroll</p>`
    : '';
  const headingText = isDrill ? 'Squad deep dive' : 'Squad comparison';
  const subtitleText = isDrill
    ? 'Focus on this squad — compare peers below'
    : 'Delivery, proof, and investment posture across peers';
  return `
    <section class="portfolio-carousel-wrap portfolio-bento-grid" aria-label="${escapeHtml(headingText)}" data-portfolio-carousel id="portfolio-compare">
      <div class="portfolio-carousel-head">
        <h2>${escapeHtml(headingText)}</h2>
        <p class="portfolio-carousel-strip">${escapeHtml(subtitleText)}</p>
        ${readinessStrip}
        ${modeStrip}
      </div>
      ${sharedBanner}
      <div class="portfolio-bento-grid-track" data-carousel-track role="list">
        ${cards.map((c) => renderBentoCard(c, { peerMedianDelivered, commitmentRows })).join('')}
        ${lazyCardsHtml}
      </div>
      ${lazyStatus}
    </section>`;
}

export function bindPortfolioCarousel(root, { onSelectSquad, onDrillIntoSquad } = {}) {
  if (!root) return;
  let cards = Array.from(root.querySelectorAll('[data-squad-key]'));
  const selectCard = (row) => {
    if (!row) return;
    onSelectSquad?.(row.getAttribute('data-squad-key'));
  };
  // P1 FIX: Whole-card hover reveals "Why Delivera says this" panel.
  // Also: raise the hovered card by 2-3px with increased shadow.
  // Respect reduced-motion settings.
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wireCard = (card) => {
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
  };
  cards.forEach(wireCard);
  const track = root.querySelector('[data-carousel-track]');
  const revealLazyCards = () => {
    const hidden = Array.from(root.querySelectorAll('[data-lazy-card][hidden]')).slice(0, 3);
    if (!hidden.length) return;
    hidden.forEach((card) => {
      card.hidden = false;
      card.classList.remove('is-lazy-hidden');
      wireCard(card);
    });
    cards = Array.from(root.querySelectorAll('[data-squad-key]:not([hidden])'));
    const remaining = root.querySelectorAll('[data-lazy-card][hidden]').length;
    const status = root.querySelector('[data-lazy-status]');
    if (status) status.textContent = remaining ? `${remaining} more squads ready on scroll` : 'All squads loaded';
  };
  track?.addEventListener('scroll', () => {
    if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 24) revealLazyCards();
  }, { passive: true });
  root.querySelectorAll('[data-compare-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-compare-mode]').forEach((node) => node.classList.toggle('is-active', node === btn));
      const meaning = btn.getAttribute('title') || btn.textContent || '';
      const status = root.querySelector('[data-lazy-status]');
      if (status) status.textContent = meaning;
    });
  });
  root.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-jira-work-item-link], .portfolio-bento-details-link, a')) return;
    // Whole card = deep dive (direct-to-value). Peer select kept via scope bar.
    const drillEl = ev.target.closest('[data-squad-drill]');
    if (drillEl && drillEl.getAttribute('data-squad-drill')) {
      ev.preventDefault();
      ev.stopPropagation();
      onDrillIntoSquad?.(drillEl.getAttribute('data-squad-drill'));
      return;
    }
    // Gate CTAs must not trigger squad drill.
    if (ev.target.closest('[data-portfolio-action="open-alignment-studio"], [data-portfolio-action="nudge-plan-stories"], [data-testid="portfolio-readiness-cta"]')) {
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
