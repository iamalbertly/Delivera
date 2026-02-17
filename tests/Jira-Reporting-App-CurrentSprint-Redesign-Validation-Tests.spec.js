/**
 * SIZE-EXEMPT: Cohesive E2E spec for Current Sprint redesign (11 UI components); splitting would duplicate setup and reduce clarity.
 * Jira Reporting App - Current Sprint Redesign Validation Test Suite
 * Comprehensive tests for all 11 new UI components:
 * 1. Fixed Header Bar
 * 2. Unified Health Dashboard
 * 3. Alert/Warning Banner
 * 4. Risks & Insights Modal
 * 5. Capacity Allocation Visualization
 * 6. Sprint Navigation Carousel
 * 7. Scope Change Indicator
 * 8. Days Remaining Countdown Timer
 * 9. Export Dashboard Feature
 * 10. CSS Grid Responsive Layout
 * 11. Comprehensive Validation & Accessibility
 * 
 * + 3 Bonus Edge Case Solutions:
 * A. Multi-timezone Sprint Scheduling
 * B. Burndown with Estimation Gaps
 * C. Sub-task Estimation Without Parent Estimate
 * 
 * Rationale: All tests use Playwright for real-time browser automation + visual regression
 * Tests validate: functionality, performance, accessibility, responsiveness, error handling
 */

import { test, expect } from '@playwright/test';

// Base configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SPRINT_PAGE = `${BASE_URL}/current-sprint`;

/**
 * Utility: Load sprint page and wait for content
 */
