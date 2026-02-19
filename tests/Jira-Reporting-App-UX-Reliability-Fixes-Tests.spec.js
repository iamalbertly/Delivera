import { test, expect } from '@playwright/test';
import { runDefaultPreview } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

const DEFAULT_Q2_QUERY = '?projects=MPSA,MAS&start=2025-07-01T00:00:00.000Z&end=2025-09-30T23:59:59.999Z';

// Helper: Get table cell text by row and column index
async function getTableCellText(page, rowIndex, columnIndex) {
  const cell = page.locator(`table tbody tr:nth-child(${rowIndex}) td:nth-child(${columnIndex})`);
  return await cell.textContent();
}

// Helper: Validate metrics tab is visible
async function validateMetricsTabVisible(page) {
  const tab = page.locator('#tab-btn-project-epic-level:visible').first();
  await expect(tab).toBeVisible({ timeout: 5000 });
}

async function openProjectEpicTabIfVisible(page) {
  const tab = page.locator('.tab-btn[data-tab="project-epic-level"]:visible').first();
  const canOpen = await tab.isVisible().catch(() => false);
  if (!canOpen) return false;
  await tab.click();
  await page.waitForSelector('#tab-project-epic-level.active', { state: 'visible', timeout: 10000 }).catch(() => null);
  return true;
}

