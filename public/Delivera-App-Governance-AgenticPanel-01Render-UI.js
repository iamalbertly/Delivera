/**
 * Agentic panel — completed / prepared / human decision bands (wireframe right column).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { formatDecisionDueLabel } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

export function renderAgenticPanel(priorityBrief = {}, decision = {}, { writesDisabled = false, cases = [] } = {}) {
  const pb = priorityBrief || {};
  const prepared = decision.preparedActions || {};
  const preparedCount = Number(prepared.totalReady) || 0;
  const zeroRisk = Boolean(pb.zeroRisk);
  const baselineMissing = Boolean(pb.baselineMissing || pb.primaryActionTarget === 'alignment-studio-slide');
  const uploadBaseline = pb.primaryActionTarget === 'alignment-studio-slide';
  const boardAlign = pb.primaryActionTarget === 'alignment-studio-board';
  const baselineReady = Boolean(pb.baselineProvenance?.available);

  const completedChecks = baselineMissing
    ? [
      'Ready to read your PI plan slide from PowerPoint',
      'Will match slide promises to Jira board work',
      'Unlocks quarter commitment verification',
    ]
    : [
      'Pulled Jira proof for selected squads',
      'Matched board work to PI baseline',
      'Drafted owner evidence requests where needed',
    ];

  const completedItems = completedChecks.map((label) =>
    `<li class="gov-agentic-completed-item"><span aria-hidden="true">${baselineMissing ? '→' : '✓'}</span> ${escapeHtml(label)}</li>`,
  ).join('');

  const completedTitle = baselineMissing ? 'What happens when you upload' : 'What the system already did';

  const completedBand = baselineMissing ? `
    <details class="gov-agentic-band gov-agentic-band--completed gov-agentic-band--baseline-setup" data-testid="governance-delivera-completed">
      <summary class="gov-agentic-band-title">${escapeHtml(completedTitle)}</summary>
      <ul class="gov-agentic-completed-list">${completedItems}</ul>
    </details>` : `
    <details class="gov-agentic-band gov-agentic-band--completed gov-agentic-band--compact" data-testid="governance-delivera-completed">
      <summary class="gov-agentic-band-title">System activity</summary>
      <ul class="gov-agentic-completed-list">${completedItems}</ul>
      ${pb.deliveraCompleted ? `<p class="gov-agentic-completed-summary">${escapeHtml(pb.deliveraCompleted)}</p>` : ''}
    </details>`;

  const preparedBand = preparedCount > 0 ? `
    <div class="gov-agentic-band gov-agentic-band--prepared" data-testid="governance-delivera-prepared">
      <h2 class="gov-agentic-band-title">Prepared by Delivera</h2>
      <p>${escapeHtml(pb.deliveraPrepared || `${preparedCount} evidence request${preparedCount === 1 ? '' : 's'} ready for review`)}</p>
      <button type="button" class="btn btn-secondary btn-compact" data-governance-action="review-prepared"${writesDisabled ? ' disabled title="Sending paused while evidence is stale"' : ''}>Review and send ${preparedCount} evidence request${preparedCount === 1 ? '' : 's'}</button>
    </div>` : '';

  const humanBand = !zeroRisk && pb.humanDecision?.text ? `
    <div class="gov-agentic-band gov-agentic-band--decision" data-testid="governance-human-decision">
      <h2 class="gov-agentic-band-title">Next human decision</h2>
      <p class="gov-human-decision-text">${escapeHtml(pb.humanDecision.text)}</p>
      ${pb.humanDecision.owner ? `<p class="gov-human-decision-owner">Owner: <strong>${escapeHtml(pb.humanDecision.owner)}</strong></p>` : ''}
      ${pb.humanDecision.dueAt ? `<p class="gov-human-decision-due">Due: <strong>${escapeHtml(formatDecisionDueLabel(pb.humanDecision.dueAt) || pb.humanDecision.dueAt)}</strong></p>` : ''}
    </div>` : '';

  const primaryLabel = pb.primaryAction || 'Review and record governance decision';
  const evidenceLabel = pb.evidenceAction || 'Inspect promise-to-Jira trace';

  const detailCount = (pb.detailRows || []).filter((r) => r.governanceState !== 'linked').length;
  // Missing-baseline recovery is already the hero's primary action. Repeating
  // it in the rail creates two visually competing controls for one outcome.
  const ctas = uploadBaseline ? '' : `
    <div class="gov-agentic-ctas" data-testid="governance-agentic-ctas">
      <button type="button" class="btn btn-primary gov-primary-cta" data-testid="governance-primary-action" data-governance-action="${boardAlign ? 'align-board' : 'record-decision'}"${boardAlign ? ' data-portfolio-action="open-alignment-studio"' : ''}${writesDisabled && !boardAlign ? ' disabled' : ''}>${escapeHtml(primaryLabel)}</button>
      ${detailCount > 0 ? `<button type="button" class="btn btn-secondary btn-compact" data-testid="governance-evidence-action" data-governance-action="inspect-evidence">${escapeHtml(evidenceLabel)}</button>` : ''}
      ${baselineReady && detailCount > 0 ? '<button type="button" class="btn btn-secondary btn-compact" data-governance-action="share-sponsor-brief">Share sponsor brief</button>' : ''}
    </div>`;

  const growth = (pb.growthSignals || []).length ? `
    <p class="gov-growth-signals" data-testid="governance-growth-signals">${pb.growthSignals.map((s) => escapeHtml(s)).join(' · ')}</p>` : '';

  const anchorKey = decision.anchorProject || '';
  const firstCase = cases[0] || prepared.items?.[0] || {};
  const caseId = firstCase.id || firstCase.caseId || '';
  const actionsHref = caseId
    ? `/actions?case=${encodeURIComponent(caseId)}`
    : `/actions${anchorKey ? `?project=${encodeURIComponent(anchorKey)}` : ''}`;
  const actionsLink = `<a class="btn btn-link btn-compact gov-priority-actions-link" href="${escapeHtml(actionsHref)}" data-testid="governance-rail-actions-link">Open actions →</a>`;

  const calm = zeroRisk ? `
    <div class="gov-agentic-band gov-agentic-band--calm" data-testid="governance-zero-risk">
      <p>${escapeHtml(pb.headline || 'No governance decision required.')}</p>
    </div>` : '';

  return `
    <aside class="gov-agentic-panel" data-testid="governance-agentic-panel" aria-label="Delivera actions and decisions">
      ${calm || completedBand}
      ${preparedBand}
      ${humanBand}
      ${ctas}
      ${actionsLink}
      ${growth}
      ${pb.interventionSummary ? `<p class="gov-intervention-summary">${escapeHtml(pb.interventionSummary)}</p>` : ''}
    </aside>`;
}
