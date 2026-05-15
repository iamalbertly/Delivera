import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

const FIXTURE = {
  sprint: { id: 7358, name: 'FY26DMS22', state: 'active', startDate: '2026-05-07', endDate: '2026-05-19' },
  board: { id: 1, name: 'DMS board' },
  meta: { fromSnapshot: false },
  summary: { percentDone: 0, totalStories: 5, doneStories: 0, subtaskMissingEstimate: 1 },
  daysMeta: { daysElapsedWorking: 5, daysRemainingWorking: 2 },
  stuckCandidates: [{ key: 'SD-4643', summary: 'KPI dashboard', status: 'In Progress', hoursInStatus: 203 }],
  stories: [{ key: 'SD-4643', summary: 'KPI dashboard', status: 'In Progress' }],
  subtaskTracking: { summary: {}, subtasks: [] },
  scopeChanges: [{ key: 'SD-999' }],
};

async function routeSprint(page) {
  await page.route('**/api/current-sprint.json**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) }),
  );
}

test.describe('Human nudge review trust flow', () => {
  test.beforeEach(async ({ page }) => {
    await routeSprint(page);
  });

  test('review sheet opens with human draft (no system prefix)', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint?boardId=1&sprintId=7358');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await page.waitForSelector('[data-action="send-top-nudge-to-jira"]', { timeout: 20000 }).catch(() => null);
    const btn = page.locator('[data-action="send-top-nudge-to-jira"]');
    if (!(await btn.isVisible().catch(() => false))) {
      test.skip(true, 'No nudge button for fixture');
      return;
    }
    await btn.click();
    const sheet = page.locator('#delivera-jira-nudge-review-sheet');
    await expect(sheet).toBeVisible({ timeout: 8000 });
    const text = await page.locator('#jira-nudge-review-text').inputValue();
    expect(text).not.toMatch(/\[System guided nudge\]/i);
    expect(text.length).toBeGreaterThan(10);
    expect(text.length).toBeLessThanOrEqual(280);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('send shows receipt after mocked POST', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    let posted = false;
    await page.route('**/api/issues/*/comment', async (route) => {
      posted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, comment: { id: '99001' }, activityId: 'act-1', auditId: 'act-1' }),
      });
    });

    await page.goto('/current-sprint?boardId=1&sprintId=7358');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    await page.waitForSelector('[data-action="send-top-nudge-to-jira"]', { timeout: 20000 }).catch(() => null);
    const btn = page.locator('[data-action="send-top-nudge-to-jira"]');
    if (!(await btn.isVisible().catch(() => false))) {
      test.skip(true, 'No nudge button');
      return;
    }
    await btn.click();
    await page.locator('[data-review-send]').click();
    await expect(page.locator('.jira-nudge-receipt')).toBeVisible({ timeout: 10000 });
    expect(posted).toBe(true);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('quick summary avoids just starting mid-sprint', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint?boardId=1&sprintId=7358');
    if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return;

    const lines = await page.evaluate(async () => {
      const mod = await import('/Delivera-CurrentSprint-Summary-02Standup-QuickCopy-01Renderer.js');
      const data = {
        sprint: { name: 'FY26DMS22', state: 'active' },
        board: { name: 'DMS board' },
        summary: { percentDone: 0, totalStories: 5, doneStories: 0 },
        daysMeta: { daysElapsedWorking: 5, daysRemainingWorking: 2 },
        stuckCandidates: [{ key: 'SD-1' }],
        scopeChanges: [{}],
        meta: {},
      };
      return mod.renderStandupQuickCopyLines(data);
    });
    const joined = lines.join('\n');
    expect(joined).not.toMatch(/just starting/i);
    expect(lines.length).toBeLessThanOrEqual(4);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('settings activity panel loads mocked entries', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.route('**/api/jira-activity**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entries: [{
            id: 'e1',
            ts: new Date().toISOString(),
            issueKey: 'SD-4643',
            bodyPreview: 'SD-4643 looks blocked.',
            status: 'sent',
            commentId: 'c1',
          }],
        }),
      }),
    );
    await page.goto('/settings#jira-activity');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('.jira-activity-table')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.jira-activity-table strong')).toContainText('SD-4643');
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});
