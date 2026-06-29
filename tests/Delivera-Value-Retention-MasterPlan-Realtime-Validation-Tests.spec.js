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
import { waitForLegacyBriefHydrated } from './Delivera-Portfolio-Primary-Test-Helpers.js';

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

async function clearBriefClientCache(page) {
  await page.evaluate(() => {
    try { sessionStorage.removeItem('delivera:brief:cache:v1'); } catch (_) {}
  });
}

async function stubGovernanceBrief(page, overrides = {}) {
  await page.unroute(/\/api\/governance-brief\.json/);
  await page.route(/\/api\/governance-brief\.json/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: stubRetentionBrief(overrides),
    });
  });
}

async function mockPortfolioDecisionForRetention(page) {
  await page.route('**/api/quarters-list**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/interventions/seed-from-brief**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, cases: [{ id: 'SD-1', project: 'SD', needsApproval: true, title: 'Stuck payment flow' }] }),
  }));
  await page.route('**/api/governance/portfolio-decision.json**', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        decision: {
          headline: 'SD needs scope confirmation',
          summary: 'Two squads need watch on PI commitments.',
          narrative: { headline: 'SD needs scope confirmation', mainIssue: 'Evidence gap, not yet proven delivery failure' },
          aboveFold: { exposedCommitments: 2, actionsReady: 1, poResponsesRequired: 1, nextDeadline: 'Today 15:00' },
          affectedCommitments: [{ id: 'SD-1', title: 'Stuck payment flow', status: 'At risk', reason: 'Stuck', decisionNeeded: 'Confirm scope' }],
          preparedActions: { groups: [{ role: 'Product Owner', count: 1, label: '1 Product Owner' }], items: [{ role: 'Product Owner', action: 'Confirm scope', owner: 'Product Owner' }], totalReady: 1, nextDeadline: 'Today 15:00' },
          metrics: { delivery: { value: 20, peerMedian: 50 }, offPlanLoad: { value: 30, peerMedian: 10 }, proofConfidence: { value: 28, peerMedian: 48 } },
          trust: { liveCases: 1, nudgesReady: 1, proofLevel: 'Low' },
          drivers: [{ title: 'Impact exposure', summary: '2 squads behind PI commitments.' }],
          decisionProgression: [{ step: 'confirm-scope', label: 'Confirm scope', active: true }],
          decisionBasis: { why: 'Confirm scope and proof', preparedNudges: 1, nextCheckpoint: 'Today 15:00' },
          decisionOptions: [
            { id: 'keep-funding', label: 'Keep funding', useWhen: 'Scope confirmed', effect: 'No change', impactPreview: 'Continue monitoring.' },
            { id: 'review-investment', label: 'Review investment', useWhen: 'Evidence weak', effect: 'Pause allocation', impactPreview: 'Validate before investing.' },
            { id: 'move-capacity', label: 'Move capacity', useWhen: 'Peer stronger', effect: 'Reassign', impactPreview: 'Not yet recommended.' },
          ],
          monitoring: { squadCount: 2, commitmentCount: 8, exposedCommitmentCount: 2 },
          anchorProject: 'SD',
          periodKey: 'FY27 Q1',
          recommendation: { label: 'Confirm scope and proof before investment review' },
          peerComparison: { sentence: 'Proof confidence differs — address evidence before delivery claims.' },
        },
        comparison: {
          cards: [
            { projectKey: 'SD', squadName: 'SD', selected: true, status: 'At risk', statusClass: 'at-risk', mainIssue: 'Scope and proof', explanation: 'SD: blocked delivery path.', metrics: { delivered: 20, proofConfidence: 28 } },
            { projectKey: 'DMS', squadName: 'DMS', selected: false, status: 'Watch', statusClass: 'watch', mainIssue: 'Monitoring', explanation: 'DMS: fewer governance gaps.', metrics: { delivered: 50, proofConfidence: 48 } },
          ],
          actionsStrip: { nudgesReady: 1, proofLevel: 'Low' },
        },
        cases: [{ id: 'SD-1', project: 'SD', needsApproval: true }],
      }),
    });
  });
}

