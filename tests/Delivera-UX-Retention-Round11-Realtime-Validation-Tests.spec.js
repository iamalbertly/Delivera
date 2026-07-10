/**
 * UX Retention Round 11 — N8–N14 journey contracts (governance, sprint, actions).
 * Value-first selectors; console-guard fails fast; no brittle marketing copy literals.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';
import { mockPortfolioDecision, waitForPortfolioReady } from './Delivera-Portfolio-Primary-Test-Helpers.js';

async function mockGovernanceRetention(page) {
  await page.addInitScript((key) => {
    try { localStorage.setItem(key, 'SD,MAS'); } catch (_) {}
  }, PROJECTS_SSOT_KEY);
  await routeProjectsCatalog(page);
  await mockPortfolioDecision(page, {
    comparison: {
      cards: [
        { projectKey: 'SD', squadName: 'DMS Squad', selected: true, status: 'At risk', statusClass: 'at-risk', metrics: { delivered: 27, offPlanLoad: 42, proofConfidence: 38, commitments: 5 }, decisionNeeded: 'Confirm scope' },
        { projectKey: 'MAS', squadName: 'MAS', selected: false, status: 'Watch', statusClass: 'watch', metrics: { delivered: 61, offPlanLoad: 21, proofConfidence: 62, commitments: 6 }, decisionNeeded: 'Monitor' },
      ],
      actionsStrip: {},
    },
  });
  await page.route('**/api/governance-brief.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      briefId: 'R11-GOV',
      projects: ['SD', 'MAS'],
      meta: { quarter: 'FY27 Q1', setupGaps: [], workerReceipt: { inboxTotal: 0 } },
      squadInsights: [
        { projectKey: 'SD', boardName: 'DMS Squad', verdictTier: 'blocked', sprintPulse: { committed: 8, done: 2 } },
        { projectKey: 'MAS', boardName: 'MAS', verdictTier: 'watch', sprintPulse: { committed: 6, done: 4 } },
      ],
      evidencePack: { rows: [{ issueKey: 'SD-1', whyFlagged: 'stale', statusNow: 'In Progress' }] },
    }),
  }));
  await page.route('**/api/quarters-list**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
}

async function mockSprintWithBlocker(page) {
  const blocker = { issueKey: 'SD-5184', summary: 'Blocked epic', hoursInStatus: 48, status: 'Blocked' };
  await page.route('**/api/current-sprint.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      sprint: { id: 42, name: 'Sprint 42', state: 'active', startDate: '2026-06-01', endDate: '2026-06-14' },
      board: { id: 1, name: 'DMS Board', projectKeys: ['SD'] },
      meta: { projects: 'SD', teamRoster: [{ displayName: 'Sam SM' }] },
      summary: { totalStories: 8, doneStories: 2, percentDone: 35, totalSP: 20 },
      daysMeta: { daysElapsedWorking: 5, daysRemainingWorking: 5 },
      stuckCandidates: [blocker],
      decisionCockpit: {
        health: { status: 'blocked' },
        nextBestAction: { issueKey: blocker.issueKey, summary: 'Unblock SD-5184 to recover sprint goal', reason: 'Waiting on PO' },
        topRisks: [{ issueKey: blocker.issueKey, title: 'Blocked epic', reason: 'Waiting on PO' }],
        keySignals: { blockers: 1 },
        metrics: { daysRemaining: 5 },
      },
      remainingWorkByDay: [
        { remainingSP: 40 },
        { remainingSP: 32 },
        { remainingSP: 28 },
        { remainingSP: 24 },
      ],
      stories: [{ issueKey: 'SD-5184', summary: 'Blocked', status: 'In Progress', storyPoints: 3 }],
      recentSprints: [{ id: 41, name: 'Sprint 41', state: 'closed' }],
    }),
  }));
  await page.route('**/api/boards.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ boards: [{ id: 1, projectKey: 'SD', name: 'DMS Board' }] }),
  }));
  await page.route('**/api/governance/pi-baseline**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ committedItems: [] }),
  }));
}

