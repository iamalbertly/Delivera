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
import { enrichDecisionPayload } from './Delivera-Governance-PriorityBrief-Mock-Helper.js';

function stubPortfolioBrief() {
  return {
    briefId: 'PORTFOLIO-SD',
    // Anchor detail remains DMS-only; portfolio comparisons are supplied by
    // the decision payload below.
    projects: ['SD'],
    portfolio: 'SD+MAS+RPA',
    generatedAt: new Date().toISOString(),
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    meta: {
      quarter: 'FY27 Q1',
      setupGaps: [],
      workerReceipt: { inboxTotal: 0 },
      baselineReadinessByProject: {
        SD: { hasBaseline: true, committedCount: 3, piName: 'DMS FY27 Q1', baselineDate: '2026-04-01' },
      },
    },
    baselineComparison: {
      piName: 'DMS FY27 Q1',
      baselineDate: '2026-04-01',
      summary: { totalCommitted: 3, delivered: 1, onTrack: 1, notTraceable: 1 },
      items: [{
        issueKey: 'SD-5237',
        title: 'Scope outside PI baseline',
        squad: 'SD',
        verdict: 'not-planned',
        epicActivity: { lifecycle: 'jira-only', storyCount: 0 },
      }],
    },
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
  brief.baselineComparisonByProject = { SD: brief.baselineComparison };
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
  const decisionPayload = enrichDecisionPayload(brief, {
    anchorProject: 'SD',
    compareProjects: ['MAS', 'RPA'],
    cases: [{ id: 'SD-FY27Q1-20260622-01', project: 'SD' }],
    preparedActions: {
      groups: [{ role: 'Product Owner', count: 1, label: '1 Product Owner' }],
      items: [{ role: 'Product Owner', action: 'Confirm scope with PO', owner: 'Product Owner', caseId: 'SD-FY27Q1-20260622-01' }],
      nextDeadline: 'Today 15:00',
      escalationReady: true,
      poResponsesRequired: 1,
      totalReady: 1,
    },
    affectedCommitments: [
      { id: 'c1', title: 'Recharge Growth Trends', status: 'At risk', reason: 'Scope outside PI baseline', decisionNeeded: 'Confirm scope', periodKey: 'FY27 Q1', projectKey: 'SD' },
    ],
    comparison: {
      cards: [
        { projectKey: 'SD', squadName: 'DMS Squad', selected: true, status: 'At risk', statusClass: 'at-risk', metrics: { delivered: 27, offPlanLoad: 42, proofConfidence: 38, commitments: 5 } },
        { projectKey: 'MAS', squadName: 'Mini Apps Squad', selected: false, status: 'Watch', statusClass: 'watch', metrics: { delivered: 61, offPlanLoad: 21, proofConfidence: 62, commitments: 6 } },
      ],
    },
    meta: { cached: false, cacheTtlMs: 10800000 },
  });
  await page.route('**/api/governance/portfolio-decision.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(decisionPayload),
  }));
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
  await page.route('**/api/governance/adoption-metric**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ summary: {}, total: 0 }),
  }));
  await page.route('**/api/governance/portfolio-decision/confirm**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true }),
  }));
}

