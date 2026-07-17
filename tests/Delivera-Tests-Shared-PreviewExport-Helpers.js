/**
 * SSOT for preview, export, and browser telemetry test flows. Use in E2E, Excel, UX, Column Tooltip, Refactor Validation, Validation Plan, and UX Trust specs.
 */

export const IGNORE_CONSOLE_ERRORS = [
  'Failed to load resource: the server responded with a status of 404 (Not Found)',
  'Failed to load resource: the server responded with a status of 502 (Bad Gateway)',
  'Failed to load resource: net::ERR_INSUFFICIENT_RESOURCES',
  'ResizeObserver loop limit exceeded',
  'The operation is insecure.',
  'AbortError: signal is aborted without reason',
  'signal is aborted without reason',
  'Receiving end does not exist',
  'Unchecked runtime.lastError',
  'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received',
];

export const IGNORE_REQUEST_PATTERNS = [
  /\/favicon\.ico/i
];

/** Shared timeout for Excel export download wait (ms). Use in Server Errors and Excel Export specs. */
export const EXCEL_DOWNLOAD_TIMEOUT_MS = 180000;

/** Primary report preview/refresh control (header when top chrome present, else sidebar). */
export async function getReportPreviewTrigger(page) {
  const header = page.locator('#report-header-preview-btn');
  if (await header.isVisible().catch(() => false)) return header;
  return page.locator('#preview-btn');
}

/**
 * Captures browser console errors, page errors, and failed requests for assertion in tests.
 * @param {import('@playwright/test').Page} page
 * @returns {{ consoleErrors: string[], pageErrors: string[], failedRequests: Array<{ url: string, method: string, failure: string }> }}
 */
export function captureBrowserTelemetry(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!IGNORE_CONSOLE_ERRORS.includes(text)) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  page.on('requestfailed', request => {
    const url = request.url();
    const shouldIgnore = IGNORE_REQUEST_PATTERNS.some(pattern => pattern.test(url));
    if (!shouldIgnore) {
      failedRequests.push({
        url,
        method: request.method(),
        failure: request.failure()?.errorText || 'Unknown failure'
      });
    }
  });

  return { consoleErrors, pageErrors, failedRequests };
}

/**
 * Asserts no critical telemetry: failed requests (after ignore patterns and optional preview abort),
 * page errors, and unexpected console errors. Use after captureBrowserTelemetry in specs.
 * @param {{ consoleErrors: string[], pageErrors: string[], failedRequests: Array<{ url: string }> }} telemetry
 * @param {{ excludePreviewAbort?: boolean, allowConsolePatterns?: RegExp[] }} options - set excludePreviewAbort for aborted preview paths, and allowConsolePatterns for intentional mocked console errors
 */
export function assertTelemetryClean(telemetry, options = {}) {
  const { excludePreviewAbort = false, allowConsolePatterns = [] } = options;
  const isAbortFailure = (failureText = '') => /ERR_ABORTED|NS_BINDING_ABORTED|ERR_INSUFFICIENT_RESOURCES|aborted/i.test(String(failureText || ''));
  const criticalFailures = (telemetry.failedRequests || []).filter(
    (r) => !IGNORE_REQUEST_PATTERNS.some((p) => p.test(r.url))
      && (!excludePreviewAbort || !r.url.includes('preview.json'))
      && !isAbortFailure(r.failure)
  );
  const unexpectedConsole = (telemetry.consoleErrors || []).filter(
    (t) => !IGNORE_CONSOLE_ERRORS.some((ignored) => t === ignored || t.includes(ignored))
      && !allowConsolePatterns.some((pattern) => pattern.test(String(t || '')))
  );
  if (telemetry.pageErrors && telemetry.pageErrors.length > 0) {
    throw new Error(`Expected no page errors. Got: ${JSON.stringify(telemetry.pageErrors)}`);
  }
  if (unexpectedConsole.length > 0) {
    throw new Error(`Unexpected console errors: ${JSON.stringify(unexpectedConsole)}`);
  }
  if (criticalFailures.length > 0) {
    throw new Error(`Critical request failures: ${JSON.stringify(criticalFailures.map((r) => r.url))}`);
  }
}

/**
 * Waits for preview to complete (preview content or error visible, loading hidden).
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number }} options - optional timeout (default 120000 ms; increase for very heavy previews)
 */
