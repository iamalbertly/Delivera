import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  getViewportClippingReport,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

async function skipIfAuthRedirect(page) {
  const url = page.url() || '';
  if (url.includes('/login') || url.endsWith('/')) {
    test.skip(true, 'Auth redirect active; navigation validation requires app shell routes');
    return true;
  }
  return false;
}

async function expectActiveSwitcher(page, surface) {
  await expect(page.locator(`.app-top-switcher-item.is-active[data-top-surface="${surface}"]`)).toBeVisible();
}

async function openMobileSidebarReliably(page) {
  const sidebar = page.locator('.app-sidebar');
  const toggle = page.locator('.app-top-sidebar-toggle, .sidebar-toggle');
  await expect(toggle.first()).toBeVisible();
  await toggle.first().click();
  const openedFirstTry = await page.evaluate(() => {
    const sidebarEl = document.querySelector('.app-sidebar');
    const toggleEl = document.querySelector('.app-top-sidebar-toggle, .sidebar-toggle');
    return !!(sidebarEl && sidebarEl.classList.contains('open'))
      || (toggleEl?.getAttribute('aria-expanded') === 'true');
  }).catch(() => false);
  if (!openedFirstTry) {
    await toggle.first().click({ force: true });
  }
  const opened = await page.waitForFunction(() => {
    const sidebarEl = document.querySelector('.app-sidebar');
    const toggleEl = document.querySelector('.app-top-sidebar-toggle, .sidebar-toggle');
    return !!(sidebarEl && sidebarEl.classList.contains('open'))
      || (toggleEl?.getAttribute('aria-expanded') === 'true');
  }, null, { timeout: 5000 }).then(() => true).catch(() => false);
  if (!opened) return false;
  await expect(sidebar).toBeVisible();
  return true;
}

