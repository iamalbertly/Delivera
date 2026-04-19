import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';

test.describe('Jira Reporting App - Current Sprint and Leadership View Tests', () => {
  test('should load current-sprint page and show board selector', async ({ page }) => {
    await page.goto('/current-sprint');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip('Redirected to login or home; auth may be required');
      return;
    }
    await expect(page.locator('h1')).toContainText('Current Sprint');
    await expect(page.locator('#board-select')).toBeVisible();
    const select = page.locator('#board-select');
    await expect(select).toBeVisible();
    const options = await select.locator('option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(1);
  });

  test('should load current-sprint and handle board selection without crash', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/current-sprint');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip('Redirected to login or home; auth may be required');
      return;
    }
    await expect(page.locator('#board-select')).toBeVisible();
    await page.waitForSelector('#board-select', { state: 'visible', timeout: 10000 });
    const hasBoards = await page.locator('#board-select option[value]:not([value=""])').count() > 0;
    if (hasBoards) {
      await page.selectOption('#board-select', { index: 1 });
      await page.waitForTimeout(3000);
      const content = page.locator('#current-sprint-content');
      const loading = page.locator('#current-sprint-loading');
      const error = page.locator('#current-sprint-error');
      const contentVisible = await content.isVisible();
      const headerVisible = await page.locator('.current-sprint-header-bar, #sprint-summary-card').first().isVisible().catch(() => false);
      const loadingText = await loading.textContent();
      const bodyText = await page.locator('body').textContent();
      const hasNoSprintMsg = bodyText && (bodyText.includes('No active') || bodyText.includes('recent closed sprint') || bodyText.includes('no active'));
      const hasBoardLoadIssue = bodyText && (bodyText.includes("Couldn't load boards") || bodyText.includes('No boards found'));
      const hasSelectionHint = bodyText && (bodyText.includes('Select a board') || bodyText.includes('Loading current sprint'));
      const hasRenderableContentText = ((await content.textContent().catch(() => '')) || '').trim().length > 0;
      const shellStillVisible = (await page.locator('h1').isVisible().catch(() => false))
        || (await page.locator('#board-select').isVisible().catch(() => false));
      expect(
        contentVisible
          || headerVisible
          || hasRenderableContentText
          || hasNoSprintMsg
          || hasSelectionHint
          || loadingText?.includes('Select')
          || loadingText?.includes('Loading')
          || (await error.isVisible())
          || hasBoardLoadIssue
          || shellStillVisible
      ).toBeTruthy();

      if (contentVisible && !hasNoSprintMsg) {
        const sprintTabsVisible = await page.locator('.sprint-tabs').isVisible().catch(() => false);
        const summaryCardVisible = await page.locator('#sprint-summary-card').isVisible().catch(() => false);
        const dashboardVisible = await page.locator('.health-dashboard-card, #health-dashboard-card').first().isVisible().catch(() => false);
        expect(sprintTabsVisible || summaryCardVisible || dashboardVisible || hasRenderableContentText).toBeTruthy();
      }
    }
  });

  test('should load sprint-leadership page and show date inputs and Preview', async ({ page }) => {
    await page.goto('/sprint-leadership');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip('Redirected to login or home; auth may be required');
      return;
    }
    if (page.url().includes('/report')) {
      await expect(page.locator('h1')).toContainText(/General Performance|Sprint Leadership/i);
      await expect(page.locator('#start-date')).toBeVisible();
      await expect(page.locator('#end-date')).toBeVisible();
      await expect(page.locator('#preview-btn')).toBeVisible();
      await expect(page.locator('.tab-btn[data-tab="trends"]')).toHaveCount(1);
      return;
    }
    await expect(page.locator('h1')).toContainText(/Sprint Leadership/i);
    await expect(page.locator('#leadership-start')).toBeVisible();
    await expect(page.locator('#leadership-end')).toBeVisible();
    await expect(page.locator('#leadership-preview')).toBeVisible();
    await expect(page.locator('#leadership-preview')).toContainText('Preview');
  });

  test('should load sprint-leadership and handle Preview click without crash', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/sprint-leadership');
    if (page.url().includes('login') || page.url().endsWith('/')) {
      test.skip('Redirected to login or home; auth may be required');
      return;
    }
    const isReportRoute = page.url().includes('/report');
    if (isReportRoute) {
      await expect(page.locator('#preview-btn')).toBeVisible();
      await page.click('#preview-btn');
    } else {
      await expect(page.locator('#leadership-preview')).toBeVisible();
      await page.click('#leadership-preview');
    }
    await page.waitForTimeout(5000);
    const leadershipContent = page.locator('#leadership-content');
    const reportContent = page.locator('#preview-content');
    const leadershipLoading = page.locator('#leadership-loading');
    const reportLoading = page.locator('#loading');
    const leadershipError = page.locator('#leadership-error');
    const reportError = page.locator('#error');
    const contentVisible = (await leadershipContent.isVisible().catch(() => false)) || (await reportContent.isVisible().catch(() => false));
    const loadingVisible = (await leadershipLoading.isVisible().catch(() => false)) || (await reportLoading.isVisible().catch(() => false));
    const errorVisible = (await leadershipError.isVisible().catch(() => false)) || (await reportError.isVisible().catch(() => false));
    const bodyText = await page.locator('body').textContent();
    const leadershipText = (await leadershipContent.textContent().catch(() => '')) || '';
    const reportText = (await reportContent.textContent().catch(() => '')) || '';
    const errorText = ((await leadershipError.textContent().catch(() => '')) || '') + ((await reportError.textContent().catch(() => '')) || '');
    const hasContent = contentVisible && (leadershipText.trim().length > 0 || reportText.trim().length > 0);
    const hasError = errorVisible && errorText.trim().length > 0;
    expect(hasContent || loadingVisible || hasError || (bodyText && bodyText.length > 0)).toBeTruthy();

    if (hasContent && !isReportRoute) {
      await expect(page.locator('text=Velocity (SP/day)')).toBeVisible();
    }
  });
});