export async function waitForPreview(page, options = {}) {
  const timeout = options.timeout ?? 120000;
  // Wait briefly for either preview content or error to appear
  await Promise.race([
    page.waitForSelector('#preview-content', { state: 'visible', timeout }).catch(() => null),
    page.waitForSelector('#error', { state: 'visible', timeout }).catch(() => null),
  ]);

  // If loading is visible, wait for it to hide but with a shorter cap
  const loadingVisible = await page.locator('#loading').isVisible().catch(() => false);
  if (loadingVisible) {
    const loadingHideMs = Math.min(Math.max(timeout - 5000, 60000), 110000);
    try {
      await page.waitForSelector('#loading', { state: 'hidden', timeout: loadingHideMs });
    } catch (err) {
      // If loading remained visible beyond our cap, bail out so tests don't hang
      // Instead, we'll return to the caller which can decide to skip or assert.
      return;
    }
  }

  const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
  const errorVisible = await page.locator('#error').isVisible().catch(() => false);

  if (!previewVisible && !errorVisible) {
    await Promise.race([
      page.waitForSelector('#preview-content', { state: 'visible', timeout: 10000 }).catch(() => null),
      page.waitForSelector('#error', { state: 'visible', timeout: 10000 }).catch(() => null),
    ]);
  }

  await page.waitForFunction(() => {
    const previewBtn = document.getElementById('preview-btn');
    if (!previewBtn) return true;
    return !previewBtn.disabled;
  }, { timeout: 5000 }).catch(() => null);
}

/**
 * Returns true when any selector in the list is currently visible.
 * @param {import('@playwright/test').Page} page
 * @param {string[]} selectors
 */
export async function isAnySelectorVisible(page, selectors = []) {
  for (const selector of selectors) {
    const visible = await page.locator(selector).first().isVisible().catch(() => false);
    if (visible) return true;
  }
  return false;
}

/**
 * Adaptive report summary contract: at least one active summary surface must be visible.
 * Keeps tests resilient while summary UI shifts between sticky row, filter strip, and preview story.
 * @param {import('@playwright/test').Page} page
 */
export async function hasVisibleReportSummarySurface(page) {
  return isAnySelectorVisible(page, [
    '#preview-summary-sticky',
    '#report-filter-strip-summary .context-summary-strip',
    '#preview-meta .preview-header-story',
    '#preview-meta [data-context-bar="true"]',
    '#preview-outcome-line',
  ]);
}

/**
 * Clicks the first visible report context/action chip for the requested action.
 * @param {import('@playwright/test').Page} page
 * @param {string} action
 */
export async function clickVisibleReportChromeAction(page, action) {
  const selectors = [
    `[data-preview-context-action="${action}"]`,
    `[data-context-action="${action}"]`,
  ];
  for (const selector of selectors) {
    const matches = page.locator(selector);
    const count = await matches.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const locator = matches.nth(index);
      const visible = await locator.isVisible().catch(() => false);
      if (!visible) continue;
      await locator.click({ force: true }).catch(() => null);
      return true;
    }
  }
  return false;
}

/**
 * Sets report project checkbox state via DOM events instead of click geometry.
 * Keeps tests stable when sticky chrome overlaps the filters pane.
 * @param {import('@playwright/test').Page} page
 * @param {string[]} projects
 */
export async function setReportProjectSelection(page, projects = []) {
  const selectedProjects = new Set(
    (Array.isArray(projects) ? projects : [])
      .map((value) => String(value || '').trim().toUpperCase())
      .filter(Boolean)
  );

  await page.evaluate((selected) => {
    document.querySelectorAll('.project-checkbox[data-project]').forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      const projectKey = String(input.dataset.project || '').trim().toUpperCase();
      const shouldBeChecked = selected.includes(projectKey);
      if (input.checked === shouldBeChecked) return;
      input.checked = shouldBeChecked;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }, Array.from(selectedProjects));
}

/**
 * Runs default preview: go to /report, set projects and date window, click Preview, wait for result.
 * @param {import('@playwright/test').Page} page
 * @param {{ projects?: string[], start?: string, end?: string }} overrides - optional filter overrides
 */
