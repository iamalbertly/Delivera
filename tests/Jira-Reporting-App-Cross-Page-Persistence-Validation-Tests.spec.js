/**
 * Cross-Page Persistence: Report → Leadership → Current Sprint → Report;
 * same projects and date range persist; context bar reflects current context.
 */

import { test, expect } from '@playwright/test';
import { waitForPreview } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const assertContainsProjectCodes = async (locator) => {
  const text = (await locator.textContent()) || '';
  expect(text).toMatch(/SD/);
  expect(text).toMatch(/MAS/);
  expect(text).toMatch(/BIO/);
  expect(text).toMatch(/RPA/);
};
const assertProjectSetValue = async (locator, expectedCodes) => {
  const actual = ((await locator.inputValue()) || '').split(',').map((x) => x.trim()).filter(Boolean).sort();
  const expected = expectedCodes.split(',').map((x) => x.trim()).filter(Boolean).sort();
  expect(actual).toEqual(expected);
};

test.describe('Cross-Page Persistence', () => {
  test('persisted projects and date range survive Report → Leadership → Current Sprint → Report', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto(BASE_URL + '/report');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    const startVal = '2025-10-01T00:00';
    const endVal = '2025-12-31T23:59';
    const projectIds = ['project-sd', 'project-mas', 'project-bio', 'project-rpa'];
    const projectCodes = 'SD,MAS,BIO,RPA';
    const ensureReportFiltersVisible = async () => {
      const mpsaBox = page.locator('#project-mpsa');
      if (await mpsaBox.isVisible().catch(() => false)) return;
      const showFilters = page.locator('#filters-panel-collapsed-bar [data-action="toggle-filters"]');
      if (await showFilters.isVisible().catch(() => false)) {
        await showFilters.click();
      }
      await expect(mpsaBox).toBeVisible();
    };
    const triggerPreview = async () => {
      await ensureReportFiltersVisible();
      await page.evaluate(() => {
        const el = document.getElementById('preview-btn');
        if (el) el.click();
      });
    };

    await expect(page.locator('#preview-btn')).toBeVisible();
    await ensureReportFiltersVisible();

    await page.evaluate((ids) => {
      const setBox = (id, value) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.checked = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setBox('project-mpsa', false);
      setBox('project-mas', false);
      ids.forEach((id) => setBox(id, true));
    }, projectIds);
    await page.fill('#start-date', startVal);
    await page.fill('#end-date', endVal);
    await triggerPreview();

    await Promise.race([
      page.waitForSelector('#loading', { state: 'visible', timeout: 10000 }).catch(() => null),
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 10000 }).catch(() => null),
      page.waitForSelector('#error', { state: 'visible', timeout: 10000 }).catch(() => null),
    ]);
    await waitForPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip(true, 'Preview did not complete; cannot validate persistence');
      return;
    }

    const contextBar = page.locator('[data-context-bar]');
    await expect(contextBar).toBeVisible();
    await assertContainsProjectCodes(contextBar);

    await page.goto(BASE_URL + '/sprint-leadership');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }
    if (page.url().includes('/report')) {
      for (const id of projectIds) {
        await expect(page.locator('#' + id)).toBeChecked();
      }
      await assertContainsProjectCodes(page.locator('[data-context-bar]'));
    } else {
      await expect(page.locator('#leadership-projects')).toBeVisible();
      await assertProjectSetValue(page.locator('#leadership-projects'), projectCodes);
      await assertContainsProjectCodes(page.locator('[data-context-bar]'));
    }

    await page.goto(BASE_URL + '/current-sprint');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }
    await expect(page.locator('#current-sprint-projects')).toBeVisible();
    const currentSprintProject = ((await page.locator('#current-sprint-projects').inputValue()) || '').trim();
    const allowedCurrentSprintProjects = projectCodes.split(',').map((x) => x.trim());
    expect(allowedCurrentSprintProjects.includes(currentSprintProject)).toBeTruthy();

    await page.goto(BASE_URL + '/report');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }
    await ensureReportFiltersVisible();
    for (const id of projectIds) {
      await expect(page.locator('#' + id)).toBeChecked();
    }
    await expect(page.locator('#start-date')).toHaveValue(/2025-10-01/);
    await expect(page.locator('#end-date')).toHaveValue(/2025-12-31/);
  });
});
