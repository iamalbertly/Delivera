import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

const QUARTERLY_EPIC_LINES = [
  'FY27 Q1 - DMS - NBA - Territory Daily Report',
  'FY27 Q1 - DMS - NBA - Smartphone Penetration',
  'FY27 Q1 - DMS - NBA - Recharge Growth Trends',
  'FY27 Q1 - DMS - NBA - CSS Site Performance Visualization',
  'FY27 Q1 - DMS - NBA - FL Productivity & Active FL',
  'FY27 Q1 - DMS - NBA - Navigation Search',
].join('\n');

test.describe('Delivera Outcome Validation Screen And Epic Level Tests', () => {
  test('quarterly lines are interpreted as top-level epics in canvas', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.locator('[data-open-outcome-modal]').first().click();
    await expect(page.locator('#work-draft-drawer')).toBeVisible();
    await page.locator('#wdd-source-textarea').fill(QUARTERLY_EPIC_LINES);
    // Quick preview or server draft should show canvas items
    await expect(page.locator('#wdd-canvas .wdc-item:not(.wdc-add-row)').first()).toBeVisible({ timeout: 5000 });
    // At least one epic chip should be present
    await expect(page.locator('#wdd-canvas .wdc-type-chip[data-type="E"]').first()).toBeVisible();
    await expect(page.locator('#wdd-send-counts')).toContainText(/Ready:/i);
    assertTelemetryClean(telemetry);
  });

  test('follow-up shows verification pass checks after successful create', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.route('**/api/outcome-from-narrative', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          structureMode: 'MULTIPLE_EPICS',
          projectKey: 'MPSA',
          createdCount: 6,
          expectedCreateCount: 6,
          verification: {
            fetchVerified: true,
            missingKeys: [],
            backlogVisibleKeys: ['MPSA-1', 'MPSA-2'],
            backlogTopVerified: true,
            boardName: 'DMS Squad Board',
            hierarchyVerified: true,
            hierarchyMismatches: [],
            issueChecks: [
              { key: 'MPSA-1', projectKey: 'MPSA', issueType: 'Epic' },
              { key: 'MPSA-2', projectKey: 'MPSA', issueType: 'Epic' },
            ],
          },
          summaryHtml: 'Created 6 epics in project MPSA backlog.',
        }),
      });
    });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.locator('[data-open-outcome-modal]').first().click();
    await expect(page.locator('#work-draft-drawer')).toBeVisible();
    await page.locator('#wdd-source-textarea').fill(QUARTERLY_EPIC_LINES);
    await expect(page.locator('#wdd-canvas .wdc-item:not(.wdc-add-row)').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#wdd-create-safe-btn').dispatchEvent('click');
    await expect(page.locator('#wdd-follow-up')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#wdd-follow-up')).toContainText(/checks passed/i);
    await expect(page.locator('#wdd-follow-up')).toContainText(/PASS/);
    assertTelemetryClean(telemetry);
  });

  test('follow-up surfaces hierarchy mismatch from verification', async ({ page }) => {
    await page.route('**/api/outcome-from-narrative', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          structureMode: 'MULTIPLE_EPICS',
          projectKey: 'SD',
          createdCount: 6,
          expectedCreateCount: 6,
          verification: {
            fetchVerified: true,
            missingKeys: [],
            backlogVisibleKeys: ['SD-10'],
            backlogTopVerified: true,
            boardName: 'DMS Squad Board',
            hierarchyVerified: false,
            hierarchyMismatches: [{ key: 'SD-10', expectedLevel: 'epic', actualLevel: 'story', issueType: 'Story' }],
            issueChecks: [{ key: 'SD-10', projectKey: 'SD', issueType: 'Story' }],
          },
          summaryHtml: 'Created with hierarchy mismatch.',
        }),
      });
    });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.locator('[data-open-outcome-modal]').first().click();
    await expect(page.locator('#work-draft-drawer')).toBeVisible();
    await page.locator('#wdd-source-textarea').fill(QUARTERLY_EPIC_LINES);
    await expect(page.locator('#wdd-canvas .wdc-item:not(.wdc-add-row)').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#wdd-create-safe-btn').dispatchEvent('click');
    await expect(page.locator('#wdd-follow-up')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#wdd-follow-up')).toContainText(/FAIL/);
    await expect(page.locator('#wdd-follow-up')).toContainText(/Hierarchy mismatches/i);
  });

  test('follow-up flags backlog rank edge case', async ({ page }) => {
    await page.route('**/api/outcome-from-narrative', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          structureMode: 'MULTIPLE_EPICS',
          projectKey: 'SD',
          createdCount: 6,
          expectedCreateCount: 6,
          verification: {
            fetchVerified: true,
            missingKeys: [],
            backlogVisibleKeys: ['SD-20', 'SD-21'],
            backlogTopVerified: false,
            boardName: 'DMS Squad Board',
            hierarchyVerified: true,
            hierarchyMismatches: [],
            issueChecks: [{ key: 'SD-20', projectKey: 'SD', issueType: 'Epic' }],
          },
          summaryHtml: 'Created but not top-ranked.',
        }),
      });
    });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.locator('[data-open-outcome-modal]').first().click();
    await expect(page.locator('#work-draft-drawer')).toBeVisible();
    await page.locator('#wdd-source-textarea').fill(QUARTERLY_EPIC_LINES);
    await expect(page.locator('#wdd-canvas .wdc-item:not(.wdc-add-row)').first()).toBeVisible({ timeout: 5000 });
    await page.locator('#wdd-create-safe-btn').dispatchEvent('click');
    await expect(page.locator('#wdd-follow-up')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#wdd-follow-up')).toContainText(/Not top-ranked yet/i);
  });

  test('draft precheck message shows in parse status for duplicate-line warning', async ({ page }) => {
    await page.route('**/api/outcome-draft', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          structureMode: 'MULTIPLE_EPICS',
          precheck: { key: 'quarterly_epic_batch', message: 'Quarterly epic batch detected — each line is treated as a top-level epic.' },
          rows: [
            {
              id: 'r0',
              index: 0,
              childItemIndex: 0,
              kind: 'EPIC',
              title: 'FY27 Q1 - DMS - NBA - Territory Daily Report',
              confidence: 0.9,
              isParent: true,
              duplicate: { suggestedAction: 'createNew' },
              warnings: [],
              selected: true,
            },
            {
              id: 'r1',
              index: 1,
              childItemIndex: 1,
              kind: 'EPIC',
              title: 'FY27 Q1 - DMS - NBA - Territory Daily Report',
              confidence: 0.9,
              isParent: false,
              duplicate: { suggestedAction: 'createNew' },
              warnings: [{ code: 'DUPLICATE_LINE_IN_INPUT', message: 'This line duplicates another line in your draft and will be unselected by default.' }],
              selected: false,
            },
          ],
        }),
      });
    });
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.locator('[data-open-outcome-modal]').first().click();
    await expect(page.locator('#work-draft-drawer')).toBeVisible();
    await page.locator('#wdd-source-textarea').fill(QUARTERLY_EPIC_LINES);
    // Wait for auto-draft to fire and canvas to populate
    await expect(page.locator('#wdd-canvas .wdc-item:not(.wdc-add-row)')).toHaveCount(2, { timeout: 4000 });
    await expect(page.locator('#wdd-parse-status')).toContainText(/Quarterly epic batch detected/i);
    await expect(page.locator('#wdd-canvas .wdc-repair-chip')).toBeVisible();
    await expect(page.locator('#wdd-canvas')).toContainText(/duplicates another line/i);
  });
});
