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
import { mountGovernanceInterventionCases } from './Delivera-App-Governance-InterventionCase-01Render-UI.js';
import { renderOwnerActionClusters } from './Delivera-App-Governance-Brief-15Render-OwnerActionCluster-UI.js';
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';
import { renderSetupDebtStrip, bindSetupDebtStripExpand } from './Delivera-App-Governance-Brief-17Render-SetupDebtStrip-UI.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { briefToMarkdown } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
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
import { updateGlobalAgentBar } from './Delivera-App-Governance-GlobalAgentBar-01UI.js';
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
import { writeTextToClipboardWithFallback, showClipboardFallbackSnippet } from './Delivera-Shared-Clipboard-01Bridge.js';
import { commandAnswerSentence } from './Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';
import { installPortfolioSurfaceHook, refreshPortfolioSurface, paintPortfolioFromCache, paintPortfolioBentoSkeleton } from './Delivera-Governance-Brief-Page-06Portfolio-Render-Plugin.js';
import { updateInstantShellLabel } from './Delivera-Shared-Instant-Shell-01UI.js';

function resolveBaselineGapFlags(brief = {}) {
  const gaps = brief?.meta?.setupGaps || [];
  const hasBaselineGap = gaps.some((g) => g.action === 'set-baseline');
  const piFocusOwnsBaseline = brief?.meta?.piFocus?.synergy === 'low';
  return { gaps, hasBaselineGap, piFocusOwnsBaseline, hideBaselineCta: hasBaselineGap || piFocusOwnsBaseline };
}
import { seedFromBrief } from './Delivera-App-Governance-InterventionCase-02Client-SSOT.js';
import { readPortfolioAnchor, readPeriodWindow } from './Delivera-App-Governance-Brief-ScopeBar-03Shared-Kernel-SSOT.js';

let legacyBriefSurfacesHydrated = false;
let legacyHydratedBriefKey = '';

function legacyBriefHydrationKey(brief) {
  if (!brief) return '';
  const scope = selectedProjects(brief).join(',');
  return `${brief.briefId || ''}|${scope}|${brief.generatedAt || ''}`;
}

/** Lightweight context for portfolio path — no legacy DOM paint until drawer/nudge needs it. */
function prepareLegacyBriefContext(brief) {
  if (!document.getElementById('portfolio-signal-mount')) return;
  const scopeKeys = selectedProjects(brief);
  govPage.lastSurfaces = partitionBriefSurfaces(brief, scopeKeys);
  govPage.ownerGroups = groupDoNowByOwner(govPage.lastSurfaces?.drawerIssues || []);
}

function patchLegacySecondaryChrome(brief) {
  if (!document.getElementById('portfolio-signal-mount') || !brief) return;
  if (govPage.els.workerReceiptMount) {
    govPage.els.workerReceiptMount.innerHTML = renderWorkerReceiptRail(brief, govPage.lastFeedbackSummary);
  }
  mountFeedbackLabButton(govPage.els.feedbackLabMount, projectsCsv().split(',')[0], govPage.lastFeedbackSummary);
  const secondaryChrome = document.getElementById('gov-secondary-chrome');
  if (secondaryChrome) {
    const hasContent = Boolean(govPage.els.feedbackLabMount?.innerHTML?.trim() || govPage.els.microSurveyMount?.innerHTML?.trim());
    secondaryChrome.classList.toggle('gov-secondary-chrome--has-content', hasContent);
    secondaryChrome.classList.toggle('gov-secondary-chrome--open', hasContent);
    if (hasContent) {
      secondaryChrome.removeAttribute('hidden');
      secondaryChrome.setAttribute('open', '');
    }
  }
}

export function ensureLegacyBriefSurfacesHydrated(brief = govPage.lastBrief) {
  if (!brief || !document.getElementById('portfolio-signal-mount')) return;
  try {
    if (sessionStorage.getItem('delivera:legacy-brief-needed') !== '1') return;
  } catch (_) { return; }
  const hydrationKey = legacyBriefHydrationKey(brief);
  if (legacyBriefSurfacesHydrated && legacyHydratedBriefKey === hydrationKey) {
    patchLegacySecondaryChrome(brief);
    return;
  }
  legacyBriefSurfacesHydrated = true;
  legacyHydratedBriefKey = hydrationKey;
  hydrateHiddenLegacyBriefSurfaces(brief);
}

