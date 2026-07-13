/**

 * Portfolio command surface render plugin — signal, commitments, actions, carousel, decision.

 */

import { renderPortfolioSignal, renderPortfolioDataTrust } from './Delivera-App-Portfolio-Signal-01Render-UI.js';

import { renderPortfolioCommitments } from './Delivera-App-Portfolio-Commitments-01Render-UI.js';
import { renderWhatChangedTimeline } from './Delivera-App-Portfolio-WhatChanged-01Render-UI.js';
import { renderPortfolioPreparedActions } from './Delivera-App-Portfolio-PreparedActions-01Render-UI.js';
import { shouldHidePreparedActionsSection, applyHonestTrustClamp, enrichComparisonForDiffOnly } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';

import { renderPortfolioCarousel, bindPortfolioCarousel } from './Delivera-App-Portfolio-Comparison-01Carousel-UI.js';
import { renderGovernancePrioritySurface, bindGovernancePrioritySurface } from './Delivera-App-Governance-PrioritySurface-01Render-UI.js';
import { bindHoverProofCards } from './Delivera-App-Governance-Brief-22Render-HoverProofCards-UI.js';
import { rememberSurfaceHtml, clearInstantShell } from './Delivera-Shared-Instant-Shell-01UI.js';
import {
  renderPortfolioDecisionPanel,
  bindPortfolioDecisionPanel,
} from './Delivera-App-Portfolio-Decision-01Panel-UI.js';
import { openPortfolioCalibrationDrawer, buildCalibrationDefenseText } from './Delivera-App-Portfolio-Actions-01Bridge.js';
import { writeTextToClipboardWithFallback } from './Delivera-Shared-Clipboard-01Bridge.js';
import { openEvidenceDrawer } from './Delivera-App-Governance-Brief-16Render-EvidenceDrawer-UI.js';
import { focusProofRail } from './Delivera-App-Governance-Brief-Page-05Render-Evidence-Sections-UI.js';

import { openPortfolioTrustDrawer } from './Delivera-App-Portfolio-Trust-01Drawer-UI.js';

import { mountPortfolioAiAgentBadge } from './Delivera-App-Portfolio-AI-Agent-01Badge-UI.js';

import { govPage, $ } from './Delivera-Governance-Brief-Page-01Context.js';

import {

  readPortfolioAnchor,

  readPortfolioBaselineMode,

} from './Delivera-App-Governance-Brief-ScopeBar-03Shared-Kernel-SSOT.js';

import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';

