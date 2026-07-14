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
  gradateCardStatus,
  isAttentionStatus,
} from './Delivera-App-Portfolio-CardStatus-01Gradation-SSOT.js';
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

/**
 * Shared live+cache mount paint — priority surface, optional legacy mounts,
 * carousel slot (full HTML or cache placeholder).
 */
function paintPortfolioMounts(decision, brief, meta = {}, opts = {}) {
  const {
    comparison = {},
    cases = [],
    mode = 'live',
    payloadError = null,
    bindDecisionConfirm = false,
  } = opts;
  const priorityBriefOnly = document.body?.classList?.contains('governance-priority-brief-page');
  const prioritySurfaceMount = document.getElementById('governance-priority-surface-mount');
  const signalMount = $('portfolio-signal-mount');
  const commitmentsMount = $('portfolio-commitments-mount');
  const preparedMount = $('portfolio-prepared-actions-mount');
  const carouselMount = $('portfolio-carousel-mount');
  const decisionMount = $('portfolio-decision-mount');
  const footerMount = $('portfolio-monitor-footer');
  const railCommitmentsMount = $('portfolio-rail-commitments-mount');

  if (prioritySurfaceMount) {
    const decisionWithComparison = { ...decision, comparison };
    prioritySurfaceMount.innerHTML = renderGovernancePrioritySurface(decisionWithComparison, brief, { cases });
    prioritySurfaceMount.setAttribute('data-gov-priority-rendered', '1');
    if (mode === 'cache') prioritySurfaceMount.setAttribute('data-gov-priority-cached', '1');
    else prioritySurfaceMount.removeAttribute('data-gov-priority-cached');
    const bindOpts = mode === 'live'
      ? {
          brief,
          onInspectEvidence: (b) => {
            openEvidenceDrawer(b || brief || govPage.lastBrief || {}, (b || brief || govPage.lastBrief)?.evidencePack?.rows || [], {
              skipLegacyFlag: true,
              docked: true,
            });
          },
        }
      : undefined;
    bindGovernancePrioritySurface(prioritySurfaceMount, bindOpts);
    clearInstantShell();
    rememberSurfaceHtml('governance', prioritySurfaceMount.innerHTML, {
      scopeLabel: decision.anchorProject || brief?.projects?.[0] || '',
    });
  }

  if (!priorityBriefOnly && signalMount) {
    signalMount.innerHTML = renderPortfolioSignal(decision, {
      cachedAt: meta.cachedAt,
      cached: mode === 'cache' ? true : meta.cached,
      brief,
    });
    signalMount.setAttribute('data-portfolio-signal-ready', '1');
    if (mode === 'cache') signalMount.setAttribute('data-portfolio-signal-cached', '1');
    if (mode === 'live') {
      mountPiFocusStrip(brief, signalMount, { openPiBaselineWizard });
      if (payloadError) {
        signalMount.insertAdjacentHTML('afterbegin', `<p class="portfolio-signal-error" role="alert">${escapeHtml(String(payloadError))}</p>`);
      }
    }
  } else if (mode === 'live' && priorityBriefOnly && prioritySurfaceMount) {
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

  if (mode === 'live') {
    const commitmentRows = decision.priorityBrief?.detailRows || [];
    const daysRemaining = Number(decision.timebox?.remainingDays) || 0;
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

    const atRiskCount = (comparison.cards || []).filter((c) => {
      const g = gradateCardStatus(c, c.metrics?.delivered, c.metrics?.proofConfidence);
      return isAttentionStatus(g.statusClass);
    }).length;
    const zeroDeliveredCount = (comparison.cards || []).filter((c) => (Number(c.metrics?.delivered) || 0) === 0).length;
    const systemicBanner = (atRiskCount >= 3 || zeroDeliveredCount >= 2)
      ? `<div class="portfolio-systemic-risk-banner" role="alert" data-testid="portfolio-systemic-risk-banner">⚠️ <strong>${zeroDeliveredCount >= 2 ? `${zeroDeliveredCount} squads at 0% delivered` : `${atRiskCount} squads at risk`}</strong> — possible shared root cause. Consider escalating to leadership instead of fixing each squad individually.</div>`
      : '';
    const staleBanner = (meta.cachedAt && Date.now() - new Date(meta.cachedAt).getTime() > 24 * 60 * 60 * 1000)
      ? `<div class="portfolio-stale-data-banner" role="alert" data-testid="portfolio-stale-data-banner">📊 <strong>Data stale</strong> — last sync was over 24h ago. Decisions may be based on outdated information.</div>`
      : '';
    const singleSquadBanner = (comparison.cards || []).length === 1
      ? `<div class="portfolio-single-squad-deep-dive" data-testid="portfolio-single-squad-mode">
          <div class="portfolio-single-squad-banner">
            <p class="portfolio-changelog-summary">Single squad deep dive — <strong>${escapeHtml(comparison.cards[0]?.squadName || comparison.cards[0]?.projectKey || 'squad')}</strong> only.</p>
            <button type="button" class="btn btn-secondary btn-compact" data-portfolio-restore-comparison data-testid="portfolio-restore-comparison">← Back to comparison</button>
          </div>
        </div>`
      : '';
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

    const banners = systemicBanner + staleBanner + singleSquadBanner;
    const priorityCarouselSlot = prioritySurfaceMount?.querySelector('[data-priority-carousel-slot]');
    if (priorityCarouselSlot && carouselHtml) {
      priorityCarouselSlot.innerHTML = banners + carouselHtml;
      bindCarousel(priorityCarouselSlot);
    } else if (carouselMount) {
      carouselMount.hidden = false;
      carouselMount.innerHTML = carouselHtml ? banners + carouselHtml : emptyOnboarding;
      if (carouselHtml) bindCarousel(carouselMount);
    }
  } else if (!priorityBriefOnly && carouselMount && !carouselMount.querySelector('[data-portfolio-carousel-ready]')) {
    carouselMount.hidden = false;
    carouselMount.innerHTML = '<div class="portfolio-carousel-cache-placeholder" data-testid="portfolio-carousel-cache-placeholder" aria-label="Comparison refreshing">Refreshing squad comparison…</div>';
  }

  if (decisionMount && !priorityBriefOnly) {
    const freshness = mode === 'cache'
      ? (decision.dataTrust?.lastSync || 'Cached')
      : (meta.cachedAt ? '' : (decision.dataTrust?.lastSync || 'Live'));
    decisionMount.innerHTML = renderPortfolioDecisionPanel(decision, brief)
      + (mode === 'cache' ? renderPortfolioDataTrust(decision, freshness) : '');
    if (mode === 'live') {
      decisionMount.insertAdjacentHTML('beforeend', renderPortfolioDataTrust(decision, freshness));
    }
    if (bindDecisionConfirm) {
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
  }

  if (footerMount) {
    footerMount.innerHTML = '';
    footerMount.hidden = true;
  }

  return { decisionMount };
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

  const { decisionMount } = paintPortfolioMounts(decision, brief, meta, {
    comparison,
    cases: payloadCases,
    mode: 'live',
    payloadError: payload.error || null,
    bindDecisionConfirm: true,
  });

  await mountPortfolioAiAgentBadge(document.getElementById('portfolio-signal-ai-mount'), decision, { compact: true });

  govPage.scopeBarApi?.setCacheUxState?.({
    fresh: !meta.cached,
    updating: false,
    cachedAt: meta.cachedAt,
  });
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
  const decision = govPage.lastPortfolioDecision;
  const matchesScope = decision && cachedBrief?.projects
    && briefMatchesRequestedScope(cachedBrief, decision.anchorProject);
  if (!decision || !matchesScope) {
    paintPortfolioBentoSkeleton(cachedBrief);
    return;
  }

  paintPortfolioMounts(decision, cachedBrief, {
    cachedAt: govPage.lastPortfolioMeta?.cachedAt || '',
    cached: true,
  }, {
    comparison: govPage.lastPortfolioComparison || {},
    cases: govPage.lastPortfolioCases || [],
    mode: 'cache',
    bindDecisionConfirm: false,
  });
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'content');
}

/**
 * Bento skeleton — only fill EMPTY legacy mounts. Never touch priority mount
 * (Instant Shell / static HTML / live PrioritySurface own that).
 */
export function paintPortfolioBentoSkeleton(seed = {}) {
  const priorityBriefOnly = document.body?.classList?.contains('governance-priority-brief-page');
  const projects = Array.isArray(seed?.projects) ? seed.projects : [];
  const peerCount = Math.max(0, projects.length - 1);

  if (!priorityBriefOnly) {
    const signalMount = $('portfolio-signal-mount');
    if (signalMount && !signalMount.querySelector('[data-portfolio-signal], [data-testid="portfolio-signal-skeleton"]')) {
      signalMount.hidden = false;
      signalMount.removeAttribute('data-portfolio-signal-ready');
      signalMount.innerHTML = `<div class="portfolio-signal-skeleton" data-testid="portfolio-signal-skeleton" aria-label="Portfolio signal loading">
        <div class="gov-skeleton-headline"></div>
        <div class="gov-skeleton-metrics"></div>
      </div>`;
    }
    const carouselMount = $('portfolio-carousel-mount');
    if (carouselMount && !carouselMount.querySelector('[data-portfolio-carousel-ready], [data-testid="portfolio-carousel-skeleton"]')) {
      carouselMount.hidden = false;
      const peerLabel = peerCount > 0 ? `${peerCount + 1} squads` : 'squad';
      carouselMount.innerHTML = `<div class="portfolio-carousel-skeleton" data-testid="portfolio-carousel-skeleton" aria-label="Squad comparison loading">
        <p class="gov-skeleton-label">Loading ${escapeHtml(peerLabel)}…</p>
      </div>`;
    }
    const decisionMount = $('portfolio-decision-mount');
    if (decisionMount && !decisionMount.querySelector('.portfolio-decision, [data-testid="portfolio-decision-skeleton"]')) {
      decisionMount.innerHTML = `<div class="portfolio-decision-skeleton" data-testid="portfolio-decision-skeleton" aria-label="Decision panel loading">
        <div class="gov-skeleton-headline"></div>
      </div>`;
    }
  }
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'loading');
}

function briefMatchesRequestedScope(brief, anchor) {
  if (!brief || !anchor) return false;
  const projects = readSharedProjectsCsv();
  return projects.some((p) => String(p).toUpperCase() === String(anchor).toUpperCase());
}

