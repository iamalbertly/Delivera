import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { runDefaultPreview } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

async function ensureProjectEpicLevelTab(page) {
  const content = page.locator('#project-epic-level-content');
  const activePanel = page.locator('#tab-project-epic-level.active');
  if (await activePanel.isVisible().catch(() => false)) {
    return await content.isVisible().catch(() => false);
  }

  const tabButton = page.locator('.tab-btn[data-tab="project-epic-level"]');
  await tabButton.waitFor({ state: 'attached', timeout: 10000 });
  await tabButton.evaluate((button) => button.click());
  return await content.isVisible({ timeout: 10000 }).catch(() => false);
}

test.describe('Epic Key linkification & column layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report');
    await expect(page.locator('h1')).toContainText(/Evidence|Delivery|Delivera|General Performance|Performance History/);
  });

  test('Epic keys render as clickable links (open in new tab) in tables', async ({ page }) => {
    test.setTimeout(180000);
    await runDefaultPreview(page);

    // Navigate to Project & Epic Level (Boards + Epics), unless already active.
    const projectEpicReady = await ensureProjectEpicLevelTab(page);
    if (!projectEpicReady) {
      test.skip();
      return;
    }

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
    await ensureProjectEpicLevelTab(page);

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
