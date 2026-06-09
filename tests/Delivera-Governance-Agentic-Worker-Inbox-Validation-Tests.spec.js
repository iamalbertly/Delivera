import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { resolveEffectiveGovernanceProfile } from '../lib/Delivera-Governance-Profile-01Resolve-SSOT.js';
import { verifyCountClaim, scoreClaimConfidence } from '../lib/Delivera-Governance-Claim-Verify-01SSOT.js';
import { GOVERNANCE_SURVEY_LAST_ASKED_KEY } from '../public/Delivera-Shared-Storage-Keys.js';
import { enrichDeliveryTruthFromBaseline } from '../lib/Delivera-Governance-Brief-03Assemble-Service.js';
import { buildBriefFactContract } from '../lib/Delivera-Governance-Brief-01FactContract-SSOT.js';
import { assignDecisionOwners } from '../lib/Delivera-Governance-DecisionOwner-01Map-SSOT.js';
import { RISK_TYPES } from '../lib/Delivera-Governance-Grammar-01Rules-SSOT.js';
import { GOVERNANCE_THRESHOLDS } from '../lib/Delivera-Governance-Grammar-01Rules-SSOT.js';
import { briefToMarkdown } from '../public/Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';
import { buildGuidedNudgeText } from '../public/Delivera-CurrentSprint-Action-Bridge.js';

function mockBoardPayload() {
  return {
    board: { name: 'MPSA Squad A' },
    sprint: { state: 'active', startDate: '2026-05-01T00:00:00Z' },
    meta: { activeSprintCount: 1 },
    stories: [
      { issueKey: 'MPSA-1', status: 'Done', storyPoints: 3, assignee: 'Alice', updated: '2026-05-20' },
      { issueKey: 'MPSA-2', status: 'In Progress', assignee: '', updated: '2026-05-02' },
      { issueKey: 'MPSA-4', status: 'In Progress', assignee: 'Bob', updated: '2026-05-02', labels: ['depends-on-MAS'] },
      { issueKey: 'MPSA-3', status: 'To Do', created: '2026-05-10T00:00:00Z', updated: '2026-05-10' },
    ],
    stuckCandidates: [{ issueKey: 'MPSA-2', status: 'In Progress', hoursInStatus: 60, summary: 'stuck thing' }],
    scopeChanges: [{ issueKey: 'MPSA-3', summary: 'late add', date: '2026-05-10' }],
  };
}

function buildEnrichedContract() {
  const contract = buildBriefFactContract({
    projects: ['MPSA'],
    boardPayloads: [{ payload: mockBoardPayload() }],
    period: { vodacomQuarter: 'Q1' },
    freshnessMeta: {},
  });
  contract.risks = assignDecisionOwners(contract.risks);
  contract.topRisks = contract.risks.slice(0, 5);
  return contract;
}

const MOCK_BRIEF = {
  briefId: 'MPSA-Q1-2026-W23',
  generatedAt: new Date().toISOString(),
  freshness: { confidenceLimit: 'live', jiraFetchedAt: new Date().toISOString() },
  portfolio: 'MPSA',
  deliveryTruth: { committed: 3, done: 1, staleInProgress: 1, blocked: 0, lateAdded: 1, removed: null, carryover: null },
  topRisks: [{
    issueKey: 'MPSA-2', squad: 'MPSA', summary: 'stuck', riskType: 'dependency', riskLabel: 'Cross-team dependency',
    displayTitle: 'Stuck', evidence: 'dependency label', decisionNeededFrom: 'Scrum Master', recommendedAction: 'Escalate',
    escalation: 'act-today', ageHours: 60, issueUrl: 'https://example/MPSA-2',
  }],
  portfolioRisks: [],
  evidencePack: { rows: [] },
  executiveView: { verdictTier: 'blocked', verdictLabel: 'DELIVERY BLOCKED', businessHeadline: 'Blocked', sprintPulse: { done: 1, committed: 3, pct: 33 } },
  leadershipNarrative: {
    confidence: 'low', headline: 'MPSA at low confidence', oneParagraph: 'One stale item.',
    meetingAnswer: 'DELIVERY BLOCKED', narratedBy: 'advisor', decisionsNeeded: [],
  },
  meta: {
    narratedBy: 'advisor',
    safeToSend: true,
    commandAnswerSentence: 'DELIVERY BLOCKED',
    workerReceipt: { line: 'Last run: 1m ago · Checked: Jira' },
    setupGaps: [],
  },
};

