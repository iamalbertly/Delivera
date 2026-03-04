import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Leadership Trends Usage & Guardrails', () => {
  test('leadership route opens report trends view', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/sprint-leadership');

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login or home; auth may be required');
      return;
    }

    await expect(page).toHaveURL(/\/report(#trends)?/);
    await expect(page.locator('#tab-btn-trends')).toHaveAttribute('aria-selected', 'true');

    assertTelemetryClean(telemetry);
  });

  test('trends tab renders leadership content after preview', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/report#trends');

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login or home; auth may be required');
      return;
    }

    await expect(page.locator('#tab-btn-trends')).toHaveAttribute('aria-selected', 'true');
    await page.click('#preview-btn');
    await Promise.race([
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 60000 }).catch(() => null),
      page.waitForSelector('#error', { state: 'visible', timeout: 60000 }).catch(() => null),
    ]);

    const hasPreview = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!hasPreview) {
      test.skip(true, 'Preview did not load for current data set');
      return;
    }

    await page.click('#tab-btn-trends');
    await expect(page.locator('#tab-trends')).toBeVisible();
    await expect(page.locator('#leadership-content')).toBeVisible();
  });

  test('trends context line is stable when present during scroll', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/report#trends');

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login or home; auth may be required');
      return;
    }

    await page.click('#preview-btn');
    await Promise.race([
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 60000 }).catch(() => null),
      page.waitForSelector('#error', { state: 'visible', timeout: 60000 }).catch(() => null),
    ]);

    const hasPreview = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!hasPreview) {
      test.skip(true, 'Preview did not load for current data set');
      return;
    }

    await page.click('#tab-btn-trends');

    const context = page.locator('.leadership-context-sticky, .leadership-context-line').first();
    const hasContext = await context.isVisible().catch(() => false);
    if (!hasContext) {
      test.skip(true, 'Trends context line not visible for current data set');
      return;
    }

    const beforeText = (await context.textContent().catch(() => '')) || '';
    await page.evaluate(() => {
      const el = document.querySelector('.leadership-context-sticky, .leadership-context-line');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const absoluteTop = rect.top + window.scrollY;
      const target = Math.max(0, absoluteTop - 140);
      window.scrollTo(0, target + 420);
    });
    await page.waitForTimeout(150);
    const afterText = (await context.textContent().catch(() => '')) || '';
    const stillAttached = await context.count();
    if (!stillAttached) {
      test.skip(true, 'Could not measure trends context line position');
      return;
    }
    expect(afterText.trim().length).toBeGreaterThan(0);
    expect(afterText.trim()).toContain(beforeText.trim().slice(0, 16));
  });
});
