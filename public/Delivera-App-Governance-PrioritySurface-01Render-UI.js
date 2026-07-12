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

export function renderGovernancePrioritySurface(decision = {}, brief = {}) {
  const pb = decision.priorityBrief || {};
  const judgment = decision.portfolioJudgment || pb.portfolioJudgment || {};
  const writesDisabled = Boolean(pb.writesDisabled || decision._cachedView);
  const blocks = buildAdaptiveEvidenceBlocks(pb, decision, brief);

  const pbWithIntervention = {
    ...pb,
    interventionSummary: decision.interventionSummary || '',
  };

  return `
    <div class="gov-priority-surface" data-testid="governance-priority-surface" data-governance-surface="priority-brief">
      <div class="gov-priority-hero-grid">
        ${renderPriorityBriefHero(pbWithIntervention, decision)}
        ${renderAgenticPanel(pbWithIntervention, decision, { writesDisabled })}
      </div>
      ${renderExceptionRail(judgment, { selectedKey: decision.anchorProject })}
      ${renderAdaptiveEvidenceBlocks(blocks, brief, decision)}
      ${renderAlignmentSummary(judgment)}
      ${renderCommitmentDetail(pbWithIntervention)}
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
}