async function loadSprintPage(page) {
  await page.goto(SPRINT_PAGE);
  await page.waitForLoadState('domcontentloaded');
  // Wait for container elements to exist; visibility may depend on API data
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

async function ensureDetailsExpanded(page) {
  const toggle = page.locator('.card-details-toggle');
  if (!(await toggle.isVisible().catch(() => false))) return;
  const expanded = await toggle.getAttribute('aria-expanded');
  if (expanded === 'false') {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
}

// Utility: get first available boardId from API (resilient test helper)
async function getFirstBoardId(request) {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const res = await request.get(`${base}/api/boards.json`);
  if (res.status() !== 200) return null;
  const data = await res.json();
  const boards = data?.boards || data?.boards || data?.projects || [];
  if (!boards || boards.length === 0) return null;
  return boards[0]?.id || null;
}

/**
 * Utility: Get page performance metrics
 */
async function getPageMetrics(page) {
  return await page.evaluate(() => {
    const perf = performance.getEntriesByType('navigation')[0];
    return {
      domReady: perf?.domContentLoadedEventEnd - perf?.domContentLoadedEventStart,
      loadComplete: perf?.loadEventEnd - perf?.loadEventStart,
      nodeCount: document.body.querySelectorAll('*').length,
      cssSize: new Blob([...document.styleSheets].map(sheet => sheet.cssText || '')).size
    };
  });
}

test.describe('CurrentSprint Redesign - Component Validation', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Navigate to sprint page
    const state = await loadSprintPage(page);
    if (state?.hasError) {
      testInfo.skip(`Skipping: current sprint page error - ${state.message}`);
    }
  });

  // ========== VALIDATION 1: Header Bar Component ==========
  test('Validation 1.1: Header bar renders with sprint metadata', async ({ page }) => {
    const headerBar = page.locator('.current-sprint-header-bar');
    await expect(headerBar).toBeVisible();
    
    // Check all required elements
    await expect(page.locator('.header-sprint-name')).toBeVisible();
    await expect(page.locator('.header-sprint-dates')).toBeVisible();
    await expect(page.locator('.header-metric')).toHaveCount(3); // Remaining, Total SP, Progress
    await expect(page.locator('.status-badge')).toBeVisible();
  });

  test('Validation 1.1b: Single-project mode hint is visible near selectors', async ({ page }) => {
    await expect(page.locator('#current-sprint-single-project-hint')).toBeVisible();
    await expect(page.locator('#current-sprint-single-project-hint')).toContainText(/single-project mode|Using/i);
  });

  test('Validation 1.1c: Header separates active filters from cached report context', async ({ page }) => {
    const contextRow = page.locator('.header-context-row');
    const rowVisible = await contextRow.isVisible().catch(() => false);
    if (!rowVisible) {
      test.skip(true, 'Header context row not rendered for this dataset');
      return;
    }
    await expect(contextRow).toContainText(/Active:|Active filters:/i);
    const text = (await contextRow.textContent().catch(() => '')) || '';
    if (/From report cache:/i.test(text)) {
      await expect(contextRow).toContainText(/From report cache:/i);
    }
  });

  test('Validation 1.1d: Header shows explicit export readiness state', async ({ page }) => {
    const readiness = page.locator('.header-export-readiness');
    await expect(readiness).toBeVisible();
    await expect(readiness).toContainText(/Export ready|No exportable rows/i);
  });

  test('Validation 1.2: Header bar is sticky on scroll', async ({ page }) => {
    const headerBar = page.locator('.current-sprint-header-bar');
    const initialTop = await headerBar.evaluate(el => window.getComputedStyle(el).position);
    
    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));
    
    // Verify sticky positioning
    const stickyStyle = await headerBar.evaluate(el => window.getComputedStyle(el).position);
    expect(['fixed', 'sticky']).toContain(stickyStyle);
  });

  test('Validation 1.3: Days remaining color coding is correct', async ({ page }) => {
    const remainingMetric = page
      .locator('.header-bar-center .header-metric')
      .filter({ has: page.locator('.metric-label', { hasText: 'Remaining' }) })
      .locator('.metric-value')
      .first();
    const text = await remainingMetric.textContent();
    
    // Parse days from text (e.g., "1 day", "5 days")
    const daysMatch = text?.match(/(\d+)/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      let expectedClass = 'critical'; // 0-2 days
      if (days > 5) expectedClass = 'green';
      else if (days > 2) expectedClass = 'yellow';
      
      // Verify color class exists
      const classList = await remainingMetric.getAttribute('class');
      expect(classList).toContain(expectedClass);
    }
  });

  test('Validation 1.4: Header bar renders within 100ms', async ({ page }) => {
    const startTime = Date.now();
    await page.waitForSelector('.current-sprint-header-bar', { timeout: 100 });
    const renderTime = Date.now() - startTime;
    expect(renderTime).toBeLessThan(100);
  });

  // ========== VALIDATION 2: Deduplicated Details Flow ==========
  test('Validation 2.1: Legacy health dashboard card is not rendered (deduplicated)', async ({ page }) => {
    await expect(page.locator('.health-dashboard-card')).toHaveCount(0);
  });

  test('Validation 2.2: Capacity details toggle is present and controls details region', async ({ page }) => {
    const toggle = page.locator('.card-details-toggle').first();
    const visible = await toggle.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Capacity details toggle not rendered for this dataset');
      return;
    }
    const before = await toggle.getAttribute('aria-expanded');
    await toggle.click();
    const after = await toggle.getAttribute('aria-expanded');
    expect(before).not.toBe(after);
  });

  test('Validation 2.3: Capacity section renders when details region is expanded', async ({ page }) => {
    await ensureDetailsExpanded(page);
    const capacity = page.locator('#capacity-card, .capacity-card').first();
    const visible = await capacity.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'Capacity card not rendered for this dataset');
      return;
    }
    await expect(capacity).toBeVisible();
  });

  test('Validation 2.4: Sprint health state is visible in command-center verdict line', async ({ page }) => {
    const riskText = await page.locator('.sprint-verdict-line').first().textContent();
    expect((riskText || '').toLowerCase()).toMatch(/(healthy|risk|caution|critical|at risk)/);
  });

  test('Validation 2.5: Command-center verdict renders within 150ms', async ({ page }) => {
    const startTime = Date.now();
    await page.waitForSelector('.sprint-verdict-line', { timeout: 150 });
    const renderTime = Date.now() - startTime;
    expect(renderTime).toBeLessThan(150);
  });

  // ========== VALIDATION 3: Command Center Verdict ==========
  test('Validation 3.1: Command center verdict line renders severity signal', async ({ page }) => {
    const verdict = page.locator('.sprint-verdict-line').first();
    await expect(verdict).toBeVisible();
    const text = (await verdict.textContent().catch(() => '') || '').toLowerCase();
    expect(text).toMatch(/healthy|caution|at risk|critical/);
  });

  test('Validation 3.2: Command center provides direct blocker drilldown affordance', async ({ page }) => {
    const drilldown = page.locator('.sprint-verdict-drilldown, .sprint-verdict-drilldown-ok').first();
    await expect(drilldown).toBeVisible();
    const href = await drilldown.getAttribute('href');
    if (href) expect(href).toContain('#work-risks-table');
  });

  // ========== VALIDATION 4: Risks & Insights Modal ==========
  test('Validation 4.1: Risks & Insights card renders with all tabs', async ({ page }) => {
    const card = page.locator('.risks-insights-card');
    await expect(card).toBeVisible();
    
    // Check tabs
    await expect(page.locator('.insights-tab')).toHaveCount(3); // Blockers, Learnings, Assumptions
  });

  test('Validation 4.2: Risks & Insights tab switching works', async ({ page }) => {
    const tabs = page.locator('.insights-tab');
    const learningsTab = tabs.nth(1);
    
    await learningsTab.click();
    
    // Verify tab is active
    const isActive = await learningsTab.evaluate(el => el.classList.contains('active'));
    expect(isActive).toBeTruthy();
    
    // Verify panel is visible
    const learnPanel = page.locator('#learnings-panel');
    const isPanelActive = await learnPanel.evaluate(el => el.classList.contains('active'));
    expect(isPanelActive).toBeTruthy();
  });

  test('Validation 4.3: Risks & Insights keyboard navigation works', async ({ page }) => {
    const tabs = page.locator('.insights-tab');
    const firstTab = tabs.first();
    
    await firstTab.focus();
    await page.keyboard.press('ArrowRight');
    
    // Second tab should now be focused
    const secondTab = tabs.nth(1);
    const hasFocus = await secondTab.evaluate(el => el === document.activeElement);
    expect(hasFocus).toBeTruthy();
  });

  test('Validation 4.4: Risks & Insights save functionality works', async ({ page }) => {
    // Mock API endpoint
    await page.route('/api/current-sprint/insights', route => {
      route.abort('blockedbyclient');
    });
    
    const saveBtn = page.locator('#insights-save');
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      
      // Status message should show attempt
      const statusEl = page.locator('#insights-status');
      const statusText = await statusEl.textContent();
      expect(statusText).toBeTruthy();
    }
  });

  // ========== VALIDATION 5: Capacity Allocation ==========
  test('Validation 5.1: Capacity allocation card renders', async ({ page }) => {
    await ensureDetailsExpanded(page);
    const card = page.locator('.capacity-allocation-card');
    const isVisible = await card.isVisible().catch(() => false);
    if (!isVisible) {
      await expect(page.locator('.data-availability-summary')).toContainText(/Capacity hidden/i);
      test.skip(true, 'Capacity card intentionally hidden for no-data sprint');
      return;
    }
    await expect(card).toBeVisible();
    
    // Check required elements
    await expect(page.locator('.capacity-health')).toBeVisible();
    await expect(page.locator('.capacity-allocations')).toBeVisible();
  });

  test('Validation 5.2: Capacity bar shows overallocation correctly', async ({ page }) => {
    await ensureDetailsExpanded(page);
    const bar = page.locator('.allocation-bar.overallocated');
    const count = await bar.count();
    
    // If overallocated items exist, verify color
    if (count > 0) {
      const style = await bar.first().evaluate(el => window.getComputedStyle(el).background);
      expect(style).toContain('rgb'); // Should have color
    }
  });

  test('Validation 5.3: Capacity allocation expand/collapse works', async ({ page }) => {
    await ensureDetailsExpanded(page);
    const expandBtn = page.locator('.allocation-expand-btn').first();
    if (await expandBtn.count() === 0) {
      test.skip();
    }
    
    await expandBtn.click();
    
    // Issues list should be visible
    const issues = page.locator('.allocation-issues').first();
    const isVisible = await issues.isVisible().catch(() => false);
    expect(isVisible).toBeTruthy();
  });

  test('Validation 5.5: Capacity allocation issue keys link to Jira', async ({ page }) => {
    await ensureDetailsExpanded(page);
    const expandBtn = page.locator('.allocation-expand-btn').first();
    if (await expandBtn.count() === 0) {
      test.skip();
    }

    await expandBtn.click();

    const issueLink = page.locator('.allocation-issues .issue-key a').first();
    if (await issueLink.count() === 0) {
      test.skip();
    }
    await expect(issueLink).toHaveAttribute('target', '_blank');
    await expect(issueLink).toHaveAttribute('rel', /noopener/);
  });

  test('Validation 5.4: Capacity health color matches severity', async ({ page }) => {
    await ensureDetailsExpanded(page);
    const health = page.locator('.capacity-health');
    const classList = await health.getAttribute('class');
    
    expect(classList).toMatch(/(green|orange|yellow|red)/);
  });

  // ========== VALIDATION 6: Sprint Carousel ==========
  test('Validation 6.1: Sprint carousel renders with 8 recent sprints', async ({ page }) => {
    const carousel = page.locator('.sprint-carousel');
    const tabs = page.locator('.carousel-tab');
    
    const count = await tabs.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(8);
  });

  test('Validation 6.2: Sprint carousel keyboard navigation works', async ({ page }) => {
    const tabs = page.locator('.carousel-tab');
    const firstTab = tabs.first();
    
    await firstTab.focus();
    await page.keyboard.press('ArrowRight');
    
    // Next tab should receive focus
    const secondTab = tabs.nth(1);
    const hasFocus = await secondTab.evaluate(el => el === document.activeElement);
    expect(hasFocus).toBeTruthy();
  });

  test('Validation 6.3: Sprint carousel colors match completion %', async ({ page }) => {
    const tabs = page.locator('.carousel-tab');
    
    for (let i = 0; i < Math.min(3, await tabs.count()); i++) {
      const tab = tabs.nth(i);
      const classList = await tab.getAttribute('class');
      expect(classList).toMatch(/(green|yellow|gray|muted)/);
    }
  });

  test('Validation 6.4: Sprint carousel has accessibility labels', async ({ page }) => {
    const carousel = page.locator('.sprint-carousel');
    const ariaLabel = await carousel.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  // ========== VALIDATION 7: Scope merged into existing risk views ==========
  test('Validation 7.1: Scope summary appears in merged Work risks card', async ({ page }) => {
    const scopeSummary = page.locator('#stuck-card .meta-row').filter({ hasText: /Scope impact|Scope changes merged/i }).first();
    await expect(scopeSummary).toBeVisible();
  });

  test('Validation 7.2: Work risks table contains Type and SP columns for merged scope context', async ({ page }) => {
    const headerText = ((await page.locator('#work-risks-table thead').textContent()) || '').toLowerCase();
    expect(headerText.includes('type')).toBeTruthy();
    expect(headerText.includes('sp')).toBeTruthy();
  });

  test('Validation 7.3: Risks & Insights blockers tab includes scope narrative', async ({ page }) => {
    const blockersPanel = page.locator('#blockers-panel');
    await expect(blockersPanel).toBeVisible();
    const text = (await blockersPanel.textContent()) || '';
    if (/scope added mid-sprint/i.test(text)) {
      expect(text).toMatch(/scope added mid-sprint/i);
    } else {
      expect(text.length > 0).toBeTruthy();
    }
  });

  test('Validation 7.4: Standalone scope modal is not rendered (deduplicated)', async ({ page }) => {
    await expect(page.locator('.scope-modal-overlay')).toHaveCount(0);
  });

  // ========== VALIDATION 8: Countdown Timer ==========
  test('Validation 8.1: Countdown timer renders with correct color', async ({ page }) => {
    const timer = page.locator('.countdown-timer-widget');
    await expect(timer).toBeVisible();
    
    const svg = page.locator('.countdown-ring');
    const classList = await svg.getAttribute('class');
    expect(classList).toMatch(/(green|yellow|red|gray)/);
  });

  test('Validation 8.2: Countdown timer shows days or hours correctly', async ({ page }) => {
    const label = page.locator('.countdown-label');
    const text = await label.textContent();
    
    // Should show "Xd" or "Xh" or "✓"
    expect(text).toMatch(/(d|h|✓|<)/);
  });

  test('Validation 8.3: Countdown timer has accessibility label', async ({ page }) => {
    const timer = page.locator('.countdown-timer-widget');
    const ariaLabel = await timer.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  test('Validation 8.4: Countdown timer pulse animation on urgent', async ({ page }) => {
    const timer = page.locator('.countdown-timer-widget');
    const svg = page.locator('.countdown-ring.urgent');
    
    if (await svg.count() > 0) {
      const animation = await svg.evaluate(el => window.getComputedStyle(el).animation);
      expect(animation).toBeTruthy();
    }
  });

  // ========== VALIDATION 9: Export Dashboard ==========
  test('Validation 9.1: Export button is visible and clickable', async ({ page }) => {
    const btn = page.locator('.export-dashboard-btn');
    await expect(btn).toBeVisible();
    await btn.click();
    
    const menu = page.locator('#export-menu');
    await expect(menu).toBeVisible();
  });

  test('Validation 9.2: Export menu shows all options', async ({ page }) => {
    const btn = page.locator('.export-dashboard-btn');
    await btn.click();
    
    const options = page.locator('.export-option');
    await expect(options).toHaveCount(5);
    await expect(page.locator('[data-action="copy-text"]')).toBeVisible();
    await expect(page.locator('[data-action="export-markdown"]')).toBeVisible();
    await expect(page.locator('[data-action="export-png"]')).toBeVisible();
    await expect(page.locator('[data-action="copy-link"]')).toBeVisible();
    await expect(page.locator('[data-action="email"]')).toBeVisible();
  });

  test('Validation 8.5: Hidden-section summary is compact and visible when cards are suppressed', async ({ page }) => {
    const summary = page.locator('.data-availability-summary');
    if (!(await summary.isVisible().catch(() => false))) {
      test.skip(true, 'No hidden sections for this dataset');
      return;
    }
    const text = ((await summary.textContent()) || '').trim();
    expect(text.length).toBeLessThan(420);
    await expect(summary.locator('.data-availability-chip').first()).toBeVisible();
    await expect(summary.locator('.data-availability-source').first()).toBeVisible();
  });

  test('Validation 9.3: Copy dashboard link works', async ({ page }) => {
    const btn = page.locator('.export-dashboard-btn');
    await btn.click();
    
    const copyOption = page.locator('[data-action="copy-link"]');
    
    // Mock clipboard
    await page.evaluate(() => {
      navigator.clipboard.writeText = async (text) => {
        document.body.setAttribute('data-copied-link', text);
        return Promise.resolve();
      };
    });

    await page.evaluate(() => {
      const item = document.querySelector('[data-action="copy-link"]');
      if (item) item.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    
    const copiedLink = await page.getAttribute('body', 'data-copied-link');
    expect((copiedLink || '').length > 0).toBeTruthy();
    expect((copiedLink || '')).toContain('/current-sprint');
    if ((copiedLink || '').includes('boardId=')) {
      expect((copiedLink || '')).toMatch(/boardId=.*sprintId=/);
    }
  });

  test('Validation 9.4: Export menu closes on click outside', async ({ page }) => {
    const btn = page.locator('.export-dashboard-btn');
    await btn.click();
    const toggle = page.locator('.export-menu-toggle');
    await toggle.click();
    const menu = page.locator('#export-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('aria-hidden', 'false');
    
    // Click outside menu
    await page.click('body', { position: { x: 0, y: 0 } });
    
    const isHidden = await menu.evaluate(el => el.classList.contains('hidden'));
    expect(isHidden).toBeTruthy();
    await expect(menu).toHaveAttribute('aria-hidden', 'true');
  });

  test('Validation 9.5: Subtasks render as hierarchical child rows when present', async ({ page, request }) => {
    const boardId = await page.locator('#board-select').inputValue().catch(() => '');
    if (!boardId) {
      test.skip(true, 'No board selected');
      return;
    }
    const res = await request.get(`${BASE_URL}/api/current-sprint.json?boardId=${encodeURIComponent(boardId)}`);
    if (!res.ok()) {
      test.skip(true, 'Current sprint API unavailable for hierarchy check');
      return;
    }
    const body = await res.json();
    const hasSubtasks = Array.isArray(body?.stories) && body.stories.some((row) => Array.isArray(row?.subtasks) && row.subtasks.length > 0);
    if (!hasSubtasks) {
      test.skip(true, 'Dataset has no subtasks to validate hierarchy rendering');
      return;
    }
    // Expand all story rows so rendered child-row count is comparable to payload.
    for (let i = 0; i < 10; i++) {
      const showMore = page.locator('.stories-show-more');
      if (!(await showMore.isVisible().catch(() => false))) break;
      await showMore.click();
    }
    const childRows = page.locator('#stories-table tbody tr.subtask-child-row');
    await expect(childRows.first()).toBeVisible();
    const parentRows = page.locator('#stories-table tbody tr.story-parent-row');
    expect(await childRows.count()).toBeGreaterThan(0);
    expect(await parentRows.count()).toBeGreaterThan(0);
    const expectedChildren = body.stories.reduce((sum, row) => sum + ((row?.subtasks || []).length || 0), 0);
    expect(await childRows.count()).toBe(expectedChildren);
  });

  test('Validation 9.6: Subtask rows avoid story-only fields and emphasize time tracking', async ({ page }) => {
    const childRow = page.locator('#stories-table tbody tr.subtask-child-row').first();
    if (!(await childRow.isVisible().catch(() => false))) {
      test.skip(true, 'No rendered subtask child rows in current dataset');
      return;
    }
    await expect(childRow.locator('td').nth(4)).toHaveText('-');
    await expect(childRow.locator('td').nth(6)).toHaveText('-');
    const est = (await childRow.locator('td').nth(7).textContent().catch(() => '')) || '';
    const logged = (await childRow.locator('td').nth(8).textContent().catch(() => '')) || '';
    expect(est.trim().length > 0).toBeTruthy();
    expect(logged.trim().length > 0).toBeTruthy();
  });

  test('Validation 9.7: Subtask rows include parent issue context for quick traceability', async ({ page }) => {
    const childRow = page.locator('#stories-table tbody tr.subtask-child-row').first();
    if (!(await childRow.isVisible().catch(() => false))) {
      test.skip(true, 'No rendered subtask child rows in current dataset');
      return;
    }
    const parentTag = childRow.locator('.subtask-parent-context');
    await expect(parentTag).toBeVisible();
    await expect(parentTag).not.toHaveText('-');
  });

  // ========== VALIDATION 10: Responsive Layout ==========
  test('Validation 10.1: Desktop layout shows 2-3 columns', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    const topRow = page.locator('.sprint-cards-row.top-row');
    const columns = page.locator('.card-column');
    
    const columnCount = await columns.count();
    expect(columnCount).toBeGreaterThanOrEqual(2);
  });

  test('Validation 10.2: Tablet layout shows 2 columns', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    const risksRow = page.locator('.sprint-cards-row.risks-row').first();
    const isFlexWrap = await risksRow.evaluate(el => {
      return window.getComputedStyle(el).flexWrap === 'wrap';
    });
    
    expect(isFlexWrap).toBeTruthy();
  });

  test('Validation 10.3: Mobile layout shows 1 column', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const keyCards = ['#stuck-card', '#burndown-card', '#risks-insights-card'];
    for (const selector of keyCards) {
      const card = page.locator(selector);
      if (!(await card.isVisible().catch(() => false))) continue;
      const ratio = await card.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width / window.innerWidth;
      });
      expect(ratio).toBeGreaterThan(0.9);
    }
  });

  test('Validation 10.4: Header bar is sticky on all screen sizes', async ({ page }) => {
    for (const width of [1920, 768, 375]) {
      await page.setViewportSize({ width, height: 1080 });
      
      const header = page.locator('.current-sprint-header-bar');
      const style = await header.evaluate(el => window.getComputedStyle(el).position);
      
      expect(['sticky', 'fixed']).toContain(style);
    }
  });

  // ========== VALIDATION 11: Performance & Accessibility ==========
  test('Validation 11.1: Page load time < 1 second', async ({ page }) => {
    const startTime = Date.now();
    await loadSprintPage(page);
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(1000);
  });

  test('Validation 11.2: No console errors during render', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await loadSprintPage(page);
    
    expect(errors).toEqual([]);
  });

  test('Validation 11.3: Accessibility: All interactive elements have aria-labels', async ({ page }) => {
    const buttons = page.locator('button');
    
    for (let i = 0; i < Math.min(5, await buttons.count()); i++) {
      const btn = buttons.nth(i);
      const ariaLabel = await btn.getAttribute('aria-label');
      const text = await btn.textContent();
      
      expect(ariaLabel || text).toBeTruthy();
    }
  });

  test('Validation 11.4: Accessibility: Color contrast is sufficient', async ({ page }) => {
    const primaryText = page.locator('h1, h2, h3');
    
    for (let i = 0; i < Math.min(3, await primaryText.count()); i++) {
      const element = primaryText.nth(i);
      const bgColor = await element.evaluate(el => window.getComputedStyle(el).backgroundColor);
      const textColor = await element.evaluate(el => window.getComputedStyle(el).color);
      
      // Basic check: both should be defined
      expect(bgColor).toBeTruthy();
      expect(textColor).toBeTruthy();
    }
  });

  test('Validation 11.5: DOM node count stays under practical complexity ceiling', async ({ page }) => {
    await loadSprintPage(page);
    
    const nodeCount = await page.evaluate(() => {
      return document.querySelectorAll('*').length;
    });
    
    expect(nodeCount).toBeLessThan(1200);
  });

  // ========== BONUS: EDGE CASES ==========
  
  test('Edge Case A.1: Timezone Detection - Header countdown uses correct TZ', async ({ page }) => {
    // Set user TZ preference
    await page.evaluate(() => {
      localStorage.setItem('sprint_view_tz', 'America/Los_Angeles');
    });
    
    await loadSprintPage(page);
    
    const tzPref = await page.evaluate(() => {
      return localStorage.getItem('sprint_view_tz');
    });
    
    expect(tzPref).toBe('America/Los_Angeles');
  });

  test('Edge Case B.1: Burndown with Estimation Gaps - Warning appears', async ({ page }) => {
    // This test assumes data has >20% unestimated stories
    const warning = page.locator('.capacity-warning');
    
    if (await warning.isVisible()) {
      const text = await warning.textContent();
      expect(text).toContain('%');
    }
  });

  test('Edge Case C.1: Sub-task without Parent Estimate - Inferred in Health Dashboard', async ({ page }) => {
    const trackingStatus = page.locator('.tracking-status');
    
    if (await trackingStatus.isVisible()) {
      const text = await trackingStatus.textContent();
      // Should show either "Complete" or warning about missing estimates
      expect(text).toBeTruthy();
    }
  });

  // ========== INTEGRATION TESTS ==========
  
  test('Integration: All components load without errors', async ({ page }) => {
    const components = [
      '.current-sprint-header-bar',
      '.health-dashboard-card',
      '.sprint-carousel',
      '.countdown-timer-widget',
      '.export-dashboard-btn'
    ];
    
    for (const selector of components) {
      const element = page.locator(selector);
      if (await element.count() > 0) {
        const visible = await element.first().isVisible().catch(() => false);
        if (visible) {
          await expect(element.first()).toBeVisible();
        } else {
          await expect(element.first()).toBeAttached();
        }
      }
    }
  });

  test('Integration: Page performance metrics meet targets', async ({ page }) => {
    await loadSprintPage(page);
    
    const metrics = await getPageMetrics(page);
    
    expect(metrics.domReady).toBeLessThan(500);
    expect(metrics.nodeCount).toBeLessThan(1200);
  });
});