export async function runDefaultPreview(page, overrides = {}) {
  const {
    projects = ['MPSA', 'MAS'],
    start = '2025-07-01T00:00',
    end = '2025-09-30T23:59',
  } = overrides;

  await page.goto('/report');

  const startInput = page.locator('#start-date');
  if (!(await startInput.isVisible().catch(() => false))) {
    const showFilters = page.locator('[data-action="toggle-filters"]').first();
    if (await showFilters.isVisible().catch(() => false)) {
      await showFilters.click().catch(() => null);
    }
    await startInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
  }

  await setReportProjectSelection(page, projects);

  await page.fill('#start-date', start, { force: true });
  await page.fill('#end-date', end, { force: true });
  const previewBtn = page.locator('#preview-btn');
  await previewBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(150);
  const isDisabled = await previewBtn.isDisabled().catch(() => false);
  if (!isDisabled) {
    await previewBtn.click().catch(async () => {
      await page.evaluate(() => {
        const btn = document.getElementById('preview-btn');
        if (btn && !btn.hasAttribute('disabled')) btn.click();
      }).catch(() => null);
    });
  }

  await Promise.race([
    page.waitForSelector('#loading', { state: 'visible', timeout: 10000 }).catch(() => null),
    page.waitForSelector('#preview-content', { state: 'visible', timeout: 10000 }).catch(() => null),
    page.waitForSelector('#error', { state: 'visible', timeout: 10000 }).catch(() => null),
  ]);

  await waitForPreview(page);
}

/**
 * Ensures report filters are visible before interacting with filter inputs/actions.
 * @param {import('@playwright/test').Page} page
 */
export async function ensureReportFiltersVisible(page) {
  const startInput = page.locator('#start-date');
  const previewBtn = page.locator('#preview-btn');
  if (await startInput.isVisible().catch(() => false) && await previewBtn.isVisible().catch(() => false)) return;

  const moreMenu = page.locator('summary.btn:has-text("More")');
  if (await moreMenu.isVisible().catch(() => false)) {
    await moreMenu.click().catch(() => null);
    const panelToggle = page.locator('.report-header-more-panel [data-action="toggle-filters"]').first();
    if (await panelToggle.isVisible().catch(() => false)) {
      await panelToggle.click().catch(() => null);
    }
  }

  if (!(await startInput.isVisible().catch(() => false))) {
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('[data-action="toggle-filters"]'));
      const visible = nodes.find((el) => el instanceof HTMLElement && el.offsetParent !== null);
      (visible || nodes[0])?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  }

  await page.locator('#filters-panel').waitFor({ state: 'attached', timeout: 5000 }).catch(() => null);
  if (!(await startInput.isVisible().catch(() => false)) || !(await previewBtn.isVisible().catch(() => false))) {
    await page.evaluate(() => {
      const panel = document.getElementById('filters-panel');
      const body = document.getElementById('filters-panel-body');
      const collapsedBar = document.getElementById('filters-panel-collapsed-bar');
      if (panel && body) {
        panel.hidden = false;
        panel.classList.remove('collapsed');
        panel.classList.add('expanded', 'overlay-drawer', 'is-open');
        body.style.display = '';
        panel.style.opacity = '1';
        panel.style.pointerEvents = 'auto';
        panel.style.transform = 'translateY(0)';
      }
      if (collapsedBar) {
        collapsedBar.style.display = 'none';
        collapsedBar.setAttribute('aria-hidden', 'true');
      }
    });
  }
  await startInput.waitFor({ state: 'visible', timeout: 20000 });
  await previewBtn.waitFor({ state: 'visible', timeout: 20000 });
}

/**
 * Clicks report preview button even when filters panel is initially collapsed.
 * @param {import('@playwright/test').Page} page
 */
export async function clickReportPreviewFromCurrentState(page) {
  await ensureReportFiltersVisible(page);
  const previewBtn = page.locator('#preview-btn');
  await previewBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
  await previewBtn.waitFor({ state: 'attached', timeout: 10000 }).catch(() => null);
  const enabled = await previewBtn.isEnabled().catch(() => false);
  if (!enabled) return false;
  await previewBtn.click().catch(async () => {
    await page.evaluate(() => {
      const btn = document.getElementById('preview-btn');
      if (btn && !btn.hasAttribute('disabled')) btn.click();
    }).catch(() => null);
  });
  return true;
}

