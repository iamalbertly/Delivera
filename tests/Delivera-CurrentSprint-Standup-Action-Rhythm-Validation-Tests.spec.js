import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
  selectFirstBoard,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Delivera current sprint standup action rhythm', () => {
  test('compact strip intervention actions are visible and actionable', async ({ page }) => {
    test.setTimeout(120000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const board = await selectFirstBoard(page, { timeout: 25000 });
    if (!board) {
      test.skip(true, 'No board options available in current environment');
      return;
    }

    await page.waitForSelector('.current-sprint-header-bar', { timeout: 45000 }).catch(() => null);
    await expect(page.locator('.current-sprint-header-bar')).toBeVisible();

    const intervention = page.locator('.sprint-intervention-item');
    const count = await intervention.count();
    if (count === 0) {
      test.skip(true, 'No intervention strip rendered for this sprint state');
      return;
    }

    await expect(intervention.first()).toBeVisible();
    await intervention.first().click({ force: true }).catch(() => null);
    await expect(page.locator('#stories-card, #stuck-card').first()).toBeVisible();
    assertTelemetryClean(telemetry);
  });
});

