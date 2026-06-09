/**
 * Round 3 — Customer growth: right rail, AI truth SSOT, lead blocker, compare tray.
 * Journey-value contracts via data attrs; fail-fast telemetry guard.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';

function stubGrowthBrief(overrides = {}) {
  return JSON.stringify({
    briefId: 'GR3-BRIEF',
    projects: ['SD'],
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
    leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked', meetingScript: 'Script body', narratedBy: 'advisor' },
    portfolioRollup: { summaryLine: '1 blocker', behindPiCount: 0 },
    squadInsights: [{
      projectKey: 'SD',
      verdictTier: 'blocked',
      verdictLabel: 'DELIVERY BLOCKED',
      bottleneckLine: 'Blocked by Leadership',
      productivityLine: 'Stale work',
      sprintPulse: { committed: 4, done: 1, daysElapsed: 8 },
      piCommitted: 4,
      piDone: 1,
      cardRisks: [{ issueKey: 'SD-5184', displayTitle: 'Stuck epic' }],
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
      narratedBy: 'advisor',
      _aiProviderFallback: true,
      setupGaps: [],
      piConfidence: { trusted: false, confidencePct: null, counts: { committed: 0 }, timelineChips: [] },
      workerReceipt: { line: 'Last run: 2m ago', inboxTotal: 12 },
      ...overrides.meta,
    },
    evidencePack: { rows: [{ issueKey: 'SD-5184', statusNow: 'In Progress', whyFlagged: 'stale' }] },
    ...overrides,
  });
}

async function mockGrowthRoutes(page) {
  await page.addInitScript((key) => { try { localStorage.setItem(key, 'SD'); } catch (_) {} }, PROJECTS_SSOT_KEY);
  await routeProjectsCatalog(page);
  await page.route('**/api/governance/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: stubGrowthBrief(),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      nudges: [{ id: 'n1', type: 'nudge', summary: 'Nudge', payload: { owner: 'A', board: 'SD' } }],
      confirm: [{ id: 'c1', type: 'confirm', summary: 'Claim', payload: { owner: 'B', board: 'SD' } }],
      briefs: [], piDrift: [], impact: [], poReadiness: [],
    }),
  }));
  await page.route('**/api/settings/ai-usage.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ totalCalls: 100, fallbacks: 85 }),
  }));
  await page.route('**/api/ai-provider-status.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ provider: 'openrouter', label: 'OpenRouter', configured: true, slideVisionReady: true, source: 'server' }),
  }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ boards: [{ projectKey: 'SD' }, { projectKey: 'BIO' }] }),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
  }));
}

test.describe('Customer growth round3 direct value', () => {
  test.describe.configure({ retries: 0 });

  test('governance right rail queue compare and lead blocker', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGrowthRoutes(page);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await test.step('01 right rail mount visible on desktop', async () => {
      await expect(page.locator('#gov-right-rail-mount')).toBeVisible({ timeout: 20000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('02 queue inline preview in right rail not top chrome', async () => {
      await expect(page.locator('#gov-right-rail-mount [data-inbox-inline="1"]')).toBeVisible();
      await expect(page.locator('#gov-top-chrome-mount')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 lead blocker strip surfaces top issue without scroll', async () => {
      await expect(page.locator('[data-lead-blocker="1"]')).toBeVisible();
      await expect(page.locator('[data-lead-blocker="1"] .gov-issue-key-link')).toContainText('SD-5184');
      assertTelemetryClean(telemetry);
    });

    await test.step('04 meeting script collapsed when blocked', async () => {
      await expect(page.locator('.gov-promoted-meeting-script .gov-meeting-script')).toBeVisible();
      await expect(page.locator('.gov-promoted-meeting-script .gov-meeting-script')).not.toHaveAttribute('open', /.+/);
      assertTelemetryClean(telemetry);
    });

    await test.step('05 advisor badge suppressed on high fallback', async () => {
      await expect(page.locator('.gov-narration-badge--advisor')).toHaveCount(0);
      await expect(page.locator('.gov-narration-badge--template')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('06 compare add tray on single squad', async () => {
      await expect(page.locator('[data-compare-add-tray="1"]')).toBeVisible();
      await expect(page.locator('[data-compare-add]').first()).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('07 compare add selects squad exclusively', async () => {
      const addPk = await page.locator('[data-compare-add]').first().getAttribute('data-compare-add');
      expect(addPk).toBeTruthy();
      await page.locator(`[data-compare-add="${addPk}"]`).click();
      await expect(page.locator(`[data-project="${addPk}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-project="SD"]')).toHaveAttribute('aria-pressed', 'false');
      assertTelemetryClean(telemetry);
    });

    await test.step('08 right rail sticky column in grid', async () => {
      const col = await page.locator('#gov-right-rail-mount').evaluate((el) => getComputedStyle(el).gridColumnStart);
      expect(String(col)).not.toBe('auto');
      assertTelemetryClean(telemetry);
    });
  });

  test('settings AI truth shows server provider', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.route('**/api/settings/ai-usage.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ totalCalls: 50, fallbacks: 10 }),
    }));
    await page.route('**/api/ai-provider-status.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ provider: 'openrouter', label: 'OpenRouter', configured: true, slideVisionReady: true, source: 'server' }),
    }));
    await page.goto('/settings');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await test.step('09 settings shows server AI not false no-key', async () => {
      await expect(page.locator('[data-ai-trust-mode="server"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.gov-ai-helper-status').filter({ hasText: /No key/i })).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('10 settings page hides brief queue sub-chrome', async () => {
      await expect(page.locator('.gov-global-pill').filter({ hasText: /Brief queue/i })).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });
  });

  test('top chrome AI trust pill resolves server mode', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGrowthRoutes(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await test.step('11 top pill shows server trust mode', async () => {
      await expect(page.locator('[data-ai-trust-pill="server"]')).toBeVisible({ timeout: 15000 });
      assertTelemetryClean(telemetry);
    });
  });
});
