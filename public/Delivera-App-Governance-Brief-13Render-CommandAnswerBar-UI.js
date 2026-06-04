import { COPY, deliveryStatusLabel } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { commandAnswerSentence } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';

export function renderCommandAnswerBar(brief) {
  const sentence = commandAnswerSentence(brief);
  const n = brief?.leadershipNarrative || {};
  const ev = brief?.executiveView || {};
  const top = brief?.topRisks?.[0] || {};
  const evidenceCount = (brief?.evidencePack?.rows || []).length;
  const since = brief?.meta?.sinceLastRun?.summary || '';
  const chips = [
    `${COPY.deliveryStatus}: ${deliveryStatusLabel(n.confidence)}`,
    ev.businessHeadline ? `Cause: ${ev.businessHeadline}` : '',
    top.decisionNeededFrom ? `Owner lane: ${top.decisionNeededFrom}` : '',
    top.recommendedAction ? `Next: ${String(top.recommendedAction).slice(0, 60)}` : '',
    `Evidence: ${evidenceCount}`,
  ].filter(Boolean);

  const narratedBy = brief?.meta?.narratedBy || n.narratedBy || 'template';
  const trustBadge = narratedBy === 'advisor'
    ? '<span class="gov-narration-badge gov-narration-badge--advisor" title="Advisor narration">Advisor</span>'
    : '<span class="gov-narration-badge gov-narration-badge--template" title="Template narration">Template</span>';
  const piForum = brief?.meta?.piForumAnswer || '';

  return `
    <section class="gov-command-answer" aria-label="${escapeHtml(COPY.briefTitle)}">
      <div class="gov-command-head">${trustBadge}</div>
      <p class="gov-command-answer-text">${escapeHtml(sentence)}</p>
      ${since ? `<p class="gov-command-since">${escapeHtml(since)}</p>` : ''}
      <div class="gov-command-chips" role="group">${chips.map((c) => `<span class="gov-command-chip">${escapeHtml(c)}</span>`).join('')}</div>
      <div class="gov-command-actions">
        <button type="button" class="btn btn-primary btn-compact" id="gov-review-actions">Review actions</button>
        <button type="button" class="btn btn-secondary btn-compact" id="gov-copy-answer-inline">Copy answer</button>
        <button type="button" class="btn btn-secondary btn-compact" id="gov-copy-pi-forum" ${piForum ? '' : 'disabled'}>Copy PI forum answer</button>
        <button type="button" class="btn btn-link btn-compact" id="gov-protect-me">Protect-me wording</button>
        <button type="button" class="btn btn-link btn-compact" id="gov-fix-setup">Fix setup</button>
      </div>
      <p id="gov-protect-me-line" class="gov-protect-me-line" hidden></p>
    </section>`;
}
