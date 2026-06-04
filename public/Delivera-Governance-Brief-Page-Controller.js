/**
 * Governance Brief page controller — executive pulse orchestration.
 */
import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import { mountGovernanceScopeBar } from './Delivera-App-Governance-Brief-ScopeBar-01Render-UI.js';
import { openScopeIntelligenceDrawer, scopeCapsuleCounts } from './Delivera-App-Governance-Brief-18Render-ScopeIntelligenceDrawer-UI.js';
import {
  escapeHtml, truthChip, renderStructuredEvidence, briefToMarkdown,
} from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { partitionBriefSurfaces, groupDoNowByOwner } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';
import { renderVerdictZone } from './Delivera-App-Governance-Brief-07Render-VerdictZone-UI.js';
import { renderPortfolioGrid, bindRiskHeatInteractions } from './Delivera-App-Governance-Brief-12Render-PortfolioGrid-UI.js';
import { renderMeasurementStrip } from './Delivera-App-Governance-Brief-10Render-MeasurementStrip-UI.js';
import { renderMeetingScript, buildMeetingAnswerClipboard } from './Delivera-App-Governance-Brief-11Render-MeetingScript-UI.js';
import { renderCommandAnswerBar, bindCommandOverflowMenu } from './Delivera-App-Governance-Brief-13Render-CommandAnswerBar-UI.js';
import { renderWorkerReceiptRail } from './Delivera-App-Governance-Brief-14Render-WorkerReceipt-UI.js';
import { renderOwnerActionClusters } from './Delivera-App-Governance-Brief-15Render-OwnerActionCluster-UI.js';
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';
import { renderSetupDebtStrip } from './Delivera-App-Governance-Brief-17Render-SetupDebtStrip-UI.js';
import { commandAnswerSentence } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';
import { COPY, freshnessPlainEnglish, verdictTierFromBrief } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { setBriefNavBadge } from './Delivera-Shared-Global-Nav.js';
import { wireGovernanceIssuePreview } from './Delivera-Shared-Issue-Preview-01Bridge.js';
import { mountGovernanceInbox } from './Delivera-App-Governance-Inbox-01Render-UI.js';
import { renderGovernanceMicroSurvey } from './Delivera-App-Governance-Brief-12Render-MicroSurvey-UI.js';
import { renderPIConfidenceStrip } from './Delivera-App-Governance-Brief-19Render-PIConfidenceStrip-UI.js';
import { renderEpicHygienePanel, bindEpicHygieneInteractions } from './Delivera-App-Governance-Brief-20Render-EpicHygienePanel-UI.js';
import { bindHoverProofCards } from './Delivera-App-Governance-Brief-22Render-HoverProofCards-UI.js';
import { mountFeedbackLabButton } from './Delivera-App-Governance-Brief-21Render-FeedbackImprovementCenter-UI.js';
import {
  mountGlobalAgentBar, updateGlobalAgentBar, mountStickyMicroAnswer, updateStickyMicroAnswer, bindStickyScroll,
} from './Delivera-App-Governance-GlobalAgentBar-01UI.js';
import { buildGuidedNudgeText } from './Delivera-CurrentSprint-Action-Bridge.js';
import { openJiraNudgeReviewSheet } from './Delivera-CurrentSprint-JiraNudge-02ReviewSheet-01UI.js';

const els = {};
let lastBrief = null;
let lastSurfaces = null;
let proofRisks = [];
let scopeBarApi = null;
let inboxApi = null;
let ownerGroups = [];

const MARK_WRONG_REASONS = [
  { id: 'wrong-board', label: 'Wrong board' },
  { id: 'wrong-sprint', label: 'Wrong sprint' },
  { id: 'already-moved', label: 'Issue already moved' },
  { id: 'owner-wrong', label: 'Owner wrong' },
  { id: 'other', label: 'Other' },
];

function $(id) { return document.getElementById(id); }

