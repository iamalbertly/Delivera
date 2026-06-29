import { COPY, businessTitleFromSummary } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { GOV_TOOLTIPS } from './Delivera-App-Governance-Brief-Tooltip-01SSOT.js';
import { renderAdHocChip, renderEpicHygieneInlineRow } from './Delivera-App-Governance-Brief-20Render-EpicHygienePanel-UI.js';

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
      <p class="gov-pi-chip-title">${escapeHtml(businessTitleFromSummary(chip.title || '', 72))}</p>
      <div class="gov-pi-chip-bars">
        <span class="gov-pi-bar-label">Time</span>
        <div class="gov-pi-bar"><span style="width:${chip.elapsedPct || 0}%"></span></div>
        <span class="gov-pi-bar-label">Delivery</span>
        <div class="gov-pi-bar gov-pi-bar--delivery"><span style="width:${chip.deliveryPct || 0}%"></span></div>
      </div>
      <p class="gov-pi-chip-meta">${escapeHtml(elapsed)} · ${escapeHtml(delivery)}</p>
    </article>`;
}

export function renderPICompactBadge(brief) {
  const strip = brief?.meta?.piConfidence;
  if (!strip) return '';
  const c = strip.counts || {};
  const pct = strip.confidencePct;
  const noData = pct == null && !strip.trusted;
  const trustLabel = noData ? 'Not set' : strip.trusted ? 'Trusted' : 'Limited';
  const committed = c.committed ?? 0;
  const tierCls = strip.trusted ? 'is-trusted' : noData ? 'is-nodata' : 'is-limited';
  return `<span class="gov-pi-compact-badge ${tierCls}" data-pi-compact-badge="1" title="${escapeHtml(GOV_TOOLTIPS.piConfidence)}">PI: ${escapeHtml(trustLabel)} · ${committed} committed</span>`;
}

export function renderPIConfidenceStrip(brief, opts = {}) {
  const hideBaselineCta = Boolean(opts.hideBaselineCta);
  const strip = brief?.meta?.piConfidence;
  if (!strip) return '';
  const c = strip.counts || {};
  const pct = strip.confidencePct;
  const noData = pct == null && !strip.trusted;
  const gaugePct = pct != null ? Math.min(100, Math.max(0, pct)) : (strip.trusted ? 70 : 0);
  const trustLabel = noData ? '' : strip.trusted ? 'High' : 'Low';
  const trustedCls = strip.trusted ? 'is-trusted' : noData ? 'is-nodata' : 'is-limited';
  const chips = (strip.timelineChips || []).map(chipHtml).join('');
  const chipsBlock = chips
    ? `<div class="gov-pi-chip-row" role="list">${chips}</div>`
    : `<p class="gov-pi-empty">${escapeHtml(COPY.piBaselineTimelineLocked)}</p>`;
  const adHocChip = renderAdHocChip(brief);
  const hygiene = brief?.meta?.epicHygiene;
  const hygieneRow = noData
    ? (hygiene?.epicCount
      ? `<p class="gov-pi-hygiene-compact" data-hover-proof="epic-hygiene">Epic naming <strong>${hygiene.score != null ? `${hygiene.score}%` : '—'}</strong> · weak ${(hygiene.weak || []).length}</p>`
      : '')
    : strip.trusted
      ? (hygiene?.epicCount
        ? `<p class="gov-pi-hygiene-compact" data-hover-proof="epic-hygiene">Epic naming <strong>${hygiene.score != null ? `${hygiene.score}%` : '—'}</strong> · weak ${(hygiene.weak || []).length}</p>`
        : '')
      : renderEpicHygieneInlineRow(brief);
  const chipCount = (strip.timelineChips || []).length;
  const timelineDetails = !noData && chipCount > 0
    ? `<details class="gov-pi-strip-details">
        <summary>Timeline (${chipCount})</summary>
        ${chipsBlock}
      </details>`
    : '';

  const baselineCta = hideBaselineCta
    ? ''
    : `<button type="button" class="btn btn-primary btn-compact" id="gov-pi-fix-baseline">${escapeHtml(COPY.fixPiBaseline)}</button>`;
  const gaugeBlock = noData
    ? `<div class="gov-pi-nodata" data-hover-proof="pi-gauge">
        <span class="gov-pi-nodata-icon" aria-hidden="true">○</span>
        <p class="gov-pi-nodata-label">${escapeHtml(COPY.baselinePiNotSet)}</p>
        ${baselineCta}
      </div>`
    : `<div class="gov-pi-gauge-wrap">
        <span class="gov-pi-gauge-label">PI Trust</span>
        <div class="gov-pi-gauge-track" role="meter" aria-valuenow="${gaugePct}" aria-valuemin="0" aria-valuemax="100" data-hover-proof="pi-gauge">
          <span class="gov-pi-gauge-fill" style="width:${gaugePct}%"></span>
        </div>
        <strong class="gov-pi-gauge-tier">${escapeHtml(trustLabel)}</strong>
      </div>`;

  return `
    <section class="gov-pi-strip ${trustedCls}" aria-label="PI confidence" title="${escapeHtml(GOV_TOOLTIPS.piConfidence)}">
      <div class="gov-pi-strip-head gov-pi-gauge-row">
        ${gaugeBlock}
        ${adHocChip}
        ${noData || hideBaselineCta ? '' : `<button type="button" class="btn btn-secondary btn-compact" id="gov-pi-fix-baseline">${escapeHtml(COPY.fixPiBaseline)}</button>`}
      </div>
      ${strip.trusted ? '' : `<dl class="gov-pi-counter-row">
        <div><dt>${escapeHtml(COPY.piBaselinePromised)}</dt><dd>${c.committed ?? 0}</dd></div>
        <div data-hover-proof="pi-candidates"><dt>${escapeHtml(COPY.piBaselineNotSaved)}</dt><dd>${(c.offPlan || 0) + (c.onTrack || 0)}</dd></div>
        <div><dt>Missing dates</dt><dd>${c.missingDates ?? 0}</dd></div>
        <div><dt>At risk</dt><dd>${c.atRisk ?? 0}</dd></div>
      </dl>`}
      ${hygieneRow}
      ${timelineDetails}
    </section>`;
}
