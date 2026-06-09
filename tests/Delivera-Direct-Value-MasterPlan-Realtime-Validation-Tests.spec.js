/**
 * Direct-to-value master plan — journey-value UI + logcat per step.
 * Structural contracts (roles, data attrs, counts) — not brittle copy strings.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';

function stubBriefBody(overrides = {}) {
  return JSON.stringify({
    briefId: 'test-brief',
    projects: ['SD'],
    leadershipNarrative: { meetingAnswer: 'Delivery is on track for SD.', confidence: 'medium' },
    executiveView: { verdictLabel: 'Watch', businessHeadline: 'One risk needs follow-up.' },
    deliveryTruth: { done: 3, committed: 5 },
    topRisks: [
      { issueKey: 'SD-1', summary: 'Stuck item', assigneeName: 'Alex', recommendedAction: 'Unblock', escalation: 'act-today' },
      { issueKey: 'SD-2', summary: 'Blocked review', assigneeName: 'Alex', recommendedAction: 'Review today', escalation: 'act-today' },
    ],
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    meta: {
      narratedBy: 'template',
      workerReceipt: { inboxTotal: 0 },
      safeToSend: true,
      piConfidence: {
        trusted: true,
        confidencePct: 82,
        counts: { committed: 12, offPlan: 1, onTrack: 3, missingDates: 0, atRisk: 1 },
        timelineChips: [],
      },
      teamRoster: [
        { accountId: 'acc-1', displayName: 'Alex Morgan' },
        { accountId: 'acc-2', displayName: 'Sam Lee' },
      ],
      ...overrides.meta,
    },
    evidencePack: { rows: [{ issueKey: 'SD-1', statusNow: 'In Progress', statusLastWeek: 'To Do', whyFlagged: 'No update' }] },
    ...overrides,
  });
}

test.describe('Direct value master plan realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('@focused cross-surface direct-value contracts', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.addInitScript((projectsKey) => {
      try { localStorage.setItem(projectsKey, 'SD'); } catch (_) {}
    }, PROJECTS_SSOT_KEY);

    await page.route(/\/api\/governance-brief\.json/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: stubBriefBody() });
    });
    await page.route(/\/api\/governance\/inbox\.json/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nudges: [], confirm: [], briefs: [], piDrift: [], impact: [], poReadiness: [] }),
      });
    });
    await page.route(/\/api\/governance\/feedback-summary\.json/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });

    await test.step('01 governance answer surface loads', async () => {
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-answer-mount .gov-command-answer')).toBeVisible({ timeout: 20000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('02 surface switcher uses Answer Today Proof labels', async () => {
      await expect(page.locator('[data-top-surface="governance"]')).toContainText(/Answer/i);
      await expect(page.locator('a[data-top-surface="sprints"]')).toContainText(/Today/i);
      await expect(page.locator('a[data-top-surface="report"]')).toContainText(/Proof/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 AI trust pill present in top chrome', async () => {
      await expect(page.locator('[data-ai-trust-pill]')).toHaveCount(1);
      assertTelemetryClean(telemetry);
    });

    await test.step('04 evidence tabs mounted when supporting evidence exists', async () => {
      const evidence = page.locator('#gov-supporting-evidence');
      if (await evidence.count()) {
        await evidence.locator('summary').click();
        await expect(page.locator('.gov-evidence-tabs [data-evidence-tab]')).toHaveCount(3);
      }
      assertTelemetryClean(telemetry);
    });

    await test.step('05 today surface scope deduped when header bar active', async () => {
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.current-sprint-header-bar[data-context-bar="true"]')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('#current-sprint-scope-chip')).toBeHidden();
      assertTelemetryClean(telemetry);
    });

    await test.step('06 proof header refresh proof single action', async () => {
      await page.goto('/report');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-report-refresh-proof]')).toHaveCount(1);
      assertTelemetryClean(telemetry);
    });

    await test.step('07 proof mission strip has context bar', async () => {
      await expect(page.locator('#report-filter-strip-summary .app-context-bar, #report-filter-strip-summary .context-bar')).toHaveCount(1);
      assertTelemetryClean(telemetry);
    });

    await test.step('08 settings has no placeholder surface grid', async () => {
      await page.goto('/settings');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.surface-grid-three')).toHaveCount(0);
      await expect(page.locator('#gov-settings-ai-mount')).toHaveCount(1);
      await expect(page.locator('#gov-settings-ai-mount #gov-ai-helper')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('09 PI compact badge visible when owner clusters exist', async () => {
      await page.setViewportSize({ width: 1400, height: 900 });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-pi-compact-badge]')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('.gov-owner-cluster')).toHaveCount(1, { timeout: 20000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('10 governance nudge shows @mention chips from teamRoster', async () => {
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      const nudgeBtn = page.locator('[data-grouped-nudge="0"]');
      await expect(nudgeBtn).toBeVisible({ timeout: 20000 });
      await nudgeBtn.click();
      await expect(page.locator('#delivera-jira-nudge-review-sheet .jira-nudge-mention-row')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.jira-nudge-mention-chip').first()).toContainText(/@/);
      assertTelemetryClean(telemetry);
    });

    await test.step('11 evidence tab restores Plan after reload', async () => {
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      const evidence = page.locator('#gov-supporting-evidence');
      await evidence.locator('summary').click();
      await page.locator('[data-evidence-tab="plan"]').click();
      await expect(page.locator('[data-evidence-tab="plan"]')).toHaveClass(/is-active/);
      await page.reload();
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-answer-mount .gov-command-answer')).toBeVisible({ timeout: 20000 });
      await evidence.locator('summary').click();
      await expect(page.locator('[data-evidence-tab="plan"]')).toHaveClass(/is-active/);
      await expect(page.locator('[data-evidence-panel="plan"]')).toHaveClass(/is-active/);
      assertTelemetryClean(telemetry);
    });
  });
});