export function resetLegacyBriefHydration() {
  legacyBriefSurfacesHydrated = false;
  legacyHydratedBriefKey = '';
}

function hydrateHiddenLegacyBriefSurfaces(brief) {
  if (!document.getElementById('portfolio-signal-mount')) return;
  // Legacy mounts were removed from governance.html — this function now safely no-ops
  // on the portfolio page. All rendering is handled by refreshPortfolioSurface().
  // Legacy hydration only fires when sessionStorage['delivera:legacy-brief-needed'] === '1',
  // which is set by drawer/evidence open actions that create their mounts dynamically.
  prepareLegacyBriefContext(brief);
  const scopeKeys = selectedProjects(brief);
  const squadCount = scopeKeys.length;
  const showHeatMap = isPortfolioMode(brief) || squadCount >= 1;
  const { hasBaselineGap, piFocusOwnsBaseline, hideBaselineCta } = resolveBaselineGapFlags(brief);
  if (govPage.els.verdictMount && showHeatMap) {
    govPage.els.verdictMount.innerHTML = renderPortfolioGrid(brief, {
      singleSquad: squadCount === 1,
      hideSquadNudge: false,
      hideBaselineCta,
    });
    bindPortfolioHeatMap(govPage.els.verdictMount, brief);
    ensurePortfolioHeatDelegation();
  }
  const hasOwnerClusters = (govPage.ownerGroups || []).length > 0;
  document.getElementById('main-content')?.classList.toggle('governance-shell--has-clusters', hasOwnerClusters);
  if (govPage.els.actionClustersMount) {
    govPage.els.actionClustersMount.innerHTML = hasOwnerClusters
      ? renderOwnerActionClusters(brief, govPage.ownerGroups)
      : '';
    if (hasOwnerClusters) bindOwnerClusterInteractions();
  }
  if (govPage.els.piStripMount) {
    const piInner = renderPIConfidenceStrip(brief, { hideBaselineCta: hasBaselineGap || piFocusOwnsBaseline });
    const compactBadge = renderPICompactBadge(brief);
    const rollupBehind = Number(brief?.portfolioRollup?.behindPiCount || 0) > 0;
    let piStripHtml = (hasOwnerClusters && rollupBehind)
      ? ''
      : (hasOwnerClusters && piInner
        ? `${compactBadge}<details class="gov-pi-strip-fold" open><summary>PI confidence</summary>${piInner}</details>`
        : piInner);
    if (!piStripHtml.trim() && (hasBaselineGap || piInner || compactBadge)) {
      piStripHtml = compactBadge || piInner || '';
    }
    if (!piStripHtml.trim() && piInner) {
      piStripHtml = `<details class="gov-pi-strip-fold" open><summary>PI confidence</summary>${piInner}</details>`;
    }
    govPage.els.piStripMount.innerHTML = piStripHtml;
    bindEpicHygieneInteractions(govPage.els.piStripMount, brief);
    govPage.els.piStripMount.querySelector('#gov-pi-fix-baseline')?.addEventListener('click', () => {
      openPiBaselineWizard({ initialMode: 'slide' });
    });
  }
  const supportingEvidence = document.getElementById('gov-supporting-evidence');
  if (supportingEvidence) {
    if (hasOwnerClusters) supportingEvidence.removeAttribute('open');
    supportingEvidence.hidden = false;
  }
  mountEvidenceTabShell();
  // Brief-mode scope bar is obsolete on priority-brief HTML (portfolio mount is SSOT).
  // Do not revive zombie #gov-scope-bar-mount mounts.
  const compareMount = document.getElementById('gov-compare-rail-mount');
  if (compareMount) {
    const compareHtml = squadCount >= 2 ? renderCompareRail(brief, scopeKeys, { hideBaselineCta: hasBaselineGap || piFocusOwnsBaseline }) : '';
    compareMount.innerHTML = compareHtml;
    compareMount.toggleAttribute('hidden', !compareHtml);
  }  if (govPage.els.answerMount) {
    const tier = verdictTierFromBrief(brief);
    const suppressAdvisor = Boolean(
      brief?.meta?._aiProviderFallback
      || brief?.meta?._advisorError
      || govPage.aiTrustState?.suppressAdvisorBadge,
    );
    const promotedScript = tier === 'blocked' ? renderMeetingScript(brief, { promoted: true }) : '';
    govPage.els.answerMount.innerHTML = renderCommandAnswerBar(brief, govPage.lastSurfaces, {
      hasOwnerClusters,
      suppressAdvisorBadge: suppressAdvisor,
      hideLeadBlocker: squadCount === 1,
      collapseHeroDedupe: squadCount === 1,
    })
      + (promotedScript ? `<div class="gov-promoted-meeting-script" data-promoted-script="1">${promotedScript}</div>` : '');
    bindCommandOverflowMenu(govPage.els.answerMount);
  }
  if (govPage.els.setupDebtMount) {
    govPage.els.setupDebtMount.innerHTML = renderSetupDebtStrip(brief, { compact: hasOwnerClusters });
    bindSetupDebtStripExpand(govPage.els.setupDebtMount, brief);
  }
  if (govPage.els.workerReceiptMount) {
    govPage.els.workerReceiptMount.innerHTML = renderWorkerReceiptRail(brief, govPage.lastFeedbackSummary);
  }
  if (govPage.els.microSurveyMount) {
    renderGovernanceMicroSurvey(govPage.els.microSurveyMount, projectsCsv().split(',')[0] || 'MPSA');
  }
  mountFeedbackLabButton(govPage.els.feedbackLabMount, projectsCsv().split(',')[0], govPage.lastFeedbackSummary);
  const secondaryChrome = document.getElementById('gov-secondary-chrome');
  if (secondaryChrome) {
    const hasContent = Boolean(govPage.els.feedbackLabMount?.innerHTML?.trim() || govPage.els.microSurveyMount?.innerHTML?.trim());
    secondaryChrome.classList.toggle('gov-secondary-chrome--has-content', hasContent);
    secondaryChrome.classList.toggle('gov-secondary-chrome--open', hasContent);
    if (hasContent) {
      secondaryChrome.removeAttribute('hidden');
      secondaryChrome.setAttribute('open', '');
    }
  }
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
  const proofPreviewMount = document.getElementById('gov-right-rail-proof-mount');
  const issueKeys = (brief?.evidencePack?.rows || []).map((r) => r.issueKey).filter(Boolean);
  if (issueKeys.length && proofPreviewMount) {
    renderProofRisks(govPage.lastSurfaces.proofRows, { hideWhenPreview: Boolean(proofPreviewMount) });
    if (isDesktop) {
      renderEvidencePreview(brief, hasOwnerClusters ? 2 : 3, proofPreviewMount);
      proofPreviewMount.hidden = false;
    }
    const rightRail = document.getElementById('gov-right-rail-mount');
    if (rightRail && (proofPreviewMount?.innerHTML?.trim() || govPage.inboxApi?.getInboxTotal?.())) {
      rightRail.removeAttribute('hidden');
    }
  }
  renderEvidenceTable(brief);
  renderTechnicalDetails(brief);
  renderReadiness(brief);
  renderBaseline(brief);
  bindProofInteractions();
  wireGovernanceIssuePreview(brief, document);
}
const PI_AUTO_OPEN_KEY = 'gov-pi-auto-open-dismissed';

