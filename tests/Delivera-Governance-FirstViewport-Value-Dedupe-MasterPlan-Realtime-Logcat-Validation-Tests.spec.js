/**
 * Governance FirstViewport Value + Dedupe MasterPlan — Realtime + Logcat.
 * Keep ≤10 focused steps. Delivery KPIs zero-click; Act/Why/CTA dedupe; epic rail; continuity quiet.
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
    presentationContractVersion: 6,
    answerVersion: 9,
    cacheRelease: undefined,
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
        nextAction: { id: 'send-nudge', label: 'Confirm FIN-1075 moved' },
        ownerRoute: { displayName: 'Amina N.' },
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
        promiseId: 'prm-sd-1', squad: 'SD', issueKey: 'SD-5314', originalText: 'Customer journey integration',
        matchState: 'no-jira-proof', caseState: 'needs-attention', statusNow: 'In Progress',
        expectedVsActual: {
          expected: { startDate: '2026-05-01', endDate: '2026-07-31', issueKey: 'SD-5314' },
          actual: { childTotal: 5, doneChildCount: 2, openChildCount: 3, issueKeys: ['SD-5314'] },
        },
        nextAction: { label: 'Confirm FIN-1075 moved' },
        allowedActions: [{ id: 'send-nudge', allowed: true, reason: 'Owner ready.' }],
      },
      {
        promiseId: 'prm-rpa-1', squad: 'RPA', issueKey: 'RPA-88', originalText: 'Automate dispute workflow',
        matchState: 'partly-matched', caseState: 'needs-attention', statusNow: 'In Progress',
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
    briefId: 'fv-dedupe',
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
          title: 'Customer journey integration',
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
      piConfidence: {
        trusted: false,
        confidencePct: 42,
        counts: { committed: 4, onTrack: 1, atRisk: 2, offPlan: 1, missingDates: 1 },
        timelineChips: [
          {
            issueKey: 'SD-5314',
            title: 'Customer journey integration',
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
          {
            issueKey: 'RPA-88',
            title: 'Automate dispute workflow',
            squad: 'RPA',
            plannedStartDate: '2026-04-01',
            plannedEndDate: '',
            elapsedPct: null,
            deliveryPct: null,
            confidenceLabel: 'No forecast',
            childHint: '1/3 children',
            childTotal: 3,
            childDone: 1,
            missingDates: true,
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
      const p = answer.promises[0];
      body = { schemaVersion: 2, storyVersion: 9, promise: p, squad: answer.squads[0] };
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
    } else {
      body = {};
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test.describe('Governance FirstViewport Value Dedupe MasterPlan @focused', () => {
  test('delivery-first viewport, CTA dedupe, epic rail, continuity @focused', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockJourney(page);

    await test.step('01 open governance with delivery H1 and bento zero-click', async () => {
      await loginIfRequired(page, '/governance?projects=SD,RPA', {
        rootSelector: '[data-testid="governance-active-loop"]',
        timeout: 20000,
      });
      const loop = page.getByTestId('governance-active-loop');
      await expect(loop).toBeVisible({ timeout: 20000 });
      await expect(loop).toHaveAttribute('data-gov-value-first', '1');
      const h1 = page.locator('[data-gov-delivery-h1="1"]');
      await expect(h1).toBeVisible();
      await expect(h1).toContainText(/evidenced/i);
      await expect(h1).not.toContainText(/squads verified/i);
      await expect(page.locator('[data-gov-delivery-bento="1"]')).toBeVisible();
      await expect(page.locator('[data-delivery-cell="delivered"]')).toBeVisible();
      await expect(page.locator('[data-delivery-cell="diverted"]')).toBeVisible();
    });

    await test.step('02 Act paragraph gone; single primary CTA', async () => {
      await expect(page.locator('.gov-loop-recommendation')).toHaveCount(0);
      await expect(page.locator('[data-loop-primary]')).toHaveCount(1);
      await expect(page.locator('[data-next-move-short]')).toHaveCount(0);
    });

    await test.step('03 Why once in hero; matrix head has no lens essay', async () => {
      await expect(page.locator('[data-gov-why-once="1"]')).toHaveCount(1);
      await expect(page.locator('[data-lens-summary]')).toHaveCount(0);
    });

    await test.step('04 epic commitment rail shows date range and/or child counts', async () => {
      const rail = page.locator('[data-epic-commitment-rail="1"]');
      await expect(rail).toBeVisible();
      const chip = page.locator('[data-epic-rail-chip="1"]').first();
      await expect(chip).toBeVisible({ timeout: 10000 });
      const meta = page.locator('[data-epic-chip-meta="1"]').first();
      await expect(meta).toBeVisible();
      const metaText = await meta.innerText();
      expect(metaText).toMatch(/children|→|No forecast/i);
      expect(metaText).toMatch(/2\/5 children|1\/3 children|May|Jul|No forecast/i);
      // Issue key is a continuity link with human title.
      await expect(page.locator('.delivera-issue-key').first()).toHaveAttribute('href', /issueKey=/);
    });

    await test.step('05 top-risk preferred highlight; one today continuity link; Next not mid-word truncated', async () => {
      await expect(page.locator('[data-focus-preferred="true"]')).toHaveCount(1);
      const todayLinks = page.locator('a').filter({ hasText: /today/i });
      await expect(todayLinks).toHaveCount(1);
      const preferredNext = page.locator('[data-focus-preferred="true"] [role="cell"]').last().locator('strong');
      await expect(preferredNext).toHaveText(/^\s*Open\s*$/);
      const nextLabels = await page.locator('.gov-story-row [role="cell"]:last-child strong').allTextContents();
      for (const label of nextLabels) {
        const trimmed = String(label || '').trim();
        expect(trimmed).not.toMatch(/\w…$/);
        expect(trimmed.length).toBeLessThanOrEqual(42);
      }
    });

    await test.step('06 matrix shows evidenced / diverted / slip columns; quiet diversion wallpaper', async () => {
      const cols = page.locator('.gov-story-columns');
      await expect(cols).toContainText(/Source coverage/i);
      await expect(cols).toContainText(/Diverted/i);
      await expect(cols).toContainText(/Slip/i);
      await expect(cols).not.toContainText(/Current reality/i);
      await expect(page.locator('[data-matrix-diverted="1"] strong').filter({ hasText: /No diversion proven/i })).toHaveCount(0);
    });

    await test.step('07 continuity uses squad param only (no dual spotlight write)', async () => {
      await page.locator('[data-story-squad="SD"]').click();
      await expect(page).toHaveURL(/[?&]squad=SD/);
      await expect(page).not.toHaveURL(/spotlight=/);
      await expect(page.locator('#gov-squad-spotlight')).toBeVisible({ timeout: 15000 });
    });

    await test.step('08 telemetry and console clean', async () => {
      assertTelemetryClean(telemetry);
    });
  });
});
