/**
 * Round 12 — growth UX: delivery vocabulary, outcome-linked decisions, rail-first layout.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY, PORTFOLIO_ANCHOR_KEY } from '../public/Delivera-Shared-Storage-Keys.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';

async function mockRound12Portfolio(page) {
  const brief = {
    briefId: 'ROUND12-SD',
    projects: ['SD', 'MAS', 'RPA', 'MPSA2'],
    generatedAt: '2026-07-11T12:00:00.000Z',
    meta: {
      briefId: 'ROUND12-SD',
      quarter: 'FY27 Q1',
      setupGaps: [],
      piFocus: { synergy: 'ok', matchedCount: 4 },
    },
    squadInsights: [
      { projectKey: 'SD', boardName: 'DMS Squad', boardResolved: true, sprintPulse: { committed: 10, done: 3 }, offPlanHours: 16 },
      { projectKey: 'MAS', boardName: 'Mini Apps', boardResolved: true, sprintPulse: { committed: 8, done: 6 }, offPlanHours: 4 },
      { projectKey: 'RPA', boardName: 'RPA', boardResolved: true, sprintPulse: { committed: 8, done: 5 }, offPlanHours: 6 },
      { projectKey: 'MPSA2', boardName: 'TRANSFORMERS', boardResolved: true, sprintPulse: { committed: 9, done: 7 }, offPlanHours: 3 },
    ],
    evidencePack: {
      rows: [{ issueKey: 'SD-100', whyFlagged: 'Proof gap', statusNow: 'Needs review' }],
    },
  };

  await page.addInitScript(({ projectsKey, anchorKey }) => {
    localStorage.setItem(projectsKey, 'SD,MAS,RPA,MPSA2');
    localStorage.setItem(anchorKey, 'SD');
  }, { projectsKey: PROJECTS_SSOT_KEY, anchorKey: PORTFOLIO_ANCHOR_KEY });

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

  const decisionPayload = {
    ok: true,
    decision: {
      anchorProject: 'SD',
      periodKey: 'FY27 Q1',
      recommendation: { id: 'review-investment', label: 'Fix delivery issues' },
      narrative: { headline: 'Fix delivery issues recommended', summary: 'DMS has 27% delivery against promised impact.' },
      peerComparison: { sentence: 'DMS has 27% delivery against promised impact compared with peer squads.' },
      metrics: { delivery: { value: 27 }, offPlanLoad: { value: 42 }, proofConfidence: { value: 38 } },
      portfolioSummary: { commitmentsOnTrack: 2, commitmentsAtRisk: 3, commitmentsTotal: 5 },
      evidenceBreakdown: { confidenceLabel: 'Low', available: 2, required: 5 },
      preparedActions: { totalReady: 1, items: [{ id: 'n1' }], groups: [] },
      decisionOptions: [
        { id: 'keep-funding', label: 'Continue as planned', hint: 'Scope confirmed' },
        { id: 'review-investment', label: 'Fix delivery issues', hint: 'Pause until proof catches up' },
        { id: 'move-capacity', label: 'Shift capacity', hint: 'Reallocate' },
      ],
      drivers: [{ title: 'Promised impact', summary: 'DMS delivers less than peers' }],
      affectedCommitments: [
        { id: 'C1', title: 'Recharge Growth', status: 'At risk', projectKey: 'SD', issueKey: 'C1', periodKey: 'FY27 Q1', reason: 'Scope gap', decisionNeeded: 'Fix scope' },
      ],
    },
    comparison: {
      cards: [
        { projectKey: 'SD', squadName: 'DMS Squad', selected: true, status: 'At risk', statusClass: 'at-risk', metrics: { delivered: 27, offPlanLoad: 42, proofConfidence: 38, commitments: 5 }, decisionNeeded: 'Fix delivery issues', viewSquadHref: '/current-sprint?projects=SD&period=FY27%20Q1' },
        { projectKey: 'MAS', squadName: 'Mini Apps', status: 'Watch', statusClass: 'watch', metrics: { delivered: 61, offPlanLoad: 21, proofConfidence: 62, commitments: 6 }, decisionNeeded: 'Continue monitoring', viewSquadHref: '/current-sprint?projects=MAS&period=FY27%20Q1' },
        { projectKey: 'RPA', squadName: 'RPA', status: 'At risk', statusClass: 'at-risk', metrics: { delivered: 40, offPlanLoad: 35, proofConfidence: 45, commitments: 4 }, decisionNeeded: 'Fix delivery issues' },
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

  await page.route('**/api/governance/portfolio-decision/confirm**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      case: { id: 'SD-R12-01', project: 'SD', title: 'SD portfolio decision', needsApproval: true, state: 'open' },
    }),
  }));

  return { brief, decisionPayload };
}

