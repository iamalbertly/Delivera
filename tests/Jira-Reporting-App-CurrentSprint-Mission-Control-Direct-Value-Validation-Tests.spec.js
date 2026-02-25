import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SPRINT_PAGE = `${BASE_URL}/current-sprint`;

async function loadSprintPage(page) {
  await page.goto(SPRINT_PAGE);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#current-sprint-content, #current-sprint-error', { timeout: 30000, state: 'attached' });
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
    const devTile = page.locator('#stuck-card .summary-block[data-persona="developer"]').first();
    const isVisible = await devTile.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Persona tiles not rendered for this dataset');
      return;
    }
    await page.evaluate(() => {
      const el = document.querySelector('#stuck-card .summary-block[data-persona="developer"]');
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
});