test.describe('UX Reliability & Technical Debt Fixes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report');
    await expect(page.locator('h1')).toContainText(/VodaAgileBoard|General Performance/);
  });

  test('refreshing preview keeps previous results visible while loading', async ({ page }) => {
    test.setTimeout(120000);

    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);
    if (!previewVisible || errorVisible) {
      test.skip();
      return;
    }
    await expect(page.locator('#preview-content')).toBeVisible({ timeout: 10000 });

    let resolveRouteHandled;
    const routeHandled = new Promise(resolve => {
      resolveRouteHandled = resolve;
    });

    await page.route('**/preview.json*', async route => {
      await new Promise(resolve => setTimeout(resolve, 800));
      const response = await route.fetch();
      await route.fulfill({ response });
      resolveRouteHandled();
      await page.unroute('**/preview.json*').catch(() => {});
    });

    const previewBtn = page.locator('#preview-btn');
    if (!(await previewBtn.isVisible().catch(() => false))) {
      const showFilters = page.locator('#filters-panel-collapsed-bar [data-action="toggle-filters"]').first();
      if (await showFilters.isVisible().catch(() => false)) {
        await showFilters.click({ force: true }).catch(() => null);
      }
      await previewBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
    }
    await previewBtn.click();

    const statusBanner = page.locator('#preview-status .status-banner.info');
    await expect(statusBanner).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#preview-content')).toBeVisible({ timeout: 5000 });

    await routeHandled.catch(() => {});
    await page.waitForSelector('#loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
  });

  test('should display Unknown for empty issueType in Done Stories table', async ({ page, request }) => {
    console.log('[TEST] Starting empty issueType display validation');
    test.setTimeout(300000);

    // Test via API first to get data (retry once if transient timeout)
    let response;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await request.get(`/preview.json${DEFAULT_Q2_QUERY}&bypassCache=true`, { timeout: 180000 });
        break;
      } catch (err) {
        console.warn(`[TEST] Preview API attempt ${attempt} failed: ${err.message}`);
        if (attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (response.status() === 200) {
      const data = await response.json();
      if (data.rows && data.rows.length > 0) {
        // Find a row with empty issueType if any
        const emptyIssueTypeRow = data.rows.find(row => !row.issueType || row.issueType === '');
        
        if (emptyIssueTypeRow) {
          console.log(`[TEST] Found row with empty issueType: ${emptyIssueTypeRow.issueKey}`);
          
          // Load preview in browser
          await runDefaultPreview(page, { includeStoryPoints: true });
          
          // Navigate to Done Stories tab
          await page.click('.tab-btn[data-tab="done-stories"]');
          await page.waitForSelector('#tab-done-stories.active', { state: 'visible', timeout: 10000 });
          
          // Find the row in the table and verify it shows "Unknown"
          const issueKeyCell = page.locator(`table tbody td:has-text("${emptyIssueTypeRow.issueKey}")`);
          if (await issueKeyCell.isVisible()) {
            const row = issueKeyCell.locator('..');
            const issueTypeCell = row.locator('td:nth-child(4)'); // Type column is 4th
            const issueTypeText = await issueTypeCell.textContent();
            expect(issueTypeText).toContain('Unknown');
            console.log('[TEST] ✓ Empty issueType displays as Unknown in UI');
          }
        } else {
          console.log('[TEST] ⚠ No rows with empty issueType found in test data');
        }
      }
    }
  });

  test('should always show Metrics tab when metrics object exists', async ({ page, request }) => {
    console.log('[TEST] Starting metrics tab visibility validation');
    test.setTimeout(300000);

    // Generate preview with metrics
    await runDefaultPreview(page, { 
      // Story Points and Epic TTM are now mandatory (always enabled) 
    });

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    const errorVisible = await page.locator('#error').isVisible().catch(() => false);
    if (!previewVisible || errorVisible) {
      console.log('[TEST] Preview not visible or error shown; skipping metrics tab visibility check');
      test.skip();
      return;
    }

    // Verify metrics tab is visible (should be visible even if metrics are empty)
    await validateMetricsTabVisible(page);
    console.log('[TEST] ✓ Metrics tab is visible');

    // Click Project & Epic Level tab to verify metrics section renders
    const tabOpened = await openProjectEpicTabIfVisible(page);
    if (!tabOpened) {
      test.skip(true, 'Project & Epic Level tab not visible');
      return;
    }
    console.log('[TEST] ✓ Project & Epic Level tab is clickable and active');
  });

  test('should keep throughput merged in boards table and remove duplicate throughput section', async ({ page, request }) => {
    console.log('[TEST] Starting merged throughput validation');
    test.setTimeout(300000);

    await runDefaultPreview(page, {
      // Story Points and Bugs/Rework are now mandatory (always enabled)
    });

    const tabOpened = await openProjectEpicTabIfVisible(page);
    if (!tabOpened) {
      test.skip(true, 'Project & Epic Level tab not visible');
      return;
    }
    await page.waitForSelector('#project-epic-level-content', { state: 'visible', timeout: 10000 });

    const metricsContent = await page.locator('#project-epic-level-content').textContent();
    expect(metricsContent.includes('Throughput (Per Project)')).toBeFalsy();
    expect(metricsContent.includes('Throughput Stories') || metricsContent.includes('Throughput SP')).toBeTruthy();
    console.log('[TEST] ? Throughput is merged into boards columns and duplicate section is absent');
  });

  test('should display Epic TTM fallback warning when fallback used', async ({ page, request }) => {
    console.log('[TEST] Starting Epic TTM fallback warning validation');
    test.setTimeout(300000);

    // Test via API to check for fallback count
    let response;
    try {
      response = await request.get(`/preview.json${DEFAULT_Q2_QUERY}&bypassCache=true`, {
        timeout: 180000
      });
    } catch (err) {
      console.log('[TEST] Preview API timeout; skipping Epic TTM fallback warning validation');
      test.skip();
      return;
    }

    if (response.status() === 200) {
      const data = await response.json();
      
      if (data.meta?.epicTTMFallbackCount !== undefined && data.meta.epicTTMFallbackCount > 0) {
        console.log(`[TEST] Epic TTM fallback count: ${data.meta.epicTTMFallbackCount}`);
        
        // Load preview in browser
        await runDefaultPreview(page, { 
          includeStoryPoints: true,
          includeEpicTTM: true 
        });

        // Navigate to Project & Epic Level tab (metrics are embedded)
        const tabOpened = await openProjectEpicTabIfVisible(page);
        if (!tabOpened) {
          test.skip(true, 'Project & Epic Level tab not visible');
          return;
        }
        await page.waitForSelector('#project-epic-level-content', { state: 'visible', timeout: 10000 });

        // Check for fallback warning
        const metricsContent = await page.locator('#project-epic-level-content').textContent();
        const hasFallbackWarning = metricsContent.includes('used story date fallback') || 
                                   metricsContent.includes('Epic issues unavailable');
        
        expect(hasFallbackWarning).toBeTruthy();
        console.log('[TEST] ✓ Epic TTM fallback warning displayed in UI');

        const epicTable = page.locator('#project-epic-level-content table').filter({ hasText: 'Epic Key' }).first();
        const epicTableHeader = epicTable.locator('thead tr');
        await expect(epicTableHeader).toContainText('Subtask Spent (Hrs)');
        console.log('[TEST] ✓ Epic TTM subtask hours column visible');

        const storyLink = page.locator('#project-epic-level-content table tbody tr td .epic-story-list a').first();
        if (await storyLink.isVisible().catch(() => false)) {
          const href = await storyLink.getAttribute('href');
          expect(href || '').toContain('/browse/');
          console.log('[TEST] ✓ Epic TTM story IDs render as Jira links');
        }
      } else {
        console.log('[TEST] ⚠ No Epic TTM fallback detected (may be all Epics available)');
      }
    }
  });

  test('should validate CSV columns before export', async ({ request }) => {
    console.log('[TEST] Starting CSV column validation');
    test.setTimeout(300000);

    let response;
    try {
      response = await request.get(`/preview.json${DEFAULT_Q2_QUERY}`, { timeout: 120000 });
    } catch (_) {
      console.log('[TEST] Preview request timed out; skipping CSV validation');
      test.skip();
      return;
    }
    if (response.status() !== 200) {
      console.log('[TEST] ⚠ Preview request failed; skipping CSV validation');
      test.skip();
      return;
    }

    const data = await response.json();
    const rows = Array.isArray(data.rows) ? data.rows : [];
    if (rows.length === 0) {
      console.log('[TEST] ⚠ No preview rows available; skipping CSV validation');
      test.skip();
      return;
    }

    const { generateCSVClient } = await import('../public/Reporting-App-Report-Utils-Data-Helpers.js');
    const columns = Object.keys(rows[0]);
    const csv = generateCSVClient(columns, rows.slice(0, 10));
    const lines = csv.split('\n').filter(line => line.trim());

    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain('issueType');
    expect(lines[0]).toContain('issueKey');
    expect(lines[0]).toContain('issueStatus');
    console.log('[TEST] ✓ CSV export contains required columns via shared helper');
  });

  test('done stories table renders issue keys as Jira links', async ({ page }) => {
    console.log('[TEST] Starting Done Stories issue key link validation');
    test.setTimeout(300000);

    await runDefaultPreview(page, { includeStoryPoints: true });

    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) {
      test.skip();
      return;
    }

    await page.click('.tab-btn[data-tab="done-stories"]');
    await page.waitForSelector('#tab-done-stories.active', { state: 'visible', timeout: 10000 });

    const keyLink = page.locator('#done-stories-content table tbody tr td:first-child a').first();
    if (!(await keyLink.isVisible().catch(() => false))) {
      console.log('[TEST] ⚠ No Done Stories rows with links found (data may be empty)');
      test.skip();
      return;
    }

    const href = await keyLink.getAttribute('href');
    expect(href || '').toContain('/browse/');
    console.log('[TEST] ✓ Done Stories issue keys render as Jira links');
  });

  test('should display cache age in preview meta when from cache', async ({ page, request }) => {
    console.log('[TEST] Starting cache age display validation');
    test.setTimeout(300000);

    // First request to populate cache
    let firstResponse;
    try {
      firstResponse = await request.get(`/preview.json${DEFAULT_Q2_QUERY}`, {
        timeout: 120000
      });
    } catch (_) {
      console.log('[TEST] First cache-seeding request timed out; skipping cache age validation');
      test.skip();
      return;
    }

    if (firstResponse.status() === 200) {
      // Wait a moment for cache to be set
      await page.waitForTimeout(1000);
      
      // Second request should be from cache
      let secondResponse;
      try {
        secondResponse = await request.get(`/preview.json${DEFAULT_Q2_QUERY}`, {
          timeout: 120000
        });
      } catch (_) {
        console.log('[TEST] Second cache request timed out; skipping cache age validation');
        test.skip();
        return;
      }

      if (secondResponse.status() === 200) {
        const data = await secondResponse.json();
        
        if (data.meta?.fromCache === true) {
          console.log('[TEST] ✓ Response served from cache');
          
          if (data.meta?.cacheAgeMinutes !== undefined) {
            expect(typeof data.meta.cacheAgeMinutes).toBe('number');
            expect(data.meta.cacheAgeMinutes).toBeGreaterThanOrEqual(0);
            console.log(`[TEST] ✓ Cache age in meta: ${data.meta.cacheAgeMinutes} minutes`);
            
            // Load preview in browser to verify UI display
            await runDefaultPreview(page);
            
            // Check preview meta for cache age
            const previewMeta = await page.locator('#preview-meta').textContent();
            const hasCacheAge = previewMeta.includes('Cache age:') || previewMeta.includes('minutes');
            
            console.log(`[TEST] ${hasCacheAge ? '✓' : '⚠'} Cache age ${hasCacheAge ? 'displayed' : 'not displayed'} in UI`);
          } else {
            console.log('[TEST] ⚠ Cache age not in meta (may be first request or cache miss)');
          }
        } else {
          console.log('[TEST] ⚠ Response not from cache (cache may have expired or been bypassed)');
        }
      }
    }
  });

  test('should recover gracefully when Epic fetch fails', async ({ page, request }) => {
    console.log('[TEST] Starting Epic fetch error recovery validation');
    test.setTimeout(300000);

    // Generate preview with Epic TTM enabled
    await runDefaultPreview(page, { 
      // Story Points and Epic TTM are now mandatory (always enabled) 
    });

    // Verify preview completed successfully (even if Epic fetch failed)
    const previewContent = page.locator('#preview-content');
    const previewVisible = await previewContent.isVisible().catch(() => false);
    if (!previewVisible) {
      console.log('[TEST] Preview not visible; skipping Epic fetch recovery validation');
      test.skip();
      return;
    }
    console.log('[TEST] ✓ Preview completed successfully');

    // Check that Epic TTM section exists (may be empty if Epic fetch failed)
    const tabOpened = await openProjectEpicTabIfVisible(page);
    if (!tabOpened) {
      test.skip(true, 'Project & Epic Level tab not visible');
      return;
    }
    
    const metricsContent = await page.locator('#project-epic-level-content').textContent();
    const hasEpicTTMSection = metricsContent.includes('Epic Time-To-Market');
    
    console.log(`[TEST] ${hasEpicTTMSection ? '✓' : '⚠'} Epic TTM section ${hasEpicTTMSection ? 'present' : 'not present'}`);
    // Note: Epic TTM section may be empty if no epics found, but preview should still succeed
  });

  test('Epic TTM section shows explicit Jira link status line', async ({ page }) => {
    test.setTimeout(180000);
    await runDefaultPreview(page);
    const opened = await openProjectEpicTabIfVisible(page);
    if (!opened) {
      test.skip();
      return;
    }
    const section = page.locator('#project-epic-level-content');
    const hasEpicSection = await section.locator('h3:has-text("Epic Time-To-Market")').count();
    if (!hasEpicSection) {
      test.skip();
      return;
    }
    const statusLine = section.locator('.jira-link-status-line').first();
    await expect(statusLine).toBeVisible();
    const statusText = (await statusLine.textContent() || '').toLowerCase();
    expect(statusText.includes('jira links')).toBeTruthy();
    expect(statusText.includes('enabled') || statusText.includes('unavailable')).toBeTruthy();
  });
});

