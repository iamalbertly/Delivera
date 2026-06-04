import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

const CLARITY_BRIEF = {
  briefId: 'CLARITY-TEST',
  projects: ['SD'],
  executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
  leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked', narratedBy: 'template' },
  meta: {
    narratedBy: 'template',
    commandAnswerSentence: 'DELIVERY BLOCKED — act today',
    safeToSend: true,
    sinceLastRun: { summary: 'Since last brief: +1 blocker' },
    piConfidence: {
      trusted: false,
      confidencePct: null,
      headline: 'PI Confidence: Not trusted',
      timelineChips: [],
      counts: { committed: 0, offPlan: 2, onTrack: 0, missingDates: 2, atRisk: 0 },
    },
    epicHygiene: { score: 40, epicCount: 4, weak: [{ issueKey: 'SD-1' }], bySquad: [{ squad: 'SD board', score: 40 }], suggestions: [] },
    adHocEpics: [{ issueKey: 'SD-99', summary: 'Ad hoc', reason: 'not baseline' }],
    setupGaps: [{ id: 'pi-baseline', label: 'PI baseline missing', action: 'set-baseline', severity: 'high' }],
    workerReceipt: { line: 'Last run: 1m ago', inboxTotal: 2 },
  },
  topRisks: [{ issueKey: 'SD-1', assigneeName: 'Amani', decisionNeededFrom: 'Leadership', recommendedAction: 'Ping Amani', escalation: 'act-today', issueUrl: 'https://example/SD-1' }],
  evidencePack: { rows: [{ issueKey: 'SD-1', whyFlagged: 'stale' }] },
  squadInsights: [],
};

async function mockClarityPage(page) {
  await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'SD'); });
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(CLARITY_BRIEF),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      briefs: Array.from({ length: 10 }, (_, i) => ({
        id: `b${i}`, type: 'brief', summary: `Ready ${i}`, safeToSend: true, approvalRequired: false,
        payload: { owner: `Owner${i}`, riskType: `reason${i % 3}`, board: `P${i % 4}` },
      })),
      nudges: [], piDrift: [], confirm: [], impact: [], poReadiness: [],
    }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ total: 1, agents: [], lastImprovements: ['1 phrase'] }),
  }));
  await page.route('**/api/governance/scope-intelligence.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ scope: { cards: [{ projectKey: 'SD', health: 'blocked', sprint: 'active', epicCount: 1 }] }, boards: 1 }),
  }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ projects: ['SD'], boards: [{ id: 1, name: 'SD board', projectKey: 'SD' }], projectErrors: [] }),
  }));
}

