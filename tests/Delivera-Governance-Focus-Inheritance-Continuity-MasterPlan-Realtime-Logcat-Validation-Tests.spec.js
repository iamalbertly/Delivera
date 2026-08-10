/**
 * Governance Focus-Inheritance Continuity Master Plan — realtime UI + logcat.
 * Accordion lock persists last-focus → bare /current-sprint and /actions inherit SD
 * (never excluded MPSA). H1 soft-swap, compact chips, Settings Apply-primary smoke.
 * Keep ≤10 focused steps; fail fast via Console Guard + telemetry.
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
const LAST_FOCUS_KEY = 'delivera:continuity:last-focus-squad:v1';

function activeLoopAnswer() {
  return {
    schemaVersion: 2,
    cacheRelease: '20260730a',
    presentationContractVersion: 6,
    answerVersion: 12,
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
        payloadHash: 'sd-hash-focus',
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
        payloadHash: 'fin-hash-focus',
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
        statusNow: 'In Progress',
        matchState: 'partly-matched',
        proofAge: { state: 'aging', copy: 'Evidence moved 0 business days ago.' },
        version: 1,
        ownerRoute: { role: 'Squad PO', displayName: 'Husna', unresolved: false },
        nextAction: { id: 'send-nudge', label: 'Nudge Squad PO: Husna' },
        expectedVsActual: {
          expected: { issueKey: 'SD-5314', startDate: '2026-07-01', endDate: '2026-07-31' },
          actual: { issueKeys: ['SD-5304'], childTotal: 2, doneChildCount: 0, openChildCount: 2 },
        },
      },
      {
        promiseId: 'prm-fin-1',
        squad: 'FIN',
        originalText: 'Finance ledger uplift',
        issueKey: 'FIN-1075',
        statusNow: 'To Do',
        matchState: 'no-jira-proof',
        expectedVsActual: { expected: { issueKey: 'FIN-1075' }, actual: { issueKeys: [] } },
      },
    ],
  };
}

async function mockSurfaces(page) {
  const answer = activeLoopAnswer();
  await page.addInitScript(({ projectsKey, cachedAnswer }) => {
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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) });
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
          piConfidence: {
            trusted: true,
            timelineChips: [
              { issueKey: 'SD-5314', title: 'NBA', plannedEndDate: null, deliveryPct: 0, squad: 'SD', childHint: '0/2 children', childTotal: 2 },
              { issueKey: 'FIN-1075', title: 'Finance peer', plannedEndDate: '2026-07-31', deliveryPct: 10, squad: 'FIN' },
            ],
          },
        },
      }),
    });
  });
  await page.route('**/api/governance/brief.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/session-meta.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ initials: 'DL', emailMasked: 'd***@example.com', canManageOrganizationSettings: true }),
  }));
  await page.route('**/api/governance/registry.json**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        squads: [
          { squadKey: 'MPSA', friendlyName: 'M-SQUAD', participationState: 'pending-consent', productOwner: '', scrumMaster: '', boardMapping: [], revision: 1 },
          { squadKey: 'VB', friendlyName: 'Vodacom Business', participationState: 'pending-consent', productOwner: '', scrumMaster: '', boardMapping: [], revision: 1 },
          {
            squadKey: 'SD', friendlyName: 'DMS Squad', participationState: 'pi-governed',
            productOwner: 'Husna', scrumMaster: 'Albert', boardMapping: [1], revision: 1,
            suggestions: { people: [{ displayName: 'Husna', role: 'PO' }, { displayName: 'Albert', role: 'SM' }] },
          },
        ],
        auditHistory: [],
      }),
    });
  });
  await page.route('**/api/governance/actions.json**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cases: [{
          promiseId: 'prm-sd-1',
          squad: 'SD',
          squadId: 'SD',
          issueKey: 'SD-5314',
          title: 'NBA Integration',
          diagnosisLabel: 'PI epic has active sprint stories',
          urgencyLabel: 'needs-attention',
          customerOrPiImpact: 'No evidence gap is currently detected.',
          proofAge: { copy: 'This work has not moved in 22 business days.' },
          ownerRoute: { displayName: 'Husna' },
          nextAction: { label: 'Keep SD-5314 evidence current' },
        }],
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
    '**/api/current-sprint/truth.json**',
  ]) {
    await page.route(pattern, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: pattern.includes('boards')
        ? JSON.stringify({
          projects: ['SD'],
          boards: [{ id: 1, name: 'DMS board', projectKey: 'SD' }],
          projectErrors: [],
        })
        : pattern.includes('current-sprint')
          ? JSON.stringify({
            board: { id: 1, name: 'DMS', projectKey: 'SD', projectKeys: ['SD'] },
            sprint: { id: 9024, name: 'FY27DMS07', startDate: '2026-07-01', endDate: '2026-07-31' },
            stories: [],
            summary: { doneStories: 0 },
            decisionCockpit: { health: { status: 'Needs Attention', message: 'Top blocker needs review.', tone: 'danger' } },
          })
          : pattern.includes('ai-')
            ? JSON.stringify({ provider: 'openrouter', configured: true, label: 'OpenRouter' })
            : '{}',
    }));
  }
  return answer;
}

