/**
 * Priority Brief hero — left column of governance answer surface.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { formatDecisionDueLabel } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { resolveProjectDisplay } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';
import { attentionTone } from './Delivera-App-Portfolio-CardStatus-01Gradation-SSOT.js';

/** Resolve a project key to its display name (e.g. SD → DMS board). */
function squadName(key) {
  if (!key) return 'This squad';
  return resolveProjectDisplay(key, { context: 'summary' }).primary || key;
}

function renderAtRiskRows(atRiskSquads = [], anchorKey = '') {
  const rows = (atRiskSquads || []).slice(0, 3);
  if (!rows.length) return '';
  return `
    <table class="gov-priority-at-risk-table" data-testid="governance-at-risk-table">
      <thead>
        <tr><th scope="col">Squad</th><th scope="col">State</th><th scope="col">Meaning</th></tr>
      </thead>
      <tbody>
        ${rows.map((s) => {
          const tone = attentionTone(s.attentionState);
          const isAnchor = String(s.projectKey).toUpperCase() === String(anchorKey).toUpperCase();
          return `
          <tr class="gov-priority-at-risk-row gov-priority-at-risk-row--${escapeHtml(tone)}${isAnchor ? ' is-anchor' : ' is-compare'}" data-squad-key="${escapeHtml(s.projectKey)}" data-governance-action="scroll-commitments" role="button" tabindex="0" title="Scroll to PI commitments">
            <td><strong>${escapeHtml(s.squadName || s.projectKey)}</strong></td>
            <td><span class="gov-status-pill gov-status-pill--${escapeHtml(tone)}">${escapeHtml(s.attentionLabel || '')}</span></td>
            <td>${escapeHtml(s.meaning || '')}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function renderBaselineProvenance(provenance = {}, { uploadBaseline = false, exposureLine = '', needAttentionCount = 0 } = {}) {
  if (!provenance.available) {
    return `
      <p class="gov-baseline-provenance gov-baseline-provenance--missing" data-testid="governance-baseline-provenance">
        <strong>${escapeHtml(provenance.line || 'Alignment cannot be verified')}</strong>
        ${uploadBaseline ? '' : ' <button type="button" class="btn btn-link btn-compact" data-portfolio-action="open-alignment-studio" data-testid="governance-baseline-upload-link">Upload PI baseline slide</button>'}
      </p>`;
  }
  // P1 FIX: Simplified — show relative baseline age, remove the redundant
  // "Review N need attention" button (the Need Action CTA already covers this).
  const actions = [];
  if (provenance.sourceType === 'slide' || provenance.sourceImagePath) {
    actions.push('<button type="button" class="btn btn-link btn-compact" data-governance-action="open-baseline-image">Open original</button>');
  }
  const showCounts = provenance.countsLine && provenance.countsLine !== exposureLine;
  return `
    <div class="gov-baseline-provenance" data-testid="governance-baseline-provenance">
      <p><strong>${escapeHtml(provenance.line || '')}</strong></p>
      ${showCounts ? `<p class="gov-baseline-provenance-metrics">${escapeHtml(provenance.countsLine || '')}</p>` : ''}
      ${actions.length ? `<div class="gov-baseline-provenance-actions">${actions.join('')}</div>` : ''}
    </div>`;
}

export function renderPriorityBriefHero(priorityBrief = {}, decision = {}) {
  const pb = priorityBrief || {};
  const uploadBaseline = pb.primaryActionTarget === 'alignment-studio-slide';
  const boardAlign = pb.primaryActionTarget === 'alignment-studio-board';
  const headlineCta = uploadBaseline
    ? `<button type="button" class="btn btn-primary btn-compact gov-priority-headline-cta" data-testid="governance-headline-upload-cta" data-portfolio-action="open-alignment-studio" data-governance-action="upload-baseline-slide">${escapeHtml(pb.primaryAction || 'Upload PI baseline slide')}</button>`
    : boardAlign
      ? `<button type="button" class="btn btn-primary btn-compact gov-priority-headline-cta" data-testid="governance-headline-board-cta" data-portfolio-action="open-alignment-studio" data-governance-action="align-board">${escapeHtml(pb.primaryAction || 'Align board in Alignment Studio')}</button>`
      : '';
  const exposure = pb.exposureLine
    ? `<p class="gov-priority-exposure" data-testid="governance-priority-exposure"><span class="gov-status-rail gov-status-rail--critical" aria-hidden="true"></span>${escapeHtml(pb.exposureLine)}</p>`
    : '';
  const causes = (pb.causeLines || []).map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  const reviewDue = !pb.humanDecision?.text && pb.humanDecision?.dueAt
    ? `<p class="gov-priority-review-due"><span aria-hidden="true">📅</span> Next review: <strong>${escapeHtml(formatDecisionDueLabel(pb.humanDecision.dueAt) || pb.humanDecision.dueAt)}</strong></p>`
    : '';
  const freshness = pb.stale
    ? '<p class="gov-priority-freshness gov-priority-freshness--stale" data-testid="governance-freshness-pill">Cached view · <button type="button" class="btn btn-link btn-compact" data-portfolio-action="refresh-brief">Refresh</button></p>'
    : '';

  // P1 FIX: Rewrite headline to delivery reality — not process-jargon.
  // Users said "what the fuck is that decision" when seeing "needs one
  // decision". They want to know: are they working on what they committed
  // to? Is anything delivered? What's blocked?
  const deliveryHeadline = buildDeliveryHeadline(pb, decision);

  return `
    <section class="gov-priority-brief-hero" data-testid="governance-priority-brief" aria-label="Priority governance brief">
      <div class="gov-priority-brief-left">
        <div class="gov-priority-headline-row">
          <h1 class="gov-priority-headline" data-testid="governance-priority-headline">${escapeHtml(deliveryHeadline)}</h1>
          ${headlineCta}
        </div>
        ${freshness}
        ${exposure}
        ${causes ? `<ul class="gov-priority-cause-list" data-testid="governance-priority-cause">${causes}</ul>` : ''}
        ${reviewDue}
        ${renderBaselineProvenance(pb.baselineProvenance, { uploadBaseline, exposureLine: pb.exposureLine, needAttentionCount: pb.needAttentionCount })}
        ${renderAtRiskRows(pb.atRiskSquads || decision.portfolioJudgment?.atRisk || [], decision.anchorProject || pb.leadingSquad || '')}
      </div>
    </section>`;
}

/**
 * P1 FIX: Build a delivery-reality headline — not process-jargon.
 * Answers the user's #1 question: "are they working on what they committed to?"
 * Three facts: delivered%, unlinked commitments, sprint time remaining.
 */
function buildDeliveryHeadline(pb = {}, decision = {}) {
  // Prefer PriorityBrief SSOT headline whenever present (judgment language).
  if (pb.headline) return pb.headline;
  if (pb.baselineMissing || pb.primaryActionTarget === 'alignment-studio-slide') {
    return `${decision.periodKey || pb.periodKey || 'This quarter'}: Upload PI baseline to score commitments`;
  }

  const anchor = decision.anchorProject || pb.leadingSquad || 'This squad';
  const metrics = decision.metrics || {};
  const delivered = Number(metrics.delivery?.value) || 0;
  const detailRows = pb.detailRows || [];
  const totalCommitments = detailRows.length;
  const unlinkedCount = detailRows.filter((r) => !r.issueKey || r.reality === 'Unlinked').length;
  const timebox = decision.timebox || pb.timebox || {};
  const daysRemaining = Number(timebox.remainingDays) || 0;
  const monitoring = decision.monitoring || {};
  const squadCount = Number(monitoring.squadCount) || 0;
  const isMultiSquad = squadCount > 1 && totalCommitments === 0;

  if (isMultiSquad) {
    const cards = decision.comparison?.cards || [];
    const zeroCount = cards.filter((c) => (Number(c.metrics?.delivered) || 0) === 0).length;
    if (zeroCount >= 2) {
      return `${zeroCount} of ${cards.length} squads at 0% delivered — possible shared blocker`;
    }
    return `${cards.length || squadCount} squads: ${delivered}% average delivery, ${unlinkedCount} unlinked commitments`;
  }

  const parts = [];
  parts.push(`${squadName(anchor)}: ${delivered}% delivered`);
  if (unlinkedCount > 0 && totalCommitments > 0) {
    parts.push(`${unlinkedCount} of ${totalCommitments} commitments have no Jira evidence`);
  }
  if (daysRemaining > 0 && delivered < 50) {
    parts.push(`${daysRemaining}d left in sprint`);
  } else if (daysRemaining <= 0 && delivered < 100) {
    parts.push('sprint ended');
  }
  return parts.join(' · ');
}

export function renderPriorityBriefSkeleton() {
  return `
    <section class="gov-priority-brief-hero gov-priority-brief-hero--skeleton" data-testid="governance-priority-brief" aria-busy="true">
      <div class="gov-skeleton-headline" aria-hidden="true"></div>
      <div class="gov-skeleton-metrics" aria-hidden="true"></div>
      <div class="gov-skeleton-rows" aria-hidden="true">
        <div class="gov-skeleton-row"></div>
        <div class="gov-skeleton-row"></div>
        <div class="gov-skeleton-row gov-skeleton-row--short"></div>
      </div>
      <p class="gov-skeleton-label sr-only">Loading governance brief</p>
    </section>`;
}

