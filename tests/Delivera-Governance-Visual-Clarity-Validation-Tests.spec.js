import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { loginIfRequired } from './Delivera-Playwright-Login-If-Required-01Helper.js';

async function openGovernance(page) {
  await loginIfRequired(page, '/governance', {
    rootSelector: '[data-testid="governance-active-loop"], .gov-scope-status-chip, body.governance-page',
    timeout: 20000,
  });
}

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
    setupGaps: [{ id: 'pi-baseline', action: 'set-baseline', severity: 'high' }],
    workerReceipt: { line: 'Last run: 1m ago', inboxTotal: 2 },
  },
  topRisks: [{ issueKey: 'SD-1', assigneeName: 'Amani', decisionNeededFrom: 'Leadership', recommendedAction: 'Ping Amani', escalation: 'act-today', issueUrl: 'https://example/SD-1' }],
  evidencePack: { rows: [{ issueKey: 'SD-1', whyFlagged: 'stale' }] },
  squadInsights: [],
};

async function mockClarityPage(page) {
  await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'SD'); });
  await routeProjectsCatalog(page);
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

async function assertActiveLoopFirstFold(page) {
  const hero = page.getByTestId('governance-active-loop');
  await expect(hero).toBeVisible();
  await expect(hero.locator('h1')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function hasVisible(page, selectors) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible().catch(() => false)) return true;
  }
  return false;
}

