import { COPY, businessTitleFromSummary } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { GOV_TOOLTIPS } from './Delivera-App-Governance-Brief-Tooltip-01SSOT.js';
import { renderAdHocChip, renderEpicHygieneInlineRow } from './Delivera-App-Governance-Brief-20Render-EpicHygienePanel-UI.js';
import { renderIssueIdentityHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function formatChipDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return String(value).slice(0, 12);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function chipHtml(chip) {
  const missing = Boolean(chip.missingDates) || !chip.plannedEndDate;
  const hasChildren = Number(chip.childTotal) > 0 || (chip.childHint && !/no child/i.test(String(chip.childHint)));
  const range = [formatChipDate(chip.plannedStartDate), formatChipDate(chip.plannedEndDate)].filter(Boolean).join(' → ');
  const dateLine = missing
    ? (hasChildren && chip.childHint ? `No Jira target · ${chip.childHint}` : 'No forecast · missing end date')
    : (chip.elapsedPct != null ? `${chip.elapsedPct}% elapsed` : 'on timeline');
  const delivery = chip.deliveryPct != null
    ? `${chip.deliveryPct}% delivered${hasChildren && chip.childHint ? ` · ${chip.childHint}` : ''}`
    : (chip.childHint || 'delivery pending');
  const conf = chip.confidenceLabel || (missing ? (hasChildren ? 'Children only' : 'No forecast') : 'Medium');
  const pulse = chip.worstSlip ? ' is-pulse-slip' : '';
  const displayTitle = businessTitleFromSummary(chip.title || '', 72);
  const identityHtml = renderIssueIdentityHtml(chip.issueKey || '', { title: displayTitle });
  return `
    <article class="gov-pi-chip${pulse}" data-issue-key="${escapeHtml(chip.issueKey || '')}" data-epic-rail-chip="1"${missing ? ' data-missing-dates="true"' : ''}${hasChildren ? ' data-has-children="true"' : ''}>
      <header class="gov-pi-chip-head">
        <span class="gov-pi-chip-identity">${identityHtml}</span>
        <span class="gov-pi-chip-conf gov-pi-conf--${escapeHtml(String(conf).toLowerCase().replace(/\s+/g, '-'))}">${escapeHtml(conf)}</span>
      </header>
      <div class="gov-pi-chip-bars">
        <span class="gov-pi-bar-label">Time</span>
        <div class="gov-pi-bar"><span style="width:${missing ? 0 : (chip.elapsedPct || 0)}%"></span></div>
        <span class="gov-pi-bar-label">Delivery</span>
        <div class="gov-pi-bar gov-pi-bar--delivery"><span style="width:${chip.deliveryPct || 0}%"></span></div>
      </div>
      <p class="gov-pi-chip-meta" data-epic-chip-meta="1">${escapeHtml(range ? `${range} · ${dateLine}` : dateLine)} · ${escapeHtml(delivery)}</p>
    </article>`;
}

/** Zero-click epic commitment rail for Active Loop hero (SSOT chips; suppress page PI strip when used). */
export function renderEpicCommitmentRailHtml(chips = [], { emptyCopy = 'Epic dates appear when PI baseline chips or linked promises are available.' } = {}) {
  const list = Array.isArray(chips) ? chips : [];
  if (!list.length) {
    return `<aside class="gov-epic-commitment-rail" data-epic-commitment-rail="1" data-epic-rail-empty="true" aria-label="PI epic commitments">
      <span class="gov-loop-kicker">PI epic commitments</span>
      <p class="gov-calm-note">${escapeHtml(emptyCopy)}</p>
    </aside>`;
  }
  const ranked = [...list].map((chip, index) => {
    const slip = Number(chip.elapsedPct) || 0;
    const delivery = Number(chip.deliveryPct);
    const score = chip.missingDates ? 200 + index : (Number.isFinite(delivery) ? slip - delivery : slip);
    return { ...chip, _slipScore: score };
  }).sort((a, b) => b._slipScore - a._slipScore);
  if (ranked[0]) ranked[0] = { ...ranked[0], worstSlip: true };
  return `<aside class="gov-epic-commitment-rail" data-epic-commitment-rail="1" aria-label="PI epic commitments">
    <span class="gov-loop-kicker">PI epic commitments</span>
    <div class="gov-pi-chip-row gov-epic-rail-chips" role="list">${ranked.map(chipHtml).join('')}</div>
  </aside>`;
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
  // Active Loop hero owns epic chips — do not render a second PI strip on the happy path.
  if (opts.suppressForActiveLoop
    || (typeof document !== 'undefined' && document.body?.classList?.contains('governance-active-loop-ready'))) {
    return '';
  }
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
