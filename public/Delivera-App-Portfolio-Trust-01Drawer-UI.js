import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

export function openPortfolioTrustDrawer(decision = {}) {
  const trust = decision.trust || {};
  const existing = document.getElementById('portfolio-trust-drawer');
  if (existing) existing.remove();
  const el = document.createElement('dialog');
  el.id = 'portfolio-trust-drawer';
  el.className = 'portfolio-trust-drawer';
  el.innerHTML = `
    <form method="dialog" class="portfolio-trust-drawer-inner">
      <header><h2>How AI decides</h2><button type="submit" class="btn btn-secondary btn-compact">Close</button></header>
      <ul class="portfolio-trust-list">
        <li><strong>Data sources</strong><span>Jira boards, PI baseline, intervention cases, evidence packs</span></li>
        <li><strong>Deterministic rules</strong><span>Delivery, off-plan load, and proof confidence drive recommendations</span></li>
        <li><strong>OpenRouter</strong><span>${escapeHtml(trust.wordingSource === 'template' ? 'AI wording unavailable — verified template used' : 'May polish headlines when configured')}</span></li>
        <li><strong>Verification</strong><span>${trust.claimsVerified ? 'Claims passed verification' : 'Claims need review'}</span></li>
        <li><strong>Last scan</strong><span>${escapeHtml(trust.lastScanAt || 'Unknown')}</span></li>
        <li><strong>Human approval</strong><span>Jira comments and escalations always require review</span></li>
      </ul>
    </form>`;
  document.body.appendChild(el);
  el.showModal();
}