let loadBriefSeq = 0;
let loadBriefForce = false;
// Track the last-loaded scope+period signature so that onScopeChange only
// forces a network refresh when the scope ACTUALLY changed. This prevents
// redundant recalculation on page reloads where the scope bar's
// ensurePortfolioDefaultScope() writes the default scope (all squads) and
// triggers notifyScopeChanged() → onScopeChange → loadBrief({force:true}).
// (Audit finding: "it makes no sense that we are having to make all these
// calculations again while we already did it a few loads ago".)
let lastLoadedSignature = '';

export function setLoadBriefForce(force = true) {
  loadBriefForce = Boolean(force);
}

import { shouldSkipFreshnessRender } from './Delivera-App-Governance-Freshness-01SSOT.js';

export { shouldSkipFreshnessRender } from './Delivera-App-Governance-Freshness-01SSOT.js';

export function renderFreshness(brief, confirmCount = 0) {
  if (!govPage.els.freshness) return;
  const scopeHasStatusChip = Boolean(document.querySelector(
    '#portfolio-scope-bar-mount .gov-scope-status-chip, #gov-scope-bar-mount .gov-scope-status-chip',
  ));
  if (shouldSkipFreshnessRender({ freshnessEl: govPage.els.freshness, scopeHasStatusChip })) {
    if (govPage.els.freshness) govPage.els.freshness.innerHTML = '';
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
  const isPortfolioPage = Boolean(document.getElementById('portfolio-signal-mount'));
  renderBriefUi(brief);

  if (isPortfolioPage) {
    // Progressive paint: show priority surface as soon as brief JSON is available,
    // then enrich with seeded intervention cases on a second pass.
    void (async () => {
      try {
        const trust = await resolveAiTrustDisplay();
        govPage.aiTrustState = trust;
      } catch (_) {
        govPage.aiTrustState = null;
      }
      patchLegacySecondaryChrome(brief);
      updateInstantShellLabel('Building decisions…');
      try {
        await refreshPortfolioSurface(brief, []);
      } catch (_) { /* first paint is best-effort */ }
      try {
        const anchor = readPortfolioAnchor(brief?.projects);
        const periodKey = govPage.scopeBarApi?.getQuarterLabel?.() || brief?.meta?.quarter || '';
        const seeded = await seedFromBrief({
          brief,
          projectsCsv: projectsCsv(),
          periodKey,
          anchorOnly: anchor,
        });
        govPage.lastPortfolioCases = seeded.cases || [];
      } catch (_) { /* first paint already shown */ }
      try {
        await refreshPortfolioSurface(brief, govPage.lastPortfolioCases || []);
      } catch (_) {
        await refreshPortfolioSurface(brief, []);
      }
    })();
  } else {
    try {
      const trust = await resolveAiTrustDisplay();
      govPage.aiTrustState = trust;
    } catch (_) {
      govPage.aiTrustState = null;
    }
    deferScorecardUntilEvidenceOpen();
    hideGovernanceLoading();
    document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'content');
  }
  return true;
}

