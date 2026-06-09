/**
 * Squad hero card must be first visible governance content (desktop + mobile).
 * Journey contracts: data-hero-squad, data-portfolio-banner, geometry — not brittle copy.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';

function stubHeroSquadBrief() {
  return JSON.stringify({
    briefId: 'HERO-SD',
    projects: ['SD'],
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
    leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked', narratedBy: 'template' },
    portfolioRollup: { summaryLine: 'Out of 1 squads · 1 behind PI · 1 blocker · 1 bottleneck', behindPiCount: 1 },
    squadInsights: [{
      projectKey: 'SD',
      verdictTier: 'blocked',
      verdictLabel: 'DELIVERY BLOCKED',
      bottleneckLine: 'Blocked by Leadership: No progress for 9 days',
      productivityLine: 'Stale work detected — squad may be stuck',
      sprintPulse: { committed: 4, done: 1, daysElapsed: 8 },
      piCommitted: 0,
      piDone: 0,
      offPlanHours: 0,
      offPlanEpicCount: 3,
      driftSince: '2026-05-05',
      cardRisks: [{ issueKey: 'SD-5184', displayTitle: 'EVOD M-PESA SERVICE UPGRADE' }],
    }],
    topRisks: [{
      issueKey: 'SD-5184',
      assigneeName: 'Amani',
      recommendedAction: 'Unblock today',
      escalation: 'act-today',
      issueUrl: 'https://example/SD-5184',
      displayTitle: 'Stuck epic',
      summary: 'Stuck',
      ageHours: 216,
    }],
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    meta: {
      narratedBy: 'template',
      workerReceipt: { line: 'Last run: 2m ago', inboxTotal: 2 },
      setupGaps: [{ id: 'pi-baseline', label: 'PI baseline missing', action: 'set-baseline', severity: 'high' }],
      piConfidence: { trusted: false, confidencePct: null, counts: { committed: 0 }, timelineChips: [] },
    },
    evidencePack: { rows: [{ issueKey: 'SD-5184', statusNow: 'In Progress', whyFlagged: 'stale' }] },
  });
}

async function mockHeroRoutes(page) {
  await page.addInitScript((key) => { try { localStorage.setItem(key, 'SD'); } catch (_) {} }, PROJECTS_SSOT_KEY);
  await routeProjectsCatalog(page);
  await page.route('**/api/governance/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: stubHeroSquadBrief(),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      nudges: [{ id: 'n1', type: 'nudge', summary: 'Nudge', payload: { owner: 'A', board: 'SD' } }],
      confirm: [], briefs: [], piDrift: [], impact: [], poReadiness: [],
    }),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
  }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ boards: [{ projectKey: 'SD' }, { projectKey: 'MPSA' }] }),
  }));
}

test.describe('Governance hero squad first visible', () => {
  test.describe.configure({ retries: 0 });

  test('desktop squad pulse card is first main content above fold', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockHeroRoutes(page);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await test.step('01 hero mount flagged and visible', async () => {
      await expect(page.locator('#gov-verdict-mount[data-hero-squad="true"]')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('[data-portfolio-banner="1"]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('02 hero precedes owner clusters vertically', async () => {
      const heroY = await page.locator('[data-portfolio-banner="1"]').boundingBox().then((b) => b?.y ?? 9999);
      const clusterY = await page.locator('.gov-owner-cluster').first().boundingBox().then((b) => b?.y ?? 9999);
      expect(heroY).toBeLessThan(clusterY);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 hero above fold without scroll', async () => {
      const aboveFold = await page.locator('[data-squad-pi-row="1"]').evaluate((el) => {
        const top = el.getBoundingClientRect().top;
        return top >= 0 && top < window.innerHeight * 0.72;
      });
      expect(aboveFold).toBe(true);
      assertTelemetryClean(telemetry);
    });

    await test.step('04 deduped command chrome hides duplicate blocks', async () => {
      await expect(page.locator('[data-hero-deduped="1"]')).toBeAttached();
      await expect(page.locator('[data-lead-blocker="1"]')).toHaveCount(0);
      await expect(page.locator('.gov-command-answer--hero-deduped .gov-visual-answer-blocks')).toBeHidden();
      assertTelemetryClean(telemetry);
    });

    await test.step('05 compare tray and squad actions on hero', async () => {
      await expect(page.locator('[data-compare-add-tray="1"]')).toBeVisible();
      await expect(page.locator('[data-proof-squad="SD"]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('06 shell hero class and right rail queue separate', async () => {
      await expect(page.locator('#main-content.governance-shell--hero-squad')).toBeVisible();
      await expect(page.locator('#gov-right-rail-mount [data-inbox-inline="1"]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });
  });

  test('mobile squad pulse card is first content before clusters', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockHeroRoutes(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await test.step('07 mobile hero visible without scroll', async () => {
      await expect(page.locator('#gov-verdict-mount[data-hero-squad="true"]')).toBeVisible({ timeout: 20000 });
      const y = await page.locator('[data-portfolio-banner="1"]').boundingBox().then((b) => b?.y ?? 9999);
      expect(y).toBeLessThan(700);
      assertTelemetryClean(telemetry);
    });

    await test.step('08 mobile hero before owner cluster', async () => {
      const heroY = await page.locator('[data-portfolio-banner="1"]').boundingBox().then((b) => b?.y ?? 9999);
      const clusterY = await page.locator('.gov-owner-cluster').first().boundingBox().then((b) => b?.y ?? 9999);
      expect(heroY).toBeLessThan(clusterY);
      assertTelemetryClean(telemetry);
    });
  });
});
