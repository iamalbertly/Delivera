import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('UX Login Trust & Copy Validation', () => {
  test('login copy, outcome, and trust strip are visible when login screen is active', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/login');

    const hasLoginForm = await page.locator('#login-form').isVisible().catch(() => false);
    if (!hasLoginForm) {
      test.skip(true, 'Login form not visible; auth may be disabled in this environment');
      return;
    }

    await expect(page.locator('h1')).toContainText('VodaAgileBoard');
    await expect(page.locator('.login-outcome-line')).toContainText(/Sprint risks and delivery in under 30 seconds/i);
    await expect(page.locator('.login-trust-line')).toContainText(/Internal use.*Session-secured|credentials never stored/i);
    await expect(page.locator('.login-footer')).toContainText('Owned by Agile & Digital PMO');

    assertTelemetryClean(telemetry);
  });

  test('login error mapping shows actionable messages for each error code', async ({ page }) => {
    const cases = [
      { query: 'invalid', expected: /Username or password incorrect/i },
      { query: 'bot', expected: /Security check did not pass/i },
      { query: 'timeout', expected: /Session expired/i },
      { query: 'ratelimit', expected: /Too many attempts.*Wait a minute/i },
    ];

    for (const c of cases) {
      await page.goto('/login?error=' + c.query);
      const hasLoginForm = await page.locator('#login-form').isVisible().catch(() => false);
      if (!hasLoginForm) {
        test.skip(true, 'Login form not visible; auth may be disabled in this environment');
        return;
      }
      await expect(page.locator('#login-error')).toBeVisible();
      const text = await page.locator('#login-error').textContent();
      expect(text || '').toMatch(c.expected);
    }
  });

  test('login error moves focus to error or username', async ({ page }) => {
    await page.goto('/login?error=invalid');
    const hasLoginForm = await page.locator('#login-form').isVisible().catch(() => false);
    if (!hasLoginForm) {
      test.skip(true, 'Login form not visible');
      return;
    }
    await expect(page.locator('#login-error')).toBeVisible();
    const focusedId = await page.evaluate(() => document.activeElement?.id || '');
    expect(['login-error', 'username']).toContain(focusedId);
  });

  test('sign-in button disables on submit to prevent double-clicks', async ({ page }) => {
    await page.goto('/login');
    const hasLoginForm = await page.locator('#login-form').isVisible().catch(() => false);
    if (!hasLoginForm) {
      test.skip(true, 'Login form not visible; auth may be disabled in this environment');
      return;
    }

    // Prevent real navigation so we can observe button state
    await page.evaluate(() => {
      const form = document.getElementById('login-form');
      if (form) {
        form.addEventListener('submit', function (ev) { ev.preventDefault(); });
      }
    });

    await page.fill('#username', 'user');
    await page.fill('#password', 'pass');
    const submit = page.locator('#login-submit');
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveText(/Signing in/i);
  });
});

