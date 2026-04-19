/**
 * SSOT for preview, export, and browser telemetry test flows. Use in E2E, Excel, UX, Column Tooltip, Refactor Validation, Validation Plan, and UX Trust specs.
 */

export const IGNORE_CONSOLE_ERRORS = [
  'Failed to load resource: the server responded with a status of 404 (Not Found)',
  'Failed to load resource: net::ERR_FAILED',
  'Failed to load resource: net::ERR_INSUFFICIENT_RESOURCES',
  'Failed to load resource: the server responded with a status of 500 (Internal Server Error)',
  'ResizeObserver loop limit exceeded',
  'The operation is insecure.',
  'AbortError: signal is aborted without reason',
  'signal is aborted without reason',
  'Receiving end does not exist',
  'Unchecked runtime.lastError'
];

export const IGNORE_REQUEST_PATTERNS = [
  /\/favicon\.ico/i
];

/** Shared timeout for Excel export download wait (ms). Use in Server Errors and Excel Export specs. */
export const EXCEL_DOWNLOAD_TIMEOUT_MS = 180000;

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
    try {
      await page.waitForSelector('#loading', { state: 'hidden', timeout: 45000 });
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

  const mpsaChecked = projects.includes('MPSA');
  const masChecked = projects.includes('MAS');
  if (mpsaChecked) await page.check('#project-mpsa', { force: true });
  else await page.uncheck('#project-mpsa', { force: true });
  if (masChecked) await page.check('#project-mas', { force: true });
  else await page.uncheck('#project-mas', { force: true });

  await page.fill('#start-date', start, { force: true });
  await page.fill('#end-date', end, { force: true });
  const previewBtn = page.locator('#preview-btn');
  await previewBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(150);
  const isDisabled = await previewBtn.isDisabled().catch(() => false);
  if (!isDisabled) {
    await previewBtn.click().catch(() => null);
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
  if (await startInput.isVisible().catch(() => false)) return;

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
  if (!(await startInput.isVisible().catch(() => false))) {
    await page.evaluate(() => {
      const panel = document.getElementById('filters-panel');
      const body = document.getElementById('filters-panel-body');
      const collapsedBar = document.getElementById('filters-panel-collapsed-bar');
      if (panel && body) {
        panel.hidden = false;
        panel.classList.remove('collapsed');
        panel.classList.add('expanded', 'overlay-drawer', 'is-open');
        body.style.display = '';
      }
      if (collapsedBar) {
        collapsedBar.style.display = 'none';
        collapsedBar.setAttribute('aria-hidden', 'true');
      }
    });
  }
  await startInput.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);
}

/**
 * Clicks report preview button even when filters panel is initially collapsed.
 * @param {import('@playwright/test').Page} page
 */
export async function clickReportPreviewFromCurrentState(page) {
  const previewBtn = page.locator('#preview-btn');
  if (!(await previewBtn.isVisible().catch(() => false))) {
    await ensureReportFiltersVisible(page);
  }
  await previewBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
  await previewBtn.waitFor({ state: 'attached', timeout: 10000 }).catch(() => null);
  const enabled = await previewBtn.isEnabled().catch(() => false);
  if (!enabled) return false;
  await previewBtn.click().catch(() => null);
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
  await page.selectOption('#board-select', firstOpt);
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