export function renderBriefUi(brief) {
  const scopeKeys = selectedProjects(brief);
  govPage.lastBrief = brief;
  const isPortfolioPage = Boolean(document.getElementById('portfolio-signal-mount'));
  if (isPortfolioPage) {
    const tier = verdictTierFromBrief(brief);
    const inboxTotal = govPage.inboxApi?.getInboxTotal?.() || brief?.meta?.workerReceipt?.inboxTotal || 0;
    const confirmCount = govPage.inboxApi?.getConfirmCount?.() || 0;
    govPage.scopeBarApi?.updateStatus?.(tier, inboxTotal, brief?.meta?.sinceLastRun?.summary || '', confirmCount);
    refreshScopeBarCounts();
    prepareLegacyBriefContext(brief);
    govPage._portfolioBriefToken = null;
    return;
  }
  govPage.lastSurfaces = partitionBriefSurfaces(brief, scopeKeys);
  govPage.ownerGroups = groupDoNowByOwner(govPage.lastSurfaces.drawerIssues);
  const hasOwnerClusters = (govPage.ownerGroups || []).length > 0;
  const squadCount = selectedProjects(brief).length;
  const showHeatMap = isPortfolioMode(brief) || squadCount === 1;
  const singleSquadHero = showHeatMap && squadCount === 1;
  const { hasBaselineGap, piFocusOwnsBaseline, hideBaselineCta } = resolveBaselineGapFlags(brief);
  document.getElementById('main-content')?.classList.toggle('governance-shell--has-clusters', hasOwnerClusters);
  document.getElementById('main-content')?.classList.toggle('governance-shell--desktop-grid', true);
  document.getElementById('main-content')?.classList.toggle('governance-shell--hero-squad', singleSquadHero);
  if (govPage.els.piStripMount) {
    const piInner = renderPIConfidenceStrip(brief, { hideBaselineCta: hasBaselineGap || piFocusOwnsBaseline });
    const compactBadge = renderPICompactBadge(brief);
    const rollupBehind = Number(brief?.portfolioRollup?.behindPiCount || 0) > 0;
    let piStripHtml = (hasOwnerClusters && rollupBehind)
      ? ''
      : (hasOwnerClusters && piInner
        ? `${compactBadge}<details class="gov-pi-strip-fold" open><summary>PI confidence</summary>${piInner}</details>`
        : piInner);
    if (!piStripHtml.trim() && hasBaselineGap) {
      piStripHtml = compactBadge || piInner || '';
    }
    govPage.els.piStripMount.innerHTML = piStripHtml;
    govPage.els.piStripMount.toggleAttribute('data-pi-strip-empty', !piStripHtml.trim());
    bindEpicHygieneInteractions(govPage.els.piStripMount, brief);
    govPage.els.piStripMount.querySelector('#gov-pi-fix-baseline')?.addEventListener('click', () => {
      openPiBaselineWizard({ initialMode: 'slide' });
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
    const promotedScript = tier === 'blocked' ? renderMeetingScript(brief, { promoted: true }) : '';
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
    supportingEvidence.hidden = false;
  }
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

  if (govPage.els.verdictMount) {
    const verdictInner = showHeatMap
      ? renderPortfolioGrid(brief, {
        singleSquad: squadCount === 1,
        hideSquadNudge: hasOwnerClusters && squadCount === 1,
        collapseHeroDedupe: singleSquadHero,
        hideBaselineCta,
      })
      : renderVerdictZone(brief);
    const skipStandaloneVerdict = !showHeatMap && !hasOwnerClusters;
    govPage.els.verdictMount.innerHTML = skipStandaloneVerdict ? '' : verdictInner;
    if (singleSquadHero) govPage.els.verdictMount.setAttribute('data-hero-squad', 'true');
    else govPage.els.verdictMount.removeAttribute('data-hero-squad');
    govPage.els.verdictMount.hidden = skipStandaloneVerdict;
    if (showHeatMap) bindPortfolioHeatMap(govPage.els.verdictMount, brief);
  }
  if (govPage.els.interventionMount) {
    mountGovernanceInterventionCases({
      mount: govPage.els.interventionMount,
      brief,
      projectsCsv: projectsCsv(),
      periodKey: govPage.scopeBarApi?.getQuarterLabel?.() || brief?.meta?.quarter || '',
    });
  }
  const compareMount = document.getElementById('gov-compare-rail-mount');
  if (compareMount) {
    const compareHtml = squadCount >= 2 ? renderCompareRail(brief, scopeKeys, { hideBaselineCta: hasBaselineGap || piFocusOwnsBaseline }) : '';
    compareMount.innerHTML = compareHtml;
    compareMount.toggleAttribute('hidden', !compareHtml);
  }
  if (govPage.els.scriptMount) {
    const hasPromotedScript = Boolean(govPage.els.answerMount?.querySelector('[data-promoted-script="1"]'));
    const scriptHtml = hasPromotedScript ? '' : renderMeetingScript(brief, { openByDefault: isDesktop });
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
  const mainFoldProof = document.getElementById('gov-main-fold-proof');
  const issueKeys = (brief?.evidencePack?.rows || []).map((r) => r.issueKey).filter(Boolean);
  const useMainFoldProof = Boolean(isDesktop && mainFoldProof && issueKeys.length);
  if (useMainFoldProof) {
    renderEvidencePreview(brief, 4, mainFoldProof);
    if (proofPreviewMount) {
      proofPreviewMount.innerHTML = '';
      proofPreviewMount.hidden = true;
    }
    renderProofRisks(govPage.lastSurfaces.proofRows, { hideWhenPreview: true });
  } else {
    if (mainFoldProof) {
      mainFoldProof.innerHTML = '';
      mainFoldProof.hidden = true;
    }
    renderProofRisks(govPage.lastSurfaces.proofRows, { hideWhenPreview: Boolean(proofPreviewMount) });
    renderEvidencePreview(brief, hasOwnerClusters ? 2 : 3, proofPreviewMount);
  }
  renderEvidenceTable(brief);
  const evidenceSummary = document.querySelector('#gov-supporting-evidence .governance-evidence-summary');
  const evidenceRows = brief?.evidencePack?.rows?.length || 0;
  if (evidenceSummary && evidenceRows > 0) {
    evidenceSummary.textContent = `Supporting evidence (${evidenceRows} rows)`;
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
    secondaryChrome.classList.toggle('gov-secondary-chrome--open', hasContent);
    if (hasContent) {
      secondaryChrome.removeAttribute('hidden');
      secondaryChrome.setAttribute('open', '');
    } else {
      secondaryChrome.setAttribute('hidden', '');
      secondaryChrome.removeAttribute('open');
    }
  }
  document.getElementById('main-content')?.setAttribute('data-gov-layout-ready', '1');
  try {
    if (new URLSearchParams(window.location.search).get('lens') === 'investment') {
      openEvidenceDrawer(brief, [], { initialTab: 'investment' });
    }
  } catch (_) { /* ignore */ }

  maybeAutoOpenPiBaseline(brief);
}

function maybeAutoOpenPiBaseline(_brief) {
  /* User-initiated only — auto-open fails first-load modal gate and blocks compare-add. */
}

function renderNeedsScopePicker() {
  hideGovernanceLoading();
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'needs-scope');
  // Bonus edge case: on the portfolio page there is no #gov-answer-mount, so
  // the empty-scope picker previously rendered nowhere and the user saw a
  // blank loading void. Target the priority surface mount (or fall back to
  // the loading mount) so the onboarding picker always has a home.
  const targetMount = document.getElementById('governance-priority-surface-mount')
    || govPage.els.answerMount
    || document.getElementById('gov-loading');
  if (targetMount) {
    targetMount.innerHTML = `
      <section class="gov-needs-scope" aria-label="Choose squad scope" data-testid="governance-needs-scope">
        <p class="governance-empty">Pick at least one squad to load your delivery answer.</p>
        <button type="button" class="btn btn-primary btn-compact" id="gov-needs-scope-open">Choose scope</button>
      </section>`;
    targetMount.querySelector('#gov-needs-scope-open')?.addEventListener('click', () => {
      govPage.scopeBarApi?.focusScopeBar?.();
    });
  }
  govPage.scopeBarApi?.focusScopeBar?.();
}

function resolveBriefPeriodWindow() {
  const isPortfolioPage = Boolean(document.getElementById('portfolio-signal-mount'));
  const fromBar = govPage.scopeBarApi?.getPeriodWindow?.() || '';
  const stored = readPeriodWindow(isPortfolioPage ? 'pi' : '28d');
  if (!isPortfolioPage) return fromBar || stored;
  if (stored && stored !== 'pi') return stored;
  return fromBar || 'pi';
}

export async function loadBrief(options = {}) {
  const requested = projectsCsv();
  const quarter = govPage.scopeBarApi?.getQuarterLabel?.() || '';
  const periodWindow = resolveBriefPeriodWindow();
  // Compute a signature for this load request. If the scope+period hasn't
  // changed since the last successful load AND force wasn't explicitly
  // requested, skip the network refresh and serve from cache. This prevents
  // redundant recalculation on reloads where the scope bar writes the
  // default scope and triggers a spurious onScopeChange.
  const signature = `${requested}|${quarter}|${periodWindow}`;
  const scopeChanged = signature !== lastLoadedSignature;
  const explicitForce = options.force === true || loadBriefForce;
  const force = explicitForce && scopeChanged;
  loadBriefForce = false;
  if (force) resetLegacyBriefHydration();
  if (govPage.els.error) govPage.els.error.hidden = true;
  if (!readSharedProjectsCsv().length) {
    try {
      if (localStorage.getItem(PROJECTS_SSOT_KEY) === '') {
        renderNeedsScopePicker();
        return;
      }
    } catch (_) { /* ignore */ }
  }
  const seq = ++loadBriefSeq;
  const pk = requested.split(',')[0] || 'MPSA';
  const preserve = hasGovernanceBriefContent();
  const switchingScope = preserve && govPage.lastBrief && !briefMatchesProjects(govPage.lastBrief, requested);
  const switchLabel = switchingScope ? `Switching to ${formatScopeSwitchLabel(requested)}…` : '';
  const cached = !force ? peekGovernanceBriefCache(requested, quarter, periodWindow) : null;
  const isPortfolioPage = Boolean(document.getElementById('portfolio-signal-mount'));
  if (isPortfolioPage) {
    govPage.scopeBarApi?.setCacheUxState?.({
      fresh: Boolean(cached) && !force,
      updating: !cached || force,
    });
  }
  if (switchingScope) {
    resetLegacyBriefHydration();
    setScopeStaleOverlay(true, switchLabel);
  }
  if (isPortfolioPage) {
    const { showPortfolioLoading } = await import('./Delivera-Governance-Brief-Page-02Loading-State.js');
    // Stale-while-revalidate: keep last painted answer visible while scope switches.
    // Only wipe to skeleton when there is truly nothing to show.
    const hasPainted = hasGovernanceBriefContent() || Boolean(cached);
    const preservePortfolio = hasPainted && !force;
    try {
      if (!preservePortfolio) {
        paintPortfolioBentoSkeleton(cached || { projects: requested.split(',').filter(Boolean) });
      } else if (cached && briefMatchesProjects(cached, requested) && !switchingScope) {
        paintPortfolioFromCache(cached);
      }
    } catch (skeletonErr) {
      console.warn('[governance] skeleton paint failed; continuing to load', skeletonErr);
    }
    showPortfolioLoading(
      switchLabel || (cached ? 'Refreshing live signal…' : 'Loading portfolio signal…'),
      { preserveContent: preservePortfolio },
    );
    updateInstantShellLabel('Loading boards…');
  } else {
    showGovernanceLoading(
      switchLabel || (preserve ? 'Refreshing… showing previous answer until live data arrives.' : 'Loading your delivery answer…'),
      { preserveContent: preserve },
    );
  }
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'loading');

  if (cached && briefMatchesProjects(cached, requested)) {
    await applyBriefToUi(cached, govPage.lastFeedbackSummary);
  }

  try {
    void govPage.inboxApi?.refresh?.();
    const [brief, feedbackRes] = await Promise.all([
      fetchGovernanceBriefCached({ projects: requested, quarter, periodWindow, force }),
      fetch(`/api/governance/feedback-summary.json?projects=${encodeURIComponent(pk)}`),
    ]);
    if (seq !== loadBriefSeq) return;
    if (!brief) {
      if (!govPage.lastBrief) showError('Could not load the brief for selected scope.');
      else {
        clearScopeStaleOverlay();
        if (isPortfolioPage) {
          await refreshPortfolioSurface(govPage.lastBrief, govPage.lastPortfolioCases || []);
        } else {
          hideGovernanceLoading();
        }
      }
      return;
    }
    if (!briefMatchesProjects(brief, requested)) {
      clearScopeStaleOverlay();
      showError(`Brief data did not match selected scope (${requested}). Try Refresh.`);
      return;
    }
    govPage.lastBrief = brief;
    lastLoadedSignature = signature;
    govPage.lastFeedbackSummary = feedbackRes.ok ? await feedbackRes.json() : null;
    if (seq !== loadBriefSeq) return;
    clearScopeStaleOverlay();
    updateInstantShellLabel('Matching PI baselines…');
    await applyBriefToUi(brief, govPage.lastFeedbackSummary);
    if (seq !== loadBriefSeq) return;
    if (isPortfolioPage) {
      govPage.scopeBarApi?.setCacheUxState?.({ fresh: true, updating: false });
    }
    document.getElementById('gov-open-feedback-lab-inline')?.addEventListener('click', () => {
      document.getElementById('gov-open-feedback-lab')?.click();
    });
  } catch (err) {
    if (seq !== loadBriefSeq) return;
    clearScopeStaleOverlay();
    if (!govPage.lastBrief) showError(`Could not load the brief: ${err.message}`);
    else if (isPortfolioPage) {
      // Bonus edge case: network-failure graceful degradation. Keep showing
      // the last good decision instead of replacing it with an error, and
      // surface a non-blocking toast so the user knows the data is stale
      // rather than wondering silently. This maximizes trust: the user keeps
      // a usable surface and is told exactly what happened.
      await refreshPortfolioSurface(govPage.lastBrief, govPage.lastPortfolioCases || []);
      try {
        const { showInlineToast } = await import('./Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js');
        showInlineToast(document.getElementById('main-content'), 'Showing last good data — refresh failed. Retrying on next focus.', 'warning');
      } catch (_) { /* toast is best-effort */ }
    } else {
      hideGovernanceLoading();
    }
    if (isPortfolioPage) {
      govPage.scopeBarApi?.setCacheUxState?.({ fresh: Boolean(govPage.lastBrief), updating: false });
    }
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
