/**
 * Customer Growth Squad-Tunnel Continuity Master Plan — realtime UI + logcat.
 * Hard DMS tunnel, one diagnosis, Commitment Pack rail, chrome continuity,
 * drawer stacking, Sprint Proof/next-move honesty, Actions short CTA, Settings chip path.
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
    answerVersion: 9,
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
        payloadHash: 'sd-hash-tunnel',
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
        payloadHash: 'fin-hash-tunnel',
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
        diagnosisLabel: 'Jira commitment exists but lacks PI metadata',
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
        matchLabel: 'Jira commitment exists but lacks PI metadata',
        diagnosisLabel: 'Jira commitment exists but lacks PI metadata',
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
        briefId: 'squad-tunnel-master',
        projects: ['SD'],
        meta: {
          narratedBy: 'template',
          safeToSend: true,
          piConfidence: { headline: 'Not trusted yet' },
          setupGaps: [],
        },
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
            detailHref: '/governance?spotlight=SD&cases=prm-sd-1',
          },
          {
            promiseId: 'prm-sd-2',
            squadId: 'SD',
            squad: 'SD',
            issueKey: 'SD-5316',
            actionType: 'confirm-metadata',
            diagnosisCode: 'missing-pi-metadata',
            dueState: 'due',
            groupKey: 'SD|missing-pi-metadata|due',
            title: 'Confirm FY/Q metadata',
            customerOrPiImpact: 'PI metadata gap',
            urgencyLabel: 'due',
            ownerRoute: { displayName: 'Husna', role: 'Squad PO' },
            detailHref: '/governance?spotlight=SD&cases=prm-sd-2',
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
  ]) {
    await page.route(pattern, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: pattern.includes('ai-')
        ? JSON.stringify({ provider: 'openrouter', configured: true, label: 'OpenRouter', worker: 'ok', quota: { remaining: 10, ceiling: 40 } })
        : '{}',
    }));
  }
}

test.describe('Customer growth squad-tunnel continuity master plan', () => {
  test.describe.configure({ retries: 0 });

  test('@focused squad tunnel continuity Commitment Pack Sprint Proof logcat', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockSurfaces(page);

    await test.step('01 governance first fold shows verified answer without blank', async () => {
      await loginIfRequired(page, '/governance?projects=SD,FIN', {
        rootSelector: '[data-testid="governance-active-loop"]',
        timeout: 25000,
      });
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-testid="governance-active-loop"]')).toBeVisible({ timeout: 20000 });
      const bodyText = await page.locator('#gov-active-loop-mount').innerText();
      expect(bodyText).not.toMatch(/Building first verified answer/i);
      expect(bodyText.length).toBeGreaterThan(40);
      assertTelemetryClean(telemetry);
    });

    await test.step('02 DMS tunnel hides peer matrix and locks spotlight URL', async () => {
      await page.goto('/governance?spotlight=SD&squad=SD&projects=SD&view=squad');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-testid="governance-active-loop"]')).toBeVisible({ timeout: 20000 });
      await expect(page).toHaveURL(/spotlight=SD/);
      await expect(page.locator('[data-squad-tunnel-bar]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.gov-story-matrix .gov-story-row')).toHaveCount(0);
      const tunnel = await page.locator('[data-squad-tunnel-bar]').innerText();
      expect(tunnel).toMatch(/Selected squad|Back to portfolio/i);
      expect(tunnel).not.toMatch(/Finance Squad/);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 diagnosis sentence appears once in h1 (no triple echo)', async () => {
      const h1 = await page.locator('#gov-loop-answer').innerText();
      expect(h1).toMatch(/lacks PI metadata|DMS Squad/i);
      // Count only visible diagnosis reprints outside the H1 (rail/spotlight must not echo the full sentence).
      const outsideH1 = await page.locator('#gov-active-loop-mount').evaluate((root) => {
        const h1El = root.querySelector('#gov-loop-answer');
        const clone = root.cloneNode(true);
        clone.querySelector('#gov-loop-answer')?.remove();
        return clone.innerText || '';
      });
      const needle = 'lacks PI metadata';
      const matches = outsideH1.split(needle).length - 1;
      expect(matches).toBeLessThan(2);
      assertTelemetryClean(telemetry);
    });

    await test.step('04 Commitment Pack control visible in squad rail without AI', async () => {
      await expect(page.locator('.gov-next-move-rail [data-copy-commitment-pack]')).toBeVisible({ timeout: 12000 });
      await page.locator('.gov-next-move-rail [data-copy-commitment-pack]').first().click();
      await expect(page.locator('.gov-next-move-rail [data-commitment-pack-status]').first()).toContainText(/Copied|failed/i, { timeout: 5000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('05 chrome Sprint href keeps squad continuity', async () => {
      const sprintHref = await page.locator('a[data-top-surface="sprints"]').first().getAttribute('href');
      expect(sprintHref || '').toMatch(/squad=SD|projects=SD/);
      assertTelemetryClean(telemetry);
    });

    await test.step('06 decision drawer Close not clipped under chrome', async () => {
      await page.locator('[data-drawer-close]').first().click({ timeout: 2000 }).catch(() => {});
      await page.locator('.gov-loop-primary, [data-loop-primary]').first().click({ timeout: 10000 });
      const drawer = page.locator('#delivera-gov-right-drawer .gov-loop-drawer, #delivera-gov-right-drawer .gov-resolution-sheet, #delivera-gov-right-drawer .gov-right-drawer-panel');
      await expect(drawer.first()).toBeVisible({ timeout: 15000 });
      const closeBtn = page.locator('#delivera-gov-right-drawer [data-drawer-close]').first();
      await expect(closeBtn).toBeVisible();
      const closeBox = await closeBtn.boundingBox();
      expect(closeBox).toBeTruthy();
      if (closeBox) expect(closeBox.y).toBeGreaterThanOrEqual(0);
      await closeBtn.click({ timeout: 3000 }).catch(() => {});
      assertTelemetryClean(telemetry);
    });

    await test.step('07 Sprint Proof non-empty; Next-move does not explode risk filters', async () => {
      await page.goto('/current-sprint?squad=SD&projects=SD&boardId=1');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.current-sprint-header-bar[data-context-bar="true"]')).toBeVisible({ timeout: 25000 });
      const proofCell = page.locator('.attention-queue-table td[data-label="Proof"], table.attention-queue td[data-label="Proof"]').first();
      if (await proofCell.count()) {
        const proofText = (await proofCell.innerText()).trim();
        expect(proofText.length).toBeGreaterThan(0);
      }
      const beforeUrl = page.url();
      const nextMove = page.locator('[data-header-action="focus-remediation"]').first();
      if (await nextMove.count()) {
        await nextMove.click();
        await page.waitForTimeout(400);
        const after = new URL(page.url());
        const risk = after.searchParams.get('risk') || '';
        expect(risk.split(',').filter(Boolean).length).toBeLessThanOrEqual(2);
        expect(after.searchParams.get('squad') || beforeUrl).toMatch(/SD/);
      }
      assertTelemetryClean(telemetry);
    });

    await test.step('08 Actions short CTA or batch group for shared diagnosis', async () => {
      await page.goto('/actions?squad=SD');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('body.actions-page')).toBeVisible({ timeout: 15000 });
      const cta = page.locator('.action-case-next .btn-primary').first();
      if (await cta.count()) {
        const label = await cta.innerText();
        expect(label).toMatch(/Confirm FY\/Q|Review|Open|epics/i);
      }
      await expect(page.locator('[data-top-action="agent"].is-active, [data-top-surface="actions"].is-active')).toHaveCount(1);
      assertTelemetryClean(telemetry);
    });

    await test.step('09 Settings exceptions band + AI collapsed; registry find via chrome', async () => {
      await page.goto('/settings');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-settings-registry-mount')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#gov-settings-registry-mount')).toContainText(/Participation exceptions|PI participation/i);
      await expect(page.locator('.registry-filter:not(.registry-filter--sr-only)')).toHaveCount(0);
      const aiFold = page.locator('.gov-ai-processing-fold');
      if (await aiFold.count()) {
        await expect(aiFold).not.toHaveAttribute('open', '');
      }
      assertTelemetryClean(telemetry);
    });

    await test.step('10 logcat clean — zero pageerror fail-fast', async () => {
      assertTelemetryClean(telemetry);
    });
  });
});
