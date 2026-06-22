import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function metricTile(label, metric = {}) {
  const value = Number(metric.value) || 0;
  const peer = Number(metric.peerMedian) || 0;
  return `
    <div class="portfolio-metric" data-metric="${escapeHtml(label.toLowerCase().replace(/\s+/g, '-'))}">
      <span class="portfolio-metric-label">${escapeHtml(label)}</span>
      <strong class="portfolio-metric-value">${value}%</strong>
      <span class="portfolio-metric-peer">vs peers ${peer}%</span>
    </div>`;
}

export function renderPortfolioSignal(decision = {}) {
  const m = decision.metrics || {};
  const trust = decision.trust || {};
  const rec = decision.recommendation || {};
  const hasActions = (trust.liveCases || 0) > 0 || (trust.nudgesReady || 0) > 0;
  return `
    <section class="portfolio-signal" aria-label="AI portfolio signal" data-portfolio-signal>
      <p class="portfolio-signal-kicker">AI portfolio signal</p>
      <h2 class="portfolio-signal-headline">${escapeHtml(decision.headline || 'Portfolio signal')}</h2>
      <p class="portfolio-signal-summary">${escapeHtml(decision.summary || '')}</p>
      <div class="portfolio-signal-metrics" role="group" aria-label="Portfolio metrics">
        ${metricTile('Delivery', m.delivery)}
        ${metricTile('Off-plan load', m.offPlanLoad)}
        ${metricTile('Proof confidence', m.proofConfidence)}
      </div>
      <div class="portfolio-signal-trust" data-portfolio-trust title="Hover for scan details">
        <span data-trust-live-cases>${trust.liveCases || 0} live case${trust.liveCases === 1 ? '' : 's'}</span>
        <span data-trust-nudges>${trust.nudgesReady || 0} nudge${trust.nudgesReady === 1 ? '' : 's'} ready</span>
        <span data-trust-proof>Proof: ${escapeHtml(trust.proofLevel || 'Medium')}</span>
      </div>
      <div class="portfolio-signal-actions">
        ${hasActions ? '<button type="button" class="btn btn-primary" data-portfolio-action="review-actions">Review actions →</button>' : ''}
        <button type="button" class="btn btn-secondary" data-portfolio-action="compare-peers">Compare peers</button>
      </div>
      <aside class="portfolio-signal-recommended" aria-label="Recommended action">
        <p class="portfolio-recommended-label">Recommended</p>
        <p class="portfolio-recommended-value">${escapeHtml(rec.label || 'Review investment')}</p>
        <p class="portfolio-recommended-hint">Highest impact</p>
      </aside>
    </section>`;
}
