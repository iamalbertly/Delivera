import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { runDefaultPreview } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Epic Key linkification & column layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report');
    await expect(page.locator('h1')).toContainText(/VodaAgileBoard|General Performance|Performance History/);
  });

  test('Epic keys render as clickable links (open in new tab) in tables', async ({ page }) => {
    test.setTimeout(180000);
    await runDefaultPreview(page);

    // Navigate to Project & Epic Level (Boards + Epics)
    await page.locator('.tab-btn[data-tab="project-epic-level"]').click({ force: true });
    await page.waitForSelector('#tab-project-epic-level.active', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('#project-epic-level-content', { state: 'visible', timeout: 10000 });

    // Check for epic-key link in either Boards or Epic TTM
    const link = page.locator('#project-epic-level-content .epic-key a').first();
    const visible = await link.isVisible().catch(() => false);
    if (!visible) {
      test.skip();
      return;
    }

    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    const target = await link.getAttribute('target');
    const rel = await link.getAttribute('rel');

    expect(href && href.length > 0).toBeTruthy();
    expect(target).toBe('_blank');
    expect(rel && rel.includes('noopener')).toBeTruthy();
  });

  test('ad-hoc rows show board-scoped label and are not Jira links', async ({ page }) => {
    test.setTimeout(180000);
    await runDefaultPreview(page);
    await page.locator('.tab-btn[data-tab="project-epic-level"]').click({ force: true });
    await page.waitForSelector('#tab-project-epic-level.active', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('#project-epic-level-content', { state: 'visible', timeout: 10000 });

    const content = page.locator('#project-epic-level-content');
    const epicKeyCellsWithAdhoc = content.locator('.epic-key').filter({ hasText: '-ad-hoc' });
    const count = await epicKeyCellsWithAdhoc.count();
    if (count === 0) {
      test.skip();
      return;
    }
    for (let i = 0; i < count; i++) {
      const cell = epicKeyCellsWithAdhoc.nth(i);
      await expect(cell).toContainText('-ad-hoc');
      await expect(cell.locator('a')).toHaveCount(0);
    }
  });
});
