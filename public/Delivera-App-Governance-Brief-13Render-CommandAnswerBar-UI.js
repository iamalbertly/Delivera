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
import { renderAiContributionStrip } from './Delivera-Shared-AgentQueue-01UI.js';

function trustTierLabel(brief) {
  if (brief?.freshness?.confidenceLimit === 'stale') return 'Low';
  if (brief?.meta?.safeToSend === true) return 'High';
  if (brief?.meta?.safeToSend === false) return 'Low';
  return 'Medium';
}

function renderLeadBlockerStrip(top) {
  if (!top?.issueKey) return '';
  const age = Number(top.ageHours) || 0;
  const ageLabel = age >= 48 ? `${Math.round(age / 24)}d stale` : (age >= 24 ? `${Math.round(age)}h stale` : '');
  const title = String(top.displayTitle || top.summary || '').slice(0, 72);
  const keyHtml = top.issueUrl
    ? `<a href="${escapeHtml(top.issueUrl)}" class="gov-issue-key-link" target="_blank" rel="noopener">${escapeHtml(top.issueKey)}</a>`
    : `<span class="gov-issue-key-link">${escapeHtml(top.issueKey)}</span>`;
  return `
    <div class="gov-lead-blocker-strip" data-lead-blocker="1" data-hover-proof="owner-lane">
      <span class="gov-lead-blocker-label">Lead blocker</span>
      ${keyHtml}
      <span class="gov-lead-blocker-title">${escapeHtml(title)}</span>
      ${ageLabel ? `<span class="gov-age-chip">${escapeHtml(ageLabel)}</span>` : ''}
    </div>`;
}

export function renderCommandAnswerBar(brief, surfaces = null, opts = {}) {
  const hasOwnerClusters = Boolean(opts.hasOwnerClusters);
  const suppressAdvisorBadge = Boolean(opts.suppressAdvisorBadge);
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
  const showDoFirstStrip = !hasOwnerClusters && (tier === 'blocked' || doFirst?.escalation === 'act-today' || doFirst?.escalation === 'escalate');
  const evidenceCount = (brief?.evidencePack?.rows || []).length;
  const piForum = brief?.meta?.piForumAnswer || '';
  const readiness = sendReadinessBadge(brief);
  const fresh = freshnessShortLabel(brief?.freshness || {});

  const doFirstCta = hasOwnerClusters
    ? ''
    : (doFirstUrl
      ? `<a class="btn btn-primary btn-compact" href="${escapeHtml(doFirstUrl)}" target="_blank" rel="noopener">Open →</a>`
      : '');
  const doFirstStrip = showDoFirstStrip
    ? `<div class="gov-do-first-strip" data-hover-proof="owner-lane">
        <span class="gov-do-first-prefix">${escapeHtml(COPY.doFirst)}:</span>
        <strong class="gov-do-first-action">${escapeHtml(doFirstLabel)}</strong>
        ${hasOwnerClusters
    ? `<button type="button" class="btn btn-primary btn-compact" id="gov-do-first-execute">✉ ${escapeHtml(COPY.draftNudge)}</button>`
    : doFirstCta}
      </div>`
    : '';
  const showActionBlock = !showDoFirstStrip;

  const narratedBy = brief?.meta?.narratedBy || n.narratedBy || 'template';
  const statusHead = String(statusLabel || '').toUpperCase();
  const detailLine = sentence && statusHead && String(sentence).toUpperCase().startsWith(statusHead)
    ? ''
    : sentence;
  const freshLabel = fresh || 'live Jira';
  const showAdvisor = narratedBy === 'advisor' && !suppressAdvisorBadge;
  const trustBadge = showAdvisor
    ? `<span class="gov-narration-badge gov-narration-badge--advisor" title="Clearer wording from AI · facts unchanged">${escapeHtml(COPY.clearerWording)}</span>`
    : `<span class="gov-narration-badge gov-narration-badge--template" title="Based on ${escapeHtml(freshLabel)}">${escapeHtml(COPY.standardWording)}</span>`;
  const leadBlocker = (!opts.hideLeadBlocker && top?.issueKey) ? renderLeadBlockerStrip(top) : '';
  const aiStrip = narratedBy === 'advisor'
    ? renderAiContributionStrip(brief?.meta?.aiContribution || {})
    : '';
  const trustLineParts = [
    `Trust ${trustTierLabel(brief)}`,
    hasOwnerClusters ? null : `Proof ${evidenceCount} keys`,
    `Data ${fresh}`,
    `<a href="/settings#gov-ai-helper">${escapeHtml(narratedBy === 'advisor' ? 'AI helped' : 'Templates')}</a>`,
    escapeHtml(readiness.label),
  ].filter(Boolean);
  const trustLine = `<p class="gov-trust-line" aria-label="Trust summary">${trustLineParts.join(' · ')}</p>`;

  const showReviewActions = !hasOwnerClusters && !showDoFirstStrip && itemCount > 0;
  const reviewActionsBtn = showReviewActions
    ? `<button type="button" class="btn btn-primary btn-compact" id="gov-review-actions">${escapeHtml(COPY.reviewActions)}</button>`
    : '';

  const collapseHero = Boolean(opts.collapseHeroDedupe);
  return `
    <section class="gov-command-answer${hasOwnerClusters ? ' gov-command-answer--cluster-mode' : ''}${collapseHero ? ' gov-command-answer--hero-deduped' : ''}" aria-label="${escapeHtml(COPY.briefTitle)}"${hasOwnerClusters ? ' data-has-owner-clusters="true"' : ''}${collapseHero ? ' data-hero-deduped="1"' : ''}>
      <div class="gov-command-head">${trustBadge}${aiStrip ? `<div class="gov-command-ai-strip">${aiStrip}</div>` : ''}</div>
      ${leadBlocker}
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
      ${hasOwnerClusters ? '' : trustLine}
      ${detailLine ? `<p class="gov-command-answer-detail">${escapeHtml(detailLine.slice(0, 200))}</p>` : ''}
      <div class="gov-command-actions">
        ${reviewActionsBtn}
        <div class="gov-overflow-menu-wrap">
          <button type="button" class="btn btn-secondary btn-compact" id="gov-overflow-toggle" aria-expanded="false" aria-haspopup="true">${escapeHtml(COPY.overflowMore)}</button>
          <div class="gov-overflow-menu" id="gov-overflow-menu" hidden role="menu">
            <button type="button" class="btn btn-secondary btn-compact" id="gov-export-overflow">${escapeHtml(COPY.exportBrief)}</button>
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
