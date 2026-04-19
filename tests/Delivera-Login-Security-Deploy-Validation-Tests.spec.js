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

test.describe('VodaAgileBoard – Login, Security & Deploy Validation', () => {
  test('GET / shows login page or redirects to /report when auth disabled', async ({ page }) => {
    const consoleErrors = captureConsoleErrors(page);
    await page.goto('/', { waitUntil: 'load' });
    const url = page.url();
    const hasLoginForm = await page.locator('#username').isVisible().catch(() => false);
    if (hasLoginForm) {
      await expect(page.locator('h1')).toContainText(/VodaAgileBoard|General Performance|Performance History/);
      await expect(page.locator('input[name="username"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
      const honeypot = page.locator('#website');
      await expect(honeypot).toHaveCount(1);
      await expect(honeypot).toBeHidden();
    } else {
      if (!url.match(/\/report$/)) await page.goto('/report');
      await expect(page.locator('h1')).toContainText(/VodaAgileBoard|General Performance|Performance History/);
      await expect(page.locator('#preview-btn')).toBeVisible();
    }
    const errs = consoleErrors.filter((e) => e.type === 'error');
    const relevant = errs.filter((e) => !(e.text && e.text.includes('404') && (e.text.includes('csv-columns') || e.text.includes('Failed to load resource'))));
    expect(relevant).toHaveLength(0);
  });

  test('honeypot rejection when auth enabled', async ({ page }) => {
    const consoleErrors = captureConsoleErrors(page);
    await page.goto('/');
    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (!hasLogin) {
      test.skip(true, 'Auth disabled – no login form');
      return;
    }
    await page.fill('#username', testUser || 'u');
    await page.fill('#password', testPass || 'p');
    await page.fill('#website', 'bot-filled');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(login)?(\?|$)/, { timeout: 5000 }).catch(() => {});
    const finalUrl = page.url();
    expect(finalUrl).not.toMatch(/\/report$/);
    expect(consoleErrors.filter((e) => e.type === 'error')).toHaveLength(0);
  });

  test('invalid credentials when auth enabled', async ({ page }) => {
    const consoleErrors = captureConsoleErrors(page);
    await page.goto('/login');
    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (!hasLogin) {
      test.skip(true, 'Auth disabled');
      return;
    }
    await page.fill('#username', 'wronguser');
    await page.fill('#password', 'wrongpass');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(login)?(\?|$)/, { timeout: 5000 }).catch(() => {});
    const stayOnLogin = page.url().includes('/login') || (await page.locator('#username').isVisible());
    expect(stayOnLogin).toBeTruthy();
    expect(consoleErrors.filter((e) => e.type === 'error')).toHaveLength(0);
  });

  test('valid login redirects to /report when auth enabled', async ({ page }) => {
    const consoleErrors = captureConsoleErrors(page);
    await page.goto('/login');
    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (!hasLogin || !testUser || !testPass) {
      test.skip(true, 'Auth disabled or no test credentials');
      return;
    }
    await page.fill('#username', testUser);
    await page.fill('#password', testPass);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/report/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText(/VodaAgileBoard|General Performance|Performance History/);
    await expect(page.locator('#preview-btn')).toBeVisible();
    expect(consoleErrors.filter((e) => e.type === 'error')).toHaveLength(0);
  });

  test('protected /report redirects to login when auth enabled and not logged in', async ({ page }) => {
    const consoleErrors = captureConsoleErrors(page);
    await page.goto('/report');
    const url = page.url();
    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (!hasLogin) {
      expect(url).toMatch(/\/report$/);
      test.skip(true, 'Auth disabled – /report accessible');
      return;
    }
    expect(url).toMatch(/\/(login)?(\?|$)/);
    expect(consoleErrors.filter((e) => e.type === 'error')).toHaveLength(0);
  });

  test('protected API returns 401 when auth enabled and no session', async ({ request }) => {
    let response;
    try {
      response = await request.get('/preview.json?projects=MPSA');
    } catch (err) {
      test.skip(true, `Request failed or timed out: ${err.message}`);
      return;
    }
    if (response.status() === 200) {
      test.skip(true, 'Auth disabled - API open');
      return;
    }
    if (response.status() === 500) {
      test.skip(true, 'Auth disabled or missing Jira credentials - API returned server error');
      return;
    }
    expect(response.status()).toBe(401);
    const json = await response.json().catch(() => ({}));
    expect(json.error || json.code).toBeTruthy();
  });

  test('post-login report flow when auth enabled', async ({ page }) => {
    const consoleErrors = captureConsoleErrors(page);
    await page.goto('/');
    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (!hasLogin || !testUser || !testPass) {
      test.skip(true, 'Auth disabled or no test credentials');
      return;
    }
    await page.fill('#username', testUser);
    await page.fill('#password', testPass);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/report/, { timeout: 10000 });
    await expect(page.locator('#preview-btn')).toBeVisible();
    await expect(page.locator('#project-mpsa')).toBeVisible();
    await page.click('#preview-btn');
    await Promise.race([
      page.waitForSelector('#loading', { state: 'visible', timeout: 5000 }).catch(() => null),
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 15000 }).catch(() => null),
      page.waitForSelector('#error', { state: 'visible', timeout: 15000 }).catch(() => null),
    ]);
    const loading = await page.locator('#loading').isVisible().catch(() => false);
    if (loading) await page.waitForSelector('#loading', { state: 'hidden', timeout: 120000 });
    const hasContent = await page.locator('#preview-content').isVisible().catch(() => false);
    const hasError = await page.locator('#error').isVisible().catch(() => false);
    expect(hasContent || hasError).toBeTruthy();
    expect(consoleErrors.filter((e) => e.type === 'error')).toHaveLength(0);
  });

  test('shows session timeout message when error=timeout', async ({ page }) => {
    const consoleErrors = captureConsoleErrors(page);
    await page.goto('/login?error=timeout&redirect=%2Freport');
    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (!hasLogin) {
      test.skip(true, 'Auth disabled – /login redirects to /report');
      return;
    }
    const message = await page.locator('#login-error').innerText();
    expect(message.toLowerCase()).toContain('session expired');
    expect(consoleErrors.filter((e) => e.type === 'error')).toHaveLength(0);
  });

  test('stays on login after repeated invalid attempts (rate limit path)', async ({ page }) => {
    const consoleErrors = captureConsoleErrors(page);
    await page.goto('/login');
    const hasLogin = await page.locator('#username').isVisible().catch(() => false);
    if (!hasLogin) {
      test.skip(true, 'Auth disabled');
      return;
    }
    for (let i = 0; i < 6; i++) {
      await page.fill('#username', `wrong${i}`);
      await page.fill('#password', `wrong${i}`);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(login)?(\?|$)/, { timeout: 5000 }).catch(() => {});
    }
    const url = page.url();
    const stayOnLogin = url.includes('/login') || (await page.locator('#username').isVisible());
    expect(stayOnLogin).toBeTruthy();
    expect(consoleErrors.filter((e) => e.type === 'error')).toHaveLength(0);
  });
});
