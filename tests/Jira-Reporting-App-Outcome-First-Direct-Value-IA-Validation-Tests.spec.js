import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  runDefaultPreview,
  skipIfRedirectedToLogin,
  waitForPreview,
} from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Outcome-First Direct Value IA Validation', () => {
  test('report first viewport uses current terminology and direct-value controls', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    if (await skipIfRedirectedToLogin(page, test)) return;
    await waitForPreview(page, { timeout: 90000 });

    const bodyText = await page.locator('body').textContent();
    expect(bodyText || '').not.toMatch(/Leadership HUD|SMs & Leads|SP limited|Epic limited/i);
    await expect(page.locator('#report-tab-search')).toHaveAttribute('placeholder', /Search current view/i);
    await expect(page.locator('#report-header-preview-btn')).toContainText(/Refresh/i);
    await expect(page.locator('#report-header-export-btn')).toContainText(/Export/i);
    await expect(page.locator('#report-header-actions [data-open-outcome-modal]')).toContainText(/Create work/i);
    await expect(page.locator('#tab-btn-unusable-sprints .tab-btn-label')).toContainText(/Repair center/i);
    await expect(page.locator('#project-epic-level-content')).toContainText(/What changed/i);
    await expect(page.locator('#project-epic-level-content')).toContainText(/What needs attention/i);
    await expect(page.locator('#project-epic-level-content')).toContainText(/What to create next/i);
    assertTelemetryClean(telemetry);
  });

  test('outcome intake supports low-friction structure override and make-parent', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    let lastPayload = null;
    await page.route('**/api/outcome-from-narrative', async (route) => {
      lastPayload = route.request().postDataJSON?.() || null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, key: 'SD-7000', url: 'https://jira.example.com/browse/SD-7000' }),
      });
    });

    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.locator('[data-open-outcome-modal]').first().click();
    await page.locator('#report-outcome-text').fill([
      'Customer feedback improvements',
      'Add customer number to feedback',
      'Filter feedback by category',
    ].join('\n'));

    await expect(page.locator('#report-outcome-overrides')).toBeVisible();
    await expect(page.locator('[data-outcome-structure="AUTO"]')).toBeVisible();
    await expect(page.locator('[data-outcome-structure="SINGLE"]')).toBeVisible();
    await expect(page.locator('[data-outcome-structure="PARENT_CHILD"]')).toBeVisible();
    await expect(page.locator('[data-outcome-structure="MULTIPLE"]')).toBeVisible();

    await page.locator('[data-outcome-make-parent="1"]').click();
    await expect(page.locator('#report-outcome-parse-summary')).toContainText(/Add customer number to feedback/i);
    await page.locator('#report-outcome-child-type').selectOption('Sub-task');
    await page.locator('#report-outcome-intake-create').click();

    expect(lastPayload).toBeTruthy();
    expect(lastPayload.structureMode).toBe('STORY_WITH_SUBTASKS');
    expect(lastPayload.childIssueTypeName).toBe('Sub-task');
    assertTelemetryClean(telemetry);
  });
});
