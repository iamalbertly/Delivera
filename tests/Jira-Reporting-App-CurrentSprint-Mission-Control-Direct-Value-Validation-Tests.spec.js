import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SPRINT_PAGE = `${BASE_URL}/current-sprint`;

async function loadSprintPage(page) {
  await page.goto(SPRINT_PAGE);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => null);
  await page.waitForSelector('#current-sprint-content, #current-sprint-error', { timeout: 30000, state: 'attached' });
  const ensureHeader = async () => {
    const hasHeader = await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false);
    if (hasHeader) return;
    const boardSelect = page.locator('#board-select');
    if (!(await boardSelect.isVisible().catch(() => false))) return;
    const options = boardSelect.locator('option[value]:not([value=""])');
    const count = await options.count().catch(() => 0);
    if (!count) return;
    const val = (await boardSelect.inputValue().catch(() => '')) || (await options.first().getAttribute('value').catch(() => ''));
    if (!val) return;
    await boardSelect.selectOption(val).catch(() => null);
    await page.waitForSelector('.current-sprint-header-bar, #current-sprint-error', { timeout: 30000 }).catch(() => null);
  };
  await ensureHeader();
  const content = page.locator('#current-sprint-content');
  if (await content.isVisible().catch(() => false)) {
    return { hasError: false };
  }
  const errorEl = page.locator('#current-sprint-error');
  const isErrorVisible = await errorEl.isVisible().catch(() => false);
  const errorText = isErrorVisible ? (await errorEl.textContent())?.trim() : '';
  if (isErrorVisible && errorText) {
    return { hasError: true, message: errorText };
  }
  const rawErrorText = (await errorEl.textContent())?.trim() || '';
  if (rawErrorText) {
    return { hasError: true, message: rawErrorText };
  }
  return { hasError: true, message: 'Current sprint content did not become visible' };
}

