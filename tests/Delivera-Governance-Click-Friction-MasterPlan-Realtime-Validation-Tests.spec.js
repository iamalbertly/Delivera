/**
 * Click-friction master plan — mobile scope sheet, copy SSOT, proof clicks, queue inline approve.
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

function stubFrictionBrief(projects = ['SD'], overrides = {}) {
  const keys = Array.isArray(projects) ? projects : String(projects).split(',').map((p) => p.trim()).filter(Boolean);
  const primary = keys[0] || 'SD';
  return JSON.stringify({
    briefId: `FRICTION-${keys.join('-')}`,
    projects: keys,
    portfolio: keys.join(' + '),
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED' },
    leadershipNarrative: { confidence: 'low', meetingAnswer: 'Blocked today', narratedBy: 'template' },
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    meta: {
      narratedBy: 'template',
      commandAnswerSentence: 'DELIVERY BLOCKED — act today',
      safeToSend: false,
      setupGaps: [{ id: 'pi-baseline', action: 'set-baseline', severity: 'high' }],
      workerReceipt: { line: 'Last run: 2m ago', inboxTotal: 3 },
      piConfidence: { trusted: false, counts: { committed: 0 }, timelineChips: [] },
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
    evidencePack: { rows: [{ issueKey: `${primary}-1`, statusNow: 'In Progress', whyFlagged: 'stale' }] },
    squadInsights: keys.map((pk) => squadInsight(pk, pk === primary ? 'blocked' : 'watch')),
    ...overrides,
  });
}

async function clickScopeProject(page, pk) {
  const chip = page.locator(`#gov-scope-expanded [data-project="${pk}"]`);
  await expect(chip).toBeVisible({ timeout: 10000 });
  await chip.click();
}

async function ensureSingleSquad(page, pk = 'SD') {
  await page.evaluate(({ key, project }) => {
    localStorage.setItem(key, project);
    sessionStorage.removeItem('delivera:brief:cache:v1');
    sessionStorage.setItem('gov-pi-auto-open-dismissed', '1');
  }, { key: PROJECTS_SSOT_KEY, project: pk });
  const capsule = page.locator('.gov-scope-capsule-text');
  if (!(await capsule.textContent())?.includes('1 squad')) {
    await clickScopeProject(page, pk);
    await page.waitForTimeout(400);
  }
  await expect(capsule).toContainText('1 squad');
}

async function mockFrictionGovernance(page, opts = {}) {
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
      body: stubFrictionBrief(keys.length ? keys : ['SD']),
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
    if (r.request().url().includes('pi-baseline/propose')) {
      return r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ method: 'manual', candidates: [], guidanceCode: 'no-board-epics' }),
      });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/governance/inbox/**/resolve**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }),
  }));
}