function projectsCsv() {
  const fromBar = scopeBarApi?.getProjects?.();
  if (fromBar?.length) return fromBar.join(',');
  try {
    const list = readSharedProjectsCsv();
    return list.length ? list.join(',') : 'MPSA,MAS';
  } catch (_) {
    return 'MPSA,MAS';
  }
}

function renderFreshness(brief, confirmCount = 0) {
  const f = brief?.freshness || {};
  const text = freshnessPlainEnglish(f);
  const cls = f.confidenceLimit === 'stale' ? 'is-stale' : f.confidenceLimit === 'live' ? 'is-live' : 'is-cached';
  const reviewBit = confirmCount > 0
    ? ` · <button type="button" class="gov-freshness-review-link" id="gov-freshness-review">${confirmCount} claim${confirmCount > 1 ? 's' : ''} to review</button>`
    : '';
  els.freshness.innerHTML = `<span class="governance-freshness-pill ${cls}">${escapeHtml(text)}${reviewBit}</span>`;
  els.freshness.querySelector('#gov-freshness-review')?.addEventListener('click', () => {
    document.querySelector('.gov-queue-chip[data-queue-tab="confirm"]')?.click();
  });
}

function evidenceRowFor(brief, issueKey) {
  if (!issueKey) return null;
  return (brief?.evidencePack?.rows || []).find(
    (r) => String(r.issueKey).toUpperCase() === String(issueKey).toUpperCase(),
  ) || null;
}

function whyItMatters(risk) {
  if (risk.riskType === 'insufficient-delivery-evidence') {
    return 'Progress cannot be verified from Jira for this scope.';
  }
  if (risk.riskType === 'data-confidence-gap') {
    return 'Delivery numbers may be wrong until story points are set up correctly.';
  }
  if (risk.escalation === 'escalate') return 'Leadership should hear this before the next check-in.';
  return 'This slows delivery unless someone acts today.';
}

function renderProofRisks(risks) {
  proofRisks = risks;
  if (!risks.length) {
    els.proofRisks.innerHTML = '<p class="governance-empty">Nothing needs attention in this window.</p>';
    return;
  }
  const items = risks.map((r, idx) => {
    const ev = evidenceRowFor(lastBrief, r.issueKey);
    const keyLabel = r.issueKey
      ? (r.issueUrl
        ? `<a href="${escapeHtml(r.issueUrl)}" target="_blank" rel="noopener" id="gov-risk-${escapeHtml(r.issueKey)}" data-issue-key="${escapeHtml(r.issueKey)}" class="gov-issue-key-link">${escapeHtml(r.issueKey)}</a>`
        : escapeHtml(r.issueKey))
      : escapeHtml(r.squad || 'Portfolio');
    const proofLine = r.evidence || ev?.whyFlagged || '';
    return `
      <li class="governance-risk" data-escalation="${escapeHtml(r.escalation || 'watch')}" id="gov-risk-card-${idx}">
        <div class="governance-risk-head">
          <span class="governance-risk-key">${keyLabel}</span>
          <span class="governance-risk-lane">${escapeHtml(r.decisionNeededFrom || 'Scrum Master')}</span>
        </div>
        <p><strong>${escapeHtml(COPY.problem)}:</strong> ${escapeHtml(r.displayTitle || r.summary || r.riskLabel || '')}</p>
        <p><strong>${escapeHtml(COPY.whyItMatters)}:</strong> ${escapeHtml(whyItMatters(r))}</p>
        <p><strong>${escapeHtml(COPY.owner)}:</strong> ${escapeHtml(r.decisionNeededFrom || r.assigneeName || '')}</p>
        <p><strong>${escapeHtml(COPY.nextMove)}:</strong> ${escapeHtml(r.recommendedAction || '')}</p>
        <p class="gov-risk-proof-line"><strong>${escapeHtml(COPY.proofLine)}:</strong> ${escapeHtml(proofLine)}</p>
        <div class="governance-risk-tools">
          ${r.issueKey ? `<button type="button" class="btn btn-link btn-compact" data-copy-msg="${idx}">Copy message</button>` : ''}
          ${r.issueKey ? `<button type="button" class="btn btn-secondary btn-compact" data-nudge="${idx}">Draft nudge</button>` : ''}
          <button type="button" class="btn btn-link btn-compact" data-mark-wrong="${idx}">${escapeHtml(COPY.markAsWrong)}</button>
          <button type="button" class="btn btn-link btn-compact" data-why="${idx}" aria-expanded="false">Why flagged?</button>
        </div>
        <div class="gov-mark-wrong-panel" data-wrong-panel="${idx}" hidden></div>
        <div class="governance-risk-detail" data-detail="${idx}" hidden>${renderStructuredEvidence(ev, r)}</div>
        <div class="governance-nudge" data-nudgebox="${idx}" hidden></div>
      </li>`;
  }).join('');
  els.proofRisks.innerHTML = `<ol class="governance-risk-list">${items}</ol>`;
}

