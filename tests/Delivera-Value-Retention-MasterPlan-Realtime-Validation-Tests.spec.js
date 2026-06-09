/**
 * Value retention master plan — unified feedback, squad leaderboard, alignment, investment.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';

function stubRetentionBrief(overrides = {}) {
  return JSON.stringify({
    briefId: 'retention-brief',
    projects: ['SD', 'DMS'],
    leadershipNarrative: { meetingAnswer: 'Two squads need watch.', confidence: 'medium' },
    executiveView: { verdictLabel: 'Watch', businessHeadline: 'Portfolio needs attention.' },
    deliveryTruth: { done: 3, committed: 8 },
    topRisks: [{ issueKey: 'SD-1', summary: 'Stuck', assigneeName: 'Alex', escalation: 'act-today' }],
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    squadInsights: [
      {
        projectKey: 'SD',
        verdictTier: 'blocked',
        boardResolved: true,
        sprintPulse: { done: 1, committed: 5, pct: 20 },
        bottleneckLine: 'Payment API blocked',
        productivityLine: 'Stale work detected',
        piCommitted: 5,
        piDone: 1,
        piGap: 4,
        offPlanHours: 12,
        offPlanEpicCount: 2,
        squadRoles: { scrumMaster: { displayName: 'Sam Lee' }, productOwner: { displayName: 'Alex Morgan' } },
        cardRisks: [{ issueKey: 'SD-1', displayTitle: 'Stuck payment flow' }],
      },
      {
        projectKey: 'DMS',
        verdictTier: 'watch',
        boardResolved: true,
        sprintPulse: { done: 2, committed: 4, pct: 50 },
        bottleneckLine: 'None',
        piCommitted: 3,
        piDone: 2,
        piGap: 1,
        offPlanHours: 2,
        cardRisks: [],
      },
    ],
    portfolioRollup: { summaryLine: 'Out of 2 squads · 2 behind PI · 1 heavy ad-hoc', behindPiCount: 2 },
    meta: {
      teamRoster: [{ displayName: 'Alex Morgan' }, { displayName: 'Sam Lee' }],
      workerReceipt: { sinceLastRun: '12m ago' },
      periodWindow: '28d',
      piConfidence: { trusted: true, counts: { committed: 8 } },
      ...overrides.meta,
    },
    evidencePack: { rows: [] },
    ownerGroups: [{ ownerKey: 'alex', issues: [{ issueKey: 'SD-1', summary: 'Stuck' }], decisionLane: 'Assignee' }],
    ...overrides,
  });
}

test.describe('Value retention master plan realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('@focused value-retention master plan contracts', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.addInitScript((projectsKey) => {
      try { localStorage.setItem(projectsKey, 'SD,DMS'); } catch (_) {}
    }, PROJECTS_SSOT_KEY);

    await page.route(/\/api\/governance-brief\.json/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: stubRetentionBrief() });
    });
    await page.route(/\/api\/governance\/inbox\.json/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nudges: [], confirm: [], briefs: [], piDrift: [], impact: [], poReadiness: [] }) });
    });
    await page.route(/\/api\/governance\/feedback-summary\.json/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.route(/\/feedback$/, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      await route.continue();
    });
    await page.route(/\/api\/governance\/pi-baseline/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ committedItems: [{ issueKey: 'SD-100' }] }),
      });
    });
    await page.route(/\/api\/current-sprint\.json/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sprint: { id: 1, name: 'Sprint 1', state: 'active' },
          meta: { projects: 'SD', teamRoster: [{ displayName: 'Dev One' }] },
          summary: { totalStories: 3, doneStories: 1 },
          stories: [
            { issueKey: 'SD-10', epicKey: 'SD-100', status: 'In Progress', loggedHours: 4 },
            { issueKey: 'SD-11', epicKey: '', status: 'To Do', loggedHours: 2 },
          ],
          stuckCandidates: [{ issueKey: 'SD-9', summary: 'Blocked API', hoursInStatus: 36, assignee: 'Dev One' }],
        }),
      });
    });

    await test.step('01 improve delivera button in top chrome', async () => {
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-top-action="improve-delivera"]')).toHaveCount(1);
      assertTelemetryClean(telemetry);
    });

    await test.step('02 improve modal submits feedback', async () => {
      await page.locator('[data-top-action="improve-delivera"]').click();
      await expect(page.locator('#delivera-improve-modal')).toBeVisible();
      await page.locator('#delivera-improve-message').fill('Need faster squad compare');
      await page.locator('#delivera-improve-submit').click();
      await expect(page.locator('#delivera-improve-status')).toContainText(/received/i, { timeout: 10000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('03 portfolio banner shows behind count', async () => {
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-portfolio-banner]')).toContainText(/behind PI/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('04 heat tiles sorted blocked first', async () => {
      const fold = page.locator('.gov-verdict-fold summary');
      if (await fold.count()) await fold.click();
      await expect(page.locator('[data-heat-tile]').first()).toHaveAttribute('data-verdict-tier', 'blocked');
      assertTelemetryClean(telemetry);
    });

    await test.step('05 squad roles on expanded tile', async () => {
      await page.locator('[data-heat-tile="SD"]').click();
      await expect(page.locator('[data-squad-roles]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('06 squad nudge opens mention sheet', async () => {
      await page.locator('[data-squad-nudge="SD"]').click();
      await expect(page.locator('#delivera-jira-nudge-review-sheet .jira-nudge-mention-row')).toBeVisible({ timeout: 10000 });
      await page.locator('[data-review-cancel]').click();
      await expect(page.locator('#delivera-jira-nudge-review-sheet')).toBeHidden({ timeout: 5000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('07 period chip persists after reload', async () => {
      await page.locator('[data-period-chip="14d"]').click({ force: true });
      await page.reload();
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-period-chip="14d"]')).toHaveClass(/is-on/);
      assertTelemetryClean(telemetry);
    });

    await test.step('08 alignment strip on sprint', async () => {
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-alignment-strip]')).toBeVisible({ timeout: 20000 });
      await page.locator('[data-alignment-strip] details').evaluate((el) => { el.open = true; });
      await expect(page.locator('.work-alignment-chip').first()).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('09 blocker root cause row', async () => {
      await expect(page.locator('[data-blocker-root-cause]').first()).toBeVisible({ timeout: 20000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('10 report hides duplicate feedback toggle', async () => {
      await page.goto('/report');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#feedback-toggle')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('11 mobile governance no horizontal overflow', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      expect(overflow).toBe(false);
      assertTelemetryClean(telemetry);
    });
  });
});