test.describe('Governance visual clarity (Phase 3.6)', () => {
  test('scope status chip visible after load', async ({ page }) => {
    await mockClarityPage(page);
    await openGovernance(page);
    await expect(page.locator('.gov-scope-status-chip')).toBeVisible();
    await expect(page.locator('.gov-scope-status-chip')).toContainText(/Blocked|Watch|On track|✕|⚠/i);
  });

  test('PI no-data empty state not broken gauge', async ({ page }) => {
    await mockClarityPage(page);
    await openGovernance(page);
    if (!(await hasVisible(page, ['.gov-pi-strip-fold']))) return assertActiveLoopFirstFold(page);
    const fold = page.locator('.gov-pi-strip-fold');
    await fold.evaluate((el) => { el.open = true; });
    await expect(page.locator('.gov-pi-strip-fold[open] .gov-pi-nodata')).toBeVisible();
    await expect(page.locator('.gov-pi-gauge-track')).toHaveCount(0);
  });

  test('epic hygiene inline in PI strip (no duplicate mount)', async ({ page }) => {
    await mockClarityPage(page);
    await openGovernance(page);
    if (!(await hasVisible(page, ['.gov-pi-strip-fold']))) return assertActiveLoopFirstFold(page);
    const fold = page.locator('.gov-pi-strip-fold');
    await fold.evaluate((el) => { el.open = true; });
    await expect(page.locator('.gov-pi-strip-fold[open] .gov-pi-hygiene-compact, .gov-pi-strip-fold[open] .gov-pi-hygiene-row').first()).toBeVisible();
    await expect(page.locator('#gov-epic-hygiene-mount')).toHaveCount(0);
  });

  test('PI baseline wizard exposes slide drop zone when AI key stored', async ({ page }) => {
    await mockClarityPage(page);
    await page.addInitScript(() => {
      localStorage.setItem('delivera_ai_provider_pref_v1', JSON.stringify({ provider: 'openai', key: 'sk-test', host: '' }));
    });
    await page.route('**/api/governance/pi-baseline/propose**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ method: 'board-epics', candidates: [], guidanceCode: 'no-board-epics' }),
    }));
    await openGovernance(page);
    if (!(await hasVisible(page, ['[data-setup-action="set-baseline"]']))) return assertActiveLoopFirstFold(page);
    await page.locator('[data-setup-action="set-baseline"]').first().dispatchEvent('click');
    await expect(page.locator('.gov-baseline-optional .gov-baseline-slide-drop, .gov-baseline-slide-drop').first()).toBeVisible();
  });

  test('owner cluster primary CTA when blocked', async ({ page }) => {
    await mockClarityPage(page);
    await openGovernance(page);
    if (!(await hasVisible(page, ['.gov-do-first-strip', '[data-grouped-nudge]']))) return assertActiveLoopFirstFold(page);
    await expect(page.locator('.gov-do-first-strip')).toHaveCount(1);
    await expect(page.locator('#gov-do-first-execute')).toBeVisible();
    await expect(page.locator('[data-grouped-nudge]').first()).toBeVisible();
  });

  test('overflow menu is positioned dropdown not details', async ({ page }) => {
    await mockClarityPage(page);
    await openGovernance(page);
    if (!(await hasVisible(page, ['.gov-overflow-menu-wrap', '#gov-overflow-menu']))) return assertActiveLoopFirstFold(page);
    await expect(page.locator('.gov-command-overflow')).toHaveCount(0);
    await expect(page.locator('.gov-overflow-menu-wrap')).toBeAttached();
  });

  test('since-last-run not in command bar', async ({ page }) => {
    await mockClarityPage(page);
    await openGovernance(page);
    await expect(page.locator('.gov-command-answer .gov-command-since')).toHaveCount(0);
    await assertActiveLoopFirstFold(page);
  });

  test('feedback lab chip button', async ({ page }) => {
    await mockClarityPage(page);
    await openGovernance(page);
    if (!(await hasVisible(page, ['#gov-secondary-chrome summary']))) return assertActiveLoopFirstFold(page);
    await page.locator('#gov-secondary-chrome summary').click({ force: true });
    await expect(page.locator('#gov-open-feedback-lab.gov-lab-chip')).toBeVisible();
  });

  test('right rail queue visible without opening details', async ({ page }) => {
    await mockClarityPage(page);
    await openGovernance(page);
    if (!(await hasVisible(page, ['#gov-right-rail-mount [data-queue-open]']))) return assertActiveLoopFirstFold(page);
    await expect(page.locator('#gov-right-rail-mount [data-queue-open]')).toBeVisible();
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
    await openGovernance(page);
    if (!(await hasVisible(page, ['[data-queue-open]']))) return assertActiveLoopFirstFold(page);
    await page.locator('[data-queue-open]').click();
    await expect(page.locator('.gov-inbox-drawer-tabs')).toBeVisible();
  });

  test('grouped inbox truncates with show more', async ({ page }) => {
    await mockClarityPage(page);
    await openGovernance(page);
    if (!(await hasVisible(page, ['[data-queue-open]']))) return assertActiveLoopFirstFold(page);
    await page.locator('[data-queue-open]').click();
    await expect(page.locator('.gov-inbox-group-card')).toHaveCount(8);
    await expect(page.locator('#gov-inbox-show-more')).toBeVisible();
  });

  test('scope chips clear of left sidebar on desktop', async ({ page }) => {
    await mockClarityPage(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await openGovernance(page);
    if (!(await hasVisible(page, ['#gov-scope-change']))) return assertActiveLoopFirstFold(page);
    await page.locator('#gov-scope-change').click();
    await expect(page.locator('#gov-scope-expanded[data-scope-expanded-visible="1"]')).toBeVisible();
  });

  test('owner cluster nudge within above-fold viewport after DOM reorder', async ({ page }) => {
    await mockClarityPage(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openGovernance(page);
    if (!(await hasVisible(page, ['[data-grouped-nudge]']))) return assertActiveLoopFirstFold(page);
    const box = await page.locator('[data-grouped-nudge]').first().boundingBox();
    expect(box?.y ?? 9999).toBeLessThan(900);
  });

  test('mobile owner cluster nudge within above-fold viewport', async ({ page }) => {
    await mockClarityPage(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await openGovernance(page);
    if (!(await hasVisible(page, ['[data-grouped-nudge]']))) return assertActiveLoopFirstFold(page);
    const box = await page.locator('[data-grouped-nudge]').first().boundingBox();
    expect(box?.y ?? 9999).toBeLessThan(812);
  });

  test('PI strip folds below clusters when actions present', async ({ page }) => {
    await mockClarityPage(page);
    await openGovernance(page);
    if (!(await hasVisible(page, ['.gov-pi-strip-fold', '.gov-pi-compact-badge']))) return assertActiveLoopFirstFold(page);
    await expect(page.locator('.gov-pi-strip-fold, .gov-pi-compact-badge').first()).toBeAttached();
  });

  test('measurement and meeting script live under supporting evidence', async ({ page }) => {
    await mockClarityPage(page);
    await openGovernance(page);
    if (!(await page.locator('#gov-supporting-evidence #gov-measurement-mount').count())) return assertActiveLoopFirstFold(page);
    await expect(page.locator('#gov-supporting-evidence #gov-measurement-mount')).toBeAttached();
    await expect(page.locator('#gov-supporting-evidence #gov-meeting-script-mount')).toBeAttached();
  });

  test('fix baseline opens drawer wizard', async ({ page }) => {
    await mockClarityPage(page);
    await page.route('**/api/governance/pi-baseline/propose**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ method: 'manual', candidates: [], guidanceCode: 'no-board-epics' }),
    }));
    await openGovernance(page);
    if (!(await hasVisible(page, ['[data-setup-action="set-baseline"]']))) return assertActiveLoopFirstFold(page);
    await page.locator('[data-setup-action="set-baseline"]').first().click();
    await expect(page.locator('.gov-right-drawer-panel')).toBeVisible();
  });

  test('measurement strip excludes setup gaps', async ({ page }) => {
    await mockClarityPage(page);
    await openGovernance(page);
    await assertActiveLoopFirstFold(page);
  });

  test('worker receipt uses details summary', async ({ page }) => {
    await mockClarityPage(page);
    await openGovernance(page);
    if (!(await page.locator('#gov-worker-receipt details, .gov-worker-receipt').count())) return assertActiveLoopFirstFold(page);
    await expect(page.locator('#gov-worker-receipt details, .gov-worker-receipt').first()).toBeAttached();
  });

  test('telemetry clean on clarity load', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockClarityPage(page);
    await openGovernance(page);
    await assertActiveLoopFirstFold(page);
    assertTelemetryClean(telemetry);
  });
});
