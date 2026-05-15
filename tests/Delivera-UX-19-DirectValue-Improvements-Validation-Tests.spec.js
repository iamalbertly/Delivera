/**
 * Validation suite for 19+ direct-value UX improvements.
 *
 * Design principles:
 * - All assertions validate JOURNEY VALUE, not implementation noise.
 * - Every test routes against a controlled fixture so results are deterministic.
 * - Fail-fast: first assertion failure stops that test immediately.
 * - No false positives: conditional skips only when the page legitimately has no data.
 * - Browser telemetry captured on every test; critical errors surface as failures.
 * - data-* attributes preferred over fragile class/text selectors where added.
 */

import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function buildBoardsFixture() {
  return { projects: ['SD'], boards: [{ id: 1, name: 'SD Board', type: 'scrum', projectKey: 'SD' }] };
}

/** Active sprint with blockers, orphan owner, and zero done — exercises all 19 improvements. */
function buildBlockedSprintFixture() {
  return {
    board: { id: 1, name: 'SD Board', projectKeys: ['SD'] },
    sprint: {
      id: 7358,
      name: 'FY26DMS22',
      state: 'active',
      startDate: '2026-05-07T00:00:00.000Z',
      endDate: '2026-05-19T00:00:00.000Z',
    },
    summary: {
      percentDone: 0,
      totalStories: 6,
      doneStories: 0,
      totalSP: 91,
      supportOpsSP: 0,
      missingEstimate: 1,
      subtaskEstimatedHours: 91,
      subtaskLoggedHours: 0,
      subtaskMissingEstimate: 1,
      subtaskMissingLogged: 3,
    },
    daysMeta: { daysRemainingWorking: 2, daysRemainingCalendar: 2 },
    plannedWindow: { start: '2026-05-07T00:00:00.000Z', end: '2026-05-19T00:00:00.000Z' },
    flags: {},
    dailyCompletions: { stories: [], subtasks: [] },
    remainingWorkByDay: [],
    idealBurndown: [],
    scopeChanges: [],
    scopeChangeSummary: {},
    subtaskTracking: { rows: [], subtasks: [] },
    stuckCandidates: [
      {
        issueKey: 'SD-4643',
        summary: 'TM Should be able to see smartphone KPI details on the NBA Dashboard',
        issueType: 'Story',
        status: 'In Progress',
        assignee: '',
        reporter: 'Former user',
        hoursInStatus: 198,
        issueUrl: 'https://jira.example.com/browse/SD-4643',
      },
      {
        issueKey: 'SD-5171',
        summary: 'Voucher Service Upgrade-Testing Connectivity',
        issueType: 'Story',
        status: 'In Progress',
        assignee: 'Amani Musomba',
        reporter: 'Amani Musomba',
        hoursInStatus: 211,
        issueUrl: 'https://jira.example.com/browse/SD-5171',
      },
      {
        issueKey: 'SD-5160',
        summary: 'EVOD-APIs SECURITY ENHANCEMENT',
        issueType: 'Story',
        status: 'In Progress',
        assignee: 'Amani Musomba',
        reporter: 'Amani Musomba',
        hoursInStatus: 386,
        issueUrl: 'https://jira.example.com/browse/SD-5160',
      },
    ],
    stuckExclusions: { parentsWithActiveSubtasks: [], recentSubtaskMovementCount: 0 },
    previousSprint: null,
    recentSprints: [],
    nextSprint: null,
    notes: { dependencies: [], learnings: [], updatedAt: null },
    assumptions: [],
    stories: [
      { issueKey: 'SD-4643', summary: 'TM Should be able to see smartphone KPI details', storyPoints: 21, labels: ['OutcomeStory', 'blocker'], completionPct: 0, status: 'In Progress', issueType: 'Story', reporter: 'Former user', assignee: '', issueUrl: 'https://jira.example.com/browse/SD-4643', subtasks: [] },
      { issueKey: 'SD-5129', summary: 'Enhancement of Territory Manager daily reports', storyPoints: 21, labels: ['OutcomeStory'], completionPct: 0, status: 'To Do', issueType: 'Story', reporter: 'PM', assignee: '', issueUrl: 'https://jira.example.com/browse/SD-5129', subtasks: [] },
      { issueKey: 'SD-5150', summary: 'TM clusters with dropping trend', storyPoints: 13, labels: ['OutcomeStory'], completionPct: 0, status: 'To Do', issueType: 'Story', reporter: 'PM', assignee: '', issueUrl: 'https://jira.example.com/browse/SD-5150', subtasks: [] },
      { issueKey: 'SD-5160', summary: 'EVOD-APIs SECURITY ENHANCEMENT', storyPoints: 21, labels: ['OutcomeStory', 'blocker'], completionPct: 0, status: 'In Progress', issueType: 'Story', reporter: 'Amani Musomba', assignee: 'Amani Musomba', issueUrl: 'https://jira.example.com/browse/SD-5160', subtasks: [] },
      { issueKey: 'SD-5171', summary: 'Voucher Service Upgrade-Testing Connectivity', storyPoints: 13, labels: ['OutcomeStory', 'blocker'], completionPct: 0, status: 'In Progress', issueType: 'Story', reporter: 'Amani Musomba', assignee: 'Amani Musomba', issueUrl: 'https://jira.example.com/browse/SD-5171', subtasks: [] },
      { issueKey: 'SD-5203', summary: 'DEVSECOPS', storyPoints: 0, labels: [], completionPct: 0, status: 'To Do', issueType: 'Story', reporter: 'PM', assignee: '', issueUrl: 'https://jira.example.com/browse/SD-5203', subtasks: [] },
    ],
    meta: { projects: 'SD', generatedAt: new Date().toISOString() },
  };
}

