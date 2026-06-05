import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { scoreClaimConfidence } from '../lib/Delivera-Governance-Claim-Verify-01SSOT.js';
import { sendReadinessBadge } from '../public/Delivera-App-Governance-Brief-CommandSurface-01Helpers.js';

const SD_CANDIDATES = {
  method: 'board-epics',
  guidanceCode: null,
  totalBoardEpics: 2,
  candidates: [
    {
      issueKey: 'SD-5153',
      title: 'SD-5153 TM Should be able to see M-PESA Recharge Penetration per territory',
      selected: true,
      epicActivity: { storyCount: 4, doneCount: 1, lifecycle: 'in-flight' },
    },
    {
      issueKey: 'SD-2692',
      title: 'SD-2692 EVOD M-PESA SERVICE UPGRADE',
      selected: true,
      epicActivity: { storyCount: 2, doneCount: 0, lifecycle: 'in-flight' },
    },
  ],
};

const WIZARD_BRIEF = {
  briefId: 'WIZARD-SD',
  projects: ['SD'],
  executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
  leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked', narratedBy: 'template' },
  meta: {
    narratedBy: 'template',
    commandAnswerSentence: 'DELIVERY BLOCKED',
    safeToSend: true,
    setupGaps: [{ id: 'pi-baseline', action: 'set-baseline', severity: 'high' }],
    piConfidence: { trusted: false, confidencePct: null, counts: { committed: 0, offPlan: 2, onTrack: 0 } },
    workerReceipt: { line: 'Last run: 1m ago', inboxTotal: 0 },
  },
  topRisks: [{ issueKey: 'SD-1', assigneeName: 'Amani', squad: 'DMS board' }],
  evidencePack: { rows: [{ issueKey: 'SD-1' }] },
  squadInsights: [],
};

async function mockWizardPage(page, proposeBody = SD_CANDIDATES) {
  await page.addInitScript(() => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
    localStorage.setItem('delivera_gov_quarter_v1', 'FY24 Q4');
  });
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(WIZARD_BRIEF),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY24 Q4', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [] }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, agents: [], lastImprovements: [] }),
  }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ jiraBrowseHost: 'https://jira.example.com', boards: [{ projectKey: 'SD' }] }),
  }));
  await page.route('**/api/governance/pi-baseline/propose**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(proposeBody),
  }));
}

test.describe('PI baseline wizard direct-value', () => {
  test('unit: scoreClaimConfidence blocks safeToSend without baseline', () => {
    const withBaseline = scoreClaimConfidence({ baselineComparison: { items: [] }, freshness: { confidenceLimit: 'live' } }, {});
    const without = scoreClaimConfidence({ freshness: { confidenceLimit: 'live' } }, {});
    expect(withBaseline.safeToSend).toBe(true);
    expect(without.safeToSend).toBe(false);
  });

  test('unit: sendReadinessBadge shows fix-first when pi-baseline gap', () => {
    const badge = sendReadinessBadge({
      meta: { safeToSend: true, setupGaps: [{ id: 'pi-baseline' }] },
      freshness: { confidenceLimit: 'live' },
    });
    expect(badge.label).toMatch(/Fix promised work first/i);
    expect(badge.tier).toBe('setup');
  });

  test('setup gap opens promised-work drawer with human titles', async ({ page }) => {
    await mockWizardPage(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    const telemetry = await captureBrowserTelemetry(page);
    await expect(page.locator('.gov-visual-answer-blocks')).toBeVisible();
    await page.locator('#gov-setup-gaps-expand').click();
    await page.locator('.gov-fix-card-btn[data-setup-action="set-baseline"]').click();
    await expect(page.locator('.gov-right-drawer-panel')).toBeVisible();
    await expect(page.locator('[data-testid="gov-baseline-context"]')).toContainText('SD');
    await expect(page.locator('[data-testid="gov-baseline-context"]')).toContainText('FY24 Q4');
    const body = page.locator('.gov-baseline-wizard');
    await expect(body).not.toContainText(/board-epics/i);
    await expect(body).not.toContainText(/PI commitments/i);
    await expect(body).not.toContainText(/Uncheck items/i);
    const row = page.locator('[data-testid="gov-baseline-row"]').first();
    await expect(row.locator('.gov-baseline-row-title')).toContainText(/M-PESA Recharge Penetration/i);
    await expect(row.locator('.gov-baseline-row-title')).not.toContainText(/^SD-5153/);
    await expect(row.locator('.gov-baseline-activity')).toContainText(/\d+ stories in sprint/i);
    assertTelemetryClean(telemetry);
  });

  test('save promised work posts baseline and closes drawer', async ({ page }) => {
    let saved = false;
    await mockWizardPage(page);
    await page.route('**/api/governance/pi-baseline', async (route) => {
      if (route.request().method() === 'POST') {
        saved = true;
        const body = route.request().postDataJSON();
        expect(body.committedItems?.length).toBeGreaterThan(0);
        expect(body.committedItems[0].issueKey).toMatch(/^SD-/);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        return;
      }
      await route.continue();
    });
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await page.locator('#gov-setup-gaps-expand').click();
    await page.locator('.gov-fix-card-btn[data-setup-action="set-baseline"]').click();
    await page.locator('[data-testid="gov-baseline-save"]').click();
    await expect.poll(() => saved).toBe(true);
    await expect(page.locator('#delivera-gov-right-drawer')).toBeHidden();
  });

  test('command bar hides Safe to send when pi-baseline gap open', async ({ page }) => {
    await mockWizardPage(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    const badge = page.locator('.gov-command-answer .gov-send-badge');
    await expect(badge.first()).toContainText(/Fix promised work first/i);
    await expect(badge).not.toContainText(/Safe to send/i);
  });
});
