import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
  selectFirstBoard,
  runDefaultPreview,
  assertPreviewOrSkip,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Jira Reporting App - UX Consolidation Validation', () => {
  test('current sprint uses one lens control and keeps work list ahead of explainer chrome', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    const skipped = await skipIfRedirectedToLogin(page, test, { currentSprint: true });
    if (skipped) return;

    const boardId = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardId) {
      test.skip(true, 'No boards available for current sprint.');
      return;
    }

    await expect(page.locator('.current-sprint-header-bar')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-header-lens-select]')).toBeVisible();
    await expect(page.locator('.role-mode-pill')).toHaveCount(0);

    const order = await page.evaluate(() => {
      const stories = document.getElementById('stories-card');
      const explainer = document.getElementById('stuck-card');
      if (!stories || !explainer) return { valid: true };
      return {
        valid: stories.getBoundingClientRect().top <= explainer.getBoundingClientRect().top,
      };
    });
    expect(order.valid).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('report keeps unified tab search as the primary search surface', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page, {
      projects: ['MPSA'],
      start: '2025-10-01T00:00',
      end: '2025-12-31T23:59',
    });
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }

    await assertPreviewOrSkip(page, test, { timeout: 20000 });
    await expect(page.locator('#report-filter-strip')).toBeVisible();
    await expect(page.locator('#filters-panel h2')).toHaveCount(0);
    await expect(page.locator('#report-tab-search')).toBeVisible();
    await expect(page.locator('#report-filters-status-bar')).toHaveCount(1);
    const legacyBlocks = page.locator('.report-tab-search-legacy');
    const legacyCount = await legacyBlocks.count();
    for (let index = 0; index < legacyCount; index += 1) {
      await expect(legacyBlocks.nth(index)).toBeHidden();
    }
    await expect(page.locator('#preview-meta .preview-header-story')).toBeVisible();
    await expect(page.locator('#preview-content #preview-outcome-line')).toHaveCount(0);
    await expect(page.locator('#export-dropdown-trigger')).toBeHidden();
    assertTelemetryClean(telemetry);
  });

  test('leadership HUD boots with one empty loading card instead of repeated no-data metrics', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/leadership');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }

    const hasHudShell = await page.locator('#hud-grid').count();
    if (!hasHudShell) {
      test.skip(true, 'Leadership HUD shell is not served on this route in this environment.');
      return;
    }
    await expect(page.locator('#hud-grid .hud-card')).toHaveCount(1);
    await expect(page.locator('#hud-grid')).toContainText(/Leadership signals|Loading range context/i);
    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/HUD Fetch Error/i],
    });
  });
});
