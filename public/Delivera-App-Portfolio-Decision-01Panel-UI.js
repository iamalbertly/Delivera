import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

function renderDrivers(drivers = []) {
  const rows = (drivers || []).slice(0, 4);
  if (!rows.length) return '';
  return `
    <section class="portfolio-why" aria-label="Root-cause rows">
      <h2 class="portfolio-why-title">Root causes</h2>
      <dl class="portfolio-keyvalue-list">
        ${rows.map((d) => `
          <div class="portfolio-keyvalue-row" title="${escapeHtml(d.detail || '')}">
            <dt>${escapeHtml(d.title || 'Signal')}</dt>
            <dd>${escapeHtml(d.summary || '')}</dd>
          </div>`).join('')}
      </dl>
    </section>`;
}

function renderProgression(steps = []) {
  if (!steps.length) return '';
  return `
    <div class="portfolio-decision-progression" aria-label="Commitment progression">
      <p class="portfolio-progression-label">Commitment progression</p>
      <ol class="portfolio-progression-steps">
        ${steps.map((s) => `<li class="portfolio-progression-step${s.active ? ' is-active' : ''}">${escapeHtml(s.label)}</li>`).join('')}
      </ol>
    </div>`;
}

function renderPerformanceMatrix(decision = {}) {
  const metrics = decision.metrics || {};
  const monitoring = decision.monitoring || {};
  const rows = [
    ['Delivery method', metrics.delivery?.methodLabel || 'Delivery evidence'],
    ['Baseline drift', `${Number(metrics.offPlanLoad?.value) || 0}% off-plan load`],
    ['Proof posture', `${Number(metrics.proofConfidence?.value) || 0}% evidence strength`],
  ];
  return `
    <section class="portfolio-performance-matrix" aria-label="Commitment tracking and performance matrix">
      <h2>Commitment tracking</h2>
      <p class="portfolio-performance-summary">
        ${Number(monitoring.exposedCommitmentCount) || 0} exposed of ${Number(monitoring.commitmentCount) || 0} tracked commitments.
      </p>
      <div class="portfolio-performance-rows">
        ${rows.map(([label, value]) => `
          <div class="portfolio-performance-row">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(String(value))}</strong>
          </div>`).join('')}
      </div>
    </section>`;
}

function renderDecisionBasis(basis = {}) {
  if (!basis.why && !basis.nextCheckpoint && !basis.peerConclusion) return '';
  return `
    <div class="portfolio-decision-basis" data-portfolio-decision-basis>
      <h3 class="portfolio-basis-title">Operating decision</h3>
      ${basis.why ? `<p class="portfolio-basis-row"><span>Posture:</span> ${escapeHtml(basis.why)}</p>` : ''}
      ${basis.nextCheckpoint ? `<p class="portfolio-basis-row"><span>Next checkpoint:</span> ${escapeHtml(basis.nextCheckpoint)}</p>` : ''}
      ${basis.preparedNudges ? `<p class="portfolio-basis-row"><span>Prepared interventions:</span> ${Number(basis.preparedNudges)}</p>` : ''}
      ${basis.peerConclusion ? `<p class="portfolio-basis-row portfolio-basis-peer">${escapeHtml(basis.peerConclusion)}</p>` : ''}
    </div>`;
}

export function renderWhyThisMatters(drivers = []) {
  return renderDrivers(drivers);
}

export function renderPortfolioDecisionPanel(decision = {}) {
  const recommended = decision.recommendation?.id || 'track-commitments';
  return `
    <section class="portfolio-decision" aria-label="Commitment tracking matrix" id="portfolio-decision">
      ${renderPerformanceMatrix(decision)}
      ${renderProgression(decision.decisionProgression)}
      ${renderDrivers(decision.drivers)}
      ${renderDecisionBasis(decision.decisionBasis || {})}
      <button type="button" class="btn btn-primary portfolio-decision-confirm" data-portfolio-action="confirm-decision" data-decision-id="${escapeHtml(recommended)}">Confirm tracking posture</button>
      <p class="portfolio-decision-calibration-hint">Use the Calibration shield above for the room-ready defense.</p>
    </section>`;
}

export function bindPortfolioDecisionPanel(root, onConfirm) {
  if (!root) return;
  root.querySelector('[data-portfolio-action="confirm-decision"]')?.addEventListener('click', async (ev) => {
    const selected = ev.currentTarget?.getAttribute('data-decision-id') || 'track-commitments';
    if (onConfirm) await onConfirm(selected);
  });
}
