/**
 * Outcome draft assistant — staged UI + network + console (logcat-equivalent) validation.
 * Fail-fast on browser warnings/errors via Delivera-Playwright-Console-Guard-Global-Validation-Helpers.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Delivera Outcome Draft Assistant Direct Value Logcat Realtime Validation Tests', () => {
  test('report modal: stages validate draft API shape, readiness strip, and bulk controls', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);

    await test.step('Stage 01: open report and outcome modal shell', async () => {
      await page.goto('/report');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.locator('[data-open-outcome-modal]').first().click();
      await expect(page.locator('#global-outcome-modal')).toBeVisible();
      await expect(page.locator('#report-outcome-text')).toBeVisible();
      await expect(page.locator('#report-outcome-generate-draft')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage 02: intercept draft and assert UI binds rows + readiness', async () => {
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
            epicHintDefault: 'FY27 Q1 - DMS - Sample epic',
            rows: [
              {
                id: 'r0',
                index: 0,
                childItemIndex: null,
                kind: 'EPIC',
                title: 'Parent theme',
                confidence: 0.7,
                confidenceLabel: 'high confidence',
                duplicate: { suggestedAction: 'createNew', primaryReason: 'none', completedRecently: null },
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
                confidenceLabel: 'high confidence',
                duplicate: { suggestedAction: 'mergeIntoExistingStory', primaryReason: 'story_match', completedRecently: null },
                warnings: [{ code: 'DUPLICATE_STORY', message: 'Similar open issue: TEST-1' }],
                selected: true,
              },
            ],
            profileMeta: { degraded: false, degradeReason: '', sampleCounts: { used: 5 } },
          }),
        });
      });

      await page.locator('#report-outcome-text').fill('Q1 needs feature work plus fix login bugs for support.\n- Story one\n- Story two');
      await page.locator('#report-outcome-generate-draft').click();
      await expect(page.locator('#report-outcome-draft-panel')).toBeVisible();
      await expect(page.locator('#report-outcome-draft-precheck')).toContainText(/Mixed notes/i);
      await expect(page.locator('#report-outcome-readiness')).toBeVisible();
      await expect(page.locator('#report-outcome-readiness')).toContainText(/quarter/i);
      await expect(page.locator('#report-outcome-draft-tbody tr')).toHaveCount(2);
      await expect(page.locator('.outcome-confidence-score').first()).toHaveText('0.70');
      await expect(page.locator('.outcome-confidence-score').nth(1)).toHaveText('0.70');
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage 03: Review warnings only filters table and focuses first warning Details', async () => {
      await page.locator('#report-outcome-review-warnings').click();
      await expect(page.locator('#report-outcome-draft-tbody tr')).toHaveCount(1);
      await expect(page.locator('#report-outcome-draft-tbody')).toContainText(/Child backlog item/i);
      const warnDetails = page.locator('#report-outcome-draft-tbody tr.has-warning .report-outcome-draft-expand').first();
      await expect(warnDetails).toBeVisible();
      await expect(warnDetails).toBeFocused();
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage 04: Accept all safe restores rows', async () => {
      await page.locator('#report-outcome-accept-safe').click();
      await expect(page.locator('#report-outcome-draft-tbody tr')).toHaveCount(2);
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage 05: Details expand inserts detail row', async () => {
      await page.locator('#report-outcome-draft-tbody .report-outcome-draft-expand').first().click();
      await expect(page.locator('.report-outcome-draft-detail-tr')).toHaveCount(1);
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage 06: Cancel draft hides panel', async () => {
      await page.locator('#report-outcome-cancel-draft').click();
      await expect(page.locator('#report-outcome-draft-panel')).toBeHidden();
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