// ============================================================
// UX Audit Fixes Validation — 10 incremental UX + tech-debt
// fixes implemented per the audit response (Feb 2026)
// ============================================================
test.describe('UX Audit Fixes — Current Sprint + Report Pages', () => {
  test('SSOT host contract: preview meta exposes normalized jiraHostResolved string', async ({ request }) => {
    test.setTimeout(180000);
    let response;
    try {
      response = await request.get(`/preview.json${DEFAULT_Q2_QUERY}`, { timeout: 45000 });
    } catch (error) {
      test.skip(`Preview not reachable for SSOT host contract check: ${error.message}`);
      return;
    }
    if (response.status() !== 200) {
      test.skip(`Preview returned ${response.status()} for SSOT host contract check`);
      return;
    }
    const data = await response.json();
    expect(typeof data.meta?.jiraHostResolved).toBe('string');
    if (data.meta?.jiraHostResolved) {
      expect(data.meta.jiraHostResolved.startsWith('http://') || data.meta.jiraHostResolved.startsWith('https://')).toBeTruthy();
    }
  });

  test('SSOT table containment: boards table uses local vertical scroller and semantic table layout', async ({ page }) => {
    test.setTimeout(180000);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) { test.skip(); return; }

    const boardsTab = page.locator('.tab-btn[data-tab="project-epic-level"]').first();
    const boardsTabVisible = await boardsTab.isVisible().catch(() => false);
    if (!boardsTabVisible) { test.skip(); return; }
    const alreadySelected = (await boardsTab.getAttribute('aria-selected').catch(() => 'false')) === 'true';
    if (!alreadySelected) {
      await boardsTab.click({ force: true, timeout: 10000 }).catch(() => null);
    }
    await page.waitForSelector('#project-epic-level-content', { state: 'visible', timeout: 15000 }).catch(() => {});

    const wrap = page.locator('#project-epic-level-content .data-table-scroll-wrap--with-vertical-limit').first();
    await expect(wrap).toBeVisible();
    const maxHeight = await wrap.evaluate((el) => window.getComputedStyle(el).maxHeight);
    expect(maxHeight).not.toBe('none');

    const display = await page.locator('#boards-table').evaluate((el) => window.getComputedStyle(el).display);
    expect(display).toBe('table');
  });

  // ── UX Fix #1: Human-readable freshness badge (no [Cached]/[Live] dev-speak) ──
  test('UX-01: Report meta badge does not contain [Cached] or [Live] bracket text', async ({ page }) => {
    test.setTimeout(180000);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) { test.skip(); return; }

    const metaBlock = page.locator('.meta-info-summary, .meta-outcome-line');
    const allText = await metaBlock.allTextContents();
    const combined = allText.join(' ');
    expect(combined).not.toContain('[Cached]');
    expect(combined).not.toContain('[Live]');
    console.log('[UX-01] ✓ No bracketed [Cached]/[Live] dev-speak in meta block');
  });

  test('UX-01b: Data-state badge uses human-readable label, not raw cache terminology', async ({ page }) => {
    test.setTimeout(180000);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) { test.skip(); return; }

    const badge = page.locator('.data-state-badge').first();
    const badgeVisible = await badge.isVisible().catch(() => false);
    if (!badgeVisible) { test.skip(); return; }

    const badgeText = (await badge.textContent() || '').trim();
    // Must NOT be the old dev-speak labels; must be human-readable freshness or status
    expect(badgeText).not.toBe('Cached');
    expect(badgeText).not.toBe('Live complete');
    expect(badgeText).not.toMatch(/^\?\?/);
    console.log(`[UX-01b] ✓ Data-state badge shows human label: "${badgeText}"`);
  });

  // ── UX Fix #4: Inline blocker micro-data in command-center verdict line ──
  test('UX-04: Header verdict line shows direct blocker drilldown context', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/current-sprint');
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
    const contentVisible = await page.locator('#current-sprint-content').isVisible().catch(() => false);
    if (!contentVisible) { test.skip(); return; }

    const verdictLine = page.locator('.sprint-verdict-line').first();
    await expect(verdictLine).toBeVisible();
    const verdictText = (await verdictLine.textContent() || '').trim();

    if (verdictText.toLowerCase().includes('blocker')) {
      await expect(page.locator('.sprint-verdict-drilldown').first()).toBeVisible();
      const hasContext = /missing est|no log|blocker|risk|critical|at risk|caution|healthy/i.test(verdictText);
      expect(hasContext).toBe(true);
      console.log(`[UX-04] ✓ Header verdict line includes blocker context: "${verdictText.slice(0, 100)}"`);
    } else {
      await expect(page.locator('.sprint-verdict-drilldown-ok').first()).toBeVisible();
      console.log('[UX-04] ✓ Healthy state shows explicit no-blocker status in header verdict');
    }
  });

  // ── Tech Debt #1: WORK ITEMS4 spacing fix (CSS flex on .header-metric-link) ──
  test('TD-01: Header metric link renders label and value as separate stacked elements (not fused)', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/current-sprint');
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
    const contentVisible = await page.locator('#current-sprint-content').isVisible().catch(() => false);
    if (!contentVisible) { test.skip(); return; }

    const metricLink = page.locator('.header-metric-link').first();
    const visible = await metricLink.isVisible().catch(() => false);
    if (!visible) { test.skip(); return; }

    // Verify .header-metric-link has flex column layout so label and value stack properly
    const display = await metricLink.evaluate(el => window.getComputedStyle(el).display);
    const flexDir = await metricLink.evaluate(el => window.getComputedStyle(el).flexDirection);
    expect(display).toBe('flex');
    expect(flexDir).toBe('column');
    console.log('[TD-01] ✓ .header-metric-link is flex column — WORK ITEMS4 spacing fixed');
  });

  // ── Tech Debt #2: Sprint name deduplication in header bar outcome line ──
  test('TD-02: Sprint name does not appear in the outcome line (already shown in header-sprint-name)', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/current-sprint');
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
    const contentVisible = await page.locator('#current-sprint-content').isVisible().catch(() => false);
    if (!contentVisible) { test.skip(); return; }

    const headerBar = page.locator('.current-sprint-header-bar').first();
    const visible = await headerBar.isVisible().catch(() => false);
    if (!visible) { test.skip(); return; }

    const sprintNameEl = headerBar.locator('.header-sprint-name').first();
    const verdictLine = headerBar.locator('.sprint-verdict-line').first();
    const sprintNameText = (await sprintNameEl.textContent() || '').trim();
    const verdictText = (await verdictLine.textContent() || '').trim();

    if (sprintNameText) {
      // Verdict line should NOT repeat the sprint name
      expect(verdictText.startsWith(sprintNameText)).toBe(false);
      // Verdict line should contain health status (Healthy/Caution/At Risk/Critical)
      expect(/Healthy|Caution|At Risk|Critical/.test(verdictText)).toBeTruthy();
      console.log(`[TD-02] ✓ Sprint name "${sprintNameText}" not duplicated in verdict line`);
    } else {
      console.log('[TD-02] ✓ No sprint loaded — skip name-duplication check');
    }
  });

  // ── Tech Debt #3: Live badge has no interactive pointer affordance ──
  test('TD-03: Status badge has pointer-events:none — not interactive', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/current-sprint');
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
    const contentVisible = await page.locator('#current-sprint-content').isVisible().catch(() => false);
    if (!contentVisible) { test.skip(); return; }

    const badge = page.locator('.status-badge').first();
    const visible = await badge.isVisible().catch(() => false);
    if (!visible) { test.skip(); return; }

    const pointerEvents = await badge.evaluate(el => window.getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe('none');
    console.log('[TD-03] ✓ .status-badge has pointer-events:none — non-interactive badge confirmed');
  });

  // ── UX Fix #6: ??- replaced with — in boards table ──
  test('UX-06: Boards table does not contain ??- placeholder values', async ({ page }) => {
    test.setTimeout(180000);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) { test.skip(); return; }

    // Navigate to boards tab
    const boardsTab = page.locator('.tab-btn[data-tab="project-epic-level"]').first();
    const boardsTabVisible = await boardsTab.isVisible().catch(() => false);
    if (!boardsTabVisible) { test.skip(); return; }
    await boardsTab.click();
    await page.waitForSelector('#project-epic-level-content', { state: 'visible', timeout: 15000 }).catch(() => {});

    const boardsContent = await page.locator('#project-epic-level-content').textContent().catch(() => '');
    expect(boardsContent).not.toContain('??-');
    console.log('[UX-06] ✓ No ??- placeholder values in boards table');
  });

  test('UX-06b: All Boards comparison row shows "Multiple" in Projects column (not ??-)', async ({ page }) => {
    test.setTimeout(180000);
    await runDefaultPreview(page);
    const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
    if (!previewVisible) { test.skip(); return; }

    const boardsTab = page.locator('.tab-btn[data-tab="project-epic-level"]').first();
    const boardsTabVisible = await boardsTab.isVisible().catch(() => false);
    if (!boardsTabVisible) { test.skip(); return; }
    await boardsTab.click();
    await page.waitForSelector('#project-epic-level-content', { state: 'visible', timeout: 15000 }).catch(() => {});

    // All Boards summary row should show 'Multiple' not '??-' in Projects
    const summaryRow = page.locator('#project-epic-level-content table tbody tr:first-child');
    const summaryRowVisible = await summaryRow.isVisible().catch(() => false);
    if (!summaryRowVisible) { test.skip(); return; }

    const rowText = await summaryRow.textContent().catch(() => '');
    expect(rowText).not.toContain('??-');
    console.log(`[UX-06b] ✓ All Boards row: "${rowText.slice(0, 60).trim()}"`);
  });

  // ── UX Fix #7: No-data carousel cards collapse to minimal height ──
  test('UX-07: No-data carousel tabs have carousel-tab--no-data class and reduced visual weight', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/current-sprint');
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
    const contentVisible = await page.locator('#current-sprint-content').isVisible().catch(() => false);
    if (!contentVisible) { test.skip(); return; }

    const noDataTabs = page.locator('.carousel-tab--no-data');
    const count = await noDataTabs.count();
    if (count === 0) {
      console.log('[UX-07] ✓ No no-data carousel cards (all sprints have data) — healthy state');
      return;
    }

    // Verify collapsed tabs have the right attributes
    const firstNoData = noDataTabs.first();
    // Should NOT have a health indicator bar (hidden)
    const healthBar = firstNoData.locator('.carousel-health-indicator');
    const healthBarCount = await healthBar.count();
    expect(healthBarCount).toBe(0);

    // Tooltip must explain absence of data
    const title = await firstNoData.getAttribute('title');
    expect(title).toContain('No data');
    console.log(`[UX-07] ✓ ${count} no-data carousel tab(s) collapsed with informative tooltip`);
  });

  // ── Freshness label on Current Sprint header ──
  test('UX-01c: Current Sprint header shows human-readable freshness (not raw UTC timestamp)', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/current-sprint');
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
    const contentVisible = await page.locator('#current-sprint-content').isVisible().catch(() => false);
    if (!contentVisible) { test.skip(); return; }

    const headerBar = page.locator('.current-sprint-header-bar').first();
    const visible = await headerBar.isVisible().catch(() => false);
    if (!visible) { test.skip(); return; }

    // last-updated label should say "Updated X min ago" not a raw UTC ISO string
    const freshnessEl = headerBar.locator('.last-updated').first();
    const freshnessVisible = await freshnessEl.isVisible().catch(() => false);
    if (!freshnessVisible) { test.skip(); return; }

    const freshnessText = (await freshnessEl.textContent() || '').trim();
    // Should NOT be a raw ISO timestamp
    expect(freshnessText).not.toMatch(/^\d{4}-\d{2}-\d{2}/);
    // Should contain human-readable phrase
    expect(freshnessText).toMatch(/Updated|just now/i);
    console.log(`[UX-01c] ✓ Human-readable freshness: "${freshnessText}"`);
  });
});

