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
  const decisionPayload = {
    ok: true,
    decision: {
      headline: 'DMS needs a scope and proof decision today',
      summary: 'DMS has active cases across exposed commitments. Proof confidence differs from peers.',
      anchorProject: 'SD',
      periodKey: 'FY27 Q1',
      recommendation: { id: 'review-scope', label: 'Confirm scope and proof before investment review' },
      narrative: {
        headline: 'DMS needs a scope and proof decision today',
        mainIssue: 'Evidence gap, not yet proven delivery failure',
        recommendedDecision: 'Confirm scope and proof before investment review',
        nextDeadline: 'Today 15:00',
        escalationReady: true,
      },
      aboveFold: { exposedCommitments: 2, actionsReady: 1, poResponsesRequired: 1, nextDeadline: 'Today 15:00', mainIssue: 'Evidence gap' },
      peerComparison: { sentence: 'DMS and peer squads both show low confirmed delivery. The current difference is evidence quality.', deliveryBothZero: true },
      epicLineage: {
        primary: { epicKey: 'SD-100', title: 'Recharge Growth Modernization', storyCount: 2 },
        epics: [{ epicKey: 'SD-100', title: 'Recharge Growth Modernization', storyCount: 2 }],
        count: 1,
        coveredStoryCount: 2,
        unalignedStoryCount: 1,
        unalignedStories: [{ issueKey: 'SD-9090', title: 'Emergency customer remediation without PI Epic', status: 'In Progress' }],
        affectedCommitmentCount: 1,
        label: 'SD-100: Recharge Growth Modernization',
        hasLineage: true,
      },
      affectedCommitments: [
        { id: 'c1', title: 'Recharge Growth Trends', status: 'At risk', reason: 'Scope outside PI baseline', decisionNeeded: 'Confirm scope', periodKey: 'FY27 Q1', projectKey: 'SD' },
      ],
      preparedActions: {
        groups: [{ role: 'Product Owner', count: 1, label: '1 Product Owner' }],
        items: [{ role: 'Product Owner', action: 'Confirm scope with PO', owner: 'Product Owner', caseId: 'SD-FY27Q1-20260622-01' }],
        nextDeadline: 'Today 15:00',
        escalationReady: true,
        poResponsesRequired: 1,
        totalReady: 1,
      },
      metrics: {
        delivery: { value: 27, peerMedian: 61, expectedTarget: 50, methodLabel: 'Progress by issue count' },
        offPlanLoad: { value: 42, peerMedian: 21, expectedTarget: 50, methodLabel: 'Baseline deviation' },
        proofConfidence: { value: 38, peerMedian: 62, expectedTarget: 70, methodLabel: 'Evidence strength' },
      },
      trust: { liveCases: 1, nudgesReady: 1, pending: 0, proofLevel: 'Medium' },
      drivers: [
        { id: 'impact-exposure', title: 'Impact exposure', summary: '2 DMS commitments may miss FY27 Q1.' },
        { id: 'evidence-weakness', title: 'Evidence weakness', summary: 'Only 38% of required proof is available.' },
      ],
      decisionProgression: [
        { step: 'insufficient-proof', label: 'Insufficient proof', active: true },
        { step: 'confirm-scope', label: 'Confirm scope', active: true },
      ],
      decisionBasis: { why: 'Confirm scope and proof before investment review', preparedNudges: 1, nextCheckpoint: 'Today 15:00' },
      timebox: { elapsedDays: 45, totalDays: 90 },
      monitoring: { squadCount: 3, commitmentCount: 18, exposedCommitmentCount: 2 },
    },
    comparison: {
      cards: [
        { projectKey: 'SD', squadName: 'DMS Squad', selected: true, status: 'At risk', statusClass: 'at-risk', mainIssue: 'Scope and proof', affectedCommitmentCount: 2, decisionNeeded: 'Confirm scope and proof', nextAction: 'Review 1 prepared nudge', metrics: { delivered: 27, offPlanLoad: 42, proofConfidence: 38, commitments: 5 }, explanation: 'DMS Squad: High off-plan work and weak proof are driving low delivery.', hidePrimaryCta: true },
        { projectKey: 'MAS', squadName: 'Mini Apps Squad', selected: false, status: 'Watch', statusClass: 'watch', mainIssue: 'Proof confidence', affectedCommitmentCount: 1, decisionNeeded: 'Continue monitoring', nextAction: 'Monitor next checkpoint', metrics: { delivered: 61, offPlanLoad: 21, proofConfidence: 62, commitments: 6 }, explanation: 'Mini Apps Squad: Delivery cannot be confirmed yet, but proof confidence is 62%.' },
      ],
      actionsStrip: { nudgesReady: 1, pending: 0, proofLevel: 'Medium' },
    },
    cases: [{ id: 'SD-FY27Q1-20260622-01', project: 'SD' }],
    meta: { cached: false, cacheTtlMs: 10800000 },
  };
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

  test('02 portfolio signal renders compact metrics, commitments, and trust row', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-portfolio-signal]', { timeout: 120000 });
    await expect(page.locator('[data-portfolio-signal]')).toContainText(/AI portfolio signal/i);
    await expect(page.locator('#portfolio-signal-mount + #portfolio-rail-carousel-mount')).toHaveCount(1);
    await expect(page.locator('.portfolio-gauge')).toHaveCount(0);
    await expect(page.locator('.portfolio-metric-row .portfolio-progress-row')).toHaveCount(3);
    await expect(page.locator('[data-portfolio-timebox-rail]')).toContainText(/Day 45 of 90/i);
    await expect(page.locator('[data-portfolio-reconciler]')).toContainText(/Live Jira epic/i);
    await expect(page.locator('[data-portfolio-commitments]')).toBeVisible();
    await expect(page.locator('[data-portfolio-epic-lineage]')).toContainText(/Recharge Growth Modernization/i);
    await expect(page.locator('[data-portfolio-unaligned-stories]')).toContainText(/missing aligned Epic/i);
    await expect(page.locator('[data-portfolio-unaligned-stories] [data-jira-work-item-link]')).toHaveAttribute('title', /Emergency customer remediation/i);
    await expect(page.locator('.portfolio-commitment-title [data-jira-work-item-link]').first()).toHaveAttribute('title', /Recharge/i);
    await expect(page.locator('[data-trust-live-cases]')).toContainText(/live case/i);
    await expect(page.locator('[data-portfolio-calibration-inline] [data-portfolio-action="copy-calibration-defense"]')).toBeVisible();
    await expect(page.locator('[data-calibration-format]')).toHaveCount(3);
    await expect(page.locator('.portfolio-performance-matrix')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('03 performance grid has distinct squad root issues', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('.portfolio-performance-grid-row', { timeout: 120000 });
    const texts = await page.locator('.portfolio-grid-issue').allTextContents();
    expect(texts.length).toBeGreaterThanOrEqual(2);
    expect(new Set(texts).size).toBeGreaterThan(1);
    assertTelemetryClean(t);
  });

  test('04 performance grid supports keyboard navigation control', async ({ page }) => {
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
    await page.waitForSelector('[data-portfolio-signal]', { timeout: 120000 });
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
    await expect(page.locator('[data-portfolio-scope-filters]')).toContainText(/\+2 Squads/i);
    await expect(page.locator('[data-portfolio-scope-filters]')).toContainText(/\+ Add comparison/i);
    await expect(page.locator('#portfolio-scope-quarter')).toBeVisible();
    await expect(page.locator('#portfolio-scope-baseline')).toBeVisible();
    await expect(page.locator('#gov-copy-answer-scope')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('11 calibration defense shows inline excerpt with copy CTA', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-portfolio-calibration-inline]', { timeout: 120000 });
    await expect(page.locator('[data-portfolio-action="copy-calibration-defense"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('12 mobile tablet shows decision rail before performance grid without scroll', async ({ page }) => {
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

  test('14 decision panel shows commitment tracking matrix instead of funding choices', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('#portfolio-decision', { timeout: 120000 });
    await expect(page.locator('.portfolio-performance-matrix')).toContainText(/Commitment tracking/i);
    await expect(page.locator('#portfolio-decision')).not.toContainText(/Keep funding/i);
    await expect(page.locator('#portfolio-decision')).not.toContainText(/Review investment/i);
    assertTelemetryClean(t);
  });

  test('15 calibration defense copy is one-click from signal', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForFunction(
      () => document.querySelector('[data-portfolio-action="copy-calibration-defense"]')
        && !document.querySelector('.portfolio-signal-error'),
      { timeout: 120000 },
    );
    const btn = page.locator('[data-portfolio-action="copy-calibration-defense"]').first();
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await expect(page.locator('.portfolio-signal-error')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('16 clicking squad card updates selected scope control', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-squad-key="MAS"]', { timeout: 120000 });
    await page.locator('[data-squad-key="MAS"] .portfolio-grid-issue').click();
    await expect(page.locator('#portfolio-scope-selected')).toHaveValue('MAS');
    assertTelemetryClean(t);
  });

  test('17 portfolio shows AI agent learning badge with pulse', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPortfolioPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-ai-agent-badge]', { timeout: 120000 });
    await expect(page.locator('[data-portfolio-signal] [data-ai-agent-badge]')).toBeVisible();
    await expect(page.locator('[data-portfolio-signal] .portfolio-ai-agent-text')).toContainText(/AI agent/i);
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
