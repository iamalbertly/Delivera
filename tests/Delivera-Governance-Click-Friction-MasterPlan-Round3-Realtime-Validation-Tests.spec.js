/**
 * Governance click friction Round 3 — direct-to-value SSOT, scope collapse, send nudge, proof rail.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';

function squadInsight(pk, tier = 'watch') {
  return {
    projectKey: pk,
    verdictTier: tier,
    verdictLabel: tier === 'blocked' ? 'DELIVERY BLOCKED' : 'Watch',
    bottleneckLine: `${pk} bottleneck`,
    productivityLine: 'Stale work',
    sprintPulse: { committed: 4, done: 1 },
    piCommitted: 4,
    piDone: 1,
    cardRisks: [{ issueKey: `${pk}-1`, displayTitle: 'Stuck' }],
  };
}

function stubRound3Brief(projects = ['SD'], overrides = {}) {
  const keys = Array.isArray(projects) ? projects : String(projects).split(',').map((p) => p.trim()).filter(Boolean);
  const primary = keys[0] || 'SD';
  return JSON.stringify({
    briefId: `R3-${keys.join('-')}`,
    projects: keys,
    portfolio: keys.join(' + '),
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
    leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked today', narratedBy: 'template' },
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    meta: {
      narratedBy: 'template',
      commandAnswerSentence: 'DELIVERY BLOCKED — act today',
      safeToSend: true,
      sinceLastRun: { summary: 'Since last brief: +1 blocker', parts: ['+1 blocker'] },
      workerReceipt: { line: 'Last run: 2m ago', inboxTotal: 2, sinceLastRun: { summary: 'Since last brief: +1 blocker' } },
      piConfidence: { trusted: false, counts: { committed: 0 }, timelineChips: [] },
      setupGaps: [],
      ...overrides.meta,
    },
    topRisks: [{
      issueKey: `${primary}-1`,
      assigneeName: 'Amani',
      recommendedAction: 'Unblock today',
      escalation: 'act-today',
      issueUrl: `https://example/${primary}-1`,
      displayTitle: 'Stuck epic',
      summary: 'Stuck',
    }],
    evidencePack: {
      rows: [
        { issueKey: `${primary}-1`, statusNow: 'In Progress', whyFlagged: 'stale', changelogAvailable: true },
        { issueKey: `${primary}-2`, statusNow: 'Open', whyFlagged: 'stale' },
      ],
    },
    squadInsights: keys.map((pk) => squadInsight(pk, pk === primary ? 'blocked' : 'watch')),
    ...overrides,
  });
}

async function mockRound3Governance(page, opts = {}) {
  const { projects = 'SD' } = opts;
  await page.addInitScript(({ key, pk }) => {
    try { localStorage.setItem(key, pk); } catch (_) {}
    try { sessionStorage.removeItem('delivera:brief:cache:v1'); } catch (_) {}
    try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
  }, { key: PROJECTS_SSOT_KEY, pk: projects });
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', async (route) => {
    const url = route.request().url();
    const reqProjects = decodeURIComponent((url.match(/projects=([^&]+)/) || [])[1] || projects).toUpperCase();
    const keys = reqProjects.split(',').map((p) => p.trim()).filter(Boolean);
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: stubRound3Brief(keys.length ? keys : ['SD']),
    });
  });
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/**', (r) => {
    if (r.request().url().includes('inbox.json')) {
      return r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          briefs: [],
          nudges: [{ id: 'n1', type: 'nudge', summary: 'Nudge draft', payload: { owner: 'Amani', issueKey: 'SD-1', draftText: 'Please update' } }],
          confirm: [], piDrift: [], impact: [], poReadiness: [],
        }),
      });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/governance/inbox/**/resolve**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }),
  }));
  await page.route('**/api/issues/**/comment**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }),
  }));
}

test.describe('Governance click friction Round 3', () => {
  test.describe.configure({ retries: 0 });

  test('@focused governance click friction round3 direct-to-value', async ({ page, context }) => {
    const telemetry = captureBrowserTelemetry(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await test.step('01 no object Object in portfolio banner', async () => {
      await mockRound3Governance(page, { projects: 'SD,MPSA' });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-loading')).toBeHidden({ timeout: 20000 });
      const banner = page.locator('[data-portfolio-banner="1"]');
      await expect(banner).toBeVisible({ timeout: 15000 });
      await expect(page.locator('body')).not.toContainText('[object Object]');
      assertTelemetryClean(telemetry);
    });

    await test.step('02 scope send-readiness pill SSOT', async () => {
      await expect(page.locator('#gov-send-readiness-pill')).toBeVisible();
      await expect(page.locator('.gov-owner-cluster-head .gov-send-badge')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 desktop scope collapsed until Change', async () => {
      await expect(page.locator('#gov-scope-expanded')).toBeHidden();
      await page.locator('#gov-scope-change').click();
      await expect(page.locator('#gov-scope-expanded')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('04 sticky verdict after scroll', async () => {
      await page.evaluate(() => window.scrollTo(0, 400));
      await expect(page.locator('.gov-sticky-answer--governance.is-visible')).toBeVisible({ timeout: 5000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('05 send nudge one-click', async () => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.keyboard.press('Escape');
      await mockRound3Governance(page, { projects: 'SD' });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-grouped-send="0"]')).toBeVisible({ timeout: 20000 });
      await page.locator('[data-grouped-send="0"]').click();
      await page.waitForTimeout(400);
      assertTelemetryClean(telemetry);
    });

    await test.step('06 inline approve on queue summary', async () => {
      await expect(page.locator('.gov-inbox-inline-approve').first()).toBeVisible({ timeout: 10000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('07 issue preview keeps URL on governance', async () => {
      const urlBefore = page.url();
      await page.locator('.gov-cluster-issue-key[data-issue-key]').first().click();
      await expect(page.locator('#delivera-shared-issue-preview')).toBeVisible();
      expect(page.url()).toBe(urlBefore);
      await page.keyboard.press('Escape');
      assertTelemetryClean(telemetry);
    });

    await test.step('08 proof cluster does not open supporting evidence', async () => {
      await page.locator('[data-proof-cluster]').first().click();
      await page.waitForTimeout(400);
      await expect(page.locator('#gov-supporting-evidence')).toHaveJSProperty('open', false);
      assertTelemetryClean(telemetry);
    });

    await test.step('09 mobile scope sheet', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await mockRound3Governance(page, { projects: 'SD' });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.locator('#gov-scope-change').click();
      await expect(page.locator('.gov-right-drawer-panel--scope-sheet')).toBeVisible();
      await page.keyboard.press('Escape');
      assertTelemetryClean(telemetry);
    });

    await test.step('10 negative double refresh and stale read-only', async () => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.locator('#gov-scope-refresh').dblclick();
      await page.waitForTimeout(900);
      await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', 'content');
      await mockRound3Governance(page, { projects: 'SD' });
      await page.unroute('**/api/governance-brief.json**');
      await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json',
        body: stubRound3Brief(['SD'], { freshness: { confidenceLimit: 'stale' }, meta: { safeToSend: false } }),
      }));
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-send-readiness-pill')).toContainText(/Stale|refresh/i);
      await expect(page.locator('[data-grouped-send]')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('11 final telemetry clean', async () => {
      assertTelemetryClean(telemetry);
    });
  });
});
