/**
 * Governance Delivery-Trust MasterPlan — Realtime + Logcat (≤10 steps).
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { loginIfRequired } from './Delivera-Playwright-Login-If-Required-01Helper.js';
import { PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';

const NOW = new Date('2026-07-17T10:32:00.000Z').toISOString();

function buildAnswer() {
  return {
    schemaVersion: 2,
    presentationContractVersion: 5,
    answerVersion: 9,
    missionHeader: 'PORTFOLIO MISSION FY27 Q2 PI contract governance',
    answer: '2 squads need evidence decisions.',
    sourceLine: 'Compared with FY27 Q2 PI contract · 4 promises checked',
    deliveraDid: 'Delivera matched the contract to Jira and prepared owner asks.',
    verifiedAt: NOW,
    evidenceObservedAt: NOW,
    freshness: { state: 'calm', copy: 'Last verified recently.' },
    contract: { id: 'c-q2', piName: 'FY27 Q2', source: 'approved-baseline' },
    scope: { projects: ['SD', 'RPA'], expectedSquads: 2, verifiedSquads: 2, complete: true, piGovernedSquads: 2 },
    decisionCoverage: { closed: 1, total: 4, preparedOwnerAsks: 2, copy: '1 decided · 3 open · 4 in scope' },
    lensSummaries: { overall: 'DMS and Finance drive PI miss risk because commitments need evidence.' },
    excludedOperationalGroups: [],
    nextDecisionPromiseId: 'prm-sd-1',
    squads: [
      {
        squad: 'SD', displayName: 'DMS Squad', riskOrder: 1, payloadHash: 'h-sd',
        attentionCount: 2, promiseCount: 2, topState: 'needs-attention', proofState: 'stale',
        piPct: 31,
        contractState: { label: 'Needs attention', detail: '2 commitments need evidence.' },
        trustFactor: { label: 'Limited', level: 'limited' },
        baselineCoverage: { state: 'verified', copy: 'Approved baseline verified.' },
        sprintReality: { state: 'active', sprintName: 'FY27DMS06', daysRemaining: 6, copy: 'Sprint active.' },
        workSplit: { unplannedPct: 38, explanation: 'Unplanned cluster present.' },
        doingInstead: { major: { title: 'Legacy migrations', percentage: 38 }, copy: 'Diverting into migrations.' },
        unknownWork: { promoted: false }, possibleRework: { promoted: null },
        nextAction: { id: 'send-nudge', label: 'Confirm SD-5314 moved' },
        ownerRoute: { displayName: 'Amina N.', role: 'Squad PO', accountId: 'acc-1' },
      },
      {
        squad: 'RPA', displayName: 'Finance Squad', riskOrder: 2, payloadHash: 'h-rpa',
        attentionCount: 1, promiseCount: 2, topState: 'needs-attention', proofState: 'aging',
        piPct: 55,
        contractState: { label: 'Needs attention', detail: '1 commitment needs evidence.' },
        trustFactor: { label: 'Limited', level: 'limited' },
        baselineCoverage: { state: 'verified', copy: 'Approved baseline verified.' },
        sprintReality: { state: 'active', sprintName: 'Finance Sprint 8', daysRemaining: 14, copy: 'Sprint active.' },
        workSplit: { unplannedPct: 12, explanation: 'Support mix.' },
        doingInstead: { copy: 'No major diversion proven.', clusters: [] },
        unknownWork: { promoted: false }, possibleRework: { promoted: null },
        nextAction: { id: 'pull-fresh-evidence', label: 'Pull fresh proof' },
      },
    ],
    promises: [
      {
        promiseId: 'prm-sd-1', squad: 'SD', issueKey: 'SD-5314',
        originalText: 'FY27 Q2 – DMS – NBA – Customer journey integration',
        matchState: 'partly-matched', verdictLabel: 'Partly matched', version: 1,
        diagnosisCode: 'off-plan-or-support', diagnosisLabel: 'Squad is delivering other work',
        caseState: 'needs-attention', statusNow: 'In Progress',
        ownerRoute: { displayName: 'Amina N.', role: 'Squad PO', accountId: 'acc-1' },
        expectedVsActual: {
          expected: { startDate: '2026-05-01', endDate: '2026-07-31', issueKey: 'SD-5314', fiscalPeriod: 'FY27 Q2' },
          actual: { childTotal: 5, doneChildCount: 2, openChildCount: 3, issueKeys: ['SD-5314'], status: 'In Progress', matchedThrough: 'exact-key' },
        },
        nextAction: { label: 'Confirm SD-5314 moved' },
        allowedActions: [{ id: 'send-nudge', allowed: true, reason: 'Owner ready.' }],
        diagnosisEvidence: [{ label: 'Jira key', value: 'SD-5314' }],
      },
      {
        promiseId: 'prm-rpa-1', squad: 'RPA', issueKey: 'RPA-88', originalText: 'Automate dispute workflow',
        matchState: 'partly-matched', verdictLabel: 'Partly matched', caseState: 'needs-attention', statusNow: 'In Progress', version: 1,
        expectedVsActual: {
          expected: { startDate: '2026-04-01', endDate: '', issueKey: 'RPA-88' },
          actual: { childTotal: 0, doneChildCount: 0, openChildCount: 0, issueKeys: ['RPA-88'] },
        },
        nextAction: { label: 'Pull fresh proof' },
        allowedActions: [{ id: 'pull-fresh-evidence', allowed: true, reason: 'Refresh.' }],
      },
    ],
  };
}

function buildBrief() {
  return {
    briefId: 'delivery-trust',
    projects: ['SD', 'RPA'],
    generatedAt: NOW,
    freshness: { confidenceLimit: 'live' },
    deliveryTruth: { committed: 4, done: 1 },
    executiveView: { verdictTier: 'watch', verdictLine: 'NEEDS ATTENTION' },
    leadershipNarrative: { meetingAnswer: 'Act on DMS first', narratedBy: 'template' },
    baselineComparison: {
      items: [
        {
          issueKey: 'SD-5314',
          title: 'FY27 Q2 – DMS – NBA – Customer journey integration',
          plannedStartDate: '2026-05-01',
          targetDate: '2026-07-31',
          verdict: 'at-risk',
          epicActivity: { storyCount: 5, doneCount: 2, firstActiveSprintStart: '2026-05-01', lifecycle: 'active' },
        },
        {
          issueKey: 'RPA-88',
          title: 'Automate dispute workflow',
          plannedStartDate: '2026-04-01',
          targetDate: '',
          verdict: 'unknown',
          epicActivity: { storyCount: 3, doneCount: 1, firstActiveSprintStart: '2026-04-01', lifecycle: 'active' },
        },
      ],
    },
    meta: {
      narratedBy: 'template',
      safeToSend: true,
      setupGaps: [],
      partialProjects: [],
      boardEpicIndex: [],
      adHocEpics: [{ issueKey: 'SD-99', title: 'Random epic', formatAligned: false, reason: 'not in baseline' }],
      piConfidence: {
        trusted: false,
        confidencePct: 42,
        counts: { committed: 4, onTrack: 1, atRisk: 2, offPlan: 1, missingDates: 1 },
        timelineChips: [
          {
            issueKey: 'SD-5314',
            title: 'FY27 Q2 – DMS – NBA – Customer journey integration',
            squad: 'SD',
            plannedStartDate: '2026-05-01',
            plannedEndDate: '2026-07-31',
            elapsedPct: 70,
            deliveryPct: 40,
            confidenceLabel: 'Medium',
            childHint: '2/5 children',
            childTotal: 5,
            childDone: 2,
          },
        ],
      },
      workerReceipt: { line: 'Last run: 1m ago', inboxTotal: 0 },
    },
    topRisks: [],
    portfolioRisks: [],
    evidencePack: { rows: [] },
    squadInsights: [],
  };
}

async function mockJourney(page) {
  const answer = buildAnswer();
  const brief = buildBrief();
  await page.addInitScript(({ key, projects }) => {
    try {
      localStorage.setItem(key, projects);
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith('delivera:governance:active-loop')) localStorage.removeItem(k);
      }
      sessionStorage.removeItem('delivera:brief:cache:v1');
    } catch (_) { /* privacy */ }
  }, { key: PROJECTS_SSOT_KEY, projects: 'SD,RPA' });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body = {};
    if (path === '/api/governance/active-loop.json') body = answer;
    else if (path.includes('/api/governance/squads/') && path.endsWith('/detail.json')) {
      const squadId = path.split('/squads/')[1]?.split('/')[0] || 'SD';
      const found = answer.squads.find((s) => s.squad === squadId) || answer.squads[0];
      body = {
        schemaVersion: 3,
        storyVersion: 9,
        context: { squadId },
        squad: found,
        promises: answer.promises.filter((p) => p.squad === squadId),
        currentWork: [],
        sprintReality: found.sprintReality,
        workSplit: found.workSplit,
      };
    } else if (path.includes('/api/governance/cases/')) {
      body = { schemaVersion: 2, storyVersion: 9, promise: answer.promises[0], squad: answer.squads[0] };
    } else if (path === '/api/governance-brief.json') body = brief;
    else if (path === '/api/projects-catalog.json') {
      body = { projects: [{ key: 'SD', label: 'DMS Squad', accessible: true }, { key: 'RPA', label: 'Finance Squad', accessible: true }] };
    } else if (path === '/api/quarters-list') body = { quarters: [{ label: 'FY27 Q2', isCurrent: true }] };
    else if (path === '/api/boards.json') body = { boards: [{ id: 1, projectKey: 'SD' }], projectErrors: [] };
    else if (path === '/api/governance/inbox.json') body = { briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], poReadiness: [], total: 0 };
    else if (path === '/api/governance/feedback-summary.json' || path === '/api/governance/adoption-metrics.json') body = { total: 0, byMetric: {} };
    else if (path === '/api/ai-provider-status.json') body = { configured: false, effectiveMode: 'deterministic' };
    else if (path === '/api/session-meta.json') body = { authenticated: true, initials: 'DL' };
    else if (path === '/api/current-sprint.json' || path.includes('current-sprint')) {
      body = { sprint: { name: 'FY27DMS06', state: 'active' }, issues: [], boards: [] };
    } else body = {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test.describe.configure({ retries: 0 });

test.describe('Governance Delivery-Trust MasterPlan @focused', () => {
  test('delivery-trust viewport, identity, drawer, nudge, logcat @focused', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockJourney(page);

    await test.step('01 epic rail meta and issue identity on first fold', async () => {
      await loginIfRequired(page, '/governance?projects=SD,RPA', {
        rootSelector: '[data-testid="governance-active-loop"]',
        timeout: 20000,
      });
      await expect(page.locator('[data-epic-commitment-rail="1"]')).toBeVisible();
      const meta = page.locator('[data-epic-chip-meta="1"]').first();
      await expect(meta).toBeVisible();
      await expect(meta).toContainText(/children|→|No Jira target/i);
      await expect(page.locator('.delivera-issue-identity').first()).toBeVisible();
      await expect(page.locator('.delivera-issue-key').first()).toHaveAttribute('href', /issueKey=/);
    });

    await test.step('02 single primary CTA and enriched bento', async () => {
      await expect(page.locator('[data-loop-primary]')).toHaveCount(1);
      await expect(page.locator('.gov-loop-recommendation')).toHaveCount(0);
      const evidenced = page.locator('[data-delivery-cell="evidenced"] small');
      await expect(evidenced).toContainText(/stories|epics/i);
    });

    await test.step('03 format alignment chip visible on portfolio', async () => {
      await expect(page.locator('[data-adhoc-open]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-adhoc-open]')).toContainText(/non-aligned/i);
    });

    await test.step('04 matrix divert shows cluster line when diverting', async () => {
      const divert = page.locator('[data-story-squad="SD"] [data-matrix-diverted="1"] strong');
      await expect(divert).toContainText(/Legacy migrations/i);
    });

    await test.step('05 drawer single verdict label', async () => {
      await page.locator('[data-loop-primary]').click();
      await expect(page.locator('.gov-loop-drawer')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.gov-loop-drawer')).toHaveAttribute('data-verdict-label', /Partly matched/i);
      await expect(page.locator('.gov-loop-verdict-label strong')).toHaveText(/Partly matched/i);
      await page.locator('[data-drawer-close]').first().click();
    });

    await test.step('06 nudge button reflects owner route from fixture', async () => {
      await page.locator('[data-loop-primary]').click();
      const nudge = page.locator('[data-loop-action="send-nudge"]');
      await expect(nudge).toBeVisible();
      await expect(nudge).toContainText(/Amina N./i);
      await page.locator('[data-drawer-close]').first().click();
    });

    await test.step('07 continuity squad param and spotlight', async () => {
      await page.locator('[data-story-squad="SD"]').click();
      await expect(page).toHaveURL(/[?&]squad=SD/);
      await expect(page).not.toHaveURL(/spotlight=/);
      await expect(page.locator('#gov-squad-spotlight')).toBeVisible();
    });

    await test.step('08 console and telemetry clean after click path', async () => {
      assertTelemetryClean(telemetry);
    });
  });
});
