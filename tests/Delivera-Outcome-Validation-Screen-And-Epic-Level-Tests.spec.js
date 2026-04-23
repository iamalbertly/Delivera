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
  test('quarterly lines are interpreted as top-level epics intent', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.locator('[data-open-outcome-modal]').first().click();
    await page.locator('#report-outcome-text').fill(QUARTERLY_EPIC_LINES);
    await expect(page.locator('#report-outcome-parse-summary')).toContainText(/top-level epics/i);
    await expect(page.locator('#report-outcome-intake-create')).toContainText(/top-level epics/i);
    assertTelemetryClean(telemetry);
  });

  test('validation screen shows pass checks for verified create', async ({ page }) => {
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
            backlogVisibleKeys: ['MPSA-1', 'MPSA-2', 'MPSA-3', 'MPSA-4', 'MPSA-5', 'MPSA-6'],
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
    await page.locator('#report-outcome-text').fill(QUARTERLY_EPIC_LINES);
    await page.locator('#report-outcome-intake-create').click();
    await expect(page.locator('#report-outcome-validation-screen')).toBeVisible();
    await expect(page.locator('#report-outcome-validation-screen')).toContainText(/6\/6 checks passed/i);
    await expect(page.locator('#report-outcome-validation-screen')).toContainText(/PASS/);
    assertTelemetryClean(telemetry);
  });

  test('validation screen surfaces hierarchy mismatch edge case', async ({ page }) => {
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
    await page.locator('#report-outcome-text').fill(QUARTERLY_EPIC_LINES);
    await page.locator('#report-outcome-intake-create').click();
    await expect(page.locator('#report-outcome-validation-screen')).toContainText(/FAIL/);
    await expect(page.locator('#report-outcome-validation-screen')).toContainText(/Hierarchy mismatches/i);
  });

  test('validation screen flags backlog rank edge case', async ({ page }) => {
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
    await page.locator('#report-outcome-text').fill(QUARTERLY_EPIC_LINES);
    await page.locator('#report-outcome-intake-create').click();
    await expect(page.locator('#report-outcome-validation-screen')).toContainText(/Not top-ranked yet/i);
  });

  test('draft API duplicate-line warning edge case is rendered', async ({ page }) => {
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
              confidenceLabel: 'high confidence',
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
              confidenceLabel: 'high confidence',
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
    await page.locator('#report-outcome-text').fill(QUARTERLY_EPIC_LINES);
    await page.locator('#report-outcome-generate-draft').click();
    await expect(page.locator('#report-outcome-draft-precheck')).toContainText(/Quarterly epic batch detected/i);
    await expect(page.locator('#report-outcome-draft-tbody')).toContainText(/duplicates another line/i);
  });
});

