/**

 * Portfolio command surface render plugin — signal, commitments, actions, carousel, decision.

 */

import { renderPortfolioSignal } from './Delivera-App-Portfolio-Signal-01Render-UI.js';

import { renderPortfolioCommitments } from './Delivera-App-Portfolio-Commitments-01Render-UI.js';

import { renderPortfolioPreparedActions } from './Delivera-App-Portfolio-PreparedActions-01Render-UI.js';

import { renderPortfolioCarousel, bindPortfolioCarousel } from './Delivera-App-Portfolio-Comparison-01Carousel-UI.js';

import {

  renderPortfolioDecisionPanel,

  bindPortfolioDecisionPanel,

} from './Delivera-App-Portfolio-Decision-01Panel-UI.js';

import { openPortfolioActionsDrawer } from './Delivera-App-Portfolio-Actions-01Bridge.js';

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



function handlePortfolioDelegatedClick(ev) {

  const btn = ev.target.closest('[data-portfolio-action]');

  if (!btn || btn.tagName === 'A') return;

  const action = btn.getAttribute('data-portfolio-action');

  const decision = govPage.lastPortfolioDecision || {};

  const cases = govPage.lastPortfolioCases || [];

  if (action === 'review-actions' || action === 'view-prepared-items') openPortfolioActionsDrawer(decision, cases);
  else if (action === 'how-ai-decides') openPortfolioTrustDrawer(decision);
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

  const payload = await fetchPortfolioPayload(brief, cases);
  const { decision = {}, comparison = {}, cases: payloadCases = cases, meta = payload?.meta || {} } = payload;
  govPage.lastPortfolioMeta = meta;

  govPage.lastPortfolioDecision = decision;

  govPage.lastPortfolioCases = payloadCases;



  const signalMount = $('portfolio-signal-mount');

  const commitmentsMount = $('portfolio-commitments-mount');

  const preparedMount = $('portfolio-prepared-actions-mount');

  const carouselMount = $('portfolio-carousel-mount');

  const decisionMount = $('portfolio-decision-mount');

  const footerMount = $('portfolio-monitor-footer');



  if (signalMount) signalMount.innerHTML = renderPortfolioSignal(decision, { cachedAt: meta.cachedAt, cached: meta.cached });

  if (commitmentsMount) commitmentsMount.innerHTML = renderPortfolioCommitments(decision);

  if (preparedMount) preparedMount.innerHTML = renderPortfolioPreparedActions(decision);

  if (carouselMount) {

    carouselMount.innerHTML = renderPortfolioCarousel(comparison);

    bindPortfolioCarousel(carouselMount, {

      onSelectSquad: async (projectKey) => {

        if (!projectKey) return;

        govPage.scopeBarApi?.setAnchor?.(projectKey);

        govPage._portfolioBriefToken = null;

        await refreshPortfolioSurface(brief, govPage.lastPortfolioCases);

      },

    });

  }

  if (decisionMount) {

    decisionMount.innerHTML = renderPortfolioDecisionPanel(decision);

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

    const mon = decision.monitoring || {};

    const exposed = mon.exposedCommitmentCount ?? decision.aboveFold?.exposedCommitments ?? 0;

    const piCount = mon.piBaselineCount ?? mon.commitmentCount ?? 0;

    footerMount.innerHTML = `
      <footer class="portfolio-monitor portfolio-monitor--compact" data-portfolio-monitor>
        <p>Monitoring ${mon.squadCount || 0} squads · ${exposed} exposed · ${piCount} PI items · ${decision.trust?.liveCases || 0} live cases · <button type="button" class="btn-link portfolio-monitor-trust" data-portfolio-action="how-ai-decides">How AI decides</button></p>
      </footer>`;

  }



  await mountPortfolioAiAgentBadge(document.getElementById('portfolio-signal-ai-mount'), decision, { compact: true });

  hideGovernanceLoading();

  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'content');

  document.getElementById('main-content')?.classList.add('portfolio-shell--active');

  document.title = 'Portfolio | Delivera';

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

}



/** @deprecated Use refreshPortfolioSurface */

export const refreshPortfolio = refreshPortfolioSurface;