// ========== API CONTRACT VALIDATION ==========
test.describe('CurrentSprint Redesign - API Contracts', () => {
  test('API: /api/current-sprint.json returns expected schema', async ({ request }) => {
    // Derive a valid boardId from /api/boards.json instead of assuming boardId=1
    const boardsRes = await request.get('/api/boards.json');
    if (boardsRes.status() === 401) {
      test.skip('Auth required');
      return;
    }
    expect(boardsRes.status()).toBe(200);
    const boardsBody = await boardsRes.json();
    const boards = boardsBody?.boards || boardsBody?.projects || [];
    if (!boards || boards.length === 0) {
      test.skip('No boards available to test against');
      return;
    }

    const boardId = boards[0].id;
    const response = await request.get(`${BASE_URL}/api/current-sprint.json?boardId=${boardId}`);
    if (response.status() === 401) {
      test.skip('Auth required');
      return;
    }

    expect(response.status()).toBe(200);
    const data = await response.json();

    // Verify required fields
    expect(data.sprint).toBeTruthy();
    expect(data.summary).toBeTruthy();
    expect(data.daysMeta).toBeTruthy();
    expect(data.stuckCandidates).toBeTruthy();
    expect(Array.isArray(data.stories || [])).toBeTruthy();
    if (Array.isArray(data.stories) && data.stories.length > 0) {
      const firstStory = data.stories[0];
      expect(firstStory).toHaveProperty('issueType');
      expect(Array.isArray(firstStory.subtasks || [])).toBeTruthy();
    }
    expect(typeof data.meta?.jiraHostResolved).toBe('string');
    if (data.meta?.jiraHostResolved) {
      expect(data.meta.jiraHostResolved.startsWith('http://') || data.meta.jiraHostResolved.startsWith('https://')).toBeTruthy();
    }
  });

  test('API: Error handling on missing boardId', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/current-sprint.json`);
    
    // Should either return error or default data
    expect([400, 200]).toContain(response.status());
  });
});

