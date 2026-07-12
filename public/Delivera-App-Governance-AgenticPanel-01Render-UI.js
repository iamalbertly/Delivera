/**
 * Agentic panel — completed / prepared / human decision bands (wireframe right column).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

const COMPLETED_CHECKS = [
  'Pulled Jira proof for selected squads',
  'Matched board work to PI baseline',
  'Drafted owner evidence requests where needed',
];

export function renderAgenticPanel(priorityBrief = {}, decision = {}, { writesDisabled = false } = {}) {
  const pb = priorityBrief || {};
  const prepared = decision.preparedActions || {};
  const preparedCount = Number(prepared.totalReady) || 0;
  const zeroRisk = Boolean(pb.zeroRisk);

  const completedItems = COMPLETED_CHECKS.map((label) =>
    `<li class="gov-agentic-completed-item"><span aria-hidden="true">✓</span> ${escapeHtml(label)}</li>`,
  ).join('');

  const completedBand = `
    <div class="gov-agentic-band gov-agentic-band--completed" data-testid="governance-delivera-completed">
      <h2 class="gov-agentic-band-title">What the system already did</h2>
      <ul class="gov-agentic-completed-list">${completedItems}</ul>
      <p class="gov-agentic-completed-summary">${escapeHtml(pb.deliveraCompleted || '')}</p>
    </div>`;

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
      ${pb.humanDecision.dueAt ? `<p class="gov-human-decision-due">Due: <strong>${escapeHtml(pb.humanDecision.dueAt)}</strong></p>` : ''}
    </div>` : '';

  const primaryLabel = pb.primaryAction || 'Review and record governance decision';
  const evidenceLabel = pb.evidenceAction || 'Inspect promise-to-Jira trace';

  const ctas = `
    <div class="gov-agentic-ctas" data-testid="governance-agentic-ctas">
      <button type="button" class="btn btn-primary gov-primary-cta" data-testid="governance-primary-action" data-governance-action="record-decision"${writesDisabled ? ' disabled' : ''}>${escapeHtml(primaryLabel)}</button>
      <button type="button" class="btn btn-link btn-compact" data-testid="governance-evidence-action" data-governance-action="inspect-evidence">${escapeHtml(evidenceLabel)}</button>
      <button type="button" class="btn btn-link btn-compact" data-governance-action="share-sponsor-brief">Share sponsor brief</button>
    </div>`;

  const growth = (pb.growthSignals || []).length ? `
    <p class="gov-growth-signals" data-testid="governance-growth-signals">${pb.growthSignals.map((s) => escapeHtml(s)).join(' · ')}</p>` : '';

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
      ${growth}
      ${pb.interventionSummary ? `<p class="gov-intervention-summary">${escapeHtml(pb.interventionSummary)}</p>` : ''}
    </aside>`;
}
