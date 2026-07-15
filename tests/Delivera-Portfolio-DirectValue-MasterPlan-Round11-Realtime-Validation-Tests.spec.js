/**
 * Round 11 — portfolio direct-value master plan validation.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY, PORTFOLIO_ANCHOR_KEY } from '../public/Delivera-Shared-Storage-Keys.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';

const CACHE_KEY = 'delivera:portfolio-decision:cache:v1';

async function mockRound11Portfolio(page, { emptyStorage = false, synergyLow = false } = {}) {
  const brief = {
    briefId: 'ROUND11-SD',
    projects: ['SD', 'MAS', 'RPA', 'MPSA2'],
    generatedAt: '2026-07-10T12:00:00.000Z',
    freshness: { confidenceLimit: 'live' },
    meta: {
      briefId: 'ROUND11-SD',
      quarter: 'FY27 Q1',
      setupGaps: [],
      piFocus: synergyLow
        ? { synergy: 'low', summary: '2 board epics drift from saved PI baseline', matchedCount: 1 }
        : { synergy: 'ok', matchedCount: 4 },
    },
    squadInsights: [
      { projectKey: 'SD', boardName: 'DMS Squad', boardResolved: true, sprintPulse: { committed: 10, done: 3 }, offPlanHours: 16 },
      { projectKey: 'MAS', boardName: 'Mini Apps', boardResolved: true, sprintPulse: { committed: 8, done: 6 }, offPlanHours: 4 },
      { projectKey: 'RPA', boardName: 'RPA', boardResolved: true, sprintPulse: { committed: 8, done: 5 }, offPlanHours: 6 },
      { projectKey: 'MPSA2', boardName: 'TRANSFORMERS', boardResolved: true, sprintPulse: { committed: 9, done: 7 }, offPlanHours: 3 },
    ],
  };

  await page.addInitScript(({ projectsKey, anchorKey, empty }) => {
    try {
      if (empty) {
        localStorage.removeItem(projectsKey);
        localStorage.removeItem(anchorKey);
      } else {
        localStorage.setItem(projectsKey, 'SD,MAS,RPA,MPSA2');
        localStorage.setItem(anchorKey, 'SD');
      }
    } catch (_) { /* ignore */ }
  }, { projectsKey: PROJECTS_SSOT_KEY, anchorKey: PORTFOLIO_ANCHOR_KEY, empty: emptyStorage });

  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(brief),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/interventions/seed-from-brief**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, seeded: 0, cases: [] }),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ nudges: [], confirm: [], briefs: [] }),
  }));
  await page.route('**/api/governance/worker-receipt.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ inboxTotal: 0 }),
  }));
  await page.route('**/api/governance/portfolio-decision/confirm**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));

  const decisionPayload = {
    ok: true,
    decision: {
      anchorProject: 'SD',
      periodKey: 'FY27 Q1',
      recommendation: { id: 'review-investment', label: 'Investment review recommended' },
      narrative: { headline: 'Investment review recommended', summary: 'DMS has 27% delivery against promised impact.' },
      peerComparison: { sentence: 'DMS has 27% delivery against promised impact, high off-plan load, and weak proof compared with peer squads.' },
      metrics: { delivery: { value: 27 }, offPlanLoad: { value: 42 }, proofConfidence: { value: 38 } },
      portfolioSummary: { commitmentsOnTrack: 2, commitmentsAtRisk: 3, commitmentsTotal: 5 },
      evidenceBreakdown: { confidenceLabel: 'Low', available: 2, required: 5 },
      preparedActions: { totalReady: 2, items: [{ id: 'n1' }, { id: 'n2' }], groups: [] },
      decisionOptions: [
        { id: 'review-investment', label: 'Review investment', hint: 'Fix issues' },
        { id: 'keep-funding', label: 'Keep funding', hint: 'Continue' },
      ],
      drivers: [{ title: 'Promised impact', summary: 'DMS delivers less than peers' }],
    },
    comparison: {
      cards: [
        { projectKey: 'SD', squadName: 'DMS Squad', selected: true, status: 'At risk', statusClass: 'at-risk', metrics: { delivered: 27, offPlanLoad: 42, proofConfidence: 38, commitments: 5 }, decisionNeeded: 'Review investment', viewSquadHref: '/current-sprint?projects=SD&period=FY27%20Q1' },
        { projectKey: 'MAS', squadName: 'Mini Apps', status: 'Watch', statusClass: 'watch', metrics: { delivered: 61, offPlanLoad: 21, proofConfidence: 62, commitments: 6 }, decisionNeeded: 'Continue monitoring' },
        { projectKey: 'RPA', squadName: 'RPA', status: 'At risk', statusClass: 'at-risk', metrics: { delivered: 40, offPlanLoad: 35, proofConfidence: 45, commitments: 4 }, decisionNeeded: 'Review investment' },
        { projectKey: 'MPSA2', squadName: 'TRANSFORMERS', status: 'Improving', statusClass: 'improving', metrics: { delivered: 76, offPlanLoad: 18, proofConfidence: 70, commitments: 5 }, decisionNeeded: 'Continue monitoring' },
      ],
    },
    meta: { cached: false },
  };

  await page.route('**/api/governance/portfolio-decision.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(decisionPayload),
  }));
}

