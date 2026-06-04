import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  runDefaultPreview,
  skipIfRedirectedToLogin,
  waitForPreview,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Outcome-First Direct Value IA Validation', () => {
  test('report first viewport uses current terminology and direct-value controls', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await runDefaultPreview(page);
    if (await skipIfRedirectedToLogin(page, test)) return;
    await waitForPreview(page, { timeout: 90000 });

    const bodyText = await page.locator('body').textContent();
    expect(bodyText || '').not.toMatch(/SMs & Leads|SP limited|Epic limited/i);
    await expect(page.locator('#report-tab-search')).toHaveAttribute('placeholder', /Search current view/i);
    await expect(page.locator('#report-header-preview-btn')).toContainText(/Refresh/i);
    await expect(page.locator('#report-header-export-btn')).toContainText(/Export/i);
    await expect(page.locator('#report-header-actions [data-open-outcome-modal]')).toContainText(/Create work/i);
    await expect(page.locator('#tab-btn-unusable-sprints')).toBeAttached();
    // Section headings only appear when Jira boards are available — skip in CI when boards are unavailable
    const epicText = (await page.locator('#project-epic-level-content').textContent().catch(() => '') || '').trim();
    if (epicText && !epicText.includes('No boards') && !epicText.includes('No metrics')) {
      await expect(page.locator('#project-epic-level-content')).toContainText(/What changed/i);
      await expect(page.locator('#project-epic-level-content')).toContainText(/What needs attention/i);
      await expect(page.locator('#project-epic-level-content')).toContainText(/What to create next/i);
    }
    assertTelemetryClean(telemetry);
  });

  test('outcome drawer infers STORY_WITH_SUBTASKS from S parent + T children and sends correct payload', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    let lastPayload = null;

    await page.route('**/api/outcome-draft', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          rows: [
            { title: 'Customer feedback improvements', type: 'Story', isParent: true, depth: 0, confidence: 0.85, warnings: [] },
            { title: 'Add customer number to feedback', type: 'Task', depth: 1, confidence: 0.85, warnings: [] },
            { title: 'Filter feedback by category', type: 'Task', depth: 1, confidence: 0.85, warnings: [] },
          ],
        }),
      });
    });

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
    await expect(page.locator('#work-draft-drawer')).toBeVisible();
    await page.locator('#wdd-source-textarea').fill([
      'Customer feedback improvements',
      'Add customer number to feedback',
      'Filter feedback by category',
    ].join('\n'));

    // Auto-draft fires after 800ms debounce — wait for canvas with 3 items
    await expect(page.locator('#wdd-canvas .wdc-item:not(.wdc-add-row)')).toHaveCount(3, { timeout: 4000 });

    // Verify canvas shows S parent + T children as expected from mocked draft
    await expect(page.locator('#wdd-canvas .wdc-type-chip[data-type="S"]').first()).toBeVisible();
    await expect(page.locator('#wdd-canvas .wdc-type-chip[data-type="T"]').first()).toBeVisible();

    // All 3 items should be safe (no warnings) — create button should be enabled
    await expect(page.locator('#wdd-create-safe-btn')).not.toBeDisabled();
    await page.locator('#wdd-create-safe-btn').dispatchEvent('click');

    expect(lastPayload).toBeTruthy();
    expect(lastPayload.structureMode).toBe('STORY_WITH_SUBTASKS');
    expect(lastPayload.childIssueTypeName).toBe('Sub-task');
    assertTelemetryClean(telemetry);
  });
});
