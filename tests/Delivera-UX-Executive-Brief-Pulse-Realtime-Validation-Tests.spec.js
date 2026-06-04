import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

const SD_FIXTURE = {
  portfolio: 'SD',
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
      squad: 'DMS board',
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

    await test.step('Stage A: verdict zone visible, no attention table above fold', async () => {
      await page.goto('/governance');
      if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
      await expect(page.locator('.gov-owner-cluster')).toBeVisible();
      await page.locator('.gov-verdict-fold summary').click();
      await expect(page.locator('.gov-verdict-zone')).toBeVisible();
      await expect(page.locator('.gov-verdict-zone')).toHaveAttribute('data-verdict-tier', 'blocked');
      await expect(page.locator('.gov-verdict-business-line')).toContainText(/M-Pesa/i);
      await expect(page.locator('main .attention-queue-table')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage B: owner cluster with grouped nudge', async () => {
      await expect(page.locator('.gov-owner-cluster')).toHaveCount(1);
      await expect(page.locator('[data-grouped-nudge="0"]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage C: cluster issue list expands', async () => {
      await page.locator('[data-cluster-toggle="0"]').click();
      await expect(page.locator('.gov-cluster-issue-key').first()).toContainText(/SD-5184/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage D: measurement risks not in owner cluster', async () => {
      await expect(page.locator('.gov-owner-cluster')).not.toContainText(/DMS board/i);
      await expect(page.locator('.gov-measurement-strip')).toContainText(/Data gaps|Story point/i);
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

    await test.step('Stage F: proof section holds full risk cards', async () => {
      await page.locator('#gov-supporting-evidence > summary.governance-evidence-summary').click();
      await expect(page.locator('#gov-proof-risks .governance-risk')).toHaveCount(2);
      assertTelemetryClean(telemetry);
    });
  });
});
