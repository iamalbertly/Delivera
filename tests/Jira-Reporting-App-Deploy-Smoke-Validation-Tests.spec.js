import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';

const testUser = process.env.TEST_LOGIN_USER || process.env.APP_LOGIN_USER || '';
const testPass = process.env.TEST_LOGIN_PASSWORD || process.env.APP_LOGIN_PASSWORD || '';

function captureConsoleErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push({ type: msg.type(), text: msg.text() });
  });
  return errors;
}

test.describe('VodaAgileBoard – Deploy Smoke Tests', () => {
  test('core sprint report flow works on current BASE_URL', async ({ page }) => {
    test.setTimeout(300000);
    const consoleErrors = captureConsoleErrors(page);

    await page.goto('/', { waitUntil: 'load' });

    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (hasLogin) {
      if (!testUser || !testPass) {
        test.skip(true, 'Auth enabled but no test credentials provided');
        return;
      }
      await page.fill('#username', testUser);
      await page.fill('#password', testPass);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/report/, { timeout: 20000 });
    } else {
      if (!page.url().match(/\/report$/)) {
        await page.goto('/report');
      }
    }

    await expect(page.locator('h1')).toContainText(/VodaAgileBoard|General Performance/);
    await expect(page.locator('#preview-btn')).toBeVisible();
    await expect(page.locator('#project-mpsa')).toBeVisible();
    await expect(page.locator('#project-mas')).toBeVisible();

    await page.click('#preview-btn');

    await Promise.race([
      page.waitForSelector('#loading', { state: 'visible', timeout: 10000 }).catch(() => null),
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 30000 }).catch(() => null),
      page.waitForSelector('#error', { state: 'visible', timeout: 30000 }).catch(() => null),
    ]);

    const loading = await page.locator('#loading').isVisible().catch(() => false);
    if (loading) await page.waitForSelector('#loading', { state: 'hidden', timeout: 240000 });

    const hasContent = await page.locator('#preview-content').isVisible().catch(() => false);
    const hasError = await page.locator('#error').isVisible().catch(() => false);
    expect(hasContent || hasError).toBeTruthy();

    const errorEvents = consoleErrors.filter((e) => e.type === 'error');
    expect(errorEvents).toHaveLength(0);
  });
});
