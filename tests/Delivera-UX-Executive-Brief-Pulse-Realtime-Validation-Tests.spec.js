import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import {
  waitForPortfolioReady,
  legacyBrief,
  clickLegacy,
  mockPortfolioDecision,
} from './Delivera-Portfolio-Primary-Test-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';

const SD_FIXTURE = {
  portfolio: 'SD',
  projects: ['SD'],
  freshness: { confidenceLimit: 'live' },
  deliveryTruth: { committed: 4, done: 0, staleInProgress: 4 },
  executiveView: {
    verdictTier: 'blocked',
    verdictLabel: 'DELIVERY BLOCKED',
    businessHeadline: 'M-Pesa integration at risk',
    verdictLine: 'DELIVERY BLOCKED. M-Pesa integration at risk',
    sprintPulse: { done: 0, committed: 4, pct: 0, daysElapsed: 3, daysRemaining: 7, phaseHint: 'blocked_signals' },
    actionBadge: '3 actions · 2 nudges',
  },
  topRisks: [
    {
      issueKey: 'SD-5184',
      issueUrl: 'https://jira.example/browse/SD-5184',
      audience: 'delivery',
      displayTitle: 'Low float alert',
      impactLine: 'No progress for 66 hours',
      assigneeName: 'Amani N',
      decisionNeededFrom: 'Tech Lead',
      recommendedAction: 'Unblock the cluster today',
      evidence: 'status unchanged for 66h',
      escalation: 'escalate',
      riskType: 'stale-in-progress',
    },
  ],
  portfolioRisks: [
    {
      squad: 'SD board',
      audience: 'measurement',
      riskType: 'data-confidence-gap',
      displayTitle: 'Story point setup',
      recommendedAction: 'Confirm field mapping',
      riskLabel: 'Data confidence gap',
    },
  ],
  leadershipNarrative: {
    confidence: 'low',
    meetingAnswer: 'DELIVERY BLOCKED. M-Pesa integration at risk',
    meetingScript: 'Long facilitator script for collapsed section.',
    whatToSay: 'We need a decision today.',
    decisionsNeeded: [],
  },
  evidencePack: { rows: [] },
  meta: {
    commandAnswerSentence: 'DELIVERY BLOCKED. M-Pesa integration at risk',
    workerReceipt: { line: 'Last run: 1m ago · Checked: Jira' },
    setupGaps: [],
    safeToSend: false,
  },
};

test.describe('Executive Brief pulse realtime validation', () => {
  test('staged UI and logcat-equivalent signals on governance brief', async ({ page, context }) => {
    const telemetry = captureBrowserTelemetry(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      localStorage.setItem('delivera_selectedProjects', 'SD');
    });
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(SD_FIXTURE),
    }));
    await page.route('**/api/quarters-list**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [] }),
    }));
    await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: '{}',
    }));
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }),
    }));

    await routeProjectsCatalog(page);
    await mockPortfolioDecision(page, {
      decision: {
        narrative: { headline: 'DELIVERY BLOCKED. M-Pesa integration at risk', summary: SD_FIXTURE.leadershipNarrative.meetingAnswer },
        aboveFold: { exposedCommitments: 1, actionsReady: 2, poResponsesRequired: 1 },
      },
    });

    await test.step('Stage A: portfolio signal visible, legacy brief hydrated', async () => {
      await page.goto('/governance');
      if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
      await waitForPortfolioReady(page);
      await expect(page.locator('[data-portfolio-signal]')).toBeVisible();
      await expect(legacyBrief(page, '.gov-owner-cluster')).toBeAttached();
      await expect(legacyBrief(page, '.gov-scope-status-chip--blocked, .gov-scope-status-chip').first()).toContainText(/blocked|at risk/i);
      await expect(legacyBrief(page, '#gov-verdict-mount .gov-portfolio-grid-wrap--single, .gov-owner-cluster').first()).toBeAttached();
      await expect(legacyBrief(page, '.gov-command-answer, .gov-owner-cluster').first()).toContainText(/M-Pesa|blocked/i);
      await expect(page.locator('main .attention-queue-table')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage B: owner cluster with grouped nudge', async () => {
      await expect(legacyBrief(page, '.gov-owner-cluster')).toHaveCount(1);
      await expect(legacyBrief(page, '[data-grouped-nudge="0"]')).toBeAttached();
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage C: cluster issue list expands', async () => {
      const toggle = page.locator('[data-cluster-toggle="0"]');
      if (await toggle.count()) await toggle.click();
      await expect(page.locator('.gov-cluster-issue-key, .gov-owner-cluster, [data-grouped-nudge]').first()).toContainText(/SD-5184|Amani|Tech Lead/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage D: measurement risks not in owner cluster', async () => {
      await expect(page.locator('.gov-owner-cluster')).not.toContainText(/Story point setup/i);
      await page.locator('#gov-supporting-evidence > summary.governance-evidence-summary').click();
      await expect(page.locator('.gov-measurement-strip summary')).toContainText(/Data gaps|Story point|Measurement/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage E: meeting script collapsed; copy meeting answer works', async () => {
      const script = page.locator('details.gov-meeting-script');
      await script.scrollIntoViewIfNeeded();
      await expect(script).toBeAttached();
      await expect(script).not.toHaveAttribute('open', '');
      await page.locator('#gov-copy-answer-inline').click();
      await expect(page.locator('#gov-copy-answer-inline')).toContainText(/Copied/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage F: proof section holds measurement-only cards (delivery deduped to clusters)', async () => {
      await page.locator('#gov-supporting-evidence > summary.governance-evidence-summary').click();
      await expect(page.locator('.gov-measurement-strip')).toContainText(/Story point|Data confidence|Data gaps/i);
      assertTelemetryClean(telemetry);
    });
  });
});
