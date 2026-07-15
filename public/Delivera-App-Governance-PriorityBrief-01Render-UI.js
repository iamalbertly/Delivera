/**
 * Priority Brief hero — left column of governance answer surface.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { formatDecisionDueLabel } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { resolveProjectDisplay } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';
import { attentionTone } from './Delivera-App-Portfolio-CardStatus-01Gradation-SSOT.js';
import { renderJiraWorkItemLink } from './Delivera-Shared-Jira-WorkItem-Link-01Render-UI.js';
import { resolveEffectiveSquad } from './Delivera-Governance-EffectiveSquad-01Resolve-SSOT.js';

/** Resolve a project key to its display name (e.g. SD → DMS board). */
function squadName(key) {
  if (!key) return 'This squad';
  return resolveProjectDisplay(key, { context: 'summary' }).primary || key;
}

function renderCauseItem(cause) {
  if (!cause) return '';
  if (typeof cause === 'string') return `<li>${escapeHtml(cause)}</li>`;
  const text = cause.text || `${cause.title || ''}${cause.clause || ''}`;
  if (cause.issueKey) {
    return `<li>${renderJiraWorkItemLink({
      issueKey: cause.issueKey,
      title: cause.title || text,
      issueUrl: cause.issueUrl || '',
      kind: 'epic',
      className: 'gov-priority-cause-link',
    })}<span class="gov-priority-cause-clause">${escapeHtml(cause.clause || '')}</span></li>`;
  }
  return `<li>${escapeHtml(text)}</li>`;
}

function renderEvidenceRow(row) {
  const tier = escapeHtml(row.relevanceTier || 'active-gap');
  const label = escapeHtml(row.relevanceLabel || '');
  return `
    <li class="gov-attention-evidence-row gov-attention-evidence-row--${tier}" data-relevance-tier="${tier}">
      ${renderJiraWorkItemLink({
        issueKey: row.issueKey,
        title: row.title,
        issueUrl: row.issueUrl || '',
        kind: 'epic',
        className: 'gov-priority-cause-link',
      })}
      <span class="gov-attention-evidence-meta">
        <span class="gov-relevance-chip gov-relevance-chip--${tier}">${label}</span>
        ${row.activityLabel ? `<span class="gov-attention-evidence-activity">${escapeHtml(row.activityLabel)}</span>` : ''}
      </span>
    </li>`;
}

function renderAttentionEvidence(pb = {}, decision = {}) {
  const ev = pb.attentionEvidence || {};
  if (!ev.total) return '';
  const active = (ev.active || []).map(renderEvidenceRow).join('');
  const quarantine = (ev.quarantine || []).map(renderEvidenceRow).join('');
  const squad = escapeHtml(pb.leadingSquadName || pb.evidenceFocusKey || 'leading squad');
  const copyAttr = escapeHtml(JSON.stringify({
    text: pb.evidenceCopyPack?.text || '',
    jql: pb.evidenceCopyPack?.jql || '',
  }).slice(0, 8000));
  const effectiveSquad = resolveEffectiveSquad({
    anchor: decision.anchorProject || pb.leadingSquad,
    projects: (decision.insights || []).map((i) => i.projectKey),
    brief: null,
  });
  return `
    <div class="gov-attention-evidence" data-testid="governance-attention-evidence">
      <div class="gov-attention-evidence-head">
        <strong>${ev.total} commitment${ev.total === 1 ? '' : 's'} with board-gap evidence</strong>
        <span class="gov-attention-evidence-sub">for ${squad} · selected boards</span>
        <div class="gov-attention-evidence-actions">
          <button type="button" class="btn btn-link btn-compact" data-portfolio-action="copy-evidence-pack" data-evidence-pack="${copyAttr}" data-testid="governance-copy-evidence">Copy keys + links</button>
          <button type="button" class="btn btn-link btn-compact" data-portfolio-action="nudge-plan-stories" data-squad-key="${escapeHtml(effectiveSquad || pb.leadingSquad || '')}" data-testid="governance-plan-stories-cta">Plan stories pack</button>
        </div>
      </div>
      ${active ? `<ul class="gov-attention-evidence-list gov-attention-evidence-list--active" data-testid="governance-evidence-active">${active}</ul>` : ''}
      ${quarantine ? `
        <details class="gov-attention-quarantine" data-testid="governance-evidence-quarantine">
          <summary>Verify before planning (${ev.quarantineCount} possibly stale or hygiene)</summary>
          <ul class="gov-attention-evidence-list">${quarantine}</ul>
        </details>` : ''}
    </div>`;
}

function renderConflictBanner(banner) {
  if (!banner?.text) return '';
  const sev = escapeHtml(banner.severity || 'warning');
  return `
    <p class="gov-legitimacy-banner gov-legitimacy-banner--${sev}" data-testid="governance-legitimacy-banner" role="status">
      ${escapeHtml(banner.text)}
    </p>`;
}

