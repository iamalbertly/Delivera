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

    await test.step('Stage A: verdict zone visible, no attention table above fold', async () => {
      await page.goto('/governance');
      if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
      await expect(page.locator('.gov-verdict-zone')).toBeVisible();
      await expect(page.locator('.gov-verdict-zone')).toHaveAttribute('data-verdict-tier', 'blocked');
      await expect(page.locator('.gov-verdict-business-line')).toContainText(/M-Pesa/i);
      await expect(page.locator('main .attention-queue-table')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage B: do-now cards with nudge', async () => {
      await expect(page.locator('.gov-donow-card')).toHaveCount(1);
      await expect(page.locator('[data-donow-nudge="0"]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage C: issues drawer open with Jira link', async () => {
      await expect(page.locator('details.gov-issues-drawer[open]')).toBeVisible();
      const link = page.locator('.gov-issue-key-link').first();
      await expect(link).toHaveAttribute('href', /browse\/SD-5184/i);
      await page.evaluate(() => {
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar) sidebar.style.pointerEvents = 'none';
      });
      await page.locator('.gov-issue-row').first().hover({ force: true });
      await expect(page.locator('.gov-issue-row-detail').first()).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage D: measurement risks not in do-now', async () => {
      await expect(page.locator('.gov-donow-card')).not.toContainText(/DMS board/i);
      await expect(page.locator('.gov-measurement-strip')).toContainText(/measure/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage E: meeting script collapsed; copy meeting answer works', async () => {
      const script = page.locator('details.gov-meeting-script');
      await expect(script).toBeVisible();
      await expect(script).not.toHaveAttribute('open', '');
      await page.locator('#gov-copy-meeting').click();
      await expect(page.locator('#gov-copy-meeting')).toContainText(/Copied/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('Stage F: proof section holds full risk cards', async () => {
      await page.locator('#gov-supporting-evidence summary').click();
      await expect(page.locator('#gov-proof-risks .governance-risk')).toHaveCount(2);
      assertTelemetryClean(telemetry);
    });
  });
});