import { fetchJson, showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';

import { setBriefNavBadge } from './Delivera-Shared-Global-Nav.js';

import { hideGovernanceLoading } from './Delivera-Governance-Brief-Page-02Loading-State.js';
import { fetchPortfolioDecisionCached } from './Delivera-Shared-Portfolio-Decision-Client-Cache-01Bridge.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { ensureLegacyBriefSurfacesHydrated } from './Delivera-Governance-Brief-Page-03Load-Controller.js';
import { mountPiFocusStrip } from './Delivera-App-Governance-PIFocus-01Strip-Render-UI.js';
import { openPiBaselineWizard } from './Delivera-Governance-Brief-Page-01Context.js';



function readCompareProjects(anchor = '') {

  const projects = readSharedProjectsCsv();

  const A = String(anchor || '').toUpperCase();

  return projects.filter((p) => String(p).toUpperCase() !== A);

}



async function fetchPortfolioPayload(brief, cases = [], { force = false } = {}) {
  const anchor = readPortfolioAnchor(brief?.projects || readSharedProjectsCsv());
  const compare = readCompareProjects(anchor);
  const periodKey = govPage.scopeBarApi?.getQuarterLabel?.() || brief?.meta?.quarter || '';
  const baselineMode = govPage.scopeBarApi?.getBaselineMode?.() || readPortfolioBaselineMode();
  const gaps = brief?.meta?.setupGaps || [];
  const baselineMissing = gaps.some((g) => g.action === 'set-baseline') || baselineMode === 'none';
  const partialSquads = (brief?.squadInsights || []).filter((s) => !s.boardResolved).length;
  const briefId = String(brief?.meta?.briefId || brief?.generatedAt || '').slice(0, 64);

  const networkFetcher = async (opts = {}) => {
    try {
      return await fetchJson('/api/governance/portfolio-decision.json', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          brief: opts.brief ?? brief,
          anchor: opts.anchor ?? anchor,
          compare: opts.compare ?? compare,
          periodKey: opts.periodKey ?? periodKey,
          baseline: opts.baselineMode ?? baselineMode,
          baselineMissing: opts.baselineMissing ?? baselineMissing,
          partialSquads: opts.partialSquads ?? partialSquads,
          cases: opts.cases ?? cases,
          refresh: opts.refresh ? '1' : undefined,
        }),
      }, 'portfolio-decision');
    } catch (err) {
      return {
        decision: {
          headline: anchor ? `${anchor} needs scope and proof confirmation` : 'Portfolio signal',
          summary: 'Portfolio comparison is loading — refresh if this persists.',
          metrics: {
            delivery: { value: 0, peerMedian: 0 },
            offPlanLoad: { value: 0, peerMedian: 0 },
            proofConfidence: { value: 0, peerMedian: 0 },
          },
          trust: { liveCases: cases.length, nudgesReady: 0, proofLevel: 'Low' },
          drivers: [],
          affectedCommitments: [],
          preparedActions: { groups: [], items: [] },
          decisionOptions: [{ id: 'keep-funding', label: 'Keep funding', useWhen: 'Scope is confirmed', effect: 'No change', impactPreview: 'Confirm scope first.' }],
          anchorProject: anchor,
          periodKey,
          monitoring: { squadCount: compare.length + 1, commitmentCount: 0, exposedCommitmentCount: 0 },
          recommendation: { label: 'Confirm scope and proof before investment review' },
          narrative: { headline: 'Confirm scope and proof', mainIssue: 'Data loading' },
          aboveFold: { exposedCommitments: 0, actionsReady: 0, poResponsesRequired: 0 },
        },
        comparison: { cards: [], actionsStrip: {} },
        cases,
        error: err?.message,
      };
    }
  };

  const { payload } = await fetchPortfolioDecisionCached({
    anchor,
    compare,
    periodKey,
    briefId,
    brief,
    baselineMode,
    baselineMissing,
    partialSquads,
    cases,
    fetcher: networkFetcher,
    force,
  });
  return payload;
}