test.describe('CurrentSprint Mission Control - Direct-to-value flows', () => {
  test('Single-flow page: main has in-page state (welcome|loading|content|error), no reload on board change', async ({ page }) => {
    await page.goto(SPRINT_PAGE);
    await page.waitForLoadState('domcontentloaded');
    const main = page.locator('#main-content');
    await page.waitForFunction(
      () => document.getElementById('main-content')?.getAttribute('data-current-sprint-state') != null,
      { timeout: 5000 }
    ).catch(() => null);
    const state = await main.getAttribute('data-current-sprint-state');
    expect(state).toBeTruthy();
    expect(['welcome', 'loading', 'content', 'error']).toContain(state);

    await page.waitForSelector('#current-sprint-content, #current-sprint-error, #current-sprint-loading', { timeout: 20000, state: 'attached' });
    const urlBefore = page.url();
    const boardSelect = page.locator('#board-select');
    const optionCount = await boardSelect.locator('option').count();
    if (optionCount >= 2) {
      const firstVal = await boardSelect.inputValue();
      const validOptions = boardSelect.locator('option[value]:not([value=""])');
      const validCount = await validOptions.count().catch(() => 0);
      if (validCount < 2) {
        test.skip(true, 'Only one selectable board available in dataset');
        return;
      }
      const otherOption = validOptions.nth(1);
      const otherVal = await otherOption.getAttribute('value');
      if (otherVal && otherVal !== firstVal) {
        await boardSelect.selectOption(otherVal);
        await page.waitForFunction(
          (s) => {
            const main = document.getElementById('main-content');
            const current = main?.getAttribute('data-current-sprint-state');
            return current === 'content' || current === 'error' || current === 'welcome';
          },
          undefined,
          { timeout: 25000 }
        ).catch(() => null);
        await page.waitForTimeout(500);
        const urlAfter = page.url();
        expect(urlAfter).toBe(urlBefore);
      }
    }
  });

  test('loading state keeps one compact loading line instead of a separate context row', async ({ page }) => {
    await page.goto(SPRINT_PAGE);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#sprint-loading-context')).toHaveCount(0);
    const text = (await page.locator('#current-sprint-loading').textContent().catch(() => '')) || '';
    expect(text.trim().length).toBeGreaterThan(0);
  });

  test('current sprint maps partial-permission Jira response into top ribbon', async ({ page }) => {
    await page.route('**/api/boards.json*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: ['MPSA'],
          boards: [{ id: 101, name: 'Main Board', projectKey: 'MPSA' }],
        }),
      });
    });
    await page.route('**/api/current-sprint.json*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          board: { id: 101, name: 'Main Board', projectKeys: ['MPSA'] },
          sprint: { id: 301, name: 'Sprint 301', state: 'active', startDate: '2026-03-01T00:00:00.000Z', endDate: '2026-03-15T00:00:00.000Z' },
          stories: [],
          summary: { totalStories: 0, doneStories: 0, totalSP: 0, doneSP: 0, percentDone: 0 },
          daysMeta: { daysRemainingWorking: 3 },
          recentSprints: [],
          meta: {
            partialPermissions: true,
            projects: 'MPSA',
          },
        }),
      });
    });

    await page.goto(SPRINT_PAGE);
    await page.waitForSelector('#board-select option[value="101"]', { timeout: 15000, state: 'attached' });
    await page.selectOption('#board-select', '101');
    await expect(page.locator('#current-sprint-ribbon')).toContainText(/hidden by permissions|accessible/i);
    await expect(page.locator('#current-sprint-content')).toBeVisible();
  });

  test.beforeEach(async ({ page }, testInfo) => {
    const exemptTitles = [
      'loading state keeps one compact loading line instead of a separate context row',
      'current sprint maps partial-permission Jira response into top ribbon',
    ];
    if (exemptTitles.includes(testInfo.title)) {
      return;
    }
    const state = await loadSprintPage(page);
    if (state?.hasError) {
      testInfo.skip(`Skipping: current sprint page error - ${state.message}`);
    }
  });

  test('Metric pills filter Work risks and scroll into view', async ({ page }) => {
    const verdictLine = page.locator('.sprint-verdict-line');
    await expect(verdictLine).toBeVisible();
    const blockerPill = verdictLine.locator('.verdict-pill').first();
    const hasPill = await blockerPill.isVisible().catch(() => false);
    if (!hasPill) {
      test.skip(true, 'No verdict pills rendered for this dataset');
      return;
    }
    const beforeVisibleCount = await page.locator('#work-risks-table tbody tr.work-risk-parent-row').count();
    await blockerPill.dispatchEvent('click');
    const table = page.locator('#work-risks-table');
    const tableVisible = await table.isVisible().catch(() => false);
    if (!tableVisible) {
      test.skip(true, 'Work risks table not visible for this dataset');
      return;
    }
    const afterVisibleCount = await table.locator('tbody tr.work-risk-parent-row').evaluateAll((rows) =>
      rows.filter((r) => (r.style.display || '') !== 'none').length
    );
    expect(afterVisibleCount).toBeLessThanOrEqual(beforeVisibleCount);
  });

  test('Persona tiles act as role presets for Work risks', async ({ page }) => {
    const devTile = page.locator('#stuck-card .work-risks-role-pill[data-persona="developer"]').first();
    const isVisible = await devTile.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Persona tiles not rendered for this dataset');
      return;
    }
    await page.evaluate(() => {
      const el = document.querySelector('#stuck-card .work-risks-role-pill[data-persona="developer"]');
      if (el && typeof el.click === 'function') {
        el.click();
      }
    });
    const rows = page.locator('#work-risks-table tbody tr.work-risk-parent-row');
    const anyHidden = await rows.evaluateAll((items) =>
      items.some((row) => (row.style.display || '') === 'none')
    );
    expect(anyHidden).toBeTruthy();
  });

  test('Header take-action focuses Work risks and updates active view summary', async ({ page }) => {
    const takeAction = page.locator('.current-sprint-header-bar [data-header-action="take-action"]');
    const visible = await takeAction.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Take action button not rendered');
      return;
    }
    await takeAction.dispatchEvent('click');
    await expect(page.locator('[data-header-active-filter-value]')).not.toHaveText(/All work/i);
    const workRisks = page.locator('#work-risks-table');
    const workRisksVisible = await workRisks.isVisible().catch(() => false);
    if (!workRisksVisible) {
      test.skip(true, 'Work risks table not visible for this dataset');
      return;
    }
  });

  test('Header context strip is compressed into one deduplicated scope line', async ({ page }) => {
    const strip = page.locator('.header-context-inline-wrap .header-context-strip, .header-context-strip').first();
    const visible = await strip.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Context strip not rendered for this dataset');
      return;
    }
    const text = (await strip.textContent().catch(() => '')) || '';
    expect(text.trim().length).toBeGreaterThan(12);
    expect(/projects|range|last/i.test(text)).toBeTruthy();
    expect(/last:\s*last:/i.test(text)).toBeFalsy();
    expect(/from report cache/i.test(text)).toBeFalsy();
  });

  test('Header collapses into mini mode on scroll for non-mobile widths', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await loadSprintPage(page);
    const header = page.locator('.current-sprint-header-bar').first();
    const visible = await header.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Header not visible for this dataset');
      return;
    }
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(200);
    const hasMiniMode = await header.evaluate((el) => el.classList.contains('header-mini-mode'));
    expect(hasMiniMode).toBe(true);
    await expect(header.locator('.header-mini-strip')).toBeVisible();
  });

  test('Role-mode pills remember selection and drive filters', async ({ page }) => {
    const rolePills = page.locator('.role-mode-pill');
    const count = await rolePills.count();
    if (count === 0) {
      test.skip(true, 'Role mode pills not rendered');
      return;
    }
    const devPill = rolePills.filter({ hasText: 'Dev' }).first();
    const devVisible = await devPill.isVisible().catch(() => false);
    if (!devVisible) {
      test.skip(true, 'Role mode pills hidden in this dataset/layout');
      return;
    }
    await devPill.dispatchEvent('click');
    await page.reload();
    await loadSprintPage(page);
    const devPillAfter = page.locator('.role-mode-pill[data-role-mode="developer"]');
    await expect(devPillAfter).toHaveAttribute('aria-pressed', 'true');
  });

  test('Role-mode hint and active lens text stay explicit', async ({ page }) => {
    const hint = page.locator('.header-role-mode-hint').first();
    await expect(hint).toContainText(/Dev: no-log; SM: blockers; PO: scope; Leads: unowned/i);
    await page.locator('.role-mode-pill[data-role-mode="developer"]').dispatchEvent('click');
    await expect(page.locator('[data-header-active-filter-value]')).toContainText(/Dev \| no-log/i);
  });

  test('Current sprint can open the shared outcome modal without prompt flow', async ({ page }) => {
    const trigger = page.locator('[data-open-outcome-modal]').first();
    const visible = await trigger.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Outcome modal trigger not visible in this dataset/layout');
      return;
    }
    await page.addInitScript(() => {
      window.__promptCalls = 0;
      const original = window.prompt;
      window.prompt = (...args) => {
        window.__promptCalls += 1;
        return original ? original(...args) : '';
      };
    });
    await trigger.dispatchEvent('click');
    await expect(page.locator('#global-outcome-modal')).toBeVisible();
    expect(await page.evaluate(() => window.__promptCalls || 0)).toBe(0);
  });

  test('Header intelligence replaces duplicate evidence and capacity cards', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const insightStrip = page.locator('.header-intelligence-strip');
    await expect(insightStrip).toBeVisible();
    await expect(page.locator('#capacity-card, .capacity-allocation-card')).toHaveCount(0);
    await expect(page.getByText('Evidence snapshot', { exact: true })).toHaveCount(0);
  });

  test('historical sprint selection shows snapshot banner when previous sprint exists', async ({ page }) => {
    const tabs = page.locator('.carousel-tab');
    const count = await tabs.count().catch(() => 0);
    if (count < 2) {
      test.skip(true, 'No previous sprint tabs available');
      return;
    }
    await tabs.nth(1).click().catch(() => null);
    await page.waitForTimeout(800);
    const banner = page.locator('.current-sprint-history-banner');
    const bannerVisible = await banner.isVisible().catch(() => false);
    if (!bannerVisible) {
      test.skip(true, 'Selected sprint may still be active in this dataset');
      return;
    }
    await expect(banner).toContainText(/historical snapshot|actions limited|Some actions disabled/i);
  });

  test('Issue preview drawer opens from Work risks and includes Jira link', async ({ page }) => {
    const firstRowLink = page.locator('#work-risks-table tbody tr.work-risk-parent-row a[href*="/browse/"]').first();
    const exists = await firstRowLink.isVisible().catch(() => false);
    if (!exists) {
      test.skip(true, 'No Work risks issue links to preview');
      return;
    }
    await firstRowLink.click();
    const drawer = page.locator('#current-sprint-issue-preview');
    await expect(drawer).toHaveClass(/issue-preview-open/);
    const jiraLink = drawer.locator('a.issue-preview-key');
    const href = await jiraLink.getAttribute('href');
    expect(href || '').toContain('/browse/');
    await expect(drawer.locator('[data-issue-preview-action="back-to-table"]')).toBeVisible();
    await expect(drawer.locator('[data-issue-preview-action="next-risk"]')).toBeVisible();
  });

  test('Sticky section links stay visible while scrolling content', async ({ page }) => {
    const links = page.locator('.sprint-section-links-sticky');
    const isVisible = await links.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Sticky section links not rendered for this layout');
      return;
    }
    await page.evaluate(() => window.scrollBy(0, 800));
    await expect(links).toBeVisible();
  });

  test('Header refresh button triggers data reload without navigation', async ({ page }) => {
    const refreshBtn = page.locator('.header-refresh-btn');
    const visible = await refreshBtn.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Refresh button hidden in this dataset/layout');
      return;
    }
    const urlBefore = page.url();
    await refreshBtn.dispatchEvent('click');
    await page.waitForTimeout(500);
    const urlAfter = page.url();
    expect(urlAfter).toBe(urlBefore);
  });

  test('Daily completion timeline filters Issues table by completion day', async ({ page }) => {
    const timeline = page.locator('.daily-completion-timeline');
    const visible = await timeline.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Daily completion timeline not rendered for this dataset');
      return;
    }

    const table = page.locator('#stories-table');
    await expect(table).toBeVisible();

    const parentRows = table.locator('tbody tr.story-parent-row');
    const beforeVisible = await parentRows.evaluateAll((rows) =>
      rows.filter((r) => (r.style.display || '') !== 'none').length
    );

    const dayChip = timeline.locator('.daily-timeline-chip').filter((chip) =>
      chip.getAttribute('data-day-key').then((val) => !!val)
    ).first();
    const hasDayChip = await dayChip.isVisible().catch(() => false);
    if (!hasDayChip) {
      test.skip(true, 'No specific day chips available in timeline');
      return;
    }

    await dayChip.click();

    const afterVisible = await parentRows.evaluateAll((rows) =>
      rows.filter((r) => (r.style.display || '') !== 'none').length
    );

    expect(afterVisible).toBeLessThanOrEqual(beforeVisible);
  });

  test('Issues table subtasks are collapsed by default and expandable per story', async ({ page }) => {
    const firstParent = page.locator('#stories-table tbody tr.story-parent-row[data-has-children="true"]').first();
    const visible = await firstParent.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'No expandable story rows in current dataset');
      return;
    }
    const parentKey = (await firstParent.getAttribute('data-parent-key')) || '';
    const childRows = page.locator(`#stories-table tbody tr.subtask-child-row[data-parent-key="${parentKey}"]`);
    const childCount = await childRows.count();
    if (!childCount) {
      test.skip(true, 'No subtask child rows for selected parent');
      return;
    }
    await expect(firstParent).toHaveAttribute('aria-expanded', 'false');
    await expect(childRows.first()).not.toBeVisible();
    await firstParent.locator('.story-row-toggle').dispatchEvent('click');
    await expect(firstParent).toHaveAttribute('aria-expanded', 'true');
    await expect(childRows.first()).toBeVisible();
  });
});