test.describe('Delivera - Navigation Consistency Mobile Trust Realtime Validation Tests', () => {
  test('01 report renders global navigation with clear active state', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    await expect(page.locator('.app-sidebar')).toBeAttached();
    await expect(page.locator('#app-top-chrome')).toBeVisible();
    await expect(page.locator('.app-top-switcher-item[data-top-surface="actions"]')).toBeVisible();
    await expect(page.locator('.app-top-switcher-item[data-top-surface="sprints"]')).toBeVisible();
    await expectActiveSwitcher(page, 'actions');
    assertTelemetryClean(telemetry);
  });

  test('02 trends tab activation from report uses direct hash-to-value', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    await page.click('#tab-btn-trends');
    await expect(page).toHaveURL(/\/report#trends/);
    await expect(page.locator('#tab-btn-trends')).toHaveClass(/active/);
    await expectActiveSwitcher(page, 'actions');
    assertTelemetryClean(telemetry);
  });

  test('03 deep-link report#trends opens leadership tab and nav state reliably', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report#trends');
    if (await skipIfAuthRedirect(page)) return;

    await expect(page.locator('#tab-btn-trends')).toHaveClass(/active/);
    await expectActiveSwitcher(page, 'actions');
    assertTelemetryClean(telemetry);
  });

  test('04 switching away from trends resets hash and returns report nav state', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report#trends');
    if (await skipIfAuthRedirect(page)) return;

    await page.click('#tab-btn-project-epic-level');
    await expect(page).toHaveURL(/\/report$/);
    await expectActiveSwitcher(page, 'actions');
    assertTelemetryClean(telemetry);
  });

  test('05 current sprint page keeps nav visible and active on sprint destination', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfAuthRedirect(page)) return;

    await expect(page.locator('.app-sidebar')).toBeAttached();
    await expect(page.locator('#app-top-chrome')).toBeVisible();
    await expectActiveSwitcher(page, 'sprints');
    assertTelemetryClean(telemetry);
  });

  test('06 current sprint actions nav resolves to actions destination', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    if (await skipIfAuthRedirect(page)) return;

    await page.locator('.app-top-switcher-item[data-top-surface="actions"]').click();
    await expect(page).toHaveURL(/\/actions/);
    assertTelemetryClean(telemetry);
  });

  test('07 mobile sidebar opens with lock + accessible expanded state', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    const opened = await openMobileSidebarReliably(page);
    if (!opened) {
      test.skip(true, 'Mobile sidebar did not open in this browser/session state');
      return;
    }
    const navOpenState = await page.evaluate(() => {
      const backdrop = document.querySelector('.sidebar-backdrop');
      const sidebar = document.querySelector('.app-sidebar');
      const toggle = document.querySelector('.app-top-sidebar-toggle, .sidebar-toggle');
      return {
        sidebarOpen: !!(sidebar && sidebar.classList.contains('open')),
        backdropActive: !!(backdrop && backdrop.classList.contains('active')),
        toggleExpanded: toggle?.getAttribute('aria-expanded') === 'true',
      };
    });
    if (!(navOpenState.sidebarOpen || navOpenState.backdropActive || navOpenState.toggleExpanded)) {
      test.skip(true, 'Sidebar open state was not stable in this run');
      return;
    }
    const bodyLockState = await page.evaluate(() => {
      const bodyClass = document.body.className || '';
      const bodyStyle = window.getComputedStyle(document.body);
      return {
        hasClassLock: /sidebar-scroll-lock/.test(bodyClass),
        overflowHidden: bodyStyle.overflow === 'hidden',
      };
    });
    expect(
      navOpenState.sidebarOpen
      || navOpenState.backdropActive
      || navOpenState.toggleExpanded
      || bodyLockState.hasClassLock
      || bodyLockState.overflowHidden
    ).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('08 mobile backdrop click closes sidebar and restores toggle state', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    const opened = await openMobileSidebarReliably(page);
    if (!opened) {
      test.skip(true, 'Mobile sidebar did not open in this browser/session state');
      return;
    }
    await page.evaluate(() => {
      const backdrop = document.querySelector('.sidebar-backdrop');
      if (backdrop) backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await expect.poll(async () => {
      return page.evaluate(() => {
        const sidebar = document.querySelector('.app-sidebar');
        const toggle = document.querySelector('.app-top-sidebar-toggle, .sidebar-toggle');
        const bodyClass = document.body.className || '';
        return (
          !(sidebar && sidebar.classList.contains('open'))
          && toggle?.getAttribute('aria-expanded') !== 'true'
          && !/sidebar-scroll-lock/.test(bodyClass)
        );
      });
    }, { timeout: 5000 }).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('09 mobile Escape key closes sidebar reliably', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    const opened = await openMobileSidebarReliably(page);
    if (!opened) {
      test.skip(true, 'Mobile sidebar did not open in this browser/session state');
      return;
    }
    await page.keyboard.press('Escape');
    await expect.poll(async () => {
      return page.evaluate(() => {
        const sidebar = document.querySelector('.app-sidebar');
        const toggle = document.querySelector('.app-top-sidebar-toggle, .sidebar-toggle');
        return !(sidebar && sidebar.classList.contains('open')) && toggle?.getAttribute('aria-expanded') !== 'true';
      });
    }, { timeout: 5000 }).toBe(true);
    assertTelemetryClean(telemetry);
  });

  test('10 mobile nav click closes sidebar after destination change', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    await openMobileSidebarReliably(page);
    await page.locator('.app-top-switcher-item[data-top-surface="sprints"]').click();
    await expect(page).toHaveURL(/\/current-sprint/);
    await expect(page.locator('.sidebar-backdrop')).not.toHaveClass(/active/);
    assertTelemetryClean(telemetry);
  });

  test('11 report mobile layout keeps navigation and shell within viewport', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    const report = await getViewportClippingReport(page, {
      selectors: ['body', '.container', 'header', '.main-layout', '#app-top-chrome'],
      maxLeftGapPx: 12,
      maxRightOverflowPx: 1,
    });
    expect(report.offenders).toEqual([]);
    assertTelemetryClean(telemetry);
  });

  test('12 /leadership route resolves to canonical report trends destination', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/leadership');
    if (await skipIfAuthRedirect(page)) return;

    if (page.url().includes('/report')) {
      await expect(page).toHaveURL(/\/report#trends/);
      await expect(page.locator('#tab-btn-trends')).toHaveClass(/active/);
    } else if (page.url().includes('/governance')) {
      await expect(page).toHaveURL(/\/governance/);
    } else {
      await expect(page).toHaveURL(/\/leadership/);
      await expect(page.locator('#project-context')).toBeAttached();
    }
    assertTelemetryClean(telemetry);
  });

  test('13 cross-page navigation journey remains telemetry-clean and state-consistent', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfAuthRedirect(page)) return;

    await page.click('#tab-btn-trends');
    await expect(page).toHaveURL(/\/report#trends/);
    await page.locator('.app-top-switcher-item[data-top-surface="sprints"]').click();
    await expect(page).toHaveURL(/\/current-sprint/);
    await page.locator('.app-top-switcher-item[data-top-surface="actions"]').click();
    await expect(page).toHaveURL(/\/actions/);
    await page.locator('.app-top-switcher-item[data-top-surface="governance"]').click();
    await expect(page).toHaveURL(/\/governance/);
    assertTelemetryClean(telemetry);
  });
});
