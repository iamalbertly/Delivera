/**
 * Outcome draft assistant — staged drawer + canvas + console (logcat-equivalent) validation.
 * Fail-fast on browser warnings/errors via Delivera-Playwright-Console-Guard-Global-Validation-Helpers.
 * Updated for right-side drawer (Delivera-Work-Draft-Canvas.js): auto-draft replaces generate button,
 * canvas items replace draft table rows, send-bar chips replace separate controls.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Delivera Outcome Draft Assistant Direct Value Logcat Realtime Validation Tests', () => {
  test('drawer: stages validate auto-draft, canvas items, review toggle, and close', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);

    await test.step('Stage 01: open report and work-draft drawer shell', async () => {
      await page.goto('/report');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.locator('[data-open-outcome-modal]').first().click();
      await expect(page.locator('#work-draft-drawer')).toBeVisible();
      await expect(page.locator('#wdd-source-textarea')).toBeVisible();
      // Drawer uses auto-draft — no explicit generate button
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage 02: intercept draft and assert canvas items + send bar counts', async () => {
      await page.route('**/api/outcome-draft', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            phase: 1,
            projectKey: 'TEST',
            structureMode: 'EPIC_WITH_STORIES',
            precheck: { key: 'mixed_notes', message: 'Mixed notes — drafting conservatively.' },
            readinessWarnings: [
              { code: 'MISSING_QUARTER', message: 'No quarter label detected.' },
            ],
            rows: [
              {
                id: 'r0',
                index: 0,
                childItemIndex: null,
                kind: 'EPIC',
                title: 'Parent theme',
                confidence: 0.7,
                isParent: true,
                duplicate: null,
                warnings: [],
                selected: true,
              },
              {
                id: 'r1',
                index: 1,
                childItemIndex: 0,
                kind: 'STORY',
                title: 'Child backlog item',
                confidence: 0.7,
                isParent: false,
                duplicate: null,
                warnings: [{ code: 'DUPLICATE_STORY', message: 'Similar open issue: TEST-1' }],
                selected: true,
              },
            ],
          }),
        });
      });

      await page.locator('#wdd-source-textarea').fill('Q1 needs feature work plus fix login bugs for support.\n- Story one\n- Story two');
      // Auto-draft fires after 1200ms debounce; wait up to 4s for canvas items
      await expect(page.locator('#wdd-canvas .wdc-item:not(.wdc-add-row)')).toHaveCount(2, { timeout: 4000 });
      // Precheck message appears in parse status
      await expect(page.locator('#wdd-parse-status')).toContainText(/Mixed notes/i);
      // Send bar shows ready (1 safe item) and review (1 warning item)
      await expect(page.locator('#wdd-send-counts')).toContainText(/Ready: 1/i);
      await expect(page.locator('#wdd-send-counts')).toContainText(/Review: 1/i);
      // Warning item has a repair chip
      await expect(page.locator('.wdc-repair-chip')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage 03: review-toggle filters canvas to warning items only', async () => {
      await page.locator('#work-draft-drawer').locator('[data-action="toggle-review"]').dispatchEvent('click');
      await expect(page.locator('#wdd-canvas .wdc-item:not(.wdc-add-row)')).toHaveCount(1);
      await expect(page.locator('#wdd-canvas .wdc-title').first()).toHaveValue(/Child backlog item/i);
      await expect(page.locator('#wdd-canvas .wdc-repair-chip')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage 04: toggle review again restores all canvas items', async () => {
      await page.locator('#work-draft-drawer').locator('[data-action="toggle-review"]').dispatchEvent('click');
      await expect(page.locator('#wdd-canvas .wdc-item:not(.wdc-add-row)')).toHaveCount(2);
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage 05: repair chip visible on warning item', async () => {
      await expect(page.locator('.wdc-repair-chip').first()).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage 06: close button hides drawer', async () => {
      await page.locator('#work-draft-drawer').locator('#wdd-close-btn').dispatchEvent('click');
      await expect(page.locator('#work-draft-drawer')).not.toHaveClass(/is-open/);
      assertTelemetryClean(telemetry);
    });
  });

  test('outcome-draft API returns 400 without narrative when called directly', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/outcome-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrative: '', projectKey: 'MPSA' }),
      });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    });
    expect(res.status).toBe(400);
    expect(res.body.code || res.body.error).toBeTruthy();
    assertTelemetryClean(telemetry, { allowConsolePatterns: [/outcome-draft.*400|Bad Request/i] });
  });
});