function legacyBriefMount(page, selector) {
  return page.locator(`#gov-verdict-mount ${selector}`);
}

function legacyScopeBarMount(page, selector) {
  return page.locator(`#gov-scope-bar-mount ${selector}`);
}

async function clickLegacyBrief(page, selector) {
  await waitForLegacyBriefHydrated(page);
  await page.evaluate((sel) => {
    document.querySelector(`#gov-verdict-mount ${sel}`)?.click();
  }, selector);
}

async function clickLegacyScopeBar(page, selector) {
  await page.waitForSelector(`#gov-scope-bar-mount ${selector}`, { timeout: 20000, state: 'attached' });
  await page.evaluate((sel) => {
    document.querySelector(`#gov-scope-bar-mount ${sel}`)?.click();
  }, selector);
}

async function waitForGovernanceReady(page) {
  await page.waitForSelector('[data-portfolio-signal]', { timeout: 25000 });
  await page.waitForSelector('#main-content[data-gov-brief-state="content"]', { timeout: 25000 });
  await waitForLegacyBriefHydrated(page);
}

async function waitForLegacyInvestmentReady(page) {
  await page.waitForResponse(
    (res) => res.url().includes('/api/governance-brief.json') && res.ok(),
    { timeout: 25000 },
  ).catch(() => {});
  await page.waitForSelector('#gov-scope-bar-mount [data-investment-open]', { timeout: 25000, state: 'attached' });
}

async function gotoGovernanceFresh(page, path = '/governance?refresh=1') {
  await clearBriefClientCache(page);
  const briefWait = page.waitForResponse(
    (res) => res.url().includes('/api/governance-brief.json') && res.ok(),
    { timeout: 20000 },
  );
  await page.goto(path);
  await briefWait;
  await waitForGovernanceReady(page);
}

