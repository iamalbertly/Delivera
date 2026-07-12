/**
 * Composes Priority Brief governance surface — hero, agentic panel, rail, below-fold.
 */
import { renderPriorityBriefHero, renderPriorityBriefSkeleton } from './Delivera-App-Governance-PriorityBrief-01Render-UI.js';
import { renderAgenticPanel } from './Delivera-App-Governance-AgenticPanel-01Render-UI.js';
import { renderExceptionRail, bindExceptionRail } from './Delivera-App-Governance-ExceptionRail-01Render-UI.js';
import {
  buildAdaptiveEvidenceBlocks,
  renderAdaptiveEvidenceBlocks,
} from './Delivera-App-Governance-AdaptiveEvidence-01Render-UI.js';
import { renderAlignmentSummary } from './Delivera-App-Governance-AlignmentSummary-01Render-UI.js';
import { renderCommitmentDetail } from './Delivera-App-Governance-CommitmentDetail-01Render-UI.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { SIMPLE_MODE_KEY } from './Delivera-Shared-Storage-Keys.js';

function readSimpleMode() {
  try { return localStorage.getItem(SIMPLE_MODE_KEY) === '1'; } catch (_) { return false; }
}

export function renderGovernancePriorityRail(decision = {}, { cases = [] } = {}) {
  const pb = decision.priorityBrief || {};
  const prepared = decision.preparedActions || {};
  const totalReady = Number(prepared.totalReady) || 0;
  const anchorKey = decision.anchorProject || '';
  const firstCase = cases[0] || prepared.items?.[0] || {};
  const caseId = firstCase.id || firstCase.caseId || '';
  const actionsHref = caseId
    ? `/actions?case=${encodeURIComponent(caseId)}`
    : `/actions${anchorKey ? `?project=${encodeURIComponent(anchorKey)}` : ''}`;
  const baselineChip = pb.baselineMissing
    ? '<span class="gov-priority-rail-chip gov-priority-rail-chip--warn" data-testid="governance-rail-baseline">Baseline needed</span>'
    : '<span class="gov-priority-rail-chip gov-priority-rail-chip--ok" data-testid="governance-rail-baseline">Baseline on file</span>';

  return `
    <div class="gov-priority-rail-stack" data-testid="governance-priority-rail">
      <section class="gov-priority-rail-card" aria-label="Prepared actions">
        <h3>Prepared actions</h3>
        <p>${totalReady ? `${totalReady} nudge${totalReady === 1 ? '' : 's'} ready` : 'No prepared nudges yet'}</p>
        <a class="btn btn-secondary btn-compact" href="${escapeHtml(actionsHref)}" data-testid="governance-rail-actions-link">Open actions →</a>
      </section>
      <section class="gov-priority-rail-card" aria-label="Baseline status">
        <h3>Baseline</h3>
        ${baselineChip}
        <p class="gov-priority-rail-muted">${escapeHtml(pb.baselineProvenance?.line || 'Upload PI slide to verify commitments')}</p>
      </section>
    </div>`;
}

export function renderGovernancePrioritySurface(decision = {}, brief = {}) {
  const pb = decision.priorityBrief || {};
  const judgment = decision.portfolioJudgment || pb.portfolioJudgment || {};
  const writesDisabled = Boolean(pb.writesDisabled || decision._cachedView);
  const blocks = buildAdaptiveEvidenceBlocks(pb, decision, brief);
  const simpleMode = readSimpleMode();

  const pbWithIntervention = {
    ...pb,
    interventionSummary: decision.interventionSummary || '',
  };

  const belowFold = `
    <details class="gov-priority-below-fold" data-testid="governance-commitment-detail-fold">
      <summary>Show commitment detail</summary>
      <div class="gov-priority-below-fold-body" data-lazy-below-fold="pending">
        ${renderAlignmentSummary(judgment)}
        ${renderCommitmentDetail(pbWithIntervention)}
      </div>
    </details>`;

  return `
    <div class="gov-priority-surface" data-testid="governance-priority-surface" data-governance-surface="priority-brief">
      <div class="gov-priority-hero-grid">
        ${renderPriorityBriefHero(pbWithIntervention, decision)}
        ${renderAgenticPanel(pbWithIntervention, decision, { writesDisabled })}
      </div>
      ${simpleMode ? '' : renderExceptionRail(judgment, { selectedKey: decision.anchorProject })}
      ${renderAdaptiveEvidenceBlocks(blocks, brief, decision)}
      ${belowFold}
      ${decision.sponsorBriefMarkdown ? `<div class="gov-sponsor-brief-preview" data-testid="governance-sponsor-brief-preview" hidden><pre>${escapeHtml(decision.sponsorBriefMarkdown)}</pre></div>` : ''}
    </div>`;
}

export function renderGovernancePrioritySkeleton() {
  return `
    <div class="gov-priority-surface gov-priority-surface--skeleton" data-testid="governance-priority-surface">
      <div class="gov-priority-hero-grid">
        ${renderPriorityBriefSkeleton()}
      </div>
    </div>`;
}

export function bindGovernancePrioritySurface(root, handlers = {}) {
  if (!root) return;
  bindExceptionRail(root, { onSelectSquad: handlers.onSelectSquad });
  root.querySelector('.gov-priority-below-fold')?.addEventListener('toggle', (ev) => {
    const details = ev.currentTarget;
    if (!details.open) return;
    details.querySelector('[data-lazy-below-fold]')?.setAttribute('data-lazy-below-fold', 'ready');
  });
}
