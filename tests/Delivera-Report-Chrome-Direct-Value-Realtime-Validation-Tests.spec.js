/**
 * Report chrome SSOT: single context bar, compact preview meta, signals rail layout,
 * trust-first sidebar, Leadership tab copy. Uses Playwright + console guard (fail-fast
 * on browser warnings/errors — web equivalent of logcat); real-time UI checks per step.
 * Picked up by `npx playwright test tests/*.spec.js` and journey SSOT (`journey.ux-core`).
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
  ensureReportFiltersVisible,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

function stubPreviewBody() {
  return JSON.stringify({
    meta: {
      selectedProjects: ['MPSA'],
      windowStart: '2025-07-01T00:00:00.000Z',
      windowEnd: '2025-09-30T23:59:59.999Z',
      generatedAt: new Date().toISOString(),
      fromCache: false,
      partial: false,
      discoveredFields: { storyPointsFieldId: 'customfield_10016', epicLinkFieldId: 'customfield_10014' },
    },
    boards: [{ id: 42, name: 'DMS board' }],
    rows: [
      {
        issueKey: 'MPSA-101',
        issueSummary: 'Ship outcome',
        sprintId: '111',
        epicKey: 'MPSA-50',
        epicName: 'Quarter theme',
      },
    ],
    sprintsIncluded: [{ id: 111, name: 'Sprint 1', boardId: 42 }],
    sprintsUnusable: [],
    metrics: {
      rework: { spAvailable: true, reworkRatio: 0.3776, bugSP: 2, storySP: 20 },
      predictability: { mode: 'by-sprint', perSprint: {} },
      epicTTM: [],
    },
    kpis: null,
  });
}

test.describe('Report chrome direct value realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('stubbed preview: SSOT strip, meta rail, sidebar trust, fail-fast telemetry', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    const requestFailures = [];
    page.on('requestfailed', (req) => {
      const u = req.url();
      if (/favicon|analytics|google|doubleclick|fonts\.|typekit/i.test(u)) return;
      if (/\/preview\.json/i.test(u)) {
        requestFailures.push(`${req.failure()?.errorText || 'failed'} ${u}`);
      }
    });

    await page.addInitScript(() => {
      window.__DELIVERA_TEST_DISABLE_AUTO_PREVIEW = true;
      try {
        sessionStorage.setItem('report-filters-collapsed', '0');
      } catch (_) {}
    });
    await page.route(/\/preview\.json(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: stubPreviewBody(),
      });
    });

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await test.step('01 load report shell', async () => {
      await expect(page.locator('h1')).toContainText(/Delivery/i);
      await ensureReportFiltersVisible(page);
      await expect(page.locator('#preview-btn')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('02 trigger stubbed preview', async () => {
      await ensureReportFiltersVisible(page);
      await page.check('#project-mpsa').catch(() => null);
      await page.fill('#start-date', '2025-07-01T00:00').catch(() => null);
      await page.fill('#end-date', '2025-09-30T23:59').catch(() => null);
      const previewBtn = page.locator('#preview-btn');
      if (await previewBtn.isDisabled().catch(() => true)) {
        test.skip(true, 'Preview disabled for this environment');
        return;
      }
      const previewRespPromise = page.waitForResponse(
        (r) => r.url().includes('/preview.json') && r.request().method() === 'GET',
        { timeout: 25000 },
      );
      await page.evaluate(() => {
        const b = document.getElementById('preview-btn');
        if (b) b.click();
      });
      const previewResp = await previewRespPromise;
      expect(previewResp.status()).toBe(200);
      await expect(page.locator('#preview-content')).toBeVisible({ timeout: 20000 });
      expect(requestFailures, requestFailures.join('\n')).toEqual([]);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 body preview state', async () => {
      await expect(page.locator('body')).toHaveClass(/preview-active/);
      assertTelemetryClean(telemetry);
    });

    await test.step('04 exactly one app-context-bar in filter strip', async () => {
      await expect(page.locator('#report-filter-strip-summary .app-context-bar')).toHaveCount(1);
      assertTelemetryClean(telemetry);
    });

    await test.step('05 no duplicate app-context-bar inside preview meta', async () => {
      await expect(page.locator('#preview-meta .app-context-bar')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('06 context title not clipped to nonsense token', async () => {
      const title = page.locator('#report-filter-strip-summary .context-summary-title').first();
      await expect(title).toBeVisible();
      const t = ((await title.textContent()) || '').replace(/\s+/g, ' ').trim();
      expect(t.length).toBeGreaterThan(12);
      expect(/performance|window|context/i.test(t)).toBeTruthy();
      expect(/^NT\b/i.test(t)).toBeFalsy();
      assertTelemetryClean(telemetry);
    });

    await test.step('07 value view row and compact scope', async () => {
      await expect(page.locator('#preview-meta .preview-context-bar')).toBeVisible();
      await expect(page.locator('#preview-meta')).toContainText(/Value view/i);
      await expect(page.locator('#preview-meta .preview-context-bar--compact-scope')).toHaveCount(1);
      await expect(page.locator('#preview-meta .preview-context-chip-scope--combined')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('08 details control for trust drill-down', async () => {
      await expect(page.locator('#preview-meta .preview-context-details-toggle')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('09 signals rail tiles are separated layout units', async () => {
      const rail = page.locator('.performance-signals-rail-inner');
      await expect(rail).toBeVisible();
      const tiles = page.locator('.performance-signals-rail a.signals-rail-tile');
      await expect(tiles).toHaveCount(3);
      const display0 = await tiles.nth(0).evaluate((el) => getComputedStyle(el).display);
      const flexDir0 = await tiles.nth(0).evaluate((el) => getComputedStyle(el).flexDirection);
      expect(display0).toBe('flex');
      expect(flexDir0).toBe('column');
      const t0 = ((await tiles.nth(0).innerText()) || '').replace(/\s+/g, ' ').trim();
      const t1 = ((await tiles.nth(1).innerText()) || '').replace(/\s+/g, ' ').trim();
      const t2 = ((await tiles.nth(2).innerText()) || '').replace(/\s+/g, ' ').trim();
      expect(t0.length).toBeGreaterThan(3);
      expect(t1.length).toBeGreaterThan(3);
      expect(t2.length).toBeGreaterThan(3);
      assertTelemetryClean(telemetry);
    });

    await test.step('10 Leadership tab reads as in-page trends not external HUD', async () => {
      const trends = page.locator('#tab-btn-trends .tab-btn-label');
      await expect(trends).toContainText(/Leaders/i);
      const full = (await trends.textContent()) || '';
      expect(full).not.toMatch(/->|â†’/);
      assertTelemetryClean(telemetry);
    });

    await test.step('11 sidebar compact: no duplicate Projects row', async () => {
      await expect(page.locator('#sidebar-context-card .context-card--report-preview-compact')).toBeVisible();
      await expect(page.locator('#sidebar-context-card [data-context-segment-label="Projects"]')).toHaveCount(0);
      await expect(page.locator('#sidebar-context-card [data-context-segment-label="Range"]')).toHaveCount(0);
      await expect(page.locator('#sidebar-context-card .context-card-hint--compact')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('12 direct-value decision strip after boards chrome', async () => {
      await expect(page.locator('.report-decision-strip')).toBeVisible();
      await expect(page.locator('.report-decision-strip')).toContainText(/What changed/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('13 overview tab default with board inbox', async () => {
      const tab = page.locator('#tab-btn-project-epic-level');
      const isActive = await tab.evaluate((el) => el.classList.contains('active')).catch(() => false);
      if (!isActive) await tab.click();
      await expect(page.locator('#project-epic-level-content')).toBeVisible({ timeout: 15000 });
      const inboxCount = await page.locator('.board-inbox-list').count();
      const boardsHeading = await page.locator('#project-epic-level-content h3').filter({ hasText: /^Boards$/i }).count();
      expect(inboxCount > 0 || boardsHeading > 0).toBeTruthy();
      assertTelemetryClean(telemetry);
    });

    await test.step('14 notification toggle not overlapping filter strip (bottom dock on report)', async () => {
      const toggle = page.locator('.app-notification-toggle').first();
      if (await toggle.isVisible().catch(() => false)) {
        const bottom = await toggle.evaluate((el) => parseFloat(getComputedStyle(el).bottom) || 0);
        expect(bottom).toBeGreaterThan(0);
      }
      assertTelemetryClean(telemetry);
    });

    await test.step('15 preview-active class follows visible preview shell (no sticky compact drift)', async () => {
      await expect(page.locator('body')).toHaveClass(/preview-active/);
      await page.evaluate(() => {
        const pc = document.getElementById('preview-content');
        if (pc) pc.style.display = 'none';
        window.__DELIVERA_SYNC_PREVIEW_ACTIVE_FOR_TESTS?.();
      });
      await expect(page.locator('body')).not.toHaveClass(/preview-active/);
      await page.evaluate(() => {
        const pc = document.getElementById('preview-content');
        if (pc) pc.style.display = 'block';
        window.__DELIVERA_SYNC_PREVIEW_ACTIVE_FOR_TESTS?.();
      });
      await expect(page.locator('body')).toHaveClass(/preview-active/);
      assertTelemetryClean(telemetry);
    });
  });

  test('mobile viewport: no horizontal overflow on report after stub preview', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.__DELIVERA_TEST_DISABLE_AUTO_PREVIEW = true;
      try {
        sessionStorage.setItem('report-filters-collapsed', '0');
      } catch (_) {}
    });
    await page.route(/\/preview\.json(\?|$)/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: stubPreviewBody() });
    });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await ensureReportFiltersVisible(page);
    await page.check('#project-mpsa').catch(() => null);
    await page.fill('#start-date', '2025-07-01T00:00').catch(() => null);
    await page.fill('#end-date', '2025-09-30T23:59').catch(() => null);
    const previewBtn = page.locator('#preview-btn');
    if (await previewBtn.isDisabled().catch(() => true)) {
      test.skip(true, 'Preview disabled');
      return;
    }
    await page.evaluate(() => { document.getElementById('preview-btn')?.click(); });
    await expect(page.locator('#preview-content')).toBeVisible({ timeout: 20000 });
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const vw = await page.evaluate(() => window.innerWidth);
    expect(scrollW).toBeLessThanOrEqual(vw + 2);
    assertTelemetryClean(telemetry);
  });
});
