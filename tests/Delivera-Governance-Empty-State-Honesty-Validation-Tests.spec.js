import { test, expect } from '@playwright/test';
import { loginIfRequired } from './Delivera-Playwright-Login-If-Required-01Helper.js';

/**
 * Validates EC-01 / empty-state honesty:
 * - When Jira evidence fetch fails AND cache is empty, Governance must render the named offline message.
 * - Avoid blank/indefinite loading states.
 */

test.describe('Governance empty state honesty', () => {
  test('governance renders named offline empty state when Jira is unreachable', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        for (let i = localStorage.length - 1; i >= 0; i -= 1) {
          const key = localStorage.key(i);
          if (key && String(key).startsWith('delivera:governance:active-loop')) localStorage.removeItem(key);
        }
      } catch (_) {}
    });

    // Simulate Jira evidence fetch failure.
    await page.route('**/api/governance/active-loop.json**', (route) => route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Jira unreachable (test)' }),
    }));

    await loginIfRequired(page, '/governance', {
      rootSelector: '[data-testid="governance-active-loop"], #gov-active-loop-mount, body.governance-page',
      timeout: 20000,
    });

    const hero = page.locator('.gov-active-loop-hero.is-limited');
    await expect(hero).toBeVisible({ timeout: 20000 });
    await expect(hero.locator('h1')).toContainText(/No Jira data yet/i);
    await expect(hero).toContainText(/Settings/i);
  });

  test('reconnect clears stale ACCESS_BLOCKED client cache before reload', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        const stale = {
          savedAt: new Date().toISOString(),
          answer: {
            schemaVersion: 2,
            presentationContractVersion: 5,
            answer: 'Jira access prevents verification',
            sourceLine: '1 promises checked',
            decisionCoverage: { total: 1, closed: 0, copy: '1 open' },
            scope: { projects: ['SD'], complete: true, verifiedSquads: 1, expectedSquads: 1 },
            squads: [{
              squad: 'SD',
              displayName: 'Software Delivery',
              attentionCount: 1,
              contractState: { state: 'cannot-verify', label: 'Cannot verify' },
              trustFactor: { label: 'Limited' },
              diagnosisGroups: [{ code: 'access-blocked', label: 'Jira access prevents verification', count: 1 }],
            }],
            promises: [{ promiseId: 'p1', diagnosisCode: 'access-blocked', diagnosisLabel: 'Jira access prevents verification' }],
            deliveraDid: 'Cached ghost access state',
            verifiedAt: new Date().toISOString(),
          },
        };
        localStorage.setItem('delivera:governance:active-loop:v2:20260730a:SD:current', JSON.stringify(stale));
      } catch (_) {}
    });

    await page.route('**/api/settings/jira-connection/refresh', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, displayName: 'Test User', cachesCleared: true, message: 'ok' }),
    }));
    await page.route('**/api/settings/ai-usage.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalCalls: 0, fallbackCalls: 0 }),
    }));
    await page.route('**/api/governance/intelligence/health**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ worker: 'ok', quota: { remaining: 10, ceiling: 10 }, circuits: [], cache: { namespaceCount: 0 }, modelRoles: {} }),
    }));

    await loginIfRequired(page, '/settings', {
      rootSelector: '#gov-ai-helper, #gov-settings-ai-mount, #gov-jira-refresh-connection, body',
      timeout: 20000,
    });

    const refresh = page.locator('#gov-jira-refresh-connection');
    await expect(refresh).toBeVisible({ timeout: 15000 });
    await refresh.click();
    await expect(page.locator('#gov-jira-refresh-result')).toContainText(/Connected|refreshed|cleared/i, { timeout: 10000 });

    const remaining = await page.evaluate(() => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('delivera:governance:active-loop:')) keys.push(key);
      }
      return keys;
    });
    expect(remaining).toEqual([]);
  });
});