import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { loginIfRequired } from './Delivera-Playwright-Login-If-Required-01Helper.js';
import { diagnosePromiseEvidence, PROMISE_DIAGNOSIS_CODES } from '../lib/Delivera-Governance-PIBaseline-02Compare.js';
import { buildSprintAtAGlanceBriefing } from '../public/Delivera-CurrentSprint-Summary-03AtAGlance-Briefing-SSOT.js';
import {
  buildFlowBaseline,
  enhanceFlowIntervention,
} from '../lib/Delivera-CurrentSprint-Flow-Intelligence-SSOT.js';

test.describe.configure({ mode: 'serial' });

const DMS_GOVERNANCE = '/governance?spotlight=SD&view=squad';
const EXPECTED_EXCEPTIONS = ['AMS2', 'BIO', 'MAS', 'MPSA', 'MVA', 'TRS', 'VB'];

async function visibleIssueKeys(page) {
  return page.locator('main a[href*="/browse/"]:visible').evaluateAll((links) => (
    links.map((link) => link.textContent.trim()).filter((text) => /^[A-Z0-9]+-\d+$/.test(text))
  ));
}

test.describe('Delivera customer speed and trust release', () => {
  test('1 changed truth and classifier contracts remain evidence-bound', () => {
    const fixtures = [
      [{ issueKey: 'FIN-1', permissionDenied: true }, 'access-blocked'],
      [{ issueKey: 'FIN-2', currentFound: true, inBacklog: true }, 'backlog-only'],
      [{ issueKey: 'FIN-3', currentFound: true, inFutureSprint: true, sprintName: 'FY27FIN07' }, 'future-sprint'],
      [{ issueKey: 'FIN-4', currentFound: true, missingPiMetadata: true }, 'missing-pi-metadata'],
      [{ issueKey: 'FIN-5', candidateIssueKeys: ['FIN-55'] }, 'likely-moved-or-rekeyed'],
      [{ issueKey: 'FIN-6', currentFound: true, status: 'Done' }, 'done-proof-pending'],
      [{ issueKey: 'FIN-7', currentFound: true, isProgramTheme: true }, 'program-theme'],
      [{ issueKey: 'FIN-8', currentFound: true, supportWork: true }, 'off-plan-or-support'],
      [{ issueKey: 'FIN-9', currentFound: true, baselinePeriod: 'FY27 Q2', jiraPeriod: 'FY27 Q3' }, 'period-conflict'],
      [{ issueKey: 'FIN-10' }, 'exact-key-unavailable'],
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
    expect(Object.values(PROMISE_DIAGNOSIS_CODES)).toHaveLength(11);

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
    expect(JSON.stringify(cockpit)).not.toMatch(/disable new work|automatically assign/i);
  });

  test('2 last failed Governance truth uses business days and retains verified promises', async ({ page }) => {
    const started = Date.now();
    await loginIfRequired(page, DMS_GOVERNANCE, { rootSelector: '[data-testid="governance-active-loop"]' });
    const usefulMs = Date.now() - started;
    const root = page.locator('[data-testid="governance-active-loop"]');
    await expect(root).toHaveAttribute('data-fiscal-period', 'FY27 Q2');
    await expect(root.locator('[data-loop-squad]')).toHaveCount(1);
    const sprintCopies = await page.locator('#gov-squad-spotlight').getByText(/\bis active, \d+ business days? remaining\./).count();
    expect(sprintCopies).toBeGreaterThan(0);
    const previewPromiseCount = await page.locator('[data-loop-promise]').count();
    expect(previewPromiseCount).toBeGreaterThan(0);
    await expect(page.locator('#gov-squad-spotlight')).not.toContainText('baseline missing');
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
});