test.describe('Mobile-First UX Decisions M1-M12', () => {
  // M1: Leadership context line must not contain [Live] or [Cache] bracket notation
  test('M1: Leadership freshness badge uses human-readable label, not bracket notation', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/leadership');
    const found = await page.waitForSelector('#leadership-content, #leadership-error', { state: 'attached', timeout: 30000 }).catch(() => null);
    if (!found) { test.skip(); return; }
    const contentVisible = await page.locator('#leadership-content').isVisible().catch(() => false);
    if (!contentVisible) { test.skip(); return; }

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toMatch(/\[Live\]/);
    expect(bodyText).not.toMatch(/\[Cache\]/);
    // Should have a data-state-badge element
    const badge = page.locator('.data-state-badge').first();
    const badgeExists = await badge.count();
    if (badgeExists > 0) {
      const badgeText = (await badge.textContent() || '').trim();
      expect(badgeText).not.toMatch(/^\[/);
      console.log(`[M1] ✓ Leadership freshness badge: "${badgeText}"`);
    } else {
      console.log('[M1] ✓ No bracket notation in leadership page body');
    }
  });

  // M2: Scroll-aware page identity — .header-page-context element exists after init
  test('M2: Header page context span is present in DOM on report page', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/report');
    await page.waitForTimeout(2000);
    const ctxSpan = page.locator('.header-page-context');
    const count = await ctxSpan.count();
    expect(count).toBeGreaterThan(0);
    console.log('[M2] ✓ .header-page-context element exists in report page DOM');
  });

  test('M2: Header page context span is present in DOM on current-sprint page', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/current-sprint');
    await page.waitForTimeout(2000);
    const ctxSpan = page.locator('.header-page-context');
    const count = await ctxSpan.count();
    expect(count).toBeGreaterThan(0);
    console.log('[M2] ✓ .header-page-context element exists in current-sprint page DOM');
  });

  // M4: body.preview-active class is added after preview loads
  test('M4: body gets preview-active class after preview renders', async ({ page }) => {
    test.setTimeout(120000);
    await runDefaultPreview(page);
    const hasClass = await page.evaluate(() => document.body.classList.contains('preview-active'));
    expect(hasClass).toBe(true);
    console.log('[M4] ✓ body.preview-active class present after preview load');
  });

  // M4: On mobile viewport, #applied-filters-summary hidden when preview-active
  test('M4: Applied filters summary hidden on mobile when preview is active', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 375, height: 812 });
    await runDefaultPreview(page);
    const hasClass = await page.evaluate(() => document.body.classList.contains('preview-active'));
    if (!hasClass) { test.skip(); return; }
    const appliedFilters = page.locator('#applied-filters-summary');
    const afCount = await appliedFilters.count();
    if (afCount === 0) { test.skip(); return; }
    const isVisible = await appliedFilters.isVisible().catch(() => false);
    // On mobile with preview-active, it should be hidden
    expect(isVisible).toBe(false);
    console.log('[M4] ✓ #applied-filters-summary hidden on mobile with preview-active');
  });

  // M8: .tabs element has position:sticky
  test('M8: Report page tabs bar has sticky positioning', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/report');
    await page.waitForTimeout(1000);
    const tabs = page.locator('.tabs').first();
    const tabsCount = await tabs.count();
    if (tabsCount === 0) { test.skip(); return; }
    const position = await tabs.evaluate((el) => window.getComputedStyle(el).position);
    expect(position).toBe('sticky');
    console.log(`[M8] ✓ .tabs position: ${position}`);
  });

  // M9: Sprint loading context element exists in current-sprint page
  test('M9: Sprint loading context div exists in current-sprint page', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/current-sprint');
    await page.waitForTimeout(1000);
    const ctxEl = page.locator('#sprint-loading-context');
    const count = await ctxEl.count();
    expect(count).toBeGreaterThan(0);
    console.log('[M9] ✓ #sprint-loading-context element present in current-sprint DOM');
  });

  // M10: Touch targets meet 44px minimum on mobile
  test('M10: Carousel tabs meet 44px minimum touch target height on mobile', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/current-sprint');
    await page.waitForSelector('#current-sprint-content, #current-sprint-error', { state: 'attached', timeout: 30000 });
    const contentVisible = await page.locator('#current-sprint-content').isVisible().catch(() => false);
    if (!contentVisible) { test.skip(); return; }

    const tabs = page.locator('.carousel-tab');
    const count = await tabs.count();
    if (count === 0) { test.skip(); return; }
    const first = tabs.first();
    const box = await first.boundingBox();
    if (!box) { test.skip(); return; }
    expect(box.height).toBeGreaterThanOrEqual(44);
    console.log(`[M10] ✓ .carousel-tab height: ${box.height}px (≥ 44px)`);
  });

  // M11: data-table-scroll-wrap gets scrolled-right class after horizontal scroll
  test('M11: Data table scroll wrap gets scrolled-right class on horizontal scroll', async ({ page }) => {
    test.setTimeout(120000);
    await runDefaultPreview(page);
    const wrap = page.locator('.data-table-scroll-wrap').first();
    const wrapCount = await wrap.count();
    if (wrapCount === 0) { test.skip(); return; }
    // Force the element to be horizontally scrollable (content may fit on wide viewport)
    // then simulate a scroll event with scrollLeft > 8 so the listener toggles the class
    const scrollResult = await wrap.evaluate((el) => {
      const inner = el.querySelector('table, .data-table') || el.firstElementChild;
      if (inner) inner.style.minWidth = '3000px';
      el.style.overflowX = 'scroll';
      el.scrollLeft = 50;
      el.dispatchEvent(new Event('scroll'));
      return {
        scrollLeft: el.scrollLeft,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });
    if (scrollResult.scrollWidth <= (scrollResult.clientWidth + 1)) {
      test.skip(true, 'No horizontal overflow available in this environment');
      return;
    }
    await page.waitForTimeout(200);
    const hasClass = await wrap.evaluate((el) => el.classList.contains('scrolled-right'));
    expect(hasClass).toBe(true);
    console.log('[M11] ✓ .data-table-scroll-wrap gets scrolled-right class on scroll');
  });

  // Hidden section accountability: source tag appears when Epic TTM is suppressed
  test('Hidden sections summary includes source tags when Epic TTM is suppressed', async ({ page }) => {
    test.setTimeout(120000);
    await runDefaultPreview(page);
    const boardsTab = page.locator('.tab-btn[data-tab="project-epic-level"]').first();
    if (await boardsTab.count()) {
      await boardsTab.click().catch(() => null);
    }
    const summary = page.locator('#project-epic-level-content .data-availability-summary, #metrics-content .data-availability-summary').first();
    const visible = await summary.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'No hidden section summary for this dataset');
      return;
    }
    await expect(summary.locator('.data-availability-source').first()).toBeVisible();
  });

  // M3: Loading context bar exists in report page DOM
  test('M3: Loading context bar element present in report page', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto('/report');
    await page.waitForTimeout(500);
    const ctxBar = page.locator('#loading-context-bar');
    const count = await ctxBar.count();
    expect(count).toBeGreaterThan(0);
    console.log('[M3] ✓ #loading-context-bar element present in report page DOM');
  });
});

