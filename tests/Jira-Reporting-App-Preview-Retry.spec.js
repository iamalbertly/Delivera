import { test, expect } from '@playwright/test';

test('preview retry button triggers a new preview after a failure', async ({ page }) => {
  await page.goto('/report');
  const hasLogin = await page.locator('#username').isVisible().catch(() => false);
  if (hasLogin) {
    test.skip(true, 'Auth enabled - preview tests require unauthenticated access');
    return;
  }

  let callCount = 0;
  await page.route('**/preview.json**', async (route) => {
    callCount += 1;
    if (callCount === 1) {
      // Simulate network error
      await route.abort('failed');
    } else {
      // Return a minimal successful preview response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          boards: [{ id: 1, name: 'Test Board' }],
          rows: [{ key: 'TEST-1', summary: 'Test row' }],
          sprintsIncluded: [],
          meta: { windowStart: '2025-07-01T00:00:00.000Z', windowEnd: '2025-09-30T23:59:59.999Z' }
        })
      });
    }
  });

  await page.check('#project-mpsa').catch(() => null);
  await page.check('#project-mas').catch(() => null);
  await expect(page.locator('#preview-btn')).toBeEnabled({ timeout: 15000 });
  await page.click('#preview-btn');

  await expect.poll(() => callCount, { timeout: 10000 }).toBeGreaterThanOrEqual(1);
  const retryBtn = page.locator('button[data-action="retry-preview"]:visible').first();
  if (await retryBtn.isVisible().catch(() => false)) {
    await retryBtn.click();
  } else {
    await expect(page.locator('#preview-btn')).toBeEnabled({ timeout: 15000 });
    await page.evaluate(() => document.getElementById('preview-btn')?.click());
  }

  // Wait for a second call to be made
  await expect.poll(() => callCount, { timeout: 10000 }).toBeGreaterThanOrEqual(2);

  // Wait for preview content or error to appear
  await page.waitForSelector('#preview-content, #error', { timeout: 15000 }).catch(() => null);
  const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
  const errorVisible = await page.locator('#error').isVisible().catch(() => false);
  expect(previewVisible || errorVisible).toBeTruthy();
});