function renderEvidenceTable(brief) {
  const rows = brief?.evidencePack?.rows || [];
  if (!rows.length) {
    els.evidence.innerHTML = '<p class="governance-empty">No proof rows for flagged items.</p>';
    return;
  }
  const body = rows.map((r) => `
    <tr>
      <td><a href="/governance#gov-risk-${escapeHtml(r.issueKey)}">${escapeHtml(r.issueKey)}</a></td>
      <td>${escapeHtml(r.statusNow || '')}</td>
      <td>${escapeHtml(r.statusLastWeek || '')}</td>
      <td>${escapeHtml(r.whyFlagged || '')}</td>
    </tr>`).join('');
  els.evidence.innerHTML = `<table class="governance-evidence-table"><thead><tr><th>Issue</th><th>Status</th><th>Last week</th><th>Why</th></tr></thead><tbody>${body}</tbody></table>`;
}

function renderTechnicalDetails(brief) {
  if (!els.technical) return;
  const n = brief?.leadershipNarrative || {};
  els.technical.innerHTML = `
    <p class="governance-empty" style="margin-top:8px;font-size:0.78rem;">
      Technical: Brief ${escapeHtml(brief.briefId || '')} · narrated by ${escapeHtml(brief?.meta?.narratedBy || 'template')}
      ${n.whatChanged ? ` · ${escapeHtml(n.whatChanged)}` : ''}
    </p>`;
}

function renderReadiness(brief) {
  const po = brief?.poReadiness;
  if (!po) { els.readiness.innerHTML = ''; return; }
  const s = po.signals || {};
  const chips = Object.entries(s)
    .filter(([, v]) => Number(v) > 0)
    .map(([label, v]) => `<span class="governance-readiness-chip">${escapeHtml(label)}: ${escapeHtml(String(v))}</span>`).join('');
  els.readiness.innerHTML = `
    <h3 class="governance-subsection-title">${escapeHtml(COPY.backlogReadiness)}</h3>
    <p class="governance-readiness-label">${escapeHtml(po.readinessLabel || '')}</p>
    <div class="governance-readiness-chips">${chips || '<span class="governance-empty">No signals.</span>'}</div>`;
}

function renderBaseline(brief) {
  const b = brief?.baselineComparison;
  if (!b) { els.baseline.innerHTML = ''; return; }
  const s = b.summary || {};
  els.baseline.innerHTML = `
    <h3 class="governance-subsection-title">${escapeHtml(COPY.planVsNow)}${b.piName ? ' · ' + escapeHtml(b.piName) : ''}</h3>
    <div class="governance-truth-grid">
      ${truthChip('Delivered', s.delivered, 'good')}
      ${truthChip('On track', s.onTrack, '')}
      ${truthChip('Delayed', s.delayed, s.delayed > 0 ? 'warn' : '')}
    </div>`;
}

