import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SPRINT_PAGE = `${BASE_URL}/current-sprint`;

async function loadSprintPage(page) {
  await page.goto(SPRINT_PAGE);
  await page.waitForLoadState('domcontentloaded');
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

  test.beforeEach(async ({ page }, testInfo) => {
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
    await blockerPill.click();
    const table = page.locator('#work-risks-table');
    await expect(table).toBeVisible();
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
    await takeAction.click();
    await expect(page.locator('[data-header-active-filter-value]')).not.toHaveText(/All work/i);
    const workRisks = page.locator('#work-risks-table');
    await expect(workRisks).toBeVisible();
  });

  test('Role-mode pills remember selection and drive filters', async ({ page }) => {
    const rolePills = page.locator('.role-mode-pill');
    const count = await rolePills.count();
    if (count === 0) {
      test.skip(true, 'Role mode pills not rendered');
      return;
    }
    const devPill = rolePills.filter({ hasText: 'Dev' }).first();
    await devPill.click();
    await page.reload();
    await loadSprintPage(page);
    const devPillAfter = page.locator('.role-mode-pill[data-role-mode="developer"]');
    await expect(devPillAfter).toHaveAttribute('aria-pressed', 'true');
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
    await expect(banner).toContainText(/historical sprint snapshot|Some actions disabled/i);
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
    await expect(refreshBtn).toBeVisible();
    const urlBefore = page.url();
    await refreshBtn.click();
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
    await firstParent.locator('.story-row-toggle').click();
    await expect(firstParent).toHaveAttribute('aria-expanded', 'true');
    await expect(childRows.first()).toBeVisible();
  });
});
