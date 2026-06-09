/**
 * Governance brief — load, render surfaces, export/copy helpers.
 */
import { partitionBriefSurfaces, groupDoNowByOwner } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';
import { renderVerdictZone } from './Delivera-App-Governance-Brief-07Render-VerdictZone-UI.js';
import { renderPortfolioGrid } from './Delivera-App-Governance-Brief-12Render-PortfolioGrid-UI.js';
import { bindPortfolioHeatMap } from './Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js';
import { renderMeasurementStrip } from './Delivera-App-Governance-Brief-10Render-MeasurementStrip-UI.js';
import { renderMeetingScript } from './Delivera-App-Governance-Brief-11Render-MeetingScript-UI.js';
import { renderCommandAnswerBar, bindCommandOverflowMenu } from './Delivera-App-Governance-Brief-13Render-CommandAnswerBar-UI.js';
import { renderWorkerReceiptRail } from './Delivera-App-Governance-Brief-14Render-WorkerReceipt-UI.js';
import { renderOwnerActionClusters } from './Delivera-App-Governance-Brief-15Render-OwnerActionCluster-UI.js';
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';
import { renderSetupDebtStrip, bindSetupDebtStripExpand } from './Delivera-App-Governance-Brief-17Render-SetupDebtStrip-UI.js';
import { escapeHtml, briefToMarkdown } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import {
  renderProofRisks, renderEvidenceTable, renderTechnicalDetails,
  renderReadiness, renderBaseline, deferScorecardUntilEvidenceOpen, mountEvidenceTabShell,
} from './Delivera-App-Governance-Brief-Page-05Render-Evidence-Sections-UI.js';
import { COPY, freshnessPlainEnglish, verdictTierFromBrief } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import { setBriefNavBadge } from './Delivera-Shared-Global-Nav.js';
import { wireGovernanceIssuePreview } from './Delivera-Shared-Issue-Preview-01Bridge.js';
import { renderGovernanceMicroSurvey } from './Delivera-App-Governance-Brief-12Render-MicroSurvey-UI.js';
import { renderPICompactBadge, renderPIConfidenceStrip } from './Delivera-App-Governance-Brief-19Render-PIConfidenceStrip-UI.js';
import { bindEpicHygieneInteractions } from './Delivera-App-Governance-Brief-20Render-EpicHygienePanel-UI.js';
import { bindHoverProofCards } from './Delivera-App-Governance-Brief-22Render-HoverProofCards-UI.js';
import { mountFeedbackLabButton } from './Delivera-App-Governance-Brief-21Render-FeedbackImprovementCenter-UI.js';
import { updateGlobalAgentBar, updateStickyMicroAnswer } from './Delivera-App-Governance-GlobalAgentBar-01UI.js';
import {
  govPage, openPiBaselineWizard, projectsCsv, selectedProjects, isPortfolioMode, refreshScopeBarCounts,
} from './Delivera-Governance-Brief-Page-01Context.js';
import { bindOwnerClusterInteractions, bindProofInteractions } from './Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js';
import {
  fetchGovernanceBriefCached, peekGovernanceBriefCache, briefMatchesProjects,
} from './Delivera-Shared-Brief-Client-Cache-01Bridge.js';
import {
  showGovernanceLoading, hideGovernanceLoading, hasGovernanceBriefContent,
} from './Delivera-Governance-Brief-Page-02Loading-State.js';

let loadBriefSeq = 0;
let loadBriefForce = false;

export function setLoadBriefForce(force = true) {
  loadBriefForce = Boolean(force);
}

export function renderFreshness(brief, confirmCount = 0) {
  if (document.querySelector('#gov-scope-bar-mount .gov-scope-status-chip')) {
    govPage.els.freshness.innerHTML = '';
    return;
  }
  const f = brief?.freshness || {};
  const text = freshnessPlainEnglish(f);
  const cls = f.confidenceLimit === 'stale' ? 'is-stale' : f.confidenceLimit === 'live' ? 'is-live' : 'is-cached';
  const reviewBit = confirmCount > 0
    ? ` · <button type="button" class="gov-freshness-review-link" id="gov-freshness-review">${confirmCount} claim${confirmCount > 1 ? 's' : ''} to review</button>`
    : '';
  const shortText = text.length > 72 ? `${text.slice(0, 69)}…` : text;
  govPage.els.freshness.innerHTML = `<span class="governance-freshness-pill ${cls} governance-freshness-pill--ellipsis" title="${escapeHtml(text)}">${escapeHtml(shortText)}${reviewBit}</span>`;
  govPage.els.freshness.querySelector('#gov-freshness-review')?.addEventListener('click', () => {
    govPage.inboxApi?.openQueueTab?.('confirm');
  });
}

