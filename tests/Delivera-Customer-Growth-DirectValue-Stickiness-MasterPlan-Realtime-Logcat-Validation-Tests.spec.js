/**
 * Customer Growth Direct-Value Stickiness Echo-Death Master Plan — realtime UI + logcat.
 * Kill diagnosis multi-echo, Ends-in twin, Structure-now Create twin, Evidence continuity,
 * Back to Actions, Settings Jira refresh reachability. ≤10 steps; fail-fast Console Guard.
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
const DIAGNOSIS = 'Jira commitment exists but lacks PI metadata';

function activeLoopAnswer() {
  return {
    schemaVersion: 2,
    presentationContractVersion: 6,
    answerVersion: 11,
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
        payloadHash: 'sd-hash-stickiness',
        baselineCoverage: { state: 'verified', copy: 'DMS baseline verified.' },
        sprintReality: {
          state: 'active',
          sprint: { name: 'FY27DMS07', id: 9024 },
          daysRemaining: 4,
          copy: 'FY27DMS07 is active, 4 business days remaining.',
        },
        sprintCadence: { label: 'FY27DMS07 is active, 4 business days remaining.' },
        contractState: { label: `2 · ${DIAGNOSIS}`, detail: 'Needs metadata' },
        trustFactor: { level: 'limited', label: 'Limited, proof gap' },
        workSplit: { unknownPct: 40, explanation: 'Partial unknown work.' },
        unknownWork: { promoted: false, copy: '' },
        nextAction: { label: 'Confirm and add the FY/quarter metadata for SD-5316.' },
        currentWork: [{ title: 'NBA Integration', systemDerived: false }],
        diagnosisGroups: [
          {
            count: 2,
            label: DIAGNOSIS,
            issueKeys: ['SD-5314', 'SD-5316'],
            customerOrPiImpact: 'Period must be confirmed before PI totals trust this epic.',
            confidence: 0.92,
          },
        ],
      },
      {
        squad: 'FIN',
        displayName: 'Finance Squad',
        promiseCount: 1,
        attentionCount: 1,
        topState: '1 need attention',
        proofState: 'stale proof',
        payloadHash: 'fin-hash-stickiness',
        baselineCoverage: { state: 'verified', copy: 'Finance baseline verified.' },
        sprintReality: { state: 'active', sprint: { name: 'FY27Q2 FIN SPN3' }, daysRemaining: 9, copy: 'Sprint active.' },
        sprintCadence: { label: 'Sprint active' },
        contractState: { label: 'Approved Jira key does not resolve', detail: 'Key gap' },
        trustFactor: { level: 'limited', label: 'Limited' },
        workSplit: { unknownPct: 55, explanation: 'Finance unknown cluster.' },
        unknownWork: { promoted: false, copy: '' },
        nextAction: { label: 'Confirm whether FIN-1075 moved.' },
        currentWork: [],
        diagnosisGroups: [],
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
        matchLabel: DIAGNOSIS,
        diagnosisLabel: DIAGNOSIS,
        diagnosisCode: 'missing-pi-metadata',
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
        matchLabel: DIAGNOSIS,
        diagnosisLabel: DIAGNOSIS,
        diagnosisCode: 'missing-pi-metadata',
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
    const scoped = { ...answer };
    scoped.squads = answer.squads.filter((s) => projects.map((p) => p.toUpperCase()).includes(String(s.squad).toUpperCase()));
    if (!scoped.squads.length) scoped.squads = answer.squads.slice(0, 1);
    scoped.scope = {
      ...answer.scope,
      projects: scoped.squads.map((s) => s.squad),
      expectedSquads: scoped.squads.length,
      verifiedSquads: scoped.squads.length,
    };
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
        briefId: 'stickiness-master',
        projects: ['SD'],
        meta: { narratedBy: 'template', safeToSend: true, piConfidence: { headline: 'Not trusted yet' }, setupGaps: [] },
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
        daysMeta: { daysRemainingWorking: 4, daysRemaining: 4 },
        stories: [{ issueKey: 'SD-5307', summary: 'Swipe refresh', status: 'In Progress' }],
        stuckCandidates: [{ issueKey: 'SD-5307', summary: 'Swipe refresh', hoursInStatus: 40 }],
        topRisks: [
          {
            issueKey: 'SD-5307',
            label: 'Stale in progress',
            reason: 'No status change in 40h',
            evidence: 'Last comment 3d ago · status In Progress',
            status: 'In Progress',
            summary: 'Swipe refresh',
            action: 'Review SD-5307',
            tone: 'warning',
            riskTags: ['no-log'],
            assignee: 'SM',
          },
        ],
        meta: { projects: 'SD' },
      }),
    });
  });
  await page.route('**/api/governance/actions.json**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cases: [
          {
            promiseId: 'prm-sd-1',
            squadId: 'SD',
            squad: 'SD',
            issueKey: 'SD-5314',
            actionType: 'confirm-metadata',
            diagnosisCode: 'missing-pi-metadata',
            dueState: 'due',
            groupKey: 'SD|missing-pi-metadata|due',
            title: 'Confirm FY/Q metadata',
            customerOrPiImpact: 'PI metadata gap',
            urgencyLabel: 'due',
            ownerRoute: { displayName: 'Husna', role: 'Squad PO' },
            detailHref: '/governance?spotlight=SD&cases=prm-sd-1&returnTo=/actions',
          },
        ],
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
    '**/api/ai-intelligence-status.json**',
    '**/api/governance/intelligence/health**',
  ]) {
    await page.route(pattern, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: pattern.includes('ai-') || pattern.includes('intelligence')
        ? JSON.stringify({ provider: 'openrouter', configured: true, label: 'OpenRouter', worker: 'ok', quota: { remaining: 10, ceiling: 40 } })
        : '{}',
    }));
  }
}