async function renderScorecard() {
  if (!els.scorecard) return;
  let summary = { byMetric: {}, total: 0 };
  try {
    const res = await fetch(`/api/governance/adoption-metrics.json?project=${encodeURIComponent(projectsCsv().split(',')[0] || '')}`);
    if (res.ok) summary = await res.json();
  } catch (_) { /* empty */ }
  els.scorecard.innerHTML = summary.total
    ? `<p class="governance-empty">Pilot metrics: ${summary.total} entries logged.</p>`
    : '<p class="governance-empty">No pilot data yet.</p>';
}

function riskByProofIndex(idx) {
  return proofRisks[Number(idx)];
}

function riskByDoNowIndex(idx) {
  const action = lastSurfaces?.doNowActions?.[Number(idx)];
  if (!action?.issueKey) return null;
  return proofRisks.find((r) => String(r.issueKey).toUpperCase() === String(action.issueKey).toUpperCase())
    || (lastBrief?.topRisks || []).find((r) => String(r.issueKey).toUpperCase() === String(action.issueKey).toUpperCase());
}

function openMarkWrongPanel(idx) {
  const panel = els.proofRisks.querySelector(`[data-wrong-panel="${idx}"]`);
  if (!panel) return;
  panel.hidden = false;
  panel.innerHTML = `
    <p class="governance-nudge-label">Why is this wrong?</p>
    ${MARK_WRONG_REASONS.map((r) => `<button type="button" class="btn btn-secondary btn-compact" data-wrong-reason="${idx}" data-reason-id="${r.id}">${escapeHtml(r.label)}</button>`).join('')}
    <button type="button" class="btn btn-link btn-compact" data-wrong-cancel="${idx}">Cancel</button>`;
}

async function submitMarkWrong(idx, reasonId) {
  const risk = riskByProofIndex(idx);
  if (!risk || !lastBrief) return;
  try {
    await fetch('/api/governance/narration-feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patternKey: reasonId,
        phrase: risk.evidence || '',
        project: projectsCsv().split(',')[0] || '',
        briefId: lastBrief.briefId,
        source: 'challenge-flag',
      }),
    });
  } catch (_) { /* non-blocking */ }
  const panel = els.proofRisks.querySelector(`[data-wrong-panel="${idx}"]`);
  if (panel) { panel.hidden = true; panel.innerHTML = '<p class="governance-nudge-status">Thanks — recorded.</p>'; }
}

function riskToUseCase(riskType) {
  switch (String(riskType || '').toLowerCase()) {
    case 'late-scope': return 'scope';
    case 'missing-owner': return 'unassigned';
    case 'missing-estimate': return 'missing-estimate';
    case 'no-log': return 'no-log';
    case 'dependency':
    case 'stale-in-progress': return 'blocker';
    default: return 'ownership';
  }
}

function draftNudgeText(risk) {
  return buildGuidedNudgeText({
    issueKey: risk.issueKey,
    issueSummary: risk.summary || risk.displayTitle,
    issueStatus: risk.status,
    issueUrl: risk.issueUrl,
    staleHours: risk.ageHours,
    summaryContext: {
      topAction: risk.recommendedAction,
      evidenceBand: lastBrief?.freshness?.confidenceLimit === 'stale' ? 'low' : 'actionable',
    },
  });
}

function openNudgeBox(idx, root = els.proofRisks) {
  const risk = riskByProofIndex(idx);
  if (!risk?.issueKey) return;
  const stale = lastBrief?.freshness?.confidenceLimit === 'stale';
  openJiraNudgeReviewSheet({
    issueKey: risk.issueKey,
    issueSummary: risk.summary || risk.displayTitle,
    issueStatus: risk.status,
    issueUrl: risk.issueUrl,
    useCase: riskToUseCase(risk.riskType),
    staleHours: risk.ageHours,
    readOnly: stale,
    meta: { stale },
    sprint: null,
  });
  const wrap = document.getElementById('gov-supporting-evidence');
  if (wrap && !wrap.open) wrap.open = true;
}

