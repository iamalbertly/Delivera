import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

async function skipIfLogin(page) {
  if (page.url().includes('/login')) return true;
  return false;
}

test.describe('Delivera - All Surfaces Direct Value Polish', () => {
  test('executive surfaces use shared header and normalized create-work CTA', async ({ page }) => {
    // ?stay=1 prevents /home from auto-redirecting to last visited route
    const pages = ['/home?stay=1', '/backlog-intake', '/program-increment', '/risks-blockers'];
    let pagesChecked = 0;
    for (const route of pages) {
      await page.goto(route);
      if (await skipIfLogin(page)) {
        test.skip(true, 'Redirected to login');
        return;
      }
      // Some pages (e.g. /risks-blockers) client-side redirect to /current-sprint — skip those
      const isExecutiveSurface = await page.evaluate(() =>
        document.body.classList.contains('executive-surface-page'),
      );
      if (!isExecutiveSurface) continue;
      await expect(page.locator('header .app-header-actions')).toBeVisible({ timeout: 8000 });
      const createWork = page.getByRole('button', { name: 'Create work' });
      await expect(createWork.first()).toBeVisible();
      await expect(page.getByText('Paste tasks -> we structure them')).toHaveCount(0);
      pagesChecked += 1;
    }
    if (pagesChecked === 0) {
      test.skip(true, 'No executive surface pages stayed on their route — all redirected away');
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
    // Mini strip may contain a compact report link for collapsed mode, but only inside the hidden (aria-hidden) mini strip —
    // never exposed in the non-collapsed state (which would create a visible duplicate).
    await expect(page.locator('.header-mini-strip:not([aria-hidden="true"]) .header-mini-strip-report-priority [data-header-action="open-report-context"]')).toHaveCount(0);
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
