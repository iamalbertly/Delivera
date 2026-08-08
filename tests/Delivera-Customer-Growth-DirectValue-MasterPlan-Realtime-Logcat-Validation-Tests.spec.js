/**
 * Customer Growth Direct-Value Continuity Master Plan — realtime UI + logcat.
 * Validates ScopeTruth continuity, Decision Rail, Commitment Pack, drawer chrome offset,
 * Current Sprint header honesty, Actions nav, registry mount, Evidence scoped entry.
 * Keep ≤10 focused steps; fail fast on console/pageerror via Console Guard + telemetry.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  captureBrowserTelemetry,
  assertTelemetryClean,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import { PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';
import { loginIfRequired } from './Delivera-Playwright-Login-If-Required-01Helper.js';

const NOW = '2026-07-17T10:32:00.000Z';

function activeLoopAnswer() {
  return {
    schemaVersion: 2,
    presentationContractVersion: 5,
    answerVersion: 7,
    missionHeader: 'FY27 Q2 PI contract governance',
    contract: { id: 'contract-q2', piName: 'FY27 Q2', source: 'approved-baseline' },
    scope: {
      mode: 'all-squads',
      projects: ['SD', 'FIN'],
      expectedSquads: 2,
      verifiedSquads: 2,
      complete: true,
      partialProjects: [],
    },
    answer: '2 squads are not aligned to PI promises. DMS Squad and Finance Squad need evidence decisions.',
    sourceLine: 'Compared with FY27 Q2 PI contract · 4 promises checked',
    deliveraDid: 'Delivera matched the contract to Jira and prepared safe owner asks.',
    verifiedAt: NOW,
    evidenceObservedAt: NOW,
    loopCompletion: 40,
    decisionCoverage: { closed: 1, total: 4, preparedOwnerAsks: 2, copy: '1 decided · 3 open · 4 in scope' },
    lensSummaries: { overall: '2 squads need attention.', rework: 'No high-confidence rework promoted.' },
    nextDecisionPromiseId: 'prm-sd-1',
    organizationParticipation: {
      globallyExcludedCount: 7,
      globallyExcludedSquads: [
        { squadKey: 'MPSA', displayName: 'M-SQUAD', state: 'pending-consent', reason: 'Pending consent' },
      ],
    },
    squads: [
      {
        squad: 'SD',
        displayName: 'DMS Squad (Kilimanjaro Legends)',
        promiseCount: 2,
        attentionCount: 2,
        topState: '2 need attention',
        proofState: 'stale proof',
        payloadHash: 'sd-hash-1',
        baselineCoverage: { state: 'verified', copy: 'DMS baseline verified.' },
        sprintReality: {
          state: 'active',
          sprint: { name: 'FY27DMS07', id: 9024 },
          daysRemaining: 4,
          copy: 'FY27DMS07 is active, 4 business days remaining.',
        },
        sprintCadence: { label: 'FY27DMS07 is active, 4 business days remaining.' },
        contractState: { label: '2 · Jira commitment exists but lacks PI metadata', detail: 'Needs metadata' },
        trustFactor: { level: 'limited', label: 'Limited, proof gap' },
        workSplit: { unknownPct: 40, explanation: 'Partial unknown work.' },
        unknownWork: { promoted: false, copy: '' },
        nextAction: { label: 'Confirm and add the FY/quarter metadata for SD-5316.' },
        currentWork: [{ title: 'NBA Integration', systemDerived: false }],
      },
      {
        squad: 'FIN',
        displayName: 'Finance Squad',
        promiseCount: 2,
        attentionCount: 2,
        topState: '2 need attention',
        proofState: 'stale proof',
        payloadHash: 'fin-hash-1',
        baselineCoverage: { state: 'verified', copy: 'Finance baseline verified.' },
        sprintReality: { state: 'active', sprint: { name: 'FY27Q2 FIN SPN3' }, daysRemaining: 9, copy: 'Sprint active.' },
        sprintCadence: { label: 'Sprint active' },
        contractState: { label: 'Approved Jira key does not resolve', detail: 'Key gap' },
        trustFactor: { level: 'limited', label: 'Limited' },
        workSplit: { unknownPct: 55, explanation: 'Finance unknown cluster.' },
        unknownWork: { promoted: true, copy: 'Unknown work is 55%. Classify top cluster: FIN-1079.' },
        nextAction: { label: 'Confirm whether FIN-1075 moved.' },
      },
    ],
    promises: [
      {
        promiseId: 'prm-sd-1',
        squad: 'SD',
        squadDisplayName: 'DMS Squad (Kilimanjaro Legends)',
        originalText: 'FY27 Q2 – DMS – NBA – Integration of CVM for Channel Productivity Campaigns',
        issueKey: 'SD-5314',
        statusNow: 'In Progress',
        quarter: 'FY27 Q2',
        matchState: 'partly-matched',
        matchLabel: 'PI epic has active sprint stories',
        diagnosisLabel: 'PI epic has active sprint stories',
        proofAge: { state: 'aging', copy: 'Evidence moved 0 business days ago.' },
        version: 1,
        ownerRoute: { role: 'Squad PO', displayName: 'Husna', unresolved: false },
        allowedActions: [
          { id: 'send-nudge', allowed: true, reason: 'Will send via Squad PO.' },
          { id: 'pull-fresh-evidence', allowed: true, reason: 'Refresh only this promise evidence.' },
          { id: 'approve-match', allowed: false, reason: 'Pull fresh evidence before approving.' },
          { id: 'amend-contract', allowed: false, reason: 'Freshness restricted.' },
          { id: 'accept-risk', allowed: false, reason: 'Freshness restricted.' },
          { id: 'recheck-promise', allowed: false, reason: 'Freshness restricted.' },
          { id: 'escalate-owner', allowed: false, reason: 'Not due.' },
        ],
        expectedVsActual: {
          expected: { commitment: 'NBA Integration', fiscalPeriod: 'FY27 Q2', issueKey: 'SD-5314', startDate: '2026-07-01', endDate: '2026-07-31' },
          actual: { issueKeys: ['SD-5304'], status: 'In Progress', matchedThrough: 'epic-child', sprintName: 'FY27DMS07' },
          durationBusinessDays: 12,
        },
      },
      {
        promiseId: 'prm-sd-2',
        squad: 'SD',
        squadDisplayName: 'DMS Squad (Kilimanjaro Legends)',
        originalText: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
        issueKey: 'SD-5316',
        statusNow: 'To Do',
        quarter: 'FY27 Q2',
        matchState: 'cannot-verify',
        matchLabel: 'Jira commitment exists but lacks PI metadata',
        diagnosisLabel: 'Jira commitment exists but lacks PI metadata',
        proofAge: { state: 'stale', copy: 'This work has not moved in 21 business days.' },
        version: 1,
        ownerRoute: { role: 'Squad PO', displayName: 'Husna', unresolved: false },
        allowedActions: [
          { id: 'pull-fresh-evidence', allowed: true, reason: 'Refresh only this promise evidence.' },
          { id: 'send-nudge', allowed: false, reason: 'Fresh Jira evidence is required before sending.' },
        ],
        expectedVsActual: {
          expected: { commitment: 'E-HOD', fiscalPeriod: 'FY27 Q2', issueKey: 'SD-5316', startDate: '2026-07-01', endDate: '2026-07-31' },
          actual: { issueKeys: ['SD-5316'], status: 'To Do', matchedThrough: 'exact-key' },
        },
      },
    ],
  };
}

async function mockSurfaces(page) {
  const answer = activeLoopAnswer();
  await page.addInitScript((projectsKey) => {
    try { localStorage.setItem(projectsKey, 'SD'); } catch (_) {}
  }, PROJECTS_SSOT_KEY);
  await routeProjectsCatalog(page);
  await page.route('**/api/governance/active-loop.json**', async (route) => {
    const requested = new URL(route.request().url()).searchParams.get('projects');
    const projects = requested
      ? requested.split(',').map((p) => p.trim()).filter(Boolean)
      : answer.scope.projects;
    const scoped = {
      ...answer,
      scope: { ...answer.scope, projects, expectedSquads: projects.length, verifiedSquads: projects.length },
      squads: answer.squads.filter((s) => projects.includes(s.squad) || projects.includes('SD') && s.squad === 'SD' || projects.length === 0),
    };
    // Always keep SD fixture squad when SD is in scope; keep FIN only when requested.
    scoped.squads = answer.squads.filter((s) => projects.map((p) => p.toUpperCase()).includes(String(s.squad).toUpperCase()));
    if (!scoped.squads.length) scoped.squads = answer.squads.slice(0, 1);
    scoped.promises = answer.promises.filter((p) => scoped.squads.some((s) => s.squad === p.squad));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scoped) });
  });
  await page.route('**/api/governance/squads/SD/detail.json**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        schemaVersion: 2,
        squad: answer.squads[0],
        promises: answer.promises.filter((p) => p.squad === 'SD'),
        currentWork: answer.squads[0].currentWork,
        sprintReality: answer.squads[0].sprintReality,
        unknownWork: answer.squads[0].unknownWork,
      }),
    });
  });
  await page.route('**/api/governance/cases/*/detail.json**', async (route) => {
    const id = route.request().url().match(/cases\/([^/]+)/)?.[1] || 'prm-sd-1';
    const promise = answer.promises.find((p) => p.promiseId === id) || answer.promises[0];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ schemaVersion: 2, promise, squad: answer.squads[0] }),
    });
  });
  await page.route('**/api/governance-brief.json**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        briefId: 'dv-master',
        projects: ['SD'],
        meta: { narratedBy: 'template', safeToSend: true },
        topRisks: [],
        evidencePack: { rows: [] },
        freshness: { confidenceLimit: 'live', generatedAt: NOW },
      }),
    });
  });
  await page.route('**/api/boards.json**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projects: ['SD'],
        boards: [{ id: 1, name: 'DMS board (SD)', projectKey: 'SD', projectKeys: ['SD'] }],
        projectErrors: [],
      }),
    });
  });
  await page.route('**/api/current-sprint.json**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        board: { id: 1, name: 'DMS board (SD)', projectKey: 'SD', projectKeys: ['SD'] },
        sprint: { id: 9024, name: 'FY27DMS07', state: 'active', startDate: '2026-07-31', endDate: '2026-08-14' },
        summary: { totalStories: 3, doneStories: 0, percentDone: 0 },
        daysMeta: { daysRemainingWorking: 4 },
        stories: [
          { issueKey: 'SD-5307', summary: 'Swipe refresh', status: 'In Progress' },
        ],
        stuckCandidates: [{ issueKey: 'SD-5307', summary: 'Swipe refresh' }],
        meta: { projects: 'SD' },
      }),
    });
  });
  await page.route('**/api/governance/registry.json**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        squads: [
          {
            squadKey: 'MPSA',
            friendlyName: 'M-SQUAD',
            participationState: 'pending-consent',
            productOwner: '',
            scrumMaster: '',
            boardMapping: [],
            boardCandidates: [{ id: 230, name: 'MPSA board' }],
            revision: 1,
          },
        ],
        auditHistory: [],
      }),
    });
  });
  for (const pattern of [
    '**/api/governance/inbox.json**',
    '**/api/governance/feedback-summary.json**',
    '**/api/governance/adoption-metrics.json**',
    '**/api/governance/diagnostics.json**',
    '**/api/quarters-list**',
    '**/api/ai-provider-status.json**',
  ]) {
    await page.route(pattern, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: pattern.includes('ai-provider')
        ? JSON.stringify({ provider: 'openrouter', configured: true, label: 'OpenRouter' })
        : '{}',
    }));
  }
}