async function disableSidebarPointerBlock(page) {
  await page.evaluate(() => {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) sidebar.style.pointerEvents = 'none';
  });
}

/** Scroll right rail into view when queue chip is below fold in CI viewports. */
async function openGovernanceAgentQueueChrome(page) {
  await page.locator('#gov-right-rail-mount').scrollIntoViewIfNeeded();
}

async function openGovernanceDetails(page, elementId) {
  await disableSidebarPointerBlock(page);
  await page.evaluate((id) => document.getElementById(id)?.setAttribute('open', ''), elementId);
}

const CATALOG_KEYS = ['MPSA', 'MAS', 'RPA', 'MVA', 'ASG', 'FIN', 'SD', 'MPSA2', 'TRS', 'VB', 'AMS2', 'BIO'];

async function mockGovernancePage(page) {
  await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'MPSA'); });
  await page.route('**/api/projects-catalog.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ projects: CATALOG_KEYS.map((key) => ({ key, label: key, accessible: true })) }),
  }));
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BRIEF) }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [{ label: 'Q1 FY26', isCurrent: true }] }) }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ byMetric: {}, total: 0 }) }));
  await page.route('**/api/leadership-summary.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ velocity: { source: 'unavailable' } }) }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ projects: ['MPSA'], boards: [{ id: 1, name: 'MPSA board', projectKey: 'MPSA' }], projectErrors: [] }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, agents: [], lastImprovements: [] }),
  }));
}

test.describe('Governance agentic worker — unit logic', () => {
  test('resolveEffectiveGovernanceProfile inherits parent thresholds', async () => {
    const p = await resolveEffectiveGovernanceProfile({ project: 'MPSA' });
    expect(p.thresholds.staleInProgressHours).toBe(GOVERNANCE_THRESHOLDS.staleInProgressHours);
    expect(p.thresholds.riskBriefTopN).toBe(GOVERNANCE_THRESHOLDS.riskBriefTopN);
  });

  test('verifyCountClaim fails on stale count mismatch', () => {
    const c = buildEnrichedContract();
    const r = verifyCountClaim('There are 99 stale items', c);
    expect(r.pass).toBe(false);
    expect(r.mismatches.length).toBeGreaterThan(0);
  });

  test('dependency risk from story labels', () => {
    const c = buildEnrichedContract();
    const dep = c.risks.find((r) => r.riskType === RISK_TYPES.DEPENDENCY);
    expect(dep).toBeTruthy();
    expect(dep.decisionNeededFrom).toBeTruthy();
  });

  test('enrichDeliveryTruthFromBaseline sets removed and carryover', () => {
    const c = buildEnrichedContract();
    enrichDeliveryTruthFromBaseline(c, { summary: { removed: 2, delayed: 3 } });
    expect(c.deliveryTruth.removed).toBe(2);
    expect(c.deliveryTruth.carryover).toBe(3);
  });

  test('buildGuidedNudgeText maps risk context', () => {
    const local = buildGuidedNudgeText({
      issueKey: 'MPSA-2',
      issueSummary: 'Blocked work',
      summaryContext: { topAction: 'Confirm blocker', evidenceBand: 'actionable' },
    });
    expect(local.length).toBeGreaterThan(10);
    expect(local).toMatch(/Do now:/i);
  });

  test('scoreClaimConfidence marks low narrative as unsafe', () => {
    const c = buildEnrichedContract();
    const result = scoreClaimConfidence(c, {
      headline: 'There are 99 stale items.',
      oneParagraph: 'There are 50 risks blocking delivery.',
      meetingAnswer: 'MPSA-999 is the main blocker.',
    });
    expect(result.score).toBeLessThan(0.8);
    expect(result.safeToSend).toBe(false);
  });
});