async function handlePortfolioDelegatedClick(ev) {

  const formatBtn = ev.target.closest('[data-calibration-format]');
  if (formatBtn) {
    ev.preventDefault();
    formatBtn.parentElement?.querySelectorAll('[data-calibration-format]').forEach((b) => b.classList.toggle('is-active', b === formatBtn));
    return;
  }

  const commitmentRow = ev.target.closest('.portfolio-commitment-row[data-commitment-issue]');
  if (commitmentRow && commitmentRow.getAttribute('data-commitment-issue')) {
    const issueKey = commitmentRow.getAttribute('data-commitment-issue');
    if (issueKey && govPage.lastBrief) {
      ev.preventDefault();
      openEvidenceDrawer(govPage.lastBrief, [{ issueKey }]);
      return;
    }
  }

  const btn = ev.target.closest('[data-portfolio-action], [data-portfolio-restore-comparison]');

  if (!btn || btn.tagName === 'A') return;

  // Audit fix: "Back to comparison" restores the pre-drill multi-squad scope.
  if (btn.hasAttribute('data-portfolio-restore-comparison')) {
    ev.preventDefault();
    govPage.scopeBarApi?.restoreComparison?.();
    govPage._portfolioBriefToken = null;
    if (govPage.lastBrief) await refreshPortfolioSurface(govPage.lastBrief, govPage.lastPortfolioCases);
    return;
  }

  const action = btn.getAttribute('data-portfolio-action');

  const decision = govPage.lastPortfolioDecision || {};

  const cases = govPage.lastPortfolioCases || [];

  if (action === 'review-actions' || action === 'view-prepared-items') {
    openPortfolioCalibrationDrawer(decision, cases);
  } else if (action === 'check-jira-connection') {
    showInlineToast(document.body, 'Open Settings → Integrations to verify Jira board sync for stalled squads.', 'info');
    window.location.href = '/settings#integrations';
  } else if (action === 'view-governance-evidence') {
    const brief = govPage.lastBrief || {};
    const rail = document.getElementById('gov-right-rail-proof-mount');
    if (rail && !rail.hidden && rail.querySelector('[data-direct-value="evidence"], .gov-evidence-preview')) {
      focusProofRail(rail);
      return;
    }
    openEvidenceDrawer(brief, brief?.evidencePack?.rows || [], { skipLegacyFlag: true, docked: true });
  } else if (action === 'calibration-defense' || action === 'copy-calibration-defense' || action === 'copy-evidence-summary') {
    ensureLegacyBriefSurfacesHydrated();
    const format = document.querySelector('[data-calibration-format].is-active')?.getAttribute('data-calibration-format') || 'successfactors';
    const prefix = format === 'hr-review'
      ? 'HR Review format\n'
      : format === 'hod-briefing'
        ? 'HOD Briefing format\n'
        : '';
    const text = `${prefix}${buildCalibrationDefenseText(govPage.lastBrief || {}, decision)}`;
    writeTextToClipboardWithFallback(text).then(() => {
      showInlineToast(document.getElementById('main-content'), 'Evidence summary copied', 'info');
    }).catch(() => {
      openPortfolioCalibrationDrawer(decision, cases);
    });
  } else if (action === 'how-ai-decides') openPortfolioTrustDrawer(decision);
  else if (action === 'expand-commitments') {
    const overflow = btn.closest('.portfolio-commitments-more')?.querySelector('.portfolio-commitments-overflow');
    if (overflow) {
      overflow.hidden = false;
      btn.hidden = true;
    }
  }

}



