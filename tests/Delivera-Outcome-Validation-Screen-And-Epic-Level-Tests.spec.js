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
});