function openDoNowNudge(donowIdx) {
  const risk = riskByDoNowIndex(donowIdx);
  if (!risk?.issueKey) return;
  const proofIdx = proofRisks.findIndex(
    (r) => String(r.issueKey).toUpperCase() === String(risk.issueKey).toUpperCase(),
  );
  if (proofIdx < 0) {
    void sendDoNowNudgeDirect(risk);
    return;
  }
  const wrap = document.getElementById('gov-supporting-evidence');
  if (wrap && !wrap.open) wrap.open = true;
  openNudgeBox(proofIdx);
  els.proofRisks.querySelector(`#gov-risk-card-${proofIdx}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
}

async function sendDoNowNudgeDirect(risk) {
  if (lastBrief?.freshness?.confidenceLimit === 'stale') return;
  const text = draftNudgeText(risk);
  try {
    await fetch(`/api/issues/${encodeURIComponent(risk.issueKey)}/comment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentBody: text }),
    });
  } catch (_) { /* user sees no inline status in do-now card v1 */ }
}

function toggleDetail(idx) {
  const detail = els.proofRisks.querySelector(`[data-detail="${idx}"]`);
  const btn = els.proofRisks.querySelector(`[data-why="${idx}"]`);
  if (!detail) return;
  const show = detail.hasAttribute('hidden');
  detail.toggleAttribute('hidden', !show);
  if (btn) btn.setAttribute('aria-expanded', show ? 'true' : 'false');
}

