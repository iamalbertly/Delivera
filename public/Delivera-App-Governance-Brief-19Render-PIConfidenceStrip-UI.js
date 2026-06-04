import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { GOV_TOOLTIPS } from './Delivera-App-Governance-Brief-Tooltip-01SSOT.js';

function chipHtml(chip) {
  const elapsed = chip.elapsedPct != null ? `${chip.elapsedPct}% elapsed` : 'dates unknown';
  const delivery = chip.deliveryPct != null ? `${chip.deliveryPct}% delivered` : 'delivery pending';
  const conf = chip.confidenceLabel || 'Medium';
  return `
    <article class="gov-pi-chip" data-issue-key="${escapeHtml(chip.issueKey || '')}">
      <header class="gov-pi-chip-head">
        <span class="gov-pi-chip-key">${escapeHtml(chip.issueKey || '')}</span>
        <span class="gov-pi-chip-conf gov-pi-conf--${escapeHtml(String(conf).toLowerCase())}">${escapeHtml(conf)}</span>
      </header>
      <p class="gov-pi-chip-title">${escapeHtml(chip.title || '')}</p>
      <div class="gov-pi-chip-bars">
        <span class="gov-pi-bar-label">Time</span>
        <div class="gov-pi-bar"><span style="width:${chip.elapsedPct || 0}%"></span></div>
        <span class="gov-pi-bar-label">Delivery</span>
        <div class="gov-pi-bar gov-pi-bar--delivery"><span style="width:${chip.deliveryPct || 0}%"></span></div>
      </div>
      <p class="gov-pi-chip-meta">${escapeHtml(elapsed)} · ${escapeHtml(delivery)}</p>
    </article>`;
}

export function renderPIConfidenceStrip(brief) {
  const strip = brief?.meta?.piConfidence;
  if (!strip) return '';
  const trustedCls = strip.trusted ? 'is-trusted' : 'is-limited';
  const chips = (strip.timelineChips || []).map(chipHtml).join('');
  const chipsBlock = chips
    ? `<div class="gov-pi-chip-row" role="list">${chips}</div>`
    : '<p class="gov-pi-empty">Set PI baseline to unlock timeline chips.</p>';

  return `
    <section class="gov-pi-strip ${trustedCls}" aria-label="PI confidence" title="${escapeHtml(GOV_TOOLTIPS.piConfidence)}">
      <div class="gov-pi-strip-head">
        <h2 class="gov-pi-strip-title">${escapeHtml(strip.headline || 'PI Confidence')}</h2>
        <p class="gov-pi-strip-sub">${escapeHtml(strip.subline || '')}</p>
      </div>
      <details class="gov-pi-strip-details">
        <summary>Timeline (${(strip.timelineChips || []).length})</summary>
        ${chipsBlock}
      </details>
    </section>`;
}
