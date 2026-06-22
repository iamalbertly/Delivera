import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function gaugeRing(label, metric = {}) {
  const value = Math.max(0, Math.min(100, Number(metric.value) || 0));
  const peer = Number(metric.peerMedian) || 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const slug = label.toLowerCase().replace(/\s+/g, '-');
  return `
    <div class="portfolio-gauge" data-metric="${escapeHtml(slug)}">
      <div class="portfolio-gauge-visual" aria-hidden="true">
        <svg viewBox="0 0 88 88" class="portfolio-gauge-svg">
          <circle cx="44" cy="44" r="${r}" class="portfolio-gauge-track"/>
          <circle cx="44" cy="44" r="${r}" class="portfolio-gauge-fill"
            style="stroke-dasharray:${c.toFixed(2)};stroke-dashoffset:${offset.toFixed(2)}"/>
        </svg>
        <div class="portfolio-gauge-center">
          <strong class="portfolio-gauge-value">${value}%</strong>
        </div>
      </div>
      <span class="portfolio-gauge-label">${escapeHtml(label)}</span>
      <span class="portfolio-gauge-peer">vs peers ${peer}%</span>
    </div>`;
}

export function renderPortfolioSignal(decision = {}) {
  const m = decision.metrics || {};
  const trust = decision.trust || {};
  const rec = decision.recommendation || {};
  const hasActions = (trust.liveCases || 0) > 0 || (trust.nudgesReady || 0) > 0;
  const headline = decision.headline || 'Portfolio signal';
  return `
    <section class="portfolio-signal" aria-label="AI portfolio signal" data-portfolio-signal>
      <h2 class="portfolio-signal-headline">
        <span class="portfolio-signal-sparkle" aria-hidden="true">✦</span>
        AI portfolio signal: ${escapeHtml(headline)}
      </h2>
      <p class="portfolio-signal-summary">${escapeHtml(decision.summary || '')}</p>
      <div class="portfolio-signal-metrics" role="group" aria-label="Portfolio metrics">
        ${gaugeRing('Delivery', m.delivery)}
        ${gaugeRing('Off-plan load', m.offPlanLoad)}
        ${gaugeRing('Proof confidence', m.proofConfidence)}
      </div>
      <div class="portfolio-signal-trust" data-portfolio-trust>
        <span class="portfolio-trust-item" data-trust-live-cases>
          <span class="portfolio-trust-icon" aria-hidden="true">●</span>
          ${trust.liveCases || 0} live case${trust.liveCases === 1 ? '' : 's'}
        </span>
        <span class="portfolio-trust-item" data-trust-nudges>
          <span class="portfolio-trust-icon" aria-hidden="true">◆</span>
          ${trust.nudgesReady || 0} nudge${trust.nudgesReady === 1 ? '' : 's'} ready
        </span>
        <span class="portfolio-trust-item" data-trust-proof>
          <span class="portfolio-trust-icon" aria-hidden="true">◎</span>
          Proof: ${escapeHtml(trust.proofLevel || 'Medium')}
        </span>
      </div>
      <div class="portfolio-signal-actions">
        ${hasActions ? '<button type="button" class="btn btn-primary" data-portfolio-action="review-actions">Review actions →</button>' : ''}
        <button type="button" class="btn btn-secondary" data-portfolio-action="compare-peers">Compare peers</button>
      </div>
      <aside class="portfolio-signal-recommended" aria-label="Recommended action">
        <p class="portfolio-recommended-label">◎ Recommended</p>
        <p class="portfolio-recommended-value">${escapeHtml(rec.label || 'Review investment')}</p>
        <p class="portfolio-recommended-hint">Highest impact</p>
      </aside>
    </section>`;
}
