/**
 * Governance brief — load, render surfaces, export/copy helpers.
 */
import { partitionBriefSurfaces, groupDoNowByOwner } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';
import { renderVerdictZone } from './Delivera-App-Governance-Brief-07Render-VerdictZone-UI.js';
import { renderPortfolioGrid, renderCompareRail } from './Delivera-App-Governance-Brief-12Render-PortfolioGrid-UI.js';
import { bindPortfolioHeatMap, ensurePortfolioHeatDelegation } from './Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js';
import { renderMeasurementStrip } from './Delivera-App-Governance-Brief-10Render-MeasurementStrip-UI.js';
import { renderMeetingScript } from './Delivera-App-Governance-Brief-11Render-MeetingScript-UI.js';
import { renderCommandAnswerBar, bindCommandOverflowMenu } from './Delivera-App-Governance-Brief-13Render-CommandAnswerBar-UI.js';
import { renderWorkerReceiptRail } from './Delivera-App-Governance-Brief-14Render-WorkerReceipt-UI.js';
import { renderOwnerActionClusters } from './Delivera-App-Governance-Brief-15Render-OwnerActionCluster-UI.js';
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';
import { renderSetupDebtStrip, bindSetupDebtStripExpand } from './Delivera-App-Governance-Brief-17Render-SetupDebtStrip-UI.js';
import { escapeHtml, briefToMarkdown } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import {
  renderProofRisks, renderEvidenceTable, renderEvidencePreview, renderTechnicalDetails,
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
import { resolveAiTrustDisplay } from './Delivera-AI-Trust-Display-01SSOT.js';
import { updateGlobalAgentBar, updateStickyMicroAnswer } from './Delivera-App-Governance-GlobalAgentBar-01UI.js';
import { readSharedProjectsCsv, PROJECTS_SSOT_KEY } from './Delivera-Shared-Storage-Keys.js';
import {
  govPage, openPiBaselineWizard, projectsCsv, selectedProjects, isPortfolioMode, refreshScopeBarCounts,
} from './Delivera-Governance-Brief-Page-01Context.js';
import { bindOwnerClusterInteractions, bindProofInteractions } from './Delivera-Governance-Brief-Page-04Bind-Interactions-Controller.js';
import {
  fetchGovernanceBriefCached, peekGovernanceBriefCache, briefMatchesProjects,
} from './Delivera-Shared-Brief-Client-Cache-01Bridge.js';
import {
  showGovernanceLoading, hideGovernanceLoading, hasGovernanceBriefContent,
  setScopeStaleOverlay, clearScopeStaleOverlay,
} from './Delivera-Governance-Brief-Page-02Loading-State.js';
import { showErrorView } from './Delivera-Shared-Status-View-Helpers.js';
import { commandAnswerSentence } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';
import { writeTextToClipboardWithFallback, showClipboardFallbackSnippet } from './Delivera-Shared-Clipboard-01Bridge.js';
import { loadActiveGovernanceLoop } from './Delivera-App-Governance-ActiveLoop-01UI.js?v=20260729h';

const PI_AUTO_OPEN_KEY = 'gov-pi-auto-open-dismissed';

let loadBriefSeq = 0;
let loadBriefForce = false;
let registrySyncBound = false;

export function setLoadBriefForce(force = true) {
  loadBriefForce = Boolean(force);
}

/**
 * Listen for registry version changes from other tabs (Settings page saves).
 * When the version changes, force a brief re-fetch to pick up new participation states.
 */
export function bindRegistrySyncListener() {
  if (registrySyncBound) return;
  registrySyncBound = true;
  window.addEventListener('storage', (event) => {
    if (event.key !== 'delivera:registry-version') return;
    if (!event.newValue || event.newValue === event.oldValue) return;
    // Force a fresh brief fetch (bypasses cache) to pick up the new registry state
    setLoadBriefForce(true);
    void loadBrief({ force: true });
  });
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
  if (govPage.els.error) {
    govPage.els.error.removeAttribute('hidden');
    showErrorView({ errorEl: govPage.els.error, contentEl: document.getElementById('gov-brief-content') }, message);
  }
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'error');
}

