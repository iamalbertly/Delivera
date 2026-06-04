/**
 * Governance brief — load, render surfaces, export/copy helpers.
 */
import { partitionBriefSurfaces, groupDoNowByOwner } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';
import { renderVerdictZone } from './Delivera-App-Governance-Brief-07Render-VerdictZone-UI.js';
import { renderPortfolioGrid, bindRiskHeatInteractions } from './Delivera-App-Governance-Brief-12Render-PortfolioGrid-UI.js';
import { renderMeasurementStrip } from './Delivera-App-Governance-Brief-10Render-MeasurementStrip-UI.js';
import { renderMeetingScript } from './Delivera-App-Governance-Brief-11Render-MeetingScript-UI.js';
import { renderCommandAnswerBar, bindCommandOverflowMenu } from './Delivera-App-Governance-Brief-13Render-CommandAnswerBar-UI.js';
import { renderWorkerReceiptRail } from './Delivera-App-Governance-Brief-14Render-WorkerReceipt-UI.js';
import { renderOwnerActionClusters } from './Delivera-App-Governance-Brief-15Render-OwnerActionCluster-UI.js';
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';
import { renderSetupDebtStrip, bindSetupDebtStripExpand } from './Delivera-App-Governance-Brief-17Render-SetupDebtStrip-UI.js';
import {
  escapeHtml, truthChip, renderStructuredEvidence, briefToMarkdown,
} from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { COPY, freshnessPlainEnglish, verdictTierFromBrief } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { setBriefNavBadge } from './Delivera-Shared-Global-Nav.js';
import { wireGovernanceIssuePreview } from './Delivera-Shared-Issue-Preview-01Bridge.js';
import { renderGovernanceMicroSurvey } from './Delivera-App-Governance-Brief-12Render-MicroSurvey-UI.js';
import { renderPIConfidenceStrip } from './Delivera-App-Governance-Brief-19Render-PIConfidenceStrip-UI.js';
import { bindEpicHygieneInteractions } from './Delivera-App-Governance-Brief-20Render-EpicHygienePanel-UI.js';
import { bindHoverProofCards } from './Delivera-App-Governance-Brief-22Render-HoverProofCards-UI.js';
import { mountFeedbackLabButton } from './Delivera-App-Governance-Brief-21Render-FeedbackImprovementCenter-UI.js';
import { updateGlobalAgentBar, updateStickyMicroAnswer } from './Delivera-App-Governance-GlobalAgentBar-01UI.js';
import {
  govPage, projectsCsv, isPortfolioMode, refreshScopeBarCounts, whyItMatters,
} from './Delivera-Governance-Brief-Page-01Context.js';
import { bindOwnerClusterInteractions, bindProofInteractions } from './Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js';

let loadBriefSeq = 0;

function evidenceRowFor(brief, issueKey) {
  if (!issueKey) return null;
  return (brief?.evidencePack?.rows || []).find(
    (r) => String(r.issueKey).toUpperCase() === String(issueKey).toUpperCase(),
  ) || null;
}

export function renderFreshness(brief, confirmCount = 0) {
  const f = brief?.freshness || {};
  const text = freshnessPlainEnglish(f);
  const cls = f.confidenceLimit === 'stale' ? 'is-stale' : f.confidenceLimit === 'live' ? 'is-live' : 'is-cached';
  const reviewBit = confirmCount > 0
    ? ` · <button type="button" class="gov-freshness-review-link" id="gov-freshness-review">${confirmCount} claim${confirmCount > 1 ? 's' : ''} to review</button>`
    : '';
  govPage.els.freshness.innerHTML = `<span class="governance-freshness-pill ${cls}">${escapeHtml(text)}${reviewBit}</span>`;
  govPage.els.freshness.querySelector('#gov-freshness-review')?.addEventListener('click', () => {
    govPage.inboxApi?.openQueueTab?.('confirm');
  });
}

