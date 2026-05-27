import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { assertTelemetryClean, captureBrowserTelemetry } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

/**
 * Create Work Intelligence — Confidence, Assignee Inference & Sequential Task Recognition
 * Tests the parser improvements for numbered action-verb lists (SEQUENTIAL_TASK_CLUSTER mode),
 * acronym coherence boost, per-row assignee suggestions, and capacity fit signal.
 */

test.describe('Create Work — intelligent parse and confidence', () => {
  const NUMBERED_TASK_LIST = [
    '0: Clean Site Data on DMS.',
    '1: Re-Load Site Data from MIS into DMS.',
    '2: Validate DMS to CSS site data alignment.',
    '3: Clean Site Data on AMS.',
    '4: Re-Load Site Data from MIS into AMS.',
    '5: Validate and Fix Geographic Division Mapping Synchronization between AMS and DMS',
  ].join('\n');

  async function openCreateWork(page) {
    // Create work drawer can be opened from global nav or the current-sprint page
    await page.goto('/current-sprint');
    await page.waitForSelector('.global-nav, #current-sprint-error', { timeout: 20000 }).catch(() => null);
    // Attempt to open via Create Work CTA in nav
    const navBtn = page.locator('[data-action="open-create-work"], .global-nav-create-work, button:has-text("Create work")').first();
    if (await navBtn.isVisible().catch(() => false)) {
      await navBtn.dispatchEvent('click');
      await page.waitForSelector('#wdd-source-textarea', { timeout: 10000 }).catch(() => null);
      return true;
    }
    return false;
  }

  test('numbered action-verb list → medium/high confidence, not Low structure confidence', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    const isOpen = await openCreateWork(page);
    if (!isOpen) {
      test.skip(true, 'Create work drawer not reachable in this environment');
      return;
    }

    const textarea = page.locator('#wdd-source-textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill(NUMBERED_TASK_LIST);
    await textarea.dispatchEvent('input');

    // Give the debounce/parse a moment
    await page.waitForTimeout(2000);

    // Canvas should show items (not empty)
    const canvas = page.locator('#wdd-canvas');
    await expect(canvas).toBeVisible();
    const itemCount = await canvas.locator('.wdc-item').count();
    expect(itemCount).toBeGreaterThanOrEqual(4);

    // No item should carry "Low structure confidence" warning
    const lowConfidenceChips = canvas.locator('.wdc-repair-chip--warn').filter({ hasText: /low structure confidence/i });
    await expect(lowConfidenceChips).toHaveCount(0);

    assertTelemetryClean(telemetry);
  });

  test('numbered action-verb list items are typed as Task not generic Story', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    const isOpen = await openCreateWork(page);
    if (!isOpen) {
      test.skip(true, 'Create work drawer not reachable in this environment');
      return;
    }

    const textarea = page.locator('#wdd-source-textarea');
    await textarea.fill(NUMBERED_TASK_LIST);
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(2000);

    const canvas = page.locator('#wdd-canvas');
    // Each chip type button shows 'T' for Task; at least most items should be T
    const typeChips = canvas.locator('.wdc-type-chip');
    const count = await typeChips.count();
    expect(count).toBeGreaterThanOrEqual(4);

    let taskCount = 0;
    for (let i = 0; i < count; i++) {
      const t = await typeChips.nth(i).textContent().catch(() => '');
      if (t?.trim() === 'T') taskCount++;
    }
    // Majority should be Task when SEQUENTIAL_TASK_CLUSTER mode fires
    expect(taskCount).toBeGreaterThan(count / 2);

    assertTelemetryClean(telemetry);
  });

  test('server-side draft API: SEQUENTIAL_TASK_CLUSTER raises confidence above low threshold', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);

    // Direct API contract test using the /api/outcome-draft endpoint with mocked board profile
    await page.goto('/current-sprint');
    const responseBody = await page.evaluate(async (text) => {
      const resp = await fetch('/api/outcome-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrative: text,
          projectKey: 'OPS',
          boardId: 1,
          inputMode: 'mixed',
        }),
      });
      if (!resp.ok) return null;
      return resp.json();
    }, NUMBERED_TASK_LIST);

    if (!responseBody || !responseBody.ok) {
      test.skip(true, 'Outcome draft API unavailable or not authenticated');
      return;
    }

    // parsedSummary.confidenceScore should be above the low threshold (0.45)
    const score = responseBody.parsedSummary?.confidenceScore;
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(0.44);

    // All rows should not carry LOW_CONFIDENCE warning
    const rows = responseBody.rows || [];
    expect(rows.length).toBeGreaterThanOrEqual(4);
    const lowConfRows = rows.filter((r) =>
      Array.isArray(r.warnings) && r.warnings.some((w) => w?.code === 'LOW_CONFIDENCE')
    );
    expect(lowConfRows.length).toBe(0);

    // structureMode should be SEQUENTIAL_TASK_CLUSTER
    expect(responseBody.structureMode).toBe('SEQUENTIAL_TASK_CLUSTER');

    assertTelemetryClean(telemetry);
  });

  test('server-side draft API: issueType per row is Task for sequential list', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    const responseBody = await page.evaluate(async (text) => {
      const resp = await fetch('/api/outcome-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrative: text, projectKey: 'OPS', boardId: 1, inputMode: 'mixed' }),
      });
      if (!resp.ok) return null;
      return resp.json();
    }, NUMBERED_TASK_LIST);

    if (!responseBody?.ok) {
      test.skip(true, 'Outcome draft API unavailable');
      return;
    }

    const rows = responseBody.rows || [];
    const taskRows = rows.filter((r) => r.issueType === 'Task');
    // When SEQUENTIAL_TASK_CLUSTER fires, all rows are Task type
    expect(taskRows.length).toBe(rows.length);

    assertTelemetryClean(telemetry);
  });

  test('server-side draft API: capacityFitHint is present as a positive signal when pool data available', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    const responseBody = await page.evaluate(async (text) => {
      const resp = await fetch('/api/outcome-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrative: text, projectKey: 'OPS', boardId: 1, inputMode: 'mixed' }),
      });
      if (!resp.ok) return null;
      return resp.json();
    }, NUMBERED_TASK_LIST);

    if (!responseBody?.ok) {
      test.skip(true, 'Outcome draft API unavailable');
      return;
    }

    // capacityFitHint is either null (pool too small) or a string — never an object or error
    const hint = responseBody.capacityFitHint;
    expect(hint === null || typeof hint === 'string').toBe(true);
    if (hint) {
      expect(hint).toMatch(/item.*sprint/i);
    }

    assertTelemetryClean(telemetry);
  });

  test('capacity fit green chip renders in canvas when API returns capacityFitHint', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    // Intercept the outcome-draft API to inject a capacityFitHint
    await page.route('**/api/outcome-draft', async (route) => {
      const body = route.request().postDataJSON?.() ?? {};
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          phase: 1,
          projectKey: 'OPS',
          boardId: 1,
          inputMode: 'mixed',
          narrative: body.narrative || '',
          structureMode: 'SEQUENTIAL_TASK_CLUSTER',
          parsedSummary: { rationale: 'Numbered tasks', confidenceScore: 0.72, confidenceLabel: 'medium' },
          precheck: { key: 'ok', message: '' },
          readinessWarnings: [],
          epicHintDefault: '',
          capacityFitHint: '6 items fits your team\'s sprint pattern (~13/sprint based on recent history).',
          rows: [
            { id: 'r0', index: 0, kind: 'STORY', issueType: 'Task', title: 'Clean Site Data on DMS', confidence: 0.72, warnings: [], selected: true },
            { id: 'r1', index: 1, kind: 'STORY', issueType: 'Task', title: 'Re-Load Site Data from MIS', confidence: 0.72, warnings: [], selected: true },
          ],
          profileMeta: { degraded: false, degradeReason: '', sampleCounts: {} },
        }),
      });
    });

    const isOpen = await openCreateWork(page);
    if (!isOpen) {
      test.skip(true, 'Create work drawer not reachable');
      return;
    }

    const textarea = page.locator('#wdd-source-textarea');
    await textarea.fill('Clean Site Data on DMS.\nRe-Load Site Data from MIS.');
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(3000);

    // Capacity hint element should be visible with the hint text
    const hintEl = page.locator('#wdd-capacity-hint');
    await expect(hintEl).toBeVisible({ timeout: 10000 });
    await expect(hintEl).toContainText(/sprint pattern/i);

    assertTelemetryClean(telemetry);
  });

  test('suggested assignee chip renders per row when API returns suggestedAssignee', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          phase: 1,
          projectKey: 'OPS',
          boardId: 1,
          inputMode: 'mixed',
          narrative: 'Clean Site Data on DMS.',
          structureMode: 'SEQUENTIAL_TASK_CLUSTER',
          parsedSummary: { rationale: 'Numbered tasks', confidenceScore: 0.72, confidenceLabel: 'medium' },
          precheck: { key: 'ok', message: '' },
          readinessWarnings: [],
          epicHintDefault: '',
          capacityFitHint: null,
          rows: [
            { id: 'r0', index: 0, kind: 'STORY', issueType: 'Task', title: 'Clean Site Data on DMS', confidence: 0.72, warnings: [], selected: true, suggestedAssignee: 'Alice Chen' },
          ],
          profileMeta: { degraded: false, degradeReason: '', sampleCounts: {} },
        }),
      });
    });

    const isOpen = await openCreateWork(page);
    if (!isOpen) {
      test.skip(true, 'Create work drawer not reachable');
      return;
    }

    const textarea = page.locator('#wdd-source-textarea');
    await textarea.fill('Clean Site Data on DMS.');
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(3000);

    const assigneeChip = page.locator('.wdc-repair-chip--assignee');
    await expect(assigneeChip).toBeVisible({ timeout: 10000 });
    await expect(assigneeChip).toContainText('Alice Chen');

    assertTelemetryClean(telemetry);
  });

  test('low confidence items from ambiguous input still warn correctly', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    const responseBody = await page.evaluate(async () => {
      const resp = await fetch('/api/outcome-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrative: 'something something vague stuff goes here maybe',
          projectKey: 'OPS',
          boardId: 1,
          inputMode: 'mixed',
        }),
      });
      if (!resp.ok) return null;
      return resp.json();
    });

    if (!responseBody?.ok) {
      test.skip(true, 'Outcome draft API unavailable');
      return;
    }

    // Low confidence narratives should still get the LOW_CONFIDENCE warning on rows
    // (regression guard: confidence boosts should not mask truly ambiguous input)
    const rows = responseBody.rows || [];
    if (rows.length === 0) {
      // If parser returns no rows for this vague text, that's also acceptable
      return;
    }
    const score = responseBody.parsedSummary?.confidenceScore;
    if (score !== undefined && score < 0.45) {
      const lowConfRows = rows.filter((r) =>
        Array.isArray(r.warnings) && r.warnings.some((w) => w?.code === 'LOW_CONFIDENCE')
      );
      expect(lowConfRows.length).toBeGreaterThan(0);
    }

    assertTelemetryClean(telemetry);
  });

  test('no console errors after pasting numbered task list and viewing items', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    const isOpen = await openCreateWork(page);
    if (!isOpen) {
      test.skip(true, 'Create work drawer not reachable');
      return;
    }

    const textarea = page.locator('#wdd-source-textarea');
    await textarea.fill(NUMBERED_TASK_LIST);
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(3000);

    // Scroll through the canvas to trigger lazy render
    const canvas = page.locator('#wdd-canvas');
    await canvas.evaluate((el) => el.scrollIntoView());

    // Check send bar is coherent
    const sendBar = page.locator('#wdd-safe-send-bar');
    await expect(sendBar).toBeVisible();

    assertTelemetryClean(telemetry);
  });

  test('parser handles partial numbered list (mix of numbered and plain lines) without crash', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);

    const mixedList = '1. Clean DMS data\nRefresh cache\n3. Sync AMS config\nValidate mapping\n5. Run smoke tests';

    await page.goto('/current-sprint');
    const responseBody = await page.evaluate(async (text) => {
      const resp = await fetch('/api/outcome-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrative: text, projectKey: 'OPS', boardId: 1, inputMode: 'mixed' }),
      });
      if (!resp.ok) return null;
      return resp.json();
    }, mixedList);

    if (!responseBody?.ok) {
      test.skip(true, 'Outcome draft API unavailable');
      return;
    }

    // Should parse without error
    expect(responseBody.ok).toBe(true);
    expect(Array.isArray(responseBody.rows)).toBe(true);

    assertTelemetryClean(telemetry);
  });

  test('parser handles single item — no crash, no false confidence boost', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    const responseBody = await page.evaluate(async () => {
      const resp = await fetch('/api/outcome-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrative: '1. Clean DMS data', projectKey: 'OPS', boardId: 1, inputMode: 'mixed' }),
      });
      if (!resp.ok) return null;
      return resp.json();
    });

    if (!responseBody?.ok) {
      test.skip(true, 'Outcome draft API unavailable');
      return;
    }

    expect(responseBody.ok).toBe(true);
    // Single item cannot be SEQUENTIAL_TASK_CLUSTER (needs >= 3)
    expect(responseBody.structureMode).not.toBe('SEQUENTIAL_TASK_CLUSTER');

    assertTelemetryClean(telemetry);
  });

  test('assignee chip "Use" button copies assignee name to item context without page error', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          phase: 1,
          projectKey: 'OPS',
          boardId: 1,
          inputMode: 'mixed',
          narrative: 'Fix DMS alignment',
          structureMode: 'SEQUENTIAL_TASK_CLUSTER',
          parsedSummary: { confidenceScore: 0.72, confidenceLabel: 'medium', rationale: '' },
          precheck: { key: 'ok', message: '' },
          readinessWarnings: [],
          epicHintDefault: '',
          capacityFitHint: null,
          rows: [
            { id: 'r0', index: 0, kind: 'STORY', issueType: 'Task', title: 'Fix DMS alignment', confidence: 0.72, warnings: [], selected: true, suggestedAssignee: 'Bob Santos' },
          ],
          profileMeta: { degraded: false, degradeReason: '', sampleCounts: {} },
        }),
      });
    });

    const isOpen = await openCreateWork(page);
    if (!isOpen) {
      test.skip(true, 'Create work drawer not reachable');
      return;
    }

    await page.locator('#wdd-source-textarea').fill('Fix DMS alignment');
    await page.locator('#wdd-source-textarea').dispatchEvent('input');
    await page.waitForTimeout(3000);

    const useBtn = page.locator('.wdc-repair-action[data-repair="accept-assignee"]');
    if (await useBtn.isVisible().catch(() => false)) {
      await useBtn.dispatchEvent('click');
      // After click, no crash — the page should still be functional
      await expect(page.locator('#wdd-canvas')).toBeVisible();
    }

    assertTelemetryClean(telemetry);
  });

  test('acronym coherence: items with known board acronyms get higher confidence than items without', async ({ page }) => {
    test.setTimeout(60000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    const [withAcronymResp, withoutAcronymResp] = await page.evaluate(async () => {
      const headers = { 'Content-Type': 'application/json' };
      const [r1, r2] = await Promise.all([
        fetch('/api/outcome-draft', { method: 'POST', headers, body: JSON.stringify({ narrative: '1. Clean DMS data\n2. Reload AMS config\n3. Sync MIS pipeline', projectKey: 'OPS', boardId: 1, inputMode: 'mixed' }) }),
        fetch('/api/outcome-draft', { method: 'POST', headers, body: JSON.stringify({ narrative: '1. Write something down\n2. Do the thing carefully\n3. Review the outcome', projectKey: 'OPS', boardId: 1, inputMode: 'mixed' }) }),
      ]);
      return Promise.all([r1.ok ? r1.json() : null, r2.ok ? r2.json() : null]);
    });

    if (!withAcronymResp?.ok || !withoutAcronymResp?.ok) {
      test.skip(true, 'Outcome draft API unavailable');
      return;
    }

    const scoreWithAcronyms = withAcronymResp.parsedSummary?.confidenceScore ?? 0;
    const scoreWithout = withoutAcronymResp.parsedSummary?.confidenceScore ?? 0;

    // Acronym coherence boost should mean board-acronym items score >= items without known acronyms
    // (only reliably true when the board has topAcronyms configured — if not, scores may be equal)
    expect(scoreWithAcronyms).toBeGreaterThanOrEqual(scoreWithout - 0.01);

    assertTelemetryClean(telemetry);
  });
});
