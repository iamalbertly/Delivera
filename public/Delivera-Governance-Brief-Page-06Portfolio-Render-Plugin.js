/**

 * Portfolio command surface render plugin — signal, commitments, actions, carousel, decision.

 */

import { renderPortfolioSignal } from './Delivera-App-Portfolio-Signal-01Render-UI.js';

import { renderPortfolioCommitments, renderPortfolioRailCommitments } from './Delivera-App-Portfolio-Commitments-01Render-UI.js';
import { renderPortfolioPreparedActions } from './Delivera-App-Portfolio-PreparedActions-01Render-UI.js';
import { shouldHidePreparedActionsSection, applyHonestTrustClamp, enrichComparisonForDiffOnly } from './Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';

import { renderPortfolioCarousel, bindPortfolioCarousel, renderPortfolioCarouselSkeleton } from './Delivera-App-Portfolio-Comparison-01Carousel-UI.js';

import {
  renderPortfolioDecisionPanel,
  bindPortfolioDecisionPanel,
} from './Delivera-App-Portfolio-Decision-01Panel-UI.js';

import {
  renderGovernancePrioritySurface,
  renderGovernancePrioritySkeleton,
  bindGovernancePrioritySurface,
} from './Delivera-App-Governance-PrioritySurface-01Render-UI.js';

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

  readPortfolioCompareProjects,

} from './Delivera-App-Governance-Brief-ScopeBar-03Shared-Kernel-SSOT.js';

import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';

