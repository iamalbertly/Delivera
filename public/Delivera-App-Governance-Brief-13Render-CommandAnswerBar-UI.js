import {
  COPY,
  deliveryStatusLabel,
  firstNameFromDisplay,
  freshnessShortLabel,
  isSimpleMode,
  simpleStatusLabel,
  verdictTierFromBrief,
} from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { commandAnswerSentence, sendReadinessBadge } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';

function trustTierLabel(brief) {
  if (brief?.freshness?.confidenceLimit === 'stale') return 'Low';
  if (brief?.meta?.safeToSend === true) return 'High';
  if (brief?.meta?.safeToSend === false) return 'Low';
  return 'Medium';
}

export function renderCommandAnswerBar(brief, surfaces = null, opts = {}) {
  const hasOwnerClusters = Boolean(opts.hasOwnerClusters);
  const sentence = commandAnswerSentence(brief);
  const n = brief?.leadershipNarrative || {};
  const ev = brief?.executiveView || {};
  const top = surfaces?.drawerIssues?.[0] || brief?.topRisks?.[0] || {};
  const tier = verdictTierFromBrief(brief);
  const statusLabel = isSimpleMode()
    ? simpleStatusLabel(tier, true)
    : (ev.verdictLine?.split('.')[0] || deliveryStatusLabel(n.confidence));
  const ownerName = firstNameFromDisplay(top.assigneeName || top.decisionNeededFrom) || COPY.unassigned;
  const itemCount = surfaces?.drawerIssues?.length || 0;
  const squad = top.squad
    || (Array.isArray(brief?.projects) && brief.projects.length === 1 ? brief.projects[0] : '')
    || '';
  const doFirst = surfaces?.doNowActions?.[0];
  const doFirstLabel = doFirst?.actionPlain?.slice(0, 56) || top.recommendedAction?.slice(0, 56) || COPY.reviewActions;
  const doFirstUrl = doFirst?.issueUrl || top.issueUrl || '';
  const showDoFirstStrip = tier === 'blocked' || doFirst?.escalation === 'act-today' || doFirst?.escalation === 'escalate';
  const evidenceCount = (brief?.evidencePack?.rows || []).length;
  const piForum = brief?.meta?.piForumAnswer || '';
  const readiness = sendReadinessBadge(brief);
  const fresh = freshnessShortLabel(brief?.freshness || {});

  const doFirstCta = hasOwnerClusters
    ? ''
    : (doFirstUrl
      ? `<a class="btn btn-primary btn-compact" href="${escapeHtml(doFirstUrl)}" target="_blank" rel="noopener">Open →</a>`
      : '');
  const doFirstStrip = showDoFirstStrip && !hasOwnerClusters
    ? `<div class="gov-do-first-strip" data-hover-proof="owner-lane">
        <span class="gov-do-first-prefix">${escapeHtml(COPY.doFirst)}:</span>
        <strong class="gov-do-first-action">${escapeHtml(doFirstLabel)}</strong>
        ${doFirstCta}
      </div>`
    : '';
  const showActionBlock = !showDoFirstStrip;

  const narratedBy = brief?.meta?.narratedBy || n.narratedBy || 'template';
  const statusHead = String(statusLabel || '').toUpperCase();
  const detailLine = sentence && statusHead && String(sentence).toUpperCase().startsWith(statusHead)
    ? ''
    : sentence;
  const trustBadge = narratedBy === 'advisor'
    ? '<span class="gov-narration-badge gov-narration-badge--advisor" title="Advisor narration">Advisor</span>'
    : '<span class="gov-narration-badge gov-narration-badge--template" title="Template narration">Template</span>';

  const showReviewActions = !hasOwnerClusters && !showDoFirstStrip;
  const reviewActionsBtn = showReviewActions
    ? `<button type="button" class="btn btn-primary btn-compact" id="gov-review-actions">${escapeHtml(COPY.reviewActions)}</button>`
    : '';

  return `
    <section class="gov-command-answer" aria-label="${escapeHtml(COPY.briefTitle)}"${hasOwnerClusters ? ' data-has-owner-clusters="true"' : ''}>
      <div class="gov-command-head">${trustBadge}</div>
      <div class="gov-visual-answer-blocks" role="group" aria-label="Delivery decision">
        <div class="gov-answer-block gov-answer-block--status gov-answer-block--${escapeHtml(tier)}" data-hover-proof="status" data-verdict-tier="${escapeHtml(tier)}">
          <span class="gov-answer-block-label">${escapeHtml(COPY.statusLabel)}</span>
          <strong class="gov-answer-block-value">${escapeHtml(statusLabel.slice(0, 40))}</strong>
        </div>
        <div class="gov-answer-block gov-answer-block--owner" data-hover-proof="owner-lane">
          <span class="gov-answer-block-label">${escapeHtml(COPY.ownerLabel)}</span>
          <strong class="gov-answer-block-value">${escapeHtml(ownerName)} · ${itemCount} item${itemCount === 1 ? '' : 's'}${squad ? ` · ${escapeHtml(squad)}` : ''}</strong>
        </div>
        ${showActionBlock ? `<div class="gov-answer-block gov-answer-block--action">
          <span class="gov-answer-block-label">${escapeHtml(COPY.doFirst)}</span>
          <strong class="gov-answer-block-value">${escapeHtml(doFirstLabel)}</strong>
        </div>` : ''}
      </div>
      ${doFirstStrip}
      <div class="gov-trust-chip-row" role="group" aria-label="Trust summary">
        <span class="gov-trust-part" data-hover-proof="trust" title="Can I trust this answer?">Trust ${escapeHtml(trustTierLabel(brief))}</span>
        <span class="gov-trust-part" data-hover-proof="evidence-count">Proof ${evidenceCount}</span>
        <span class="gov-trust-part" data-hover-proof="freshness">Data ${escapeHtml(fresh)}</span>
        <a class="gov-trust-part gov-trust-part--link" href="/settings#gov-ai-helper" data-hover-proof="ai">AI ${escapeHtml(narratedBy === 'advisor' ? 'Advisor' : 'Template')}</a>
        <span class="gov-send-badge gov-send-badge--${readiness.tier}" data-hover-proof="safe-send">${escapeHtml(readiness.label)}</span>
      </div>
      ${detailLine ? `<p class="gov-command-answer-detail">${escapeHtml(detailLine.slice(0, 200))}</p>` : ''}
      <div class="gov-command-actions">
        ${reviewActionsBtn}
        <button type="button" class="btn btn-secondary btn-compact" id="gov-copy-answer-inline">Copy answer</button>
        <div class="gov-overflow-menu-wrap">
          <button type="button" class="btn btn-secondary btn-compact" id="gov-overflow-toggle" aria-expanded="false" aria-haspopup="true">${escapeHtml(COPY.overflowMore)}</button>
          <div class="gov-overflow-menu" id="gov-overflow-menu" hidden role="menu">
            <button type="button" class="btn btn-secondary btn-compact" id="gov-copy-pi-forum" ${piForum ? '' : 'disabled'}>Copy PI forum answer</button>
            <button type="button" class="btn btn-link btn-compact" id="gov-protect-me">Protect-me wording</button>
            <button type="button" class="btn btn-link btn-compact" id="gov-fix-setup">Fix setup</button>
          </div>
        </div>
      </div>
      <p id="gov-protect-me-line" class="gov-protect-me-line" hidden></p>
    </section>`;
}

export function bindCommandOverflowMenu(root) {
  if (!root) return;
  const toggle = root.querySelector('#gov-overflow-toggle');
  const menu = root.querySelector('#gov-overflow-menu');
  if (!toggle || !menu) return;
  toggle.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('.gov-overflow-menu-wrap')) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  });
}