export async function refreshPortfolioSurface(brief, cases = govPage.lastPortfolioCases || []) {
  if (!brief) return;
  try {
  govPage.scopeBarApi?.setCacheUxState?.({ fresh: false, updating: true });
  const payload = await fetchPortfolioPayload(brief, cases);
  let { decision = {}, comparison = {}, cases: payloadCases = cases, meta = payload?.meta || {} } = payload;
  comparison = enrichComparisonForDiffOnly(comparison);
  const honest = applyHonestTrustClamp(brief, decision);
  decision = honest.decision;
  if (honest.brief?.leadershipNarrative && govPage.lastBrief?.leadershipNarrative) {
    govPage.lastBrief.leadershipNarrative.confidence = honest.brief.leadershipNarrative.confidence;
  }
  govPage.lastPortfolioMeta = meta;

  govPage.lastPortfolioDecision = decision;
  govPage.lastDecision = decision;
  govPage.lastPortfolioComparison = comparison;

  govPage.lastPortfolioCases = payloadCases;

  const priorityBriefOnly = document.body?.classList?.contains('governance-priority-brief-page');
  const prioritySurfaceMount = document.getElementById('governance-priority-surface-mount');
  if (prioritySurfaceMount) {
    const decisionWithComparison = { ...decision, comparison };
    prioritySurfaceMount.innerHTML = renderGovernancePrioritySurface(decisionWithComparison, brief, { cases: payloadCases });
    prioritySurfaceMount.setAttribute('data-gov-priority-rendered', '1');
    bindGovernancePrioritySurface(prioritySurfaceMount, {
      brief,
      onInspectEvidence: (b) => {
        openEvidenceDrawer(b || brief || govPage.lastBrief || {}, (b || brief || govPage.lastBrief)?.evidencePack?.rows || [], {
          skipLegacyFlag: true,
          docked: true,
        });
      },
    });
    clearInstantShell();
    rememberSurfaceHtml('governance', prioritySurfaceMount.innerHTML, {
      scopeLabel: decision.anchorProject || brief?.projects?.[0] || '',
    });
  }

  const signalMount = $('portfolio-signal-mount');
  const commitmentsMount = $('portfolio-commitments-mount');
  const preparedMount = $('portfolio-prepared-actions-mount');
  const carouselMount = $('portfolio-carousel-mount');
  const decisionMount = $('portfolio-decision-mount');
  const footerMount = $('portfolio-monitor-footer');
  const railCommitmentsMount = $('portfolio-rail-commitments-mount');

  // Priority-brief page already paints signal/commitments/prepared into the
  // visible surface. Skip hidden mounts so they cannot layer/cover live UI.
  if (!priorityBriefOnly && signalMount) {
    signalMount.innerHTML = renderPortfolioSignal(decision, {
      cachedAt: meta.cachedAt,
      cached: meta.cached,
      brief,
    });
    signalMount.setAttribute('data-portfolio-signal-ready', '1');
    mountPiFocusStrip(brief, signalMount, { openPiBaselineWizard });
    if (payload.error) {
      signalMount.insertAdjacentHTML('afterbegin', `<p class="portfolio-signal-error" role="alert">${escapeHtml(String(payload.error))}</p>`);
    }
  } else if (priorityBriefOnly && prioritySurfaceMount) {
    mountPiFocusStrip(brief, prioritySurfaceMount, { openPiBaselineWizard });
  }

  if (!priorityBriefOnly && commitmentsMount) {
    commitmentsMount.innerHTML = renderPortfolioCommitments(decision);
  }

  if (railCommitmentsMount) railCommitmentsMount.innerHTML = renderWhatChangedTimeline(brief, decision);

  if (!priorityBriefOnly && preparedMount) {
    const hidePrepared = shouldHidePreparedActionsSection(decision, brief);
    preparedMount.innerHTML = hidePrepared ? '' : renderPortfolioPreparedActions(decision);
    preparedMount.hidden = hidePrepared;
  }

  // P1 FIX: Pass commitment rows to the carousel so each bento card can show
  // its own PI commitments on mouse-over expand. Also enrich cards with
  // linkedCount, totalCommitments, and daysRemaining for the new bento metrics.
  const commitmentRows = decision.priorityBrief?.detailRows || [];
  const timebox = decision.timebox || {};
  const daysRemaining = Number(timebox.remainingDays) || 0;
  const enrichedComparison = {
    ...comparison,
    cards: (comparison.cards || []).map((card) => {
      const cardCommitments = commitmentRows.filter((row) =>
        String(row.projectKey || '').toUpperCase() === String(card.projectKey || '').toUpperCase()
      );
      const linkedCount = cardCommitments.filter((r) => r.issueKey && r.reality !== 'Unlinked').length;
      return {
        ...card,
        linkedCount,
        totalCommitments: cardCommitments.length || Number(card.metrics?.commitments) || 0,
        daysRemaining,
      };
    }),
  };
  const carouselHtml = (enrichedComparison.cards || []).length
    ? renderPortfolioCarousel(enrichedComparison, { commitmentRows })
    : '';

  // Edge case: systemic risk banner (3+ squads at risk)
  const atRiskCount = (comparison.cards || []).filter((c) => c.statusClass === 'at-risk').length;
  // BONUS EDGE CASE: Also trigger for 2+ squads at 0% delivered — possible
  // shared root cause (e.g. shared dependency, org change, Jira outage).
  const zeroDeliveredCount = (comparison.cards || []).filter((c) => {
    const d = Number(c.metrics?.delivered) || 0;
    return d === 0;
  }).length;
  const systemicBanner = (atRiskCount >= 3 || zeroDeliveredCount >= 2)
    ? `<div class="portfolio-systemic-risk-banner" role="alert" data-testid="portfolio-systemic-risk-banner">⚠️ <strong>${zeroDeliveredCount >= 2 ? `${zeroDeliveredCount} squads at 0% delivered` : `${atRiskCount} squads at risk`}</strong> — possible shared root cause. Consider escalating to leadership instead of fixing each squad individually.</div>`
    : '';

  // Edge case: stale data banner (>24h since last sync)
  const lastSync = decision.dataTrust?.lastSync || '';
  const staleBanner = (meta.cachedAt && Date.now() - new Date(meta.cachedAt).getTime() > 24 * 60 * 60 * 1000)
    ? `<div class="portfolio-stale-data-banner" role="alert" data-testid="portfolio-stale-data-banner">📊 <strong>Data stale</strong> — last sync was over 24h ago. Decisions may be based on outdated information.</div>`
    : '';

  // Edge case: single squad selected (no peers to compare)
  const singleSquadBanner = (comparison.cards || []).length === 1
    ? `<div class="portfolio-single-squad-deep-dive" data-testid="portfolio-single-squad-mode">
        <div class="portfolio-single-squad-banner">
          <p class="portfolio-changelog-summary">Single squad deep dive — <strong>${escapeHtml(comparison.cards[0]?.squadName || comparison.cards[0]?.projectKey || 'squad')}</strong> only.</p>
          <button type="button" class="btn btn-secondary btn-compact" data-portfolio-restore-comparison data-testid="portfolio-restore-comparison">← Back to comparison</button>
        </div>
      </div>`
    : '';

  // Edge case: zero squads selected (empty onboarding)
  const emptyOnboarding = !(comparison.cards || []).length && !carouselHtml
    ? `<div class="portfolio-empty-onboarding" data-testid="portfolio-empty-onboarding"><p class="portfolio-empty-onboarding-title">Welcome — select your first squad</p><p class="portfolio-empty-onboarding-hint">Pick a squad to see delivery health, proof confidence, and investment posture.</p></div>`
    : '';

  const bindCarousel = (mount) => {
    if (!mount || !carouselHtml) return;
    bindPortfolioCarousel(mount, {
      onSelectSquad: async (projectKey) => {
        if (!projectKey) return;
        govPage.scopeBarApi?.setAnchor?.(projectKey);
        govPage._portfolioBriefToken = null;
        await refreshPortfolioSurface(brief, govPage.lastPortfolioCases);
      },
      onDrillIntoSquad: async (projectKey) => {
        if (!projectKey) return;
        govPage.scopeBarApi?.drillIntoSquad?.(projectKey);
        govPage._portfolioBriefToken = null;
        await refreshPortfolioSurface(govPage.lastBrief || brief, govPage.lastPortfolioCases);
      },
    });
    bindHoverProofCards(mount, govPage.lastBrief || brief || {});
  };

  const isWideDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 1440px)').matches;

  // P0 FIX: Stop duplicate carousel render. Previously the carousel was
  // rendered into BOTH the hidden portfolio-carousel-mount AND the visible
  // priority surface slot — causing duplicate DOM, double-binding, and
  // wasted cycles. Now render ONLY into the visible slot when it exists;
  // fall back to the legacy mount only when there's no priority surface.
  const priorityCarouselSlot = prioritySurfaceMount?.querySelector('[data-priority-carousel-slot]');
  if (priorityCarouselSlot && carouselHtml) {
    priorityCarouselSlot.innerHTML = systemicBanner + staleBanner + singleSquadBanner + carouselHtml;
    bindCarousel(priorityCarouselSlot);
  } else if (carouselMount) {
    if (!carouselHtml) {
      carouselMount.innerHTML = emptyOnboarding;
      carouselMount.hidden = false;
    } else {
      carouselMount.hidden = false;
      carouselMount.innerHTML = systemicBanner + staleBanner + singleSquadBanner + carouselHtml;
      bindCarousel(carouselMount);
    }
  }
  void isWideDesktop; // retained for future responsive gating without rail duplication

  if (decisionMount && !priorityBriefOnly) {

    decisionMount.innerHTML = renderPortfolioDecisionPanel(decision, brief);
    const freshness = meta.cachedAt ? '' : (decision.dataTrust?.lastSync || 'Live');
    decisionMount.insertAdjacentHTML('beforeend', renderPortfolioDataTrust(decision, freshness));

    bindPortfolioDecisionPanel(decisionMount, async (decisionId) => {

      try {

        await fetchJson('/api/governance/portfolio-decision/confirm', {

          method: 'POST',

          headers: { 'content-type': 'application/json' },

          body: JSON.stringify({

            project: decision.anchorProject,

            periodKey: decision.periodKey,

            decisionId,

          }),

        }, 'portfolio-decision-confirm');

        showInlineToast(document.getElementById('main-content'), 'Portfolio decision recorded', 'info');

        await refreshPortfolioSurface(brief, govPage.lastPortfolioCases);

      } catch (err) {

        showInlineToast(document.getElementById('main-content'), err?.message || 'Could not record decision', 'error');

      }

    });

  }

  if (footerMount) {
    footerMount.innerHTML = '';
    footerMount.hidden = true;
  }



  await mountPortfolioAiAgentBadge(document.getElementById('portfolio-signal-ai-mount'), decision, { compact: true });

  govPage.scopeBarApi?.setCacheUxState?.({
    fresh: !meta.cached,
    updating: false,
    cachedAt: meta.cachedAt,
  });
  // Refresh time-box + since-last-check + status pill in the scope bar with the new decision data.
  govPage.scopeBarApi?.refreshCapsule?.();

  document.getElementById('main-content')?.classList.add('portfolio-shell--active');
  try {
    document.body.classList.toggle(
      'portfolio-rail-visible',
      Boolean(decisionMount?.querySelector('.portfolio-decision, #portfolio-decision')),
    );
  } catch (_) { /* ignore */ }

  document.title = 'Portfolio | Delivera';

  } finally {
    hideGovernanceLoading();
    document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'content');
  }
}



