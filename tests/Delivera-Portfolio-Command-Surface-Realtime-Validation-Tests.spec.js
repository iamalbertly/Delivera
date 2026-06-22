/**
 * Portfolio command surface — journey value tests (not brittle copy literals).
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  skipIfRedirectedToLogin,
  getLayoutOverlapReport,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY, PORTFOLIO_ANCHOR_KEY } from '../public/Delivera-Shared-Storage-Keys.js';

function stubPortfolioBrief() {
  return {
    briefId: 'PORTFOLIO-SD',
    projects: ['SD', 'MAS', 'RPA'],
    portfolio: 'SD+MAS+RPA',
    generatedAt: new Date().toISOString(),
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    meta: { quarter: 'FY27 Q1', setupGaps: [], workerReceipt: { inboxTotal: 0 } },
    topRisks: [{
      issueKey: 'SD-5237',
      riskType: 'late-scope',
      summary: 'Scope outside PI baseline',
      recommendedAction: 'Confirm scope with PO',
      decisionNeededFrom: 'Product Owner',
    }],
    squadInsights: [
      {
        projectKey: 'SD', boardName: 'DMS Squad', boardResolved: true, verdictTier: 'blocked',
        sprintPulse: { committed: 10, done: 3 }, offPlanHours: 16, cardRisks: [{ issueKey: 'SD-5237' }],
      },
      {
        projectKey: 'MAS', boardName: 'Mini Apps Squad', boardResolved: true, verdictTier: 'watch',
        sprintPulse: { committed: 10, done: 6 }, offPlanHours: 4, cardRisks: [],
      },
      {
        projectKey: 'RPA', boardName: 'RPA', boardResolved: true, verdictTier: 'blocked',
        sprintPulse: { committed: 8, done: 2 }, offPlanHours: 14, cardRisks: [],
      },
    ],
  };
}

async function mockPortfolioPage(page) {
  const brief = stubPortfolioBrief();
  await page.addInitScript(({ projectsKey, anchorKey }) => {
    try {
      localStorage.setItem(projectsKey, 'SD,MAS,RPA');
      localStorage.setItem(anchorKey, 'SD');
    } catch (_) { /* ignore */ }
  }, { projectsKey: PROJECTS_SSOT_KEY, anchorKey: PORTFOLIO_ANCHOR_KEY });

  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(brief),
  }));
  await page.route('**/api/quarters-list**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/interventions/seed-from-brief**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      seeded: 1,
      cases: [{
        id: 'SD-FY27Q1-20260622-01',
        project: 'SD',
        title: 'SD needs a decision',
        issueKeys: ['SD-5237'],
        needsApproval: true,
        state: 'clarification-required',
      }],
    }),
  }));
  await page.route('**/api/governance/portfolio-decision.json**', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          decision: {
            headline: 'Review DMS scope now',
            summary: 'DMS is behind peer squads and has high off-plan work.',
            anchorProject: 'SD',
            periodKey: 'FY27 Q1',
            recommendation: { id: 'review-investment', label: 'Review investment' },
            metrics: {
              delivery: { value: 27, peerMedian: 61 },
              offPlanLoad: { value: 42, peerMedian: 21 },
              proofConfidence: { value: 38, peerMedian: 62 },
            },
            trust: { liveCases: 1, nudgesReady: 1, pending: 0, proofLevel: 'Medium' },
            drivers: [
              { title: 'Promised impact', summary: 'DMS is delivering less than peer squads.' },
              { title: 'Capacity drag', summary: 'High off-plan load reduces committed delivery.' },
              { title: 'Proof gap', summary: 'Weak evidence reduces confidence.' },
            ],
            decisionOptions: [
              { id: 'keep-funding', label: 'Keep funding', hint: 'Continue as planned' },
              { id: 'review-investment', label: 'Review investment', hint: 'Fix issues and revalidate outcomes' },
              { id: 'move-capacity', label: 'Move capacity', hint: 'Reallocate to higher impact' },
            ],
            monitoring: { squadCount: 3, commitmentCount: 18 },
          },
          comparison: {
            cards: [
              { projectKey: 'SD', squadName: 'DMS Squad', selected: true, status: 'At risk', statusClass: 'at-risk', metrics: { delivered: 27, offPlanLoad: 42, proofConfidence: 38, commitments: 5 }, explanation: 'DMS: High off-plan work and weak proof are driving low delivery.', action: { label: 'Review scope' } },
              { projectKey: 'MAS', squadName: 'Mini Apps Squad', selected: false, status: 'Watch', statusClass: 'watch', metrics: { delivered: 61, offPlanLoad: 21, proofConfidence: 62, commitments: 6 }, explanation: 'MAS: Delivery is moderate, but evidence quality still limits confidence.', action: { label: 'Continue & improve' } },
            ],
            actionsStrip: { nudgesReady: 1, pending: 0, proofLevel: 'Medium' },
          },
          cases: [{ id: 'SD-FY27Q1-20260622-01', project: 'SD' }],
        }),
      });
    }
    return route.continue();
  });
  await page.route('**/api/governance/inbox.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ nudges: [], confirm: [], briefs: [] }),
  }));
  await page.route('**/api/governance/worker-receipt.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ inboxTotal: 0, line: 'Ready' }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ summary: {} }),
  }));
}

