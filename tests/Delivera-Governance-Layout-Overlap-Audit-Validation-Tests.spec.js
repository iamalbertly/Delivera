import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  getLayoutOverlapReport,
  getViewportClippingReport,
  openGovernanceDetailsPanel,
  selectFirstBoard,
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

      await page.waitForFunction(() => (
        document.querySelector('.gov-owner-cluster')
        || document.querySelector('.gov-visual-answer-blocks')
        || document.querySelector('.gov-command-answer')
      ), { timeout: 15000 });
      const hasOwnerCluster = await page.locator('.gov-owner-cluster').count() > 0;
      if (hasOwnerCluster && vp.width <= 768) {
        await expect(page.locator('.gov-owner-cluster').first()).toBeVisible();
      } else {
        await expect(page.locator('.gov-command-answer, .gov-visual-answer-blocks').first()).toBeVisible();
      }

      const clipping = await getViewportClippingReport(page, {
        selectors: ['.governance-shell', '#gov-scope-bar-mount', '#gov-answer-mount', '#app-top-chrome'],
        maxLeftGapPx: vp.width >= 1200 ? 40 : 16,
        checkScrollSelectors: ['body'],
      });
      const hardOffenders = (clipping.offenders || []).filter((e) =>
        Number(e?.right || 0) > Number(clipping.viewportWidth || 0) + 1);
      expect(hardOffenders, JSON.stringify(hardOffenders)).toEqual([]);

      const contentOverlap = await getLayoutOverlapReport(page, {
        selectors: [
          '#gov-scope-bar-mount .gov-scope-capsule-text',
          '#gov-scope-bar-mount .gov-scope-status-chip',
          '.governance-header-top',
          '.gov-visual-answer-blocks .gov-answer-block',
          '.gov-trust-chip-row .gov-send-badge',
          '.gov-do-first-strip',
          '.gov-do-first-prefix',
          '.gov-do-first-action',
          '.gov-do-first-strip .btn',
          '.gov-owner-cluster-head',
          '.gov-owner-cluster-head .gov-send-badge',
        ],
      });
      expect(contentOverlap.overlaps, JSON.stringify(contentOverlap.overlaps)).toEqual([]);

      if (vp.width <= 768) {
        const chromeOverlap = await getLayoutOverlapReport(page, {
          selectors: [
            '#app-top-chrome .app-top-switcher-item',
            '#app-top-chrome .app-top-search-wrap',
            '#app-top-chrome [data-top-action="create-work"]',
            '#app-top-chrome [data-top-action="notifications"]',
          ],
        });
        expect(chromeOverlap.overlaps, JSON.stringify(chromeOverlap.overlaps)).toEqual([]);

        const scopeOverlap = await getLayoutOverlapReport(page, {
          selectors: [
            '#gov-scope-refresh',
            '#gov-scope-change',
            '#app-notification-dock',
            '.gov-command-answer',
            '.gov-owner-cluster-head',
          ],
        });
        expect(scopeOverlap.overlaps, JSON.stringify(scopeOverlap.overlaps)).toEqual([]);
      }

      assertTelemetryClean(telemetry);
    });
  }

  test('governance loading shell visible before brief resolves', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'SD'); });
    await routeProjectsCatalog(page);
    await page.route('**/api/governance-brief.json**', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAYOUT_BRIEF) });
    });
    await page.route('**/api/quarters-list**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
    }));
    await page.route('**/api/governance/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route('**/api/boards.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ projects: ['SD'], boards: [{ id: 1, name: 'SD board', projectKey: 'SD' }], projectErrors: [] }),
    }));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#gov-loading')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.gov-command-answer, .gov-visual-answer-blocks').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#gov-loading')).toBeHidden();
    assertTelemetryClean(telemetry);
  });

  test('governance collapsed secondary chrome stays closed; queue opens when inbox pending', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockLayoutGovernancePage(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page.locator('#gov-top-chrome-mount')).toHaveJSProperty('open', true);
    await expect(page.locator('#gov-secondary-chrome')).toHaveJSProperty('open', false);
    await expect(page.locator('#gov-supporting-evidence')).toHaveJSProperty('open', false);

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
    await page.locator('[data-evidence-tab="plan"]').click();
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

  test('governance mobile owner clusters appear above fold without command CTA overlap', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockLayoutGovernancePage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    const cluster = page.locator('.gov-owner-cluster').first();
    await expect(cluster).toBeVisible({ timeout: 15000 });

    const aboveFold = await page.evaluate(() => {
      const el = document.querySelector('.gov-owner-cluster');
      if (!el) return false;
      const top = el.getBoundingClientRect().top;
      return top < window.innerHeight * 0.55;
    });
    expect(aboveFold).toBeTruthy();

    await expect(page.locator('.gov-do-first-strip')).toHaveCount(0);
    await expect(page.locator('#gov-scroll-first-nudge')).toHaveCount(0);
    await expect(page.locator('#gov-review-actions')).toHaveCount(0);

    const overlap = await getLayoutOverlapReport(page, {
      selectors: ['#gov-scope-refresh', '.gov-command-actions', '.gov-owner-cluster', '#gov-action-clusters-mount'],
      maxPairs: 32,
    });
    expect(overlap.truncated).toBeFalsy();
    expect(overlap.overlaps, JSON.stringify(overlap.overlaps)).toEqual([]);

    assertTelemetryClean(telemetry);
  });

  test('governance mobile owner clusters hide duplicate do-first strip CTA', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockLayoutGovernancePage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page.locator('.gov-owner-cluster')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.gov-do-first-strip')).toHaveCount(0);
    await expect(page.locator('#gov-scroll-first-nudge')).toHaveCount(0);

    assertTelemetryClean(telemetry);
  });

  test('governance mobile seeded notifications keep dock off scope refresh on first paint', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.addInitScript(() => {
      localStorage.setItem('appNotificationsV1', JSON.stringify({
        total: 2,
        missingEstimate: 1,
        missingLogged: 1,
        boardName: 'SD',
        sprintName: 'Sprint 1',
      }));
    });
    await mockLayoutGovernancePage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page.locator('#gov-scope-refresh')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#app-notification-dock')).toHaveCount(0);

    const overlap = await getLayoutOverlapReport(page, {
      selectors: ['#gov-scope-refresh', '#app-notification-dock', '.gov-command-answer'],
    });
    expect(overlap.overlaps, JSON.stringify(overlap.overlaps)).toEqual([]);

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

  for (const vp of GOV_VIEWPORTS) {
    test(`report ${vp.label} sub-chrome and shell have no clip or overlap`, async ({ page }) => {
      const telemetry = captureBrowserTelemetry(page);
      await page.route('**/api/governance/worker-receipt.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ workerReceipt: { inboxTotal: 2 }, setupGaps: [], sinceLastRun: { summary: 'Since last brief: +1' } }),
      }));
      await page.route('**/api/governance/pi-confidence.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ piConfidence: { headline: 'PI n/a' } }),
      }));
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/report');
      if (await skipIfRedirectedToLogin(page, test)) return;

      await expect(page.locator('#app-top-chrome')).toBeAttached({ timeout: 15000 });
      await expect(page.locator('#app-sub-chrome-slot')).toBeAttached({ timeout: 15000 });
      await expect(page.locator('#report-filter-strip-summary')).toBeAttached();

      const clipping = await getViewportClippingReport(page, {
        selectors: ['.container', 'header', '#app-sub-chrome-slot'],
        maxLeftGapPx: vp.width >= 1200 ? 40 : (vp.width <= 390 ? 16 : 28),
      });
      expect(clipping.offenders).toEqual([]);

      const overlap = await getLayoutOverlapReport(page, {
        selectors: [
          '#app-top-chrome .app-top-switcher-item',
          '#app-top-chrome .app-top-search-wrap',
          '#app-top-chrome [data-top-action="notifications"]',
          '#app-sub-chrome-slot .gov-global-pill',
          '#report-filter-strip',
        ],
        maxPairs: 40,
      });
      expect(overlap.truncated).toBeFalsy();
      expect(overlap.overlaps, JSON.stringify(overlap.overlaps)).toEqual([]);

      assertTelemetryClean(telemetry);
    });
  }

  test('report mobile context bar uses unified filter strip summary', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page.locator('#report-filter-strip-summary')).toBeVisible();
    await expect(page.locator('#report-proof-summary')).toHaveCount(0);

    assertTelemetryClean(telemetry);
  });

  for (const vp of GOV_VIEWPORTS) {
    test(`current-sprint ${vp.label} sub-chrome and header have no clip or overlap`, async ({ page }) => {
      const telemetry = captureBrowserTelemetry(page);
      await page.route('**/api/governance/worker-receipt.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ workerReceipt: { inboxTotal: 1 }, setupGaps: [{ id: 'g1' }], sinceLastRun: null }),
      }));
      await page.route('**/api/governance/pi-confidence.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ piConfidence: { headline: 'PI Confidence: Limited' } }),
      }));
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

      await expect(page.locator('#app-top-chrome')).toBeAttached({ timeout: 15000 });
      await expect(page.locator('#app-sub-chrome-slot')).toBeAttached({ timeout: 15000 });

      const clipping = await getViewportClippingReport(page, {
        selectors: ['.container', 'main', '#app-sub-chrome-slot'],
        maxLeftGapPx: vp.width >= 1200 ? 40 : 16,
        checkScrollSelectors: ['body'],
      });
      const bodyOverflow = (clipping.horizontalOverflow || []).filter((e) => e.selector === 'body');
      expect(bodyOverflow).toEqual([]);

      const overlap = await getLayoutOverlapReport(page, {
        selectors: [
          '#app-top-chrome .app-top-switcher-item',
          '#app-top-chrome .app-top-search-wrap',
          '#app-sub-chrome-slot .gov-global-pill',
          '.current-sprint-header-bar',
          '#app-top-chrome [data-top-action="notifications"]',
        ],
        maxPairs: 40,
      });
      expect(overlap.truncated).toBeFalsy();
      expect(overlap.overlaps, JSON.stringify(overlap.overlaps)).toEqual([]);

      assertTelemetryClean(telemetry);
    });
  }

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

    assertTelemetryClean(telemetry);
  });

  test('current-sprint loads global status pills in sub-chrome slot', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.route('**/api/governance/worker-receipt.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ workerReceipt: { inboxTotal: 4 }, setupGaps: [], sinceLastRun: null }),
    }));
    await page.route('**/api/governance/pi-confidence.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ piConfidence: { headline: 'PI n/a' } }),
    }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await expect(page.locator('#app-sub-chrome-slot #gov-global-agent-bar')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#app-sub-chrome-slot .gov-global-pill').first()).toBeVisible();

    assertTelemetryClean(telemetry);
  });

  test('current-sprint mobile header compact strip above fold after load', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const boardValue = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardValue) {
      test.skip(true, 'No current sprint board available');
      return;
    }

    await page.waitForSelector('.current-sprint-header-bar, #current-sprint-error', { timeout: 45000 }).catch(() => null);
    const headerBar = page.locator('.current-sprint-header-bar').first();
    if (!(await headerBar.isVisible().catch(() => false))) {
      test.skip(true, 'Sprint header unavailable for current dataset');
      return;
    }

    await page.evaluate(() => window.scrollTo(0, 0));

    const aboveFold = await page.evaluate(() => {
      const el = document.querySelector('.current-sprint-header-bar .header-compact-strip')
        || document.querySelector('.current-sprint-header-bar .header-band-main');
      if (!el) return false;
      const subChrome = document.getElementById('app-sub-chrome-slot');
      const chromeBottom = subChrome
        ? subChrome.getBoundingClientRect().bottom
        : (document.getElementById('app-top-chrome')?.getBoundingClientRect().bottom || 56);
      return el.getBoundingClientRect().top < chromeBottom + window.innerHeight * 0.42;
    });
    expect(aboveFold).toBeTruthy();

    assertTelemetryClean(telemetry);
  });
});