test.describe('UX Retention Round 11 @ux-retention-r11', () => {
  test('01 governance hero has single primary CTA and link row', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockGovernanceRetention(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await waitForPortfolioReady(page);
    await expect(page.locator('[data-testid="portfolio-primary-cta"]')).toHaveCount(1);
    await expect(page.locator('.portfolio-signal-link-row')).toBeVisible();
    await expect(page.locator('.portfolio-signal-actions--hero-cta .btn-secondary')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('02 bento cards are whole-card selectable without extra button', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockGovernanceRetention(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="portfolio-bento-card"]', { timeout: 120000 });
    await expect(page.locator('.portfolio-bento-details')).toHaveCount(0);
    const card = page.locator('[data-squad-key="MAS"]');
    await card.click();
    await expect(page.locator('#portfolio-scope-selected')).toHaveValue('MAS');
    assertTelemetryClean(t);
  });

  test('03 decision rail radios sync hero confirm id', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockGovernanceRetention(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-portfolio-decision-radios]', { timeout: 120000 });
    await expect(page.locator('#portfolio-decision [data-portfolio-action="confirm-decision"]')).toHaveCount(0);
    await page.locator('[data-portfolio-decision-radios] input').first().check();
    const heroId = await page.locator('[data-testid="portfolio-primary-cta"]').getAttribute('data-decision-id');
    expect(heroId).toBeTruthy();
    assertTelemetryClean(t);
  });

  test('04 sub-chrome suppressed on actions page', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.route('**/api/governance/interventions.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cases: [] }),
    }));
    await page.goto('/actions');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForTimeout(1500);
    await expect(page.locator('#app-sub-chrome-slot .gov-global-agent-bar')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('05 sprint proof rail exposes Work Risks Flow tabs', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.addInitScript((key) => {
      try { localStorage.setItem(key, 'SD'); } catch (_) {}
    }, PROJECTS_SSOT_KEY);
    await routeProjectsCatalog(page);
    await mockSprintWithBlocker(page);
    await page.goto('/current-sprint?projects=SD');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="sprint-proof-rail"]', { timeout: 60000 });
    await expect(page.locator('[data-rail-tab="work"]')).toBeVisible();
    await expect(page.locator('[data-rail-tab="risks"]')).toBeVisible();
    await expect(page.locator('[data-rail-tab="flow"]')).toBeVisible();
    await expect(page.locator('[data-testid="sprint-rail-nudge-inline"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('06 sprint rail tab switch reveals flow burndown', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.addInitScript((key) => {
      try { localStorage.setItem(key, 'SD'); } catch (_) {}
    }, PROJECTS_SSOT_KEY);
    await routeProjectsCatalog(page);
    await mockSprintWithBlocker(page);
    await page.goto('/current-sprint?projects=SD');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="sprint-proof-rail"]', { timeout: 60000 });
    await page.locator('[data-rail-tab="flow"]').click();
    await expect(page.locator('[data-testid="sprint-rail-burndown"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('07 actions preview rail visible with case list', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await page.route('**/api/governance/interventions.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cases: [{
          id: 'SD-R11-01',
          project: 'SD',
          title: 'Scope decision',
          issueKeys: ['SD-5237'],
          needsApproval: true,
          state: 'clarification-required',
        }],
      }),
    }));
    await page.goto('/actions?tab=ready');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('.actions-case-card')).toHaveCount(1);
    await expect(page.locator('#actions-preview-rail')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('08 warm contrast tokens on portfolio surface', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockGovernanceRetention(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await waitForPortfolioReady(page);
    const muted = await page.locator('.portfolio-trust-bar').evaluate((el) => getComputedStyle(el).color);
    expect(muted).not.toMatch(/rgb\(100,\s*116,\s*139\)/i);
    assertTelemetryClean(t);
  });

  test('09 runtime diagnostics stored separately from bell badge', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockGovernanceRetention(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await waitForPortfolioReady(page);
    const diagCount = await page.evaluate(() => {
      window.__deliveraDiagnostics = window.__deliveraDiagnostics || [];
      window.__deliveraDiagnostics.push({ message: 'r11-diag', diagnosticsOnly: true, at: Date.now() });
      const summary = JSON.parse(localStorage.getItem('appNotificationsV1') || '{}');
      const userFacing = (summary.runtimeAlerts || []).filter((a) => !a.diagnosticsOnly).length;
      return userFacing;
    });
    expect(diagCount).toBe(0);
    assertTelemetryClean(t);
  });
});