test.describe('Portfolio growth UX Round12 @portfolio-round12', () => {
  test('01 delivery vocabulary — no Keep funding label', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockRound12Portfolio(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-portfolio-decision-radios]', { timeout: 120000 });
    await expect(page.locator('[data-portfolio-decision-radios]')).not.toContainText(/Keep funding/i);
    await expect(page.locator('[data-portfolio-decision-radios]')).toContainText(/Continue as planned/i);
    assertTelemetryClean(t);
  });

  test('02 compare scope shows squad name tags not +N squads', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockRound12Portfolio(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="portfolio-scope-compare-tags"]', { timeout: 120000 });
    const tags = page.locator('[data-testid="portfolio-scope-compare-tags"] .portfolio-scope-tag');
    await expect(tags).toHaveCount(3);
    assertTelemetryClean(t);
  });

  test('03 bento peer click previews without scope reload', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockRound12Portfolio(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="portfolio-bento-card"]', { timeout: 120000 });
    const anchorBefore = await page.locator('#portfolio-scope-selected').inputValue();
    await page.locator('[data-squad-key="MAS"]').click();
    await expect(page.locator('[data-testid="portfolio-bento-preview"]')).toBeVisible();
    await expect(page.locator('#portfolio-scope-selected')).toHaveValue(anchorBefore);
    assertTelemetryClean(t);
  });

  test('04 rail decision uses delivery prompt copy', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockRound12Portfolio(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('.portfolio-next-decision-prompt', { timeout: 120000 });
    await expect(page.locator('.portfolio-next-decision-prompt')).toContainText(/What should we do with delivery/i);
    assertTelemetryClean(t);
  });

  test('05 desktop hides duplicate hero confirm when rail visible', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1400, height: 900 });
    await mockRound12Portfolio(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('body.portfolio-rail-visible', { timeout: 120000 });
    await expect(page.locator('[data-testid="portfolio-primary-cta"][data-portfolio-action="confirm-decision"]')).toBeHidden();
    await expect(page.locator('[data-portfolio-decision-radios]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('06 footer legend visible', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockRound12Portfolio(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="portfolio-monitor-legend"]', { timeout: 120000 });
    await expect(page.locator('[data-testid="portfolio-monitor-legend"]')).toContainText(/Delivery%/i);
    assertTelemetryClean(t);
  });

  test('07 rail at-risk commitments on desktop', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1400, height: 900 });
    await mockRound12Portfolio(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="portfolio-rail-commitments"]', { timeout: 120000 });
    assertTelemetryClean(t);
  });

  test('08 confirm decision shows outcome toast not placebo', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 900, height: 900 });
    await mockRound12Portfolio(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="portfolio-primary-cta"]', { timeout: 120000 });
    await page.locator('[data-testid="portfolio-primary-cta"]').click();
    await expect(page.locator('.delivera-surface-toast')).toContainText(/saved/i, { timeout: 10000 });
    await expect(page.locator('.delivera-surface-toast')).toContainText(/Actions/i);
    assertTelemetryClean(t);
  });

  test('09 actions urgency sort and project chip', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.route('**/api/governance/interventions.json**', (r) => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cases: [
          { id: 'B-LOW', project: 'SD', title: 'Low urgency', issueKeys: ['SD-2'], needsApproval: false, state: 'open' },
          { id: 'A-HIGH', project: 'SD', title: 'High urgency', issueKeys: ['SD-1'], needsApproval: true, state: 'clarification-required' },
        ],
      }),
    }));
    await page.goto('/actions?tab=ready&project=SD');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('[data-testid="actions-project-chip"]')).toBeVisible();
    await expect(page.locator('.actions-case-card').first()).toContainText(/High urgency/i);
    assertTelemetryClean(t);
  });

  test('10 actions preview shows portfolio verdict when cached', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.addInitScript(() => {
      sessionStorage.setItem('delivera:portfolio-decision:cache:v1', JSON.stringify({
        'SD|MAS,MPSA2,RPA|FY27 Q1|ROUND12': {
          payload: { decision: { narrative: { headline: 'Cached verdict line' } } },
          at: Date.now(),
          ttlMs: 180000,
        },
      }));
    });
    await page.route('**/api/governance/interventions.json**', (r) => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cases: [{ id: 'SD-01', project: 'SD', title: 'Review', issueKeys: ['SD-1'], needsApproval: true, state: 'open' }],
      }),
    }));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/actions?tab=ready');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('[data-testid="actions-preview-portfolio-verdict"]')).toContainText(/Cached verdict/i);
    assertTelemetryClean(t);
  });
});