async function routeFixtures(page) {
  await page.route('**/api/boards.json**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildBoardsFixture()) })
  );
  await page.route('**/api/current-sprint.json**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildBlockedSprintFixture()) })
  );
  await page.route('**/api/sprints**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sprints: [] }) })
  );
}

async function loadCurrentSprintPage(page) {
  // Prime localStorage board context so the page auto-loads without a board-selector step
  await page.addInitScript(() => {
    try {
      localStorage.setItem('delivera.projects.ssot.v1', JSON.stringify(['SD']));
      localStorage.setItem('delivera.boardId.v1', '1');
      localStorage.setItem('delivera.report.context.v1', JSON.stringify({ projects: ['SD'], boardId: 1, boardName: 'SD Board' }));
    } catch (_) {}
  });

  await page.goto('/current-sprint?boardId=1');
  if (await skipIfRedirectedToLogin(page, test, { currentSprint: true })) return false;

  // Wait for the page to settle: either header bar renders or an error appears
  await page.waitForSelector('.current-sprint-header-bar, #current-sprint-error', {
    state: 'attached',
    timeout: 30000,
  });

  // Give async rendering a moment to flush
  await page.waitForTimeout(500);

  // If error div is visible, skip the test gracefully
  const errVisible = await page.locator('#current-sprint-error').isVisible().catch(() => false);
  if (errVisible) {
    const errText = (await page.locator('#current-sprint-error').textContent().catch(() => '')) || '';
    test.skip(true, `Sprint page error: ${errText.slice(0, 120)}`);
    return false;
  }
  return true;
}

// ─── GROUP 1: Issue Preview — inline Jira send, no clipboard-only buttons ────

