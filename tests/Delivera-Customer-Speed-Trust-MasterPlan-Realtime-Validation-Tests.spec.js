import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { loginIfRequired } from './Delivera-Playwright-Login-If-Required-01Helper.js';
import { diagnosePromiseEvidence, PROMISE_DIAGNOSIS_CODES } from '../lib/Delivera-Governance-PIBaseline-02Compare.js';
import { enrichActivityFromJiraExistence } from '../lib/Delivera-Governance-PIBaseline-04Epic-Activity-Intelligence-SSOT.js';
import { buildSprintAtAGlanceBriefing } from '../public/Delivera-CurrentSprint-Summary-03AtAGlance-Briefing-SSOT.js';
import {
  buildFlowBaseline,
  enhanceFlowIntervention,
} from '../lib/Delivera-CurrentSprint-Flow-Intelligence-SSOT.js';
import {
  buildBusinessTime,
  buildCommunicationGuard,
  buildImpactScenario,
  buildStrategicAnchor,
} from '../lib/Delivera-CurrentSprint-Value-Flow-Policy-SSOT.js';
import { buildHumanNudgeDraft } from '../public/Delivera-CurrentSprint-JiraNudge-01HumanText-SSOT.js';
import { PROJECT_CATALOG } from '../public/Delivera-Shared-Projects-Catalog-01SSOT.js';
import { buildActiveGovernanceAnswer } from '../lib/Delivera-Governance-ActiveLoop-01Domain-SSOT.js';
import {
  GOVERNANCE_STORY_CACHE_RELEASE,
  governanceStoryCacheKey,
} from '../lib/Delivera-Governance-Story-Cache-01SSOT.js';
import { DELIVERA_CLIENT_RELEASE_SCHEMA } from '../lib/Delivera-Config-Env-Services-Core-SSOT.js';
import { renderAlignmentStripHtml } from '../public/Delivera-CurrentSprint-Alignment-01Strip-UI.js';

test.describe.configure({ mode: 'serial' });

const DMS_GOVERNANCE = '/governance?spotlight=SD&view=squad';
const EXPECTED_EXCEPTIONS = ['AMS2', 'BIO', 'MAS', 'MPSA', 'MVA', 'TRS', 'VB'];

async function visibleIssueKeys(page) {
  return page.locator('main a[href*="/browse/"]:visible').evaluateAll((links) => (
    links.map((link) => link.textContent.trim()).filter((text) => /^[A-Z0-9]+-\d+$/.test(text))
  ));
}

