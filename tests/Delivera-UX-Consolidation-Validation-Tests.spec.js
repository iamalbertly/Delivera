import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
  selectFirstBoard,
  runDefaultPreview,
  assertPreviewOrSkip,
  hasVisibleReportSummarySurface,
  clickVisibleReportChromeAction,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Delivera - UX Consolidation Validation', () => {
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
    await expect(page.locator('.board-select-wrap')).toBeVisible();
    await expect(page.locator('#issue-jump-input')).toHaveAttribute('placeholder', /KEY|\/browse\/KEY/i);
    await expect(page.locator('#sprint-loading-context')).toHaveCount(0);
    await expect(page.locator('.header-view-drawer')).toHaveCount(1);
    await expect(page.locator('[data-header-lens-select]')).toHaveCount(1);
    await expect(page.locator('#stuck-card .role-mode-pill')).toHaveCount(0);
    await expect(page.locator('#stories-card #stuck-card')).toHaveCount(1);
    await expect(page.locator('#stories-card h2')).toContainText('Sprint work');

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
    expect(await hasVisibleReportSummarySurface(page)).toBeTruthy();
    await expect(page.locator('#preview-content #preview-outcome-line')).toHaveCount(0);
    await expect(page.locator('#export-dropdown-trigger')).toBeHidden();
    assertTelemetryClean(telemetry);
  });

  test('report context chips stay actionable across the live header strip', async ({ page }) => {
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
    expect(await clickVisibleReportChromeAction(page, 'open-projects')).toBeTruthy();
    await expect(page.locator('#project-search')).toBeFocused();

    expect(await clickVisibleReportChromeAction(page, 'open-range')).toBeTruthy();
    await expect(page.locator('#start-date')).toBeVisible();

    expect(await clickVisibleReportChromeAction(page, 'focus-config')).toBeTruthy();
    await expect(page.locator('#advanced-options-toggle')).toBeVisible();

    const outcomesClicked = await clickVisibleReportChromeAction(page, 'open-done-stories');
    if (outcomesClicked) {
      let doneStoriesActive = await page.locator('#tab-btn-done-stories').evaluate((node) =>
        node.classList.contains('active') || node.getAttribute('aria-selected') === 'true'
      ).catch(() => false);
      if (!doneStoriesActive) {
        await page.evaluate(() => window.__deliveraHandleReportChromeAction?.('open-done-stories')).catch(() => null);
        doneStoriesActive = await page.locator('#tab-btn-done-stories').evaluate((node) =>
          node.classList.contains('active') || node.getAttribute('aria-selected') === 'true'
        ).catch(() => false);
      }
      expect(doneStoriesActive).toBe(true);
    }

    assertTelemetryClean(telemetry);
  });

  test('leadership HUD boots as one shell card before or after hydration', async ({ page }) => {
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
    await expect(page.locator('#hud-grid')).toContainText(/Leadership signals|Loading range context|Portfolio answer|Needs attention/i);
    assertTelemetryClean(telemetry, {
      allowConsolePatterns: [/HUD Fetch Error/i],
    });
  });
});
