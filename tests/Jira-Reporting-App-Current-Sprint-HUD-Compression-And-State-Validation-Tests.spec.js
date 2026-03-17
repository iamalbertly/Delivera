import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  selectFirstBoard,
  skipIfRedirectedToLogin,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Current sprint HUD compression and state handling', () => {
  test('health HUD keeps one evidence line and no standalone snapshot row', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const boardValue = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardValue) {
      test.skip(true, 'No current sprint board available');
      return;
    }

    await page.waitForSelector('.current-sprint-header-bar', { timeout: 45000 }).catch(() => null);
    const more = page.locator('.header-view-drawer summary').first();
    await more.click({ force: true }).catch(() => null);
    await expect(page.locator('.sprint-hud-health-details .health-evidence-line')).toHaveCount(1);
    await expect(page.locator('.sprint-hud-health-details .health-snapshot-row')).toHaveCount(0);
    await expect(page.locator('.sprint-hud-health-details .health-inline-pill')).toHaveCount(2);

    assertTelemetryClean(telemetry);
  });

  test('issue jump filters the work list in place and does not render a separate results surface', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const boardValue = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardValue) {
      test.skip(true, 'No current sprint board available');
      return;
    }

    await page.waitForSelector('#stories-table tbody tr.story-parent-row', { timeout: 45000 }).catch(() => null);
    const rows = page.locator('#stories-table tbody tr.story-parent-row');
    const count = await rows.count();
    if (!count) {
      test.skip(true, 'No story rows available');
      return;
    }

    const firstKey = ((await rows.first().getAttribute('data-parent-key')) || '').trim();
    if (!firstKey) {
      test.skip(true, 'First story row has no issue key');
      return;
    }

    await page.fill('#issue-jump-input', firstKey);
    await page.waitForTimeout(250);
    await expect(page.locator('#issue-jump-results')).toHaveCount(0);
    const visibleRows = await rows.evaluateAll((items) => items.filter((row) => (row.style.display || '') !== 'none').length);
    expect(visibleRows).toBeGreaterThanOrEqual(1);
    const highlightedRow = page.locator(`#stories-table tbody tr.story-parent-row[data-parent-key="${firstKey}"]`).first();
    await expect(highlightedRow).toBeVisible();

    assertTelemetryClean(telemetry);
  });

  test('loading and retry states preserve last content instead of blanking the main area', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);
    let callCount = 0;
    await page.route('**/api/current-sprint.json*', async (route) => {
      callCount += 1;
      if (callCount === 1) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Injected failure' }),
      });
    });

    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const boardValue = await selectFirstBoard(page, { timeout: 20000 });
    if (!boardValue) {
      test.skip(true, 'No current sprint board available');
      return;
    }

    await page.waitForSelector('#current-sprint-content .current-sprint-header-bar', { timeout: 45000 }).catch(() => null);
    await expect(page.locator('#current-sprint-content')).toBeVisible();
    await page.click('.header-refresh-btn').catch(() => null);
    await page.waitForTimeout(800);
    await expect(page.locator('#current-sprint-content')).toBeVisible();
    await expect(page.locator('#current-sprint-error')).toBeVisible();
    await expect(page.locator('#current-sprint-loading')).toHaveCount(1);

    assertTelemetryClean(telemetry, { allowConsolePatterns: [/Injected failure/i] });
  });
});