test.describe('Governance agentic worker — UI', () => {
  test('inbox mount renders on page load', async ({ page }) => {
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ briefs: [{ id: '1', type: 'brief', summary: 'Brief ready', safeToSend: true, approvalRequired: false, createdAt: new Date().toISOString() }], nudges: [], piDrift: [], confirm: [], impact: [], total: 1 }),
    }));
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    const telemetry = await captureBrowserTelemetry(page);
    await expect(page.locator('#gov-queue-mount [data-queue-open]')).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('empty inbox while brief loads shows preparing copy', async ({ page }) => {
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }),
    }));
    await page.route('**/api/governance-brief.json**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BRIEF) });
    });
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('#gov-queue-mount .gov-inbox-hint')).toContainText(/Brief is preparing/i);
  });

  test('freshness review link opens confirm tab in drawer', async ({ page }) => {
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        briefs: [], nudges: [], piDrift: [],
        confirm: [{ id: 'c1', type: 'confirm', summary: 'Stale claim', payload: { owner: 'X', board: 'MPSA' } }],
        impact: [], poReadiness: [], total: 1,
      }),
    }));
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        briefId: 'INBOX-CONFIRM',
        projects: ['MPSA'],
        executiveView: { verdictTier: 'watch' },
        leadershipNarrative: { confidence: 'medium', meetingAnswer: 'Watch' },
        meta: { workerReceipt: { inboxTotal: 1 } },
        freshness: { confidenceLimit: 'live' },
        topRisks: [],
        evidencePack: { rows: [] },
      }),
    }));
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await page.locator('#gov-rail-review-claims, #gov-freshness-review').first().click();
    await expect(page.locator('.gov-right-drawer-panel')).toBeVisible();
    await expect(page.locator('[data-queue-tab="doNow"].is-active, [data-queue-tab="confirm"].is-active').first()).toBeVisible();
  });

  test('queue chip opens right drawer', async ({ page }) => {
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ briefs: [{ id: 'b1', type: 'brief', summary: 'Ready', safeToSend: true, approvalRequired: false, createdAt: new Date().toISOString() }], nudges: [], piDrift: [], confirm: [], impact: [], total: 1 }),
    }));
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await openGovernanceAgentQueueChrome(page);
    const queueOpen = page.locator('[data-queue-open]');
    await expect(queueOpen).toBeVisible({ timeout: 15000 });
    await queueOpen.click({ force: true });
    await expect(page.locator('.gov-right-drawer-panel')).toBeVisible();
    await expect(page.locator('.gov-inbox-group-card')).toBeVisible();
  });

  test('synthetic inbox approve does not console-error', async ({ page }) => {
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        briefs: [{
          id: 'synthetic-cached-brief',
          type: 'brief',
          summary: 'Cached brief',
          safeToSend: true,
          approvalRequired: false,
          payload: { synthetic: true, briefId: 'cached-1' },
        }],
        nudges: [], piDrift: [], confirm: [], impact: [], poReadiness: [], total: 1,
      }),
    }));
    const telemetry = await captureBrowserTelemetry(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await openGovernanceAgentQueueChrome(page);
    await page.locator('[data-queue-open]').click({ force: true });
    await expect(page.locator('.gov-inbox-cached-hint, .gov-inbox-hint')).toBeVisible();
    assertTelemetryClean(telemetry);
  });

  test('inbox approve calls resolve API', async ({ page }) => {
    let resolved = false;
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ briefs: [], nudges: [{ id: 'n1', type: 'nudge', summary: 'Nudge MPSA-2', safeToSend: true, approvalRequired: true, createdAt: new Date().toISOString() }], piDrift: [], confirm: [], impact: [], total: 1 }),
    }));
    await page.route('**/api/governance/inbox/*/resolve', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      resolved = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await openGovernanceAgentQueueChrome(page);
    await page.locator('[data-queue-open]').click({ force: true });
    await expect(page.locator('.gov-right-drawer-panel')).toBeVisible();
    await expect(page.locator('[data-inbox-approve="n1"]')).toBeVisible();
    await disableSidebarPointerBlock(page);
    await page.locator('[data-inbox-approve="n1"]').dispatchEvent('click');
    await expect.poll(() => resolved, { timeout: 8000 }).toBe(true);
  });

  test('PI drift tab shows confirm items', async ({ page }) => {
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ briefs: [], nudges: [], piDrift: [{ id: 'p1', type: 'pi-drift', summary: 'PI drift detected', safeToSend: true, approvalRequired: true, createdAt: new Date().toISOString() }], confirm: [], impact: [], total: 1 }),
    }));
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await openGovernanceAgentQueueChrome(page);
    await page.locator('[data-queue-open]').click({ force: true });
    await expect(page.locator('.gov-inbox-group-card')).toContainText(/PI drift/i);
  });

  test('micro-survey relocated out of main flow', async ({ page }) => {
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }) }));
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('#gov-secondary-chrome')).toHaveAttribute('hidden', '');
    await expect(page.locator('#gov-micro-survey-mount')).toBeAttached();
  });

  test('nudges tab shows draft excerpt and review opens sheet', async ({ page }) => {
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        briefs: [],
        nudges: [{
          id: 'n-draft',
          type: 'nudge',
          summary: 'Nudge Sam on MPSA-2',
          safeToSend: true,
          approvalRequired: true,
          payload: {
            owner: 'Sam',
            issueKey: 'MPSA-2',
            draftText: 'Hi Sam — please confirm next step on MPSA-2 today.',
            board: 'MPSA',
          },
        }],
        piDrift: [], confirm: [], impact: [], poReadiness: [],
      }),
    }));
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await openGovernanceAgentQueueChrome(page);
    await page.locator('[data-queue-open]').click({ force: true });
    await page.locator('[data-queue-tab="doNow"], [data-queue-tab="nudges"]').first().click();
    await expect(page.locator('.gov-inbox-draft-excerpt')).toContainText(/confirm next step/i);
    await disableSidebarPointerBlock(page);
    await page.locator('[data-group-review]').first().click();
    await expect(page.locator('body')).toHaveClass(/jira-nudge-review-open/);
    await expect(page.locator('#jira-nudge-review-text')).toHaveValue(/confirm next step/i);
  });

  test('adoption metric POST on survey click', async ({ page }) => {
    let posted = false;
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }) }));
    await page.route('**/api/governance/adoption-metric', (r) => { posted = true; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }); });
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await page.evaluate(() => { document.getElementById('gov-secondary-chrome')?.removeAttribute('hidden'); });
    await openGovernanceDetails(page, 'gov-secondary-chrome');
    await page.locator('.gov-micro-pill[data-minutes="10"]').click();
    await expect.poll(() => posted).toBe(true);
  });

  test('copy meeting fires narration-feedback when advisor', async ({ page, context }) => {
    let feedbackBody = null;
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }) }));
    await page.route('**/api/governance/narration-feedback', async (r) => {
      feedbackBody = JSON.parse(r.request().postData() || '{}');
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    const telemetry = await captureBrowserTelemetry(page);
    await page.locator('#gov-copy-answer-inline').click();
    await expect.poll(() => feedbackBody?.source, { timeout: 3000 }).toBe('sm-accepted');
    assertTelemetryClean(telemetry);
  });

  test('micro-survey collapses after selection', async ({ page }) => {
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }) }));
    await page.route('**/api/governance/adoption-metric', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) }));
    await page.addInitScript((key) => { localStorage.removeItem(key); }, GOVERNANCE_SURVEY_LAST_ASKED_KEY);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await page.evaluate(() => { document.getElementById('gov-secondary-chrome')?.removeAttribute('hidden'); });
    await openGovernanceDetails(page, 'gov-secondary-chrome');
    await disableSidebarPointerBlock(page);
    await page.locator('.gov-micro-pill[data-minutes="3"]').click({ force: true });
    await expect(page.locator('#gov-micro-survey-mount')).toHaveClass(/gov-micro-survey--done/);
  });

  test('briefToMarkdown includes Grow My Impact section', () => {
    const md = briefToMarkdown(MOCK_BRIEF, 'MPSA', '## Grow My Impact\n\n- Briefs prepared: 5');
    expect(md).toContain('Grow My Impact');
    expect(md).toContain('Briefs prepared');
  });

  test('dependency risk renders Scrum Master lane in proof', async ({ page }) => {
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }) }));
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('.gov-owner-cluster')).toContainText(/Scrum Master/i);
    await openGovernanceDetails(page, 'gov-supporting-evidence');
    await expect(page.locator('#gov-proof-risks')).toBeAttached();
  });

  test('quarter pills in scope drawer panel', async ({ page }) => {
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }) }));
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await disableSidebarPointerBlock(page);
    await expect(page.locator('#gov-scope-expanded .gov-scope-quarter-pill')).toHaveCount(1);
  });

  test('merged supporting evidence details', async ({ page }) => {
    await mockGovernancePage(page);
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }) }));
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('#gov-supporting-evidence')).toBeVisible();
    await expect(page.locator('#gov-evidence-wrap')).toHaveCount(0);
  });
});
