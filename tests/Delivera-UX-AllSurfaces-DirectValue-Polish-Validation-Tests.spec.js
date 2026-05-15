import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

async function skipIfLogin(page) {
  if (page.url().includes('/login')) return true;
  return false;
}

test.describe('Delivera - All Surfaces Direct Value Polish', () => {
  test('executive surfaces use shared header and normalized create-work CTA', async ({ page }) => {
    const pages = ['/home', '/backlog-intake', '/program-increment', '/risks-blockers'];
    for (const route of pages) {
      await page.goto(route);
      if (await skipIfLogin(page)) {
        test.skip(true, 'Redirected to login');
        return;
      }
      await expect(page.locator('header .app-header-actions')).toBeVisible();
      const createWork = page.getByRole('button', { name: 'Create work' });
      await expect(createWork.first()).toBeVisible();
      await expect(page.getByText('Paste tasks -> we structure them')).toHaveCount(0);
    }
  });

  test('report removes duplicate load-latest/legacy search controls', async ({ page }) => {
    await page.goto('/report');
    if (await skipIfLogin(page)) {
      test.skip(true, 'Redirected to login');
      return;
    }
    await expect(page.locator('#report-load-latest-wrap')).toHaveCount(0);
    await expect(page.locator('.report-tab-search-legacy')).toHaveCount(0);
    await expect(page.locator('.report-header-more-panel [data-action="toggle-filters"]')).toHaveCount(0);
    const scopeToggleCount = await page.locator('[data-action="toggle-filters"]').count();
    expect(scopeToggleCount).toBeLessThanOrEqual(1);
  });

  test('current sprint keeps single report jump in compact strip', async ({ page }) => {
    await page.goto('/current-sprint');
    if (await skipIfLogin(page)) {
      test.skip(true, 'Redirected to login');
      return;
    }
    await page.waitForSelector('.current-sprint-header-bar', { timeout: 20000 }).catch(() => null);
    const reportLinks = page.locator('.current-sprint-header-bar [data-header-action="open-report-context"]');
    const count = await reportLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.header-mini-strip-report-priority [data-header-action="open-report-context"]')).toHaveCount(0);
  });

  test('leadership shows consistent route labels', async ({ page }) => {
    await page.goto('/leadership');
    if (await skipIfLogin(page)) {
      test.skip(true, 'Redirected to login');
      return;
    }
    await expect(page.getByRole('link', { name: 'Current Sprint' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Delivery' }).first()).toBeVisible();
  });
});
