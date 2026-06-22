/**
 * Settings Master Plan — hub UI, display names, logcat per step.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY, SIMPLE_MODE_KEY } from '../public/Delivera-Shared-Storage-Keys.js';

const CATALOG_MOCK = {
  projects: [
    { key: 'MPSA', label: 'M-SQUAD', shortLabel: 'M-SQUAD', defaultSelected: true, accessible: true },
    { key: 'SD', label: 'DMS Squad', shortLabel: 'DMS', defaultSelected: false, accessible: true },
  ],
  keys: ['MPSA', 'SD'],
  displayMode: 'label',
  catalogSource: 'json',
};

function stubSettingsApis(page) {
  return Promise.all([
    page.route('**/api/projects-catalog.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CATALOG_MOCK),
    })),
    page.route('**/api/settings/org-summary.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        catalog: CATALOG_MOCK.projects,
        catalogSource: 'json',
        displayMode: 'label',
        defaultSelected: ['MPSA'],
        governanceProfile: {
          thresholds: { staleInProgressHours: 24, riskBriefTopN: 5 },
          suppressedRiskTypes: [],
          stakeholderAliasCount: 0,
        },
        accessSummary: CATALOG_MOCK.projects,
        smPoFieldIds: { scrumMaster: null, productOwner: null },
      }),
    })),
    page.route('**/api/settings/runtime.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        mode: 'development',
        warnings: [],
        summary: { jiraHost: 'vodacom.atlassian.net', jiraApiTokenLength: 24, redisBackend: 'memory', authMode: 'legacy-session' },
      }),
    })),
    page.route('**/api/settings/ai-usage.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hours: 24, totalCalls: 0, fallbacks: 0 }),
    })),
    page.route('**/api/ai-provider-status.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ provider: 'built-in', label: 'Built-in', configured: true, source: 'server' }),
    })),
    page.route('**/api/jira-activity**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [] }),
    })),
  ]);
}

test.describe('Settings master plan logcat realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('@focused settings hub and display name contracts', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await stubSettingsApis(page);
    await page.addInitScript((projectsKey) => {
      try { localStorage.setItem(projectsKey, 'SD'); } catch (_) {}
    }, PROJECTS_SSOT_KEY);

    await test.step('01 settings hub nav and sections', async () => {
      await page.goto('/settings');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#settings-quick-nav')).toBeVisible();
      await expect(page.locator('[data-settings-surface-link="/governance"]')).toContainText(/Portfolio/i);
      await expect(page.locator('[data-settings-surface-link="/actions"]')).toContainText(/Actions/i);
      await expect(page.locator('#settings-nav-rail')).toBeVisible();
      await expect(page.locator('#my-workspace')).toBeVisible();
      await expect(page.locator('#organization')).toBeVisible();
      await expect(page.locator('#integrations')).toBeVisible();
      await expect(page.locator('#jira-activity')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('02 my workspace simple mode toggle', async () => {
      const toggle = page.locator('#settings-simple-mode');
      await expect(toggle).toBeVisible();
      await toggle.check();
      const stored = await page.evaluate((key) => localStorage.getItem(key), SIMPLE_MODE_KEY);
      expect(stored).toBe('1');
      assertTelemetryClean(telemetry);
    });

    await test.step('03 organization panel shows DMS Squad for SD', async () => {
      await expect(page.locator('#organization')).toContainText('DMS Squad');
      await expect(page.locator('#organization tr:has(code:text-is("SD"))')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('04 integrations health and AI helper', async () => {
      await expect(page.locator('#integrations')).toContainText('vodacom.atlassian.net');
      await expect(page.locator('#gov-ai-helper')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await page.route(/\/api\/governance-brief\.json/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          briefId: 'test',
          projects: ['SD'],
          leadershipNarrative: { meetingAnswer: 'On track.' },
          executiveView: { verdictLabel: 'Watch' },
          deliveryTruth: { done: 1, committed: 2 },
          topRisks: [],
          freshness: { confidenceLimit: 'live' },
          meta: { workerReceipt: { inboxTotal: 0 } },
        }),
      });
    });
    await page.route(/\/api\/governance\/inbox\.json/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nudges: [], confirm: [], briefs: [], piDrift: [], impact: [], poReadiness: [] }),
      });
    });
    await page.route(/\/api\/governance\/feedback-summary\.json/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await test.step('05 portfolio scope shows display name for SD', async () => {
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('#portfolio-scope-selected', { timeout: 20000 });
      const selected = page.locator('#portfolio-scope-selected');
      await expect(selected).toBeVisible();
      await expect(selected.locator('option:checked')).toContainText(/DMS/i);
      assertTelemetryClean(telemetry);
    });

    await page.route('**/api/preview**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          meta: { projects: 'SD', generatedAt: new Date().toISOString() },
          rows: [{ issueKey: 'SD-1', issueSummary: 'Test' }],
          sprints: [],
        }),
      });
    });

    await test.step('06 report scope uses display label when catalog loaded', async () => {
      await page.goto('/report');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('#projects-catalog-mount[data-catalog-ready="1"]', { timeout: 15000 }).catch(() => null);
      const sdLabel = page.locator('#project-sd').locator('..').locator('.project-desc');
      await expect(sdLabel).toContainText('DMS Squad');
      assertTelemetryClean(telemetry);
    });

    await test.step('07 deep link integrations hash', async () => {
      await page.goto('/settings#integrations');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#integrations')).toBeVisible();
      await expect(page.locator('#gov-ai-helper')).toBeVisible();
      assertTelemetryClean(telemetry);
    });
  });
});
