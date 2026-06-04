/**
 * Governance brief — proof, nudge, cluster, and command bindings.
 */
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';
import { commandAnswerSentence, riskToUseCase } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';
import { COPY, firstNameFromDisplay } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { buildGuidedNudgeText } from './Delivera-CurrentSprint-Action-Bridge.js';
import { openJiraNudgeReviewSheet } from './Delivera-CurrentSprint-JiraNudge-02ReviewSheet-01UI.js';
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { govPage, MARK_WRONG_REASONS, projectsCsv, whyItMatters } from './Delivera-Governance-Brief-Page-01Context.js';

function riskByProofIndex(idx) {
  return govPage.proofRisks[Number(idx)];
}

function riskByDoNowIndex(idx) {
  const action = govPage.lastSurfaces?.doNowActions?.[Number(idx)];
  if (!action?.issueKey) return null;
  return govPage.proofRisks.find((r) => String(r.issueKey).toUpperCase() === String(action.issueKey).toUpperCase())
    || (govPage.lastBrief?.topRisks || []).find((r) => String(r.issueKey).toUpperCase() === String(action.issueKey).toUpperCase());
}

export function draftNudgeText(risk) {
  return buildGuidedNudgeText({
    issueKey: risk.issueKey,
    issueSummary: risk.summary || risk.displayTitle,
    issueStatus: risk.status,
    issueUrl: risk.issueUrl,
    staleHours: risk.ageHours,
    summaryContext: {
      topAction: risk.recommendedAction,
      evidenceBand: govPage.lastBrief?.freshness?.confidenceLimit === 'stale' ? 'low' : 'actionable',
    },
  });
}

function openMarkWrongPanel(idx) {
  const panel = govPage.els.proofRisks.querySelector(`[data-wrong-panel="${idx}"]`);
  if (!panel) return;
  panel.hidden = false;
  panel.innerHTML = `
    <p class="governance-nudge-label">Why is this wrong?</p>
    ${MARK_WRONG_REASONS.map((r) => `<button type="button" class="btn btn-secondary btn-compact" data-wrong-reason="${idx}" data-reason-id="${r.id}">${escapeHtml(r.label)}</button>`).join('')}
    <button type="button" class="btn btn-link btn-compact" data-wrong-cancel="${idx}">Cancel</button>`;
}

async function submitMarkWrong(idx, reasonId) {
  const risk = riskByProofIndex(idx);
  if (!risk || !govPage.lastBrief) return;
  try {
    await fetch('/api/governance/narration-feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patternKey: reasonId,
        phrase: risk.evidence || '',
        project: projectsCsv().split(',')[0] || '',
        briefId: govPage.lastBrief.briefId,
        source: 'challenge-flag',
      }),
    });
  } catch (_) { /* non-blocking */ }
  const panel = govPage.els.proofRisks.querySelector(`[data-wrong-panel="${idx}"]`);
  if (panel) { panel.hidden = true; panel.innerHTML = '<p class="governance-nudge-status">Thanks — recorded.</p>'; }
}

function openNudgeBox(idx) {
  const risk = riskByProofIndex(idx);
  if (!risk?.issueKey) return;
  const stale = govPage.lastBrief?.freshness?.confidenceLimit === 'stale';
  const draft = draftNudgeText(risk);
  const who = firstNameFromDisplay(risk.assigneeName || risk.decisionNeededFrom) || COPY.unassigned;
  openJiraNudgeReviewSheet({
    issueKey: risk.issueKey,
    issueSummary: risk.summary || risk.displayTitle,
    issueStatus: risk.status,
    issueUrl: risk.issueUrl,
    useCase: riskToUseCase(risk.riskType),
    staleHours: risk.ageHours,
    readOnly: stale,
    meta: { stale, governanceSend: !stale },
    sprint: null,
    initialDraft: draft,
    contextHeader: `To: ${who} · Why: ${whyItMatters(risk).slice(0, 80)}`,
  });
  const wrap = document.getElementById('gov-supporting-evidence');
  if (wrap && !wrap.open) wrap.open = true;
}