test.describe('Customer growth direct-value stickiness echo-death master plan', () => {
  test.describe.configure({ retries: 0 });

  test('@focused stickiness echo-death Evidence Ends-in Create returnTo logcat', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockSurfaces(page);

    await test.step('01 tunnel H1 owns diagnosis; no Why proof is missing', async () => {
      await loginIfRequired(page, '/governance?spotlight=SD&squad=SD&projects=SD&view=squad', {
        rootSelector: '[data-testid="governance-active-loop"]',
        timeout: 25000,
      });
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-testid="governance-active-loop"]')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('[data-squad-tunnel-bar]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#gov-loop-answer')).toContainText(/lacks PI metadata/i);
      await expect(page.locator('.gov-diagnosis-groups')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /Why proof is missing/i })).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('02 readout has no diagnosis twin and no Next safe action cell', async () => {
      const readout = page.locator('.gov-spotlight-readout');
      await expect(readout).toBeVisible({ timeout: 10000 });
      const text = await readout.innerText();
      expect(text).not.toMatch(/lacks PI metadata/i);
      expect(text).not.toMatch(/Next safe action/i);
      expect(text).toMatch(/Needs metadata|need attention|Limited/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 chrome Evidence href keeps squad continuity', async () => {
      const evidenceHref = await page.locator('a[data-top-surface="report"]').first().getAttribute('href');
      expect(evidenceHref || '').toMatch(/squad=SD|projects=SD/);
      assertTelemetryClean(telemetry);
    });

    await test.step('04 All proof list lacks repeated diagnosisLabel', async () => {
      await page.locator('[data-all-proof]').first().click({ timeout: 8000 });
      const list = page.locator('.gov-proof-audit-list');
      await expect(list).toBeVisible({ timeout: 12000 });
      const listText = await list.innerText();
      const matches = listText.split(DIAGNOSIS).length - 1;
      expect(matches).toBeLessThan(2);
      await page.locator('[data-drawer-close]').first().click({ timeout: 3000 }).catch(() => {});
      assertTelemetryClean(telemetry);
    });

    await test.step('05 Sprint Proof filled; primary strip does not pair Needs Attention with Ends in', async () => {
      await page.goto('/current-sprint?squad=SD&projects=SD&boardId=1');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.current-sprint-header-bar[data-context-bar="true"]')).toBeVisible({ timeout: 25000 });
      const proofCell = page.locator('.attention-queue-table td[data-label="Proof"]').first();
      if (await proofCell.count()) {
        expect((await proofCell.innerText()).trim().length).toBeGreaterThan(0);
      }
      const primary = page.locator('[data-sprint-primary-strip="true"], .current-sprint-header-bar .subtitle').first();
      const primaryText = await primary.innerText().catch(() => '');
      const headerBand = await page.locator('.current-sprint-header-bar .header-band, .sprint-verdict-line').first().innerText().catch(() => '');
      if (/Needs Attention/i.test(`${primaryText}\n${headerBand}`)) {
        expect(`${primaryText}\n${headerBand}`).not.toMatch(/Ends in \d+d/i);
      }
      assertTelemetryClean(telemetry);
    });

    await test.step('06 Next-move does not explode risk filters', async () => {
      const nextMove = page.locator('[data-header-action="focus-remediation"]').first();
      if (await nextMove.count()) {
        await nextMove.click();
        await page.waitForTimeout(400);
        const risk = new URL(page.url()).searchParams.get('risk') || '';
        expect(risk.split(',').filter(Boolean).length).toBeLessThanOrEqual(2);
      }
      assertTelemetryClean(telemetry);
    });

    await test.step('07 Structure-now twin suppressed under chrome Create', async () => {
      await expect(page.locator('body.chrome-suppress-page-create')).toHaveCount(1);
      await expect(page.locator('.decision-automation-card [data-open-outcome-modal]:visible')).toHaveCount(0);
      await expect(page.locator('.app-top-create:visible, [data-top-action="create-work"]:visible').first()).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('08 Actions returnTo shows Back to Actions on Governance', async () => {
      await page.goto('/governance?spotlight=SD&squad=SD&projects=SD&view=squad&returnTo=/actions');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-testid="governance-active-loop"]')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('[data-return-to-actions], a.gov-return-to-actions')).toBeVisible({ timeout: 10000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('09 Settings Jira refresh reachable; exceptions band present', async () => {
      await page.goto('/settings');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-settings-registry-mount')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#gov-settings-registry-mount')).toContainText(/Participation exceptions|PI participation/i);
      await expect(page.locator('#gov-jira-refresh-connection')).toBeVisible({ timeout: 10000 });
      const nested = page.locator('.gov-ai-admin-diagnostics #gov-jira-refresh-connection');
      expect(await nested.count()).toBe(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('10 logcat clean — zero pageerror fail-fast', async () => {
      assertTelemetryClean(telemetry);
    });
  });
});