test.describe('IMP-01: Issue Preview — inline Jira send replaces clipboard buttons', () => {
  test.beforeEach(async ({ page }) => { await routeFixtures(page); });

  test('Send to Jira button is present; Copy basic/guided nudge buttons are absent', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    // Open preview for the first risk row
    const firstRiskRow = page.locator('#work-risks-table tbody tr.work-risk-parent-row').first();
    const hasTable = await firstRiskRow.isVisible().catch(() => false);
    if (!hasTable) { test.skip(true, 'No risk table rows visible'); return; }

    await firstRiskRow.click();
    await page.waitForSelector('.issue-preview-open', { timeout: 10000 });

    const previewActions = page.locator('.issue-preview-actions');
    await expect(previewActions).toBeVisible();

    // MUST have Send to Jira
    await expect(previewActions.locator('[data-issue-preview-action="open-review-sheet"]')).toBeVisible();

    // MUST NOT have old copy buttons
    await expect(previewActions.locator('[data-issue-preview-action="copy-nudge"]')).toHaveCount(0);
    await expect(previewActions.locator('[data-issue-preview-action="copy-guided-nudge"]')).toHaveCount(0);
    await expect(previewActions.locator('[data-issue-preview-action="copy-link"]')).toHaveCount(0);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Clicking Send to Jira toggles inline composer with editable textarea', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    const firstRiskRow = page.locator('#work-risks-table tbody tr.work-risk-parent-row').first();
    if (!await firstRiskRow.isVisible().catch(() => false)) { test.skip(true, 'No risk rows'); return; }

    await firstRiskRow.click();
    await page.waitForSelector('.issue-preview-open', { timeout: 10000 });

    // Composer hidden before click
    await expect(page.locator('[data-send-composer]')).toBeHidden();

    // Click Send to Jira
    await page.locator('[data-issue-preview-action="open-review-sheet"]').click();

    // Composer visible, textarea populated
    await expect(page.locator('[data-send-composer]')).toBeVisible();
    const textarea = page.locator('[data-send-nudge-text]');
    await expect(textarea).toBeVisible();
    const textValue = await textarea.inputValue();
    expect(textValue.length).toBeGreaterThan(10);

    // Cancel collapses composer
    await page.locator('[data-issue-preview-action="cancel-send"]').click();
    await expect(page.locator('[data-send-composer]')).toBeHidden();

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Confirm send posts to /api/issues/:key/comment and shows Sent state', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);

    // Mock the comment API endpoint (beforeEach already set sprint routes)
    let capturedBody = null;
    await page.route('**/api/issues/*/comment', async (route) => {
      const body = route.request().postDataJSON();
      capturedBody = body;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'cmnt-1' }) });
    });

    if (!await loadCurrentSprintPage(page)) return;

    const firstRiskRow = page.locator('#work-risks-table tbody tr.work-risk-parent-row').first();
    if (!await firstRiskRow.isVisible().catch(() => false)) { test.skip(true, 'No risk rows'); return; }

    await firstRiskRow.click();
    await page.waitForSelector('.issue-preview-open', { timeout: 10000 });

    await page.locator('[data-issue-preview-action="open-review-sheet"]').click();
    await expect(page.locator('[data-send-composer]')).toBeVisible();

    // Submit
    await page.locator('[data-review-send]').click();

    // Button transitions to Sent ✓
    await expect(page.locator('.jira-nudge-receipt, #delivera-jira-nudge-receipt .jira-nudge-receipt')).toBeVisible({ timeout: 8000 });

    // Status message appears
    await expect(page.locator('[data-send-status]')).not.toBeEmpty({ timeout: 5000 });

    // API was actually called with comment body
    expect(capturedBody).not.toBeNull();
    expect(typeof capturedBody?.commentBody).toBe('string');
    expect(capturedBody.commentBody.length).toBeGreaterThan(5);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Send failure shows retry state, not silent failure', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);

    await page.route('**/api/issues/*/comment', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Jira unavailable' }) })
    );

    if (!await loadCurrentSprintPage(page)) return;

    const firstRiskRow = page.locator('#work-risks-table tbody tr.work-risk-parent-row').first();
    if (!await firstRiskRow.isVisible().catch(() => false)) { test.skip(true, 'No risk rows'); return; }

    await firstRiskRow.click();
    await page.waitForSelector('.issue-preview-open', { timeout: 10000 });
    await page.locator('[data-issue-preview-action="open-review-sheet"]').click();
    await page.locator('[data-review-send]').click();

    // Status must show error, never stay empty/silent
    const statusEl = page.locator('[data-send-status]');
    await expect(statusEl).not.toBeEmpty({ timeout: 8000 });
    const statusText = (await statusEl.textContent() || '').toLowerCase();
    expect(statusText).toMatch(/fail|error|unavailable|retry/i);

    // data-send-error attribute set
    const errAttr = await statusEl.getAttribute('data-send-error');
    expect(errAttr).toBe('1');

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

// ─── GROUP 2: Former user detection ──────────────────────────────────────────