test.describe('Governance visual clarity (Phase 3.6)', () => {
  test('scope status chip visible after load', async ({ page }) => {
    await mockClarityPage(page);
    await page.goto('/governance');
    await expect(page.locator('.gov-scope-status-chip')).toBeVisible();
    await expect(page.locator('.gov-scope-status-chip')).toContainText(/Blocked|✕/i);
  });

  test('PI no-data empty state not broken gauge', async ({ page }) => {
    await mockClarityPage(page);
    await page.goto('/governance');
    await expect(page.locator('.gov-pi-nodata')).toBeVisible();
    await expect(page.locator('.gov-pi-gauge-track')).toHaveCount(0);
  });

  test('epic hygiene inline in PI strip', async ({ page }) => {
    await mockClarityPage(page);
    await page.goto('/governance');
    await expect(page.locator('.gov-pi-hygiene-row')).toBeVisible();
    await expect(page.locator('#gov-epic-hygiene-mount')).toBeEmpty();
  });

  test('do-first strip when blocked', async ({ page }) => {
    await mockClarityPage(page);
    await page.goto('/governance');
    await expect(page.locator('.gov-do-first-strip')).toBeVisible();
  });

  test('overflow menu is positioned dropdown not details', async ({ page }) => {
    await mockClarityPage(page);
    await page.goto('/governance');
    await expect(page.locator('.gov-command-overflow')).toHaveCount(0);
    await page.locator('#gov-overflow-toggle').click();
    await expect(page.locator('.gov-overflow-menu')).toBeVisible();
    await expect(page.locator('#gov-protect-me')).toBeVisible();
  });

  test('since-last-run not in command bar', async ({ page }) => {
    await mockClarityPage(page);
    await page.goto('/governance');
    await expect(page.locator('.gov-command-answer .gov-command-since')).toHaveCount(0);
  });

  test('feedback lab chip button', async ({ page }) => {
    await mockClarityPage(page);
    await page.goto('/governance');
    await expect(page.locator('#gov-open-feedback-lab.gov-lab-chip')).toBeVisible();
  });

  test('queue drawer shows icon tabs for multiple sections', async ({ page }) => {
    await mockClarityPage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        briefs: [{ id: 'b1', type: 'brief', summary: 'Ready', safeToSend: true, approvalRequired: false, payload: { owner: 'A', board: 'SD' } }],
        nudges: [{ id: 'n1', type: 'nudge', summary: 'Nudge', payload: { owner: 'B', board: 'SD' } }],
        confirm: [{ id: 'c1', type: 'confirm', summary: 'Confirm', payload: { owner: 'C', board: 'SD' } }],
        piDrift: [], impact: [], poReadiness: [],
      }),
    }));
    await page.goto('/governance');
    await page.locator('.gov-top-chrome-summary').click();
    await page.locator('[data-queue-open]').click();
    await expect(page.locator('.gov-inbox-drawer-tabs')).toBeVisible();
    await expect(page.locator('[data-queue-tab="confirm"]')).toBeEnabled();
    await page.locator('[data-queue-tab="confirm"]').click();
    await expect(page.locator('.gov-inbox-group-card')).toContainText(/Confirm/i);
  });

  test('grouped inbox truncates with show more', async ({ page }) => {
    await mockClarityPage(page);
    await page.goto('/governance');
    await page.locator('.gov-top-chrome-summary').click();
    await page.locator('[data-queue-open]').click();
    await expect(page.locator('.gov-inbox-group-card')).toHaveCount(8);
    await expect(page.locator('#gov-inbox-show-more')).toBeVisible();
  });

  test('scope chips clear of left sidebar on desktop', async ({ page }) => {
    await mockClarityPage(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/governance');
    await page.locator('#gov-scope-change').click();
    const chip = page.locator('.gov-scope-chip').first();
    await expect(chip).toBeVisible();
    const box = await chip.boundingBox();
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(200);
  });

  test('fix baseline opens drawer wizard', async ({ page }) => {
    await mockClarityPage(page);
    await page.route('**/api/governance/pi-baseline/propose**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ method: 'manual', candidates: [], guidance: 'Add PI items in Jira.' }),
    }));
    await page.goto('/governance');
    await page.locator('.gov-fix-card-btn[data-setup-action="set-baseline"]').click();
    await expect(page.locator('.gov-right-drawer-panel')).toBeVisible();
    await expect(page.locator('.gov-baseline-wizard-title')).toContainText(/PI baseline/i);
  });

  test('measurement strip excludes setup gaps', async ({ page }) => {
    const withRisks = {
      ...CLARITY_BRIEF,
      risks: [{ issueKey: 'SD-2', squad: 'SD', displayTitle: 'Gap risk', riskLabel: 'stale' }],
    };
    await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'SD'); });
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(withRisks),
    }));
    await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [] }) }));
    await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }) }));
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [] }) }));
    await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, agents: [], lastImprovements: [] }) }));
    await page.goto('/governance');
    const strip = page.locator('.gov-measurement-strip');
    if (await strip.count()) {
      await expect(strip).not.toContainText(/PI baseline missing/i);
    }
  });

  test('worker receipt uses details summary', async ({ page }) => {
    await mockClarityPage(page);
    await page.goto('/governance');
    await page.locator('.gov-top-chrome-summary').click();
    await expect(page.locator('.gov-receipt-details summary')).toContainText(/Agent/i);
  });

  test('telemetry clean on clarity load', async ({ page }) => {
    await mockClarityPage(page);
    const telemetry = await captureBrowserTelemetry(page);
    await page.goto('/governance');
    await expect(page.locator('.gov-visual-answer-blocks')).toBeVisible();
    assertTelemetryClean(telemetry);
  });
});
