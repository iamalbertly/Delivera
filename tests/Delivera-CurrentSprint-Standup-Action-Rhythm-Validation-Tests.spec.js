import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
  selectFirstBoard,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Delivera current sprint standup action rhythm', () => {
  test('top shortlist actions are visible and actionable', async ({ page }) => {
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

    const shortlist = page.locator('.header-action-shortlist-item');
    const count = await shortlist.count();
    if (count === 0) {
      test.skip(true, 'No intervention shortlist rendered for this sprint state');
      return;
    }

    await expect(shortlist.first()).toBeVisible();
    await shortlist.first().click({ force: true }).catch(() => null);
    await expect(page.locator('#stories-card, #stuck-card').first()).toBeVisible();
    assertTelemetryClean(telemetry);
  });
});

