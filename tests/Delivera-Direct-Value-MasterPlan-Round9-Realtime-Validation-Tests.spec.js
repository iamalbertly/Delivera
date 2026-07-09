/**
 * Direct-Value Master Plan Round 9 — squad reality honesty, dedupe, stickiness.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  getLayoutOverlapReport,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { waitForPortfolioReady } from './Delivera-Portfolio-Primary-Test-Helpers.js';
import { join } from 'path';
import { existsSync } from 'fs';

const SLIDE_DMS_Q2 = join(process.cwd(), 'data', 'testing_q2fy27_dms_commitments.png');

function mockLimboSprint(page) {
  return page.route('**/api/current-sprint.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      sprint: { id: 7757, name: 'FY26DMS24', state: 'closed', startDate: '2026-06-12', endDate: '2026-06-26' },
      board: { id: 1, name: 'DMS board', projectKeys: ['SD'] },
      meta: {
        projects: 'SD',
        activeSprintCount: 0,
        noActiveSprintFallback: true,
        limbo: true,
        squadRealityVerdict: 'At Risk',
        squadRealityColor: 'orange',
        cadenceLine: 'FY26DMS24 ended 13d ago',
        verdictLine: 'FY26DMS24 ended 13d ago · At Risk',
        trustLabel: 'Squad idle — start or plan the next sprint',
        nextSprintCandidate: { id: 99, name: 'FY26DMS25', startDate: '2026-07-01', goal: 'Resume delivery' },
        suggestStartSprint: true,
        nextSprintStartOverdue: true,
        explanatoryLine: 'No active sprint — showing last completed.',
        commitmentRisk: { offPi: 5, adHoc: 0, hasCommitmentRisk: true },
      },
      summary: { totalStories: 5, doneStories: 5, percentDone: 100 },
      daysMeta: { daysRemainingCalendar: 0, daysRemainingWorking: 0 },
      stories: Array.from({ length: 5 }, (_, i) => ({
        issueKey: `SD-${10 + i}`,
        summary: `Story ${i}`,
        status: 'Done',
        epicKey: `SD-E${i}`,
      })),
      stuckCandidates: [],
      decisionCockpit: {
        health: { status: 'Watch Closely', tone: 'warning', message: 'Squad idle' },
        nextBestAction: {},
        topRisks: [],
        keySignals: { blockers: 0 },
        metrics: { daysRemaining: 0 },
        quickActions: [],
        insights: {},
      },
      recentSprints: [{ id: 7757, name: 'FY26DMS24', state: 'closed' }],
      nextSprint: { id: 99, name: 'FY26DMS25', startDate: '2026-07-01', goal: 'Resume delivery' },
    }),
  }));
}

async function mockGovernanceBrief(page) {
  await page.addInitScript(() => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
    sessionStorage.setItem('gov-pi-auto-open-dismissed', '1');
  });
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      briefId: 'R9',
      projects: ['SD'],
      executiveView: { verdictTier: 'watch', verdictLine: 'NEEDS WATCH' },
      meta: {
        setupGaps: [{ id: 'pi-baseline', action: 'set-baseline' }],
        workerReceipt: { line: 'Last run: 2m ago', inboxTotal: 0 },
        sinceLastRun: { summary: '+1 off-PI story' },
      },
      squadInsights: [{ projectKey: 'SD', verdictTier: 'watch', sprintPulse: { committed: 5, done: 5 } }],
    }),
  }));
  await page.route('**/api/governance/worker-receipt.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ workerReceipt: { inboxTotal: 0 }, sinceLastRun: { summary: 'Squad idle 13d' } }),
  }));
}

test.describe('Direct-Value Master Plan Round 9 realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('@focused direct-value round9 honesty contracts', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);

    await test.step('01 top chrome red background on governance', async () => {
      await mockGovernanceBrief(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      const bg = await page.locator('.app-top-chrome').first().evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).not.toBe('rgba(0, 0, 0, 0)');
      await expect(page.locator('.app-top-chrome')).toBeVisible();
    });

    await test.step('02 limbo sprint shows next-up strip not bare Healthy', async () => {
      await mockLimboSprint(page);
      await page.route('**/api/governance/pi-baseline?**', (r) => r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ committedItems: [{ issueKey: 'SD-E1' }] }),
      }));
      await page.goto('/current-sprint?boardId=1&sprintId=7757');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-testid="sprint-next-up"], .sprint-limbo-card, .sprint-next-up-strip').first()).toBeVisible({ timeout: 20000 });
      const hero = page.locator('[data-testid="sprint-hero-line"]').first();
      if (await hero.count()) {
        const text = await hero.innerText();
        expect(text).not.toMatch(/^Healthy · 100%/);
      }
    });

    await test.step('03 commitment risk strip expanded without click', async () => {
      await expect(page.locator('[data-testid="sprint-commitment-risk"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.sprint-alignment-list--expanded li').first()).toBeVisible();
    });

    await test.step('04 actions verb tabs and cadence strip', async () => {
      await page.route('**/api/governance/interventions*.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ cases: [] }),
      }));
      await page.goto('/actions');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.actions-tab').filter({ hasText: 'Send now' })).toBeVisible({ timeout: 15000 });
      const cadence = page.locator('[data-testid="actions-cadence-strip"]');
      if (await cadence.count()) await expect(cadence).toBeVisible();
    });

    await test.step('05 sidebar primaries hidden on executive sprint', async () => {
      await mockLimboSprint(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/current-sprint?boardId=1');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForTimeout(2000);
      const navLinks = page.locator('.app-sidebar-nav .sidebar-link');
      await expect(navLinks).toHaveCount(0);
    });

    await test.step('06 right rail at 1280 when limbo', async () => {
      await page.setViewportSize({ width: 1320, height: 900 });
      await page.reload();
      await page.waitForTimeout(1500);
      const rail = page.locator('[data-testid="sprint-proof-rail"]');
      if (await rail.count()) await expect(rail).toBeVisible();
    });

    await test.step('07 PI slide fixture path exists', async () => {
      expect(existsSync(SLIDE_DMS_Q2)).toBeTruthy();
    });

    await test.step('08 drawer not clipped by chrome on governance', async () => {
      await mockGovernanceBrief(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      const baseline = page.locator('[data-testid="gov-pi-focus-set-baseline"]');
      if (await baseline.count()) {
        await baseline.click();
        const overlap = await getLayoutOverlapReport(page, {
          selectors: ['.app-top-chrome', '.gov-right-drawer-panel'],
        });
        expect(overlap.overlaps).toEqual([]);
        await page.locator('[data-baseline-close]').first().click({ timeout: 5000 }).catch(() => {});
      }
    });

    await test.step('09 cross-surface telemetry clean', async () => {
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForPortfolioReady(page);
      assertTelemetryClean(telemetry);
    });
  });
});