test.describe('Value retention master plan realtime validation', () => {
  test.describe.configure({ retries: 0 });

  test('@focused value-retention master plan contracts', async ({ page }) => {
    test.setTimeout(240000);
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
    await mockPortfolioDecisionForRetention(page);
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

    await test.step('03 portfolio signal and legacy rollup context', async () => {
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForGovernanceReady(page);
      await expect(page.locator('[data-portfolio-above-fold]')).toBeVisible();
      await expect(legacyBriefMount(page, '[data-portfolio-banner]')).toContainText(/behind PI/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('04 heat tiles sorted blocked first', async () => {
      await expect(legacyBriefMount(page, '[data-heat-tile]').first()).toHaveAttribute('data-verdict-tier', 'blocked');
      assertTelemetryClean(telemetry);
    });

    await test.step('05 squad roles on expanded tile', async () => {
      await clickLegacyBrief(page, '[data-heat-tile="SD"]');
      await expect(page.locator('#gov-verdict-mount [data-squad-roles]')).toHaveCount(1);
      assertTelemetryClean(telemetry);
    });

    await test.step('06 squad nudge opens mention sheet', async () => {
      await clickLegacyBrief(page, '[data-squad-nudge="SD"]');
      await expect(page.locator('#delivera-jira-nudge-review-sheet .jira-nudge-mention-row')).toBeVisible({ timeout: 10000 });
      await page.locator('[data-review-cancel]').click();
      await expect(page.locator('#delivera-jira-nudge-review-sheet')).toBeHidden({ timeout: 5000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('07 period chip persists after reload', async () => {
      await waitForGovernanceReady(page);
      await clickLegacyScopeBar(page, '[data-period-chip="14d"]');
      await page.reload();
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForGovernanceReady(page);
      await expect(legacyScopeBarMount(page, '.gov-period-chip.is-on').first()).toContainText(/14d/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('08 single-squad auto-expand tile detail', async () => {
      await page.evaluate((projectsKey) => {
        try { localStorage.setItem(projectsKey, 'SD'); } catch (_) {}
      }, PROJECTS_SSOT_KEY);
      await page.route(/\/api\/governance-brief\.json/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: stubRetentionBrief({
            projects: ['SD'],
            squadInsights: [{
              projectKey: 'SD',
              verdictTier: 'blocked',
              boardResolved: true,
              sprintPulse: { done: 1, committed: 5, pct: 20 },
              bottleneckLine: 'Payment API blocked',
              piCommitted: 5,
              piDone: 1,
              offPlanHours: 12,
              cardRisks: [{ issueKey: 'SD-1', displayTitle: 'Stuck' }],
            }],
            portfolioRollup: { summaryLine: 'Out of 1 squads · 1 behind PI', behindPiCount: 1 },
          }),
        });
      });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForGovernanceReady(page);
      await expect(legacyBriefMount(page, '[data-tile-detail="SD"]')).toHaveCount(1);
      await expect(page.locator('.gov-comparison-refine')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('09 investment drawer tab and hour rows', async () => {
      await page.evaluate((projectsKey) => {
        try { localStorage.setItem(projectsKey, 'SD,DMS'); } catch (_) {}
      }, PROJECTS_SSOT_KEY);
      await page.route(/\/api\/governance-brief\.json/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: stubRetentionBrief({
            meta: {
              teamRoster: [{ displayName: 'Alex Morgan' }],
              workerReceipt: { sinceLastRun: '12m ago' },
              periodWindow: '28d',
              partialProjects: ['DMS'],
              boardSummaries: { 1: { registeredWorkHours: 120 } },
            },
          }),
        });
      });
      await clearBriefClientCache(page);
      await page.goto('/governance?refresh=1');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForGovernanceReady(page);
      await clickLegacyScopeBar(page, '[data-investment-open]');
      await expect(page.locator('[data-drawer-tab="investment"]')).toBeVisible({ timeout: 10000 });
      await page.locator('[data-drawer-tab="investment"]').click();
      await expect(page.locator('[data-investment-row="pi"]')).toBeVisible();
      await expect(page.locator('[data-investment-row="pi"] strong')).toContainText(/partial/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('10 drawer tab restores investment after reload', async () => {
      await page.evaluate(() => {
        try { sessionStorage.setItem('gov-drawer-active-tab', 'investment'); } catch (_) {}
      });
      await page.reload();
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForGovernanceReady(page);
      await clickLegacyScopeBar(page, '[data-investment-open]');
      await expect(page.locator('[data-drawer-tab="investment"]')).toHaveClass(/is-active/);
      await expect(page.locator('[data-drawer-panel="investment"]')).toHaveClass(/is-active/);
      assertTelemetryClean(telemetry);
    });

    await test.step('11 stale banner period combo and readOnly nudge', async () => {
      await page.route(/\/api\/governance-brief\.json/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: stubRetentionBrief({
            freshness: { confidenceLimit: 'stale', generatedAt: new Date().toISOString() },
            meta: { periodWindow: '14d', teamRoster: [{ displayName: 'Alex Morgan' }] },
          }),
        });
      });
      await clearBriefClientCache(page);
      await page.goto('/governance?refresh=1');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForGovernanceReady(page);
      await expect(legacyBriefMount(page, '[data-portfolio-banner]')).toContainText(/stale/i);
      await expect(legacyScopeBarMount(page, '.gov-period-chip.is-on').first()).toHaveCount(1);
      await clickLegacyBrief(page, '[data-heat-tile="SD"]');
      await clickLegacyBrief(page, '[data-squad-nudge="SD"]');
      await expect(page.locator('#delivera-jira-nudge-review-sheet [data-review-send]')).toBeDisabled();
      await expect(page.locator('#delivera-jira-nudge-review-sheet .jira-nudge-review-trust')).toContainText(/stale brief/i);
      await page.locator('[data-review-cancel]').click();
      assertTelemetryClean(telemetry);
    });

    await test.step('12 alignment strip on sprint', async () => {
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-alignment-strip]')).toBeVisible({ timeout: 20000 });
      await page.locator('[data-alignment-strip] details').evaluate((el) => { el.open = true; });
      await expect(page.locator('.work-alignment-chip').first()).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('13 blocker root cause row', async () => {
      await expect(page.locator('[data-blocker-root-cause]').first()).toBeVisible({ timeout: 20000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('14 report hides duplicate feedback toggle', async () => {
      await page.goto('/report');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#feedback-toggle')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('15 mobile governance no horizontal overflow', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      expect(overflow).toBe(false);
      assertTelemetryClean(telemetry);
    });

    await test.step('16 desktop governance two-column density', async () => {
      await page.setViewportSize({ width: 1280, height: 768 });
      await page.addInitScript((projectsKey) => {
        try { localStorage.setItem(projectsKey, 'SD,DMS'); } catch (_) {}
      }, PROJECTS_SSOT_KEY);
      await stubGovernanceBrief(page);
      await gotoGovernanceFresh(page, '/governance?refresh=1');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#main-content[data-gov-brief-state="content"]')).toBeVisible({ timeout: 20000 });
      const portfolioLayout = await page.locator('#portfolio-layout').isVisible();
      expect(portfolioLayout).toBe(true);
      await expect(page.locator('[data-portfolio-signal]')).toBeVisible();
      await expect(legacyBriefMount(page, '[data-heat-tile]').first()).toHaveCount(1);
      assertTelemetryClean(telemetry);
    });

    await test.step('17 desktop 1024 sprint stories and cockpit side by side', async () => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      const sideBySide = await page.evaluate(() => {
        const stories = document.querySelector('.sprint-cards-column');
        const cockpit = document.querySelector('.sprint-cockpit-column');
        if (!stories || !cockpit) return false;
        return stories.getBoundingClientRect().left < cockpit.getBoundingClientRect().left;
      });
      expect(sideBySide).toBe(true);
      assertTelemetryClean(telemetry);
    });

    await test.step('18 period window drift changes banner', async () => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.addInitScript(() => {
        try { sessionStorage.setItem('gov-period-window', '28d'); } catch (_) {}
      });
      await page.route(/\/api\/governance-brief\.json/, async (route) => {
        const url = new URL(route.request().url());
        const periodWindow = url.searchParams.get('periodWindow') || '28d';
        const offPlanHours = periodWindow === '14d' ? 4 : 12;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: stubRetentionBrief({
            freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
            meta: { periodWindow, teamRoster: [{ displayName: 'Alex Morgan' }] },
            squadInsights: [
              {
                projectKey: 'SD',
                verdictTier: 'blocked',
                boardResolved: true,
                offPlanHours,
                offPlanEpicCount: 2,
                piCommitted: 5,
                piDone: 1,
                cardRisks: [{ issueKey: 'SD-1' }],
              },
              {
                projectKey: 'DMS',
                verdictTier: 'watch',
                boardResolved: true,
                offPlanHours: 2,
                piCommitted: 3,
                piDone: 2,
                cardRisks: [],
              },
            ],
          }),
        });
      });
      await page.evaluate(() => {
        try {
          sessionStorage.setItem('gov-period-window', '28d');
          sessionStorage.removeItem('delivera:brief:cache:v1');
        } catch (_) {}
      });
      await page.goto('/governance?refresh=1');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForGovernanceReady(page);
      await page.waitForSelector('#gov-scope-bar-mount [data-period-chip]', { state: 'attached', timeout: 20000 });
      await expect(legacyScopeBarMount(page, '.gov-period-chip.is-on').first()).toContainText(/28d/i);
      await clickLegacyScopeBar(page, '[data-period-chip="14d"]');
      await expect(legacyScopeBarMount(page, '.gov-period-chip.is-on').first()).toContainText(/14d/i, { timeout: 15000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('19 empty roster nudge opens without crash', async () => {
      await page.route(/\/api\/governance-brief\.json/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: stubRetentionBrief({
            freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
            meta: { teamRoster: [], periodWindow: '28d' },
          }),
        });
      });
      await page.evaluate(() => {
        try { sessionStorage.removeItem('delivera:brief:cache:v1'); } catch (_) {}
      });
      await page.goto('/governance?refresh=1');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForGovernanceReady(page);
      await page.waitForSelector('#gov-verdict-mount [data-heat-tile="SD"]', { state: 'attached', timeout: 20000 });
      await page.evaluate(() => { try { window.__deliveraCurrentSprintPayload = null; } catch (_) {} });
      await clickLegacyBrief(page, '[data-heat-tile="SD"]');
      const detail = legacyBriefMount(page, '[data-tile-detail="SD"]');
      if (!(await detail.isVisible())) await clickLegacyBrief(page, '[data-heat-tile="SD"]');
      await expect(legacyBriefMount(page, '[data-squad-nudge="SD"]')).toHaveCount(1);
      await clickLegacyBrief(page, '[data-squad-nudge="SD"]');
      await expect(page.locator('#jira-nudge-review-text')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.jira-nudge-mention-row')).toHaveCount(0);
      await page.locator('[data-review-cancel]').click();
      assertTelemetryClean(telemetry);
    });

    await test.step('20 zero investment hours drawer stable', async () => {
      await page.evaluate((projectsKey) => {
        try { localStorage.setItem(projectsKey, 'SD,DMS'); } catch (_) {}
      }, PROJECTS_SSOT_KEY);
      await page.route(/\/api\/governance-brief\.json/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: stubRetentionBrief({
            projects: ['SD', 'DMS'],
            portfolioRollup: { summaryLine: 'Out of 2 squads · on track', behindPiCount: 0 },
            squadInsights: [
              {
                projectKey: 'SD',
                verdictTier: 'watch',
                boardResolved: true,
                offPlanHours: 0,
                piCommitted: 0,
                piDone: 0,
                cardRisks: [],
              },
              {
                projectKey: 'DMS',
                verdictTier: 'watch',
                boardResolved: true,
                offPlanHours: 0,
                piCommitted: 0,
                piDone: 0,
                cardRisks: [],
              },
            ],
            meta: {
              teamRoster: [],
              periodWindow: '28d',
              boardSummaries: { 1: { registeredWorkHours: 0 } },
            },
          }),
        });
      });
      await clearBriefClientCache(page);
      await page.goto('/governance?refresh=1');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForGovernanceReady(page);
      await clickLegacyScopeBar(page, '[data-investment-open]');
      await page.locator('[data-drawer-tab="investment"]').click();
      await expect(page.locator('[data-investment-row="pi"] strong')).toContainText(/0h/);
      assertTelemetryClean(telemetry);
    });

    await test.step('21 no SM PO hides roles row E2', async () => {
      await stubGovernanceBrief(page, {
        squadInsights: [{
          projectKey: 'SD',
          verdictTier: 'watch',
          boardResolved: true,
          offPlanHours: 2,
          offPlanEpicCount: 1,
          piCommitted: 2,
          piDone: 1,
          cardRisks: [{ issueKey: 'SD-2' }],
          squadRoles: {},
        }],
      });
      await gotoGovernanceFresh(page);
      if (await skipIfRedirectedToLogin(page, test)) return;
      await clickLegacyBrief(page, '[data-heat-tile="SD"]');
      await expect(page.locator('[data-squad-roles]')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('22 proof chip opens drawer on proof tab UX-12', async () => {
      await page.route(/\/api\/governance-brief\.json/, async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: stubRetentionBrief() });
      });
      await page.evaluate((projectsKey) => {
        try {
          localStorage.setItem(projectsKey, 'SD,DMS');
          sessionStorage.removeItem('gov-drawer-active-tab');
        } catch (_) {}
      }, PROJECTS_SSOT_KEY);
      await clearBriefClientCache(page);
      await page.goto('/governance?refresh=1');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForGovernanceReady(page);
      await page.waitForSelector('#gov-verdict-mount [data-heat-tile="SD"]', { state: 'attached', timeout: 15000 });
      await clickLegacyBrief(page, '[data-heat-tile="SD"]');
      await clickLegacyBrief(page, '[data-proof-squad="SD"]');
      await expect(page.locator('[data-drawer-tab="proof"]')).toHaveClass(/is-active/);
      await expect(page.locator('[data-drawer-panel="proof"]')).toHaveClass(/is-active/);
      assertTelemetryClean(telemetry);
    });

    await test.step('23 sidebar open keeps desktop two-column grid E6', async () => {
      await page.setViewportSize({ width: 1280, height: 768 });
      await gotoGovernanceFresh(page, '/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#main-content[data-gov-brief-state="content"]')).toBeVisible({ timeout: 20000 });
      await page.evaluate(() => document.body.classList.add('sidebar-open'));
      const twoCol = await page.evaluate(() => {
        const shell = document.querySelector('#portfolio-layout');
        if (!shell) return false;
        const cols = getComputedStyle(shell).gridTemplateColumns;
        return cols.split(' ').filter(Boolean).length >= 2;
      });
      expect(twoCol).toBe(true);
      assertTelemetryClean(telemetry);
    });

    await test.step('24 jira squad roles source E8', async () => {
      await stubGovernanceBrief(page, {
        squadInsights: [{
          projectKey: 'SD',
          verdictTier: 'watch',
          boardResolved: true,
          squadRoles: {
            source: 'jira',
            scrumMaster: { displayName: 'Jira SM' },
            productOwner: { displayName: 'Jira PO' },
          },
          cardRisks: [],
        }],
      });
      await gotoGovernanceFresh(page);
      if (await skipIfRedirectedToLogin(page, test)) return;
      await clickLegacyBrief(page, '[data-heat-tile="SD"]');
      await expect(page.locator('#gov-verdict-mount [data-squad-roles]')).toHaveCount(1);
      assertTelemetryClean(telemetry);
    });

    await test.step('25 alignment chip on drift row F1', async () => {
      await stubGovernanceBrief(page, {
        meta: { piBaselineCommittedKeys: ['SD-100'] },
        squadInsights: [{
          projectKey: 'SD',
          verdictTier: 'blocked',
          boardResolved: true,
          offPlanHours: 8,
          offPlanEpicCount: 2,
          cardRisks: [{ issueKey: 'SD-1', epicKey: 'SD-999' }],
        }],
      });
      await gotoGovernanceFresh(page);
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForGovernanceReady(page);
      await clickLegacyBrief(page, '[data-heat-tile="SD"]');
      await expect(legacyBriefMount(page, '[data-squad-drift-row] .work-alignment-chip')).toHaveCount(1);
      await expect(legacyBriefMount(page, '[data-squad-drift-row] .work-alignment-chip')).toContainText(/off pi/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('26 supporting evidence collapsed when clusters', async () => {
      await stubGovernanceBrief(page);
      await gotoGovernanceFresh(page, '/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await waitForGovernanceReady(page);
      await page.waitForSelector('#gov-supporting-evidence', { state: 'attached', timeout: 15000 });
      const open = await page.locator('#gov-supporting-evidence').getAttribute('open');
      expect(open).toBeNull();
      assertTelemetryClean(telemetry);
    });

    await test.step('27 report feedback panel empty with top chrome UX-13', async () => {
      await page.goto('/report');
      if (await skipIfRedirectedToLogin(page, test)) return;
      const inner = await page.locator('#feedback-panel').innerHTML();
      expect(inner.trim()).toBe('');
      assertTelemetryClean(telemetry);
    });

    await test.step('28 portfolio calibration inline excerpt and copy E2', async () => {
      await stubGovernanceBrief(page, {
        meta: { protectMeAnswer: 'SD squad protected launch X due to external block.' },
      });
      await gotoGovernanceFresh(page);
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('[data-portfolio-calibration-inline]', { timeout: 15000 });
      await expect(page.locator('[data-portfolio-calibration-inline]')).toContainText(/protected launch/i);
      await expect(page.locator('[data-portfolio-action="copy-calibration-defense"]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('29 partial project pivot shows signal not zero-state E2', async () => {
      await stubGovernanceBrief(page, {
        meta: { partialProjects: ['DMS'], setupGaps: [{ id: 'pi-baseline', action: 'set-baseline', label: 'Set PI baseline' }] },
        projects: ['SD', 'DMS'],
      });
      await gotoGovernanceFresh(page);
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('[data-portfolio-signal]', { timeout: 20000 });
      await expect(page.locator('[data-portfolio-signal] .portfolio-signal-headline')).not.toHaveText(/^$/);
      assertTelemetryClean(telemetry);
    });
  });
});
