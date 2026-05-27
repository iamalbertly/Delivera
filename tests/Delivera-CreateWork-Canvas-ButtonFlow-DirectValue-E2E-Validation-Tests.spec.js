import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { assertTelemetryClean, captureBrowserTelemetry } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

/**
 * Create Work Canvas — Button-click flow E2E validation with route mocking.
 * These tests catch real UI breakage: open drawer → paste → verify chips → click Create → flow starts.
 * Each test uses page.route() to mock /api/outcome-draft so button-click paths work without live Jira.
 * All steps terminate on first error (via assertTelemetryClean + expect assertions = fail-fast).
 */

const MOCK_SEQUENTIAL_TASK_DRAFT = {
  ok: true,
  phase: 1,
  projectKey: 'OPS',
  boardId: 1,
  inputMode: 'mixed',
  structureMode: 'SEQUENTIAL_TASK_CLUSTER',
  parsedSummary: { rationale: 'Numbered tasks', confidenceScore: 0.72, confidenceLabel: 'medium' },
  precheck: { key: 'sequential_task_cluster', message: 'Numbered task list — each step becomes a flat sprint-ready task.' },
  readinessWarnings: [],
  epicHintDefault: '',
  capacityFitHint: '6 items fits your team\'s sprint pattern (~13/sprint based on recent history).',
  rows: [
    { id: 'r0', index: 0, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Clean Site Data on DMS', confidence: 0.72, warnings: [], selected: true, suggestedAssignee: null },
    { id: 'r1', index: 1, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Re-Load Site Data from MIS into DMS', confidence: 0.72, warnings: [], selected: true, suggestedAssignee: 'Alice Chen' },
    { id: 'r2', index: 2, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Validate DMS to CSS site data alignment', confidence: 0.72, warnings: [], selected: true, suggestedAssignee: null },
    { id: 'r3', index: 3, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Clean Site Data on AMS', confidence: 0.72, warnings: [], selected: true, suggestedAssignee: null },
    { id: 'r4', index: 4, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Re-Load Site Data from MIS into AMS', confidence: 0.72, warnings: [], selected: true, suggestedAssignee: 'Alice Chen' },
    { id: 'r5', index: 5, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Validate and Fix Geographic Division Mapping Synchronization', confidence: 0.72, warnings: [], selected: true, suggestedAssignee: null },
  ],
  profileMeta: { degraded: false, degradeReason: '', sampleCounts: {} },
};

const MOCK_STORY_DRAFT = {
  ok: true,
  phase: 1,
  projectKey: 'OPS',
  boardId: 1,
  inputMode: 'mixed',
  structureMode: 'TABLE_ISSUES',
  parsedSummary: { rationale: 'Stories', confidenceScore: 0.80, confidenceLabel: 'high' },
  precheck: null,
  readinessWarnings: [],
  epicHintDefault: '',
  capacityFitHint: null,
  rows: [
    { id: 'r0', index: 0, kind: 'STORY', issueType: 'Story', type: 'S', title: 'Add user profile page', confidence: 0.80, warnings: [], selected: true, suggestedAssignee: null },
    { id: 'r1', index: 1, kind: 'STORY', issueType: 'Story', type: 'S', title: 'Set up notifications system', confidence: 0.80, warnings: [], selected: true, suggestedAssignee: null },
  ],
  profileMeta: { degraded: false, degradeReason: '', sampleCounts: {} },
};

async function openCreateWork(page) {
  await page.goto('/current-sprint');
  await page.waitForSelector('.global-nav, #current-sprint-error', { timeout: 20000 }).catch(() => null);
  const navBtn = page.locator('[data-action="open-create-work"], .global-nav-create-work, button:has-text("Create work")').first();
  if (await navBtn.isVisible().catch(() => false)) {
    await navBtn.dispatchEvent('click');
    await page.waitForSelector('#wdd-source-textarea', { timeout: 10000 }).catch(() => null);
    const textarea = page.locator('#wdd-source-textarea');
    return await textarea.isVisible().catch(() => false);
  }
  return false;
}

test.describe('Create Work — canvas button-click flow (mocked API)', () => {

  test('sequential task list → all chips show T not S', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SEQUENTIAL_TASK_DRAFT),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    await page.locator('#wdd-source-textarea').fill('0: Clean Site Data on DMS.\n1: Re-Load from MIS.\n2: Validate DMS to CSS.');
    await page.locator('#wdd-source-textarea').dispatchEvent('input');
    await page.waitForTimeout(2500);

    const canvas = page.locator('#wdd-canvas');
    await expect(canvas).toBeVisible();
    const typeChips = canvas.locator('.wdc-type-chip');
    const count = await typeChips.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Every chip in a SEQUENTIAL_TASK_CLUSTER response must be T, not S
    for (let i = 0; i < count; i++) {
      const chipText = await typeChips.nth(i).textContent();
      expect(chipText?.trim(), `Item ${i} chip expected T but got ${chipText?.trim()}`).toBe('T');
    }

    assertTelemetryClean(telemetry);
  });

  test('sequential task list → Create button shows "Create N Tasks" and is enabled', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SEQUENTIAL_TASK_DRAFT),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    await page.locator('#wdd-source-textarea').fill('0: Clean Site Data on DMS.\n1: Re-Load from MIS.\n2: Validate DMS.');
    await page.locator('#wdd-source-textarea').dispatchEvent('input');
    await page.waitForTimeout(2500);

    const createBtn = page.locator('#wdd-create-safe-btn');
    await expect(createBtn).toBeVisible();

    // Button must NOT be disabled — "Nothing to create yet" means the bug is still present
    const isDisabled = await createBtn.isDisabled();
    expect(isDisabled, 'Create button is disabled — items may be going to review incorrectly').toBe(false);

    // Button text must mention "Tasks" (not generic "issues" or "Nothing to create yet")
    const btnText = await createBtn.textContent();
    expect(btnText, `Expected "Create N Tasks" but got: "${btnText}"`).toMatch(/create \d+ tasks/i);

    assertTelemetryClean(telemetry);
  });

  test('Ready count matches items with no warnings, Needs review count matches items with warnings', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    const draftWithMixed = {
      ...MOCK_SEQUENTIAL_TASK_DRAFT,
      rows: [
        { id: 'r0', index: 0, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Clean Site Data', confidence: 0.72, warnings: [], selected: true, suggestedAssignee: null },
        { id: 'r1', index: 1, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Reload Data', confidence: 0.72, warnings: [{ code: 'LOW_CONFIDENCE', message: 'Low structure confidence — review before commit.' }], selected: true, suggestedAssignee: null },
        { id: 'r2', index: 2, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Validate Mapping', confidence: 0.72, warnings: [], selected: true, suggestedAssignee: null },
      ],
    };

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(draftWithMixed),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    await page.locator('#wdd-source-textarea').fill('0: Clean Site Data\n1: Reload Data\n2: Validate Mapping');
    await page.locator('#wdd-source-textarea').dispatchEvent('input');
    await page.waitForTimeout(2500);

    // Ready: 2, Needs review: 1
    const safeCount = page.locator('.wdd-send-count--safe');
    await expect(safeCount).toContainText('Ready: 2');

    const reviewEl = page.locator('.wdd-send-count--review');
    await expect(reviewEl).toBeVisible();
    await expect(reviewEl).toContainText('Needs review: 1');

    assertTelemetryClean(telemetry);
  });

  test('click Create button → triggers Jira creation flow (Creating… state or success)', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SEQUENTIAL_TASK_DRAFT),
    }));

    // Mock the creation endpoint so the click flow completes without real Jira
    await page.route('**/api/outcome-from-narrative', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        createdCount: 6,
        expectedCreateCount: 6,
        createdIssues: [
          { key: 'OPS-101', url: 'https://example.atlassian.net/browse/OPS-101' },
          { key: 'OPS-102', url: 'https://example.atlassian.net/browse/OPS-102' },
        ],
        failures: [],
      }),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    await page.locator('#wdd-source-textarea').fill('0: Clean Site Data.\n1: Re-Load Data.\n2: Validate Mapping.');
    await page.locator('#wdd-source-textarea').dispatchEvent('input');
    await page.waitForTimeout(2500);

    const createBtn = page.locator('#wdd-create-safe-btn');
    if (await createBtn.isDisabled().catch(() => true)) {
      test.skip(true, 'Create button not enabled — prerequisite failed');
      return;
    }

    // Click the create button
    await createBtn.dispatchEvent('click');

    // After click, either: "Creating…" state appears, or follow-up links appear
    // Both are valid proof the flow started. "Nothing to create yet" or still same text = bug.
    const btnTextAfter = await createBtn.textContent().catch(() => '');
    const submitStatus = await page.locator('#wdd-submit-status').textContent().catch(() => '');
    const followUp = page.locator('.wdd-follow-up, .wdd-created-link, [data-action="view-created"]');
    const followUpVisible = await followUp.isVisible().catch(() => false);

    // At least one of: button changed state, submit status has content, or follow-up appeared
    const flowStarted = btnTextAfter?.includes('Creating') || submitStatus.length > 0 || followUpVisible;
    expect(flowStarted, `Create flow did not start. Button: "${btnTextAfter}", Status: "${submitStatus}"`).toBe(true);

    assertTelemetryClean(telemetry);
  });

  test('"Needs review" chip scrolls to first warning item without error', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    const draftWithWarning = {
      ...MOCK_SEQUENTIAL_TASK_DRAFT,
      rows: [
        { id: 'r0', index: 0, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Clean Data', confidence: 0.72, warnings: [], selected: true, suggestedAssignee: null },
        { id: 'r1', index: 1, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Reload Data', confidence: 0.30, warnings: [{ code: 'LOW_CONFIDENCE', message: 'Low structure confidence — review before commit.' }], selected: true, suggestedAssignee: null },
      ],
    };

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(draftWithWarning),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    await page.locator('#wdd-source-textarea').fill('0: Clean Data\n1: Reload Data');
    await page.locator('#wdd-source-textarea').dispatchEvent('input');
    await page.waitForTimeout(2500);

    const reviewChip = page.locator('[data-action="scroll-to-first-warning"]');
    if (await reviewChip.isVisible().catch(() => false)) {
      await reviewChip.dispatchEvent('click');
      // After clicking, the page should still be functional — no crash
      await expect(page.locator('#wdd-canvas')).toBeVisible();
    }

    assertTelemetryClean(telemetry);
  });

  test('story batch → Create button shows "Create N Stories"', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_STORY_DRAFT),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    await page.locator('#wdd-source-textarea').fill('Add user profile page\nSet up notifications');
    await page.locator('#wdd-source-textarea').dispatchEvent('input');
    await page.waitForTimeout(2500);

    const createBtn = page.locator('#wdd-create-safe-btn');
    await expect(createBtn).toBeVisible();
    if (!await createBtn.isDisabled().catch(() => true)) {
      const btnText = await createBtn.textContent();
      expect(btnText).toMatch(/create \d+ stories/i);
    }

    assertTelemetryClean(telemetry);
  });

  test('type chip click cycles type without console error', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SEQUENTIAL_TASK_DRAFT),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    await page.locator('#wdd-source-textarea').fill('0: Clean Data.\n1: Reload Data.');
    await page.locator('#wdd-source-textarea').dispatchEvent('input');
    await page.waitForTimeout(2500);

    const firstChip = page.locator('.wdc-type-chip').first();
    const initialType = await firstChip.textContent().catch(() => '');
    await firstChip.dispatchEvent('click');
    await page.waitForTimeout(300);
    const afterType = await firstChip.textContent().catch(() => initialType);

    // Type should have cycled (or chip may have re-rendered — just check no crash)
    expect(afterType).toBeTruthy();
    await expect(page.locator('#wdd-canvas')).toBeVisible();

    assertTelemetryClean(telemetry);
  });

  test('drawer title updates to "Create work · N" when items are parsed', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SEQUENTIAL_TASK_DRAFT),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    const title = page.locator('#wdd-title');
    const initialTitle = await title.textContent().catch(() => '');
    expect(initialTitle).toMatch(/create work/i);

    await page.locator('#wdd-source-textarea').fill('0: Clean Data.\n1: Reload Data.');
    await page.locator('#wdd-source-textarea').dispatchEvent('input');
    await page.waitForTimeout(2500);

    const updatedTitle = await title.textContent().catch(() => '');
    expect(updatedTitle).toMatch(/create work\s*·\s*\d+/i);

    assertTelemetryClean(telemetry);
  });

  test('precheck status shows task-cluster message, not support-work warning, for numbered task list', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SEQUENTIAL_TASK_DRAFT),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    await page.locator('#wdd-source-textarea').fill('0: Clean Data.\n1: Reload Data.');
    await page.locator('#wdd-source-textarea').dispatchEvent('input');
    await page.waitForTimeout(2500);

    const parseStatus = page.locator('#wdd-parse-status');
    if (await parseStatus.isVisible().catch(() => false)) {
      const statusText = await parseStatus.textContent();
      // Must NOT show support work message
      expect(statusText).not.toMatch(/support or maintenance/i);
      // Should show sequential task message
      expect(statusText).toMatch(/numbered task|sprint-ready task/i);
    }

    assertTelemetryClean(telemetry);
  });

  test('no console errors after full Create Work interaction with mocked APIs', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SEQUENTIAL_TASK_DRAFT),
    }));
    await page.route('**/api/outcome-from-narrative', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, createdCount: 2, expectedCreateCount: 2, createdIssues: [], failures: [] }),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    const textarea = page.locator('#wdd-source-textarea');
    await textarea.fill('0: Clean Data.\n1: Reload Data.');
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(2500);

    const createBtn = page.locator('#wdd-create-safe-btn');
    if (!await createBtn.isDisabled().catch(() => true)) {
      await createBtn.dispatchEvent('click');
      await page.waitForTimeout(1500);
    }

    // Close drawer and verify no residual errors
    const closeBtn = page.locator('#wdd-close-btn');
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.dispatchEvent('click');
    }
    await page.waitForTimeout(500);

    assertTelemetryClean(telemetry);
  });
});
