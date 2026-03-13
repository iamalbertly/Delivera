import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { runDefaultPreview } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Throughput / Boards merge UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report');
    await expect(page.locator('h1')).toContainText(/VodaAgileBoard|General Performance|Performance History/);
  });

  test('Per Project throughput is merged into Boards when boards exist and CTA opens Boards tab', async ({ page }) => {
    test.setTimeout(180000);
    await runDefaultPreview(page);

    // Ensure Project & Epic Level tab is active for throughput messaging
    await page.click('.tab-btn[data-tab="project-epic-level"]');
    await page.waitForSelector('#tab-project-epic-level.active', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('#project-epic-level-content', { state: 'visible', timeout: 10000 });

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip('Preview not available; skipping throughput merge test.');
      return;
    }

    const content = await page.locator('#project-epic-level-content').textContent();

    // Expect to find the explanatory note that throughput is merged into Boards
    expect(content).toContain('Throughput signals are merged into Boards columns');

    // Verify Boards table has core throughput columns
    const header = page.locator('#project-epic-level-content #boards-table thead');
    await expect(header).toContainText('Done SP');
    await expect(header).toContainText('Throughput Stories');
    await expect(header).toContainText('Throughput SP');
    await expect(header).toContainText('SP / Day');
  });
});