test.describe('Governance focus-inheritance continuity master plan', () => {
  test.describe.configure({ retries: 0 });

  test('@focused lock persists focus; Sprint/Actions inherit SD; H1 soft-swap; compact chips; logcat', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockSurfaces(page);

    await test.step('01 Portfolio paint; preferred may be FIN', async () => {
      await loginIfRequired(page, '/governance?projects=SD,FIN', {
        rootSelector: '[data-testid="governance-active-loop"]',
        timeout: 25000,
      });
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.evaluate((key) => { try { sessionStorage.removeItem(key); } catch (_) {} }, LAST_FOCUS_KEY);
      await expect(page.locator('[data-testid="governance-active-loop"]')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('.gov-story-row[data-story-squad="SD"]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('02 Lock DMS — URL unchanged; H1 soft-swaps; rail SD; CTA not FIN', async () => {
      const before = page.url();
      await page.locator('.gov-story-row[data-story-squad="SD"]').click();
      await expect(page.locator('[data-story-squad-wrap="SD"][data-accordion-state="locked"]')).toBeVisible();
      expect(page.url()).toBe(before);
      expect(page.url()).not.toMatch(/view=squad/);
      await expect(page.locator('[data-gov-delivery-h1]')).toContainText(/DMS|Kilimanjaro|SD/i, { timeout: 5000 });
      const keys = await page.locator('[data-epic-commitment-rail] [data-issue-key]').evaluateAll((nodes) =>
        nodes.map((n) => String(n.getAttribute('data-issue-key') || '').toUpperCase()));
      expect(keys.every((k) => !k || k.startsWith('SD-'))).toBeTruthy();
      const primary = await page.locator('[data-loop-primary]').innerText();
      expect(primary).not.toMatch(/Confirm.*FIN-|FIN-\d+/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 sessionStorage last-focus = SD', async () => {
      const focus = await page.evaluate((key) => sessionStorage.getItem(key), LAST_FOCUS_KEY);
      expect(String(focus || '').toUpperCase()).toBe('SD');
      assertTelemetryClean(telemetry);
    });

    await test.step('04 bare /current-sprint inherits SD — not excluded MPSA', async () => {
      await page.goto('/current-sprint');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForTimeout(1500);
      const url = page.url();
      expect(url).toMatch(/[?&]squad=SD/i);
      expect(url).not.toMatch(/[?&]squad=MPSA/i);
      const body = await page.locator('body').innerText();
      expect(body).not.toMatch(/Today for M-SQUAD/i);
      expect(body).toMatch(/DMS|SD|FY27DMS07|Kilimanjaro/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('05 bare /actions inherits SD identity', async () => {
      const focusBefore = await page.evaluate((key) => sessionStorage.getItem(key), LAST_FOCUS_KEY);
      expect(String(focusBefore || '').toUpperCase()).toBe('SD');
      await page.goto('/actions');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await page.waitForSelector('#actions-queue-mount, #actions-queue-summary', { timeout: 15000 });
      await page.waitForTimeout(800);
      const focusAfter = await page.evaluate((key) => sessionStorage.getItem(key), LAST_FOCUS_KEY);
      // Inherit may rewrite URL or only scope the queue — assert focus + summary, URL when rewritten.
      expect(String(focusAfter || '').toUpperCase()).toBe('SD');
      await expect(page.locator('#actions-queue-summary')).toContainText(/SD/i, { timeout: 8000 });
      if (page.url().includes('squad=')) {
        expect(page.url()).toMatch(/[?&]squad=SD/i);
      }
      const honest = page.locator('[data-action-honest-state]');
      if (await honest.count()) {
        const row = await page.locator('[data-action-case]').first().innerText();
        expect(row).not.toMatch(/No evidence gap[\s\S]*22 business days/i);
      }
      assertTelemetryClean(telemetry);
    });

    await test.step('06 Full detail tunnel — no FIN rail; no twin attention cell', async () => {
      await page.goto('/governance?projects=SD,FIN');
      await expect(page.locator('[data-testid="governance-active-loop"]')).toBeVisible({ timeout: 20000 });
      await page.locator('.gov-story-row[data-story-squad="SD"]').click();
      await page.locator('[data-full-squad-detail="SD"]').click();
      await expect(page).toHaveURL(/[?&]squad=SD/);
      await expect(page.locator('[data-gov-delivery-bento]')).toHaveAttribute('data-bento-scope', 'squad');
      await expect(page.locator('[data-gov-delivery-bento] [data-delivery-cell="attention"]')).toHaveCount(0);
      const tunnelKeys = await page.locator('[data-epic-commitment-rail] [data-issue-key]').evaluateAll((nodes) =>
        nodes.map((n) => String(n.getAttribute('data-issue-key') || '').toUpperCase()));
      expect(tunnelKeys.every((k) => !k || k.startsWith('SD-'))).toBeTruthy();
      assertTelemetryClean(telemetry);
    });

    await test.step('07 compact chip — missing-date has data-compact-bars', async () => {
      const compact = page.locator('[data-epic-rail-chip][data-compact-bars="1"], [data-epic-rail-chip][data-missing-dates="true"]');
      await expect(compact.first()).toBeVisible({ timeout: 8000 });
      const hasBars = await page.locator('[data-compact-bars="1"] .gov-pi-chip-bars').count();
      expect(hasBars).toBe(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('08 Settings Select pending enables Apply policy', async () => {
      await page.goto('/settings#gov-settings-registry-mount');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('[data-registry-org-policy]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('label.registry-filter')).toHaveCount(0);
      await page.locator('[data-select-pending]').click();
      await expect(page.locator('[data-selected-count]')).toContainText(/[1-9]\d* squad/i, { timeout: 5000 });
      await expect(page.locator('[data-bulk-preview]')).toBeEnabled();
      await expect(page.locator('[data-bulk-preview]')).toContainText(/Apply/i);
      assertTelemetryClean(telemetry);
    });

    await test.step('09 logcat clean', async () => {
      assertTelemetryClean(telemetry);
    });
  });
});
