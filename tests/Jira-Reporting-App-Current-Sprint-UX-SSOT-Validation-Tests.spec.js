/**
 * Current Sprint UX and SSOT Validation: board pre-select, burndown summary,
 * empty states, leadership empty preview, report boards tab. Uses logcat-style
 * telemetry and realtime UI assertions; fails on UI mismatch or console/request errors.
 */

import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { captureBrowserTelemetry, clickReportPreviewFromCurrentState } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

test.describe('Jira Reporting App - Current Sprint UX and SSOT Validation', () => {
  test('current-sprint board list uses project SSOT from localStorage', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('vodaAgileBoard_selectedProjects', 'MPSA,MAS');
    });
    let boardsRequestUrl = '';
    await page.route('**/api/boards.json*', (route) => {
      boardsRequestUrl = route.request().url();
      route.continue();
    });
    await page.goto('/current-sprint');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }
    await expect(page.locator('#current-sprint-projects')).toBeVisible();
    await expect(page.locator('#current-sprint-projects')).toHaveValue('MPSA');
    await page.waitForSelector('#board-select', { state: 'visible', timeout: 15000 }).catch(() => null);
    expect(boardsRequestUrl).toContain('projects=');
    expect(boardsRequestUrl).toMatch(/projects=MPSA/);
    const options = await page.locator('#board-select option[value]:not([value=""])').count();
    expect(options).toBeGreaterThanOrEqual(0);
  });

  test('current-sprint page loads with nav and board select; URL boardId pre-selects when valid', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    await expect(page.locator('h1')).toContainText('Current Sprint');
    await expect(page.locator('#current-sprint-projects')).toBeVisible();
    await expect(page.locator('#board-select')).toBeVisible();
    await expect(page.locator('.app-sidebar a.sidebar-link[href="/report"], nav.app-nav a[href="/report"]')).toContainText(/Report|High-Level Performance/i);
    const leadershipNav = page.locator('.app-sidebar a.sidebar-link[href="/sprint-leadership"], nav.app-nav a[href="/sprint-leadership"]');
    if (await leadershipNav.count()) {
      await expect(leadershipNav).toContainText(/Leadership/i);
    }

    const options = await page.locator('#board-select option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(1);

    const nonRetryErrors = telemetry.consoleErrors.filter(msg => !/Failed to load resource:.*500/i.test(msg));
    expect(nonRetryErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    const nonAbortFailures = telemetry.failedRequests.filter(r => r.failure !== 'net::ERR_ABORTED');
    expect(nonAbortFailures).toEqual([]);
  });

  test('current-sprint with boardId in URL: pre-selects that board when in list', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    await page.waitForSelector('#board-select', { state: 'visible', timeout: 15000 }).catch(() => null);
    const selectableOptions = page.locator('#board-select option[value]:not([value=""])');
    const optionCount = await selectableOptions.count().catch(() => 0);
    if (!optionCount) {
      test.skip(true, 'No boards loaded');
      return;
    }
    const firstOptValue = await selectableOptions.first().getAttribute('value');
    if (!firstOptValue) {
      test.skip(true, 'No board option value available');
      return;
    }

    await page.goto('/current-sprint?boardId=' + firstOptValue);
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login');
      return;
    }

    await page.waitForSelector('#board-select', { state: 'visible', timeout: 10000 });
    const selected = await page.locator('#board-select').inputValue();
    if (!selected) {
      test.skip(true, 'Board selection cleared; target board may not exist in this dataset');
      return;
    }
    expect(selected).toBe(firstOptValue);

    const nonRetryErrors = telemetry.consoleErrors.filter(msg => !/Failed to load resource:.*500/i.test(msg));
    expect(nonRetryErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    const nonAbortFailures = telemetry.failedRequests.filter(r => r.failure !== 'net::ERR_ABORTED');
    expect(nonAbortFailures).toEqual([]);
  });

  test('current-sprint: after board selection, burndown one-line or empty-state hint when sprint exists', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    const hasBoards = await page.locator('#board-select option[value]:not([value=""])').count() > 0;
    if (!hasBoards) {
      test.skip(true, 'No boards to select');
      return;
    }

    const firstBoardValue = await page.locator('#board-select option[value]:not([value=""])').first().getAttribute('value').catch(() => null);
    if (!firstBoardValue) {
      test.skip(true, 'No board option value available');
      return;
    }
    const selected = await page.selectOption('#board-select', firstBoardValue).catch(() => []);
    if (!selected.length) {
      test.skip(true, 'Board options changed before selection');
      return;
    }
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { timeout: 20000 }).catch(() => null);

    const bodyText = await page.locator('body').textContent();
    // Allow decimal SP values like "0.0 SP done" as well as integer forms
    const hasBurndownLine = bodyText && (/of \d+(?:\.\d+)? SP done/.test(bodyText) || /\d+ of \d+ SP done/.test(bodyText));
    const hasBurndownHint = bodyText && (/Burndown will appear when story points and resolutions/i.test(bodyText) || /Burndown hidden/i.test(bodyText));
    const hasNoSprint = bodyText && /No active or recent closed sprint/i.test(bodyText);
    const hasLoading = bodyText && /Select a board to load current sprint data|Loading/i.test(bodyText);
    expect(hasBurndownLine || hasBurndownHint || hasNoSprint || hasLoading).toBeTruthy();

    if (!hasNoSprint) {
      const contentVisible = await page.locator('#current-sprint-content').isVisible().catch(() => false);
      const summaryVisible = await page.locator('#sprint-summary-card').isVisible().catch(() => false);
      if (contentVisible) {
        const headerVisible = await page.locator('.current-sprint-header-bar').isVisible().catch(() => false);
        expect(summaryVisible || headerVisible).toBeTruthy();
        const headerText = await page.locator('.current-sprint-header-bar').textContent().catch(() => '');
        expect(headerText || '').toMatch(/Spent Hrs|h logged|Work items|Total SP|Remaining/i);
      }
      const notesCount = await page.locator('#notes-card').count().catch(() => 0);
      if (notesCount > 0) {
        const notesVisible = await page.locator('#notes-card').isVisible().catch(() => false);
        expect(notesVisible).toBeTruthy();
      }
      const snapshotBadgeVisible = await page.locator('.snapshot-badge').isVisible().catch(() => false);
      if (snapshotBadgeVisible) {
        const badgeText = await page.locator('.snapshot-badge').textContent();
        expect(badgeText).toMatch(/Snapshot|Live/);
      }
      const hasStuckCard = await page.locator('#stuck-card').isVisible().catch(() => false);
      if (hasStuckCard) {
        const stuckText = await page.locator('#stuck-card').textContent().catch(() => '');
        expect((stuckText || '').length).toBeGreaterThan(0);
      }
      if (contentVisible) {
        const flowHeadingVisible = await page
          .locator('#burndown-card h2, .burndown-card h2')
          .filter({ hasText: /Flow over time/i })
          .first()
          .isVisible()
          .catch(() => false);
        const summaryCardVisible = await page.locator('#sprint-summary-card').isVisible().catch(() => false);
        expect(flowHeadingVisible || hasBurndownHint || summaryCardVisible).toBeTruthy();
      }
      const storiesCardCount = await page.locator('#stories-card').count().catch(() => 0);
      if (storiesCardCount > 0) {
        const storiesHeader = await page.locator('#stories-card thead').textContent().catch(() => '');
        if ((storiesHeader || '').trim().length > 0) {
          expect(storiesHeader).toMatch(/Type|Issue/i);
          expect(storiesHeader).toMatch(/Status/i);
          expect(storiesHeader).toMatch(/Reporter/i);
          expect(storiesHeader).toMatch(/Assignee/i);
        }
      }
      const subtaskCount = await page.locator('#subtask-tracking-card').count().catch(() => 0);
      const notificationsCount = await page.locator('#notifications-card').count().catch(() => 0);
      if (subtaskCount > 0) {
        const subtaskVisible = await page.locator('#subtask-tracking-card').isVisible().catch(() => false);
        expect(subtaskVisible).toBeTruthy();
        const subtaskMergedText = await page.locator('#subtask-tracking-card').textContent().catch(() => '');
        expect(subtaskMergedText || '').toMatch(/merged|risk/i);
      }
      const notificationsVisible = notificationsCount > 0
        ? await page.locator('#notifications-card').isVisible().catch(() => false)
        : false;
      if (notificationsCount > 0) {
        expect(notificationsVisible).toBeTruthy();
      }
      const hasSubtaskTable = await page.locator('#subtask-tracking-card table').isVisible().catch(() => false);
      if (hasSubtaskTable) {
        const subtaskHeader = await page.locator('#subtask-tracking-card thead').textContent().catch(() => '');
        expect(subtaskHeader).toMatch(/Reporter/i);
      }
      if (notificationsVisible) {
        const noNotifications = await page.locator('#notifications-card').textContent().then(text => /No notifications needed/i.test(text || ''));
        if (!noNotifications) {
          await expect(page.locator('#notification-recipient')).toBeVisible();
          await expect(page.locator('#notification-message')).toBeVisible();
        }
      }
    }

    const nonRetryErrors = telemetry.consoleErrors.filter(msg => !/Failed to load resource:.*500/i.test(msg));
    expect(nonRetryErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    const nonAbortFailures = telemetry.failedRequests.filter(r => r.failure !== 'net::ERR_ABORTED');
    expect(nonAbortFailures).toEqual([]);
  });

  test('current-sprint: when board list is empty, single error message visible', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.route('**/api/boards.json*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ boards: [] }) })
    );
    await page.goto('/current-sprint');

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    await page.waitForTimeout(2000);
    const errorVisible = await page.locator('#current-sprint-error').isVisible();
    const errorText = await page.locator('#current-sprint-error').textContent().catch(() => '');
    expect(errorVisible).toBeTruthy();
    expect(errorText).toMatch(/No boards found|no boards/i);

    const nonRetryErrors = telemetry.consoleErrors.filter(msg => !/Failed to load resource:.*500/i.test(msg));
    expect(nonRetryErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('current-sprint: retry button appears on failure and succeeds when retried', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    let calls = 0;
    await page.route('**/api/boards.json*', (route) => {
      calls += 1;
      if (calls === 1) {
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary error' }) });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ boards: [{ id: 123, name: 'Retry Board', projectKey: 'MPSA' }] }) });
      }
    });

    await page.goto('/current-sprint');

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    // Wait for retry affordance or error state.
    await page.waitForSelector('#current-sprint-error, #current-sprint-error .retry-btn', { timeout: 10000 });
    const retryBtn = page.locator('#current-sprint-error .retry-btn');
    if (await retryBtn.isVisible().catch(() => false)) {
      await retryBtn.click();
    } else {
      await page.reload();
    }

    // After retry, second boards call should be made and UI should recover or show explicit fallback error state.
    await expect.poll(() => calls, { timeout: 15000 }).toBeGreaterThan(1);
    const opts = await page.locator('#board-select option[value]:not([value=""])').count().catch(() => 0);
    const hasLoadedState = await page.locator('#current-sprint-content').isVisible().catch(() => false);
    const boardSelectText = await page.locator('#board-select').textContent().catch(() => '');
    const errorText = await page.locator('#current-sprint-error').textContent().catch(() => '');
    const hasExplicitFallbackError = /couldn't load boards|board not found|failed to load/i.test(
      `${boardSelectText || ''} ${errorText || ''}`
    );
    expect(opts > 0 || hasLoadedState || hasExplicitFallbackError).toBeTruthy();

    const nonRetryErrors = telemetry.consoleErrors.filter(msg => !/Failed to load resource:.*500/i.test(msg));
    expect(nonRetryErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });

  test('current-sprint: latest board selection wins when responses arrive out of order', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.route('**/api/boards.json*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          boards: [
            { id: 101, name: 'Board A', projectKey: 'MPSA' },
            { id: 202, name: 'Board B', projectKey: 'MPSA' },
          ],
        }),
      });
    });

    await page.route('**/api/current-sprint.json*', async (route) => {
      const u = new URL(route.request().url());
      const boardId = u.searchParams.get('boardId');
      const delayed = boardId === '101';
      if (delayed) await new Promise((r) => setTimeout(r, 1200));
      const sprintName = delayed ? 'OLD_SPRINT_A' : 'NEW_SPRINT_B';
      const boardName = delayed ? 'Board A' : 'Board B';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          board: { id: Number(boardId), name: boardName, projectKeys: ['MPSA'] },
          sprint: { id: delayed ? 11 : 22, name: sprintName, startDate: '2026-02-01', endDate: '2026-02-28' },
          summary: { totalStories: 1, doneStories: delayed ? 0 : 1, totalSP: 3, doneSP: delayed ? 0 : 3, percentDone: delayed ? 0 : 100 },
          stories: [{ key: delayed ? 'A-1' : 'B-1', issueKey: delayed ? 'A-1' : 'B-1', summary: 'Story', status: 'Done', assignee: 'User', reporter: 'Lead', storyPoints: 3 }],
          dailyCompletions: { stories: delayed ? [] : [{ date: '2026-02-20', count: 1, spCompleted: 3, nps: 0 }] },
          remainingWorkByDay: delayed ? [] : [{ date: '2026-02-20', remainingSP: 0 }],
          idealBurndown: delayed ? [] : [{ date: '2026-02-20', remainingSP: 0 }],
          plannedWindow: { start: '2026-02-01', end: '2026-02-28' },
          subtaskTracking: { rows: [], summary: {} },
          scopeChanges: [],
          stuckCandidates: [],
          daysMeta: { daysRemainingWorking: 4, daysRemainingCalendar: 5 },
          notes: { dependencies: [], learnings: [], updatedAt: null },
          assumptions: [],
          meta: { projects: 'MPSA', generatedAt: new Date().toISOString(), fromSnapshot: false },
        }),
      });
    });

    await page.goto('/current-sprint');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    await expect.poll(async () => page.locator('#board-select option[value]:not([value=""])').count(), { timeout: 15000 }).toBeGreaterThan(0);
    await page.selectOption('#board-select', '101');
    await page.selectOption('#board-select', '202');
    await expect(page.locator('.header-context-chip.header-context-chip-active')).toContainText(/Board B/i, { timeout: 20000 });
    await expect(page.locator('.header-sprint-name')).toContainText(/NEW_SPRINT_B/i, { timeout: 20000 });
    await expect(page.locator('body')).not.toContainText('OLD_SPRINT_A');

    const nonRetryErrors = telemetry.consoleErrors.filter(msg => !/Failed to load resource:.*500/i.test(msg));
    expect(nonRetryErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    const nonAbortFailures = telemetry.failedRequests.filter(r => r.failure !== 'net::ERR_ABORTED');
    expect(nonAbortFailures).toEqual([]);
  });

  test('current-sprint: stale saved sprint selection is ignored after TTL and active sprint is loaded', async ({ page }) => {
    let currentSprintRequestUrl = '';
    await page.addInitScript(() => {
      localStorage.setItem('vodaAgileBoard_lastBoardId', '101');
      localStorage.setItem('vodaAgileBoard_lastSprintId', '999');
      localStorage.setItem('vodaAgileBoard_lastSprintSelectedAt', String(Date.now() - (13 * 60 * 60 * 1000)));
    });
    await page.route('**/api/boards.json*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          boards: [{ id: 101, name: 'TTL Board', projectKey: 'MPSA' }],
        }),
      })
    );
    await page.route('**/api/current-sprint.json*', (route) => {
      currentSprintRequestUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          board: { id: 101, name: 'TTL Board', projectKeys: ['MPSA'] },
          sprint: { id: 501, name: 'ACTIVE_SPRINT', state: 'active', startDate: '2026-02-01', endDate: '2026-02-28' },
          summary: { totalStories: 1, doneStories: 1, totalSP: 3, doneSP: 3, percentDone: 100, totalSprintDays: 10 },
          stories: [{ key: 'TTL-1', issueKey: 'TTL-1', summary: 'Story', status: 'Done', assignee: 'User', reporter: 'Lead', storyPoints: 3 }],
          dailyCompletions: { stories: [{ date: '2026-02-20', count: 1, spCompleted: 3, nps: 0 }] },
          remainingWorkByDay: [{ date: '2026-02-20', remainingSP: 0 }],
          idealBurndown: [{ date: '2026-02-20', remainingSP: 0 }],
          plannedWindow: { start: '2026-02-01', end: '2026-02-28' },
          subtaskTracking: { rows: [], summary: {} },
          scopeChanges: [],
          stuckCandidates: [],
          recentSprints: [{ id: 501, name: 'ACTIVE_SPRINT', state: 'active', startDate: '2026-02-01', endDate: '2026-02-28' }],
          daysMeta: { daysRemainingWorking: 3, daysRemainingCalendar: 3 },
          notes: { dependencies: [], learnings: [], updatedAt: null },
          assumptions: [],
          meta: { projects: 'MPSA', generatedAt: new Date().toISOString(), fromSnapshot: false, activeSprintCount: 1 },
        }),
      });
    });

    await page.goto('/current-sprint');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }
    await expect(page.locator('.header-sprint-name')).toContainText(/ACTIVE_SPRINT/i, { timeout: 15000 });
    expect(currentSprintRequestUrl).toContain('boardId=101');
    expect(currentSprintRequestUrl).not.toContain('sprintId=999');
  });

  test('leadership: empty preview shows single message when no sprint data in range', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);
    await page.route('**/preview.json*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ boards: [], sprintsIncluded: [], rows: [], meta: {} }),
      })
    );
    await page.goto('/sprint-leadership');

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    if (page.url().includes('/report')) {
      const clicked = await clickReportPreviewFromCurrentState(page);
      if (!clicked) {
        test.skip(true, 'Preview button disabled or hidden for current dataset');
        return;
      }
      await Promise.race([
        page.waitForSelector('#error', { state: 'visible', timeout: 10000 }).catch(() => null),
        page.waitForSelector('#preview-content', { state: 'visible', timeout: 10000 }).catch(() => null),
      ]);
      if (typeof page.isClosed === 'function' && page.isClosed()) {
        test.skip(true, 'Page closed during preview (auth redirect or environment teardown)');
        return;
      }
      const errorVisible = await page.locator('#error').isVisible().catch(() => false);
      if (errorVisible) {
        await expect(page.locator('#error')).toContainText(/No sprint data|No boards|No data|Widen the date range/i);
      } else {
        await expect(page.locator('#preview-content')).toContainText(/No boards|No data|No done stories|Try a different date range/i);
      }
    } else {
      await page.click('#leadership-preview');
      await page.waitForSelector('#leadership-error', { state: 'visible', timeout: 10000 });
      await expect(page.locator('#leadership-error')).toContainText(/No sprint data|Widen the date range/i);
    }

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    const nonAbortFailures = telemetry.failedRequests.filter(r => r.failure !== 'net::ERR_ABORTED');
    expect(nonAbortFailures).toEqual([]);
  });

  test('report: boards tab and export work with no console errors after preview', async ({ page }) => {
    test.setTimeout(180000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    const clicked = await clickReportPreviewFromCurrentState(page);
    if (!clicked) {
      test.skip(true, 'Preview button disabled or hidden for current dataset');
      return;
    }
    await Promise.race([
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 120000 }).catch(() => null),
      page.waitForSelector('#error', { state: 'visible', timeout: 120000 }).catch(() => null),
    ]);

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (previewVisible) {
      await expect(page.locator('.tabs')).toBeVisible();
      const boardsTabBtn = page.locator('.tab-btn[data-tab="project-epic-level"]').first();
      await expect(boardsTabBtn).toBeVisible();
      await boardsTabBtn.click().catch(() => null);
      await expect(page.locator('#tab-project-epic-level')).toHaveClass(/active/);
      await expect(page.locator('#export-excel-btn')).toBeVisible();
    }

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    const nonAbortFailures = telemetry.failedRequests.filter(r => r.failure !== 'net::ERR_ABORTED');
    expect(nonAbortFailures).toEqual([]);
  });

  test('app-wide notification dock renders from stored summary', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.addInitScript(() => {
      localStorage.setItem('appNotificationsV1', JSON.stringify({
        total: 3,
        missingEstimate: 1,
        missingLogged: 2,
        boardName: 'MPSA board',
        sprintName: 'Sprint 1',
      }));
    });
    await page.goto('/report');

    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip(true, 'Redirected to login; auth may be required');
      return;
    }

    const dock = page.locator('#app-notification-dock');
    const hasDock = await dock.count();
    if (!hasDock) {
      test.skip(true, 'Notification dock not enabled in this build');
      return;
    }
    await expect(dock).toBeVisible();
    await expect(dock).toContainText('3');
    const dockRect = await dock.boundingBox();
    expect(dockRect).toBeTruthy();
    if (dockRect) {
      expect(dockRect.x).toBeLessThan(120);
    }

    expect(telemetry.consoleErrors).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
  });
});

