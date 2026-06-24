import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function compactMetric(label, metric = {}) {
  const value = Math.max(0, Math.min(100, Number(metric.value) || 0));
  const peer = Number(metric.peerMedian) || 0;
  const slug = label.toLowerCase().replace(/\s+/g, '-');
  const hidePeer = value === 0 && peer === 0;
  return `
    <div class="portfolio-metric" data-metric="${escapeHtml(slug)}">
      <span class="portfolio-metric-label">${escapeHtml(label)}</span>
      <strong class="portfolio-metric-value">${value}%</strong>
      ${hidePeer ? '' : `<span class="portfolio-metric-peer">vs peers ${peer}%</span>`}
    </div>`;
}

function formatCachedFreshness(cachedAt) {
  if (!cachedAt) return '';
  const ms = new Date(cachedAt).getTime();
  if (!Number.isFinite(ms)) return '';
  const mins = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (mins < 60) return `Updated ${mins}m ago`;
  const hours = Math.round(mins / 60);
  return `Updated ${hours}h ago`;
}

export function renderPortfolioSignal(decision = {}, { cachedAt = '', cached = false } = {}) {
  const m = decision.metrics || {};
  const trust = decision.trust || {};
  const narrative = decision.narrative || {};
  const above = decision.aboveFold || {};
  const peer = decision.peerComparison || {};
  const headline = narrative.headline || decision.headline || 'Portfolio signal';
  const summary = narrative.summary || decision.summary || '';
  const showSummary = summary && summary.trim() !== headline.trim();
  const freshness = cached || cachedAt ? formatCachedFreshness(cachedAt) : '';
  const hasActions = (trust.liveCases || 0) > 0 || (trust.nudgesReady || 0) > 0;

  return `
    <section class="portfolio-signal" aria-label="AI portfolio signal" data-portfolio-signal>
      <div class="portfolio-signal-top">
        <p class="portfolio-signal-kicker">AI portfolio signal${freshness ? ` · <span class="portfolio-signal-freshness">${escapeHtml(freshness)}</span>` : ''}</p>
        <span id="portfolio-signal-ai-mount" class="portfolio-signal-ai-mount"></span>
      </div>
      <h2 class="portfolio-signal-headline">${escapeHtml(headline)}</h2>
      <div class="portfolio-above-fold" data-portfolio-above-fold>
        <span class="portfolio-fold-stat"><strong>${above.exposedCommitments || 0}</strong> commitment${above.exposedCommitments === 1 ? '' : 's'} exposed</span>
        <span class="portfolio-fold-stat"><strong>${above.actionsReady || 0}</strong> action${above.actionsReady === 1 ? '' : 's'} ready</span>
        <span class="portfolio-fold-stat"><strong>${above.poResponsesRequired || 0}</strong> PO response${above.poResponsesRequired === 1 ? '' : 's'} required</span>
        ${above.nextDeadline ? `<span class="portfolio-fold-stat">Next deadline: <strong>${escapeHtml(above.nextDeadline)}</strong></span>` : ''}
      </div>
      <p class="portfolio-signal-main-issue"><strong>Main issue:</strong> ${escapeHtml(above.mainIssue || narrative.mainIssue || '')}</p>
      ${peer.sentence ? `<p class="portfolio-signal-peer" data-portfolio-peer-comparison>${escapeHtml(peer.sentence)}</p>` : ''}
      ${showSummary ? `<p class="portfolio-signal-summary">${escapeHtml(summary)}</p>` : ''}
      <div class="portfolio-signal-metrics portfolio-metric-row" role="group" aria-label="Portfolio metrics">
        ${compactMetric('Delivery', m.delivery)}
        ${compactMetric('Off-plan', m.offPlanLoad)}
        ${compactMetric('Proof', m.proofConfidence)}
      </div>
      <div class="portfolio-signal-trust portfolio-signal-trust--compact" data-portfolio-trust>
        <span class="portfolio-trust-item" data-trust-live-cases>
          ${trust.liveCases || 0} live case${trust.liveCases === 1 ? '' : 's'}
        </span>
        <span class="portfolio-trust-item" data-trust-proof>
          Proof: ${escapeHtml(trust.proofLevel || 'Medium')}
        </span>
        ${narrative.escalationReady ? '<span class="portfolio-trust-item portfolio-trust-escalation">Escalation ready if no response</span>' : ''}
      </div>
      <div class="portfolio-signal-actions">
        ${hasActions ? '<button type="button" class="btn btn-primary btn-compact" data-portfolio-action="review-actions">Approve prepared actions →</button>' : ''}
      </div>
    </section>`;
}
