/**
 * Portfolio command surface — renders signal, carousel, decision after brief loads.
 */
import { renderPortfolioSignal } from './Delivera-App-Portfolio-Signal-01Render-UI.js';
import { renderPortfolioCarousel, bindPortfolioCarousel } from './Delivera-App-Portfolio-Comparison-01Carousel-UI.js';
import {
  renderWhyThisMatters,
  renderPortfolioDecisionPanel,
  bindPortfolioDecisionPanel,
} from './Delivera-App-Portfolio-Decision-01Panel-UI.js';
import { openPortfolioActionsDrawer } from './Delivera-App-Portfolio-Actions-01Bridge.js';
import { openPortfolioTrustDrawer } from './Delivera-App-Portfolio-Trust-01Drawer-UI.js';
import { govPage, $ } from './Delivera-Governance-Brief-Page-01Context.js';
import {
  PORTFOLIO_ANCHOR_KEY,
  PORTFOLIO_BASELINE_MODE_KEY,
  readSharedProjectsCsv,
} from './Delivera-Shared-Storage-Keys.js';
import { showInlineToast } from './Delivera-App-Shared-Network-01Fetch-Guard-Helpers.js';
import { setBriefNavBadge } from './Delivera-Shared-Global-Nav.js';
import { hideGovernanceLoading } from './Delivera-Governance-Brief-Page-02Loading-State.js';

function readAnchorProject(fallback = '') {
  try {
    const stored = String(localStorage.getItem(PORTFOLIO_ANCHOR_KEY) || '').trim().toUpperCase();
    if (stored) return stored;
  } catch (_) { /* ignore */ }
  const projects = readSharedProjectsCsv();
  return projects[0] || fallback || '';
}

function readBaselineMode() {
  try {
    return String(localStorage.getItem(PORTFOLIO_BASELINE_MODE_KEY) || 'pi-baseline').trim();
  } catch (_) {
    return 'pi-baseline';
  }
}

function readCompareProjects(anchor = '') {
  const projects = readSharedProjectsCsv();
  const A = String(anchor || '').toUpperCase();
  return projects.filter((p) => String(p).toUpperCase() !== A);
}

async function fetchPortfolioPayload(brief) {
  const anchor = readAnchorProject(brief?.projects?.[0]);
  const compare = readCompareProjects(anchor);
  const periodKey = govPage.scopeBarApi?.getQuarterLabel?.() || brief?.meta?.quarter || '';
  const baselineMode = readBaselineMode();
  const gaps = brief?.meta?.setupGaps || [];
  const baselineMissing = gaps.some((g) => g.action === 'set-baseline') || baselineMode === 'none';
  const partialSquads = (brief?.squadInsights || []).filter((s) => !s.boardResolved).length;

  let cases = [];
  try {
    const seed = await fetch('/api/governance/interventions/seed-from-brief', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ brief, projects: anchor, periodKey, risks: brief?.topRisks || [] }),
    });
    if (seed.ok) {
      const seeded = await seed.json();
      cases = seeded.cases || [];
    }
  } catch (_) { /* optional */ }

  try {
    const res = await fetch('/api/governance/portfolio-decision.json', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        brief,
        anchor,
        compare,
        periodKey,
        baseline: baselineMode,
        baselineMissing,
        partialSquads,
        cases,
      }),
    });
    if (res.ok) return res.json();
    throw new Error(`Portfolio decision failed (${res.status})`);
  } catch (err) {
    return {
      decision: {
        headline: anchor ? `Review ${anchor} scope now` : 'Portfolio signal',
        summary: 'Portfolio comparison is loading — refresh if this persists.',
        metrics: {
          delivery: { value: 0, peerMedian: 0 },
          offPlanLoad: { value: 0, peerMedian: 0 },
          proofConfidence: { value: 0, peerMedian: 0 },
        },
        trust: { liveCases: cases.length, nudgesReady: 0, proofLevel: 'Low' },
        drivers: [],
        decisionOptions: [{ id: 'review-investment', label: 'Review investment', hint: 'Fix issues and revalidate outcomes' }],
        anchorProject: anchor,
        periodKey,
        monitoring: { squadCount: compare.length + 1, commitmentCount: 0 },
        recommendation: { label: 'Review investment' },
      },
      comparison: { cards: [], actionsStrip: {} },
      cases,
      error: err?.message,
    };
  }
}

