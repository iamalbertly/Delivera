import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  getLayoutOverlapReport,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';

const MOCK_BRIEF = {
  briefId: 'MPSA-Q1-W23',
  generatedAt: new Date().toISOString(),
  freshness: { confidenceLimit: 'live', jiraFetchedAt: new Date().toISOString() },
  portfolio: 'MPSA',
  deliveryTruth: { committed: 1, done: 1, staleInProgress: 0, blocked: 0, lateAdded: 0 },
  topRisks: [],
  portfolioRisks: [],
  evidencePack: { rows: [] },
  executiveView: { verdictTier: 'ok', verdictLabel: 'ON TRACK', businessHeadline: 'Test' },
  leadershipNarrative: { confidence: 'high', headline: 'Test', oneParagraph: 'Test', meetingAnswer: 'OK' },
  meta: { narratedBy: 'template' },
};

async function skipIfLogin(page) {
  if ((page.url() || '').includes('/login')) {
    test.skip(true, 'Auth redirect');
    return true;
  }
  return false;
}

async function mockGovernanceBrief(page) {
  await routeProjectsCatalog(page, { MVA: false });
  await page.route('**/api/governance-brief.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(MOCK_BRIEF),
  }));
  await page.route('**/api/quarters-list**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'Q1 FY26', period: 'Q1', isCurrent: true }] }),
  }));
}

