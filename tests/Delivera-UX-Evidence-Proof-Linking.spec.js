import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

test('report proof page links back to brief', async ({ page }) => {
  await page.goto('/report');
  if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
  await expect(page.locator('h1')).toContainText(/Proof for current Brief/i);
  await expect(page.locator('#app-top-chrome')).toBeVisible();
  await expect(page.locator('.report-back-to-brief')).toBeHidden();
  await expect(page.locator('.app-top-switcher-item[data-top-surface="governance"]')).toBeVisible();
});