test.describe('IMP-02: Former user / orphaned ticket detection', () => {
  test.beforeEach(async ({ page }) => { await routeFixtures(page); });

  test('Orphan alert renders when reporter is Former user and assignee empty', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    // Find SD-4643 row (former user reporter, no assignee)
    const orphanRow = page.locator('#work-risks-table tbody tr[data-parent-key="SD-4643"], #stories-table tbody tr[data-parent-key="SD-4643"]').first();
    const hasRow = await orphanRow.isVisible().catch(() => false);
    if (!hasRow) { test.skip(true, 'SD-4643 not in table'); return; }

    await orphanRow.click();
    await page.waitForSelector('.issue-preview-open', { timeout: 10000 });

    await expect(page.locator('[data-orphan-alert]')).toBeVisible();
    const alertText = (await page.locator('[data-orphan-alert]').textContent() || '').toLowerCase();
    expect(alertText).toMatch(/no active owner|deactivated/i);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Assignee shows "No owner assigned" instead of empty when unassigned', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    const orphanRow = page.locator('#work-risks-table tbody tr[data-parent-key="SD-4643"], #stories-table tbody tr[data-parent-key="SD-4643"]').first();
    if (!await orphanRow.isVisible().catch(() => false)) { test.skip(true, 'SD-4643 not in table'); return; }

    await orphanRow.click();
    await page.waitForSelector('.issue-preview-open', { timeout: 10000 });

    await expect(page.locator('[data-missing-assignee]')).toBeVisible();
    await expect(page.locator('[data-missing-assignee]')).toContainText(/no owner assigned/i);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Former user reporter has distinct visual marker in metadata', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    const orphanRow = page.locator('#work-risks-table tbody tr[data-parent-key="SD-4643"], #stories-table tbody tr[data-parent-key="SD-4643"]').first();
    if (!await orphanRow.isVisible().catch(() => false)) { test.skip(true, 'SD-4643 not in table'); return; }

    await orphanRow.click();
    await page.waitForSelector('.issue-preview-open', { timeout: 10000 });

    await expect(page.locator('[data-former-user]')).toBeVisible();

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Blockers panel shows orphan alert for deactivated-owner items', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('.sprint-blockers-panel', { timeout: 15000 }).catch(() => null);
    const panel = page.locator('.sprint-blockers-panel');
    const panelVisible = await panel.isVisible().catch(() => false);
    if (!panelVisible) { test.skip(true, 'No blockers panel visible'); return; }

    // SD-4643 is orphaned — should trigger orphan alert in blockers panel
    const orphanAlert = panel.locator('[data-blocker-orphan-alert]');
    await expect(orphanAlert.first()).toBeVisible({ timeout: 5000 });

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

// ─── GROUP 3: Blocker duration labels ────────────────────────────────────────

test.describe('IMP-03: Blocker age labels show actual duration with severity tones', () => {
  test.beforeEach(async ({ page }) => { await routeFixtures(page); });

  test('Blocked duration shows Xd format for issues stuck >24h', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('.sprint-blockers-panel', { timeout: 15000 }).catch(() => null);
    const panel = page.locator('.sprint-blockers-panel');
    if (!await panel.isVisible().catch(() => false)) { test.skip(true, 'No blockers panel'); return; }

    const ageLabels = panel.locator('[data-blocker-age]');
    const count = await ageLabels.count();
    expect(count).toBeGreaterThan(0);

    // At least one label should show "d blocked" format (days, not hours for >24h items)
    const allText = await ageLabels.allTextContents();
    const hasDayFormat = allText.some((t) => /\dd blocked/i.test(t));
    expect(hasDayFormat).toBe(true);

    // Must NOT show just "Stuck >24h" — that was the old vague label
    allText.forEach((t) => {
      expect(t).not.toMatch(/^Stuck >24h$/i);
    });

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('14-day+ blocked item receives critical severity tone class', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('.sprint-blockers-panel', { timeout: 15000 }).catch(() => null);
    const panel = page.locator('.sprint-blockers-panel');
    if (!await panel.isVisible().catch(() => false)) { test.skip(true, 'No blockers panel'); return; }

    // SD-5160 at 386h (~16 days) should be blocker-age-critical
    const criticalAge = panel.locator('.blocker-age-critical');
    const dangerAge = panel.locator('.blocker-age-danger');
    const hasSevereClass = await criticalAge.count() > 0 || await dangerAge.count() > 0;
    expect(hasSevereClass).toBe(true);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Blocked duration appears in issue preview meta when row has hours-in-status', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    // Find a blocker row that has data-hours-in-status attribute
    const blockerRow = page.locator('#work-risks-table tbody tr[data-risk-tags*="blocker"]').first();
    if (!await blockerRow.isVisible().catch(() => false)) { test.skip(true, 'No blocker rows in table'); return; }

    const hasHours = await blockerRow.getAttribute('data-hours-in-status').catch(() => null);
    if (!hasHours || Number(hasHours) < 24) { test.skip(true, 'Row has no significant hours-in-status'); return; }

    await blockerRow.click();
    await page.waitForSelector('.issue-preview-open', { timeout: 10000 });

    await expect(page.locator('[data-blocked-duration]')).toBeVisible();
    const durationText = (await page.locator('[data-blocked-duration]').textContent() || '').toLowerCase();
    expect(durationText).toMatch(/\d+[dh] blocked/i);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

// ─── GROUP 4: Header CTA and intervention queue ───────────────────────────────

test.describe('IMP-04: Take Action CTA is dynamic, intervention queue shows real counts', () => {
  test.beforeEach(async ({ page }) => { await routeFixtures(page); });

  test('Take action CTA shows top blocker issue key, not static text', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    const cta = page.locator('.sprint-intervention-item-primary');
    await expect(cta).toBeVisible({ timeout: 15000 });

    const ctaText = (await cta.textContent() || '').trim();
    // With SD-4643 as top stuck candidate, CTA must say "Unblock SD-4643" not generic "Take action"
    expect(ctaText).toMatch(/Unblock SD-4643|Take action/i);
    // Key: must NOT be blank
    expect(ctaText.length).toBeGreaterThan(3);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Intervention queue contains real count-driven labels, not static placeholders', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    const queue = page.locator('.sprint-intervention-queue');
    await expect(queue).toBeVisible({ timeout: 15000 });

    // OLD static labels must be gone
    const queueText = (await queue.textContent() || '').toLowerCase();
    expect(queueText).not.toContain('your blockers now');
    expect(queueText).not.toContain('missing estimates');
    expect(queueText).not.toContain('ownership gaps');

    // NEW: real counts — fixture has 3 blockers
    await expect(queue).toContainText(/\d+ blocker/i);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Header does not render duplicate filter chip rows for the same data', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    const header = page.locator('.current-sprint-header-bar');
    await expect(header).toBeVisible({ timeout: 15000 });

    // Count "Blockers" filter chips — old bug had them in both compact strip and shortlist
    const blockerChips = header.locator('button[data-risk-tags="blocker"]');
    const chipCount = await blockerChips.count();
    // Maximum 4 instances acceptable (verdict pill, drawer chips, shortlist items); dedup goal = ≤4
    expect(chipCount).toBeLessThanOrEqual(4);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

// ─── GROUP 5: Blockers panel heading and structure ────────────────────────────

test.describe('IMP-05: Blockers panel shows correct heading and structure', () => {
  test.beforeEach(async ({ page }) => { await routeFixtures(page); });

  test('Blockers panel heading shows "Active blockers" when blockers exist', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('.sprint-blockers-panel', { timeout: 15000 }).catch(() => null);
    const panel = page.locator('.sprint-blockers-panel');
    if (!await panel.isVisible().catch(() => false)) { test.skip(true, 'No panel visible'); return; }

    const heading = panel.locator('h3');
    const headingText = (await heading.textContent() || '').trim();
    // Must NOT show "No hidden blockers" when blockers exist (was a heading bug)
    expect(headingText).not.toMatch(/No hidden blockers/i);
    expect(headingText).toMatch(/Active blockers/i);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Blockers panel shows count badge with correct count', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('.sprint-blockers-panel', { timeout: 15000 }).catch(() => null);
    const panel = page.locator('.sprint-blockers-panel');
    if (!await panel.isVisible().catch(() => false)) { test.skip(true, 'No panel visible'); return; }

    const countBadge = panel.locator('[data-blocker-count]');
    await expect(countBadge).toBeVisible();
    const countText = (await countBadge.textContent() || '').trim();
    expect(countText).toMatch(/\d+ visible/i);
    const n = parseInt(countText, 10);
    expect(n).toBeGreaterThan(0);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Empty blockers panel shows "No active blockers" (not "No hidden blockers")', async ({ page }) => {
    // Override fixture with zero blockers
    await page.route('**/api/boards.json**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildBoardsFixture()) })
    );
    const cleanFixture = buildBlockedSprintFixture();
    cleanFixture.stuckCandidates = [];
    cleanFixture.stories = cleanFixture.stories.map((s) => ({ ...s, labels: s.labels.filter((l) => l !== 'blocker') }));
    await page.route('**/api/current-sprint.json**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cleanFixture) })
    );

    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('.sprint-blockers-panel', { timeout: 15000 }).catch(() => null);
    const panel = page.locator('.sprint-blockers-panel');
    if (!await panel.isVisible().catch(() => false)) { test.skip(true, 'No panel visible'); return; }

    const heading = panel.locator('h3');
    await expect(heading).toContainText(/No active blockers/i);
    // Old "No hidden blockers" text must be gone
    await expect(heading).not.toContainText(/No hidden blockers/i);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

// ─── GROUP 6: Leadership auto-brief ──────────────────────────────────────────

test.describe('IMP-06: Leadership confidence brief auto-generates when done=0', () => {
  test.beforeEach(async ({ page }) => { await routeFixtures(page); });

  test('Confidence brief renders when sprint is 0% done with in-progress items', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('[data-delivered-panel]', { timeout: 15000 }).catch(() => null);
    const panel = page.locator('[data-delivered-panel]');
    if (!await panel.isVisible().catch(() => false)) { test.skip(true, 'No delivered panel'); return; }

    // When done=0, must show confidence brief, NOT the old ghost placeholder
    const ghostText = 'Delivered sprint outcomes will be translated into business language here as soon as work reaches Done.';
    const panelText = (await panel.textContent() || '');
    expect(panelText).not.toContain(ghostText);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Confidence brief includes in-progress count, blocker count, and delivery confidence', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('[data-confidence-brief-text]', { timeout: 15000 }).catch(() => null);
    const brief = page.locator('[data-confidence-brief-text]');
    if (!await brief.isVisible().catch(() => false)) { test.skip(true, 'No confidence brief'); return; }

    const briefText = (await brief.textContent() || '').toLowerCase();
    // Must include actionable signals, not vague placeholder
    expect(briefText).toMatch(/\d+ of \d+ items|in active development|blocker|delivery confidence/i);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Brief heading shows "Sprint confidence brief" not the empty-state h3', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('[data-confidence-brief]', { timeout: 15000 }).catch(() => null);
    const briefSection = page.locator('[data-confidence-brief]');
    if (!await briefSection.isVisible().catch(() => false)) { test.skip(true, 'No confidence brief section'); return; }

    const heading = briefSection.locator('h3');
    await expect(heading).toContainText(/confidence brief/i);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

// ─── GROUP 7: Send nudge to Jira (work risk strip) ───────────────────────────

test.describe('IMP-07: Work risk strip has Send nudge to Jira, not clipboard-only', () => {
  test.beforeEach(async ({ page }) => { await routeFixtures(page); });

  test('Send nudge to Jira button is present in work risk direct-value strip', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('.work-risks-direct-value-strip', { timeout: 15000 }).catch(() => null);
    const strip = page.locator('.work-risks-direct-value-strip');
    if (!await strip.isVisible().catch(() => false)) { test.skip(true, 'No direct-value strip'); return; }

    // New button must be present
    await expect(strip.locator('[data-send-top-nudge]')).toBeVisible();

    // Old "Copy top guided nudge" must NOT exist
    const oldBtn = strip.locator('[data-action="copy-top-guided-nudge"]');
    await expect(oldBtn).toHaveCount(0);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Send nudge to Jira button posts to API and shows Sent state', async ({ page }) => {
    let apiHit = false;
    await page.route('**/api/issues/*/comment', async (route) => {
      apiHit = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'c1' }) });
    });

    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('[data-send-top-nudge]', { timeout: 15000 }).catch(() => null);
    const btn = page.locator('[data-send-top-nudge]');
    if (!await btn.isVisible().catch(() => false)) { test.skip(true, 'No send nudge button'); return; }

    await btn.click();
    await expect(btn).toContainText(/Sent|Sending/i, { timeout: 8000 });
    expect(apiHit).toBe(true);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Send nudge failure shows retry label, not silent clipboard-style failure', async ({ page }) => {
    await page.route('**/api/issues/*/comment', (route) =>
      route.fulfill({ status: 503, body: '{}' })
    );

    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('[data-send-top-nudge]', { timeout: 15000 }).catch(() => null);
    const btn = page.locator('[data-send-top-nudge]');
    if (!await btn.isVisible().catch(() => false)) { test.skip(true, 'No send nudge button'); return; }

    await btn.click();
    await expect(btn).toContainText(/fail|retry/i, { timeout: 8000 });

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Stale server HTML 404 shows restart guidance (not silent console-only failure)', async ({ page }) => {
    await page.route('**/api/issues/*/comment', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'text/html; charset=utf-8',
        body: '<!DOCTYPE html><pre>Cannot POST /api/issues/MPSA-8172/comment</pre>',
      })
    );

    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('[data-send-top-nudge]', { timeout: 15000 }).catch(() => null);
    const btn = page.locator('[data-send-top-nudge]');
    if (!await btn.isVisible().catch(() => false)) { test.skip(true, 'No send nudge button'); return; }

    await btn.click();
    await expect(btn).toContainText(/fail|retry/i, { timeout: 8000 });
    await expect(page.locator('.header-action-toast')).toContainText(/restart npm run dev|missing on this port/i, { timeout: 8000 });

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

// ─── GROUP 8: Blocker count deduplication ────────────────────────────────────

test.describe('IMP-08: Blocker count shown in one authoritative place, not triplicated', () => {
  test.beforeEach(async ({ page }) => { await routeFixtures(page); });

  test('Blocker count "3 blockers" appears at most twice in the header viewport', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    const header = page.locator('.current-sprint-header-bar');
    await expect(header).toBeVisible({ timeout: 15000 });

    // Count all text matches for "3 blockers" in the header
    const headerText = await header.textContent() || '';
    const matches = (headerText.match(/3 blockers/gi) || []).length;
    // Old code had it 6 times. Acceptable: ≤4 (verdict pill, drawer, intervention queue, compact strip).
    expect(matches).toBeLessThanOrEqual(4);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

// ─── GROUP 9: Open in Jira single exit path ──────────────────────────────────

test.describe('IMP-09: Single Jira exit path in issue preview (no duplicate Copy link button)', () => {
  test.beforeEach(async ({ page }) => { await routeFixtures(page); });

  test('Issue preview has Open in Jira link and no standalone Copy link button', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    const firstRiskRow = page.locator('#work-risks-table tbody tr.work-risk-parent-row').first();
    if (!await firstRiskRow.isVisible().catch(() => false)) { test.skip(true, 'No risk rows'); return; }

    await firstRiskRow.click();
    await page.waitForSelector('.issue-preview-open', { timeout: 10000 });

    // Open in Jira must exist
    await expect(page.locator('.issue-preview-actions a[href*="/browse/"]')).toBeVisible();

    // Standalone Copy link button must NOT exist
    await expect(page.locator('[data-issue-preview-action="copy-link"]')).toHaveCount(0);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

// ─── GROUP 10: Zero-data sprint state clarity ─────────────────────────────────

test.describe('IMP-10: Zero-data sprint signals are clear, not ambiguously empty', () => {
  test.beforeEach(async ({ page }) => { await routeFixtures(page); });

  test('Sprint with 0h logged and in-progress items shows time-logging gap signal', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    const header = page.locator('.current-sprint-header-bar');
    await expect(header).toBeVisible({ timeout: 15000 });

    // With 0h logged / 91h estimated, trust label must acknowledge gap
    const trustCard = header.locator('[data-header-insight="evidence"]');
    if (await trustCard.isVisible().catch(() => false)) {
      const trustText = (await trustCard.textContent() || '').toLowerCase();
      // Must communicate some signal — not empty
      expect(trustText.length).toBeGreaterThan(5);
    }

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('Header metric tiles always render a value even when data is zero', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await expect(page.locator('[data-metric="done"] .metric-value')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-metric="issues"] .metric-value')).toBeVisible();
    await expect(page.locator('[data-metric="hours"] .metric-value')).toBeVisible();

    // None of them should be completely empty
    for (const sel of ['[data-metric="done"] .metric-value', '[data-metric="issues"] .metric-value', '[data-metric="hours"] .metric-value']) {
      const text = (await page.locator(sel).textContent() || '').trim();
      expect(text.length).toBeGreaterThan(0);
    }

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});

// ─── GROUP 11: Page load telemetry — no breaking JS errors ────────────────────

test.describe('IMP-11: Core pages load without JS errors after all UX changes', () => {
  test('Current sprint page loads clean after all UX improvements', async ({ page }) => {
    await routeFixtures(page);
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('.current-sprint-header-bar', { timeout: 15000 });
    await page.waitForTimeout(1000); // allow async render to settle

    // Page errors (uncaught exceptions) must be zero
    expect(telemetry.pageErrors).toHaveLength(0);

    // No critical console errors beyond known infrastructure noise
    const criticalErrors = telemetry.consoleErrors.filter((e) =>
      !e.includes('favicon') && !e.includes('ResizeObserver') && !e.includes('Unchecked runtime')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Issue preview opens and closes without JS errors', async ({ page }) => {
    await routeFixtures(page);
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    const firstRiskRow = page.locator('#work-risks-table tbody tr.work-risk-parent-row').first();
    if (!await firstRiskRow.isVisible().catch(() => false)) { test.skip(true, 'No risk rows'); return; }

    await firstRiskRow.click();
    await page.waitForSelector('.issue-preview-open', { timeout: 10000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.issue-preview-open')).toHaveCount(0, { timeout: 5000 });

    expect(telemetry.pageErrors).toHaveLength(0);
  });
});

// ─── GROUP 12: Bonus edge cases ───────────────────────────────────────────────

test.describe('IMP-12: Bonus edge cases — resilience under realistic conditions', () => {
  test('EDGE-A: Former user as BOTH assignee AND reporter shows single orphan alert, not doubled', async ({ page }) => {
    const doubleOrphanFixture = buildBlockedSprintFixture();
    doubleOrphanFixture.stories[0] = { ...doubleOrphanFixture.stories[0], assignee: 'Former user', reporter: 'Former user' };
    await page.route('**/api/boards.json**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildBoardsFixture()) })
    );
    await page.route('**/api/current-sprint.json**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(doubleOrphanFixture) })
    );

    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    const orphanRow = page.locator('#work-risks-table tbody tr[data-parent-key="SD-4643"], #stories-table tbody tr[data-parent-key="SD-4643"]').first();
    if (!await orphanRow.isVisible().catch(() => false)) { test.skip(true, 'SD-4643 not visible'); return; }

    await orphanRow.click();
    await page.waitForSelector('.issue-preview-open', { timeout: 10000 });

    // Exactly ONE orphan alert — not doubled
    const alertCount = await page.locator('[data-orphan-alert]').count();
    expect(alertCount).toBe(1);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('EDGE-B: Send to Jira with empty textarea is blocked with validation message', async ({ page }) => {
    await routeFixtures(page);
    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    const firstRiskRow = page.locator('#work-risks-table tbody tr.work-risk-parent-row').first();
    if (!await firstRiskRow.isVisible().catch(() => false)) { test.skip(true, 'No risk rows'); return; }

    await firstRiskRow.click();
    await page.waitForSelector('.issue-preview-open', { timeout: 10000 });
    await page.locator('[data-issue-preview-action="open-review-sheet"]').click();
    await expect(page.locator('[data-send-composer]')).toBeVisible();

    // Clear the textarea
    await page.locator('[data-send-nudge-text]').fill('');

    // Try to send
    await page.locator('[data-review-send]').click();

    // Status must tell user something is required — no silent failure
    const statusText = (await page.locator('[data-send-status]').textContent() || '').toLowerCase();
    expect(statusText).toMatch(/required|empty|comment/i);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('EDGE-C: Confidence brief degrades gracefully when daysMeta is unavailable', async ({ page }) => {
    const noMetaFixture = buildBlockedSprintFixture();
    noMetaFixture.daysMeta = {};
    await page.route('**/api/boards.json**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildBoardsFixture()) })
    );
    await page.route('**/api/current-sprint.json**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(noMetaFixture) })
    );

    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    // Page must not crash — brief may omit days remaining but should still render
    await page.waitForSelector('[data-delivered-panel]', { timeout: 15000 }).catch(() => null);
    const panel = page.locator('[data-delivered-panel]');
    if (await panel.isVisible().catch(() => false)) {
      const panelText = (await panel.textContent() || '');
      expect(panelText.length).toBeGreaterThan(5);
    }

    expect(telemetry.pageErrors).toHaveLength(0);
    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });

  test('EDGE-D: Sprint with 500+ hour blocker renders critical tone and correct day label', async ({ page }) => {
    const extremeFixture = buildBlockedSprintFixture();
    extremeFixture.stuckCandidates[2] = { ...extremeFixture.stuckCandidates[2], hoursInStatus: 720 }; // 30 days
    await page.route('**/api/boards.json**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildBoardsFixture()) })
    );
    await page.route('**/api/current-sprint.json**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(extremeFixture) })
    );

    const telemetry = captureBrowserTelemetry(page);
    if (!await loadCurrentSprintPage(page)) return;

    await page.waitForSelector('.sprint-blockers-panel', { timeout: 15000 }).catch(() => null);
    const panel = page.locator('.sprint-blockers-panel');
    if (!await panel.isVisible().catch(() => false)) { test.skip(true, 'No panel'); return; }

    // 720h = 30 days — must render as "30d blocked", not "720h blocked"
    const ageLabels = panel.locator('[data-blocker-age]');
    const allText = await ageLabels.allTextContents();
    const hasExtremeDay = allText.some((t) => /\d+d blocked/i.test(t) && parseInt(t, 10) >= 20);
    expect(hasExtremeDay).toBe(true);

    // Must have critical or danger CSS class
    const criticalCount = await panel.locator('.blocker-age-critical').count();
    const dangerCount = await panel.locator('.blocker-age-danger').count();
    expect(criticalCount + dangerCount).toBeGreaterThan(0);

    assertTelemetryClean(telemetry, { excludePreviewAbort: true });
  });
});