import { fetchJson, showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';

import { setBriefNavBadge } from './Delivera-Shared-Global-Nav.js';

import { hideGovernanceLoading, hidePortfolioLoading, setScopeStaleOverlay } from './Delivera-Governance-Brief-Page-02Loading-State.js';
import { fetchPortfolioDecisionCached, peekPortfolioDecisionCache } from './Delivera-Shared-Portfolio-Decision-Client-Cache-01Bridge.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { ensureLegacyBriefSurfacesHydrated } from './Delivera-Governance-Brief-Page-03Load-Controller.js';
import { mountPiFocusStrip } from './Delivera-App-Governance-PIFocus-01Strip-Render-UI.js';
import { openPiBaselineWizard } from './Delivera-Governance-Brief-Page-01Context.js';
import { recordPortfolioDecisionOutcome, highlightPortfolioBentoCard, renderBentoPreviewBanner } from './Delivera-App-Portfolio-Decision-02Outcome-SSOT.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

let portfolioRefreshGen = 0;

async function selectGovernanceSquad(projectKey) {
  if (!projectKey || !govPage.lastBrief) return;
  govPage.scopeBarApi?.setAnchor?.(projectKey);
  govPage._portfolioBriefToken = null;
  const surface = document.getElementById('governance-priority-surface-mount');
  surface?.setAttribute('aria-busy', 'true');
  await refreshPortfolioSurface(govPage.lastBrief, govPage.lastPortfolioCases);
  surface?.removeAttribute('aria-busy');
  const headline = surface?.querySelector('[data-testid="governance-priority-headline"]');
  if (headline) {
    headline.setAttribute('tabindex', '-1');
    headline.focus({ preventScroll: true });
  }
}

function readCompareProjects(anchor = '') {
  return readPortfolioCompareProjects(anchor);
}

function previewBentoSquad(carouselMount, decisionMount, projectKey, comparison = {}) {
  if (!projectKey) return;
  highlightPortfolioBentoCard(carouselMount, projectKey);
  const card = (comparison.cards || []).find((c) => String(c.projectKey).toUpperCase() === String(projectKey).toUpperCase());
  if (!card || !decisionMount) return;
  const existing = decisionMount.querySelector('[data-testid="portfolio-bento-preview"]');
  if (existing) existing.remove();
  decisionMount.insertAdjacentHTML('afterbegin', renderBentoPreviewBanner(card));
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
          decisionOptions: [{ id: 'keep-funding', label: 'Continue as planned', useWhen: 'Scope is confirmed', effect: 'No change', impactPreview: 'Confirm scope first.' }],
          anchorProject: anchor,
          periodKey,
          monitoring: { squadCount: compare.length + 1, commitmentCount: 0, exposedCommitmentCount: 0 },
          recommendation: { label: 'Confirm scope and proof before investment review' },
          narrative: { headline: 'Confirm scope and proof', mainIssue: 'Data loading' },
          aboveFold: { exposedCommitments: 0, actionsReady: 0, poResponsesRequired: 0 },
          priorityBrief: {
            headline: anchor ? `${anchor} needs scope and proof confirmation` : 'Governance status loading',
            zeroRisk: false,
            exposureLine: '',
            deliveraCompleted: 'Delivera is loading evidence.',
            primaryAction: 'Review and record governance decision',
            evidenceAction: 'Inspect promise-to-Jira trace',
            atRiskSquads: [],
            detailRows: [],
            baselineProvenance: { available: false, line: 'Loading baseline evidence' },
          },
          portfolioJudgment: { squads: [], atRisk: [], safe: [] },
          commitmentRows: [],
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

  const governanceAction = ev.target.closest('[data-governance-action]');
  if (governanceAction) {
    const action = governanceAction.getAttribute('data-governance-action');
    const decision = govPage.lastPortfolioDecision || {};
    const brief = govPage.lastBrief || {};
    const cases = govPage.lastPortfolioCases || [];
    if (action === 'record-decision' || action === 'review-prepared') {
      ev.preventDefault();
      openPortfolioCalibrationDrawer(decision, cases);
      return;
    }
    if (action === 'inspect-evidence' || action === 'inspect-unsupported' || action === 'commitment-decision') {
      ev.preventDefault();
      const issueKey = governanceAction.getAttribute('data-commitment-issue')
        || decision.priorityBrief?.detailRows?.[0]?.issueKey;
      const rows = issueKey ? [{ issueKey }] : (brief?.evidencePack?.rows || []);
      openEvidenceDrawer(brief, rows, { skipLegacyFlag: true, docked: true });
      return;
    }
    if (action === 'open-scope-history' || action === 'open-decision-audit' || action === 'review-recovery') {
      ev.preventDefault();
      openEvidenceDrawer(brief, brief?.evidencePack?.rows || [], { skipLegacyFlag: true, docked: true });
      return;
    }
    if (action === 'open-baseline-image') {
      ev.preventDefault();
      openPiBaselineWizard({ initialMode: 'slide' });
      return;
    }
    if (action === 'share-sponsor-brief') {
      ev.preventDefault();
      const md = decision.sponsorBriefMarkdown || '';
      if (!md) return;
      writeTextToClipboardWithFallback(md).then(() => {
        showInlineToast(document.getElementById('main-content'), 'Sponsor brief copied', 'info');
      }).catch(() => {
        const preview = document.querySelector('[data-testid="governance-sponsor-brief-preview"]');
        if (preview) preview.hidden = false;
      });
      return;
    }
    if (action === 'inspect-squad') {
      ev.preventDefault();
      const key = governanceAction.getAttribute('data-squad-key');
      if (key) await selectGovernanceSquad(key);
      return;
    }
    if (action === 'expand-commitment-detail') {
      ev.preventDefault();
      const overflow = governanceAction.closest('.gov-commitment-detail')?.querySelector('.gov-commitment-detail-overflow');
      if (overflow) {
        overflow.hidden = false;
        governanceAction.hidden = true;
      }
      return;
    }
  }

  const squadSelect = ev.target.closest('[data-governance-squad-select]');
  if (squadSelect) {
    ev.preventDefault();
    const key = squadSelect.getAttribute('data-governance-squad-select');
    if (key) await selectGovernanceSquad(key);
    return;
  }

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

  const focusBtn = ev.target.closest('[data-portfolio-bento-focus]');
  if (focusBtn) {
    ev.preventDefault();
    const projectKey = focusBtn.getAttribute('data-portfolio-bento-focus');
    if (projectKey && govPage.lastBrief) {
      govPage.scopeBarApi?.setAnchor?.(projectKey);
      govPage._portfolioBriefToken = null;
      await refreshPortfolioSurface(govPage.lastBrief, govPage.lastPortfolioCases);
    }
    return;
  }

  const btn = ev.target.closest('[data-portfolio-action]');

  if (!btn || btn.tagName === 'A') return;

  const action = btn.getAttribute('data-portfolio-action');

  const decision = govPage.lastPortfolioDecision || {};

  const cases = govPage.lastPortfolioCases || [];

  if (action === 'review-actions' || action === 'view-prepared-items') {
    openPortfolioCalibrationDrawer(decision, cases);
  } else if (action === 'focus-compare') {
    ev.preventDefault();
    const target = document.getElementById('portfolio-compare') || document.querySelector('[data-portfolio-carousel]');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target?.focus?.();
  } else if (action === 'confirm-decision') {
    ev.preventDefault();
    const rail = document.getElementById('portfolio-decision-mount');
    const decisionId = btn.getAttribute('data-decision-id')
      || rail?.querySelector('.portfolio-decision-radio input:checked')?.value
      || decision.recommendation?.id
      || 'track-commitments';
    const onConfirm = rail?._portfolioConfirmHandler;
    if (onConfirm) {
      await onConfirm(decisionId);
      return;
    }
    try {
      await recordPortfolioDecisionOutcome({ decision, decisionId, host: document.getElementById('main-content') });
      if (govPage.lastBrief) await refreshPortfolioSurface(govPage.lastBrief, govPage.lastPortfolioCases);
    } catch (_) { /* toast shown */ }
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



function portfolioCacheKeys(brief) {
  const anchor = readPortfolioAnchor(brief?.projects || readSharedProjectsCsv());
  const compare = readCompareProjects(anchor);
  const periodKey = govPage.scopeBarApi?.getQuarterLabel?.() || brief?.meta?.quarter || '';
  const briefId = String(brief?.meta?.briefId || brief?.generatedAt || '').slice(0, 64);
  return { anchor, compare, periodKey, briefId };
}

async function applyPortfolioPayloadToDom(brief, payload, cases = []) {
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
  if (meta.cached || payload._clientCache) decision._cachedView = true;
  govPage.lastPortfolioCases = payloadCases;
  govPage.lastPortfolioComparison = comparison;

  const signalMount = $('portfolio-signal-mount');
  const commitmentsMount = $('portfolio-commitments-mount');
  const preparedMount = $('portfolio-prepared-actions-mount');
  const carouselMount = $('portfolio-carousel-mount');
  const decisionMount = $('portfolio-decision-mount');
  const footerMount = $('portfolio-monitor-footer');
  const railCommitmentsMount = $('portfolio-rail-commitments-mount');
  const priorityMount = $('governance-priority-surface-mount');

  if (priorityMount) {
    priorityMount.innerHTML = renderGovernancePrioritySurface(decision, brief);
    bindGovernancePrioritySurface(priorityMount, { onSelectSquad: selectGovernanceSquad });
    if (payload.error) {
      priorityMount.insertAdjacentHTML('afterbegin', `<p class="gov-priority-error" role="alert">${escapeHtml(String(payload.error))}</p>`);
    }
  }

  if (signalMount) {
    signalMount.innerHTML = renderPortfolioSignal(decision, {
      cachedAt: meta.cachedAt,
      cached: meta.cached || payload._clientCache,
      brief,
    });
    signalMount.setAttribute('data-portfolio-signal-ready', '1');
    mountPiFocusStrip(brief, signalMount, { openPiBaselineWizard });
    if (payload.error) {
      signalMount.insertAdjacentHTML('afterbegin', `<p class="portfolio-signal-error" role="alert">${escapeHtml(String(payload.error))}</p>`);
    }
  }

  if (commitmentsMount) commitmentsMount.innerHTML = renderPortfolioCommitments(decision);
  if (railCommitmentsMount) railCommitmentsMount.innerHTML = renderPortfolioRailCommitments(decision);

  if (preparedMount) {
    const totalReady = Number(decision.preparedActions?.totalReady) || 0;
    const anchorKey = decision.anchorProject || '';
    if (shouldHidePreparedActionsSection(decision, brief)) {
      preparedMount.innerHTML = '';
      preparedMount.hidden = true;
    } else {
      preparedMount.hidden = false;
      preparedMount.innerHTML = `<p class="portfolio-prepared-badge-wrap"><a class="portfolio-prepared-badge btn btn-secondary btn-compact" href="/actions${anchorKey ? `?project=${encodeURIComponent(anchorKey)}` : ''}" data-testid="portfolio-prepared-badge">${totalReady} nudge${totalReady === 1 ? '' : 's'} ready →</a></p>`;
    }
  }

  const carouselHtml = (comparison.cards || []).length
    ? renderPortfolioCarousel(comparison)
    : renderPortfolioCarouselSkeleton({
      anchor: decision.anchorProject || portfolioCacheKeys(brief).anchor,
      compare: readCompareProjects(decision.anchorProject || portfolioCacheKeys(brief).anchor),
    });

  const bindCarousel = (mount) => {
    if (!mount || !carouselHtml) return;
    mount.innerHTML = carouselHtml;
    if ((comparison.cards || []).length) {
      bindPortfolioCarousel(mount, {
        onSelectSquad: (projectKey) => {
          if (!projectKey) return;
          const dm = document.getElementById('portfolio-decision-mount');
          const anchorKey = String(decision.anchorProject || '').toUpperCase();
          if (String(projectKey).toUpperCase() === anchorKey) {
            highlightPortfolioBentoCard(mount, projectKey);
            dm?.querySelector('[data-testid="portfolio-bento-preview"]')?.remove();
            return;
          }
          previewBentoSquad(mount, dm, projectKey, comparison);
        },
      });
    }
  };

  if (carouselMount) {
    carouselMount.hidden = false;
    bindCarousel(carouselMount);
  }

  if (decisionMount) {
    decisionMount.innerHTML = renderPortfolioDecisionPanel(decision, brief);
    bindPortfolioDecisionPanel(decisionMount, async (decisionId) => {
      try {
        await recordPortfolioDecisionOutcome({
          decision,
          decisionId,
          host: document.getElementById('main-content'),
        });
        await refreshPortfolioSurface(brief, govPage.lastPortfolioCases);
      } catch (_) { /* toast shown */ }
    });
  }

  if (footerMount) {
    footerMount.innerHTML = `<p class="portfolio-monitor-legend" data-testid="portfolio-monitor-legend">${escapeHtml(COPY.portfolioLegend)}</p>`;
    footerMount.hidden = false;
  }

  await mountPortfolioAiAgentBadge(document.getElementById('portfolio-signal-ai-mount'), decision, { compact: true });

  govPage.scopeBarApi?.setCacheUxState?.({
    fresh: !meta.cached && !payload._clientCache,
    updating: false,
    cachedAt: meta.cachedAt,
  });
  govPage.scopeBarApi?.refreshCapsule?.();
  document.getElementById('main-content')?.classList.add('portfolio-shell--active');
  try {
    document.body.classList.toggle(
      'portfolio-rail-visible',
      Boolean(decisionMount?.querySelector('.portfolio-rail-stack, .portfolio-decision, #portfolio-decision')),
    );
  } catch (_) { /* ignore */ }
  document.title = 'Governance | Delivera';
}

export function paintPortfolioFromCache(brief) {
  if (!brief) return false;
  const keys = portfolioCacheKeys(brief);
  const peeked = peekPortfolioDecisionCache(keys);
  if (!peeked?.payload?.decision) return false;
  const payload = { ...peeked.payload, _clientCache: true };
  void applyPortfolioPayloadToDom(brief, payload, govPage.lastPortfolioCases || []).then(() => {
    hidePortfolioLoading();
    document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'content');
    if (peeked.stale) setScopeStaleOverlay(true, 'Refreshing live portfolio signal…');
  });
  return true;
}

export function paintPortfolioBentoSkeleton(brief) {
  if (!brief) return;
  const priorityMount = $('governance-priority-surface-mount');
  if (priorityMount) {
    priorityMount.innerHTML = renderGovernancePrioritySkeleton();
    return;
  }
  const keys = portfolioCacheKeys(brief);
  const carouselMount = $('portfolio-carousel-mount');
  if (!carouselMount) return;
  carouselMount.hidden = false;
  carouselMount.innerHTML = renderPortfolioCarouselSkeleton({
    anchor: keys.anchor,
    compare: keys.compare,
  });
}

export async function refreshPortfolioSurface(brief, cases = govPage.lastPortfolioCases || []) {
  if (!brief) return;
  const gen = ++portfolioRefreshGen;
  try {
    govPage.scopeBarApi?.setCacheUxState?.({ fresh: false, updating: true });
    const payload = await fetchPortfolioPayload(brief, cases);
    if (gen !== portfolioRefreshGen) return;
    await applyPortfolioPayloadToDom(brief, payload, cases);
  } finally {
    if (gen === portfolioRefreshGen) {
      hideGovernanceLoading();
      document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'content');
    }
  }
}



let portfolioHooked = false;



export function installPortfolioSurfaceHook() {

  if (portfolioHooked || !document.getElementById('governance-priority-surface-mount')) return;

  portfolioHooked = true;

  document.getElementById('main-content')?.addEventListener('click', handlePortfolioDelegatedClick);

  window.addEventListener('delivera:scope-changed', () => {

    govPage._portfolioBriefToken = null;

    if (govPage.lastBrief) refreshPortfolioSurface(govPage.lastBrief, govPage.lastPortfolioCases);

  });

  document.addEventListener('gov:open-alignment-studio', () => {
    openPiBaselineWizard({ initialMode: 'slide' });
  });

  // Document-level delegation so any [data-portfolio-action="open-alignment-studio"] button
  // (e.g. the empty-state CTA in the commitments section) opens the Alignment Studio without
  // needing per-element binding.
  document.addEventListener('click', (ev) => {
    const trigger = ev.target?.closest?.('[data-portfolio-action="open-alignment-studio"]');
    if (!trigger) return;
    ev.preventDefault();
    document.dispatchEvent(new CustomEvent('gov:open-alignment-studio', { bubbles: true }));
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