function renderProofRisks(risks) {
  govPage.proofRisks = risks;
  if (!risks.length) {
    govPage.els.proofRisks.innerHTML = '<p class="governance-empty">Nothing needs attention in this window.</p>';
    return;
  }
  const items = risks.map((r, idx) => {
    const ev = evidenceRowFor(govPage.lastBrief, r.issueKey);
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
          ${r.issueKey ? `<button type="button" class="btn btn-link btn-compact" data-nudge="${idx}">${escapeHtml(COPY.draftNudge)}</button>` : ''}
          <button type="button" class="btn btn-link btn-compact" data-mark-wrong="${idx}">${escapeHtml(COPY.markAsWrong)}</button>
          <button type="button" class="btn btn-link btn-compact" data-why="${idx}" aria-expanded="false">Why flagged?</button>
        </div>
        <div class="gov-mark-wrong-panel" data-wrong-panel="${idx}" hidden></div>
        <div class="governance-risk-detail" data-detail="${idx}" hidden>${renderStructuredEvidence(ev, r)}</div>
      </li>`;
  }).join('');
  govPage.els.proofRisks.innerHTML = `<ol class="governance-risk-list">${items}</ol>`;
}

function renderEvidenceTable(brief) {
  const rows = brief?.evidencePack?.rows || [];
  if (!rows.length) {
    govPage.els.evidence.innerHTML = '<p class="governance-empty">No proof rows for flagged items.</p>';
    return;
  }
  const body = rows.map((r) => `
    <tr>
      <td><a href="/governance#gov-risk-${escapeHtml(r.issueKey)}">${escapeHtml(r.issueKey)}</a></td>
      <td>${escapeHtml(r.statusNow || '')}</td>
      <td>${escapeHtml(r.statusLastWeek || '')}</td>
      <td>${escapeHtml(r.whyFlagged || '')}</td>
    </tr>`).join('');
  govPage.els.evidence.innerHTML = `<table class="governance-evidence-table"><thead><tr><th>Issue</th><th>Status</th><th>Last week</th><th>Why</th></tr></thead><tbody>${body}</tbody></table>`;
}

function renderTechnicalDetails(brief) {
  if (!govPage.els.technical) return;
  const n = brief?.leadershipNarrative || {};
  govPage.els.technical.innerHTML = `
    <p class="governance-empty" style="margin-top:8px;font-size:0.78rem;">
      Technical: Brief ${escapeHtml(brief.briefId || '')} · narrated by ${escapeHtml(brief?.meta?.narratedBy || 'template')}
      ${n.whatChanged ? ` · ${escapeHtml(n.whatChanged)}` : ''}
    </p>`;
}

function renderReadiness(brief) {
  const po = brief?.poReadiness;
  if (!po) { govPage.els.readiness.innerHTML = ''; return; }
  const s = po.signals || {};
  const chips = Object.entries(s)
    .filter(([, v]) => Number(v) > 0)
    .map(([label, v]) => `<span class="governance-readiness-chip">${escapeHtml(label)}: ${escapeHtml(String(v))}</span>`).join('');
  govPage.els.readiness.innerHTML = `
    <h3 class="governance-subsection-title">${escapeHtml(COPY.backlogReadiness)}</h3>
    <p class="governance-readiness-label">${escapeHtml(po.readinessLabel || '')}</p>
    <div class="governance-readiness-chips">${chips || '<span class="governance-empty">No signals.</span>'}</div>`;
}

function renderBaseline(brief) {
  const b = brief?.baselineComparison;
  if (!b) { govPage.els.baseline.innerHTML = ''; return; }
  const s = b.summary || {};
  govPage.els.baseline.innerHTML = `
    <h3 class="governance-subsection-title">${escapeHtml(COPY.planVsNow)}${b.piName ? ' · ' + escapeHtml(b.piName) : ''}</h3>
    <div class="governance-truth-grid">
      ${truthChip('Delivered', s.delivered, 'good')}
      ${truthChip('On track', s.onTrack, '')}
      ${truthChip('Delayed', s.delayed, s.delayed > 0 ? 'warn' : '')}
    </div>`;
}

export async function renderScorecard() {
  if (!govPage.els.scorecard) return;
  let summary = { byMetric: {}, total: 0 };
  try {
    const res = await fetch(`/api/governance/adoption-metrics.json?project=${encodeURIComponent(projectsCsv().split(',')[0] || '')}`);
    if (res.ok) summary = await res.json();
  } catch (_) { /* empty */ }
  govPage.els.scorecard.innerHTML = summary.total
    ? `<p class="governance-empty">Pilot metrics: ${summary.total} entries logged.</p>`
    : '<p class="governance-empty">No pilot data yet.</p>';
}

function showError(message) {
  govPage.els.error.hidden = false;
  govPage.els.error.textContent = message;
}

export function renderBriefUi(brief) {
  govPage.lastBrief = brief;
  govPage.lastSurfaces = partitionBriefSurfaces(brief);
  govPage.ownerGroups = groupDoNowByOwner(govPage.lastSurfaces.drawerIssues);
  if (govPage.els.piStripMount) {
    govPage.els.piStripMount.innerHTML = renderPIConfidenceStrip(brief);
    bindEpicHygieneInteractions(govPage.els.piStripMount, brief);
    govPage.els.piStripMount.querySelector('#gov-pi-fix-baseline')?.addEventListener('click', () => {
      govPage.scopeBarApi?.expandScopePanel?.();
      govPage.scopeBarApi?.openBaselineWizard?.();
    });
  }
  if (govPage.els.workerReceiptMount) govPage.els.workerReceiptMount.innerHTML = renderWorkerReceiptRail(brief, govPage.lastFeedbackSummary);
  if (govPage.els.answerMount) {
    const hasOwnerClusters = (govPage.ownerGroups || []).length > 0;
    govPage.els.answerMount.innerHTML = renderCommandAnswerBar(brief, govPage.lastSurfaces, { hasOwnerClusters });
    bindCommandOverflowMenu(govPage.els.answerMount);
  }
  if (govPage.els.epicHygieneMount) govPage.els.epicHygieneMount.innerHTML = '';
  if (govPage.els.setupDebtMount) {
    govPage.els.setupDebtMount.innerHTML = renderSetupDebtStrip(brief);
    bindSetupDebtStripExpand(govPage.els.setupDebtMount);
  }
  if (govPage.els.verdictMount) {
    govPage.els.verdictMount.innerHTML = isPortfolioMode(brief)
      ? renderPortfolioGrid(brief)
      : renderVerdictZone(brief);
    if (isPortfolioMode(brief)) {
      bindRiskHeatInteractions(govPage.els.verdictMount, brief, (_keys, squad) => {
        const risks = (squad?.cardRisks || []).map((r) => ({ issueKey: r.issueKey, evidence: r.displayTitle }));
        openEvidenceDrawer(brief, risks);
      });
    }
  }
  if (govPage.els.actionClustersMount) {
    govPage.els.actionClustersMount.innerHTML = renderOwnerActionClusters(brief, govPage.ownerGroups);
    bindOwnerClusterInteractions();
  }
  if (govPage.els.scriptMount) govPage.els.scriptMount.innerHTML = renderMeetingScript(brief);
  if (govPage.els.microSurveyMount) renderGovernanceMicroSurvey(govPage.els.microSurveyMount, projectsCsv().split(',')[0] || 'MPSA');
  if (govPage.els.measurementMount) {
    const measurementHtml = renderMeasurementStrip(brief, govPage.lastSurfaces);
    govPage.els.measurementMount.innerHTML = measurementHtml;
    govPage.els.measurementMount.hidden = !measurementHtml;
  }
  renderProofRisks(govPage.lastSurfaces.proofRows);
  renderEvidenceTable(brief);
  renderTechnicalDetails(brief);
  renderReadiness(brief);
  renderBaseline(brief);
  bindProofInteractions();
  wireGovernanceIssuePreview(brief, document);
  bindHoverProofCards(document, brief);
  if (!document.body?.classList?.contains('governance-page')) {
    updateGlobalAgentBar(brief);
    updateStickyMicroAnswer(brief);
  }
  refreshScopeBarCounts();
  const createBtn = document.getElementById('gov-hidden-create-work');
  if (createBtn) createBtn.setAttribute('data-outcome-projects', projectsCsv());
  const tier = verdictTierFromBrief(brief);
  const inboxTotal = govPage.inboxApi?.getInboxTotal?.() || brief?.meta?.workerReceipt?.inboxTotal || 0;
  govPage.scopeBarApi?.updateStatus?.(tier, inboxTotal, brief?.meta?.sinceLastRun?.summary || '');
  const warnCards = (brief?.meta?.scopeIntelligence?.cards || []).filter((c) => c.health && c.health !== 'ok').length;
  govPage.scopeBarApi?.setAdvancedWarnCount?.(warnCards);
  setBriefNavBadge(inboxTotal);
  mountFeedbackLabButton(govPage.els.feedbackLabMount, projectsCsv().split(',')[0], govPage.lastFeedbackSummary);
}

export async function loadBrief() {
  govPage.els.error.hidden = true;
  const seq = ++loadBriefSeq;
  const quarter = govPage.scopeBarApi?.getQuarterLabel?.() || '';
  const qs = new URLSearchParams({ projects: projectsCsv() });
  if (quarter) qs.set('quarter', quarter);
  const pk = projectsCsv().split(',')[0] || 'MPSA';
  try {
    const [briefRes, feedbackRes] = await Promise.all([
      fetch(`/api/governance-brief.json?${qs.toString()}`),
      fetch(`/api/governance/feedback-summary.json?projects=${encodeURIComponent(pk)}`),
    ]);
    if (seq !== loadBriefSeq) return;
    if (!briefRes.ok) throw new Error(`HTTP ${briefRes.status}`);
    govPage.lastBrief = await briefRes.json();
    govPage.lastFeedbackSummary = feedbackRes.ok ? await feedbackRes.json() : null;
    await govPage.inboxApi?.refresh?.();
    if (seq !== loadBriefSeq) return;
    const confirmCount = govPage.inboxApi?.getConfirmCount?.() || 0;
    renderFreshness(govPage.lastBrief, confirmCount);
    renderBriefUi(govPage.lastBrief);
    await renderScorecard();
    if (seq !== loadBriefSeq) return;
    document.getElementById('gov-open-feedback-lab-inline')?.addEventListener('click', () => {
      document.getElementById('gov-open-feedback-lab')?.click();
    });
  } catch (err) {
    showError(`Could not load the brief: ${err.message}`);
  }
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

export async function copyBrief() {
  if (!govPage.lastBrief) return;
  try {
    const impact = await fetchImpactSection();
    await navigator.clipboard.writeText(briefToMarkdown(govPage.lastBrief, projectsCsv(), impact));
    govPage.els.export.textContent = 'Copied';
    setTimeout(() => { govPage.els.export.textContent = COPY.exportBrief; }, 1500);
  } catch (_) {
    govPage.els.export.textContent = 'Copy failed';
  }
}