test.describe('Portfolio command surface @portfolio-command', () => {
  test('01 nav shows Portfolio Squads Actions Settings labels', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance', { waitUntil: 'domcontentloaded' });
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-priority-brief"]', { timeout: 120000 });
    const navText = await page.locator('.app-top-switcher, .app-sidebar-nav').first().innerText();
    expect(navText).toMatch(/Governance|Portfolio/i);
    expect(navText).toMatch(/Squads|Sprint/i);
    expect(navText).toMatch(/Actions/i);
    assertTelemetryClean(t);
  });

  test('02 priority brief renders headline and primary CTA', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-priority-brief"]', { timeout: 120000 });
    await expect(page.locator('[data-testid="governance-priority-headline"]')).toBeVisible();
    await expect(page.locator('[data-testid="governance-primary-action"], [data-testid="governance-headline-upload-cta"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="gov-cadence-pack"], [data-testid="portfolio-scope-breadcrumb"]')).toHaveCount(1);
    assertTelemetryClean(t);
  });

  test('03 comparison cards show squad status without duplicate exception surfaces', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-squad-comparison"] [data-portfolio-carousel]', { timeout: 120000 });
    await expect(page.locator('[data-testid="governance-squad-comparison"] [data-squad-key]')).not.toHaveCount(0);
    await expect(page.locator('[data-testid="governance-at-risk-table"], [data-testid="governance-exception-rail"]')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('04 at-risk rows are read-only — scope bar owns squad switch', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-priority-brief"]', { timeout: 120000 });
    await expect(page.locator('[data-governance-squad-select]')).toHaveCount(0);
    await expect(page.locator('[data-testid="governance-squad-comparison"] [data-squad-key]')).not.toHaveCount(0);
    await expect(page.locator('[data-testid="governance-priority-headline"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('05 primary CTA opens prepared actions flow', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 900, height: 900 });
    await mockPortfolioPage(page);
    let confirmed = false;
    await page.route('**/api/governance/portfolio-decision/confirm**', (route) => {
      confirmed = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-primary-action"]', { timeout: 120000 });
    await page.locator('[data-testid="governance-primary-action"]').click();
    await page.waitForTimeout(300);
    expect(confirmed).toBe(false);
    assertTelemetryClean(t);
  });

  test('06 legacy meeting answer blocks stay out of main portfolio path', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-priority-brief"]', { timeout: 120000 });
    await expect(page.locator('#portfolio-layout .gov-command-answer')).toHaveCount(0);
    await expect(page.locator('#portfolio-layout .gov-worker-receipt-rail')).toHaveCount(0);
    await expect(page.locator('#gov-brief-content')).toBeHidden();
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
    await page.waitForSelector('[data-testid="governance-priority-brief"]', { timeout: 120000 });
    const overlap = await getLayoutOverlapReport(page);
    const severe = (overlap?.pairs || []).filter((p) => p.overlapArea > 400);
    expect(severe.length).toBe(0);
    assertTelemetryClean(t);
  });

  test('10 portfolio scope capsule shows squad compare timeframe baseline without redundant selected label', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-portfolio-scope-filters]', { timeout: 120000 });
    await expect(page.locator('#portfolio-scope-selected')).toBeVisible();
    await expect(page.locator('[data-portfolio-scope-filters]')).not.toContainText(/Selected/i);
    await expect(page.locator('[data-testid="portfolio-scope-compare-tags"] .portfolio-scope-tag').first()).toBeVisible();
    const addSelect = page.locator('#portfolio-scope-add');
    if (await addSelect.isVisible()) {
      await expect(addSelect).toContainText(/Add comparison/i);
    }
    await expect(page.locator('#portfolio-scope-quarter')).toBeVisible();
    await expect(page.locator('#portfolio-scope-baseline')).toBeVisible();
    await expect(page.locator('#gov-copy-answer-scope')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('11 governance evidence opens from evidence action', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 900, height: 900 });
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-evidence-action"]', { timeout: 120000 });
    await page.locator('[data-testid="governance-evidence-action"]').click();
    await expect(page.locator('[data-evidence-proof-list], .gov-evidence-drawer-docked')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('12 mobile shows priority brief hero grid', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-priority-brief"]', { timeout: 120000 });
    await expect(page.locator('[data-testid="governance-agentic-panel"]')).toBeVisible();
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

  test('14 agentic panel has single primary CTA', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 900, height: 900 });
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-agentic-panel"]', { timeout: 120000 });
    await expect(page.locator('[data-testid="governance-primary-action"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="governance-human-decision"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('15 governance evidence drawer opens from evidence action', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-evidence-action"]', { timeout: 120000 });
    await page.locator('[data-testid="governance-evidence-action"]').click();
    await expect(page.locator('[data-evidence-proof-list], .gov-evidence-drawer-docked')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('16 comparison card drill-down keeps page on governance', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-squad-comparison"] [data-squad-key]', { timeout: 120000 });
    const urlBefore = page.url();
    await page.locator('[data-testid="governance-squad-comparison"] [data-squad-key]').first().click();
    await expect(page).toHaveURL(urlBefore);
    await expect(page.locator('[data-testid="governance-priority-headline"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('17 priority brief shows completed band', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-delivera-completed"]', { timeout: 120000 });
    await expect(page.locator('[data-testid="governance-delivera-completed"]')).toBeVisible();
    assertTelemetryClean(t);
  });
});

test.describe('Portfolio decision API cache', () => {
  test('second identical POST returns meta.cached true', async ({ request }) => {
    const briefId = `api-cache-test-${Date.now()}`;
    const body = {
      anchor: 'SD',
      compare: ['MAS'],
      periodKey: 'FY27 Q1',
      baseline: 'pi-baseline',
      brief: {
        projects: ['SD', 'MAS'],
        generatedAt: new Date().toISOString(),
        meta: { briefId, quarter: 'FY27 Q1' },
        squadInsights: [],
      },
      baselineMissing: false,
      partialSquads: 0,
    };
    const first = await request.post('/api/governance/portfolio-decision.json', { data: body });
    expect(first.ok()).toBeTruthy();
    const firstJson = await first.json();
    expect(firstJson.meta?.cached).not.toBe(true);

    const second = await request.post('/api/governance/portfolio-decision.json', { data: body });
    expect(second.ok()).toBeTruthy();
    const secondJson = await second.json();
    expect(secondJson.meta?.cached).toBe(true);
  });
});
