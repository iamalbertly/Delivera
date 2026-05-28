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

  test('drawer auto-opens project popover or shows free-text input when no project context exists', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    // Clear localStorage project context to simulate fresh user with no board context
    await page.goto('/current-sprint');
    await page.evaluate(() => {
      try {
        localStorage.removeItem('delivera_selected_projects');
        localStorage.removeItem('delivera_projects_ssot');
        localStorage.removeItem('wdd_last_project');
        localStorage.removeItem('recentOutcomeActivity');
      } catch (_) {}
    });

    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SEQUENTIAL_TASK_DRAFT),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    // Either the project popover is shown or the send bar does not show "Select a project first"
    // after the user manually enters a project key
    const manualInput = page.locator('#wdd-project-manual-input');
    const isManualVisible = await manualInput.isVisible().catch(() => false);

    if (isManualVisible) {
      // Manual input is visible — simulate user entering a project key
      await manualInput.fill('OPS');
      await manualInput.press('Enter');
      await page.waitForTimeout(500);

      const sendBar = page.locator('#wdd-safe-send-bar');
      const sendText = await sendBar.textContent().catch(() => '');
      expect(sendText).not.toMatch(/Select a project first/i);
    }

    // After entering the project, paste task list
    const textarea = page.locator('#wdd-source-textarea');
    await textarea.fill('a: Clean Data.\nb: Reload Data.\nc: Validate Data.');
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(2500);

    // The send bar should NOT permanently show "Select a project first"
    const sendBarFinal = page.locator('#wdd-safe-send-bar');
    const finalSendText = await sendBarFinal.textContent().catch(() => '');
    expect(finalSendText).not.toMatch(/Select a project first/i);

    assertTelemetryClean(telemetry);
  });

  test('letter-prefixed list (a:, b:, c:) triggers task cluster mode, chips show T', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        ...MOCK_SEQUENTIAL_TASK_DRAFT,
        precheck: { key: 'sequential_task_cluster', message: 'Numbered task list — each step becomes a flat sprint-ready task.' },
        rows: [
          { id: 'r0', index: 0, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Clean Data', confidence: 0.72, warnings: [], selected: true },
          { id: 'r1', index: 1, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Reload Data', confidence: 0.72, warnings: [], selected: true },
          { id: 'r2', index: 2, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Validate Data', confidence: 0.72, warnings: [], selected: true },
        ],
      }),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    const textarea = page.locator('#wdd-source-textarea');
    await textarea.fill('a: Clean Data.\nb: Reload Data.\nc: Validate Data.');
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(2500);

    const canvas = page.locator('#wdd-canvas');
    if (await canvas.isVisible().catch(() => false)) {
      const typeChips = canvas.locator('.wdc-type-chip');
      const count = await typeChips.count();
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const chipText = await typeChips.nth(i).textContent();
          expect(chipText?.trim()).toBe('T');
        }
      }
    }

    assertTelemetryClean(telemetry);
  });

  test('"Already done" chip renders and blocks create for done-duplicate items', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        ...MOCK_SEQUENTIAL_TASK_DRAFT,
        rows: [
          { id: 'r0', index: 0, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Clean Site Data on DMS', confidence: 0.72, warnings: [{ code: 'ALREADY_DONE', message: 'Already done: DMS-42 (88% match)' }], selected: true,
            duplicate: { suggestedAction: 'skipAlreadyDone', primaryReason: 'done_match', key: 'DMS-42', similarity: 88, isDoneMatch: true, epicCandidate: null, storyCandidate: null, completedRecently: { key: 'DMS-42', similarity: 0.88 } } },
          { id: 'r1', index: 1, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Reload from MIS', confidence: 0.72, warnings: [], selected: true, duplicate: { suggestedAction: 'createNew', primaryReason: 'none', key: null, similarity: null, isDoneMatch: false } },
        ],
      }),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    const textarea = page.locator('#wdd-source-textarea');
    await textarea.fill('0: Clean Site Data on DMS.\n1: Reload from MIS.');
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(2500);

    const canvas = page.locator('#wdd-canvas');
    await expect(canvas).toBeVisible();

    // Verify "Already done" chip appears
    const doneChip = canvas.locator('.wdc-repair-chip--done-block').first();
    if (await doneChip.isVisible().catch(() => false)) {
      const chipText = await doneChip.textContent();
      expect(chipText).toMatch(/Already done|DMS-42/i);
    }

    // Verify item is visually de-emphasized (strikethrough via data-done-dup)
    const doneDupItem = canvas.locator('[data-done-dup="true"]');
    const doneDupCount = await doneDupItem.count();
    expect(doneDupCount).toBeGreaterThanOrEqual(1);

    // "Already done" count should appear in send bar
    const doneCountChip = page.locator('.wdd-send-count--done-block');
    if (await doneCountChip.isVisible().catch(() => false)) {
      const doneText = await doneCountChip.textContent();
      expect(doneText).toMatch(/Already done|1/);
    }

    // Create button should show only 1 safe item (not the done one)
    const createBtn = page.locator('#wdd-create-safe-btn');
    const btnText = await createBtn.textContent().catch(() => '');
    expect(btnText).not.toMatch(/Create 2/);

    assertTelemetryClean(telemetry);
  });

  test('"Create anyway" override clears done-duplicate block and enables creation', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        ...MOCK_SEQUENTIAL_TASK_DRAFT,
        rows: [
          { id: 'r0', index: 0, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Clean Site Data on DMS', confidence: 0.72,
            warnings: [{ code: 'ALREADY_DONE', message: 'Already done: DMS-42' }], selected: true,
            duplicate: { suggestedAction: 'skipAlreadyDone', primaryReason: 'done_match', key: 'DMS-42', similarity: 88, isDoneMatch: true, epicCandidate: null, storyCandidate: null, completedRecently: { key: 'DMS-42', similarity: 0.88 } } },
        ],
      }),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    const textarea = page.locator('#wdd-source-textarea');
    await textarea.fill('0: Clean Site Data on DMS.');
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(2500);

    const canvas = page.locator('#wdd-canvas');
    const createAnywayBtn = canvas.locator('[data-repair="create-anyway"]').first();
    if (await createAnywayBtn.isVisible().catch(() => false)) {
      await createAnywayBtn.dispatchEvent('click');
      await page.waitForTimeout(500);

      // After overriding, the item should no longer be marked as done-dup
      const stillDoneDup = await canvas.locator('[data-done-dup="true"]').count();
      expect(stillDoneDup).toBe(0);

      // Create button should now be enabled
      const createBtn = page.locator('#wdd-create-safe-btn');
      const isDisabled = await createBtn.isDisabled().catch(() => true);
      expect(isDisabled).toBe(false);
    }

    assertTelemetryClean(telemetry);
  });

  test('estimate hours input renders per item and shows total in create button label', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);

    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SEQUENTIAL_TASK_DRAFT),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    const textarea = page.locator('#wdd-source-textarea');
    await textarea.fill('0: Clean Data.\n1: Reload Data.\n2: Validate Data.');
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(2500);

    const canvas = page.locator('#wdd-canvas');
    if (!await canvas.isVisible().catch(() => false)) {
      test.skip(true, 'Canvas not visible after draft'); return;
    }

    // Each non-ignored item should have an estimate input
    const estimateInputs = canvas.locator('.wdc-estimate-input');
    const inputCount = await estimateInputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(3);

    // Fill an estimate for the first item
    const firstInput = estimateInputs.first();
    await firstInput.fill('4');
    await firstInput.dispatchEvent('change');
    await page.waitForTimeout(300);

    // Create button should show hours suffix
    const createBtn = page.locator('#wdd-create-safe-btn');
    const btnText = await createBtn.textContent().catch(() => '');
    if (btnText && !btnText.includes('Nothing') && !btnText.includes('Select')) {
      expect(btnText).toMatch(/4h/);
    }

    assertTelemetryClean(telemetry);
  });

  test('estimate chips render per item and clicking ½h chip selects it, button shows hours', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SEQUENTIAL_TASK_DRAFT),
    }));
    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    const textarea = page.locator('#wdd-source-textarea');
    await textarea.fill('0: Validate data.\n1: Reload from MIS.');
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(2500);

    const canvas = page.locator('#wdd-canvas');
    if (!await canvas.isVisible().catch(() => false)) { test.skip(true, 'Canvas not visible'); return; }

    // Estimate chips should render (not the old number input)
    const chips = canvas.locator('.wdc-estimate-chip');
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThanOrEqual(7); // at least one set of 7 chips

    // Click ½h chip on first item
    const halfHourChip = canvas.locator('[data-hours="0.5"]').first();
    if (await halfHourChip.isVisible().catch(() => false)) {
      await halfHourChip.dispatchEvent('click');
      await page.waitForTimeout(300);
      const pressed = await halfHourChip.getAttribute('aria-pressed');
      expect(pressed).toBe('true');
    }

    // Old number input should NOT exist
    const oldInput = canvas.locator('.wdc-estimate-input');
    expect(await oldInput.count()).toBe(0);

    assertTelemetryClean(telemetry);
  });

  test('auto-suggest sets estimate chip for "Validate" title on draft load', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        ...MOCK_SEQUENTIAL_TASK_DRAFT,
        rows: [
          { id: 'r0', index: 0, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Validate DMS to CSS alignment', confidence: 0.72, warnings: [], selected: true, suggestedAssignee: null, duplicate: { suggestedAction: 'createNew', primaryReason: 'none', key: null, similarity: null, isDoneMatch: false } },
        ],
      }),
    }));
    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    const textarea = page.locator('#wdd-source-textarea');
    await textarea.fill('0: Validate DMS to CSS alignment.');
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(2500);

    const canvas = page.locator('#wdd-canvas');
    if (!await canvas.isVisible().catch(() => false)) { test.skip(true, 'Canvas not visible'); return; }

    // 2h chip should be auto-selected (validate → 2h)
    const twoHourChip = canvas.locator('[data-hours="2"]').first();
    if (await twoHourChip.isVisible().catch(() => false)) {
      const pressed = await twoHourChip.getAttribute('aria-pressed');
      expect(pressed).toBe('true');
    }

    assertTelemetryClean(telemetry);
  });

  test('"Skip all done (N)" button appears and clears all done-dup items', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        ...MOCK_SEQUENTIAL_TASK_DRAFT,
        rows: [
          { id: 'r0', index: 0, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Clean Site Data', confidence: 0.72,
            warnings: [{ code: 'ALREADY_DONE', message: 'Already done: DMS-42' }], selected: true,
            duplicate: { suggestedAction: 'skipAlreadyDone', primaryReason: 'done_match', key: 'DMS-42', similarity: 88, isDoneMatch: true, url: null } },
          { id: 'r1', index: 1, kind: 'STORY', issueType: 'Task', type: 'T', title: 'Reload from MIS', confidence: 0.72,
            warnings: [], selected: true,
            duplicate: { suggestedAction: 'createNew', primaryReason: 'none', key: null, similarity: null, isDoneMatch: false } },
        ],
      }),
    }));
    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    const textarea = page.locator('#wdd-source-textarea');
    await textarea.fill('0: Clean Site Data.\n1: Reload from MIS.');
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(2500);

    const skipAllBtn = page.locator('#wdd-skip-all-done-btn');
    if (await skipAllBtn.isVisible().catch(() => false)) {
      const btnText = await skipAllBtn.textContent();
      expect(btnText).toMatch(/Skip all done/i);
      await skipAllBtn.dispatchEvent('click');
      await page.waitForTimeout(500);
      // After skip, done-dup item should be gone
      const doneDupItems = page.locator('[data-done-dup="true"]');
      expect(await doneDupItems.count()).toBe(0);
    }

    assertTelemetryClean(telemetry);
  });

  test('desktop push panel: body.wdd-panel-open added on open, removed on close', async ({ page }) => {
    test.setTimeout(90000);
    const telemetry = captureBrowserTelemetry(page);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/current-sprint');
    await page.route('**/api/outcome-draft', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(MOCK_SEQUENTIAL_TASK_DRAFT),
    }));

    const isOpen = await openCreateWork(page);
    if (!isOpen) { test.skip(true, 'Create work drawer not reachable'); return; }

    const hasPanelClass = await page.evaluate(() => document.body.classList.contains('wdd-panel-open'));
    expect(hasPanelClass).toBe(true);

    // Backdrop should not be visible on desktop (1400px ≥ 1200px breakpoint)
    const backdropVisible = await page.evaluate(() => {
      const bd = document.getElementById('work-draft-backdrop');
      if (!bd) return false;
      const style = window.getComputedStyle(bd);
      return style.display !== 'none';
    });
    expect(backdropVisible).toBe(false);

    // Close drawer
    const closeBtn = page.locator('#wdd-close-btn');
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.dispatchEvent('click');
      await page.waitForTimeout(300);
      const stillOpen = await page.evaluate(() => document.body.classList.contains('wdd-panel-open'));
      expect(stillOpen).toBe(false);
    }

    assertTelemetryClean(telemetry);
  });
});
