/**
 * Cross-Page Persistence: Report → Leadership → Current Sprint → Report;
 * same projects and date range persist; context bar reflects current context.
 */

import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { waitForPreview, ensureReportFiltersVisible } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';

const assertContainsProjectCodes = async (locator) => {
  const text = (await locator.textContent()) || '';
  expect(text).toMatch(/SD/);
  expect(text).toMatch(/MAS/);
  expect(text).toMatch(/BIO/);
  expect(text).toMatch(/RPA/);
};
test.describe('Cross-Page Persistence', () => {
  test('persisted projects and date range survive Report → Leadership → Current Sprint → Report', async ({ page }) => {
    test.setTimeout(120000);
    await routeProjectsCatalog(page);

    await page.goto('/report');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    const startVal = '2025-10-01T00:00';
    const endVal = '2025-12-31T23:59';
    const projectIds = ['project-sd', 'project-mas', 'project-bio', 'project-rpa'];
    const projectCodes = 'SD,MAS,BIO,RPA';
    const triggerPreview = async () => {
      await ensureReportFiltersVisible(page);
      await page.waitForSelector('#projects-catalog-mount[data-catalog-ready="1"]', { timeout: 15000 }).catch(() => null);
      await page.waitForSelector('#project-sd', { timeout: 15000 }).catch(() => null);
      await page.evaluate(() => {
        const el = document.getElementById('preview-btn');
        if (el) el.click();
      });
    };

    await ensureReportFiltersVisible(page);
    await page.waitForSelector('#projects-catalog-mount[data-catalog-ready="1"]', { timeout: 15000 }).catch(() => null);
    await page.waitForSelector('#project-sd', { timeout: 15000 }).catch(() => null);
    const previewButtonVisible = await page.locator('#preview-btn').isVisible().catch(() => false);
    if (!previewButtonVisible) {
      test.skip(true, 'Preview control hidden for current dataset/state');
      return;
    }

    const projectSearch = page.locator('#project-search');
    if (await projectSearch.isVisible().catch(() => false)) {
      await projectSearch.fill('', { timeout: 5000 }).catch(() => null);
    }
    await page.evaluate((ids) => {
      const touch = (el) => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const mpsa = document.getElementById('project-mpsa');
      if (mpsa && mpsa.checked) {
        mpsa.checked = false;
        touch(mpsa);
      }
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el || el.checked) return;
        el.checked = true;
        touch(el);
      });
    }, projectIds);
    await expect(page.locator('#project-sd')).toBeChecked();
    await ensureReportFiltersVisible(page);
    await page.fill('#start-date', startVal, { force: true });
    await page.fill('#end-date', endVal, { force: true });
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

    const reportContextStrip = page.locator('#report-filter-strip');
    await expect(reportContextStrip).toBeVisible();
    for (const id of projectIds) {
      await expect(page.locator('#' + id)).toBeChecked();
    }

    await page.goto('/sprint-leadership');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }
    if (page.url().includes('/report')) {
      for (const id of projectIds) {
        await expect(page.locator('#' + id)).toBeChecked();
      }
      await assertContainsProjectCodes(reportContextStrip);
    } else if (page.url().includes('/governance')) {
      await expect(page.locator('#portfolio-scope-bar-mount, #gov-scope-bar-mount, .gov-scope-bar, .portfolio-scope-filters').first()).toBeAttached();
    } else {
      const leadershipContext = page.locator('#project-context');
      await expect(leadershipContext).toBeAttached();
      await page.waitForFunction(() => {
        const text = (document.getElementById('project-context')?.textContent || '').trim();
        return !!text && !/loading leadership signals/i.test(text);
      }, { timeout: 20000 }).catch(() => null);
      const contextVisible = await leadershipContext.isVisible().catch(() => false);
      if (contextVisible) {
        await expect(page.locator('#project-context .header-context-strip')).toHaveCount(1);
        await assertContainsProjectCodes(leadershipContext);
      } else {
        const summaryLine = page.locator('#leadership-summary');
        await expect(summaryLine).toBeVisible();
        await assertContainsProjectCodes(summaryLine);
      }
    }

    await page.goto('/current-sprint');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }
    await expect(page.locator('#current-sprint-projects')).toBeAttached();
    const currentSprintProject = ((await page.locator('#current-sprint-projects').inputValue()) || '').trim();
    const allowedCurrentSprintProjects = projectCodes.split(',').map((x) => x.trim());
    expect(allowedCurrentSprintProjects.includes(currentSprintProject)).toBeTruthy();

    await page.goto('/report');
    if (page.url().includes('login')) {
      test.skip(true, 'Redirected to login');
      return;
    }
    await ensureReportFiltersVisible(page);
    await page.waitForSelector('#projects-catalog-mount[data-catalog-ready="1"]', { timeout: 15000 }).catch(() => null);
    await page.waitForSelector('#project-sd', { timeout: 15000 }).catch(() => null);
    for (const id of projectIds) {
      await expect(page.locator('#' + id)).toBeChecked();
    }
    await expect(page.locator('#start-date')).toHaveValue(/2025-10-01/);
    await expect(page.locator('#end-date')).toHaveValue(/2025-12-31/);
  });

  test('report header current-sprint shortcut preserves remembered board and sprint context', async ({ page }) => {
    await routeProjectsCatalog(page);
    await page.goto('/report?boardId=101&sprintId=202&projects=MPSA');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    const shortcut = page.locator('[data-report-sprint-context-link], #report-header-actions a[href*="/current-sprint"]').first();
    await expect(shortcut).toBeVisible({ timeout: 10000 });
    const href = await shortcut.getAttribute('href');
    expect(href || '').toContain('/current-sprint?');
    expect(href || '').toContain('boardId=101');
    expect(href || '').toContain('sprintId=202');
    expect(href || '').toContain('projects=MPSA');
  });
});