function handlePortfolioDelegatedClick(ev) {
  const btn = ev.target.closest('[data-portfolio-action]');
  if (!btn || btn.tagName === 'A') return;
  const action = btn.getAttribute('data-portfolio-action');
  const decision = govPage.lastPortfolioDecision || {};
  const cases = govPage.lastPortfolioCases || [];
  if (action === 'review-actions') openPortfolioActionsDrawer(decision, cases);
  else if (action === 'compare-peers') {
    document.querySelector('[data-portfolio-carousel]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (action === 'how-ai-decides') openPortfolioTrustDrawer(decision);
}

export async function refreshPortfolio() {
  const brief = govPage.lastBrief;
  if (!brief) return;
  const payload = await fetchPortfolioPayload(brief);
  const { decision = {}, comparison = {}, cases = [] } = payload;
  govPage.lastPortfolioDecision = decision;
  govPage.lastPortfolioCases = cases;

  const signalMount = $('portfolio-signal-mount');
  const carouselMount = $('portfolio-carousel-mount');
  const whyMount = $('portfolio-why-mount');
  const decisionMount = $('portfolio-decision-mount');
  const footerMount = $('portfolio-monitor-footer');

  if (signalMount) signalMount.innerHTML = renderPortfolioSignal(decision);
  if (carouselMount) {
    carouselMount.innerHTML = renderPortfolioCarousel(comparison);
    bindPortfolioCarousel(carouselMount, {
      onSelectSquad: async (projectKey) => {
        if (!projectKey) return;
        govPage.scopeBarApi?.setAnchor?.(projectKey);
        govPage._portfolioBriefToken = null;
        await refreshPortfolio();
      },
      onSquadAction: (projectKey, actionId) => {
        if (!projectKey) return;
        if (actionId === 'review-scope' || actionId === 'review') {
          openPortfolioActionsDrawer({ anchorProject: projectKey, periodKey: decision.periodKey }, cases);
          return;
        }
        if (actionId === 'scale' || actionId === 'continue-improve') {
          window.location.href = `/current-sprint?projects=${encodeURIComponent(projectKey)}`;
        }
      },
    });
  }
  if (whyMount) whyMount.innerHTML = renderWhyThisMatters(decision.drivers);
  if (decisionMount) {
    decisionMount.innerHTML = renderPortfolioDecisionPanel(decision);
    bindPortfolioDecisionPanel(decisionMount, async (decisionId) => {
      const res = await fetch('/api/governance/portfolio-decision/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          project: decision.anchorProject,
          periodKey: decision.periodKey,
          decisionId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showInlineToast(document.getElementById('main-content'), data.error || 'Could not record decision', 'error');
        return;
      }
      showInlineToast(document.getElementById('main-content'), 'Portfolio decision recorded', 'info');
      await refreshPortfolio();
    });
  }
  if (footerMount) {
    const mon = decision.monitoring || {};
    footerMount.innerHTML = `
      <footer class="portfolio-monitor" data-portfolio-monitor>
        <p>Delivera AI is monitoring ${mon.squadCount || 0} squads and ${mon.commitmentCount || 0} commitments. Signals update daily.</p>
        <button type="button" class="btn btn-secondary btn-compact" data-portfolio-action="how-ai-decides">How AI decides</button>
      </footer>`;
  }

  setBriefNavBadge(cases.length || decision.trust?.liveCases || 0);
  hideGovernanceLoading();
  document.getElementById('main-content')?.setAttribute('data-gov-brief-state', 'content');
  document.getElementById('main-content')?.classList.add('portfolio-shell--active');
  document.title = 'Portfolio | Delivera';
}

let portfolioHooked = false;

export function installPortfolioSurfaceHook() {
  if (portfolioHooked || !document.getElementById('portfolio-signal-mount')) return;
  portfolioHooked = true;
  const shell = document.getElementById('main-content');
  shell?.addEventListener('click', handlePortfolioDelegatedClick);
  window.addEventListener('delivera:scope-changed', () => {
    govPage._portfolioBriefToken = null;
    if (govPage.lastBrief) refreshPortfolio();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installPortfolioSurfaceHook);
} else {
  installPortfolioSurfaceHook();
}
