import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  getLayoutOverlapReport,
  getViewportClippingReport,
  openGovernanceDetailsPanel,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

const LAYOUT_BRIEF = {
  briefId: 'LAYOUT-AUDIT',
  projects: ['SD'],
  executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
  leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked', narratedBy: 'template' },
  meta: {
    narratedBy: 'template',
    commandAnswerSentence: 'DELIVERY BLOCKED — act today',
    safeToSend: true,
    sinceLastRun: { summary: 'Since last brief: +1 blocker' },
    piConfidence: {
      trusted: false,
      confidencePct: 42,
      headline: 'PI Confidence: Limited',
      timelineChips: [
        { issueKey: 'SD-1', title: 'Epic alpha', elapsedPct: 40, deliveryPct: 20, confidenceLabel: 'Low' },
        { issueKey: 'SD-2', title: 'Epic beta', elapsedPct: 55, deliveryPct: 35, confidenceLabel: 'Medium' },
      ],
      counts: { committed: 2, offPlan: 1, onTrack: 1, missingDates: 1, atRisk: 1 },
    },
    epicHygiene: { score: 40, epicCount: 4, weak: [{ issueKey: 'SD-1' }], bySquad: [{ squad: 'SD board', score: 40 }], suggestions: [] },
    workerReceipt: { line: 'Last run: 1m ago', inboxTotal: 3 },
    setupGaps: [{ id: 'pi-baseline', label: 'PI baseline missing', action: 'set-baseline', severity: 'high' }],
  },
  topRisks: [{
    issueKey: 'SD-1', assigneeName: 'Amani', decisionNeededFrom: 'Leadership',
    recommendedAction: 'Ping Amani', escalation: 'act-today', issueUrl: 'https://example/SD-1',
    displayTitle: 'Stuck item', summary: 'Stuck',
  }],
  evidencePack: {
    rows: [
      { issueKey: 'SD-1', statusNow: 'In Progress', statusLastWeek: 'To Do', whyFlagged: 'stale' },
      { issueKey: 'SD-2', statusNow: 'Blocked', statusLastWeek: 'In Progress', whyFlagged: 'blocked' },
    ],
  },
  poReadiness: {
    readinessLabel: 'Backlog needs clarification',
    signals: { noEstimate: 2, noAssignee: 1, addedAfterSprintStart: 3 },
  },
  baselineComparison: {
    piName: 'FY27 Q1',
    summary: { delivered: 4, onTrack: 2, delayed: 1 },
  },
  squadInsights: [],
};

async function mockLayoutGovernancePage(page) {
  await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'SD'); });
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(LAYOUT_BRIEF),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 5, byMetric: { leaderConfidence1to5: 3 } }),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      briefs: [{ id: 'b1', type: 'brief', summary: 'Ready', safeToSend: true, approvalRequired: false, payload: { owner: 'A', board: 'SD' } }],
      nudges: [{ id: 'n1', type: 'nudge', summary: 'Nudge', payload: { owner: 'B', board: 'SD' } }],
      piDrift: [], confirm: [], impact: [], poReadiness: [],
    }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 1, agents: [], lastImprovements: ['1 phrase'] }),
  }));
  await page.route('**/api/governance/scope-intelligence.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ scope: { cards: [{ projectKey: 'SD', health: 'blocked', sprint: 'active', epicCount: 1 }] }, boards: 1 }),
  }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ projects: ['SD'], boards: [{ id: 1, name: 'SD board', projectKey: 'SD' }], projectErrors: [] }),
  }));
}

const GOV_VIEWPORTS = [
  { width: 390, height: 844, label: 'mobile' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 1280, height: 900, label: 'desktop' },
];