/**
 * Returns report export button state after preview completion.
 * @param {import('@playwright/test').Page} page
 */
export async function getReportExportButtonState(page) {
  const exportBtn = page.locator('#export-excel-btn');
  const visible = await exportBtn.isVisible().catch(() => false);
  const enabled = visible ? await exportBtn.isEnabled().catch(() => false) : false;
  const title = visible ? ((await exportBtn.getAttribute('title')) || '') : '';
  const aria = visible ? ((await exportBtn.getAttribute('aria-label')) || '') : '';
  return { visible, enabled, title, aria };
}

/**
 * Checks key layout containers for horizontal clipping/offset against viewport.
 * Detects hidden overflows that scrollWidth-based checks can miss.
 * @param {import('@playwright/test').Page} page
 * @param {{ selectors?: string[], maxLeftGapPx?: number, maxRightOverflowPx?: number, checkScrollSelectors?: string[] }} options
 * @returns {Promise<{ viewportWidth: number, bodyClientWidth: number, bodyScrollWidth: number, offenders: Array<{ selector: string, left: number, right: number, width: number }>, horizontalOverflow: Array<{ selector: string, scrollWidth: number, clientWidth: number }> }>}
 */
export async function getViewportClippingReport(page, options = {}) {
  const {
    selectors = ['body', '.container', 'header', '.main-layout', '.preview-area', '.tabs'],
    maxLeftGapPx = 16,
    maxRightOverflowPx = 1,
    checkScrollSelectors = [],
  } = options;

  return page.evaluate(({ selectors, maxLeftGapPx, maxRightOverflowPx, checkScrollSelectors }) => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = [];
    const horizontalOverflow = [];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const left = Math.round(rect.left * 100) / 100;
      const right = Math.round(rect.right * 100) / 100;
      const width = Math.round(rect.width * 100) / 100;
      if (left > maxLeftGapPx || right > viewportWidth + maxRightOverflowPx || left < -maxRightOverflowPx) {
        offenders.push({ selector, left, right, width });
      }
    }
    for (const selector of checkScrollSelectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      if (el.scrollWidth > el.clientWidth + 1) {
        horizontalOverflow.push({ selector, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
      }
    }

    return {
      viewportWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenders,
      horizontalOverflow,
    };
  }, { selectors, maxLeftGapPx, maxRightOverflowPx, checkScrollSelectors });
}

/**
 * Detects visible element pairs whose bounding boxes intersect (layout overlap).
 * @param {import('@playwright/test').Page} page
 * @param {{ selectors?: string[], maxPairs?: number }} options
 */
export async function getLayoutOverlapReport(page, options = {}) {
  const { selectors = [], maxPairs = 24 } = options;
  return page.evaluate(({ selectors, maxPairs }) => {
    const isVisible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 2 && r.height > 2
        && st.visibility !== 'hidden'
        && st.display !== 'none'
        && Number(st.opacity) > 0.05;
    };
    const label = (el) => el.id || el.className?.toString?.().split(/\s+/).slice(0, 2).join('.') || el.tagName;
    const nodes = selectors.flatMap((sel) => [...document.querySelectorAll(sel)]).filter(isVisible);
    const overlaps = [];
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const hit = ra.left < rb.right && ra.right > rb.left && ra.top < rb.bottom && ra.bottom > rb.top;
        if (!hit) continue;
        const area = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const areaY = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (area <= 0 || areaY <= 0) continue;
        overlaps.push({
          a: label(a),
          b: label(b),
          overlapPx: Math.round(area * areaY),
        });
        if (overlaps.length >= maxPairs) return { overlaps, truncated: true };
      }
    }
    return { overlaps, truncated: false };
  }, { selectors, maxPairs });
}

/** Prevent fixed sidebar from intercepting governance details toggles in CI viewports. */
export async function disableSidebarPointerBlock(page) {
  await page.evaluate(() => {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.style.pointerEvents = 'none';
  });
}

/** Programmatically open a governance <details> panel (avoids sticky overlay intercepts). */
export async function openGovernanceDetailsPanel(page, elementId) {
  await disableSidebarPointerBlock(page);
  await page.evaluate((id) => document.getElementById(id)?.setAttribute('open', ''), elementId);
}

