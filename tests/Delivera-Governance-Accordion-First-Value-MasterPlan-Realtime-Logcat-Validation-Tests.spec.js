/**
 * Governance Accordion-First Value Master Plan — realtime UI + logcat.
 * Hover/focus peek → click lock accordion (no URL) → Full squad detail CTA,
 * squad-scoped bento, narrative Commitment Pack, Settings exception smoke.
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
    cacheRelease: '20260730a',
    presentationContractVersion: 5,
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
    answer: '2 squads need attention.',
    sourceLine: 'Compared with FY27 Q2 PI contract · 4 promises checked',
    deliveraDid: 'Delivera matched the contract to Jira and prepared safe owner asks.',
    verifiedAt: NOW,
    evidenceObservedAt: NOW,
    loopCompletion: 40,
    decisionCoverage: { closed: 1, total: 4, preparedOwnerAsks: 2, copy: '1 decided · 3 open · 4 in scope' },
    lensSummaries: { overall: '2 squads need attention.' },
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
        piPct: 67,
        topState: '2 need attention',
        proofState: 'stale proof',
        payloadHash: 'sd-hash-accordion',
        baselineCoverage: { state: 'verified', copy: 'DMS baseline verified.' },
        sprintReality: {
          state: 'active',
          sprint: { name: 'FY27DMS07', id: 9024 },
          daysRemaining: 4,
          copy: 'FY27DMS07 is active, 4 business days remaining.',
        },
        sprintCadence: { label: 'FY27DMS07 is active, 4 business days remaining.' },
        contractState: { label: 'Needs metadata', detail: 'Evidence requires PI Team review.' },
        trustFactor: { level: 'limited', label: 'Limited, proof gap' },
        workSplit: { unknownPct: 40, unplannedPct: 18, explanation: 'Partial unknown work.' },
        doingInstead: { major: { title: 'Operational noise', percentage: 18 }, copy: 'Operational noise. 5 low-priority tickets.' },
        unknownWork: { promoted: false, copy: '' },
        nextAction: { id: 'send-nudge', label: 'Nudge Squad PO: Husna' },
        currentWork: [{ title: 'NBA Integration', systemDerived: false }],
      },
      {
        squad: 'FIN',
        displayName: 'Finance Squad',
        promiseCount: 2,
        attentionCount: 10,
        piPct: 20,
        topState: '10 need attention',
        proofState: 'stale proof',
        payloadHash: 'fin-hash-accordion',
        baselineCoverage: { state: 'verified', copy: 'Finance baseline verified.' },
        sprintReality: { state: 'active', sprint: { name: 'FY27Q2 FIN SPN3' }, daysRemaining: 9, copy: 'Sprint active.' },
        sprintCadence: { label: 'Sprint active' },
        contractState: { label: 'Key gap', detail: 'Approved Jira key does not resolve' },
        trustFactor: { level: 'limited', label: 'Limited' },
        workSplit: { unknownPct: 55, unplannedPct: 40, explanation: 'Finance unknown cluster.' },
        doingInstead: { major: { title: 'FIN diversion', percentage: 40 }, copy: 'Finance diverting.' },
        unknownWork: { promoted: true, copy: 'Unknown work is 55%.' },
        nextAction: { label: 'Confirm whether FIN-1075 moved.' },
      },
    ],
    promises: [
      {
        promiseId: 'prm-sd-1',
        squad: 'SD',
        squadDisplayName: 'DMS Squad (Kilimanjaro Legends)',
        originalText: 'NBA Integration & Soga Pilot',
        issueKey: 'SD-5314',
        issueUrl: 'https://vodacomtz.atlassian.net/browse/SD-5314',
        statusNow: 'In Progress',
        quarter: 'FY27 Q2',
        fiscalStart: '2026-07-01',
        fiscalEnd: '2026-07-31',
        matchState: 'partly-matched',
        matchLabel: 'PI epic has active sprint stories',
        diagnosisLabel: 'PI epic has active sprint stories',
        proofAge: { state: 'aging', copy: 'Evidence moved 0 business days ago.' },
        version: 1,
        ownerRoute: { role: 'Squad PO', displayName: 'Husna', unresolved: false },
        nextAction: { id: 'send-nudge', label: 'Nudge Squad PO: Husna' },
        allowedActions: [{ id: 'send-nudge', allowed: true, reason: 'Will send via Squad PO.' }],
        expectedVsActual: {
          expected: { commitment: 'NBA Integration', fiscalPeriod: 'FY27 Q2', issueKey: 'SD-5314', startDate: '2026-07-01', endDate: '2026-07-31' },
          actual: {
            issueKeys: ['SD-5304', 'SD-5305'],
            status: 'In Progress',
            matchedThrough: 'epic-child',
            sprintName: 'FY27DMS07',
            childTotal: 2,
            doneChildCount: 1,
            openChildCount: 1,
            children: [
              { issueKey: 'SD-5304', status: 'Done', startDate: '2026-07-01', endDate: '2026-07-20' },
              { issueKey: 'SD-5305', status: 'In Progress', startDate: '2026-07-05', endDate: '2026-07-31' },
            ],
          },
          durationBusinessDays: 12,
        },
      },
      {
        promiseId: 'prm-sd-2',
        squad: 'SD',
        squadDisplayName: 'DMS Squad (Kilimanjaro Legends)',
        originalText: 'EVOD Upgrade (Performance & CX)',
        issueKey: 'SD-5309',
        issueUrl: 'https://vodacomtz.atlassian.net/browse/SD-5309',
        statusNow: 'Done',
        quarter: 'FY27 Q2',
        fiscalStart: '2026-07-05',
        fiscalEnd: '2026-07-31',
        matchState: 'matched',
        matchLabel: 'Matched',
        diagnosisLabel: 'Milestone delivered with open children',
        proofAge: { state: 'fresh', copy: 'Evidence is current.' },
        version: 1,
        ownerRoute: { role: 'Squad PO', displayName: 'Husna', unresolved: false },
        nextAction: { id: 'pull-fresh-evidence', label: 'Pull fresh proof' },
        allowedActions: [{ id: 'pull-fresh-evidence', allowed: true, reason: 'Refresh.' }],
        expectedVsActual: {
          expected: { commitment: 'EVOD', fiscalPeriod: 'FY27 Q2', issueKey: 'SD-5309', startDate: '2026-07-05', endDate: '2026-07-31' },
          actual: {
            issueKeys: ['SD-5309'],
            status: 'Done',
            matchedThrough: 'exact-key',
            childTotal: 1,
            doneChildCount: 1,
            openChildCount: 0,
            children: [
              { issueKey: 'SD-5310', status: 'Done', startDate: '2026-07-05', endDate: '2026-07-28' },
            ],
          },
        },
      },
      {
        promiseId: 'prm-fin-1',
        squad: 'FIN',
        originalText: 'Finance ledger uplift',
        issueKey: 'FIN-1075',
        statusNow: 'To Do',
        matchState: 'no-jira-proof',
        attentionCount: 1,
        expectedVsActual: { expected: { issueKey: 'FIN-1075' }, actual: { issueKeys: [], status: 'Unknown' } },
      },
    ],
  };
}

async function mockSurfaces(page) {
  const answer = activeLoopAnswer();
  await page.addInitScript(({ projectsKey, cachedAnswer }) => {
    globalThis.__deliveraTestNavigationStartedAt = performance.now();
    globalThis.__deliveraFirstValueAt = 0;
    new MutationObserver(() => {
      if (!globalThis.__deliveraFirstValueAt && document.querySelector('[data-testid="governance-active-loop"]')) {
        globalThis.__deliveraFirstValueAt = performance.now();
      }
    }).observe(document, { childList: true, subtree: true });
    try {
      localStorage.setItem(projectsKey, 'SD,FIN');
      localStorage.setItem('delivera:runtime-release:v1:schema', '20260730a');
      localStorage.setItem('delivera:governance:active-loop:v2:20260730a:FIN,SD:current', JSON.stringify({
        savedAt: new Date().toISOString(),
        answer: cachedAnswer,
      }));
    } catch (_) {}
  }, { projectsKey: PROJECTS_SSOT_KEY, cachedAnswer: answer });
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
  await page.route('**/api/governance-brief.json**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projects: ['SD', 'FIN'],
        meta: {
          boardEpicIndex: [
            { issueKey: 'SD-5314', title: 'NBA Integration', plannedStartDate: '2026-07-01', plannedEndDate: '2026-07-31', storyCount: 2, doneCount: 1 },
            { issueKey: 'SD-5309', title: 'EVOD Upgrade', plannedStartDate: '2026-07-05', plannedEndDate: '2026-07-31', storyCount: 1, doneCount: 1 },
          ],
          piConfidence: {
            trusted: true,
            confidencePct: 72,
            timelineChips: [
              { issueKey: 'SD-5314', title: 'NBA Integration', plannedStartDate: '2026-07-01', plannedEndDate: '2026-07-31', deliveryPct: 50, squad: 'SD' },
              { issueKey: 'SD-5309', title: 'EVOD Upgrade', plannedStartDate: '2026-07-05', plannedEndDate: '2026-07-31', deliveryPct: 100, squad: 'SD' },
            ],
            counts: { committed: 2, atRisk: 1, missingDates: 0 },
          },
        },
        baselineComparison: {
          items: [
            { issueKey: 'SD-5314', title: 'NBA Integration', plannedStartDate: '2026-07-01', targetDate: '2026-07-31', epicActivity: { storyCount: 2, doneCount: 1 } },
            { issueKey: 'SD-5309', title: 'EVOD Upgrade', plannedStartDate: '2026-07-05', targetDate: '2026-07-31', epicActivity: { storyCount: 1, doneCount: 1 }, verdict: 'delivered' },
          ],
        },
      }),
    });
  });
  await page.route('**/api/governance/brief.json**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/session-meta.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ initials: 'DL', emailMasked: 'd***@example.com', canManageOrganizationSettings: true }),
  }));
  await page.route('**/api/governance/registry.json**', async (route) => {
    const exceptions = [
      ['VB', 'Vodacom Business'], ['MPSA', 'M-SQUAD'], ['MVA', 'Digital Squad'],
      ['MAS', 'Mini Apps'], ['TRS', 'T-Squad'], ['AMS2', 'AMS'], ['BIO', 'Biometric KYC'],
    ].map(([squadKey, friendlyName]) => ({
      squadKey, friendlyName, participationState: 'pending-consent', productOwner: '', scrumMaster: '', boardMapping: [], revision: 1,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        squads: [...exceptions, {
          squadKey: 'SD', friendlyName: 'DMS Squad', participationState: 'pi-governed',
          productOwner: 'Husna', scrumMaster: 'DMS Scrum Master', boardMapping: [1], revision: 1,
        }],
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
    '**/api/boards.json**',
    '**/api/current-sprint.json**',
  ]) {
    await page.route(pattern, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: pattern.includes('ai-')
        ? JSON.stringify({ provider: 'openrouter', configured: true, label: 'OpenRouter' })
        : pattern.includes('boards')
          ? JSON.stringify({ projects: ['SD'], boards: [{ id: 1, name: 'DMS board', projectKey: 'SD' }], projectErrors: [] })
          : pattern.includes('current-sprint')
            ? JSON.stringify({ board: { id: 1, name: 'DMS', projectKey: 'SD' }, sprint: { id: 9024, name: 'FY27DMS07' }, stories: [], summary: {} })
            : '{}',
    }));
  }
  return answer;
}

