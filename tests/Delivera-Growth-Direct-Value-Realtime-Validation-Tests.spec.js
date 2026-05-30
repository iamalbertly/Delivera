/**
 * Growth direct-to-value UX: deduped report context, squad stall on report,
 * smart default tabs, stale freshness honesty, sprint dedupe signals.
 * Playwright + captureBrowserTelemetry (logcat-style) per step.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
  ensureReportFiltersVisible,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { REPORT_FILTERS_STALE_KEY, REPORT_LAST_PREVIEW_KEY, PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';

function stubZeroOutcomePreviewBody() {
  return JSON.stringify({
    meta: {
      selectedProjects: ['SD'],
      windowStart: '2026-04-01T00:00:00.000Z',
      windowEnd: '2026-07-02T23:59:59.999Z',
      generatedAt: new Date().toISOString(),
      fromCache: false,
      partial: false,
      discoveredFields: { storyPointsFieldId: 'customfield_10016', epicLinkFieldId: 'customfield_10014' },
    },
    boards: [{ id: 7, name: 'DMS board', projectKeys: ['SD'] }],
    rows: [],
    sprintsIncluded: [
      { id: 201, name: 'FY26DMS22', boardId: 7, projectKey: 'SD' },
      { id: 202, name: 'FY26DMS21', boardId: 7, projectKey: 'SD' },
    ],
    sprintsUnusable: [{ id: 999, name: 'Bad dates', projectKey: 'SD' }],
    metrics: { rework: {}, predictability: { perSprint: {} }, epicTTM: [] },
    kpis: null,
  });
}

function stubLeadershipStalledSquads() {
  return JSON.stringify({
    squads: [
      {
        boardId: 7,
        boardName: 'DMS board (SD)',
        hasActiveSprintFallback: true,
        nextSprintStartOverdue: true,
        suggestStartSprint: true,
        sprintStartDate: '2026-05-01',
      },
    ],
    generatedAt: new Date().toISOString(),
  });
}

test.describe('Growth direct value realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('report zero-outcome: verdict-only meta, stall attention, sprints tab default', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.addInitScript((projectsKey) => {
      window.__DELIVERA_TEST_DISABLE_AUTO_PREVIEW = true;
      try {
        localStorage.setItem(projectsKey, 'SD');
      } catch (_) {}
    }, PROJECTS_SSOT_KEY);
    await page.route(/\/preview\.json(\?|$)/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: stubZeroOutcomePreviewBody() });
    });
    await page.route(/\/api\/leadership-summary\.json(\?|$)/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: stubLeadershipStalledSquads() });
    });

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await test.step('01 trigger stubbed preview', async () => {
      await ensureReportFiltersVisible(page);
      await page.check('#project-sd').catch(() => null);
      const previewBtn = page.locator('#preview-btn');
      if (await previewBtn.isDisabled().catch(() => true)) {
        test.skip(true, 'Preview disabled');
        return;
      }
      await page.evaluate(() => document.getElementById('preview-btn')?.click());
      await expect(page.locator('#preview-content')).toBeVisible({ timeout: 20000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('02 single context bar in filter strip', async () => {
      await expect(page.locator('#report-filter-strip-summary .app-context-bar')).toHaveCount(1);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 preview meta verdict-only without duplicate scope chips', async () => {
      await expect(page.locator('#preview-meta .preview-context-bar--verdict-only')).toHaveCount(1);
      await expect(page.locator('#preview-meta .preview-context-chip-scope')).toHaveCount(0);
      await expect(page.locator('#preview-meta .preview-context-chip-data-state')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('04 context-aware empty actions present', async () => {
      await expect(page.locator('#preview-meta .preview-context-zero-actions')).toBeVisible();
      await expect(page.locator('[data-preview-context-action="open-sprints"]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('05 squad stall in attention queue', async () => {
      await expect(page.locator('.attention-queue')).toContainText(/no active sprint|overdue/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('06 smart default sprints tab when outcomes zero', async () => {
      await expect(page.locator('#tab-btn-sprints')).toHaveClass(/active/);
      assertTelemetryClean(telemetry);
    });

    await test.step('07 at most one Just updated on page', async () => {
      const bodyText = (await page.locator('body').textContent()) || '';
      const matches = bodyText.match(/Just updated/gi) || [];
      expect(matches.length).toBeLessThanOrEqual(1);
      assertTelemetryClean(telemetry);
    });
  });

  test('report filters stale: freshness honesty', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.addInitScript((staleKey) => {
      window.__DELIVERA_TEST_DISABLE_AUTO_PREVIEW = true;
      try {
        sessionStorage.setItem(staleKey, '1');
      } catch (_) {}
    }, REPORT_FILTERS_STALE_KEY);

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await test.step('01 freshness shows filters changed', async () => {
      const strip = page.locator('#report-filter-strip-summary');
      await expect(strip).toContainText(/Filters changed/i);
      assertTelemetryClean(telemetry);
    });
  });

  test('dashboard stay: no auto-redirect and stall pulse', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.addInitScript((projectsKey) => {
      try {
        localStorage.setItem('delivera.lastRoute.v1', JSON.stringify({ path: '/report', at: Date.now() }));
        localStorage.setItem(projectsKey, 'SD');
      } catch (_) {}
    }, PROJECTS_SSOT_KEY);
    await page.route(/\/api\/leadership-summary\.json(\?|$)/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: stubLeadershipStalledSquads() });
    });
    await page.route(/\/api\/current-sprint\.json(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          meta: { suggestStartSprint: true, noActiveSprintFallback: true, projects: 'SD' },
          sprint: null,
          stories: [],
        }),
      });
    });

    await page.goto('/dashboard?stay=1');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await test.step('01 remains on dashboard', async () => {
      await expect(page).toHaveURL(/\/dashboard/);
      assertTelemetryClean(telemetry);
    });

    await test.step('02 stall pulse visible', async () => {
      await expect(page.locator('#home-sprint-pulse')).toBeVisible({ timeout: 8000 });
      await expect(page.locator('#home-sprint-pulse')).toContainText(/without active sprint|Team idle/i);
      assertTelemetryClean(telemetry);
    });
  });

  test('leadership confidence strip mentions stalled squad', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.route(/\/api\/leadership-summary\.json(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          squads: JSON.parse(stubLeadershipStalledSquads()).squads,
          generatedAt: new Date().toISOString(),
          velocity: { avg: 10 },
          risk: { score: 20, blockersOwned: 0, unownedOutcomes: 0, dataQualityRisk: 10, deliveryRisk: 15 },
          quality: { reworkPct: 5 },
          predictability: { avg: 80 },
          kpis: { dataQuality: { trustBand: 'Mixed' } },
        }),
      });
    });

    await page.goto('/leadership');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await test.step('01 confidence strip stall copy', async () => {
      await expect(page.locator('#leadership-confidence-strip')).toContainText(/without active sprint/i, { timeout: 15000 });
      assertTelemetryClean(telemetry);
    });
  });

  test('report cache restore skips loading theater', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    const envelope = {
      schemaVersion: 2,
      savedAt: Date.now(),
      payload: JSON.parse(stubZeroOutcomePreviewBody()),
    };
    await page.addInitScript(({ previewKey, previewRaw }) => {
      window.__DELIVERA_TEST_DISABLE_AUTO_PREVIEW = true;
      try {
        localStorage.setItem(previewKey, previewRaw);
      } catch (_) {}
    }, { previewKey: REPORT_LAST_PREVIEW_KEY, previewRaw: JSON.stringify(envelope) });

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await test.step('01 preview visible without loading overlay', async () => {
      await expect(page.locator('#preview-content')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#loading')).toBeHidden();
      assertTelemetryClean(telemetry);
    });
  });
});