test.describe('Governance layout overlap audit', () => {
  test.describe.configure({ mode: 'serial' });

  for (const vp of GOV_VIEWPORTS) {
    test(`governance ${vp.label} first paint has no clip or sibling overlap`, async ({ page }) => {
      const telemetry = captureBrowserTelemetry(page);
      await mockLayoutGovernancePage(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;

      await expect(page.locator('.gov-visual-answer-blocks, .gov-command-answer').first()).toBeVisible({ timeout: 15000 });

      const clipping = await getViewportClippingReport(page, {
        selectors: ['.governance-shell', '#gov-scope-bar-mount', '#gov-answer-mount', '#app-top-chrome'],
        maxLeftGapPx: vp.width >= 1200 ? 40 : 16,
        checkScrollSelectors: ['body'],
      });
      const hardOffenders = (clipping.offenders || []).filter((e) =>
        Number(e?.right || 0) > Number(clipping.viewportWidth || 0) + 1);
      expect(hardOffenders, JSON.stringify(hardOffenders)).toEqual([]);

      const overlap = await getLayoutOverlapReport(page, {
        selectors: [
          '#gov-scope-bar-mount .gov-scope-capsule-text',
          '#gov-scope-bar-mount .gov-scope-status-chip',
          '.governance-header-top',
          '.gov-visual-answer-blocks .gov-answer-block',
          '.gov-trust-chip-row .gov-send-badge',
          '.gov-do-first-strip',
        ],
      });
      expect(overlap.overlaps, JSON.stringify(overlap.overlaps)).toEqual([]);

      assertTelemetryClean(telemetry);
    });
  }

  test('governance collapsed chrome stays closed before scroll', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockLayoutGovernancePage(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page.locator('#gov-top-chrome-mount')).not.toHaveAttribute('open', /.+/);
    await expect(page.locator('#gov-secondary-chrome')).not.toHaveAttribute('open', /.+/);
    await expect(page.locator('#gov-supporting-evidence')).not.toHaveAttribute('open', /.+/);
    await expect(page.locator('#gov-top-chrome-mount .gov-top-chrome-summary')).toBeVisible();

    assertTelemetryClean(telemetry);
  });

  test('governance evidence and readiness tables scroll horizontally on mobile', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockLayoutGovernancePage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await openGovernanceDetailsPanel(page, 'gov-supporting-evidence');
    await expect(page.locator('#gov-evidence.data-table-scroll-wrap')).toBeVisible();
    await expect(page.locator('#gov-readiness .governance-readiness-chips')).toBeVisible();

    const wrapOverflow = await page.locator('#gov-evidence').evaluate((el) => getComputedStyle(el).overflowX);
    expect(wrapOverflow).toMatch(/auto|scroll/);

    assertTelemetryClean(telemetry);
  });

  test('governance micro-survey does not clip pills on mobile', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockLayoutGovernancePage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await openGovernanceDetailsPanel(page, 'gov-secondary-chrome');
    const survey = page.locator('.gov-micro-survey').first();
    if (await survey.count()) {
      const overflow = await survey.evaluate((el) => getComputedStyle(el).overflow);
      expect(overflow).not.toBe('hidden');
      const box = await survey.boundingBox();
      const pill = await page.locator('.gov-micro-pill').first().boundingBox();
      if (box && pill) {
        expect(pill.bottom).toBeLessThanOrEqual(box.bottom + 2);
      }
    }

    assertTelemetryClean(telemetry);
  });

  test('governance mobile keeps agent queue summary reachable', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockLayoutGovernancePage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page.locator('#gov-top-chrome-mount .gov-top-chrome-summary')).toBeVisible();
    await openGovernanceDetailsPanel(page, 'gov-top-chrome-mount');
    await expect(page.locator('[data-queue-open]')).toBeVisible();

    assertTelemetryClean(telemetry);
  });

  test('report mobile shell has no horizontal clip', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    const clipping = await getViewportClippingReport(page, {
      selectors: ['.container', 'header', '.main-layout'],
      maxLeftGapPx: 16,
    });
    expect(clipping.offenders).toEqual([]);
    assertTelemetryClean(telemetry);
  });

  test('current-sprint mobile columns drop fixed min-width', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const minWidth = await page.evaluate(() => {
      const col = document.querySelector('.capacity-column, .burndown-column, .health-column');
      return col ? getComputedStyle(col).minWidth : '0px';
    });
    expect(minWidth === '0px' || minWidth === 'auto').toBeTruthy();

    const clipping = await getViewportClippingReport(page, {
      selectors: ['.container', 'header', 'main'],
      maxLeftGapPx: 16,
      checkScrollSelectors: ['body'],
    });
    const bodyOverflow = (clipping.horizontalOverflow || []).filter((e) => e.selector === 'body');
    expect(bodyOverflow).toEqual([]);

    assertTelemetryClean(telemetry);
  });
});