function showError(message) {
  hideGovernanceLoading();
  govPage.els.error.hidden = false;
  govPage.els.error.textContent = message;
  if (govPage.els.export) govPage.els.export.hidden = true;
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'error');
}

function applyBriefToUi(brief, feedbackSummary = null) {
  if (!brief) return false;
  govPage.lastFeedbackSummary = feedbackSummary;
  const confirmCount = govPage.inboxApi?.getConfirmCount?.() || 0;
  renderFreshness(brief, confirmCount);
  renderBriefUi(brief);
  deferScorecardUntilEvidenceOpen();
  hideGovernanceLoading();
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'content');
  return true;
}

export function renderBriefUi(brief) {
  const scopeKeys = selectedProjects(brief);
  govPage.lastBrief = brief;
  govPage.lastSurfaces = partitionBriefSurfaces(brief, scopeKeys);
  govPage.ownerGroups = groupDoNowByOwner(govPage.lastSurfaces.drawerIssues);
  const hasOwnerClusters = (govPage.ownerGroups || []).length > 0;
  document.getElementById('main-content')?.classList.toggle('governance-shell--has-clusters', hasOwnerClusters);
  if (govPage.els.piStripMount) {
    const piInner = renderPIConfidenceStrip(brief);
    const compactBadge = renderPICompactBadge(brief);
    const rollupBehind = Number(brief?.portfolioRollup?.behindPiCount || 0) > 0;
    govPage.els.piStripMount.innerHTML = (hasOwnerClusters && rollupBehind)
      ? ''
      : (hasOwnerClusters && piInner
        ? `${compactBadge}<details class="gov-pi-strip-fold"><summary>PI confidence</summary>${piInner}</details>`
        : piInner);
    bindEpicHygieneInteractions(govPage.els.piStripMount, brief);
    govPage.els.piStripMount.querySelector('#gov-pi-fix-baseline')?.addEventListener('click', () => {
      openPiBaselineWizard();
    });
  }
  if (govPage.els.workerReceiptMount) govPage.els.workerReceiptMount.innerHTML = renderWorkerReceiptRail(brief, govPage.lastFeedbackSummary);
  if (govPage.els.answerMount) {
    const tier = verdictTierFromBrief(brief);
    const promotedScript = tier === 'blocked' ? renderMeetingScript(brief) : '';
    govPage.els.answerMount.innerHTML = renderCommandAnswerBar(brief, govPage.lastSurfaces, { hasOwnerClusters })
      + (promotedScript ? `<div class="gov-promoted-meeting-script" data-promoted-script="1">${promotedScript}</div>` : '');
    bindCommandOverflowMenu(govPage.els.answerMount);
    govPage.els.answerMount.querySelector('#gov-export-overflow')?.addEventListener('click', copyBrief);
  }
  if (govPage.els.actionClustersMount) {
    govPage.els.actionClustersMount.innerHTML = renderOwnerActionClusters(brief, govPage.ownerGroups);
    bindOwnerClusterInteractions();
  }
  if (govPage.els.setupDebtMount) {
    govPage.els.setupDebtMount.innerHTML = renderSetupDebtStrip(brief, { compact: hasOwnerClusters });
    bindSetupDebtStripExpand(govPage.els.setupDebtMount, brief);
  }
  if (govPage.els.verdictMount) {
    const squadCount = selectedProjects(brief).length;
    const showHeatMap = isPortfolioMode(brief) || squadCount === 1;
    const verdictInner = showHeatMap
      ? renderPortfolioGrid(brief, { singleSquad: squadCount === 1 })
      : renderVerdictZone(brief);
    const verdictSummary = showHeatMap ? 'Portfolio heat map' : 'Squad verdict';
    const skipStandaloneVerdict = !showHeatMap && !hasOwnerClusters;
    const inlineVerdict = showHeatMap && squadCount === 1;
    govPage.els.verdictMount.innerHTML = skipStandaloneVerdict
      ? ''
      : (inlineVerdict
        ? verdictInner
        : (hasOwnerClusters
          ? `<details class="gov-verdict-fold"><summary>${verdictSummary}</summary>${verdictInner}</details>`
          : verdictInner));
    if (showHeatMap) bindPortfolioHeatMap(govPage.els.verdictMount, brief);
  }
  if (govPage.els.scriptMount) {
    const scriptHtml = renderMeetingScript(brief);
    govPage.els.scriptMount.innerHTML = scriptHtml;
    govPage.els.scriptMount.hidden = !scriptHtml;
  }
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
  mountEvidenceTabShell();
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
  const confirmCount = govPage.inboxApi?.getConfirmCount?.() || 0;
  govPage.scopeBarApi?.updateStatus?.(tier, inboxTotal, brief?.meta?.sinceLastRun?.summary || '', confirmCount);
  const warnCards = (brief?.meta?.scopeIntelligence?.cards || []).filter((c) => c.health && c.health !== 'ok').length;
  govPage.scopeBarApi?.setAdvancedWarnCount?.(warnCards);
  setBriefNavBadge(inboxTotal);
  const topChrome = document.getElementById('gov-top-chrome-mount');
  const hasReceipt = Boolean(govPage.els.workerReceiptMount?.innerHTML?.trim());
  if (topChrome) {
    topChrome.classList.toggle('gov-top-chrome--has-queue', inboxTotal > 0);
    topChrome.classList.toggle('gov-top-chrome--has-receipt', hasReceipt);
  }
  mountFeedbackLabButton(govPage.els.feedbackLabMount, projectsCsv().split(',')[0], govPage.lastFeedbackSummary);
  const secondaryChrome = document.getElementById('gov-secondary-chrome');
  if (secondaryChrome) {
    secondaryChrome.classList.toggle('gov-secondary-chrome--has-content',
      Boolean(govPage.els.feedbackLabMount?.innerHTML?.trim() || govPage.els.microSurveyMount?.innerHTML?.trim()));
  }
  try {
    if (new URLSearchParams(window.location.search).get('lens') === 'investment') {
      openEvidenceDrawer(brief, [], { initialTab: 'investment' });
    }
  } catch (_) { /* ignore */ }
}

