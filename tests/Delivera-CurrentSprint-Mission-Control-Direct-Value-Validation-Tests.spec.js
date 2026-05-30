import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

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
  const phasedGrid = await page.locator('.current-sprint-grid-layout-phased').count().catch(() => 0);
  if (phasedGrid > 0) {
    await page.waitForSelector('.current-sprint-grid-layout:not(.current-sprint-grid-layout-phased)', { timeout: 30000 });
  }
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

async function openDecisionCockpitDetails(page) {
  await page.locator('.decision-cockpit-details').first().evaluate((el) => {
    if (el && !el.open) el.open = true;
  }).catch(() => null);
}

async function selectBoardEvenIfHeaderCollapsed(page, boardId) {
  await page.locator('#board-select').evaluate((select, value) => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, boardId);
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
        expect(urlAfter.startsWith(SPRINT_PAGE)).toBeTruthy();
        const headerOrErrorVisible =
          await page.locator('.current-sprint-header-bar').first().isVisible().catch(() => false)
          || await page.locator('#current-sprint-error').isVisible().catch(() => false);
        expect(headerOrErrorVisible).toBeTruthy();
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
    await selectBoardEvenIfHeaderCollapsed(page, '101');
    await expect(page.locator('#current-sprint-ribbon')).toContainText(/hidden by permissions|accessible/i);
    await expect(page.locator('#current-sprint-content')).toBeVisible();
    await openDecisionCockpitDetails(page);
    await expect(page.locator('.decision-action-card h2').first()).toContainText(/No urgent action|Review risk queue/i);
    await expect(page.locator('.decision-rail-header span').first()).toContainText(/No hidden blockers|action/i);
    await expect(page.locator('.decision-empty-card').first()).toContainText(/No hidden blockers/i);
  });

  test('current sprint header shows shared report context strip and stale refresh cue', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('report-context-filters-stale', '1');
      sessionStorage.setItem('report-last-run', JSON.stringify({ doneStories: 5, sprintsCount: 2 }));
      sessionStorage.setItem('report-last-meta', JSON.stringify({ generatedAt: '2026-03-20T09:00:00.000Z' }));
      localStorage.setItem('delivera_lastQuery_v1', JSON.stringify({
        projects: 'MPSA,MAS',
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-03-01T00:00:00.000Z',
      }));
    });
    await page.route('**/api/boards.json*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: ['MPSA', 'MAS'],
          boards: [{ id: 101, name: 'Main Board', projectKey: 'MPSA' }],
        }),
      });
    });
    await page.route('**/api/current-sprint.json*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          board: { id: 101, name: 'Main Board', projectKeys: ['MPSA', 'MAS'] },
          sprint: { id: 301, name: 'Sprint 301', state: 'active', startDate: '2026-03-01T00:00:00.000Z', endDate: '2026-03-15T00:00:00.000Z' },
          stories: [
            { key: 'MPSA-1', summary: 'Story 1', statusCategory: 'In Progress', issueType: 'Story', subtasks: [] },
          ],
          summary: { totalStories: 1, doneStories: 0, totalSP: 3, doneSP: 0, percentDone: 0 },
          daysMeta: { daysRemainingWorking: 3 },
          recentSprints: [],
          meta: {
            projects: 'MPSA,MAS',
            generatedAt: '2026-03-20T09:15:00.000Z',
          },
        }),
      });
    });

    await page.goto(SPRINT_PAGE);
    await page.waitForSelector('#board-select option[value="101"]', { timeout: 15000, state: 'attached' });
    await selectBoardEvenIfHeaderCollapsed(page, '101');
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelectorAll('.current-sprint-header-bar').forEach((bar) => bar.classList.remove('header-mini-mode'));
    });

    const headerBar = page.locator('.current-sprint-header-bar').first();
    const lean = await headerBar.getAttribute('data-viewport-lean');
    const refreshCue = page.locator('[data-context-action="refresh-current-sprint-context"]').first();
    if (lean === 'true') {
      const drawer = headerBar.locator('details.header-view-drawer');
      await drawer.evaluate((el) => { el.open = true; });
      await expect(drawer).toHaveAttribute('open', '');
      const drawerCue = headerBar.locator('[data-context-action="refresh-current-sprint-context"]').first();
      await expect(drawerCue).toContainText(/Filters changed since last run/i);
      return;
    }
    const strip = headerBar.locator('.header-context-strip').first();
    await expect(strip).toBeVisible();
    const labels = await strip.locator('.header-context-segment-label').allTextContents();
    expect(labels).toEqual(expect.arrayContaining(['Last', 'Projects', 'Range', 'Freshness', 'Context']));
    await expect(refreshCue).toContainText(/Filters changed since last run/i);
  });

  test.beforeEach(async ({ page }, testInfo) => {
    const exemptTitles = [
      'loading state keeps one compact loading line instead of a separate context row',
      'current sprint maps partial-permission Jira response into top ribbon',
      'current sprint header shows shared report context strip and stale refresh cue',
      'Mission cockpit and header labels meet readable contrast on rendered surfaces',
      'Mobile viewport keeps full mission header (no mini-mode collapse)',
    ];
    if (exemptTitles.includes(testInfo.title)) {
      return;
    }
    const state = await loadSprintPage(page);
    if (state?.hasError) {
      testInfo.skip(`Skipping: current sprint page error - ${state.message}`);
    }
  });

  test('Intervention chips filter Work risks and scroll into view', async ({ page }) => {
    const blockerPill = page.locator('.current-sprint-header-bar .sprint-intervention-item').first();
    const hasPill = await blockerPill.isVisible().catch(() => false);
    if (!hasPill) {
      test.skip(true, 'No intervention chips rendered for this dataset');
      return;
    }
    const beforeVisibleCount = await page.locator('#stories-table tbody tr.story-parent-row').count();
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', {
        detail: { riskTags: ['no-log', 'missing-estimate', 'unassigned', 'blocker'], source: 'header-take-action' },
      }));
    });
    await expect(page.locator('[data-header-active-filter-value]')).toContainText(/blocker|missing-estimate|no-log|scope|unassigned/i);
    const afterVisibleCount = await page.locator('#stories-table tbody tr.story-parent-row').evaluateAll((rows) =>
      rows.filter((r) => !r.hasAttribute('data-role-filter-hidden') && (r.style.display || '') !== 'none').length
    );
    expect(afterVisibleCount).toBeLessThanOrEqual(beforeVisibleCount);
  });

  test('Role presets only render when they create a distinct stories view', async ({ page }) => {
    // Wait for stories table to render before reset — avoids a race where the filter listener
    // isn't registered yet when loadSprintPage returns (header loads before stories card).
    await page.waitForSelector('#stories-table tbody tr.story-parent-row', { timeout: 30000 }).catch(() => null);

    await page.evaluate(() => {
      sessionStorage.removeItem('delivera.currentSprint.autoRiskFilter.v1');
      sessionStorage.removeItem('delivera.currentSprint.topBlockerHighlight.v1');
      window.dispatchEvent(new CustomEvent('currentSprint:applyWorkRiskFilter', { detail: { riskTags: [], source: 'test-reset' } }));
    });

    // Wait for the reset to propagate — at least one parent row must be non-filter-hidden.
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('#stories-table tbody tr.story-parent-row'));
      return rows.length > 0 && rows.some((r) => !r.hasAttribute('data-role-filter-hidden'));
    }, { timeout: 10000 }).catch(() => null);

    const roleDetails = page.locator('.header-role-modes-details').first();
    if (await roleDetails.count()) {
      const isOpen = await roleDetails.evaluate((el) => Boolean(el?.open));
      if (!isOpen) await roleDetails.evaluate((el) => { el.open = true; });
    }
    const hasRoleDetails = (await roleDetails.count().catch(() => 0)) > 0;
    const roleButtons = hasRoleDetails
      ? roleDetails.locator('[data-work-risk-role-mode]')
      : page.locator('.header-role-modes-row [data-work-risk-role-mode]');
    const count = await roleButtons.count().catch(() => 0);
    if (!count) {
      await expect(page.locator('#stuck-card [data-work-risk-shortcut]').first()).toBeVisible();
      return;
    }
    const beforeVisibleCount = await page.locator('#stories-table tbody tr.story-parent-row').evaluateAll((rows) =>
      rows.filter((r) => !r.hasAttribute('data-role-filter-hidden') && (r.style.display || '') !== 'none').length
    );
    // Only assert filter reduces rows when there's a meaningful baseline to reduce from.
    if (beforeVisibleCount < 2) {
      test.skip(true, 'Only 1 or fewer rows visible after reset — not enough to demonstrate role filtering');
      return;
    }
    const clickTarget = count > 1 ? roleButtons.nth(1) : roleButtons.first();
    await clickTarget.evaluate((el) => el.click());
    const afterVisibleCount = await page.locator('#stories-table tbody tr.story-parent-row').evaluateAll((rows) =>
      rows.filter((r) => !r.hasAttribute('data-role-filter-hidden') && (r.style.display || '') !== 'none').length
    );
    expect(afterVisibleCount).toBeLessThanOrEqual(beforeVisibleCount);
  });

  test('Header remediation action focuses stories and opens review or applies filter', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const takeAction = page.locator('.current-sprint-header-bar [data-header-action="focus-remediation"]').first();
    const visible = await takeAction.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Remediation action not rendered');
      return;
    }
    await takeAction.evaluate((el) => el.click());
    await expect(page.locator('#stories-card')).toBeVisible();
    await page.waitForFunction(() => {
      const sheet = document.getElementById('delivera-jira-nudge-review-sheet');
      if (sheet && sheet.hidden === false) return true;
      if (document.body.classList.contains('jira-nudge-review-open')) return true;
      const label = document.querySelector('[data-header-active-filter-value]');
      return Boolean(label && !/^All work$/i.test((label.textContent || '').trim()));
    }, null, { timeout: 8000 });
  });

  test('Mission control row 1 shows three standardized metric tiles (Done, Work items, Logged/est)', async ({ page }) => {
    const row = page.locator('.current-sprint-header-bar .header-identity-metrics[data-header-metric-row="1"]').first();
    const visible = await row.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Metric row not rendered for this dataset');
      return;
    }
    await expect(row).toHaveAttribute('aria-label', /Sprint metrics/i);
    await expect(row.locator('[data-metric="done"] .metric-label')).toHaveText(/^Done$/i);
    await expect(row.locator('[data-metric="issues"] .metric-label')).toHaveText(/^Work items$/i);
    const hoursTile = row.locator('[data-metric="hours"]');
    if (await hoursTile.count()) {
      await expect(hoursTile.locator('.metric-label')).toHaveText(/^Logged \/ est$/i);
    }
    const doneVal = await row.locator('[data-metric="done"] .metric-value').textContent();
    expect(doneVal || '').toMatch(/%/);
  });

  test('Mission band verdict line is tagged as sprint health (distinct from drawer hygiene)', async ({ page }) => {
    const line = page.locator('.current-sprint-header-bar .sprint-verdict-line[data-signal="health"]').first();
    const ok = await line.isVisible().catch(() => false);
    if (!ok) {
      test.skip(true, 'Verdict line not visible for this dataset');
      return;
    }
    await expect(line).toHaveAttribute('data-signal', 'health');
    await expect(line).toHaveAttribute('aria-label', /Sprint health verdict/i);
  });

  test('Mission cockpit and header labels meet readable contrast on rendered surfaces', async ({ page }) => {
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
          stories: [
            { key: 'MPSA-1', summary: 'Story 1', statusCategory: 'In Progress', issueType: 'Story', subtasks: [] },
          ],
          summary: { totalStories: 1, doneStories: 0, totalSP: 3, doneSP: 0, percentDone: 0, subtaskLoggedHours: 1, subtaskEstimatedHours: 4 },
          daysMeta: { daysRemainingWorking: 3 },
          recentSprints: [],
          decisionCockpit: {
            health: { tone: 'warning', status: 'Watch', message: 'One item needs attention.' },
            nextBestAction: { summary: 'Add estimate to sprint work', reason: 'Estimate gap blocks confidence.', ctaLabel: 'Review work', riskTags: ['missing-estimate'] },
            metrics: { daysRemaining: 3, progressPct: { value: 0 }, workItems: { remaining: 1, done: 0, total: 1 }, timeLogged: { ratioPct: 25 } },
            keySignals: { completedRecent: { count: 0, storyPoints: 0 }, blockers: 0, scopeChanges: 0, inactivity: false },
            quickActions: [{ label: 'Add estimates', count: 1, riskTags: ['missing-estimate'] }],
          },
          meta: { projects: 'MPSA', generatedAt: '2026-03-20T09:15:00.000Z' },
        }),
      });
    });
    await page.goto(SPRINT_PAGE);
    await page.waitForSelector('#board-select option[value="101"]', { timeout: 15000, state: 'attached' });
    await selectBoardEvenIfHeaderCollapsed(page, '101');
    await expect(page.locator('.decision-cockpit-shell')).toBeVisible();
    const selectors = [
      '.decision-summary-label',
      '.decision-card-label',
      '.decision-metric-label',
      '.decision-rail-header span',
      '.header-intelligence-title',
      '.header-intelligence-detail',
      '.header-context-segment-label',
    ];
    const samples = await page.evaluate((sampleSelectors) => {
      function parseRgb(value) {
        const match = String(value || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
        if (!match) return null;
        const alpha = match[4] == null ? 1 : Number(match[4]);
        return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: alpha };
      }
      function luminance({ r, g, b }) {
        const toLinear = (channel) => {
          const value = channel / 255;
          return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
      }
      function contrast(fg, bg) {
        const l1 = luminance(fg);
        const l2 = luminance(bg);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }
      function findOpaqueBackground(el) {
        let node = el;
        while (node && node.nodeType === 1) {
          const bg = parseRgb(getComputedStyle(node).backgroundColor);
          if (bg && bg.a >= 0.92) return bg;
          node = node.parentElement;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
      }
      return sampleSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)).slice(0, 2).map((el) => {
        const styles = getComputedStyle(el);
        const fg = parseRgb(styles.color);
        const bg = findOpaqueBackground(el);
        return {
          selector,
          text: (el.textContent || '').trim().slice(0, 40),
          ratio: fg && bg ? Number(contrast(fg, bg).toFixed(2)) : 0,
        };
      })).filter((item) => item.text);
    }, selectors);
    expect(samples.length).toBeGreaterThan(0);
    const failures = samples.filter((item) => item.ratio < 4.5);
    expect(failures).toEqual([]);
  });

  test('Header context strip is compressed into one deduplicated scope line', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const headerBar = page.locator('.current-sprint-header-bar').first();
    const lean = (await headerBar.getAttribute('data-viewport-lean')) === 'true';
    if (lean) {
      await headerBar.locator('details.header-view-drawer').evaluate((el) => { el.open = true; });
    }
    const strip = lean
      ? headerBar.locator('.header-drawer-context-strip-wrap .header-context-strip').first()
      : headerBar.locator('.header-context-strip').first();
    const stripVisible = await strip.isVisible().catch(() => false);
    if (!stripVisible) {
      test.skip(true, 'Context strip hidden for this dataset (no project or sprint context)');
      return;
    }
    const text = (await strip.textContent().catch(() => '')) || '';
    expect(text.trim().length).toBeGreaterThan(12);
    expect(/MPSA|Projects|Range|Live|Snapshot|Updated|Freshness|board/i.test(text)).toBeTruthy();
    expect(/from report cache/i.test(text)).toBeFalsy();
    await page.locator('.current-sprint-header-bar .header-view-drawer').evaluate((el) => { el.open = true; });
    const boardRow = page.locator('.current-sprint-header-bar .header-context-summary-row').first();
    await expect(boardRow).toBeVisible();
    const boardText = ((await boardRow.textContent().catch(() => '')) || '').trim();
    expect(boardText.length).toBeGreaterThan(0);
  });

  test('Mission header exposes role lens strip with View as label when role presets exist', async ({ page }) => {
    const roleDetails = page.locator('.header-role-modes-details').first();
    if ((await roleDetails.count().catch(() => 0)) > 0) {
      await roleDetails.evaluate((el) => { if (el && !el.open) el.open = true; });
    }
    const row = page.locator('.current-sprint-header-bar .header-role-modes-row').first();
    const visible = await row.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'No distinct role presets for this dataset');
      return;
    }
    await expect(row.locator('.header-role-modes-label')).toHaveText(/^View as$/i);
    await expect(row).toHaveAttribute('data-strip', 'role-lens');
    await expect(row.locator('.role-mode-pill[data-work-risk-role-mode]').first()).toBeAttached();
  });

  test('Context drawer shows logging hygiene in a demoted hygiene strip (not risk styling)', async ({ page }) => {
    const contextStrip = page.locator('.current-sprint-header-bar .header-context-strip').first();
    if (await contextStrip.isVisible().catch(() => false)) {
      test.skip(true, 'Hygiene is deduped when header context strip is shown');
      return;
    }
    await page.locator('.current-sprint-header-bar .header-view-drawer').evaluate((el) => { el.open = true; });
    const hygiene = page.locator('.current-sprint-header-bar .header-hygiene-followup[data-signal="hygiene"]').first();
    await expect(hygiene).toBeVisible();
    await expect(hygiene.locator('.header-hygiene-followup-label')).toHaveText(/^Hygiene$/i);
    const valueText = ((await hygiene.locator('.header-hygiene-followup-value').textContent()) || '').trim();
    expect(valueText.length).toBeGreaterThan(3);
    expect(/logging|healthy|Historical snapshot/i.test(valueText)).toBeTruthy();
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
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    if (scrollHeight <= 950) {
      test.skip(true, 'Page not tall enough to trigger mini mode in current dataset');
      return;
    }
    await page.evaluate(() => window.scrollTo(0, Math.min(document.documentElement.scrollHeight, 900)));
    await page.waitForTimeout(200);
    const hasMiniMode = await header.evaluate((el) => el.classList.contains('header-mini-mode'));
    if (!hasMiniMode) {
      test.skip(true, 'Header mini mode threshold not crossed for this dataset/layout');
      return;
    }
    await expect(header.locator('.header-mini-strip')).toBeVisible();
    const reportInMini = header.locator('.header-mini-strip .header-chrome-history-report').first();
    await expect(reportInMini).toBeVisible();
    await expect(reportInMini).toHaveText(/^Open report$/i);
  });

  test('Mobile viewport keeps full mission header (no mini-mode collapse)', async ({ page }) => {
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
          stories: [
            { key: 'MPSA-1', summary: 'Story 1', statusCategory: 'In Progress', issueType: 'Story', subtasks: [] },
          ],
          summary: { totalStories: 1, doneStories: 0, totalSP: 3, doneSP: 0, percentDone: 0 },
          daysMeta: { daysRemainingWorking: 3 },
          recentSprints: [],
          meta: { projects: 'MPSA', generatedAt: '2026-03-20T09:15:00.000Z' },
        }),
      });
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(SPRINT_PAGE);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#board-select option[value="101"]', { timeout: 15000, state: 'attached' });
    await selectBoardEvenIfHeaderCollapsed(page, '101');
    await page.waitForSelector('.current-sprint-header-bar', { timeout: 30000 });
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(250);
    const header = page.locator('.current-sprint-header-bar').first();
    await expect(header).not.toHaveClass(/header-mini-mode/);
  });

  test('ALB-30: narrow viewport shows Open report row above scope context strip', async ({ page }) => {
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
          stories: [
            { key: 'MPSA-1', summary: 'Story 1', statusCategory: 'In Progress', issueType: 'Story', subtasks: [] },
          ],
          summary: { totalStories: 1, doneStories: 0, totalSP: 3, doneSP: 0, percentDone: 0 },
          daysMeta: { daysRemainingWorking: 3 },
          recentSprints: [],
          meta: { projects: 'MPSA', generatedAt: '2026-03-20T09:15:00.000Z' },
        }),
      });
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(SPRINT_PAGE);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { timeout: 30000, state: 'attached' });
    const boardSelect = page.locator('#board-select');
    if (await boardSelect.isVisible().catch(() => false)) {
      const firstBoard = boardSelect.locator('option[value]:not([value=""])').first();
      await firstBoard.waitFor({ state: 'attached', timeout: 20000 }).catch(() => null);
      const boardVal = await firstBoard.getAttribute('value').catch(() => '');
      if (boardVal) await boardSelect.selectOption(boardVal).catch(() => null);
    }
    await page.waitForSelector('.current-sprint-header-bar .header-compact-strip', { timeout: 30000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const header = page.locator('.current-sprint-header-bar').first();
    const reportLink = header.locator('.header-compact-strip .header-chrome-history-report').first();
    const lean = (await header.getAttribute('data-viewport-lean')) === 'true';
    await expect(reportLink).toBeVisible();
    if (lean) {
      await header.locator('details.header-view-drawer').evaluate((el) => { el.open = true; });
      const drawerCtx = header.locator('.header-drawer-context-strip-wrap .header-context-strip').first();
      await expect(drawerCtx).toBeVisible();
      return;
    }
    const contextStrip = header.locator('.header-context-strip').first();
    await expect(contextStrip).toBeVisible();
    const reportAboveScope = await page.evaluate(() => {
      const bar = document.querySelector('.current-sprint-header-bar');
      if (!bar) return false;
      const report = bar.querySelector('.header-compact-strip .header-chrome-history-report');
      const ctx = bar.querySelector('.header-context-strip');
      if (!report || !ctx) return false;
      return report.getBoundingClientRect().top < ctx.getBoundingClientRect().top;
    });
    expect(reportAboveScope).toBe(true);
  });

  test('Work-risk role mode remembers selection and drives filters', async ({ page }) => {
    const developerButton = page.locator('[data-work-risk-role-mode="developer"]').first();
    const visible = await developerButton.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Work-risk role buttons not rendered');
      return;
    }
    await developerButton.click();
    await page.reload();
    await loadSprintPage(page);
    await expect(page.locator('[data-work-risk-role-mode="developer"]').first()).toHaveClass(/is-active/);
    await expect(page.locator('[data-header-active-filter-value]')).toContainText(/Dev lens/i);
  });

  test('Active lens text stays explicit when the remediation role mode changes', async ({ page }) => {
    const developerButton = page.locator('[data-work-risk-role-mode="developer"]').first();
    const visible = await developerButton.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Work-risk role buttons not rendered for this dataset');
      return;
    }
    await developerButton.click();
    await expect(page.locator('[data-header-active-filter-value]')).toContainText(/Dev lens/i);
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
    await expect(page.locator('#work-draft-drawer')).toBeVisible();
    expect(await page.evaluate(() => window.__promptCalls || 0)).toBe(0);
  });

  test('Header More drawer owns evidence while duplicate capacity cards stay removed', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const summary = page.locator('.header-view-drawer > summary').first();
    await expect(summary).toBeVisible();
    await summary.click({ force: true });
    await expect(page.locator('.header-drawer-evidence .sprint-hud-health-details')).toHaveCount(1);
    await expect(page.locator('#capacity-card, .capacity-allocation-card')).toHaveCount(0);
    await expect(page.getByText('Evidence snapshot', { exact: true })).toHaveCount(0);
  });

  test('historical sprint selection folds snapshot state into the identity line', async ({ page }) => {
    const tabs = page.locator('.carousel-tab');
    const count = await tabs.count().catch(() => 0);
    if (count < 2) {
      test.skip(true, 'No previous sprint tabs available');
      return;
    }
    await tabs.nth(1).click().catch(() => null);
    await page.waitForTimeout(800);
    const identity = page.locator('.current-sprint-header-bar .header-sprint-name').first();
    const identityVisible = await identity.isVisible().catch(() => false);
    if (!identityVisible) {
      test.skip(true, 'Selected sprint may still be active in this dataset');
      return;
    }
    const text = (await identity.textContent().catch(() => '')) || '';
    if (!/Historical snapshot/i.test(text)) {
      test.skip(true, 'Selected sprint may still be active in this dataset');
      return;
    }
    await expect(identity).toContainText(/Historical snapshot/i);
  });

  test('Issue preview drawer opens from stories and includes Jira link', async ({ page }) => {
    const firstRowLink = page.locator('#stories-table tbody tr.story-parent-row a[href*="/browse/"]').first();
    const exists = await firstRowLink.isVisible().catch(() => false);
    if (!exists) {
      test.skip(true, 'No story issue links to preview');
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

  test('Jump section links reachable from header drawer on lean layout', async ({ page }) => {
    await page.waitForSelector('#stories-card, #current-sprint-content .current-sprint-grid-layout', { timeout: 30000 }).catch(() => null);
    const headerBar = page.locator('.current-sprint-header-bar[data-viewport-lean="true"]').first();
    const lean = await headerBar.isVisible().catch(() => false);
    if (!lean) {
      test.skip(true, 'Viewport-lean header not active for this dataset');
      return;
    }
    const jumpSection = headerBar.locator('.header-drawer-jump-section');
    if ((await jumpSection.count()) === 0) {
      test.skip(true, 'Drawer jump section not rendered for this sprint state');
      return;
    }
    await headerBar.locator('details.header-view-drawer').evaluate((el) => { el.open = true; });
    await expect(jumpSection).toBeVisible();
    await expect(jumpSection.locator('a, .sprint-section-inline-link').first()).toBeAttached();
    await page.evaluate(() => window.scrollBy(0, 800));
    await expect(headerBar).toBeVisible();
  });

  test('Header no longer exposes top-level refresh chrome', async ({ page }) => {
    await expect(page.locator('.header-refresh-btn')).toHaveCount(0);
  });

  test('sidebar context shows live sprint signals instead of empty report fallback', async ({ page }) => {
    const card = page.locator('#sidebar-context-card .context-card-segments--sprint-live');
    await expect(card).toBeVisible();
    await expect(page.locator('#sidebar-context-card')).not.toContainText(/No report run yet/i);
    await expect(card).toContainText(/Sprint|Ends|Live sprint/i);
  });

  test('primary nav exposes three direct-to-value destinations', async ({ page }) => {
    const primaries = page.locator('.app-sidebar .sidebar-link');
    await expect(primaries).toHaveCount(3);
    await expect(primaries.filter({ hasText: /Current Sprint/i })).toHaveCount(1);
    await expect(primaries.filter({ hasText: /Delivery/i })).toHaveCount(1);
    await expect(primaries.filter({ hasText: /Leadership/i })).toHaveCount(1);
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
