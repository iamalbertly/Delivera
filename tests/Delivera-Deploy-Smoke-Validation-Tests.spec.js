import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

const testUser = process.env.TEST_LOGIN_USER || process.env.APP_LOGIN_USER || '';
const testPass = process.env.TEST_LOGIN_PASSWORD || process.env.APP_LOGIN_PASSWORD || '';
const prodBaseUrl = (
  process.env.VERCEL_PROD_URL
  || process.env.DELIVERA_PROD_BASE_URL
  || process.env.VODAAGILEBOARD_PROD_BASE_URL
  || 'https://vodaagileboard.vercel.app'
).replace(/\/$/, '');

function captureConsoleErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push({ type: msg.type(), text: msg.text() });
  });
  return errors;
}

test.describe('Delivera – Deploy Smoke Tests', () => {
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

    await expect(page.locator('h1')).toContainText(/Proof|Evidence|Delivery|Delivera|General Performance|Performance History/);
    await expect(page.locator('#preview-btn')).toBeVisible();
    await expect(page.locator('#project-mpsa')).toBeVisible();
    await expect(page.locator('#project-mas')).toBeVisible();

    await page.click('#preview-btn').catch(async () => {
      await page.evaluate(() => {
        const btn = document.getElementById('preview-btn');
        if (btn && !btn.hasAttribute('disabled')) btn.click();
      });
    });

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

  test('governance brief page loads on production host', async ({ page }) => {
    test.setTimeout(120000);
    const consoleErrors = captureConsoleErrors(page);
    const target = `${prodBaseUrl}/governance`;

    const response = await page.goto(target, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `Expected HTML from ${target}`).toBeLessThan(500);

    const bodyText = await page.locator('body').innerText().catch(() => '');
    expect(bodyText).not.toMatch(/Unexpected server failure/i);
    expect(bodyText).not.toMatch(/"error"\s*:\s*"Internal server error"/i);

    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (hasLogin) {
      if (!testUser || !testPass) {
        test.skip(true, 'Auth enabled on production but no test credentials provided');
        return;
      }
      await page.fill('#username', testUser);
      await page.fill('#password', testPass);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/governance/, { timeout: 20000 });
    }

    await expect(page.locator('body.governance-page')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('h1.governance-title')).toContainText(/delivery answer/i);
    await expect(page.locator('#gov-answer-mount')).toBeAttached();

    const briefApi = await page.request.get(`${prodBaseUrl}/api/governance-brief.json?projects=MPSA`);
    expect(briefApi.status(), 'Governance brief API should be routed to Express').toBeLessThan(500);
    expect(briefApi.status()).not.toBe(404);

    const errorEvents = consoleErrors.filter((e) => {
      if (e.type !== 'error') return false;
      // Upstream Jira/API 5xx on live host is an integration issue, not a deploy routing failure.
      if (/failed to load resource/i.test(e.text) && /\b(502|503|504)\b/.test(e.text)) return false;
      return true;
    });
    expect(errorEvents).toHaveLength(0);
  });
});
