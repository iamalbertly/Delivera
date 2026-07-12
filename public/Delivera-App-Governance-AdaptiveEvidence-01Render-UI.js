/**
 * Adaptive evidence blocks — only verdict-changing checks.
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { renderWhatChangedTimeline } from './Delivera-App-Portfolio-WhatChanged-01Render-UI.js';

function shouldShowBlock(block = {}, priorityBrief = {}) {
  if (priorityBrief.zeroRisk) return false;
  return Boolean(block.relevant);
}

export function buildAdaptiveEvidenceBlocks(priorityBrief = {}, decision = {}, brief = {}) {
  const pb = priorityBrief || {};
  const prov = pb.baselineProvenance || {};
  const blocks = [];

  if (prov.extracted > 0 || prov.unsupported > 0) {
    blocks.push({
      id: 'promise-trace',
      title: 'Promise trace',
      summary: `${prov.extracted || 0} promised · ${prov.linked || 0} linked · ${prov.unsupported || 0} unsupported`,
      action: 'Inspect promise-to-Jira trace',
      actionId: 'inspect-evidence',
      relevant: prov.unsupported > 0 || prov.extracted > 0,
    });
  }

  const scopeRow = (pb.commitmentRows || []).find((r) => r.scopeAfterPlanning);
  if (scopeRow) {
    blocks.push({
      id: 'scope-decision',
      title: 'Scope decision',
      summary: `${scopeRow.title} moved after planning · Approval not recorded`,
      action: 'Open scope-change history',
      actionId: 'open-scope-history',
      relevant: true,
    });
  }

  const unproven = (pb.commitmentRows || []).find((r) => r.governanceState === 'done-unproven');
  if (unproven) {
    blocks.push({
      id: 'acceptance-proof',
      title: 'Acceptance proof',
      summary: `${unproven.title} · Delivery recorded as Done · Acceptance remains unproven`,
      action: 'Review missing acceptance evidence',
      actionId: 'inspect-evidence',
      relevant: true,
    });
  }

  if (pb.recoveryLine && pb.recovery?.outlook !== 'recoverable') {
    blocks.push({
      id: 'recovery-outlook',
      title: 'Recovery outlook',
      summary: pb.recoveryLine,
      action: 'Review recovery basis',
      actionId: 'review-recovery',
      relevant: pb.recovery?.outlook === 'unlikely' || pb.recovery?.outlook === 'partly',
    });
  }

  const ageing = decision.preparedActions?.nextDeadline;
  if (ageing) {
    blocks.push({
      id: 'decision-ageing',
      title: 'Decision ageing',
      summary: `Sponsor decision due ${ageing}`,
      action: 'Open decision audit trail',
      actionId: 'open-decision-audit',
      relevant: true,
    });
  }

  return blocks.filter((b) => shouldShowBlock(b, pb));
}

export function renderAdaptiveEvidenceBlocks(blocks = [], brief = {}, decision = {}) {
  const visible = blocks.filter((b) => b.relevant);
  const whatChanged = renderWhatChangedTimeline(brief, decision);
  if (!visible.length && !whatChanged) return '';

  const cards = visible.map((b) => `
    <article class="gov-evidence-block gov-evidence-block--${escapeHtml(b.id)}" data-testid="governance-evidence-block" data-block-id="${escapeHtml(b.id)}">
      <h3 class="gov-evidence-block-title">${escapeHtml(b.title)}</h3>
      <p class="gov-evidence-block-summary">${escapeHtml(b.summary)}</p>
      <button type="button" class="btn btn-link btn-compact" data-governance-action="${escapeHtml(b.actionId)}">${escapeHtml(b.action)}</button>
    </article>`).join('');

  return `
    <section class="gov-adaptive-evidence" data-testid="governance-adaptive-evidence" aria-label="Supporting evidence">
      <div class="gov-adaptive-evidence-grid">${cards}</div>
      ${whatChanged}
    </section>`;
}
