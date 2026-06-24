import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import {
  waitForPortfolioReady,
  legacyBrief,
  clickLegacy,
  mockPortfolioDecision,
} from './Delivera-Portfolio-Primary-Test-Helpers.js';

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
  await mockPortfolioDecision(page);
}

async function loadClarityPage(page) {
  await page.goto('/governance');
  if (page.url().includes('/login')) return false;
  await waitForPortfolioReady(page);
  return true;
}

async function openPiStripFoldIfPresent(page) {
  const fold = page.locator('.gov-pi-strip-fold');
  if (!(await fold.count())) return;
  await fold.waitFor({ state: 'attached' });
  await fold.evaluate((el) => { el.open = true; });
  await expect(fold).toHaveAttribute('open', '');
}

test.describe('Governance visual clarity (Phase 3.6)', () => {
  test('scope status chip visible after load', async ({ page }) => {
    await mockClarityPage(page);
    await loadClarityPage(page);
    await expect(page.locator('[data-portfolio-signal]')).toBeVisible();
    await expect(legacyBrief(page, '.gov-scope-status-chip')).toBeAttached();
    await expect(legacyBrief(page, '.gov-scope-status-chip')).toContainText(/Blocked|✕/i);
  });

  test('PI no-data empty state not broken gauge', async ({ page }) => {
    await mockClarityPage(page);
    await loadClarityPage(page);
    await expect(legacyBrief(page, '.gov-owner-cluster, .gov-scope-status-chip').first()).toBeAttached();
    await openPiStripFoldIfPresent(page);
    await expect(page.locator('.gov-pi-strip-fold[open] .gov-pi-nodata')).toBeVisible();
    await expect(page.locator('.gov-pi-gauge-track')).toHaveCount(0);
  });

  test('epic hygiene inline in PI strip (no duplicate mount)', async ({ page }) => {
    await mockClarityPage(page);
    await loadClarityPage(page);
    await expect(legacyBrief(page, '.gov-owner-cluster, .gov-scope-status-chip').first()).toBeAttached();
    await openPiStripFoldIfPresent(page);
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
    await loadClarityPage(page);
    await expect(legacyBrief(page, '.gov-owner-cluster, .gov-scope-status-chip').first()).toBeAttached();
    await page.locator('[data-setup-action="set-baseline"]').first().dispatchEvent('click');
    await expect(page.locator('.gov-baseline-optional .gov-baseline-slide-drop, .gov-baseline-slide-drop').first()).toBeVisible();
  });

  test('owner cluster primary CTA when blocked', async ({ page }) => {
    await mockClarityPage(page);
    await loadClarityPage(page);
    await expect(legacyBrief(page, '.gov-do-first-strip')).toBeAttached();
    await expect(legacyBrief(page, '#gov-do-first-execute')).toBeAttached();
    await expect(legacyBrief(page, '[data-grouped-nudge]').first()).toBeAttached();
    await expect(legacyBrief(page, '.gov-owner-cluster')).toContainText(/Leadership|Amani/i);
  });

  test('overflow menu is positioned dropdown not details', async ({ page }) => {
    await mockClarityPage(page);
    await loadClarityPage(page);
    await expect(page.locator('.gov-command-overflow')).toHaveCount(0);
    await expect(legacyBrief(page, '.gov-overflow-menu-wrap')).toBeAttached();
    await expect(legacyBrief(page, '#gov-overflow-menu')).toBeAttached();
    await expect(legacyBrief(page, '#gov-protect-me')).toBeAttached();
  });

  test('since-last-run not in command bar', async ({ page }) => {
    await mockClarityPage(page);
    await loadClarityPage(page);
    await expect(legacyBrief(page, '.gov-command-answer .gov-command-since')).toHaveCount(0);
  });

  test('feedback lab chip button', async ({ page }) => {
    await mockClarityPage(page);
    await loadClarityPage(page);
    await clickLegacy(page, '#gov-secondary-chrome summary');
    await expect(legacyBrief(page, '#gov-open-feedback-lab.gov-lab-chip')).toBeAttached();
  });

  test('right rail queue visible without opening details', async ({ page }) => {
    await mockClarityPage(page);
    await loadClarityPage(page);
    await expect(legacyBrief(page, '#gov-right-rail-mount [data-queue-open]')).toBeAttached();
  });

  test('queue drawer shows icon tabs for multiple sections', async ({ page }) => {
    await mockClarityPage(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        briefs: [{ id: 'b1', type: 'brief', summary: 'Ready', safeToSend: true, approvalRequired: false, payload: { owner: 'A', board: 'SD' } }],
        nudges: [{ id: 'n1', type: 'nudge', summary: 'Nudge', payload: { owner: 'B', board: 'SD' } }],
        confirm: [{ id: 'c1', type: 'confirm', summary: 'Confirm', payload: { owner: 'C', board: 'SD' } }],
        piDrift: [], impact: [], poReadiness: [],
      }),
    }));
    await loadClarityPage(page);
    await clickLegacy(page, '[data-queue-open]');
    await expect(page.locator('.gov-inbox-drawer-tabs')).toBeVisible();
    await expect(page.locator('[data-queue-tab="doNow"]')).toBeEnabled();
    await page.locator('[data-queue-tab="doNow"]').click();
    await expect(page.locator('.gov-inbox-group-card').first()).toContainText(/Confirm|Nudge|Ready/i);
  });

  test('grouped inbox truncates with show more', async ({ page }) => {
    await mockClarityPage(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await loadClarityPage(page);
    await expect(legacyBrief(page, '#gov-right-rail-mount[data-right-rail-has-queue="true"]')).toBeAttached();
    await expect(legacyBrief(page, '[data-queue-open]')).toBeAttached();
    await clickLegacy(page, '[data-queue-open]');
    await expect(page.locator('.gov-inbox-group-card')).toHaveCount(8);
    await expect(page.locator('#gov-inbox-show-more')).toBeVisible();
  });

  test('scope chips clear of left sidebar on desktop', async ({ page }) => {
    await mockClarityPage(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await loadClarityPage(page);
    await clickLegacy(page, '#gov-scope-change');
    await expect(legacyBrief(page, '#gov-scope-expanded[data-scope-expanded-visible="1"]')).toBeAttached();
    const chip = legacyBrief(page, '#gov-scope-expanded .gov-scope-chip[data-project="SD"]');
    await expect(chip).toBeAttached();
    await page.waitForFunction(() => {
      const el = document.querySelector('#gov-scope-expanded .gov-scope-chip[data-project="SD"]');
      return el && el.getBoundingClientRect().width > 0;
    });
    const rect = await chip.evaluate((el) => el.getBoundingClientRect());
    const sidebarWidth = await page.evaluate(() => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width') || '0';
      return Number.parseFloat(raw) || 0;
    });
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.x).toBeGreaterThanOrEqual(Math.max(0, sidebarWidth - 8));
  });

  test('owner cluster nudge within above-fold viewport after DOM reorder', async ({ page }) => {
    await mockClarityPage(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loadClarityPage(page);
    const nudge = legacyBrief(page, '[data-grouped-nudge]').first();
    await expect(nudge).toBeAttached();
    const box = await nudge.boundingBox();
    expect(box?.y ?? 9999).toBeLessThan(900);
  });

  test('mobile owner cluster nudge within above-fold viewport', async ({ page }) => {
    await mockClarityPage(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await loadClarityPage(page);
    const nudge = legacyBrief(page, '[data-grouped-nudge]').first();
    await expect(nudge).toBeAttached();
    const box = await nudge.boundingBox();
    expect(box?.y ?? 9999).toBeLessThan(812);
  });

  test('PI strip folds below clusters when actions present', async ({ page }) => {
    await mockClarityPage(page);
    await loadClarityPage(page);
    await expect(legacyBrief(page, '.gov-pi-strip-fold, .gov-pi-compact-badge').first()).toBeAttached();
  });

  test('measurement and meeting script live under supporting evidence', async ({ page }) => {
    await mockClarityPage(page);
    await loadClarityPage(page);
    await expect(legacyBrief(page, '#gov-supporting-evidence #gov-measurement-mount')).toBeAttached();
    await expect(legacyBrief(page, '#gov-supporting-evidence #gov-meeting-script-mount')).toBeAttached();
  });

  test('fix baseline opens drawer wizard', async ({ page }) => {
    await mockClarityPage(page);
    await page.route('**/api/governance/pi-baseline/propose**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ method: 'manual', candidates: [], guidanceCode: 'no-board-epics' }),
    }));
    await loadClarityPage(page);
    await clickLegacy(page, '[data-setup-action="set-baseline"]');
    await expect(page.locator('.gov-right-drawer-panel')).toBeVisible();
    await expect(page.locator('.gov-baseline-wizard-title')).toContainText(/Promised work/i);
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
    await loadClarityPage(page);
    await expect(legacyBrief(page, '#gov-right-rail-mount .gov-receipt-details summary')).toContainText(/Agent/i);
  });

  test('telemetry clean on clarity load', async ({ page }) => {
    await mockClarityPage(page);
    const telemetry = await captureBrowserTelemetry(page);
    await loadClarityPage(page);
    await expect(legacyBrief(page, '.gov-owner-cluster, .gov-scope-status-chip').first()).toBeAttached();
    assertTelemetryClean(telemetry);
  });
});