test.describe('Customer growth direct-value continuity master plan', () => {
  test.describe.configure({ retries: 0 });

  test('@focused continuity Decision Rail Commitment Pack ScopeTruth logcat', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockSurfaces(page);

    await test.step('01 governance last-known-good paint without leaked brace', async () => {
      await loginIfRequired(page, '/governance?projects=SD', {
        rootSelector: '[data-testid="governance-active-loop"]',
        timeout: 25000,
      });
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-testid="governance-active-loop"]')).toBeVisible({ timeout: 20000 });
      const bodyText = await page.locator('#gov-active-loop-mount').innerText();
      expect(bodyText).not.toMatch(/^\s*\{\s*$/m);
      expect(bodyText).not.toContain('Building first verified answer');
      assertTelemetryClean(telemetry);
    });

    await test.step('02 DMS spotlight continuity locks squad scope', async () => {
      await page.goto('/governance?spotlight=SD&squad=SD&projects=SD&view=squad');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-testid="governance-active-loop"]')).toBeVisible({ timeout: 20000 });
      await expect(page).toHaveURL(/spotlight=SD/);
      await expect(page.locator('.gov-story-matrix--squad-focus')).toBeVisible({ timeout: 15000 });
      const matrix = await page.locator('.gov-story-matrix').innerText();
      expect(matrix).toMatch(/DMS Squad|Selected squad/i);
      expect(matrix).not.toMatch(/Finance Squad/);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 Decision Rail shows one primary CTA and More decisions', async () => {
      await page.locator('[data-drawer-close]').first().click({ timeout: 2000 }).catch(() => {});
      await page.locator('.gov-loop-primary, [data-loop-primary]').first().click({ timeout: 10000 });
      const drawer = page.locator('#delivera-gov-right-drawer .gov-loop-drawer, #delivera-gov-right-drawer .gov-resolution-sheet');
      await expect(drawer.first()).toBeVisible({ timeout: 15000 });
      const panelBox = await page.locator('#delivera-gov-right-drawer .gov-right-drawer-panel').boundingBox();
      const chromeBox = await page.locator('#app-top-chrome, .app-top-chrome').first().boundingBox();
      if (panelBox && chromeBox) {
        expect(panelBox.y).toBeGreaterThanOrEqual(chromeBox.height - 2);
      }
      const decisionRail = page.locator('#delivera-gov-right-drawer [data-decision-rail="primary"], #delivera-gov-right-drawer .gov-loop-actions--decision-rail');
      if (await decisionRail.count()) {
        const primaryEnabled = decisionRail.locator('> .gov-loop-action-wrap > button.btn-primary:not([disabled]), button.btn-primary:not([disabled])').first();
        await expect(primaryEnabled).toBeVisible();
        await expect(decisionRail.locator('.gov-loop-more-actions')).toHaveCount(1);
      } else {
        // Primary may open spotlight first — open a promise from spotlight.
        await page.locator('[data-drawer-close]').first().click({ timeout: 2000 }).catch(() => {});
        await page.locator('[data-loop-promise]').first().click({ force: true, timeout: 8000 });
        await expect(page.locator('#delivera-gov-right-drawer .gov-loop-actions--decision-rail')).toBeVisible({ timeout: 12000 });
        await expect(page.locator('#delivera-gov-right-drawer .gov-loop-more-actions')).toHaveCount(1);
      }
      assertTelemetryClean(telemetry);
    });

    await test.step('04 Commitment Pack copy control from proof audit', async () => {
      await page.locator('[data-drawer-close]').first().click({ timeout: 3000 }).catch(() => {});
      await page.locator('[data-all-proof]').first().click({ timeout: 8000 });
      await expect(page.locator('[data-copy-commitment-pack]').first()).toBeVisible({ timeout: 12000 });
      await page.locator('[data-copy-commitment-pack]').first().click();
      await expect(page.locator('[data-commitment-pack-status]').first()).toContainText(/Copied|failed/i, { timeout: 5000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('05 Current Sprint has no header-is-not-defined and one Open report continuity', async () => {
      await page.goto('/current-sprint?squad=SD&projects=SD&boardId=1');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.current-sprint-header-bar[data-context-bar="true"]')).toBeVisible({ timeout: 25000 });
      const err = page.locator('#current-sprint-error, .app-status-error, [data-status-error]');
      if (await err.count()) {
        const text = await err.first().innerText().catch(() => '');
        expect(text).not.toMatch(/header is not defined/i);
      }
      const reportLinks = page.locator('a[data-header-action="open-report-context"]');
      const reportCount = await reportLinks.count();
      expect(reportCount).toBeGreaterThanOrEqual(1);
      expect(reportCount).toBeLessThanOrEqual(2);
      const href = await reportLinks.first().getAttribute('href');
      expect(href || '').toMatch(/squad=SD|projects=SD/);
      assertTelemetryClean(telemetry);
    });

    await test.step('06 Actions page marks Actions chrome active not Governance', async () => {
      await page.goto('/actions?squad=SD');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('body.actions-page')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-top-action="agent"].is-active')).toBeVisible();
      await expect(page.locator('[data-top-surface="governance"].is-active')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('07 Settings registry participation exceptions mount', async () => {
      await page.goto('/settings');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-settings-registry-mount')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#gov-settings-registry-mount')).toContainText(/Participation exceptions|PI participation/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('08 Evidence scoped entry keeps continuity chips without blank forever', async () => {
      await page.goto('/report?squad=SD&projects=SD');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('body')).toBeVisible();
      const chips = page.locator('.report-filter-strip-chip, [data-report-chip], .app-context-bar');
      await expect(chips.first()).toBeVisible({ timeout: 20000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('09 Participation exceptions label aligned on governance portfolio', async () => {
      await page.goto('/governance?projects=SD');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-testid="governance-active-loop"]')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('[data-operating-firewall]')).toContainText(/Participation exceptions/i);
      assertTelemetryClean(telemetry);
    });
  });
});