function bindProofInteractions() {
  els.proofRisks.onclick = async (event) => {
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
      const p = els.proofRisks.querySelector(`[data-wrong-panel="${wc.getAttribute('data-wrong-cancel')}"]`);
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

function openGroupedNudge(groupIndex) {
  const g = ownerGroups[groupIndex];
  if (!g?.issues?.length) return;
  const first = g.issues.find((r) => r.issueKey) || g.issues[0];
  if (!first?.issueKey) return;
  const stale = lastBrief?.freshness?.confidenceLimit === 'stale';
  openJiraNudgeReviewSheet({
    issueKey: first.issueKey,
    issueSummary: first.summary || first.displayTitle,
    issueStatus: first.status,
    issueUrl: first.issueUrl,
    useCase: riskToUseCase(first.riskType),
    staleHours: first.ageHours,
    readOnly: stale,
    meta: { stale },
    sprint: null,
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
  const toggle = els.actionClustersMount?.querySelector(`[data-cluster-issues="${gi}"]`);
  const article = els.actionClustersMount?.querySelector(`article[data-cluster-index="${gi}"]`);
  if (article) article.hidden = true;
  if (toggle) toggle.hidden = true;
}

function bindOwnerClusterInteractions() {
  if (!els.actionClustersMount) return;
  els.actionClustersMount.onclick = (event) => {
    const dismiss = event.target.closest('[data-cluster-dismiss]');
    if (dismiss) {
      const gi = dismiss.getAttribute('data-cluster-dismiss');
      const reason = els.actionClustersMount.querySelector(`[data-cluster-dismiss-reason="${gi}"]`)?.value || 'handled';
      submitClusterDismiss(gi, reason);
      return;
    }
    const proof = event.target.closest('[data-proof-cluster]');
    if (proof) {
      const gi = Number(proof.getAttribute('data-proof-cluster'));
      const g = ownerGroups[gi];
      openEvidenceDrawer(lastBrief, g?.issues || []);
      return;
    }
    const nudge = event.target.closest('[data-grouped-nudge]');
    if (nudge) {
      openGroupedNudge(Number(nudge.getAttribute('data-grouped-nudge')));
      return;
    }
    const toggle = event.target.closest('[data-cluster-toggle]');
    if (toggle) {
      const gi = toggle.getAttribute('data-cluster-toggle');
      const list = els.actionClustersMount.querySelector(`[data-cluster-issues="${gi}"]`);
      if (!list) return;
      const show = list.hasAttribute('hidden');
      list.toggleAttribute('hidden', !show);
      toggle.setAttribute('aria-expanded', show ? 'true' : 'false');
      toggle.textContent = show ? 'Hide issues' : 'Show issues';
    }
  };
}

function bindCommandAnswerActions() {
  if (!els.answerMount || els.answerMount.dataset.bound) return;
  els.answerMount.dataset.bound = '1';
  els.answerMount.addEventListener('click', async (event) => {
    const review = event.target.closest('#gov-review-actions');
    if (review) {
      els.actionClustersMount?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      els.actionClustersMount?.querySelector('.gov-owner-cluster')?.focus?.();
      return;
    }
    const copyBtn = event.target.closest('#gov-copy-answer-inline');
    if (copyBtn && lastBrief) {
      try {
        await navigator.clipboard.writeText(commandAnswerSentence(lastBrief));
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
      els.setupDebtMount?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      return;
    }
    const piCopy = event.target.closest('#gov-copy-pi-forum');
    if (piCopy && lastBrief) {
      const text = lastBrief?.meta?.piForumAnswer || '';
      if (text) {
        try {
          await navigator.clipboard.writeText(text);
          piCopy.textContent = 'PI copied';
          setTimeout(() => { piCopy.textContent = 'Copy PI forum answer'; }, 1500);
        } catch (_) { piCopy.textContent = 'Copy failed'; }
      }
      return;
    }
    const protect = event.target.closest('#gov-protect-me');
    if (protect && lastBrief) {
      const line = els.answerMount?.querySelector('#gov-protect-me-line');
      const text = lastBrief?.meta?.protectMeAnswer || '';
      if (line) {
        line.hidden = false;
        line.textContent = text;
      }
      protect.setAttribute('aria-pressed', 'true');
    }
  });
}

function bindSetupDebtActions() {
  if (!els.setupDebtMount || els.setupDebtMount.dataset.bound) return;
  els.setupDebtMount.dataset.bound = '1';
  els.setupDebtMount.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-setup-action]');
    if (!chip) return;
    const action = chip.getAttribute('data-setup-action');
    if (action === 'set-baseline') {
      scopeBarApi?.expandScopePanel?.();
      scopeBarApi?.openBaselineWizard?.();
    }
    else if (action === 'add-ai-key') window.location.href = '/settings#gov-ai-helper';
    else if (action === 'map-board') document.getElementById('gov-scope-change')?.click();
    else if (action === 'refresh') document.getElementById('gov-scope-refresh')?.click();
    else if (action === 'review-lanes') els.actionClustersMount?.scrollIntoView?.({ behavior: 'smooth' });
  });
}

async function recordNarrationIfAdvisor() {
  if (!lastBrief || lastBrief?.meta?.narratedBy !== 'advisor') return;
  const n = lastBrief.leadershipNarrative || {};
  try {
    await fetch('/api/governance/narration-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patternKey: lastBrief.briefId || 'brief',
        phrase: n.oneParagraph || n.meetingAnswer || '',
        project: projectsCsv().split(',')[0] || '',
        briefId: lastBrief.briefId,
        source: 'sm-accepted',
      }),
    });
  } catch (_) { /* non-blocking */ }
}

async function fetchImpactSection() {
  try {
    const res = await fetch(`/api/governance/impact-pack.json?projects=${encodeURIComponent(projectsCsv())}`);
    if (!res.ok) return '';
    const data = await res.json();
    return data.markdown ? `## Grow My Impact\n\n${data.markdown.split('\n').slice(2).join('\n')}` : '';
  } catch (_) {
    return '';
  }
}

async function copyMeetingAnswer() {
  if (!lastBrief) return;
  try {
    await navigator.clipboard.writeText(buildMeetingAnswerClipboard(lastBrief));
    void recordNarrationIfAdvisor();
    if (els.copyMeeting) {
      els.copyMeeting.textContent = 'Copied';
      setTimeout(() => { els.copyMeeting.textContent = COPY.copyMeetingAnswer; }, 1500);
    }
  } catch (_) {
    if (els.copyMeeting) els.copyMeeting.textContent = 'Copy failed';
  }
}