function renderAtRiskRows(atRiskSquads = [], anchorKey = '') {
  const rows = (atRiskSquads || []).slice(0, 5).filter((s) => String(s.projectKey || '').toUpperCase() !== '__ALL__');
  if (!rows.length) return '';
  return `
    <table class="gov-priority-at-risk-table" data-testid="governance-at-risk-table">
      <thead>
        <tr><th scope="col">Squad</th><th scope="col">State</th><th scope="col">Trust</th><th scope="col">Meaning</th></tr>
      </thead>
      <tbody>
        ${rows.map((s) => {
          const tone = attentionTone(s.attentionState);
          const isAnchor = String(s.projectKey).toUpperCase() === String(anchorKey).toUpperCase();
          const trust = s.dataTrustLabel
            ? `<span class="gov-data-trust-chip gov-data-trust-chip--${escapeHtml(s.dataTrust || 'cannot-judge')}">${escapeHtml(s.dataTrustLabel)}</span>`
            : '—';
          return `
          <tr class="gov-priority-at-risk-row gov-priority-at-risk-row--${escapeHtml(tone)}${isAnchor ? ' is-anchor' : ' is-compare'}" data-squad-key="${escapeHtml(s.projectKey)}" data-governance-action="select-squad" role="button" tabindex="0" title="Switch scope to ${escapeHtml(s.squadName || s.projectKey)}">
            <td><strong>${escapeHtml(s.squadName || s.projectKey)}</strong></td>
            <td><span class="gov-status-pill gov-status-pill--${escapeHtml(tone)}">${escapeHtml(s.attentionLabel || '')}</span></td>
            <td>${trust}</td>
            <td>${escapeHtml(s.meaning || '')}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function renderBaselineProvenance(provenance = {}, { uploadBaseline = false, exposureLine = '' } = {}) {
  if (!provenance.available) {
    return `
      <p class="gov-baseline-provenance gov-baseline-provenance--missing" data-testid="governance-baseline-provenance">
        <strong>${escapeHtml(provenance.line || 'Alignment cannot be verified')}</strong>
        ${uploadBaseline ? '' : ' <button type="button" class="btn btn-link btn-compact" data-portfolio-action="open-alignment-studio" data-testid="governance-baseline-upload-link">Upload PI baseline slide</button>'}
      </p>`;
  }
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
  const effectiveSquad = resolveEffectiveSquad({
    anchor: decision.anchorProject || pb.leadingSquad,
    projects: (decision.insights || []).map((i) => i.projectKey).filter(Boolean),
  });
  const uploadBaseline = pb.primaryActionTarget === 'alignment-studio-slide';
  const boardAlign = pb.primaryActionTarget === 'alignment-studio-board';
  const headlineCta = uploadBaseline
    ? `<button type="button" class="btn btn-primary btn-compact gov-priority-headline-cta" data-testid="governance-headline-upload-cta" data-portfolio-action="open-alignment-studio" data-governance-action="upload-baseline-slide" data-squad-key="${escapeHtml(effectiveSquad)}" data-wizard-mode="slide">${escapeHtml(pb.primaryAction || 'Upload PI baseline slide')}</button>`
    : boardAlign
      ? `<button type="button" class="btn btn-primary btn-compact gov-priority-headline-cta" data-testid="governance-headline-board-cta" data-portfolio-action="open-alignment-studio" data-governance-action="align-board" data-squad-key="${escapeHtml(effectiveSquad)}" data-wizard-mode="board">${escapeHtml(pb.primaryAction || 'Align board in Alignment Studio')}</button>`
      : '';
  const exposure = pb.exposureLine
    ? `<p class="gov-priority-exposure" data-testid="governance-priority-exposure"><span class="gov-status-rail gov-status-rail--critical" aria-hidden="true"></span>${escapeHtml(pb.exposureLine)}</p>`
    : '';
  const causes = (pb.causeLines || []).slice(0, 4).map(renderCauseItem).join('');
  const reviewDue = !pb.humanDecision?.text && pb.humanDecision?.dueAt
    ? `<p class="gov-priority-review-due">Next review: <strong>${escapeHtml(formatDecisionDueLabel(pb.humanDecision.dueAt) || pb.humanDecision.dueAt)}</strong></p>`
    : '';
  const freshness = pb.stale
    ? '<p class="gov-priority-freshness gov-priority-freshness--stale" data-testid="governance-freshness-pill">Cached view · <button type="button" class="btn btn-link btn-compact" data-portfolio-action="refresh-brief">Refresh</button></p>'
    : '';

  const deliveryHeadline = buildDeliveryHeadline(pb, decision);

  return `
    <section class="gov-priority-brief-hero" data-testid="governance-priority-brief" aria-label="Priority governance brief">
      <div class="gov-priority-brief-left">
        ${renderConflictBanner(pb.conflictBanner)}
        <div class="gov-priority-headline-row">
          <h1 class="gov-priority-headline" data-testid="governance-priority-headline">${escapeHtml(deliveryHeadline)}</h1>
          ${headlineCta}
        </div>
        ${freshness}
        <p class="gov-priority-legend" data-testid="governance-plan-legend">Plan-backed = this squad’s PI slide is on file. Board-gap = PI epic in Jira with zero stories on selected boards.</p>
        ${exposure}
        ${renderAttentionEvidence(pb, decision)}
        ${!pb.attentionEvidence?.total && causes ? `<ul class="gov-priority-cause-list" data-testid="governance-priority-cause">${causes}</ul>` : ''}
        ${reviewDue}
        ${renderBaselineProvenance(pb.baselineProvenance, { uploadBaseline, exposureLine: pb.exposureLine })}
      </div>
    </section>`;
}

/** Prefer PriorityBrief SSOT headline whenever present. */
function buildDeliveryHeadline(pb = {}, decision = {}) {
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
