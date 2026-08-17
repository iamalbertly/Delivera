/**
 * Governance UX MasterPlan Round4 — Realtime + Logcat (≤10 steps).
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
    cacheRelease: '20260730a',
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
  const risks = [
    {
      issueKey: 'SD-5314',
      issueUrl: 'https://jira.example/browse/SD-5314',
      displayTitle: 'Customer journey integration stalled',
      escalation: 'escalate',
      audience: 'delivery',
      squad: 'SD',
      ageHours: 72,
      riskType: 'stale-in-progress',
      recommendedAction: 'Confirm next step today',
      assigneeName: 'Amina N.',
      decisionNeededFrom: 'Scrum Master',
      evidence: 'No movement in 72h',
    },
    {
      issueKey: 'SD-5315',
      issueUrl: 'https://jira.example/browse/SD-5315',
      displayTitle: 'Dependency on Finance',
      escalation: 'act-today',
      audience: 'delivery',
      squad: 'SD',
      ageHours: 24,
      riskType: 'dependency',
      recommendedAction: 'Escalate dependency',
      assigneeName: 'Amina N.',
      decisionNeededFrom: 'RTE',
      evidence: 'Blocked by FIN-1075',
    },
    {
      issueKey: 'RPA-88',
      issueUrl: 'https://jira.example/browse/RPA-88',
      displayTitle: 'Automate dispute workflow',
      escalation: 'watch',
      audience: 'delivery',
      squad: 'RPA',
      ageHours: 12,
      riskType: 'missing-estimate',
      recommendedAction: 'Add estimate',
      assigneeName: 'Finance PO',
      decisionNeededFrom: 'Product Owner',
      evidence: 'Missing estimate',
    },
  ];
  return {
    briefId: 'round4-ux',
    projects: ['SD', 'RPA'],
    generatedAt: NOW,
    freshness: { confidenceLimit: 'live' },
    deliveryTruth: { committed: 4, done: 1 },
    executiveView: { verdictTier: 'watch', verdictLine: 'NEEDS ATTENTION' },
    leadershipNarrative: { meetingAnswer: 'Act on DMS first', narratedBy: 'template' },
    topRisks: risks.slice(0, 2),
    portfolioRisks: [],
    risks,
    meta: {
      narratedBy: 'template',
      safeToSend: true,
      evidenceDegraded: true,
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
        ],
      },
      workerReceipt: { line: 'Last run: 1m ago', inboxTotal: 0 },
    },
    evidencePack: {
      rows: risks.map((r) => ({
        issueKey: r.issueKey,
        statusNow: 'In Progress',
        statusLastWeek: 'In Progress',
        whyFlagged: r.evidence,
        squad: r.squad,
      })),
    },
    squadInsights: [],
  };
}

function buildSprintPayload() {
  return {
    meta: { projects: 'SD', boardId: 230 },
    board: { id: 230, name: 'DMS Board', projectKey: 'SD', projectKeys: ['SD'] },
    availableBoards: [{ id: 230, name: 'DMS Board', projectKey: 'SD', friendlyName: 'DMS Squad' }],
    sprint: { id: 101, name: 'FY27DMS06', state: 'active', startDate: '2026-07-01', endDate: '2026-07-31' },
    issues: [],
    stuckCandidates: [{ issueKey: 'SD-5314', summary: 'Customer journey integration stalled', riskTags: ['blocker'] }],
    scopeChanges: [],
    workRiskRows: [{
      issueKey: 'SD-5314',
      summary: 'Customer journey integration stalled',
      riskTags: ['blocker'],
      riskType: 'Blocker',
      status: 'In Progress',
      assignee: 'Amina N.',
    }],
    decisionCockpit: {
      nextBestAction: {
        issueKey: 'SD-5314',
        summary: 'Unblock SD-5314 before standup',
        interventionType: 'swarm-blocked-work',
        riskTags: ['blocker'],
      },
      compactStripInterventions: [{
        label: 'Blockers',
        riskTags: ['blocker'],
        matchedKeys: ['SD-5314'],
      }],
    },
    verdictInfo: { tier: 'watch', trackingReasons: 'Blocker needs attention' },
    donePercentage: 42,
  };
}

function buildActions() {
  return {
    cases: [
      {
        promiseId: 'prm-sd-1',
        squad: 'SD',
        squadId: 'SD',
        squadDisplayName: 'DMS Squad',
        issueKey: 'SD-5314',
        title: 'Customer journey integration',
        originalText: 'Customer journey integration',
        state: 'needs-attention',
        urgencyLabel: 'critical',
        ownerRoute: { displayName: 'Amina N.' },
        nextAction: { label: 'Confirm evidence' },
        recommendedAction: 'Confirm evidence',
        detailHref: '/governance?squad=SD&view=squad',
      },
      {
        promiseId: 'prm-sd-2',
        squad: 'SD',
        squadId: 'SD',
        squadDisplayName: 'DMS Squad',
        issueKey: 'SD-5315',
        title: 'Dependency on Finance',
        originalText: 'Dependency on Finance',
        state: 'needs-attention',
        urgencyLabel: 'high',
        ownerRoute: { displayName: 'Amina N.' },
        nextAction: { label: 'Escalate dependency' },
        recommendedAction: 'Escalate dependency',
        detailHref: '/governance?squad=SD&view=squad',
      },
    ],
  };
}

function buildRegistry() {
  return {
    version: 3,
    squads: [
      {
        squadKey: 'SD',
        friendlyName: 'DMS Squad',
        participationState: 'pending-consent',
        productOwner: '',
        scrumMaster: 'Amina N.',
        boardMapping: [230],
        revision: 2,
        suggestions: { people: [], boardMapping: [] },
      },
      {
        squadKey: 'RPA',
        friendlyName: 'Finance Squad',
        participationState: 'pi-governed',
        productOwner: 'Finance PO',
        scrumMaster: 'Finance SM',
        boardMapping: [231],
        revision: 2,
        suggestions: { people: [], boardMapping: [] },
      },
    ],
    auditHistory: [],
  };
}

async function mockJourney(page, { degradedBrief = true } = {}) {
  const answer = buildAnswer();
  const brief = buildBrief();
  if (!degradedBrief) brief.meta.evidenceDegraded = false;
  const sprint = buildSprintPayload();
  const actions = buildActions();
  const registry = buildRegistry();

  await page.addInitScript(({ key, projects, cacheKey, cacheEnvelope }) => {
    try {
      localStorage.setItem(key, projects);
      localStorage.setItem(cacheKey, JSON.stringify(cacheEnvelope));
      sessionStorage.removeItem('delivera.currentSprint.topBlockerHighlight.v1');
      sessionStorage.removeItem('delivera.currentSprint.autoRiskFilter.v1');
    } catch (_) { /* privacy */ }
  }, {
    key: PROJECTS_SSOT_KEY,
    projects: 'SD,RPA',
    cacheKey: 'delivera:governance:active-loop:v2:20260730a:SD,RPA:current',
    cacheEnvelope: { savedAt: NOW, answer: { ...answer, cacheRelease: '20260730a' } },
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body = {};
    if (path === '/api/governance/active-loop.json') {
      const reqProjects = url.searchParams.get('projects') || 'SD,RPA';
      const projectList = reqProjects.split(',').map((p) => p.trim().toUpperCase()).filter(Boolean);
      body = {
        ...answer,
        scope: { ...answer.scope, projects: projectList.length ? projectList : answer.scope.projects },
      };
    } else if (path === '/api/governance-brief.json') {
      const reqProjects = url.searchParams.get('projects') || 'SD,RPA';
      const projectList = reqProjects.split(',').map((p) => p.trim().toUpperCase()).filter(Boolean);
      body = {
        ...brief,
        projects: projectList.length ? projectList : brief.projects,
      };
    } else if (path === '/api/governance/actions.json') body = actions;
    else if (path === '/api/governance/registry.json') body = registry;
    else if (path === '/api/current-sprint.json') body = sprint;
    else if (path === '/api/projects-catalog.json') {
      body = { projects: [{ key: 'SD', label: 'DMS Squad', accessible: true }, { key: 'RPA', label: 'Finance Squad', accessible: true }] };
    } else if (path === '/api/quarters-list') body = { quarters: [{ label: 'FY27 Q2', isCurrent: true }] };
    else if (path === '/api/boards.json') body = { boards: [{ id: 230, projectKey: 'SD' }], projectErrors: [] };
    else if (path === '/api/governance/inbox.json') body = { briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], poReadiness: [], total: 0 };
    else if (path === '/api/governance/feedback-summary.json' || path === '/api/governance/adoption-metrics.json') body = { total: 0, byMetric: {} };
    else if (path === '/api/ai-provider-status.json') body = { configured: false, effectiveMode: 'deterministic' };
    else if (path === '/api/session-meta.json') body = { authenticated: true, initials: 'DL', canManageOrganizationSettings: true };
    else if (path.includes('/api/governance/cases/')) {
      body = { schemaVersion: 2, storyVersion: 9, promise: actions.cases[0], squad: answer.squads[0] };
    } else if (path.includes('/api/governance/squads/') && path.endsWith('/detail.json')) {
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
    } else {
      body = {};
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test.describe('Governance UX MasterPlan Round4 @focused', () => {
  test('risk truth, focus strip, friction cuts @focused', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockJourney(page);

    await test.step('01 governance cache-first hero visible under 3s', async () => {
      await loginIfRequired(page, '/governance?projects=SD,RPA', {
        rootSelector: '[data-testid="governance-active-loop"]',
        timeout: 20000,
      });
      const loop = page.getByTestId('governance-active-loop');
      await expect(loop).toBeVisible({ timeout: 3000 });
      await expect(page.locator('#gov-loading')).toBeHidden({ timeout: 3000 });
    });

    await test.step('02 risk superset — proof list includes doNow rows', async () => {
      await page.locator('#gov-supporting-evidence summary').click();
      await page.waitForFunction(() => document.querySelectorAll('#gov-proof-risks li.governance-risk').length >= 3);
      const proofCount = await page.locator('#gov-proof-risks li.governance-risk').count();
      expect(proofCount).toBeGreaterThanOrEqual(3);
    });

    await test.step('03 DMS tunnel epic rail keys are SD-* only', async () => {
      await page.goto('/governance?squad=SD&view=squad&projects=SD');
      await expect(page.getByTestId('governance-active-loop')).toBeVisible({ timeout: 15000 });
      const keys = await page.locator('[data-epic-rail-chip="1"] .delivera-issue-key').allTextContents();
      for (const key of keys) {
        expect(String(key).trim()).toMatch(/^SD-/);
      }
      expect(keys.join(' ')).not.toMatch(/RPA-/);
    });

    await test.step('04 proof keys are continuity links', async () => {
      await page.goto('/governance?projects=SD,RPA');
      await page.locator('#gov-supporting-evidence summary').click();
      await expect(page.locator('#gov-proof-risks .delivera-issue-key').first()).toBeVisible({ timeout: 15000 });
      const href = await page.locator('#gov-proof-risks .delivera-issue-key').first().getAttribute('href');
      expect(href || '').toMatch(/issueKey=|jira|report/);
    });

    await test.step('05 degraded evidence shows Proof incomplete badge', async () => {
      await page.evaluate(() => { const d = document.getElementById('gov-supporting-evidence'); if (d) d.open = true; });
      await expect(page.locator('[data-proof-incomplete="1"]').first()).toBeVisible();
      await expect(page.locator('[data-proof-incomplete="1"]').first()).toContainText(/Proof incomplete/i);
    });

    await test.step('06 current sprint top blocker highlighted without click', async () => {
      await loginIfRequired(page, '/current-sprint?squad=SD&projects=SD&boardId=230', {
        rootSelector: '.current-sprint-header-bar, #current-sprint-content',
        timeout: 20000,
      });
      const header = page.locator('.current-sprint-header-bar');
      await expect(header).toBeVisible({ timeout: 20000 });
      await expect(header).toHaveAttribute('data-cockpit-issue-key', 'SD-5314');
      await expect(page.locator('[data-sprint-lean-next-move], [data-mission-briefing-action="focus-top-risk"]').first()).toBeAttached();
    });

    await test.step('07 actions filters collapsed, cases visible, no pickers', async () => {
      await page.goto('/actions?squad=SD');
      await expect(page.locator('.action-case-row').first()).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.actions-queue-filters')).not.toHaveAttribute('open', '');
      await expect(page.locator('.action-case-row')).toHaveCount(2);
      await expect(page.locator('[data-action-case-picker]')).toHaveCount(0);
    });

    await test.step('08 settings exceptions band and bulk disabled until reason', async () => {
      await page.goto('/settings');
      await expect(page.locator('[data-registry-band]').filter({ hasText: 'Participation exceptions' })).toBeVisible();
      await expect(page.locator('[data-bulk-preview]')).toBeDisabled();
    });

    await test.step('09 focus strip on sprint and actions', async () => {
      await page.goto('/current-sprint?squad=SD');
      await expect(page.locator('[data-focus-strip="1"]')).toBeVisible({ timeout: 15000 });
      await page.goto('/actions?squad=SD');
      await expect(page.locator('[data-focus-strip="1"]')).toBeVisible({ timeout: 15000 });
    });

    await test.step('10 telemetry clean', async () => {
      assertTelemetryClean(telemetry);
    });
  });
});