async function copyBrief() {
  if (!lastBrief) return;
  try {
    const impact = await fetchImpactSection();
    await navigator.clipboard.writeText(briefToMarkdown(lastBrief, projectsCsv(), impact));
    void recordNarrationIfAdvisor();
    els.export.textContent = 'Copied';
    setTimeout(() => { els.export.textContent = COPY.exportBrief; }, 1500);
  } catch (_) {
    els.export.textContent = 'Copy failed';
  }
}

function showError(message) {
  els.error.hidden = false;
  els.error.textContent = message;
}

function selectedProjects(brief) {
  const fromBar = scopeBarApi?.getProjects?.();
  if (fromBar?.length) return fromBar;
  return Array.isArray(brief?.projects) ? brief.projects : [];
}

function isPortfolioMode(brief) {
  return selectedProjects(brief).length >= 2;
}

function refreshScopeBarCounts() {
  scopeBarApi?.refreshCapsule?.();
}

let lastFeedbackSummary = null;

function renderBriefUi(brief) {
  lastSurfaces = partitionBriefSurfaces(brief);
  ownerGroups = groupDoNowByOwner(lastSurfaces.drawerIssues);
  if (els.piStripMount) {
    els.piStripMount.innerHTML = renderPIConfidenceStrip(brief);
    bindEpicHygieneInteractions(els.piStripMount, brief);
    els.piStripMount.querySelector('#gov-pi-fix-baseline')?.addEventListener('click', () => {
      scopeBarApi?.expandScopePanel?.();
      scopeBarApi?.openBaselineWizard?.();
    });
  }
  if (els.workerReceiptMount) els.workerReceiptMount.innerHTML = renderWorkerReceiptRail(brief, lastFeedbackSummary);
  if (els.answerMount) {
    els.answerMount.innerHTML = renderCommandAnswerBar(brief, lastSurfaces);
    bindCommandOverflowMenu(els.answerMount);
  }
  if (els.epicHygieneMount) els.epicHygieneMount.innerHTML = '';
  if (els.setupDebtMount) els.setupDebtMount.innerHTML = renderSetupDebtStrip(brief);
  if (els.verdictMount) {
    els.verdictMount.innerHTML = isPortfolioMode(brief)
      ? renderPortfolioGrid(brief)
      : renderVerdictZone(brief);
    if (isPortfolioMode(brief)) {
      bindRiskHeatInteractions(els.verdictMount, brief, (keys, squad) => {
        const risks = (squad?.cardRisks || []).map((r) => ({ issueKey: r.issueKey, evidence: r.displayTitle }));
        openEvidenceDrawer(brief, risks);
      });
    }
  }
  if (els.actionClustersMount) {
    els.actionClustersMount.innerHTML = renderOwnerActionClusters(brief, ownerGroups);
    bindOwnerClusterInteractions();
  }
  if (els.scriptMount) els.scriptMount.innerHTML = renderMeetingScript(brief);
  if (els.microSurveyMount) renderGovernanceMicroSurvey(els.microSurveyMount, projectsCsv().split(',')[0] || 'MPSA');
  if (els.measurementMount) els.measurementMount.innerHTML = renderMeasurementStrip(brief, lastSurfaces);
  renderProofRisks(lastSurfaces.proofRows);
  renderEvidenceTable(brief);
  renderTechnicalDetails(brief);
  renderReadiness(brief);
  renderBaseline(brief);
  bindProofInteractions();
  wireGovernanceIssuePreview(brief, document);
  bindHoverProofCards(document, brief);
  updateGlobalAgentBar(brief);
  updateStickyMicroAnswer(brief);
  refreshScopeBarCounts();
  const tier = verdictTierFromBrief(brief);
  const inboxTotal = inboxApi?.getInboxTotal?.() || brief?.meta?.workerReceipt?.inboxTotal || 0;
  scopeBarApi?.updateStatus?.(tier, inboxTotal, brief?.meta?.sinceLastRun?.summary || '');
  const warnCards = (brief?.meta?.scopeIntelligence?.cards || []).filter((c) => c.health && c.health !== 'ok').length;
  scopeBarApi?.setAdvancedWarnCount?.(warnCards);
  setBriefNavBadge(inboxTotal);
  mountFeedbackLabButton(els.feedbackLabMount, projectsCsv().split(',')[0], lastFeedbackSummary);
}