test.describe('Portfolio command surface @portfolio-command', () => {
  test('01 nav shows Portfolio Squads Actions Settings labels', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance', { waitUntil: 'domcontentloaded' });
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-portfolio-signal]', { timeout: 120000 });
    const navText = await page.locator('.app-top-switcher, .app-sidebar-nav').first().innerText();
    expect(navText).toMatch(/Portfolio/i);
    expect(navText).toMatch(/Squads|Sprint/i);
    expect(navText).toMatch(/Actions/i);
    assertTelemetryClean(t);
  });

  test('02 portfolio signal renders contract metrics and trust row', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-portfolio-signal]', { timeout: 120000 });
    await expect(page.locator('[data-portfolio-signal]')).toContainText(/portfolio signal/i);
    await expect(page.locator('.portfolio-metric')).toHaveCount(3);
    await expect(page.locator('[data-trust-live-cases]')).toContainText(/live case/i);
    await expect(page.locator('[data-portfolio-action="review-actions"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('03 squad cards have distinct explanations not generic swap', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-squad-explanation]', { timeout: 120000 });
    const texts = await page.locator('[data-squad-explanation]').allTextContents();
    expect(texts.length).toBeGreaterThanOrEqual(2);
    expect(new Set(texts).size).toBeGreaterThan(1);
    assertTelemetryClean(t);
  });

  test('04 carousel supports keyboard navigation control', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-carousel-track]', { timeout: 120000 });
    const track = page.locator('[data-carousel-track]');
    await track.focus();
    await page.keyboard.press('ArrowRight');
    await expect(track).toBeVisible();
    assertTelemetryClean(t);
  });

  test('05 decision panel confirm calls portfolio decision API', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    let confirmed = false;
    await page.route('**/api/governance/portfolio-decision/confirm**', (route) => {
      confirmed = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('#portfolio-decision', { timeout: 120000 });
    await page.locator('[data-portfolio-action="confirm-decision"]').click();
    await page.waitForTimeout(300);
    expect(confirmed).toBe(true);
    assertTelemetryClean(t);
  });

  test('06 legacy meeting answer blocks stay out of main portfolio path', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-portfolio-signal]', { timeout: 120000 });
    await expect(page.locator('#gov-answer-mount .gov-command-answer')).toHaveCount(0);
    await expect(page.locator('.gov-worker-receipt-rail')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('07 /portfolio redirects to governance', async ({ page, request }) => {
    const t = captureBrowserTelemetry(page);
    const redirectResponse = await request.get('/portfolio', { maxRedirects: 0 });
    expect(redirectResponse.status(), 'stale dev server missing /portfolio route — restart app').toBe(302);
    expect(redirectResponse.headers().location).toMatch(/\/governance/);
    await mockPortfolioPage(page);
    await page.goto('/portfolio');
    await expect(page).toHaveURL(/\/governance/);
    assertTelemetryClean(t);
  });

  test('08 actions surface groups intervention cases by tab', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.route('**/api/governance/interventions.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cases: [{
          id: 'SD-FY27Q1-01',
          project: 'SD',
          title: 'DMS scope review',
          issueKeys: ['SD-5237'],
          needsApproval: true,
          state: 'clarification-required',
        }],
      }),
    }));
    await page.goto('/actions?tab=ready');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('.actions-case-card')).toContainText(/scope review/i);
    assertTelemetryClean(t);
  });

  test('09 no severe layout overlap on portfolio desktop', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-portfolio-signal]', { timeout: 120000 });
    const overlap = await getLayoutOverlapReport(page);
    const severe = (overlap?.pairs || []).filter((p) => p.overlapArea > 400);
    expect(severe.length).toBe(0);
    assertTelemetryClean(t);
  });

  test('10 portfolio scope bar uses Selected/Compare labels and hides copy answer', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-portfolio-signal]', { timeout: 120000 });
    const capsule = page.locator('.portfolio-scope-bar .gov-scope-capsule-text');
    await expect(capsule).toContainText(/Selected:/i);
    await expect(capsule).toContainText(/Compare:/i);
    await expect(page.locator('#gov-copy-answer-scope')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('11 review actions navigates to actions surface with project context', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-portfolio-action="review-actions"]', { timeout: 120000 });
    await page.click('[data-portfolio-action="review-actions"]');
    await expect(page).toHaveURL(/\/actions/);
    await expect(page).toHaveURL(/project=SD/i);
    assertTelemetryClean(t);
  });

  test('12 mobile tablet shows decision rail before carousel without scroll', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-portfolio-signal]', { timeout: 120000 });
    const decisionBox = await page.locator('#portfolio-decision').boundingBox();
    const carouselBox = await page.locator('[data-portfolio-carousel]').boundingBox();
    expect(decisionBox).toBeTruthy();
    expect(carouselBox).toBeTruthy();
    expect(decisionBox.y).toBeLessThan(carouselBox.y);
    assertTelemetryClean(t);
  });

  test('13 actions ready tab shows count badge when cases need approval', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.route('**/api/governance/interventions.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cases: [{
          id: 'SD-FY27Q1-01',
          project: 'SD',
          title: 'DMS scope review',
          issueKeys: ['SD-5237'],
          needsApproval: true,
          state: 'clarification-required',
        }],
      }),
    }));
    await page.goto('/actions?tab=ready');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('.actions-tab.is-active .actions-tab-count')).toHaveText('1');
    assertTelemetryClean(t);
  });
});