test.describe('Delivera customer speed and trust release', () => {
  test('1 changed truth and classifier contracts remain evidence-bound', async () => {
    expect(GOVERNANCE_STORY_CACHE_RELEASE).toContain(DELIVERA_CLIENT_RELEASE_SCHEMA);
    expect(governanceStoryCacheKey(['SD'], 'FY27 Q2')).toContain(GOVERNANCE_STORY_CACHE_RELEASE);
    const fixtures = [
      [{ issueKey: 'FIN-1', permissionDenied: true }, 'access-blocked'],
      [{ issueKey: 'FIN-1b', httpStatus: 401 }, 'access-blocked'],
      [{ issueKey: 'FIN-1c', boardResolved: false }, 'board-unresolved'],
      [{ issueKey: 'FIN-1d', boardResolved: false, permissionDenied: true }, 'access-blocked'],
      [{ issueKey: 'FIN-2', currentFound: true, inBacklog: true }, 'backlog-only'],
      [{ issueKey: 'FIN-3', currentFound: true, inFutureSprint: true, sprintName: 'FY27FIN07' }, 'future-sprint'],
      [{ issueKey: 'FIN-4', currentFound: true, missingPiMetadata: true }, 'missing-pi-metadata'],
      [{ issueKey: 'FIN-4B', currentFound: true, existsInJira: true, missingPiMetadata: true }, 'missing-pi-metadata'],
      [{ issueKey: 'FIN-5', candidateIssueKeys: ['FIN-55'] }, 'likely-moved-or-rekeyed'],
      [{ issueKey: 'FIN-6', currentFound: true, status: 'Done' }, 'done-proof-pending'],
      [{ issueKey: 'FIN-7', currentFound: true, isProgramTheme: true }, 'program-theme'],
      [{ issueKey: 'FIN-8', currentFound: true, supportWork: true }, 'off-plan-or-support'],
      [{ issueKey: 'FIN-9', currentFound: true, baselinePeriod: 'FY27 Q2', jiraPeriod: 'FY27 Q3' }, 'period-conflict'],
      [{ issueKey: 'FIN-10' }, 'exact-key-unavailable'],
      [{ issueKey: 'FIN-11', notFoundInJira: true, httpStatus: 404 }, 'exact-key-unavailable'],
    ];
    fixtures.forEach(([input, expected]) => {
      const diagnosis = diagnosePromiseEvidence(input);
      expect(diagnosis.diagnosisCode).toBe(expected);
      expect(diagnosis.diagnosisEvidence.length).toBeGreaterThan(0);
      expect(diagnosis.diagnosisConfidence).toBeGreaterThanOrEqual(0.7);
      expect(diagnosis.recommendedAction.length).toBeGreaterThan(12);
      expect(diagnosis.customerOrPiImpact.length).toBeGreaterThan(12);
      expect(diagnosis.ownerRoute).toBeTruthy();
    });
    expect(diagnosePromiseEvidence({ issueKey: 'FIN-1', permissionDenied: true }).diagnosisLabel)
      .toMatch(/login or permissions/i);
    expect(diagnosePromiseEvidence({ issueKey: 'FIN-1c', boardResolved: false }).diagnosisLabel)
      .toMatch(/cannot open this squad/i);
    expect(diagnosePromiseEvidence({
      issueKey: 'SD-5314',
      boardResolved: false,
      currentFound: true,
      status: 'In Progress',
      matchMethod: 'epic-child',
      matchedIssueKeys: ['SD-5304'],
      sprintName: 'FY27DMS06',
    })).toMatchObject({
      diagnosisCode: 'verified',
      diagnosisLabel: 'PI epic has active sprint stories',
    });
    expect(Object.values(PROMISE_DIAGNOSIS_CODES)).toHaveLength(12);
    const directEvidence = await enrichActivityFromJiraExistence(
      [{ issueKey: 'SD-5316', title: 'PI commitment' }],
      new Map(),
      {
        issues: {
          getIssue: async () => ({
            fields: {
              summary: 'PI commitment',
              status: { name: 'To Do' },
              fixVersions: [],
              labels: [],
              issuetype: { name: 'Epic' },
              updated: '2026-07-29T08:00:00.000Z',
            },
          }),
        },
      },
      1,
    );
    expect(directEvidence.get('SD-5316')).toMatchObject({
      existsInJira: true,
      status: 'To Do',
      missingPiMetadata: true,
      lifecycle: 'jira-only',
    });
    const missingEvidence = await enrichActivityFromJiraExistence(
      [{ issueKey: 'FIN-1075' }],
      new Map(),
      { issues: { getIssue: async () => { const error = new Error('Not found'); error.statusCode = 404; throw error; } } },
      1,
    );
    expect(missingEvidence.get('FIN-1075')).toMatchObject({
      notFoundInJira: true,
      httpStatus: 404,
      lifecycle: 'not-found',
    });

    const activeLoop = buildActiveGovernanceAnswer({
      baseline: {
        id: 'sd-q2',
        piName: 'FY27 Q2',
        baselineDate: '2026-07-01',
        projects: ['SD'],
        committedItems: [{
          issueKey: 'SD-5314',
          squad: 'SD',
          title: 'DMS notification campaign',
          originalText: 'DMS notification campaign',
        }, {
          issueKey: 'SD-9999',
          squad: 'SD',
          title: 'Unmatched PI promise',
          originalText: 'Unmatched PI promise',
        }],
      },
      brief: {
        projects: ['SD'],
        generatedAt: '2026-07-29T08:00:00.000Z',
        meta: {
          boardEpicIndex: [],
          baselineIssueEvidence: {
            'SD-9999': {
              issueKey: 'SD-9999',
              existsInJira: true,
              status: 'To Do',
              missingPiMetadata: true,
              lifecycle: 'jira-only',
            },
          },
        },
        evidencePack: { rows: [] },
        squadInsights: [{
          projectKey: 'SD',
          boardResolved: true,
          sprintReality: { contractVersion: 1, state: 'active', sprintName: 'FY27DMS06', copy: 'FY27DMS06 is active.' },
          activeItems: [{
            issueKey: 'SD-5304',
            epicKey: 'SD-5314',
            summary: 'Deliver notifications',
            status: 'In Progress',
            sprintName: 'FY27DMS06',
            created: '2026-07-17T08:00:00.000Z',
          }],
        }],
      },
      now: new Date('2026-07-29T08:00:00.000Z'),
    });
    expect(activeLoop.promises[0]).toMatchObject({
      matchState: 'matched',
      diagnosisCode: 'verified',
      expectedVsActual: {
        actual: {
          issueKeys: ['SD-5304'],
          matchedThrough: 'epic-child',
        },
        disconnectCode: 'story-delivers-approved-epic',
      },
    });
    expect(activeLoop.promises[0].expectedVsActual.durationBusinessDays).toBeGreaterThan(0);
    expect(activeLoop.promises[1]).toMatchObject({
      matchState: 'cannot-verify',
      diagnosisCode: 'missing-pi-metadata',
      expectedVsActual: { actual: { matchedThrough: 'unmatched' } },
    });
    const alignmentHtml = renderAlignmentStripHtml({
      stories: [{ issueKey: 'SD-5304', epicKey: 'SD-5314' }],
    }, ['SD-5314']);
    expect(alignmentHtml).toContain('<strong>1 of 1</strong>');
    expect(alignmentHtml).not.toContain('off-PI');

    const sprintSamples = [24, 48, 72].map((hours, index) => ({
      sprint: { id: index + 1, name: `Closed ${index + 1}` },
      issues: [{
        key: `SD-${index + 1}`,
        fields: {
          created: '2026-07-01T08:00:00.000Z',
          resolutiondate: new Date(Date.parse('2026-07-01T08:00:00.000Z') + hours * 3_600_000).toISOString(),
          issuetype: { name: 'Story' },
          status: { name: 'Done', statusCategory: { key: 'done' } },
        },
      }],
    }));
    const flowBaseline = buildFlowBaseline(sprintSamples, '2026-07-28T08:00:00.000Z');
    expect(flowBaseline).toMatchObject({
      state: 'ready',
      sampleSize: 3,
      medianCycleHours: 48,
      p85CycleHours: 72,
      source: 'jira-created-to-resolution',
    });
    expect(buildFlowBaseline(sprintSamples.slice(0, 2)).state).toBe('forming');

    const cockpit = enhanceFlowIntervention({
      cockpit: {},
      flowBaseline,
      daysRemaining: 2,
      observedAt: '2026-07-28T08:00:00.000Z',
      commitments: [{
        issueKey: 'SD-5304',
        commitmentClass: 'must-have',
        piObjectiveId: 'PI-2',
        piObjectiveTitle: 'Protect Q2 customer notifications',
        businessValue: 'Everest milestone remains unblocked.',
        dependencyIssueKeys: ['EV-42'],
      }],
      stuckCandidates: [{ issueKey: 'SD-5304', hoursInStatus: 96 }],
      stories: [{
        issueKey: 'SD-5304',
        summary: 'Customer notifications',
        issueType: 'Story',
        status: 'In Progress',
        statusCategoryKey: 'indeterminate',
        ageHours: 96,
        subtasks: [
          { issueKey: 'SD-5305', summary: 'Backend', status: 'Done', assignee: 'Amina' },
          { issueKey: 'SD-5306', summary: 'CSS review', status: 'To Do', assignee: '' },
        ],
      }],
    });
    expect(cockpit.nextBestAction).toMatchObject({
      issueKey: 'SD-5304',
      interventionType: 'swarm-blocked-work',
      requiresHumanConfirmation: true,
    });
    expect(cockpit.nextBestAction.recommendedAction).toContain('Who has capacity to swarm SD-5306');
    expect(cockpit.nextBestAction.dependencyEvidence.issueKeys).toEqual(['EV-42']);
    expect(cockpit.nextBestAction.interventionHash).toHaveLength(24);
    expect(cockpit.nextBestAction.businessTime.state).toBe('past-pace');
    expect(cockpit.nextBestAction.humanImpact.statement).toBe('Everest milestone remains unblocked.');
    expect(cockpit.nextBestAction.impactScenario.state).toBe('available');
    expect(JSON.stringify(cockpit)).not.toMatch(/disable new work|automatically assign/i);
  });

  test('2 last failed Governance truth uses business days and retains verified promises', async ({ page }) => {
    const started = Date.now();
    await loginIfRequired(page, DMS_GOVERNANCE, { rootSelector: '[data-testid="governance-active-loop"]' });
    const usefulMs = Date.now() - started;
    const root = page.locator('[data-testid="governance-active-loop"]');
    await expect(root).toHaveAttribute('data-fiscal-period', 'FY27 Q2');
    await expect(root.locator('[data-loop-squad]')).toHaveCount(1);
    await expect(root.getByTestId('governance-source-line')).toContainText('6 promises checked');
    await expect(root.locator('.gov-loop-identity-links')).toHaveCount(0);
    await expect(root).not.toContainText('Finance Squad');
    const sprintCopies = await page.locator('#gov-squad-spotlight').getByText(/\bis active, \d+ business days? remaining\./).count();
    expect(sprintCopies).toBeGreaterThan(0);
    const previewPromiseCount = await page.locator('[data-loop-promise]').count();
    expect(previewPromiseCount).toBeGreaterThan(0);
    await expect(page.locator('#gov-squad-spotlight')).not.toContainText('baseline missing');
    await expect(page.locator('#gov-verdict-mount')).toBeEmpty();
    await expect(page.locator('#gov-answer-mount')).toBeEmpty();
    expect(usefulMs).toBeLessThan(10_000);
  });

  test('3 Finance root-cause intelligence groups twelve cases without claiming removal', () => {
    const inputs = [
      ...Array.from({ length: 3 }, (_, index) => ({ issueKey: `FIN-${index + 1}`, currentFound: true, missingPiMetadata: true })),
      ...Array.from({ length: 2 }, (_, index) => ({ issueKey: `FIN-${index + 4}`, currentFound: true, inBacklog: true })),
      ...Array.from({ length: 2 }, (_, index) => ({ issueKey: `FIN-${index + 6}`, currentFound: true, inFutureSprint: true })),
      { issueKey: 'FIN-8', permissionDenied: true },
      { issueKey: 'FIN-9', candidateIssueKeys: ['FIN-90'] },
      { issueKey: 'FIN-10', currentFound: true, status: 'Done' },
      { issueKey: 'FIN-11', currentFound: true, supportWork: true },
      { issueKey: 'FIN-12', currentFound: true, baselinePeriod: 'FY27 Q2', jiraPeriod: 'FY27 Q3' },
    ];
    const diagnoses = inputs.map(diagnosePromiseEvidence);
    expect(new Set(diagnoses.map((item) => item.diagnosisCode)).size).toBeGreaterThanOrEqual(6);
    expect(diagnoses).toHaveLength(12);
    expect(diagnoses.every((item) => !/removed from|was removed/i.test(`${item.diagnosisLabel} ${item.recommendedAction}`))).toBe(true);
  });

  test('4 global participation and SD continuity remain consistent', async ({ page }) => {
    await loginIfRequired(page, '/settings', { rootSelector: '#gov-settings-registry-mount' });
    const registry = await page.evaluate(async () => (await fetch('/api/governance/registry.json')).json());
    const pending = registry.squads
      .filter((squad) => squad.participationState === 'pending-consent')
      .map((squad) => squad.squadKey)
      .sort();
    expect(pending).toEqual(EXPECTED_EXCEPTIONS);
    await expect(page.locator('.registry-band').filter({ hasText: 'Participation exceptions' }).locator('[data-registry-squad]')).toHaveCount(7);
    await page.goto(DMS_GOVERNANCE);
    const governance = await page.evaluate(async () => (await fetch('/api/governance/active-loop.json?projects=SD')).json());
    expect(governance.organizationParticipation.globallyExcludedCount).toBe(7);
    await page.goto('/current-sprint?squad=SD');
    await page.getByRole('heading', { name: /Today for DMS/ }).waitFor({ state: 'visible' });
    expect((await visibleIssueKeys(page)).every((key) => key.startsWith('SD-'))).toBe(true);
    await page.goto('/actions?squad=SD');
    await expect(page.locator('[data-actions-root], main')).toContainText(/SD actions|No actions match this view/);
    await expect(page.locator('[data-actions-root], main')).not.toContainText(/Finance|FIN-/);
    await page.goto('/report?squad=SD');
    await expect(page).toHaveURL(/squad=SD/);
  });

  test('5 Proof audit opens directly and Report owns history instead of today', async ({ page }) => {
    await loginIfRequired(page, '/governance', { rootSelector: '[data-testid="governance-active-loop"]' });
    await expect(page.getByText('Supporting evidence', { exact: true })).toHaveCount(0);
    const allProof = page.getByRole('button', { name: /All proof/ }).first();
    await allProof.click();
    await expect(page.locator('.gov-right-drawer-panel:visible')).toBeVisible();
    await page.goto('/report?squad=SD');
    await expect(page.getByRole('heading', { name: 'Historical proof & exports' })).toBeVisible();
    await expect(page.locator('body')).toContainText('Today’s decision remains in Governance');
  });

  test('6 share-ready clipboard uses the same ranked intervention and facts', () => {
    const briefing = buildSprintAtAGlanceBriefing({
      board: { name: 'DMS' },
      sprint: { name: 'FY27DMS06', state: 'active', endDate: '2026-07-31' },
      context: { fiscalPeriod: 'FY27 Q2', squadDisplayName: 'DMS', observedAt: '2026-07-28T08:00:00.000Z' },
      daysMeta: { daysRemainingWorking: 3 },
      summary: { percentDone: 60, doneStories: 6, totalStories: 10 },
      decisionCockpit: { nextBestAction: {
        issueKey: 'SD-5304',
        summary: 'Complete customer validation',
        assignee: 'Amina',
        hoursInStatus: 72,
        reason: 'SD-5304 is above the team P85 flow proxy.',
        businessImpact: 'Customer launch evidence is at risk.',
        recommendedAction: 'What can the squad swarm before the next stand-up?',
        interventionType: 'swarm-blocked-work',
        riskTags: ['cycle-breach'],
        flowEvidence: { currentAgeHours: 72, p85CycleHours: 48, baselineState: 'ready' },
        valueEvidence: { piObjectiveTitle: 'Protect Q2 customer launch' },
        dependencyEvidence: { issueKeys: ['EV-42'] },
        requiresHumanConfirmation: true,
      } },
      stuckCandidates: [{ issueKey: 'SD-5304', status: 'Blocked', assignee: 'Amina', hoursInStatus: 72 }],
      meta: { generatedAt: '2026-07-28T08:00:00.000Z' },
    });
    const plain = briefing.quickClipboardLines.join('\n');
    briefing.shareFacts.forEach((fact) => {
      expect(plain).toContain(fact.value);
      expect(briefing.quickClipboardHtml).toContain(fact.value);
    });
    expect(plain).toContain('Customer launch evidence is at risk');
    expect(plain).toContain('Protect Q2 customer launch');
    expect(plain).toContain('72h current age vs 48h team P85');
    expect(plain).toContain('EV-42');
    expect(plain).toContain('What can the squad swarm');
    expect(plain).toContain('before the next stand-up');
    expect(briefing.topRisk.key).toBe('SD-5304');
  });

  test('7 responsive shell has no horizontal overflow or header/drawer collision', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 900 });
    await loginIfRequired(page, DMS_GOVERNANCE, { rootSelector: '[data-testid="governance-active-loop"]' });
    const audit = await page.evaluate(() => {
      const drawer = document.querySelector('.gov-right-drawer-panel:not([hidden])');
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        chromeHeight: document.querySelector('.app-top-chrome')?.getBoundingClientRect().height || 0,
        drawerTop: drawer?.getBoundingClientRect().top ?? null,
        shortTargets: [...document.querySelectorAll('.app-top-chrome a, .app-top-chrome button')]
          .filter((node) => {
            const box = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return style.display !== 'none' && style.visibility !== 'hidden'
              && box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44);
          }).map((node) => ({
            label: node.getAttribute('aria-label') || node.textContent.trim(),
            width: Math.round(node.getBoundingClientRect().width),
            height: Math.round(node.getBoundingClientRect().height),
          })),
      };
    });
    expect(audit.overflow).toBeLessThanOrEqual(1);
    expect(audit.shortTargets).toEqual([]);
    if (audit.drawerTop != null) expect(audit.drawerTop).toBeGreaterThanOrEqual(audit.chromeHeight);
  });

  test('8 degraded refresh preserves cached truth and credential-prone fields stay blank', async ({ page }) => {
    await loginIfRequired(page, '/current-sprint?squad=SD', { rootSelector: '.current-sprint-header-bar' });
    const cachedPayload = await page.evaluate(() => window.__deliveraCurrentSprintPayload);
    cachedPayload.meta = {
      ...(cachedPayload.meta || {}),
      fromSnapshot: true,
      stale: true,
      staleReason: 'JIRA_UNREACHABLE',
    };
    await page.route('**/api/current-sprint.json**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(cachedPayload),
    }));
    await page.reload();
    await expect(page.locator('.current-sprint-header-bar, [data-snapshot-state]').first()).toContainText(/Sprint|verified|refresh|Today/i);
    await page.goto('/settings');
    await page.locator('#gov-settings-registry-mount').waitFor({ state: 'visible' });
    const unsafe = await page.locator('input[name="reason"], input[name="productOwner"], input[name="scrumMaster"], input[type="password"]').evaluateAll((inputs) => (
      inputs.filter((input) => input.value || !['off', 'new-password'].includes(input.autocomplete)).length
    ));
    expect(unsafe).toBe(0);
  });

  test('9 all-project strategic anchors remain canonical and fail closed on identity conflict', () => {
    expect(PROJECT_CATALOG.map((project) => project.key)).toEqual([
      'MPSA', 'MAS', 'RPA', 'MVA', 'ASG', 'FIN', 'SD', 'MPSA2', 'TRS', 'VB', 'AMS2', 'BIO',
    ]);
    const aligned = buildStrategicAnchor({
      sprintName: 'FY27DMS06',
      squadKey: 'SD',
      valueEvidence: { piObjectiveTitle: 'Protect Q2 customer launch' },
    });
    expect(aligned).toMatchObject({
      canonicalSquad: 'SD',
      detectedSquad: 'SD',
      conflict: false,
      missionTitle: 'Protect Q2 customer launch',
    });
    const conflict = buildStrategicAnchor({
      sprintName: 'FY27DMS06',
      squadKey: 'FIN',
      valueEvidence: { piObjectiveTitle: 'Finance settlement' },
    });
    expect(conflict.conflict).toBe(true);
    expect(conflict.missionTitle).toContain('quarantined');
  });

  test('10 evidence policy controls business time, impact estimates and servant-leader tone', () => {
    expect(buildBusinessTime({
      currentAgeHours: 240,
      p85CycleHours: 72,
      baselineState: 'ready',
    })).toMatchObject({ state: 'past-pace', businessDaysPastPace: 5 });
    expect(buildBusinessTime({
      currentAgeHours: 240,
      p85CycleHours: 72,
      baselineState: 'ready',
      partialPermissions: true,
    }).label).toBe('Pace unknown — proof incomplete');
    expect(buildImpactScenario({
      flowBaseline: {
        state: 'ready',
        medianCycleHours: 48,
        throughput: [{ completed: 3 }, { completed: 4 }, { completed: 5 }],
      },
      daysRemaining: 5,
      currentWip: 4,
    }).state).toBe('available');
    expect(buildImpactScenario({
      flowBaseline: { state: 'forming', throughput: [] },
      daysRemaining: 5,
      currentWip: 4,
    }).state).toBe('refused');
    expect(buildCommunicationGuard({ stale: true, selectedTone: 'urgent' })).toMatchObject({
      effectiveTone: 'information-only',
      sendAllowed: false,
    });
    const supportive = buildHumanNudgeDraft({
      issueKey: 'SD-5304',
      tone: 'supportive',
      intervention: {
        businessImpact: 'Customer notification value remains blocked.',
        recommendedAction: 'Who can swarm CSS review today?',
      },
    });
    expect(supportive).toContain('Could the squad help restore flow');
    expect(supportive).toContain('Who can swarm CSS review today?');
    expect(supportive).not.toMatch(/assign someone|disable new work/i);

    const doneProbe = buildHumanNudgeDraft({
      issueKey: 'SD-5314',
      useCase: 'done-probe',
      assigneeFirstName: 'Amani',
      stalledSubtasks: [
        { issueKey: 'SD-5315', summary: 'Backend' },
        { issueKey: 'SD-5316', summary: 'CSS review' },
      ],
    });
    expect(doneProbe).toMatch(/Hey @Amani/i);
    expect(doneProbe).toMatch(/SD-5314/);
    expect(doneProbe).toMatch(/moved to Done|move to Done|be moved to Done/i);
    expect(doneProbe).toMatch(/SD-5315/);
    expect(doneProbe).not.toMatch(/Hey @Amani.*Hey @/i);

    const thinEvidence = buildHumanNudgeDraft({
      issueKey: 'SD-5314',
      useCase: 'done-probe',
      assigneeFirstName: 'Amani',
      stalledSubtasks: [],
    });
    expect(thinEvidence).not.toMatch(/@Amani/);
    expect(thinEvidence).toMatch(/looks blocked/i);
  });
});
