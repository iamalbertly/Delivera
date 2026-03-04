import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { runDefaultPreview } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Jira Reporting App - Column Titles & Tooltips', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report');
    await expect(page.locator('h1')).toContainText(/VodaAgileBoard|General Performance/);
  });

  test('boards table column titles expose helpful tooltips', async ({ page }) => {
    test.setTimeout(300000);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip();
    }

    await page.click('.tab-btn[data-tab="project-epic-level"]');
    const table = page.locator('#project-epic-level-content table');
    const tableVisible = await table.isVisible().catch(() => false);
    if (!tableVisible) {
      test.skip();
    }

    const headers = table.locator('thead th');

    async function expectHeaderWithTooltip(label, snippet) {
      const header = headers.filter({ hasText: label });
      const count = await header.count();
      expect(count).toBeGreaterThan(0);
      const titleAttr = await header.first().getAttribute('title');
      expect(titleAttr).toBeTruthy();
      if (snippet) {
        expect((titleAttr || '').toLowerCase()).toContain(snippet.toLowerCase());
      }
    }

    await expectHeaderWithTooltip('Board', 'Board name in Jira');
    await expectHeaderWithTooltip('Done Stories', 'Stories completed');
    await expectHeaderWithTooltip('SP / Day', 'SP per day');
    await expectHeaderWithTooltip('On-Time %', 'Stories done by sprint end');
    await expectHeaderWithTooltip('Delivery Grade');

    const advancedToggle = page.locator('#boards-columns-toggle');
    if (await advancedToggle.isVisible().catch(() => false)) {
      await advancedToggle.click();
      await expectHeaderWithTooltip('Ad-hoc', 'without epic links');
    }
  });

  test('sprints table column titles expose helpful tooltips', async ({ page }) => {
    test.setTimeout(300000);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip();
    }

    await page.click('.tab-btn[data-tab="sprints"]');
    const table = page.locator('#sprints-content table');
    const tableVisible = await table.isVisible().catch(() => false);
    if (!tableVisible) {
      test.skip();
    }

    const headers = table.locator('thead th');

    async function expectHeaderWithTooltip(label, snippet) {
      const header = headers.filter({ hasText: label });
      const count = await header.count();
      expect(count).toBeGreaterThan(0);
      const titleAttr = await header.first().getAttribute('title');
      expect(titleAttr).toBeTruthy();
      if (snippet) {
        expect(titleAttr).toContain(snippet);
      }
    }

    await expectHeaderWithTooltip('Project', 'Projects included for this sprint');
    await expectHeaderWithTooltip('Sprint', 'Sprint name');
    await expectHeaderWithTooltip('Start', 'Sprint start date');
    await expectHeaderWithTooltip('End', 'Sprint end date');
    await expectHeaderWithTooltip('Done Stories', 'Stories marked Done in this sprint');
    await expectHeaderWithTooltip('Done SP', 'Story points completed in this sprint');
  });

  test('done stories table column titles expose helpful tooltips', async ({ page }) => {
    test.setTimeout(300000);
    await runDefaultPreview(page);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip();
    }

    await page.click('.tab-btn[data-tab="done-stories"]');
    const table = page.locator('#done-stories-content table');
    const tableVisible = await table.isVisible().catch(() => false);
    if (!tableVisible) {
      test.skip();
    }

    const headers = table.locator('thead th');

    async function expectHeaderWithTooltip(label, snippet) {
      const header = headers.filter({ hasText: label });
      const count = await header.count();
      expect(count).toBeGreaterThan(0);
      const titleAttr = await header.first().getAttribute('title');
      expect(titleAttr).toBeTruthy();
      if (snippet) {
        expect(titleAttr).toContain(snippet);
      }
    }

    await expectHeaderWithTooltip('Key', 'Jira issue key');
    await expectHeaderWithTooltip('Summary', 'Issue summary from Jira');
    await expectHeaderWithTooltip('Status', 'Current Jira status');
    await expectHeaderWithTooltip('Type', 'Issue type');

    const spHeaderCount = await headers.filter({ hasText: 'SP' }).count();
    if (spHeaderCount > 0) {
      const spHeader = headers.filter({ hasText: 'SP' }).first();
      const titleAttr = await spHeader.getAttribute('title');
      expect(titleAttr).toBeTruthy();
      expect(titleAttr).toContain('Story Points');
    }

    const epicHeaderCount = await headers.filter({ hasText: 'Epic Title' }).count();
    if (epicHeaderCount > 0) {
      const epicTitleHeader = headers.filter({ hasText: 'Epic Title' }).first();
      const epicSummaryHeader = headers.filter({ hasText: 'Epic Summary' }).first();
      const epicTitleTooltip = await epicTitleHeader.getAttribute('title');
      const epicSummaryTooltip = await epicSummaryHeader.getAttribute('title');

      expect(epicTitleTooltip).toBeTruthy();
      expect(epicTitleTooltip).toContain('Epic title');
      expect(epicSummaryTooltip).toBeTruthy();
      expect(epicSummaryTooltip).toContain('Epic summary');
    }
  });
});