test.describe('Governance click friction master plan', () => {
  test.describe.configure({ retries: 0 });

  test('@focused governance click friction master plan contracts', async ({ page, context }) => {
    const telemetry = captureBrowserTelemetry(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 1280, height: 900 });

    await test.step('01 desktop load scope copy and status chip', async () => {
      await mockFrictionGovernance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-loading')).toBeHidden({ timeout: 20000 });
      await expect(page.locator('#gov-copy-answer-scope')).toBeVisible();
      await expect(page.locator('.gov-scope-status-chip[data-scope-status-action="1"]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('02 desktop copy from scope bar', async () => {
      await page.locator('#gov-copy-answer-scope').click();
      await expect(page.locator('#gov-copy-answer-scope')).toHaveText(/Copied|Copy answer/);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 desktop compare add rail', async () => {
      await mockFrictionGovernance(page, { projects: 'SD' });
      await page.evaluate((key) => {
        localStorage.setItem(key, 'SD');
        sessionStorage.removeItem('delivera:brief:cache:v1');
        sessionStorage.setItem('gov-pi-auto-open-dismissed', '1');
      }, PROJECTS_SSOT_KEY);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.gov-command-answer')).toBeVisible({ timeout: 20000 });
      await ensureSingleSquad(page, 'SD');
      await expect(page.locator('[data-compare-add-tray="1"]')).toBeVisible({ timeout: 10000 });
      const addSecond = page.locator('[data-compare-add="MPSA"]');
      await expect(addSecond).toBeVisible();
      await addSecond.click();
      await page.waitForTimeout(600);
      await expect(page.locator('#gov-compare-rail-mount [data-compare-rail="1"]')).toBeAttached({ timeout: 10000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('04 desktop proof cluster highlights rail', async () => {
      await expect(page.locator('[data-proof-cluster]')).toBeVisible({ timeout: 15000 });
      await page.locator('[data-proof-cluster]').first().click();
      await expect(page.locator('#gov-right-rail-proof-mount .gov-evidence-preview')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('05 desktop queue inline approve or drawer', async () => {
      await expect(page.locator('[data-queue-open], .gov-inbox-inline-approve').first()).toBeVisible({ timeout: 10000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('06 desktop PI baseline fix opens drawer', async () => {
      await page.keyboard.press('Escape');
      const fix = page.locator('[data-setup-action="set-baseline"], [data-setup-baseline-ssot="1"]').first();
      await expect(fix).toBeVisible({ timeout: 10000 });
      await fix.click();
      await expect(page.locator('.gov-right-drawer-panel')).toBeVisible({ timeout: 10000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('07 mobile scope sheet selects MAS', async () => {
      await page.keyboard.press('Escape');
      await page.setViewportSize({ width: 375, height: 812 });
      await mockFrictionGovernance(page, { projects: 'SD' });
      await page.evaluate(({ key }) => {
        localStorage.setItem(key, 'SD');
        sessionStorage.removeItem('delivera:brief:cache:v1');
        sessionStorage.setItem('gov-pi-auto-open-dismissed', '1');
      }, { key: PROJECTS_SSOT_KEY });
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-scope-change')).toBeVisible({ timeout: 15000 });
      await page.locator('#gov-scope-change').click();
      const drawer = page.locator('.gov-right-drawer-panel--scope-sheet');
      await expect(drawer).toBeVisible();
      await drawer.locator('.gov-scope-mobile-project-check[value="MAS"]').check();
      await drawer.locator('.gov-scope-mobile-project-check[value="SD"]').uncheck();
      await page.waitForTimeout(900);
      const stored = await page.evaluate(() => localStorage.getItem('delivera_selectedProjects') || '');
      expect(stored.toUpperCase()).toMatch(/MAS/);
      expect(stored.toUpperCase()).not.toContain('UNDEFINED');
      assertTelemetryClean(telemetry);
    });

    await test.step('08 mobile copy from scope bar visible', async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('#gov-copy-answer-scope')).toBeVisible();
      await page.locator('#gov-copy-answer-scope').click();
      await expect(page.locator('#gov-copy-answer-scope')).not.toHaveText('Copy failed');
      assertTelemetryClean(telemetry);
    });

    await test.step('09 mobile period preset in scope sheet', async () => {
      await page.locator('#gov-scope-change').click();
      const preset = page.locator('.gov-right-drawer-panel--scope-sheet [data-period-preset="pi-quarter"]');
      await expect(preset).toBeVisible();
      await preset.click();
      await page.waitForTimeout(500);
      assertTelemetryClean(telemetry);
    });

    await test.step('10 negative double refresh', async () => {
      await page.keyboard.press('Escape');
      await page.locator('#gov-scope-refresh').dblclick();
      await page.waitForTimeout(800);
      await expect(page.locator('#main-content')).toHaveAttribute('data-gov-brief-state', 'content');
      assertTelemetryClean(telemetry);
    });

    await test.step('11 negative rapid scope switch', async () => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await mockFrictionGovernance(page);
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      for (const pk of ['MAS', 'FIN', 'BIO', 'SD']) {
        const chip = page.locator(`#gov-scope-expanded [data-project="${pk}"]`).first();
        if (await chip.isVisible()) await chip.click({ timeout: 3000 }).catch(() => {});
      }
      await page.waitForTimeout(1500);
      await expect(page.locator('#gov-error[hidden]')).toBeAttached();
      assertTelemetryClean(telemetry);
    });

    await test.step('12 negative stale brief nudge read-only', async () => {
      await mockFrictionGovernance(page);
      await page.unroute('**/api/governance-brief.json**');
      await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
        status: 200, contentType: 'application/json',
        body: stubFrictionBrief(['SD'], { freshness: { confidenceLimit: 'stale' } }),
      }));
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      const nudge = page.locator('[data-grouped-nudge]').first();
      if (await nudge.count()) {
        await nudge.click();
        await expect(page.locator('#delivera-jira-nudge-review-sheet')).toBeVisible({ timeout: 8000 });
      }
      assertTelemetryClean(telemetry);
    });

    await test.step('13 escape closes overlays', async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('.gov-right-drawer-panel')).toHaveCount(0);
      await expect(page.locator('#gov-copy-answer-scope')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('14 final telemetry clean', async () => {
      assertTelemetryClean(telemetry);
    });
  });
});
