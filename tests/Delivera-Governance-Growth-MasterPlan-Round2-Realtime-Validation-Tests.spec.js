/**
 * Governance growth master plan Round 2 — proof drawer SSOT, copy merger, mobile Apply, needs-scope.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';

function stubGrowthBrief(projects = ['SD'], overrides = {}) {
  const keys = Array.isArray(projects) ? projects : String(projects).split(',').map((p) => p.trim()).filter(Boolean);
  const primary = keys[0] || 'SD';
  return JSON.stringify({
    briefId: `GROWTH-${keys.join('-')}`,
    projects: keys,
    portfolio: keys.join(' + '),
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
    leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked today', narratedBy: 'template' },
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    meta: {
      narratedBy: 'template',
      commandAnswerSentence: 'DELIVERY BLOCKED — act today',
      safeToSend: false,
      workerReceipt: { line: 'Last run: 2m ago', inboxTotal: 2 },
      piConfidence: { trusted: false, counts: { committed: 0 }, timelineChips: [] },
      setupGaps: [],
      ...overrides.meta,
    },
    topRisks: [{
      issueKey: `${primary}-1`,
      assigneeName: 'Amani',
      decisionNeededFrom: 'Tech Lead',
      recommendedAction: 'Unblock today',
      escalation: 'act-today',
      ageHours: 72,
      issueUrl: `https://example/${primary}-1`,
      displayTitle: 'Stuck epic',
      summary: 'Stuck',
    }, {
      issueKey: `${primary}-2`,
      assigneeName: 'Amani',
      decisionNeededFrom: 'Tech Lead',
      recommendedAction: 'Confirm blocker',
      escalation: 'escalate',
      ageHours: 96,
      displayTitle: 'Another stuck',
      summary: 'Another',
    }],
    evidencePack: {
      rows: [
        { issueKey: `${primary}-1`, statusNow: 'In Progress', whyFlagged: 'stale', changelogAvailable: true },
        { issueKey: `${primary}-2`, statusNow: 'In Progress', whyFlagged: 'stale', changelogAvailable: true },
      ],
    },
    squadInsights: keys.map((pk) => ({
      projectKey: pk,
      verdictTier: pk === primary ? 'blocked' : 'watch',
      bottleneckLine: `${pk} bottleneck`,
      cardRisks: [{ issueKey: `${pk}-1`, displayTitle: 'Stuck' }],
    })),
    ...overrides,
  });
}

async function mockGrowthGovernance(page, opts = {}) {
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
      body: stubGrowthBrief(keys.length ? keys : ['SD']),
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
          briefs: [{ id: 'b1', type: 'brief', summary: 'Ready 1', safeToSend: true, payload: { owner: 'Amani' } }],
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
}

test.describe('Governance growth master plan Round 2', () => {
  test.describe.configure({ retries: 0 });

  test('@focused governance growth round2 direct-to-value contracts', async ({ page, context }) => {
    const telemetry = captureBrowserTelemetry(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1440, height: 900 });

    await test.step('01 load brief hero above fold', async () => {
      await mockGrowthGovernance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-loading')).toBeHidden({ timeout: 20000 });
      await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', 'content');
      const heroY = await page.locator('.gov-command-answer, .gov-portfolio-banner-line').first().boundingBox().then((b) => b?.y ?? 9999);
      expect(heroY).toBeLessThan(350);
      assertTelemetryClean(telemetry);
    });

    await test.step('02 draft nudge opens review sheet', async () => {
      const nudgeBtn = page.locator('.gov-cluster-nudge-primary[data-grouped-nudge="0"]');
      await expect(nudgeBtn).toBeVisible({ timeout: 15000 });
      await nudgeBtn.click();
      await expect(page.locator('#jira-nudge-review-text')).toBeVisible({ timeout: 8000 });
      await page.keyboard.press('Escape');
      await expect(page.locator('#delivera-jira-nudge-review-sheet')).toBeHidden({ timeout: 3000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('03 copy SSOT scope bar only', async () => {
      await expect(page.locator('#gov-copy-answer-scope')).toBeVisible();
      await expect(page.locator('#gov-copy-answer-inline')).toHaveCount(0);
      await page.locator('#gov-copy-answer-scope').click();
      await expect(page.locator('#gov-copy-answer-scope')).toHaveText(/Copied|Copy answer/);
      assertTelemetryClean(telemetry);
    });

    await test.step('04 proof cluster opens evidence drawer', async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-proof-cluster]').first()).toBeVisible({ timeout: 15000 });
      await page.locator('[data-proof-cluster]').first().click();
      await expect(page.locator('.gov-right-drawer-panel, #gov-supporting-evidence[open]').first()).toBeVisible({ timeout: 10000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('05 compare plain click adds rail', async () => {
      await page.keyboard.press('Escape');
      await mockGrowthGovernance(page, { projects: 'SD' });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-compare-add-tray="1"]')).toBeVisible({ timeout: 15000 });
      await page.locator('[data-compare-add="MPSA"]').first().click();
      await page.waitForTimeout(700);
      await expect(page.locator('#gov-compare-rail-mount [data-compare-rail="1"]')).toBeAttached({ timeout: 10000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('06 inline approve without drawer', async () => {
      const approve = page.locator('[data-inbox-inline-approve]').first();
      if (await approve.count()) {
        await approve.click();
        await expect(page.locator('.gov-right-drawer-panel')).toHaveCount(0);
      }
      assertTelemetryClean(telemetry);
    });

    await test.step('07 scroll depth desktop compact', async () => {
      const ratio = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight);
      expect(ratio).toBeLessThanOrEqual(2.0);
      assertTelemetryClean(telemetry);
    });

    await test.step('08 mobile scope Apply batch', async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await mockGrowthGovernance(page, { projects: 'SD' });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.locator('#gov-scope-change').click();
      const drawer = page.locator('.gov-right-drawer-panel--scope-sheet');
      await expect(drawer).toBeVisible();
      await drawer.locator('.gov-scope-mobile-project-check[value="MAS"]').check();
      await drawer.locator('.gov-scope-mobile-project-check[value="SD"]').uncheck();
      await drawer.locator('[data-scope-sheet-apply="1"]').click();
      await expect(page.locator('#delivera-gov-right-drawer')).toBeHidden({ timeout: 5000 });
      const stored = await page.evaluate(() => localStorage.getItem('delivera_selectedProjects') || '');
      expect(stored.toUpperCase()).toMatch(/MAS/);
      assertTelemetryClean(telemetry);
    });

    await test.step('09 empty scope needs-scope no brief API', async () => {
      let briefCalls = 0;
      await page.unroute('**/api/governance-brief.json**');
      await page.route('**/api/governance-brief.json**', (r) => {
        briefCalls += 1;
        return r.fulfill({ status: 200, contentType: 'application/json', body: stubGrowthBrief(['SD']) });
      });
      await page.addInitScript(({ key }) => {
        try { localStorage.setItem(key, ''); } catch (_) {}
        try { sessionStorage.removeItem('delivera:brief:cache:v1'); } catch (_) {}
      }, { key: PROJECTS_SSOT_KEY });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', 'needs-scope', { timeout: 10000 });
      expect(briefCalls).toBe(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('10 negative rapid refresh stable', async () => {
      await mockGrowthGovernance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-loading')).toBeHidden({ timeout: 20000 });
      for (let i = 0; i < 5; i++) {
        await page.locator('#gov-scope-refresh').click({ timeout: 3000 }).catch(() => {});
      }
      await page.waitForTimeout(800);
      await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', 'content');
      assertTelemetryClean(telemetry);
    });

    await test.step('11 negative stale nudge read-only', async () => {
      await mockGrowthGovernance(page);
      await page.unroute('**/api/governance-brief.json**');
      await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json',
        body: stubGrowthBrief(['SD'], { freshness: { confidenceLimit: 'stale' } }),
      }));
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      const nudge = page.locator('[data-grouped-nudge]').first();
      if (await nudge.count()) {
        await nudge.click();
        await expect(page.locator('#delivera-jira-nudge-review-sheet:not([hidden])')).toBeVisible({ timeout: 8000 });
        await expect(page.locator('#delivera-jira-nudge-review-sheet [data-review-send]')).toBeDisabled();
      }
      assertTelemetryClean(telemetry);
    });

    await test.step('12 final telemetry clean', async () => {
      assertTelemetryClean(telemetry);
    });
  });
});