async function applyBriefToUi(brief, feedbackSummary = null) {
  if (!brief) return false;
  govPage.lastFeedbackSummary = feedbackSummary;
  const confirmCount = govPage.inboxApi?.getConfirmCount?.() || 0;
  renderFreshness(brief, confirmCount);
  try {
    const trust = await resolveAiTrustDisplay();
    govPage.aiTrustState = trust;
  } catch (_) {
    govPage.aiTrustState = null;
  }
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
  const squadCount = selectedProjects(brief).length;
  const showHeatMap = isPortfolioMode(brief) || squadCount === 1;
  const singleSquadHero = showHeatMap && squadCount === 1;
  document.getElementById('main-content')?.classList.toggle('governance-shell--has-clusters', hasOwnerClusters);
  document.getElementById('main-content')?.classList.toggle('governance-shell--desktop-grid', true);
  document.getElementById('main-content')?.classList.toggle('governance-shell--hero-squad', singleSquadHero);
  if (govPage.els.piStripMount) {
    const gaps = brief?.meta?.setupGaps || [];
    const hasBaselineGap = gaps.some((g) => g.action === 'set-baseline');
    const piInner = renderPIConfidenceStrip(brief, { hideBaselineCta: hasBaselineGap });
    const compactBadge = renderPICompactBadge(brief);
    const rollupBehind = Number(brief?.portfolioRollup?.behindPiCount || 0) > 0;
    let piStripHtml = (hasOwnerClusters && rollupBehind)
      ? ''
      : (hasOwnerClusters && piInner
        ? `${compactBadge}<details class="gov-pi-strip-fold" open><summary>PI confidence</summary>${piInner}</details>`
        : piInner);
    if (!piStripHtml.trim() && hasBaselineGap) {
      piStripHtml = compactBadge || piInner || `<p class="gov-pi-compact-badge gov-pi-empty-cta">${escapeHtml(COPY.piBaselineNotSavedCta)}</p>`;
    }
    govPage.els.piStripMount.innerHTML = piStripHtml;
    govPage.els.piStripMount.toggleAttribute('data-pi-strip-empty', !piStripHtml.trim());
    bindEpicHygieneInteractions(govPage.els.piStripMount, brief);
    govPage.els.piStripMount.querySelector('#gov-pi-fix-baseline')?.addEventListener('click', () => {
      openPiBaselineWizard();
    });
  }
  if (govPage.els.workerReceiptMount) govPage.els.workerReceiptMount.innerHTML = renderWorkerReceiptRail(brief, govPage.lastFeedbackSummary);
  if (govPage.els.answerMount) {
    const tier = verdictTierFromBrief(brief);
    const suppressAdvisor = Boolean(
      brief?.meta?._aiProviderFallback
      || brief?.meta?._advisorError
      || govPage.aiTrustState?.suppressAdvisorBadge,
    );
    const promotedScript = tier === 'blocked' ? renderMeetingScript(brief, { openByDefault: false }) : '';
    govPage.els.answerMount.innerHTML = renderCommandAnswerBar(brief, govPage.lastSurfaces, {
      hasOwnerClusters,
      suppressAdvisorBadge: suppressAdvisor,
      hideLeadBlocker: singleSquadHero,
      collapseHeroDedupe: singleSquadHero,
    })
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
    govPage.els.setupDebtMount.querySelectorAll('[data-setup-action="create-work"]').forEach((btn) => {
      btn.setAttribute('data-outcome-projects', projectsCsv());
    });
  }
  const supportingEvidence = document.getElementById('gov-supporting-evidence');
  if (supportingEvidence) {
    if (hasOwnerClusters) {
      if (!supportingEvidence.open) supportingEvidence.open = false;
    } else if ((govPage.lastSurfaces?.proofRows || []).length > 0) {
      supportingEvidence.open = true;
    }
  }

  if (govPage.els.verdictMount) {
    const verdictInner = showHeatMap
      ? renderPortfolioGrid(brief, {
        singleSquad: squadCount === 1,
        hideSquadNudge: hasOwnerClusters && squadCount === 1,
        collapseHeroDedupe: singleSquadHero,
      })
      : renderVerdictZone(brief);
    const skipStandaloneVerdict = !showHeatMap && !hasOwnerClusters;
    govPage.els.verdictMount.innerHTML = skipStandaloneVerdict ? '' : verdictInner;
    if (singleSquadHero) govPage.els.verdictMount.setAttribute('data-hero-squad', 'true');
    else govPage.els.verdictMount.removeAttribute('data-hero-squad');
    govPage.els.verdictMount.hidden = skipStandaloneVerdict;
    if (showHeatMap) bindPortfolioHeatMap(govPage.els.verdictMount, brief);
  }
  const compareMount = document.getElementById('gov-compare-rail-mount');
  if (compareMount) {
    const compareHtml = squadCount >= 2 ? renderCompareRail(brief, scopeKeys) : '';
    compareMount.innerHTML = compareHtml;
    compareMount.toggleAttribute('hidden', !compareHtml);
  }
  if (govPage.els.scriptMount) {
    const hasPromotedScript = Boolean(govPage.els.answerMount?.querySelector('[data-promoted-script="1"]'));
    const scriptHtml = hasPromotedScript ? '' : renderMeetingScript(brief);
    govPage.els.scriptMount.innerHTML = scriptHtml;
    govPage.els.scriptMount.hidden = !scriptHtml;
  }
  if (govPage.els.microSurveyMount) renderGovernanceMicroSurvey(govPage.els.microSurveyMount, projectsCsv().split(',')[0] || 'MPSA');
  if (govPage.els.measurementMount) {
    const measurementHtml = renderMeasurementStrip(brief, govPage.lastSurfaces);
    govPage.els.measurementMount.innerHTML = measurementHtml;
    govPage.els.measurementMount.hidden = !measurementHtml;
  }
  const proofPreviewMount = document.getElementById('gov-right-rail-proof-mount')
    || document.getElementById('gov-evidence-preview-mount');
  renderProofRisks(govPage.lastSurfaces.proofRows, { hideWhenPreview: Boolean(proofPreviewMount) });
  renderEvidencePreview(brief, hasOwnerClusters ? 2 : 3, proofPreviewMount);
  renderEvidenceTable(brief);
  const evidenceSummary = document.querySelector('#gov-supporting-evidence .governance-evidence-summary');
  const evidenceRows = brief?.evidencePack?.rows?.length || 0;
  if (evidenceSummary && evidenceRows > 0) {
    evidenceSummary.textContent = `Proof audit & data quality (${evidenceRows} rows)`;
  }
  renderTechnicalDetails(brief);
  renderReadiness(brief);
  renderBaseline(brief);
  mountEvidenceTabShell();
  bindProofInteractions();
  wireGovernanceIssuePreview(brief, document);
  bindHoverProofCards(document, brief);
  if (!document.body?.classList?.contains('governance-page')) {
    updateGlobalAgentBar(brief);
  }
  updateStickyMicroAnswer(brief);
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
  const rightRail = document.getElementById('gov-right-rail-mount');
  if (rightRail) {
    if (inboxTotal > 0) rightRail.setAttribute('data-right-rail-has-queue', 'true');
    else rightRail.removeAttribute('data-right-rail-has-queue');
    const hasReceipt = Boolean(govPage.els.workerReceiptMount?.innerHTML?.trim());
    if (hasReceipt) rightRail.setAttribute('data-right-rail-has-receipt', 'true');
    else rightRail.removeAttribute('data-right-rail-has-receipt');
  }
  mountFeedbackLabButton(govPage.els.feedbackLabMount, projectsCsv().split(',')[0], govPage.lastFeedbackSummary);
  const secondaryChrome = document.getElementById('gov-secondary-chrome');
  if (secondaryChrome) {
    const hasContent = Boolean(govPage.els.feedbackLabMount?.innerHTML?.trim() || govPage.els.microSurveyMount?.innerHTML?.trim());
    secondaryChrome.classList.toggle('gov-secondary-chrome--has-content', hasContent);
    if (hasContent) secondaryChrome.removeAttribute('hidden');
    else secondaryChrome.setAttribute('hidden', '');
  }
  try {
    if (new URLSearchParams(window.location.search).get('lens') === 'investment') {
      openEvidenceDrawer(brief, [], { initialTab: 'investment' });
    }
  } catch (_) { /* ignore */ }

  maybeAutoOpenPiBaseline(brief);
}

