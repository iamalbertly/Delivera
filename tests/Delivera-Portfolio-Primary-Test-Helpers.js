/**
 * Portfolio-primary Playwright helpers — signal visible, legacy brief attached in #gov-brief-content.
 */

export const DEFAULT_PORTFOLIO_DECISION = {
  headline: 'DELIVERY BLOCKED — act today',
  narrative: {
    headline: 'DELIVERY BLOCKED — act today',
    summary: 'Portfolio needs leadership attention.',
    mainIssue: 'Stale work blocking delivery',
  },
  metrics: {
    delivery: { value: 42, peerMedian: 55 },
    offPlanLoad: { value: 18, peerMedian: 12 },
    proofConfidence: { value: 35, peerMedian: 50 },
  },
  peerComparison: { sentence: 'SD is behind peers on delivery proof.' },
  trust: { liveCases: 2, nudgesReady: 1, proofLevel: 'Low' },
  aboveFold: { exposedCommitments: 2, actionsReady: 2, poResponsesRequired: 1, mainIssue: 'Stale work blocking delivery' },
  affectedCommitments: [
    { id: 'c1', title: 'Stuck item', status: 'open', reason: 'stale', decisionNeeded: true },
  ],
  preparedActions: {
    groups: [{ role: 'Leadership', count: 1, label: '1 action' }],
    items: [],
    escalationReady: false,
  },
  decisionOptions: [
    { id: 'review-investment', label: 'Review investment', useWhen: 'Proof gap', effect: 'Escalate', impactPreview: 'Leadership review.' },
    { id: 'keep-funding', label: 'Keep funding', useWhen: 'Scope confirmed', effect: 'No change', impactPreview: 'Continue delivery.' },
  ],
  recommendation: { id: 'review-investment', label: 'Review investment' },
  anchorProject: 'SD',
  periodKey: 'FY27 Q1',
  monitoring: { squadCount: 1, commitmentCount: 0, exposedCommitmentCount: 2, liveCases: 2 },
};

export async function waitForPortfolioReady(page, timeout = 25000) {
  await page.waitForSelector('[data-portfolio-signal]', { timeout });
}

/** Portfolio signal plus on-demand legacy brief hydration (hidden #gov-brief-content). */
export async function waitForGovernanceReady(page, timeout = 25000) {
  await waitForPortfolioReady(page, timeout);
  await page.waitForSelector('#main-content[data-gov-brief-state="content"]', { timeout }).catch(() => {});
  await waitForLegacyBriefHydrated(page, timeout);
}

export function legacyBrief(page, selector) {
  return page.locator(`#gov-brief-content ${selector}`).first();
}

export async function forceLegacyBriefHydration(page) {
  await page.evaluate(async () => {
    const mod = await import('./Delivera-Governance-Brief-Page-03Load-Controller.js');
    mod.ensureLegacyBriefSurfacesHydrated();
  });
}

export async function waitForLegacyBriefHydrated(page, timeout = 12000) {
  await page.waitForSelector('[data-portfolio-signal]', { timeout }).catch(() => {});
  await page.waitForSelector('#main-content[data-gov-brief-state="content"]', { timeout }).catch(() => {});

  const legacyReady = () => {
    const root = document.getElementById('gov-brief-content');
    if (!root) return false;
    return Boolean(
      root.querySelector('.gov-portfolio-grid-wrap')
      || root.querySelector('.gov-comparison-refine')
      || root.querySelector('.gov-pi-strip')
      || root.querySelector('.gov-command-answer')
      || root.querySelector('.gov-owner-cluster')
      || root.querySelector('.gov-action-clusters .gov-cluster-nudge-primary'),
    );
  };

  await page.evaluate(async () => {
    const mod = await import('/Delivera-Governance-Brief-Page-03Load-Controller.js');
    mod.ensureLegacyBriefSurfacesHydrated?.();
  });
  await page.waitForFunction(legacyReady, { timeout }).catch(() => {});

  const ready = await page.evaluate(legacyReady);
  if (!ready) {
    await page.evaluate(async () => {
      const mod = await import('/Delivera-Governance-Brief-Page-03Load-Controller.js');
      mod.resetLegacyBriefHydration?.();
      mod.ensureLegacyBriefSurfacesHydrated?.();
    });
    await page.waitForFunction(legacyReady, { timeout: 8000 }).catch(() => {});
  }
}

export async function openLegacyDetails(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(`#gov-brief-content ${sel}`);
    if (el && 'open' in el) el.open = true;
  }, selector);
}

export async function clickLegacy(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(`#gov-brief-content ${sel}`) || document.querySelector(sel);
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    if (el && typeof el.click === 'function') el.click();
  }, selector);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ decision?: object, comparison?: object, cases?: object[] }} [overrides]
 */
export async function mockPortfolioDecision(page, overrides = {}) {
  const decision = { ...DEFAULT_PORTFOLIO_DECISION, ...(overrides.decision || {}) };
  const comparison = overrides.comparison || { cards: [], actionsStrip: {} };
  const cases = overrides.cases || [];
  await page.route('**/api/governance/portfolio-decision.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      decision,
      comparison,
      cases,
      meta: { cached: false, cacheTtlMs: 10800000 },
    }),
  }));
}

export async function gotoGovernancePortfolioReady(page, url = '/governance') {
  await page.goto(url);
  if (page.url().includes('/login')) return false;
  await waitForPortfolioReady(page);
  return true;
}

import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';

const GOVERNANCE_STUB_ROUTES = [
  ['**/api/quarters-list**', { quarters: [] }],
  ['**/api/governance/adoption-metrics.json**', {}],
  ['**/api/governance/inbox.json**', { briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }],
  ['**/api/governance/feedback-summary.json**', {}],
  ['**/api/governance/worker-receipt.json**', { line: 'Ready', inboxTotal: 0 }],
  ['**/api/governance/pi-confidence.json**', { trusted: false, headline: 'PI confidence' }],
  ['**/api/governance/interventions/seed-from-brief**', { cases: [] }],
  ['**/api/governance/interventions.json**', { cases: [] }],
  ['**/api/governance/scope-intelligence.json**', { suggestions: [] }],
];

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ brief?: object, decision?: object, comparison?: object, cases?: object[] }} [opts]
 */
export async function mockOutcomeDraft(page, payload = { ok: true, rows: [] }) {
  await page.route('**/api/outcome-draft**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  }));
}

export async function mockGovernancePage(page, opts = {}) {
  const { brief, decision, comparison, cases } = opts;
  await routeProjectsCatalog(page);
  if (brief) {
    await page.route('**/api/governance-brief.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(brief),
    }));
  }
  await mockPortfolioDecision(page, { decision, comparison, cases });
  for (const [pattern, body] of GOVERNANCE_STUB_ROUTES) {
    await page.route(pattern, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    }));
  }
}