async function sendDoNowNudgeDirect(risk) {
  if (govPage.lastBrief?.freshness?.confidenceLimit === 'stale') return;
  const text = draftNudgeText(risk);
  try {
    await fetch(`/api/issues/${encodeURIComponent(risk.issueKey)}/comment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentBody: text }),
    });
  } catch (_) { /* non-blocking */ }
}

function toggleDetail(idx) {
  const detail = govPage.els.proofRisks.querySelector(`[data-detail="${idx}"]`);
  const btn = govPage.els.proofRisks.querySelector(`[data-why="${idx}"]`);
  if (!detail) return;
  const show = detail.hasAttribute('hidden');
  detail.toggleAttribute('hidden', !show);
  if (btn) btn.setAttribute('aria-expanded', show ? 'true' : 'false');
}

function buildGroupedNudgeDraft(g) {
  const keys = (g?.issues || []).map((r) => r.issueKey).filter(Boolean);
  const first = g.issues.find((r) => r.issueKey) || g.issues[0];
  if (!first) return '';
  const base = draftNudgeText(first);
  const extra = keys.length > 1 ? `\n\nRelated: ${keys.join(', ')}` : '';
  const lane = g.decisionLane ? `\nLane: ${g.decisionLane}` : '';
  return `${base}${extra}${lane}`;
}

function openGroupedNudge(groupIndex) {
  const g = govPage.ownerGroups[groupIndex];
  if (!g?.issues?.length) return;
  const first = g.issues.find((r) => r.issueKey) || g.issues[0];
  if (!first?.issueKey) return;
  const stale = govPage.lastBrief?.freshness?.confidenceLimit === 'stale';
  const who = firstNameFromDisplay(g.assigneeName || g.ownerKey) || COPY.unassigned;
  openJiraNudgeReviewSheet({
    issueKey: first.issueKey,
    issueSummary: first.summary || first.displayTitle,
    issueStatus: first.status,
    issueUrl: first.issueUrl,
    useCase: riskToUseCase(first.riskType),
    staleHours: first.ageHours,
    readOnly: stale,
    meta: { stale, governanceSend: !stale },
    sprint: null,
    initialDraft: buildGroupedNudgeDraft(g),
    contextHeader: `To: ${who} · ${g.issues.length} items · ${g.commonReason || 'needs follow-up'}`,
  });
}

async function submitClusterDismiss(gi, reason) {
  try {
    await fetch('/api/governance/feedback-triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phrase: `Cluster dismiss: ${reason}`, source: 'cluster-dismiss', patternKey: reason }),
    });
  } catch (_) { /* non-blocking */ }
  const article = govPage.els.actionClustersMount?.querySelector(`article[data-cluster-index="${gi}"]`);
  if (article) article.hidden = true;
}

export function bindProofInteractions() {
  govPage.els.proofRisks.onclick = async (event) => {
    const why = event.target.closest('[data-why]');
    if (why) { toggleDetail(why.getAttribute('data-why')); return; }
    const mw = event.target.closest('[data-mark-wrong]');
    if (mw) { openMarkWrongPanel(mw.getAttribute('data-mark-wrong')); return; }
    const wr = event.target.closest('[data-wrong-reason]');
    if (wr) {
      submitMarkWrong(wr.getAttribute('data-wrong-reason'), wr.getAttribute('data-reason-id'));
      return;
    }
    const wc = event.target.closest('[data-wrong-cancel]');
    if (wc) {
      const p = govPage.els.proofRisks.querySelector(`[data-wrong-panel="${wc.getAttribute('data-wrong-cancel')}"]`);
      if (p) { p.hidden = true; p.innerHTML = ''; }
      return;
    }
    const copyMsg = event.target.closest('[data-copy-msg]');
    if (copyMsg) {
      const risk = riskByProofIndex(copyMsg.getAttribute('data-copy-msg'));
      if (risk) await navigator.clipboard.writeText(draftNudgeText(risk).replace(/\n/g, ' '));
      return;
    }
    const nudge = event.target.closest('[data-nudge]');
    if (nudge) { openNudgeBox(nudge.getAttribute('data-nudge')); return; }
  };
}

export function bindOwnerClusterInteractions() {
  if (!govPage.els.actionClustersMount) return;
  govPage.els.actionClustersMount.onclick = (event) => {
    const dismiss = event.target.closest('[data-cluster-dismiss]');
    if (dismiss) {
      submitClusterDismiss(dismiss.getAttribute('data-cluster-dismiss'), dismiss.getAttribute('data-dismiss-reason') || 'handled');
      return;
    }
    const proof = event.target.closest('[data-proof-cluster]');
    if (proof) {
      const gi = Number(proof.getAttribute('data-proof-cluster'));
      openEvidenceDrawer(govPage.lastBrief, govPage.ownerGroups[gi]?.issues || []);
      return;
    }
    const nudge = event.target.closest('[data-grouped-nudge]');
    if (nudge) openGroupedNudge(Number(nudge.getAttribute('data-grouped-nudge')));
    const toggle = event.target.closest('[data-cluster-toggle]');
    if (toggle) {
      const gi = toggle.getAttribute('data-cluster-toggle');
      const list = govPage.els.actionClustersMount.querySelector(`[data-cluster-issues="${gi}"]`);
      if (!list) return;
      const show = list.hasAttribute('hidden');
      list.toggleAttribute('hidden', !show);
      toggle.setAttribute('aria-expanded', show ? 'true' : 'false');
      toggle.textContent = show ? 'Hide issues' : 'Show issues';
    }
  };
}

async function recordNarrationIfAdvisor() {
  if (!govPage.lastBrief || govPage.lastBrief?.meta?.narratedBy !== 'advisor') return;
  const n = govPage.lastBrief.leadershipNarrative || {};
  try {
    await fetch('/api/governance/narration-feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patternKey: govPage.lastBrief.briefId || 'brief',
        phrase: n.oneParagraph || n.meetingAnswer || '',
        project: projectsCsv().split(',')[0] || '',
        briefId: govPage.lastBrief.briefId,
        source: 'sm-accepted',
      }),
    });
  } catch (_) { /* non-blocking */ }
}

function scrollToFirstClusterNudge() {
  const btn = govPage.els.actionClustersMount?.querySelector('[data-grouped-nudge]');
  if (!btn) {
    govPage.els.actionClustersMount?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    return;
  }
  btn.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  btn.focus?.();
}

export function openInboxNudgeReview(item) {
  if (!item) return;
  const payload = item.payload || {};
  const issueKey = payload.issueKey || item.issueKey || '';
  const draft = String(payload.draftText || '').trim()
    || (issueKey ? buildGuidedNudgeText({
      issueKey,
      issueSummary: payload.summary || item.summary,
      issueStatus: payload.status,
      issueUrl: payload.issueUrl,
      staleHours: payload.ageHours,
    }) : '');
  const who = firstNameFromDisplay(payload.owner || payload.assigneeName) || COPY.unassigned;
  openJiraNudgeReviewSheet({
    issueKey: issueKey || 'INBOX',
    issueSummary: payload.summary || item.summary || issueKey,
    issueStatus: payload.status,
    issueUrl: payload.issueUrl,
    useCase: riskToUseCase(payload.riskType || item.type),
    staleHours: payload.ageHours,
    readOnly: govPage.lastBrief?.freshness?.confidenceLimit === 'stale',
    meta: { stale: govPage.lastBrief?.freshness?.confidenceLimit === 'stale', governanceSend: true },
    sprint: null,
    initialDraft: draft,
    contextHeader: `To: ${who} · ${item.summary || 'Nudge review'}`,
  });
}

export function bindCommandAnswerActions() {
  if (!govPage.els.answerMount || govPage.els.answerMount.dataset.bound) return;
  govPage.els.answerMount.dataset.bound = '1';
  govPage.els.answerMount.addEventListener('click', async (event) => {
    if (event.target.closest('#gov-scroll-first-nudge')) {
      scrollToFirstClusterNudge();
      return;
    }
    const review = event.target.closest('#gov-review-actions');
    if (review) {
      govPage.els.actionClustersMount?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      return;
    }
    const copyBtn = event.target.closest('#gov-copy-answer-inline');
    if (copyBtn && govPage.lastBrief) {
      try {
        await navigator.clipboard.writeText(commandAnswerSentence(govPage.lastBrief));
        void recordNarrationIfAdvisor();
        const prev = copyBtn.textContent;
        copyBtn.textContent = 'Copied';
        setTimeout(() => { copyBtn.textContent = prev || 'Copy answer'; }, 1500);
      } catch (_) {
        copyBtn.textContent = 'Copy failed';
      }
      return;
    }
    if (event.target.closest('#gov-fix-setup')) {
      govPage.els.setupDebtMount?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      return;
    }
    const piCopy = event.target.closest('#gov-copy-pi-forum');
    if (piCopy && govPage.lastBrief) {
      const text = govPage.lastBrief?.meta?.piForumAnswer || '';
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
          piCopy.textContent = 'PI copied';
          setTimeout(() => { piCopy.textContent = 'Copy PI forum answer'; }, 1500);
        } catch (_) { piCopy.textContent = 'Copy failed'; }
      }
    }
    const protect = event.target.closest('#gov-protect-me');
    if (protect && govPage.lastBrief) {
      const line = govPage.els.answerMount?.querySelector('#gov-protect-me-line');
      if (line) {
        line.hidden = false;
        line.textContent = govPage.lastBrief?.meta?.protectMeAnswer || '';
      }
      protect.setAttribute('aria-pressed', 'true');
    }
  });
}

export function bindSetupDebtActions() {
  if (!govPage.els.setupDebtMount || govPage.els.setupDebtMount.dataset.bound) return;
  govPage.els.setupDebtMount.dataset.bound = '1';
  govPage.els.setupDebtMount.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-setup-action]');
    if (!chip) return;
    const action = chip.getAttribute('data-setup-action');
    if (action === 'set-baseline') {
      govPage.scopeBarApi?.expandScopePanel?.();
      govPage.scopeBarApi?.openBaselineWizard?.();
    } else if (action === 'add-ai-key') window.location.href = '/settings#gov-ai-helper';
    else if (action === 'create-work') document.getElementById('gov-hidden-create-work')?.click();
    else if (action === 'map-board') document.getElementById('gov-scope-change')?.click();
    else if (action === 'refresh') document.getElementById('gov-scope-refresh')?.click();
    else if (action === 'review-lanes') govPage.els.actionClustersMount?.scrollIntoView?.({ behavior: 'smooth' });
  });
}

export function bindGovernancePageInteractions() {
  bindProofInteractions();
  bindCommandAnswerActions();
  bindSetupDebtActions();
}