function maybeAutoOpenPiBaseline(brief) {
  const gaps = brief?.meta?.setupGaps || [];
  if (gaps.length !== 1 || gaps[0]?.action !== 'set-baseline') return;
  try {
    if (sessionStorage.getItem(PI_AUTO_OPEN_KEY) === '1') return;
  } catch (_) { /* ignore */ }
  sessionStorage.setItem(PI_AUTO_OPEN_KEY, '1');
  setTimeout(() => openPiBaselineWizard(), 400);
}

function renderNeedsScopePicker() {
  hideGovernanceLoading();
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'needs-scope');
  if (govPage.els.answerMount) {
    govPage.els.answerMount.innerHTML = `
      <section class="gov-needs-scope" aria-label="Choose squad scope">
        <p class="governance-empty">Pick at least one squad to load your delivery answer.</p>
        <button type="button" class="btn btn-primary btn-compact" id="gov-needs-scope-open">Choose scope</button>
      </section>`;
    govPage.els.answerMount.querySelector('#gov-needs-scope-open')?.addEventListener('click', () => {
      document.getElementById('gov-scope-change')?.click();
    });
  }
  govPage.scopeBarApi?.expandScopePanel?.();
}

export async function loadBrief(options = {}) {
  const force = options.force === true || loadBriefForce;
  loadBriefForce = false;
  bindRegistrySyncListener();
  govPage.els.error.hidden = true;
  if (!readSharedProjectsCsv().length) {
    try {
      if (localStorage.getItem(PROJECTS_SSOT_KEY) === '') {
        renderNeedsScopePicker();
        return;
      }
    } catch (_) { /* ignore */ }
  }
  const seq = ++loadBriefSeq;
  const requested = projectsCsv();
  const quarter = govPage.scopeBarApi?.getQuarterLabel?.() || '';
  const periodWindow = govPage.scopeBarApi?.getPeriodWindow?.() || '28d';
  // The active PI answer is an independent, cache-first read model. It must
  // paint even when the heavier legacy brief is unavailable or scope-limited.
  void loadActiveGovernanceLoop({ projects: requested, quarter, force });
  const pk = requested.split(',')[0] || 'MPSA';
  const preserve = hasGovernanceBriefContent();
  const switchingScope = preserve && govPage.lastBrief && !briefMatchesProjects(govPage.lastBrief, requested);
  const switchLabel = switchingScope ? `Switching to ${formatScopeSwitchLabel(requested)}…` : '';
  if (switchingScope) {
    setScopeStaleOverlay(true, switchLabel);
  }
  showGovernanceLoading(
    switchLabel || (preserve ? 'Refreshing… showing previous answer until live data arrives.' : 'Loading your delivery answer…'),
    { preserveContent: preserve },
  );
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'loading');

  const cached = !force ? peekGovernanceBriefCache(requested, quarter, periodWindow) : null;
  if (cached && briefMatchesProjects(cached, requested)) {
    await applyBriefToUi(cached, govPage.lastFeedbackSummary);
  }

  try {
    const inboxRefresh = govPage.inboxApi?.refresh?.();
    const [brief, feedbackRes] = await Promise.all([
      fetchGovernanceBriefCached({ projects: requested, quarter, periodWindow, force }),
      fetch(`/api/governance/feedback-summary.json?projects=${encodeURIComponent(pk)}`),
      inboxRefresh,
    ]);
    if (seq !== loadBriefSeq) return;
    if (!brief) {
      if (!govPage.lastBrief) showError('Could not load the brief for selected scope.');
      else {
        clearScopeStaleOverlay();
        hideGovernanceLoading();
      }
      return;
    }
    if (!briefMatchesProjects(brief, requested)) {
      clearScopeStaleOverlay();
      showError(`Brief data did not match selected scope (${requested}). Try Refresh.`);
      return;
    }
    govPage.lastBrief = brief;
    govPage.lastFeedbackSummary = feedbackRes.ok ? await feedbackRes.json() : null;
    if (seq !== loadBriefSeq) return;
    clearScopeStaleOverlay();
    await applyBriefToUi(brief, govPage.lastFeedbackSummary);
    if (seq !== loadBriefSeq) return;
    document.getElementById('gov-open-feedback-lab-inline')?.addEventListener('click', () => {
      document.getElementById('gov-open-feedback-lab')?.click();
    });
  } catch (err) {
    if (seq !== loadBriefSeq) return;
    clearScopeStaleOverlay();
    if (!govPage.lastBrief) showError(`Could not load the brief: ${err.message}`);
    else hideGovernanceLoading();
  }
}

function formatScopeSwitchLabel(requested) {
  const parts = String(requested || '').split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(' + ');
  return `${parts.slice(0, 2).join(' + ')} +${parts.length - 2}`;
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

export async function copyBrief(options = {}) {
  if (!govPage.lastBrief) return;
  const triggerEl = options.triggerEl || document.getElementById('gov-copy-answer-scope');
  const labelDefault = options.sentenceOnly ? 'Copy answer' : 'Copy answer';
  const text = options.sentenceOnly
    ? commandAnswerSentence(govPage.lastBrief)
    : briefToMarkdown(govPage.lastBrief, projectsCsv(), await fetchImpactSection());
  try {
    await writeTextToClipboardWithFallback(text);
    if (triggerEl) {
      const prior = triggerEl.textContent;
      triggerEl.textContent = 'Copied';
      setTimeout(() => { triggerEl.textContent = prior || labelDefault; }, 1500);
    }
  } catch (_) {
    if (triggerEl) triggerEl.textContent = 'Select text below';
    showClipboardFallbackSnippet(triggerEl?.closest('.gov-scope-actions') || govPage.els.answerMount, text.slice(0, 500));
  }
}