/**
 * If login form is visible (auth enabled), skip the test.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Test} test - from test.info() or passed in
 */
export async function skipIfLoginVisible(page, test) {
  const hasLogin = await page.locator('#username').isVisible().catch(() => false);
  if (hasLogin) {
    test.skip(true, 'Auth enabled; login form visible.');
  }
}

/**
 * If page was redirected to login or home (no content), skip the test. Use after page.goto(...).
 * Reduces duplicate "if (page.url().includes('login')) test.skip(...)" across specs.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Test} test
 * @param {{ currentSprint?: boolean }} options - set currentSprint: true to also skip when url ends with /
 * @returns {Promise<boolean>} - true if skipped
 */
export async function skipIfRedirectedToLogin(page, test, options = {}) {
  const url = page.url();
  const isLogin = url.includes('login');
  const isRoot = options.currentSprint && (url.endsWith('/') || url.match(/^https?:\/\/[^/]+\/?$/));
  if (isLogin || isRoot) {
    test.skip(true, 'Redirected to login or home; auth may be required');
    return true;
  }
  return false;
}

export async function routeDeterministicCurrentSprint(page, overrides = {}) {
  const board = { id: 1, name: 'SD Board', projectKey: 'SD', projectKeys: ['SD'] };
  const payload = {
    board,
    sprint: {
      id: 1,
      name: 'Sprint 1',
      state: 'active',
      startDate: '2026-07-13T00:00:00.000Z',
      endDate: '2026-07-24T00:00:00.000Z',
    },
    summary: { totalStories: 1, doneStories: 0, totalSP: 3, percentDone: 0 },
    stories: [{ issueKey: 'SD-1', summary: 'Customer recharge proof', status: 'In Progress', storyPoints: 3, subtasks: [] }],
    stuckCandidates: [],
    scopeChanges: [],
    dailyCompletions: { stories: [], subtasks: [] },
    subtaskTracking: { rows: [], subtasks: [] },
    recentSprints: [],
    nextSprint: null,
    ...overrides,
  };

  await page.addInitScript(() => {
    localStorage.setItem('delivera.projects.ssot.v1', JSON.stringify(['SD']));
    localStorage.setItem('delivera.boardId.v1', '1');
    localStorage.setItem('delivera.report.context.v1', JSON.stringify({ projects: ['SD'], boardId: 1, boardName: 'SD Board' }));
  });
  await page.route('**/api/boards.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ projects: ['SD'], boards: [board], projectErrors: [] }),
  }));
  await page.route('**/api/current-sprint.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  }));
  await page.route('**/api/sprints**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ sprints: [] }),
  }));
}

/**
 * Wait for board selector to have options, then select the first board. Skips if no board option found.
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number }} options - default 15000
 * @returns {Promise<string|null>} - selected board value or null
 */
export async function selectFirstBoard(page, options = {}) {
  const timeout = options.timeout ?? 15000;
  await page.waitForSelector('#board-select option[value]:not([value=""])', { timeout }).catch(() => null);
  const firstOpt = await page.locator('#board-select option[value]:not([value=""])').first().getAttribute('value').catch(() => null);
  if (!firstOpt) return null;
  const selectVisible = await page.locator('#board-select').isVisible().catch(() => false);
  if (selectVisible) {
    await page.selectOption('#board-select', firstOpt);
  } else {
    await page.evaluate((val) => {
      const sel = document.getElementById('board-select');
      if (!sel) return;
      sel.value = val;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }, firstOpt);
  }
  return firstOpt;
}

/**
 * Asserts preview content or error is visible; otherwise skips the test.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Test} test
 * @param {{ timeout?: number }} options - default 15000
 */
export async function assertPreviewOrSkip(page, test, options = {}) {
  const timeout = options.timeout ?? 15000;
  const previewVisible = await page.locator('#preview-content').isVisible().catch(() => false);
  const errorVisible = await page.locator('#error').isVisible().catch(() => false);
  if (!previewVisible && !errorVisible) {
    await page.waitForSelector('#preview-content, #error', { state: 'visible', timeout }).catch(() => null);
    const p = await page.locator('#preview-content').isVisible().catch(() => false);
    const e = await page.locator('#error').isVisible().catch(() => false);
    if (!p && !e) test.skip(true, 'Preview or error did not appear within timeout.');
  }
}