async function loadBrief() {
  els.error.hidden = true;
  const quarter = scopeBarApi?.getQuarterLabel?.() || '';
  const qs = new URLSearchParams({ projects: projectsCsv() });
  if (quarter) qs.set('quarter', quarter);
  const pk = projectsCsv().split(',')[0] || 'MPSA';
  try {
    const [briefRes, feedbackRes] = await Promise.all([
      fetch(`/api/governance-brief.json?${qs.toString()}`),
      fetch(`/api/governance/feedback-summary.json?projects=${encodeURIComponent(pk)}`),
    ]);
    if (!briefRes.ok) throw new Error(`HTTP ${briefRes.status}`);
    lastBrief = await briefRes.json();
    lastFeedbackSummary = feedbackRes.ok ? await feedbackRes.json() : null;
    const confirmCount = inboxApi?.getConfirmCount?.() || 0;
    renderFreshness(lastBrief, confirmCount);
    renderBriefUi(lastBrief);
    renderScorecard();
    inboxApi?.refresh?.();
    document.getElementById('gov-open-feedback-lab-inline')?.addEventListener('click', () => {
      document.getElementById('gov-open-feedback-lab')?.click();
    });
  } catch (err) {
    showError(`Could not load the brief: ${err.message}`);
  }
}

function init() {
  els.freshness = $('gov-freshness');
  els.piStripMount = $('gov-pi-strip-mount');
  els.stickyAnswerMount = $('gov-sticky-answer-mount');
  els.feedbackLabMount = $('gov-feedback-lab-mount');
  els.epicHygieneMount = $('gov-epic-hygiene-mount');
  els.workerReceiptMount = $('gov-worker-receipt-mount');
  els.answerMount = $('gov-answer-mount');
  els.setupDebtMount = $('gov-setup-debt-mount');
  els.verdictMount = $('gov-verdict-mount');
  els.actionClustersMount = $('gov-action-clusters-mount');
  els.scriptMount = $('gov-meeting-script-mount');
  els.measurementMount = $('gov-measurement-mount');
  els.microSurveyMount = $('gov-micro-survey-mount');
  els.proofRisks = $('gov-proof-risks');
  els.evidence = $('gov-evidence');
  els.technical = $('gov-technical-details');
  els.readiness = $('gov-readiness');
  els.baseline = $('gov-baseline');
  els.scorecard = $('gov-scorecard');
  els.error = $('gov-error');
  els.export = $('gov-export');
  els.export?.addEventListener('click', copyBrief);
  mountGlobalAgentBar();
  mountStickyMicroAnswer(els.stickyAnswerMount);
  bindStickyScroll(100);
  mountFeedbackLabButton(els.feedbackLabMount, projectsCsv().split(',')[0], null);
  scopeBarApi = mountGovernanceScopeBar({
    mount: $('gov-scope-bar-mount'),
    onRefresh: loadBrief,
    onScopeChange: () => loadBrief(),
    onOpenDrawer: () => { if (lastBrief) openScopeIntelligenceDrawer(lastBrief); },
    getScopeCounts: () => scopeCapsuleCounts(lastBrief) || {},
  });
  inboxApi = mountGovernanceInbox({
    mount: $('gov-queue-mount'),
    getProjectsCsv: projectsCsv,
    onFocusConfirm: () => {},
    onRefreshBrief: loadBrief,
  });
  els.actionClustersMount?.addEventListener('click', (event) => {
    if (event.target.closest('#gov-owner-check-setup')) {
      els.setupDebtMount?.scrollIntoView?.({ behavior: 'smooth' });
    }
  });
  bindProofInteractions();
  bindCommandAnswerActions();
  bindSetupDebtActions();
  loadBrief();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