export async function loadBrief(options = {}) {
  const force = options.force === true || loadBriefForce;
  loadBriefForce = false;
  govPage.els.error.hidden = true;
  if (govPage.els.export) govPage.els.export.hidden = false;
  const seq = ++loadBriefSeq;
  const requested = projectsCsv();
  const quarter = govPage.scopeBarApi?.getQuarterLabel?.() || '';
  const periodWindow = govPage.scopeBarApi?.getPeriodWindow?.() || '28d';
  const pk = requested.split(',')[0] || 'MPSA';
  const preserve = hasGovernanceBriefContent();
  showGovernanceLoading(
    preserve ? 'Refreshing… showing previous answer until live data arrives.' : 'Loading your delivery answer…',
    { preserveContent: preserve },
  );
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'loading');

  const cached = !force ? peekGovernanceBriefCache(requested, quarter) : null;
  if (cached && briefMatchesProjects(cached, requested)) {
    applyBriefToUi(cached, govPage.lastFeedbackSummary);
  }

  try {
    const inboxRefresh = govPage.inboxApi?.refresh?.();
    const [brief, feedbackRes] = await Promise.all([
      fetchGovernanceBriefCached({ projects: requested, quarter, periodWindow, force }),
      fetch(`/api/governance/feedback-summary.json?projects=${encodeURIComponent(pk)}`),
      inboxRefresh,
    ]);
    if (seq !== loadBriefSeq) return;
    if (!brief || !briefMatchesProjects(brief, requested)) return;
    govPage.lastBrief = brief;
    govPage.lastFeedbackSummary = feedbackRes.ok ? await feedbackRes.json() : null;
    if (seq !== loadBriefSeq) return;
    applyBriefToUi(brief, govPage.lastFeedbackSummary);
    if (seq !== loadBriefSeq) return;
    document.getElementById('gov-open-feedback-lab-inline')?.addEventListener('click', () => {
      document.getElementById('gov-open-feedback-lab')?.click();
    });
  } catch (err) {
    if (seq !== loadBriefSeq) return;
    if (!govPage.lastBrief) showError(`Could not load the brief: ${err.message}`);
    else hideGovernanceLoading();
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
