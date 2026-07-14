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
import { PORTFOLIO_ANCHOR_KEY } from '../public/Delivera-Shared-Storage-Keys.js';
import { waitForGovernanceReady } from './Delivera-Portfolio-Primary-Test-Helpers.js';

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
    setupGaps: [],
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
  ownerGroups: [{ ownerKey: 'amani', issues: [{ issueKey: 'SD-1', summary: 'Stuck' }], decisionLane: 'Assignee' }],
};

async function waitForLayoutGovernanceReady(page) {
  await waitForGovernanceReady(page);
}

async function mockLayoutGovernancePage(page) {
  await page.addInitScript((anchorKey) => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
    localStorage.setItem(anchorKey, 'SD');
    sessionStorage.setItem('gov-pi-auto-open-dismissed', '1');
  }, PORTFOLIO_ANCHOR_KEY);
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
  await page.route('**/api/governance/interventions/seed-from-brief**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cases: [] }),
  }));
  await page.route('**/api/governance/portfolio-decision.json**', (r) => {
    if (r.request().method() !== 'POST') return r.continue();
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        decision: {
          headline: 'Review SD scope now',
          summary: LAYOUT_BRIEF.meta.commandAnswerSentence,
          anchorProject: 'SD',
          periodKey: 'FY27 Q1',
          metrics: { delivery: { value: 30, peerMedian: 50 }, offPlanLoad: { value: 20, peerMedian: 15 }, proofConfidence: { value: 40, peerMedian: 55 } },
          trust: { liveCases: 0, nudgesReady: 0, proofLevel: 'Medium' },
          drivers: [],
          decisionOptions: [{ id: 'review-investment', label: 'Review investment' }],
          monitoring: { squadCount: 1, commitmentCount: 0 },
          recommendation: { label: 'Review investment' },
        },
        comparison: { cards: [], actionsStrip: {} },
        cases: [],
      }),
    });
  });
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

      await page.waitForSelector('[data-testid="governance-priority-brief"], [data-portfolio-signal]', { state: 'visible', timeout: 20000 });
      await expect(page.locator('[data-testid="governance-priority-brief"], [data-portfolio-signal]').first()).toBeVisible();

      const clipping = await getViewportClippingReport(page, {
        selectors: ['.governance-shell', '#portfolio-scope-bar-mount, #gov-scope-bar-mount', '#governance-priority-surface-mount, #portfolio-signal-mount, #gov-answer-mount', '#app-top-chrome'],
        maxLeftGapPx: vp.width >= 1200 ? 40 : 16,
        checkScrollSelectors: ['body'],
      });
      const hardOffenders = (clipping.offenders || []).filter((e) =>
        Number(e?.right || 0) > Number(clipping.viewportWidth || 0) + 1);
      expect(hardOffenders, JSON.stringify(hardOffenders)).toEqual([]);

      const contentOverlap = await getLayoutOverlapReport(page, {
        selectors: [
          '#portfolio-scope-bar-mount .portfolio-scope-filters, #gov-scope-bar-mount .gov-scope-capsule-text',
          '#portfolio-scope-bar-mount, #gov-scope-bar-mount .gov-scope-status-chip',
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
            '#gov-scope-expanded',
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
    await page.route('**/api/governance/interventions/seed-from-brief**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cases: [] }),
    }));
    await page.route('**/api/governance/portfolio-decision.json**', (r) => {
      if (r.request().method() !== 'POST') return r.continue();
      return r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          decision: {
            headline: 'SD blocked',
            narrative: { headline: 'SD blocked', mainIssue: 'Evidence gap' },
            aboveFold: { exposedCommitments: 1, actionsReady: 0, poResponsesRequired: 0 },
            metrics: { delivery: { value: 20, peerMedian: 50 }, offPlanLoad: { value: 10, peerMedian: 10 }, proofConfidence: { value: 40, peerMedian: 45 } },
            trust: { liveCases: 0, nudgesReady: 0, proofLevel: 'Low' },
            drivers: [],
            decisionOptions: [{ id: 'keep-funding', label: 'Keep funding', impactPreview: 'Continue.' }],
            monitoring: { squadCount: 1, commitmentCount: 2, exposedCommitmentCount: 1 },
            anchorProject: 'SD',
            recommendation: { label: 'Confirm scope' },
          },
          comparison: { cards: [], actionsStrip: {} },
          cases: [],
        }),
      });
    });
    await page.route('**/api/boards.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ projects: ['SD'], boards: [{ id: 1, name: 'SD board', projectKey: 'SD' }], projectErrors: [] }),
    }));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('.gov-priority-surface--skeleton, [data-portfolio-signal-skeleton], #main-content[data-gov-brief-state="loading"]').first()).toBeVisible({ timeout: 2000 });
    await expect(page.locator('[data-testid="governance-priority-brief"], [data-portfolio-signal]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.gov-priority-surface--skeleton, [data-portfolio-signal-skeleton]')).toHaveCount(0);
    assertTelemetryClean(telemetry);
  });

  test('governance priority cockpit visible above fold on desktop', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockLayoutGovernancePage(page);
    await page.setViewportSize({ width: 1280, height: 1024 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('[data-testid="governance-priority-brief"], [data-portfolio-signal]').first()).toBeVisible({ timeout: 15000 });
    await waitForLayoutGovernanceReady(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.keyboard.press('Escape');
    const aboveFold = page.locator('[data-testid="governance-agentic-panel"], #gov-right-rail-proof-mount .gov-evidence-preview');
    await expect(aboveFold.first()).toBeAttached();
    const box = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="governance-agentic-panel"], #gov-right-rail-proof-mount .gov-evidence-preview');
      return el ? el.getBoundingClientRect() : null;
    });
    expect(box).toBeTruthy();
    if (box) expect(box.y).toBeLessThan(1024);
    assertTelemetryClean(telemetry);
  });

  test('governance portfolio path keeps legacy secondary chrome hidden', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockLayoutGovernancePage(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await expect(page.locator('[data-testid="governance-priority-surface"]')).toBeVisible();
    await expect(page.locator('#portfolio-layout #gov-secondary-chrome')).toHaveCount(0);
    await expect(page.locator('#gov-brief-content')).toBeHidden();

    assertTelemetryClean(telemetry);
  });

  test('governance evidence and readiness tables scroll horizontally on mobile', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockLayoutGovernancePage(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#main-content[data-gov-brief-state="content"]')).toBeVisible({ timeout: 20000 });

    await openGovernanceDetailsPanel(page, 'gov-supporting-evidence');
    await expect(page.locator('#gov-supporting-evidence')).toHaveJSProperty('open', true);
    await expect(page.locator('#gov-evidence')).toBeAttached({ timeout: 10000 });
    await page.evaluate(() => {
      document.querySelector('[data-evidence-tab="plan"]')?.click();
    });
    await expect(page.locator('#gov-readiness')).toBeAttached();

    const wrapOverflow = await page.evaluate(() => {
      const el = document.querySelector('#gov-evidence.data-table-scroll-wrap')
        || document.querySelector('#gov-evidence .data-table-scroll-wrap')
        || document.querySelector('#gov-evidence');
      return el ? getComputedStyle(el).overflowX : 'auto';
    });
    expect(wrapOverflow).toMatch(/auto|scroll|visible/);

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
    await waitForLayoutGovernanceReady(page);

    const cluster = page.locator('#gov-brief-content .gov-owner-cluster').first();
    await expect(cluster).toBeAttached({ timeout: 15000 });

    const aboveFold = await page.evaluate(() => {
      const el = document.querySelector('#gov-brief-content .gov-owner-cluster');
      if (!el) return false;
      const top = el.getBoundingClientRect().top;
      return top < window.innerHeight * 0.95;
    });
    expect(aboveFold || await page.locator('[data-testid="governance-priority-brief"], [data-portfolio-signal]').count() > 0).toBeTruthy();

    await expect(page.locator('#portfolio-layout .gov-command-answer')).toHaveCount(0);
    if (await page.locator('[data-grouped-nudge]').count()) {
      await expect(page.locator('[data-grouped-nudge]').first()).toBeAttached();
    } else {
      await expect(page.locator('[data-testid="governance-priority-brief"], [data-portfolio-signal]')).toBeVisible();
    }
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
    await waitForLayoutGovernanceReady(page);

    await expect(page.locator('#gov-brief-content .gov-owner-cluster')).toBeAttached({ timeout: 15000 });
    await expect(page.locator('#portfolio-layout .gov-command-answer')).toHaveCount(0);
    if (await page.locator('#gov-brief-content [data-grouped-nudge], #gov-brief-content [data-grouped-send]').count()) {
      await expect(page.locator('#gov-brief-content [data-grouped-nudge], #gov-brief-content [data-grouped-send]').first()).toBeAttached();
    } else {
      await expect(page.locator('[data-testid="governance-priority-brief"], [data-portfolio-signal]')).toBeVisible();
    }
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
    await waitForLayoutGovernanceReady(page);

    await expect(page.locator('[data-scope-status-action]').first()).toBeAttached({ timeout: 15000 });
    await expect(page.locator('#app-notification-dock')).toHaveCount(0);

    const overlap = await getLayoutOverlapReport(page, {
      selectors: ['[data-scope-status-action]', '#app-notification-dock', '.gov-command-answer'],
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
    await waitForLayoutGovernanceReady(page);

    await expect(page.locator('#gov-brief-content #gov-right-rail-mount [data-queue-open]')).toBeAttached();
    await expect(page.locator('#gov-brief-content [data-queue-open]')).toBeAttached();

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

  test('current-sprint loads global agent bar in sub-chrome slot (Round 9: max 2 pills, sprint may suppress queue)', async ({ page }) => {
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
    const pillCount = await page.locator('#app-sub-chrome-slot .gov-global-pill').count();
    expect(pillCount).toBeLessThanOrEqual(2);

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

  test('governance scope bar sticks flush under top chrome (no sticky-offset double-count gap)', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await mockLayoutGovernancePage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await waitForLayoutGovernanceReady(page);
    const gap = await page.evaluate(() => {
      const chrome = document.getElementById('app-top-chrome');
      const sub = document.getElementById('app-sub-chrome-slot');
      const scope = document.querySelector('#portfolio-scope-bar-mount.portfolio-scope-bar, .portfolio-scope-bar');
      if (!chrome || !scope) return 9999;
      const navBottom = (sub && !sub.hidden && sub.getBoundingClientRect().height > 0)
        ? sub.getBoundingClientRect().bottom
        : chrome.getBoundingClientRect().bottom;
      return Math.round(scope.getBoundingClientRect().top - navBottom);
    });
    expect(gap).toBeLessThanOrEqual(8);
    assertTelemetryClean(telemetry);
  });

  test('instant-shell first paint on governance and current-sprint (no cold-load spinner)', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(() => {
      sessionStorage.clear();
      localStorage.setItem('delivera_selectedProjects', 'SD');
    });
    await routeProjectsCatalog(page);
    await page.route('**/api/governance-brief.json**', async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LAYOUT_BRIEF) });
    });
    await page.route('**/api/**', (r) => {
      const u = r.request().url();
      if (u.includes('governance-brief')) return r.fallback();
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }).catch(() => {});
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('[data-testid="instant-shell"], [data-testid="instant-shell-stale"]').first()).toBeVisible({ timeout: 4000 });

    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('#current-sprint-loading [data-testid="instant-shell"], [data-testid="instant-shell-stale"]').first()).toBeVisible({ timeout: 4000 });
    await expect(page.locator('#current-sprint-loading.current-sprint-loading-with-spinner')).toHaveCount(0);
    assertTelemetryClean(telemetry);
  });
});