test.describe('Jira-style top chrome E2E', () => {
  test('chrome persists on key surfaces with AA contrast on brand', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    for (const path of ['/governance', '/current-sprint', '/report', '/settings']) {
      await test.step(`visit ${path}`, async () => {
        if (path === '/governance') await mockGovernanceBrief(page);
        await page.goto(path);
        if (await skipIfLogin(page)) return;
        await expect(page.locator('#app-top-chrome')).toHaveCount(1);
        await expect(page.locator('[data-top-action="create-work"]')).toBeVisible();
        await expect(page.locator('[data-top-action="settings"]')).toBeVisible();
      });
    }
    const ratio = await page.evaluate(() => {
      const el = document.querySelector('.app-top-brand-name');
      if (!el) return 0;
      const fg = getComputedStyle(el).color;
      const bg = getComputedStyle(document.querySelector('#app-top-chrome')).backgroundColor;
      const parse = (s) => {
        const m = String(s).match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1].split(',').map((x) => Number(x.trim()));
        return { r: p[0], g: p[1], b: p[2] };
      };
      const lum = (rgb) => {
        const c = (v) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * c(rgb.r) + 0.7152 * c(rgb.g) + 0.0722 * c(rgb.b);
      };
      const f = parse(fg);
      const b = parse(bg);
      if (!f || !b) return 0;
      const hi = Math.max(lum(f), lum(b));
      const lo = Math.min(lum(f), lum(b));
      return (hi + 0.05) / (lo + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    assertTelemetryClean(telemetry);
  });

  test('sidebar has three primaries; settings only in top chrome', async ({ page }) => {
    await page.goto('/report');
    if (await skipIfLogin(page)) return;
    await expect(page.locator('.app-sidebar a.sidebar-link[data-nav-key="settings"]')).toHaveCount(0);
    await expect(page.locator('.app-sidebar .sidebar-link, .app-sidebar a.sidebar-link')).toHaveCount(3);
    await expect(page.locator('[data-top-action="settings"]')).toBeVisible();
  });

  test('surface switcher navigates Brief Sprint Proof', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGovernanceBrief(page);
    await page.goto('/governance');
    if (await skipIfLogin(page)) return;

    await test.step('switch to Sprint', async () => {
      await page.locator('.app-top-switcher-item[data-top-surface="sprints"]').click();
      await expect(page).toHaveURL(/\/current-sprint/);
    });
    await test.step('switch to Proof', async () => {
      await page.locator('.app-top-switcher-item[data-top-surface="report"]').click();
      await expect(page).toHaveURL(/\/report/);
    });
    await test.step('switch to Brief', async () => {
      await page.locator('.app-top-switcher-item[data-top-surface="governance"]').click();
      await expect(page).toHaveURL(/\/governance/);
    });
    assertTelemetryClean(telemetry);
  });

  test('Create work opens drawer from top chrome', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.route('**/api/outcome-draft**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ title: 'Test', type: 'story' }] }),
    }));
    await page.goto('/report');
    if (await skipIfLogin(page)) return;
    await page.locator('[data-top-action="create-work"]').click();
    await expect(page.locator('#wdd-source-textarea')).toBeVisible({ timeout: 15000 });
    assertTelemetryClean(telemetry);
  });

  test('settings gear opens settings page', async ({ page }) => {
    await page.goto('/governance');
    if (await skipIfLogin(page)) return;
    await page.locator('[data-top-action="settings"]').click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('desktop sidebar collapse toggles body class', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('delivera_sidebar_collapsed_preset_v1', '1');
      localStorage.setItem('delivera_sidebar_collapsed', '0');
    });
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/report');
    if (await skipIfLogin(page)) return;
    const before = await page.evaluate(() => document.body.classList.contains('sidebar-collapsed'));
    await page.locator('[data-top-action="sidebar-toggle"]').click();
    const after = await page.evaluate(() => document.body.classList.contains('sidebar-collapsed'));
    expect(before).not.toBe(after);
  });

  test('mobile governance search collapses by default without switcher overlap', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGovernanceBrief(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    if (await skipIfLogin(page)) return;

    const searchWrap = page.locator('.app-top-search-wrap');
    await expect(searchWrap).toHaveClass(/is-collapsed/);
    await expect(page.locator('[data-top-slot="brand"]')).toBeHidden();

    const overlap = await getLayoutOverlapReport(page, {
      selectors: [
        '#app-top-chrome .app-top-switcher-item',
        '#app-top-chrome .app-top-search-wrap',
        '#app-top-chrome [data-top-action="notifications"]',
      ],
    });
    expect(overlap.overlaps, JSON.stringify(overlap.overlaps)).toEqual([]);

    await page.locator('#app-top-search').focus();
    await expect(searchWrap).not.toHaveClass(/is-collapsed/);
    await expect(page.locator('body')).toHaveClass(/top-search-active/);

    const expandedOverlap = await getLayoutOverlapReport(page, {
      selectors: [
        '#app-top-chrome .app-top-search-wrap',
        '#gov-scope-bar-mount',
        '#app-top-chrome .app-top-switcher-item',
      ],
      maxPairs: 16,
    });
    expect(expandedOverlap.truncated).toBeFalsy();
    expect(expandedOverlap.overlaps, JSON.stringify(expandedOverlap.overlaps)).toEqual([]);

    assertTelemetryClean(telemetry);
  });

  test('tablet governance top chrome has no switcher overlap at 768px', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockGovernanceBrief(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/governance');
    if (await skipIfLogin(page)) return;

    await expect(page.locator('.app-top-search-wrap')).toHaveClass(/is-collapsed/);
    await expect(page.locator('[data-top-slot="brand"]')).toBeHidden();

    const overlap = await getLayoutOverlapReport(page, {
      selectors: [
        '#app-top-chrome .app-top-switcher-item',
        '#app-top-chrome .app-top-search-wrap',
        '#app-top-chrome [data-top-action="notifications"]',
        '#app-top-chrome [data-top-action="create-work"]',
      ],
      maxPairs: 24,
    });
    expect(overlap.truncated).toBeFalsy();
    expect(overlap.overlaps, JSON.stringify(overlap.overlaps)).toEqual([]);

    assertTelemetryClean(telemetry);
  });

  test('mobile sidebar drawer opens from top toggle', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');
    if (await skipIfLogin(page)) return;
    await page.locator('[data-top-action="sidebar-toggle"]').click();
    await expect(page.locator('.app-sidebar.open')).toBeVisible({ timeout: 5000 });
  });

  test('login page has no top chrome', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/login');
    if (!page.url().includes('/login')) {
      test.skip(true, 'Auth bypass redirects away from login in this environment');
      return;
    }
    await expect(page.locator('body.login-page')).toBeVisible();
    await expect(page.locator('#app-top-chrome')).toHaveCount(0);
  });

  test('notifications bell opens dock in place', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('appNotificationsV1', JSON.stringify({
        total: 2,
        missingEstimate: 1,
        missingLogged: 1,
        boardName: 'MPSA',
        sprintName: 'Sprint 1',
      }));
    });
    await page.goto('/report');
    if (await skipIfLogin(page)) return;
    await page.locator('[data-top-action="notifications"]').click();
    await expect(page.locator('#app-notification-dock')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/report/);
  });

  test('notification dock mounts inside app notification slot', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('appNotificationsV1', JSON.stringify({
        total: 1,
        missingEstimate: 0,
        missingLogged: 1,
        boardName: 'MPSA',
        sprintName: 'Sprint 1',
      }));
    });
    await page.goto('/report');
    if (await skipIfLogin(page)) return;
    await page.locator('[data-top-action="notifications"]').click();
    const dock = page.locator('#app-notification-dock');
    await expect(dock).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#app-notification-slot')).toContainText(/Sprint|notification/i);
    await expect(page.locator('#app-notification-slot #app-notification-dock')).toHaveCount(1);
  });

  test('governance bell opens dock with Brief queue link', async ({ page }) => {
    await mockGovernanceBrief(page);
    await page.addInitScript(() => {
      localStorage.setItem('appNotificationsV1', JSON.stringify({
        total: 1,
        missingEstimate: 0,
        missingLogged: 1,
        boardName: 'MPSA',
        sprintName: 'Sprint 1',
      }));
    });
    await page.goto('/governance');
    if (await skipIfLogin(page)) return;
    await page.locator('[data-top-action="notifications"]').click();
    await expect(page.locator('#app-notification-dock')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.app-notification-link')).toContainText('Open Brief queue');
    await expect(page).toHaveURL(/\/governance/);
  });

  test('dismiss removes notification-dock-visible from body', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('appNotificationsV1', JSON.stringify({
        total: 1,
        missingEstimate: 0,
        missingLogged: 1,
        boardName: 'MPSA',
        sprintName: 'Sprint 1',
      }));
    });
    await page.goto('/report');
    if (await skipIfLogin(page)) return;
    await page.locator('[data-top-action="notifications"]').click();
    await expect(page.locator('#app-notification-dock')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('body')).toHaveClass(/notification-dock-visible/);
    await page.locator('[data-notification-dismiss]').click();
    await expect(page.locator('body')).not.toHaveClass(/notification-dock-visible/);
  });

  test('report first paint hides duplicate back link and bottom nav', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/report');
    if (await skipIfLogin(page)) return;
    await expect(page.locator('.report-back-to-brief')).toBeHidden();
    await expect(page.locator('.mobile-bottom-nav-wrap')).toHaveCount(0);
    await expect(page.locator('#app-top-chrome')).toBeVisible();
  });

  test('report hash trends normalizes when leaving via switcher', async ({ page }) => {
    await page.goto('/report#trends');
    if (await skipIfLogin(page)) return;
    await page.locator('.app-top-switcher-item[data-top-surface="governance"]').click();
    await expect(page).toHaveURL(/\/governance/);
  });

  test('contextual search focuses report project filter', async ({ page }) => {
    await page.goto('/report');
    if (await skipIfLogin(page)) return;
    const projectSearch = page.locator('#project-search');
    if (await projectSearch.count() === 0) {
      test.skip(true, 'Project search not on screen');
      return;
    }
    await page.locator('#app-top-search').fill('MPSA');
    await page.locator('#app-top-search').press('Enter');
    await expect(projectSearch).toBeFocused();
  });
});