test.describe('Portfolio direct-value Round11 @portfolio-round11', () => {
  test('01 empty storage applies All Projects default', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockRound11Portfolio(page, { emptyStorage: true });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('#portfolio-scope-selected', { timeout: 120000 });
    await expect(page.locator('#portfolio-scope-selected')).toHaveValue('__ALL__');
    assertTelemetryClean(t);
  });

  test('02 four bento cards visible without compare interaction', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockRound11Portfolio(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="portfolio-bento-card"]', { timeout: 120000 });
    await expect(page.locator('[data-testid="portfolio-bento-card"]')).toHaveCount(4);
    assertTelemetryClean(t);
  });

  test('03 synergy-low still shows investment headline not alignment takeover', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockRound11Portfolio(page, { synergyLow: true });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-portfolio-signal]', { timeout: 120000 });
    await expect(page.locator('.portfolio-signal-headline')).toContainText(/Investment review/i);
    await expect(page.locator('.portfolio-synergy-chip[data-portfolio-action="open-alignment-studio"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('04 session cache paints hero before network', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockRound11Portfolio(page);
    await page.route('**/api/governance/portfolio-decision.json**', async () => {
      await new Promise(() => {});
    });
    await page.addInitScript((cacheKey) => {
      const payload = {
        decision: {
          anchorProject: 'SD',
          periodKey: 'FY27 Q1',
          recommendation: { id: 'review-investment', label: 'Cached investment review' },
          narrative: { headline: 'Cached investment review' },
          portfolioSummary: { commitmentsOnTrack: 1, commitmentsAtRisk: 1, commitmentsTotal: 2 },
          evidenceBreakdown: { confidenceLabel: 'Medium', available: 1, required: 2 },
          preparedActions: { totalReady: 0, items: [], groups: [] },
          decisionOptions: [],
          drivers: [],
        },
        comparison: { cards: [{ projectKey: 'SD', squadName: 'DMS', selected: true, status: 'Watch', statusClass: 'watch', metrics: { delivered: 50, offPlanLoad: 20, proofConfidence: 55, commitments: 3 }, decisionNeeded: 'Monitor' }] },
        meta: { cached: true },
      };
      sessionStorage.setItem(cacheKey, JSON.stringify({
        'SD|MAS,MPSA2,RPA|FY27 Q1|ROUND11-SD': { payload, at: Date.now(), ttlMs: 180000 },
      }));
    }, CACHE_KEY);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('.portfolio-signal-headline')).toContainText(/Cached investment/i, { timeout: 15000 });
    assertTelemetryClean(t);
  });

  test('05 prepared actions shows count badge link', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockRound11Portfolio(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="portfolio-prepared-badge"]', { timeout: 120000 });
    await expect(page.locator('[data-testid="portfolio-prepared-badge"]')).toContainText(/2 nudges ready/i);
    assertTelemetryClean(t);
  });

  test('06 actions preview rail visible on desktop', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/governance/interventions.json**', (r) => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cases: [{
          id: 'SD-01',
          project: 'SD',
          title: 'DMS review',
          issueKeys: ['SD-1'],
          needsApproval: true,
          state: 'open',
        }],
      }),
    }));
    await page.goto('/actions?tab=ready');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#actions-preview-rail')).toBeVisible({ timeout: 15000 });
    assertTelemetryClean(t);
  });
});