let portfolioHooked = false;



export function installPortfolioSurfaceHook() {

  if (portfolioHooked || !document.getElementById('portfolio-signal-mount')) return;

  portfolioHooked = true;

  document.getElementById('main-content')?.addEventListener('click', handlePortfolioDelegatedClick);

  window.addEventListener('delivera:scope-changed', () => {

    govPage._portfolioBriefToken = null;

    if (govPage.lastBrief) refreshPortfolioSurface(govPage.lastBrief, govPage.lastPortfolioCases);

  });

  document.addEventListener('gov:open-alignment-studio', () => {
    openPiBaselineWizard({ initialMode: 'slide' });
  });

  window.addEventListener('portfolio:decision-revalidated', async (ev) => {
    const payload = ev?.detail?.payload;
    if (!payload?.decision || !govPage.lastBrief) return;
    govPage.lastPortfolioDecision = payload.decision;
    govPage.lastDecision = payload.decision;
    govPage.lastPortfolioMeta = { ...(govPage.lastPortfolioMeta || {}), ...(payload.meta || {}), cached: false };
    await refreshPortfolioSurface(govPage.lastBrief, govPage.lastPortfolioCases || []);
    govPage.scopeBarApi?.setCacheUxState?.({ fresh: true, updating: false });
  });

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('flash') === 'leadership-merged') {
      showInlineToast(document.getElementById('main-content'), 'Leadership view now lives in Portfolio decisions.', 'info');
      params.delete('flash');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash || ''}`;
      window.history.replaceState({}, '', next);
    }
    if (params.get('openAlignment') === '1' || params.get('openAlignment') === 'slide') {
      const mode = params.get('openAlignment') === 'slide' ? { initialMode: 'slide' } : {};
      queueMicrotask(() => openPiBaselineWizard(mode));
    }
  } catch (_) { /* ignore */ }

}



/** @deprecated Use refreshPortfolioSurface */

export const refreshPortfolio = refreshPortfolioSurface;

/**
 * Instant cached shell — paints the previous portfolio decision payload
 * from the in-memory cache so the page feels instant on reload/scope-switch,
 * before the network revalidation arrives. Falls back to a skeleton when no
 * cached decision exists yet.
 *
 * This closes the audit finding "no instant cached shell on load": the load
 * controller imported these symbols but they were never defined, which threw
 * a TypeError and aborted loadBrief() before the cached brief could render.
 */
export function paintPortfolioFromCache(cachedBrief = {}) {
  const priorityBriefOnly = document.body?.classList?.contains('governance-priority-brief-page');
  const signalMount = $('portfolio-signal-mount');
  const commitmentsMount = $('portfolio-commitments-mount');
  const preparedMount = $('portfolio-prepared-actions-mount');
  const carouselMount = $('portfolio-carousel-mount');
  const decisionMount = $('portfolio-decision-mount');
  const railCommitmentsMount = $('portfolio-rail-commitments-mount');

  const decision = govPage.lastPortfolioDecision;
  const matchesScope = decision && cachedBrief?.projects
    && briefMatchesRequestedScope(cachedBrief, decision.anchorProject);
  if (!decision || !matchesScope) {
    paintPortfolioBentoSkeleton(cachedBrief);
    return;
  }

  const prioritySurfaceMount = document.getElementById('governance-priority-surface-mount');
  if (prioritySurfaceMount) {
    const decisionWithComparison = { ...decision, comparison: govPage.lastPortfolioComparison || {} };
    prioritySurfaceMount.innerHTML = renderGovernancePrioritySurface(decisionWithComparison, cachedBrief, { cases: govPage.lastPortfolioCases || [] });
    prioritySurfaceMount.setAttribute('data-gov-priority-rendered', '1');
    prioritySurfaceMount.setAttribute('data-gov-priority-cached', '1');
    bindGovernancePrioritySurface(prioritySurfaceMount);
    clearInstantShell();
    rememberSurfaceHtml('governance', prioritySurfaceMount.innerHTML, {
      scopeLabel: decision.anchorProject || cachedBrief?.projects?.[0] || '',
    });
  }

  if (!priorityBriefOnly && signalMount) {
    signalMount.innerHTML = renderPortfolioSignal(decision, {
      cachedAt: govPage.lastPortfolioMeta?.cachedAt || '',
      cached: true,
      brief: cachedBrief,
    });
    signalMount.setAttribute('data-portfolio-signal-ready', '1');
    signalMount.setAttribute('data-portfolio-signal-cached', '1');
  }
  if (!priorityBriefOnly && commitmentsMount) {
    commitmentsMount.innerHTML = renderPortfolioCommitments(decision);
  }
  if (railCommitmentsMount) railCommitmentsMount.innerHTML = renderWhatChangedTimeline(cachedBrief, decision);
  if (!priorityBriefOnly && preparedMount) {
    const hidePrepared = shouldHidePreparedActionsSection(decision, cachedBrief);
    preparedMount.innerHTML = hidePrepared ? '' : renderPortfolioPreparedActions(decision);
    preparedMount.hidden = hidePrepared;
  }
  if (!priorityBriefOnly && decisionMount) {
    decisionMount.innerHTML = renderPortfolioDecisionPanel(decision, cachedBrief)
      + renderPortfolioDataTrust(decision, decision.dataTrust?.lastSync || 'Cached');
  }
  if (!priorityBriefOnly && carouselMount && !carouselMount.querySelector('[data-portfolio-carousel-ready]')) {
    carouselMount.hidden = false;
    carouselMount.innerHTML = '<div class="portfolio-carousel-cache-placeholder" data-testid="portfolio-carousel-cache-placeholder" aria-label="Comparison refreshing">Refreshing squad comparison…</div>';
  }
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'content');
}

/**
 * Bento skeleton — instant structural placeholder so the page never shows an
 * empty/loading void while the first payload is fetched. Mirrors the real
 * surface layout (signal + commitments + decision + rail) with shimmer rows.
 */
export function paintPortfolioBentoSkeleton(seed = {}) {
  const projects = Array.isArray(seed?.projects) ? seed.projects : [];
  const anchor = (projects[0] || readPortfolioAnchor() || 'Squad').toString().toUpperCase();
  const peerCount = Math.max(0, projects.length - 1);

  const skeleton = `
    <div class="gov-priority-surface gov-priority-surface--skeleton" data-testid="governance-priority-surface" data-governance-surface="priority-brief" aria-busy="true">
      <div class="gov-priority-cockpit-grid gov-priority-hero-grid">
        <div class="gov-priority-cockpit-main">
          <div class="gov-priority-brief-hero gov-priority-brief-hero--skeleton">
            <div class="gov-skeleton-headline"></div>
            <div class="gov-skeleton-metrics"></div>
            <div class="gov-skeleton-rows">
              <div class="gov-skeleton-row"></div>
              <div class="gov-skeleton-row gov-skeleton-row--short"></div>
            </div>
            <p class="gov-skeleton-label">Loading ${escapeHtml(anchor)} delivery answer…</p>
          </div>
        </div>
        <aside class="gov-priority-cockpit-rail">
          <div class="gov-priority-rail-card" aria-hidden="true">
            <div class="gov-skeleton-headline"></div>
            <div class="gov-skeleton-rows">
              <div class="gov-skeleton-row"></div>
              <div class="gov-skeleton-row gov-skeleton-row--short"></div>
            </div>
          </div>
        </aside>
      </div>
    </div>`;

  const surfaceMount = document.getElementById('governance-priority-surface-mount');
  if (surfaceMount) surfaceMount.innerHTML = skeleton;

  const signalMount = $('portfolio-signal-mount');
  if (signalMount) {
    signalMount.hidden = false;
    signalMount.removeAttribute('data-portfolio-signal-ready');
    signalMount.innerHTML = `<div class="portfolio-signal-skeleton" data-testid="portfolio-signal-skeleton" aria-label="Portfolio signal loading">
      <div class="gov-skeleton-headline"></div>
      <div class="gov-skeleton-metrics"></div>
      <div class="gov-skeleton-rows">
        <div class="gov-skeleton-row"></div>
        <div class="gov-skeleton-row"></div>
        <div class="gov-skeleton-row gov-skeleton-row--short"></div>
      </div>
    </div>`;
  }
  const carouselMount = $('portfolio-carousel-mount');
  if (carouselMount) {
    carouselMount.hidden = false;
    const peerLabel = peerCount > 0 ? `${peerCount + 1} squads` : 'squad';
    carouselMount.innerHTML = `<div class="portfolio-carousel-skeleton" data-testid="portfolio-carousel-skeleton" aria-label="Squad comparison loading">
      <div class="gov-skeleton-rows">
        ${Array.from({ length: Math.max(1, Math.min(4, projects.length || 1)) })
          .map(() => '<div class="gov-skeleton-row portfolio-carousel-skeleton-card"></div>')
          .join('')}
      </div>
      <p class="gov-skeleton-label">Loading ${escapeHtml(peerLabel)}…</p>
    </div>`;
  }
  const decisionMount = $('portfolio-decision-mount');
  if (decisionMount) {
    decisionMount.innerHTML = `<div class="portfolio-decision-skeleton" data-testid="portfolio-decision-skeleton" aria-label="Decision panel loading">
      <div class="gov-skeleton-headline"></div>
      <div class="gov-skeleton-rows">
        <div class="gov-skeleton-row"></div>
        <div class="gov-skeleton-row gov-skeleton-row--short"></div>
      </div>
    </div>`;
  }
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'loading');
}

function briefMatchesRequestedScope(brief, anchor) {
  if (!brief || !anchor) return false;
  const projects = readSharedProjectsCsv();
  return projects.some((p) => String(p).toUpperCase() === String(anchor).toUpperCase());
}