test.describe('Governance accordion-first value master plan', () => {
  test.describe.configure({ retries: 0 });

  test('@focused accordion peek lock full-detail pack squad-bento logcat', async ({ page, context }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockSurfaces(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

    await test.step('01 ActiveLoop first paint', async () => {
      await loginIfRequired(page, '/governance?projects=SD,FIN', {
        rootSelector: '[data-testid="governance-active-loop"]',
        timeout: 25000,
      });
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-testid="governance-active-loop"]')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('.gov-story-row[data-story-squad="SD"]')).toBeVisible();
      await expect(page.locator('[data-gov-delivery-bento]')).toHaveAttribute('data-bento-scope', 'portfolio');
      assertTelemetryClean(telemetry);
    });

    await test.step('02 hover peek expands inline without URL change', async () => {
      const row = page.locator('.gov-story-row[data-story-squad="SD"]');
      const before = page.url();
      await row.hover();
      await expect(page.locator('[data-story-squad-wrap="SD"][data-accordion-state="peek"] [data-squad-accordion]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.gov-loop-proof-popover')).toHaveCount(0);
      expect(page.url()).toBe(before);
      expect(page.url()).not.toMatch(/[?&]squad=SD/);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 click locks accordion; matrix stays; URL unchanged', async () => {
      const before = page.url();
      await page.locator('.gov-story-row[data-story-squad="SD"]').click();
      await expect(page.locator('[data-story-squad-wrap="SD"][data-accordion-state="locked"]')).toBeVisible();
      await expect(page.locator('[data-accordion-evidenced]')).toBeVisible();
      await expect(page.locator('[data-accordion-diverted]')).toBeVisible();
      await expect(page.locator('[data-accordion-sprint]')).toBeVisible();
      await expect(page.locator('.gov-story-matrix')).toBeVisible();
      expect(page.url()).toBe(before);
      expect(page.url()).not.toMatch(/view=squad/);
      assertTelemetryClean(telemetry);
    });

    await test.step('04 Full squad detail CTA opens tunnel with squad-scoped bento', async () => {
      await page.locator('[data-full-squad-detail="SD"]').click();
      await expect(page).toHaveURL(/[?&]squad=SD/);
      await expect(page.locator('body')).toHaveClass(/governance-squad-selected/);
      await expect(page.locator('[data-gov-delivery-bento]')).toHaveAttribute('data-bento-scope', 'squad');
      const attention = await page.locator('[data-delivery-cell="attention"] strong').innerText();
      expect(Number(attention)).toBeLessThanOrEqual(4);
      await expect(page.locator('[data-spotlight-outcome]')).toBeVisible();
      await expect(page.locator('[data-spotlight-sprint]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('05 epic chips show child dates or children honesty', async () => {
      const rail = page.locator('[data-epic-commitment-rail]:not([data-epic-rail-loading])').first();
      await expect(rail).toBeVisible({ timeout: 10000 });
      const meta = await rail.innerText();
      expect(meta.length).toBeGreaterThan(10);
      // At least one chip must show a real delivery signal or dated range (not only blank 0%).
      expect(meta).toMatch(/(\d+% delivered|→|children)/i);
      const commitment = page.locator('[data-spotlight-commitments]');
      await expect(commitment).toBeVisible();
      await expect(commitment).toContainText(/SD-5314|NBA|SD-5309|EVOD/i);
      await expect(commitment).toContainText(/Jul|children|Done|Progress/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('06 narrative commitment pack preview + copy', async () => {
      const preview = page.locator('[data-commitment-pack-preview]');
      await expect(preview).toBeVisible({ timeout: 10000 });
      const text = await preview.innerText();
      expect(text).toMatch(/Here is the update on our/i);
      expect(text).toMatch(/SD-5314|NBA Integration/i);
      expect(text).toMatch(/Dates:/i);
      expect(text).toMatch(/Status:/i);
      await page.locator('[data-copy-commitment-pack]').click();
      await expect(page.locator('[data-commitment-pack-status]')).toContainText(/Copied|Copy failed/i, { timeout: 5000 });
      const clipboard = await page.evaluate(async () => {
        try { return await navigator.clipboard.readText(); } catch (_) { return ''; }
      });
      if (clipboard) {
        expect(clipboard).toMatch(/Here is the update on our/i);
        expect(clipboard).toMatch(/Dates:/i);
      }
      assertTelemetryClean(telemetry);
    });

    await test.step('07 back to portfolio restores matrix', async () => {
      await page.locator('[data-story-all]').click();
      await expect(page.locator('.gov-story-matrix')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('body')).not.toHaveClass(/governance-squad-selected/);
      await expect(page.locator('[data-gov-delivery-bento]')).toHaveAttribute('data-bento-scope', 'portfolio');
      assertTelemetryClean(telemetry);
    });

    await test.step('08 Settings org policy band smoke', async () => {
      await page.goto('/settings#gov-settings-registry-mount');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('#gov-settings-registry-mount')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-registry-org-policy]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-bulk-participation]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('09 logcat clean after full click path', async () => {
      assertTelemetryClean(telemetry);
    });
  });
});
