import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

function verdictLabel(ev) {
  const label = ev?.verdictLabel || '';
  if (label === 'DELIVERY BLOCKED') return COPY.verdictBlocked;
  if (label === 'TOO EARLY') return COPY.verdictTooEarly;
  if (label === 'NEEDS WATCH') return COPY.verdictWatch;
  return COPY.verdictOnTrack;
}

function squadVerdictLabel(squad) {
  const label = squad?.verdictLabel || '';
  if (label === 'DELIVERY BLOCKED') return COPY.verdictBlocked;
  if (label === 'TOO EARLY') return COPY.verdictTooEarly;
  if (label === 'NEEDS WATCH') return COPY.verdictWatch;
  return COPY.verdictOnTrack;
}

/**
 * Shared sprint pulse bars (value + time).
 * @param {object} pulse
 * @param {{ impact?: string }} [opts]
 */
export function renderPulseBars(pulse = {}, opts = {}) {
  const committed = Number(pulse.committed) || 0;
  const done = Number(pulse.done) || 0;
  const pct = committed > 0 ? Math.round((done / committed) * 100) : 0;
  const elapsed = pulse.daysElapsed != null ? `${pulse.daysElapsed}d` : '—';
  const impact = opts.impact || '';
  return `
    <div class="gov-pulse-bars" role="group" aria-label="Sprint pulse">
      <div class="gov-pulse-row">
        <span class="gov-pulse-label">${escapeHtml(COPY.valueDelivered)}</span>
        <div class="gov-pulse-track"><span class="gov-pulse-fill gov-pulse-fill--value" style="width:${Math.max(4, pct)}%"></span></div>
        <span class="gov-pulse-meta">${escapeHtml(`${done}/${committed}`)}</span>
      </div>
      <div class="gov-pulse-row">
        <span class="gov-pulse-label">${escapeHtml(COPY.timeElapsed)}</span>
        <div class="gov-pulse-track"><span class="gov-pulse-fill gov-pulse-fill--time" style="width:${Math.min(100, Math.max(8, (pulse.daysElapsed || 0) * 12))}%"></span></div>
        <span class="gov-pulse-meta">${escapeHtml(elapsed)}</span>
      </div>
      ${impact ? `<p class="gov-pulse-impact">${escapeHtml(impact)}</p>` : ''}
    </div>`;
}

export function renderVerdictZone(brief) {
  const ev = brief?.executiveView || {};
  const tier = ev.verdictTier || 'watch';
  const pulse = ev.sprintPulse || {};
  const committed = Number(pulse.committed) || Number(brief?.deliveryTruth?.committed) || 0;
  const done = Number(pulse.done) || Number(brief?.deliveryTruth?.done) || 0;
  const impact = (brief?.topRisks || []).find((r) => r.audience !== 'measurement' && r.impactLine)?.impactLine || '';

  return `
    <section class="gov-verdict-zone" data-verdict-tier="${escapeHtml(tier)}" aria-label="Delivery verdict">
      <div class="gov-verdict-zone-inner">
        <span class="gov-verdict-icon" aria-hidden="true">${tier === 'blocked' ? '!' : tier === 'onTrack' ? '✓' : '◐'}</span>
        <div class="gov-verdict-copy">
          <p class="gov-verdict-label">${escapeHtml(verdictLabel(ev))}</p>
          <p class="gov-verdict-business-line">${escapeHtml(ev.businessHeadline || brief?.leadershipNarrative?.meetingAnswer || '')}</p>
          ${ev.actionBadge ? `<p class="gov-verdict-badge">${escapeHtml(ev.actionBadge)}</p>` : ''}
        </div>
      </div>
      ${renderPulseBars({ ...pulse, done, committed }, { impact })}
    </section>`;
}

export { squadVerdictLabel };
