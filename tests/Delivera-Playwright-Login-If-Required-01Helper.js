import { test } from '@playwright/test';

const testUser = process.env.TEST_LOGIN_USER || process.env.APP_LOGIN_USER || '';
const testPass = process.env.TEST_LOGIN_PASSWORD || process.env.APP_LOGIN_PASSWORD || '';

/**
 * Shared auth helper for friction-finish Playwright contracts.
 * Skips only when auth is enabled and credentials are missing.
 * Fail-fast when a post-login root selector is provided and never appears.
 */
export async function loginIfRequired(page, redirectPath = '/', { rootSelector = '', timeout = 10000 } = {}) {
  const target = redirectPath.startsWith('http') ? redirectPath : redirectPath;
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  const hasLogin = await page.locator('input[name="username"]').isVisible().catch(() => false);
  if (hasLogin) {
    test.skip(!testUser || !testPass, 'Auth enabled but no test credentials configured.');
    await page.fill('input[name="username"]', testUser);
    await page.fill('input[name="password"]', testPass);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');
    const expected = new URL(target, page.url());
    const actual = new URL(page.url());
    if (actual.pathname !== expected.pathname || actual.search !== expected.search || actual.hash !== expected.hash) {
      await page.goto(target, { waitUntil: 'domcontentloaded' });
    }
  }
  if (rootSelector) {
    await page.waitForSelector(rootSelector, { timeout });
  }
}
