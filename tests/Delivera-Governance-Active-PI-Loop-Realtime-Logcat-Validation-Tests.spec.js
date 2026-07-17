import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  PROMISE_MATCH_STATES,
  allowedActionsForPromise,
  buildActiveGovernanceAnswer,
  businessDaysBetween,
  calculateWorkSplit,
  clusterUnknownWork,
  chooseWorkSplitMethod,
  classifyProofAge,
  diffRelevantJiraState,
  relevantJiraStateHash,
  resolveOwnerRoute,
  scorePossibleRework,
  stablePromiseId,
  validateAmendment,
} from '../lib/Delivera-Governance-ActiveLoop-01Domain-SSOT.js';
import {
  ingestJiraGovernanceWebhook,
  resetActiveLoopIngestionStateForTests,
} from '../lib/Delivera-Governance-ActiveLoop-03Event-Ingestion-Service.js';

const NOW = new Date('2026-07-17T10:32:00.000Z');

const ACTIVE_ANSWER = {
  schemaVersion: 1,
  answerVersion: 7,
  contract: { id: 'contract-q2', piName: 'FY27 Q2', approvedBy: 'PI Team', approvedAt: '2026-07-01T08:00:00Z', source: 'approved-baseline' },
  scope: { mode: 'all-squads', projects: ['SD', 'RPA', 'AMS2', 'MPSA2'], expectedSquads: 4, verifiedSquads: 4, complete: true, partialProjects: [] },
  answer: '2 squads are not aligned to Q2 PI promises. DMS has 2 no-proof promises. RPA has 1 partial match.',
  sourceLine: 'Compared with FY27 Q2 PI contract · 11 promises checked · last verified 10:32 UTC',
  deliveraDid: 'Delivera matched the contract to Jira, checked proof age and work split, and prepared 2 safe owner asks.',
  verifiedAt: '2026-07-17T10:32:00Z',
  evidenceObservedAt: '2026-07-17T10:30:00Z',
  loopCompletion: 64,
  nextDecisionPromiseId: 'prm-dms-1',
  squads: [
    { squad: 'DMS', promiseCount: 3, attentionCount: 2, topState: '2 no-proof promises', proofState: 'stale proof', piPct: 31, workSplit: { method: 'ticket-count', unplannedPct: 38, largestUnmappedCluster: 'Legacy Database Migrations' } },
    { squad: 'RPA', promiseCount: 2, attentionCount: 1, topState: '1 partial match', proofState: 'proof needs review', piPct: 22, workSplit: { method: 'ticket-count', unplannedPct: 18, largestUnmappedCluster: 'Automation support' } },
    { squad: 'AMS', promiseCount: 3, attentionCount: 0, topState: 'aligned', proofState: 'fresh proof', piPct: 100, workSplit: { method: 'ticket-count', unplannedPct: 0 } },
    { squad: 'Transformers', promiseCount: 3, attentionCount: 0, topState: 'aligned', proofState: 'fresh proof', piPct: 100, workSplit: { method: 'ticket-count', unplannedPct: 0 } },
  ],
  promises: [
    {
      promiseId: 'prm-dms-1', contractId: 'contract-q2', originalText: 'Launch the verified customer journey integration', businessOutcome: 'Customer adoption',
      source: 'Approved Q2 planning pack', sourceReference: 'Slide 8', quarter: 'FY27 Q2', squad: 'DMS', issueKey: 'SD-5314', statusNow: 'In Progress',
      matchState: 'no-jira-proof', matchLabel: 'No Jira proof', proofAge: { state: 'stale', businessDays: 12, copy: 'This work has not moved in 12 business days. Ask the owner if it is blocked or already done.' },
      ownerRoute: { role: 'Squad PO', source: 'settings-product-owner', displayName: 'Amina N.', fallback: true, resolutionPath: [{ role: 'Jira assignee', displayName: '', active: true }, { role: 'Squad PO', displayName: 'Amina N.', active: true }] },
      version: 7, amendmentHistory: [], actionHistory: [{ type: 'nudge-queued', ts: '2026-07-16T20:00:00Z', messagePreview: 'Please update the missing proof.' }], caseState: 'needs-attention',
      allowedActions: [
        { id: 'send-nudge', allowed: true, reason: 'Will send via Squad PO.' },
        { id: 'pull-fresh-evidence', allowed: true, reason: 'Refresh only this promise evidence.' },
        { id: 'approve-match', allowed: false, reason: 'Pull fresh evidence before approving.' },
        { id: 'amend-contract', allowed: true, reason: 'Preserves the original promise and appends approval.' },
        { id: 'assign-owner', allowed: true, reason: 'A fallback owner is currently selected.' },
        { id: 'accept-risk', allowed: true, reason: 'Records an explicit, auditable PI risk decision.' },
      ],
    },
    {
      promiseId: 'prm-rpa-1', contractId: 'contract-q2', originalText: 'Automate the dispute workflow', source: 'Approved Q2 planning pack', squad: 'RPA', issueKey: 'RPA-88', statusNow: 'In Progress',
      matchState: 'partly-matched', matchLabel: 'Partly matched', proofAge: { state: 'aging', businessDays: 7, copy: 'Evidence has not moved in 7 business days.' },
      ownerRoute: { role: 'Jira assignee', source: 'jira-assignee', displayName: 'Tariq', fallback: false, resolutionPath: [] }, version: 3, amendmentHistory: [], actionHistory: [], caseState: 'needs-attention',
      allowedActions: [{ id: 'send-nudge', allowed: true, reason: 'Will send via Jira assignee.' }, { id: 'amend-contract', allowed: true, reason: 'Preserves the original promise.' }],
    },
  ],
};

const LEGACY_BRIEF = {
  briefId: 'active-loop-fixture', projects: ACTIVE_ANSWER.scope.projects, portfolio: 'All squads', generatedAt: NOW.toISOString(),
  freshness: { confidenceLimit: 'live', jiraFetchedAt: NOW.toISOString() }, deliveryTruth: { committed: 11, done: 7 },
  executiveView: { verdictTier: 'watch', verdictLine: 'NEEDS ATTENTION' }, leadershipNarrative: { confidence: 'medium', meetingAnswer: ACTIVE_ANSWER.answer, narratedBy: 'template' },
  meta: { narratedBy: 'template', commandAnswerSentence: ACTIVE_ANSWER.answer, safeToSend: true, workerReceipt: { line: 'Last run: 1m ago', inboxTotal: 0 }, setupGaps: [], partialProjects: [], boardEpicIndex: [] },
  topRisks: [], portfolioRisks: [], evidencePack: { rows: [] }, poReadiness: null, squadInsights: [], portfolioRollup: { totalSquads: 4, behindPiCount: 2 },
};

async function mockGovernanceJourney(page, { answer = ACTIVE_ANSWER, decisionStatus = 200 } = {}) {
  await page.addInitScript(() => {
    localStorage.removeItem('delivera:governance:active-loop:v1');
    sessionStorage.removeItem('delivera:brief:cache:v1');
  });
  await page.route('**/api/governance/active-loop.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer) }));
  await page.route('**/api/governance-brief.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LEGACY_BRIEF) }));
  await page.route('**/api/projects-catalog.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ projects: answer.scope.projects.map((key) => ({ key, accessible: true })) }) }));
  await page.route('**/api/quarters-list**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [{ label: 'FY27 Q2', isCurrent: true }] }) }));
  await page.route('**/api/boards.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ boards: answer.scope.projects.map((projectKey, index) => ({ id: index + 1, projectKey })), projectErrors: [] }) }));
  await page.route('**/api/governance/inbox.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], poReadiness: [], total: 0 }) }));
  await page.route('**/api/governance/feedback-summary.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }) }));
  await page.route('**/api/governance/adoption-metrics.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, byMetric: {} }) }));
  await page.route('**/api/governance/diagnostics.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: '0.0.0.1', environment: 'uat', buildSha: 'fixture-sha', cacheBackend: 'redis', queueDepth: 0 }) }));
  await page.route('**/api/governance/refreshes', (route) => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ jobId: 'refresh-1', status: 'running', attached: true }) }));
  await page.route('**/api/governance/cases/*/nudges**', (route) => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ queued: true, deliveraRef: 'DLV-2026-A1B2C3D4', route: 'jira', version: 8 }) }));
  await page.route('**/api/governance/contracts/*/amendments', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, version: 8, amendmentId: 'amd-1' }) }));
  await page.route('**/api/governance/cases/*/decisions', (route) => {
    if (decisionStatus === 412) return route.fulfill({ status: 412, contentType: 'application/json', body: JSON.stringify({ code: 'GOVERNANCE_VERSION_CONFLICT', message: 'This item was updated by another PI Team user 10 seconds ago. Reload latest state before deciding.', latestVersion: 8 }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, version: 8, decisionId: 'decision-1' }) });
  });
}

test.describe('Active PI governance deterministic domain', () => {
  test('immutable promise identity is stable and independent from rendering', () => {
    const a = stablePromiseId({ contractId: 'c1', issueKey: 'SD-1', title: 'Promise', squad: 'DMS', ordinal: 0 });
    const b = stablePromiseId({ contractId: 'c1', issueKey: 'SD-1', title: 'Promise', squad: 'DMS', ordinal: 0 });
    expect(a).toBe(b);
    expect(a).toMatch(/^prm_[a-f0-9]{16}$/);
  });

  test('relevant Jira hashing ignores ordering noise and catches governance changes', () => {
    const first = { status: 'In Progress', labels: ['PI', 'Q2'], components: [{ name: 'API' }], assigneeAccountId: 'a1' };
    const reordered = { ...first, labels: ['Q2', 'PI'] };
    expect(relevantJiraStateHash(first)).toBe(relevantJiraStateHash(reordered));
    const statusDiff = diffRelevantJiraState(first, { ...reordered, status: 'Done' });
    expect(statusDiff.changed).toBe(true);
    expect(statusDiff.changedFields).toContain('status');
    expect(diffRelevantJiraState(first, reordered).changed).toBe(false);
  });

  test('proof age observes every business-day boundary and honest terminal conditions', () => {
    expect(classifyProofAge({ lastMovementAt: '2026-07-10', now: NOW }).state).toBe('fresh');
    expect(classifyProofAge({ lastMovementAt: '2026-07-09', now: NOW }).state).toBe('aging');
    expect(classifyProofAge({ lastMovementAt: '2026-07-03', now: NOW }).state).toBe('aging');
    expect(classifyProofAge({ lastMovementAt: '2026-07-02', now: NOW }).state).toBe('stale');
    expect(classifyProofAge({ lastMovementAt: '2026-05-20', now: NOW }).state).toBe('expired');
    expect(classifyProofAge({ lastMovementAt: '2026-07-16', now: NOW, deletedAt: '2026-07-17' }).state).toBe('expired');
    expect(classifyProofAge({ lastMovementAt: '2026-07-16', now: NOW, done: true, accepted: false }).state).toBe('done-not-accepted');
    expect(businessDaysBetween('2026-07-10', NOW)).toBe(5);
  });

  test('Work Split never mixes units and sends unsafe classification to Unknown', () => {
    const strongLogs = [{ worklogSeconds: 10, category: 'pi' }, { worklogSeconds: 20, category: 'unplanned', epicTitle: 'Legacy migrations' }];
    expect(chooseWorkSplitMethod({ activeItems: strongLogs }).method).toBe('logged-effort');
    const weakLogs = [{ worklogSeconds: 10, category: 'pi' }, { worklogSeconds: 0, category: 'support' }, { worklogSeconds: 0 }];
    expect(chooseWorkSplitMethod({ activeItems: weakLogs }).method).toBe('ticket-count');
    const split = calculateWorkSplit({ activeItems: weakLogs });
    expect(split.method).toBe('ticket-count');
    expect(split.percentages.unknown).toBe(33);
    expect(split.percentages.pi + split.percentages.support + split.percentages.unknown).toBe(100);
  });

  test('Possible Rework requires two strong evidence paths and keeps weak reopenings quiet', () => {
    const weak = scorePossibleRework({ items: [{ issueKey: 'DMS-1', summary: 'Minor edge case', reopened: true, reopenedAt: '2026-07-15', acceptedAt: '2026-07-01' }], now: NOW });
    expect(weak.promoted).toBeNull();
    expect(weak.copy).not.toContain('Possible rework:');
    const splitContinuation = scorePossibleRework({ items: [{ issueKey: 'DMS-2', summary: 'Split epic continuation', createdAfterClosure: true, sameCapability: true }], now: NOW });
    expect(splitContinuation.promoted).toBeNull();
    const proven = scorePossibleRework({ items: [{ issueKey: 'DMS-3', summary: 'Regression fix after rejected UAT', piLinked: true, acceptedAt: '2026-06-20', reopenedAt: '2026-07-10', uatRejected: true, sameAcceptanceCriteria: true, worklogSeconds: 8 * 3600 }], now: NOW });
    expect(proven.promoted.confidence).toBe('high');
    expect(proven.promoted.strongPathCount).toBeGreaterThanOrEqual(2);
  });

  test('Unknown work clusters into group decisions and stays quiet below threshold', () => {
    const items = [
      ...Array.from({ length: 6 }, (_, index) => ({ issueKey: `DMS-U${index}`, summary: 'Database migration sync', components: ['Database'] })),
      ...Array.from({ length: 14 }, (_, index) => ({ issueKey: `DMS-P${index}`, summary: 'PI work', category: 'pi' })),
    ];
    const split = calculateWorkSplit({ activeItems: items });
    const grouped = clusterUnknownWork({ activeItems: items, workSplit: split });
    expect(grouped.promoted).toBe(true);
    expect(grouped.topCluster.ticketCount).toBe(6);
    expect(grouped.topCluster.sharedEvidence).toContain('shared component');
    const quiet = clusterUnknownWork({ activeItems: [...Array.from({ length: 9 }, () => ({ category: 'pi' })), { summary: 'one unknown' }] });
    expect(quiet.promoted).toBe(false);
    expect(quiet.clusters).toHaveLength(1);
  });

  test('owner cascade handles active owner, inactive owner, PO fallback, lead fallback, and PI queue', () => {
    expect(resolveOwnerRoute({ explicitOwner: { displayName: 'Owner', active: true } }).source).toBe('promise-owner');
    expect(resolveOwnerRoute({ explicitOwner: { displayName: 'Former', active: false }, jiraAssignee: { displayName: 'Jira', active: true } }).source).toBe('jira-assignee');
    expect(resolveOwnerRoute({ productOwner: { displayName: 'PO' } }).source).toBe('settings-product-owner');
    expect(resolveOwnerRoute({ streamLead: { displayName: 'Lead' } }).source).toBe('settings-stream-lead');
    expect(resolveOwnerRoute({}).source).toBe('pi-team-queue');
    expect(resolveOwnerRoute({}).unresolved).toBe(true);
  });

  test('amendments reject unsafe input and preserve approved plain-language types', () => {
    expect(validateAmendment({ type: 'delete-history', reason: 'approved reason' }).code).toBe('INVALID_AMENDMENT_TYPE');
    expect(validateAmendment({ type: 'move-to-next-quarter', reason: 'short' }).code).toBe('AMENDMENT_REASON_REQUIRED');
    expect(validateAmendment({ type: 'move_to_next_quarter', reason: 'Business approved movement to Q3.' }).valid).toBe(true);
    expect(validateAmendment({ type: 'mark-as-support-obligation', reason: 'This is an approved operational obligation.' }).valid).toBe(true);
  });

  test('allowed actions degrade with no baseline, stale Jira, missing link, and unresolved owner', () => {
    const promise = { version: 4, matchState: PROMISE_MATCH_STATES.NO_JIRA_PROOF, proofAge: { state: 'unknown' }, ownerRoute: resolveOwnerRoute({}), issueKey: '' };
    const actions = allowedActionsForPromise(promise, { hasBaseline: false, jiraAvailable: false });
    expect(actions.find((a) => a.id === 'send-nudge').allowed).toBe(false);
    expect(actions.find((a) => a.id === 'pull-fresh-evidence').allowed).toBe(false);
    expect(actions.find((a) => a.id === 'amend-contract').allowed).toBe(false);
    expect(actions.find((a) => a.id === 'accept-risk').allowed).toBe(false);
    expect(actions.find((a) => a.id === 'assign-owner').allowed).toBe(true);
    expect(actions.every((a) => a.expectedVersion === 4)).toBe(true);
  });

  test('answer projection protects no-baseline, partial-scope, deleted-link, and amended histories', () => {
    const noBaseline = buildActiveGovernanceAnswer({ brief: { projects: ['DMS'], generatedAt: NOW.toISOString(), meta: {}, evidencePack: { rows: [] } }, now: NOW });
    expect(noBaseline.contract).toBeNull();
    expect(noBaseline.answer).toContain('No approved PI contract');
    const baseline = { id: 'c1', piName: 'FY27 Q2', committedItems: [{ issueKey: 'DMS-1', title: 'Original promise', squad: 'DMS' }] };
    const partial = buildActiveGovernanceAnswer({ brief: { projects: ['DMS', 'RPA'], generatedAt: NOW.toISOString(), meta: { partialProjects: ['RPA'], boardEpicIndex: [] }, evidencePack: { rows: [] }, squadInsights: [] }, baseline, now: NOW });
    expect(partial.answer).toContain('1 of 2 squads verified');
    expect(partial.promises[0].matchState).toBe(PROMISE_MATCH_STATES.NO_JIRA_PROOF);
    const amended = buildActiveGovernanceAnswer({ brief: { projects: ['DMS'], generatedAt: NOW.toISOString(), meta: { boardEpicIndex: [] }, evidencePack: { rows: [] }, squadInsights: [] }, baseline, caseState: { [stablePromiseId({ contractId: 'c1', issueKey: 'DMS-1', title: 'Original promise', squad: 'DMS', ordinal: 0 })]: { version: 2, amendments: [{ status: 'approved', type: 'move-to-next-quarter' }] } }, now: NOW });
    expect(amended.promises[0].matchState).toBe(PROMISE_MATCH_STATES.ALIGNED_AMENDED);
    expect(amended.promises[0].originalText).toBe('Original promise');
  });

  test('webhook ingestion skips unchanged state and coalesces relevant changes', async () => {
    resetActiveLoopIngestionStateForTests();
    const payload = { webhookEvent: 'jira:issue_updated', issue: { id: '1001', key: 'DMS-1', fields: { project: { key: 'DMS' }, status: { name: 'In Progress' }, labels: ['PI'] } } };
    const first = await ingestJiraGovernanceWebhook(payload, { webhookId: 'wh-1' });
    expect(first.relevantChange).toBe(true);
    expect(first.coalesced.coalescedIssueCount).toBe(1);
    const duplicateState = await ingestJiraGovernanceWebhook(payload, { webhookId: 'wh-2' });
    expect(duplicateState.relevantChange).toBe(false);
    expect(duplicateState.skippedRecomputation).toBe(true);
    const changed = await ingestJiraGovernanceWebhook({ ...payload, issue: { ...payload.issue, fields: { ...payload.issue.fields, status: { name: 'Done' } } } }, { webhookId: 'wh-3' });
    expect(changed.changedFields).toContain('status');
    expect(changed.coalesced.coalescedIssueCount).toBe(1);
    resetActiveLoopIngestionStateForTests();
  });
});

test.describe('Active PI governance realtime value journey @focused', () => {
  test('first viewport answers the contract question with one calm action surface', async ({ page }) => {
    await mockGovernanceJourney(page);
    await page.goto('/governance');
    const hero = page.getByTestId('governance-active-loop');
    await expect(hero).toBeVisible({ timeout: 15000 });
    await test.step('01 all-squads contract answer is first', async () => expect(hero.locator('h1')).toContainText('2 squads are not aligned'));
    await test.step('02 source names the immutable quarter contract', async () => expect(page.getByTestId('governance-source-line')).toContainText('FY27 Q2 PI contract'));
    await test.step('03 promise count and verification time are visible', async () => expect(page.getByTestId('governance-source-line')).toContainText('11 promises checked'));
    await test.step('04 Delivera already did line explains automation', async () => expect(hero.locator('.gov-loop-did')).toContainText('matched the contract to Jira'));
    await test.step('05 exactly one primary governance CTA exists', async () => expect(hero.locator('[data-loop-primary]')).toHaveCount(1));
    await test.step('06 every squad remains visible and calm', async () => expect(hero.locator('[data-loop-squad]')).toHaveCount(4));
    await test.step('07 risk squad exposes baseline variance', async () => expect(hero.locator('[data-loop-squad="DMS"]')).toContainText('2 no-proof promises'));
    await test.step('08 aligned squad remains present', async () => expect(hero.locator('[data-loop-squad="AMS"]')).toContainText('aligned'));
    await test.step('09 loop coverage rewards explicit decisions without ranking squads', async () => expect(hero.locator('.gov-loop-progress')).toContainText('Loop coverage'));
    await test.step('10 duplicate legacy hero is removed from the visible journey', async () => expect(page.locator('#gov-verdict-mount')).toBeHidden());
    await test.step('11 duplicate owner/action rails are removed', async () => expect(page.locator('#gov-action-clusters-mount')).toBeHidden());
    await test.step('12 heavy proof remains progressively disclosed', async () => expect(page.locator('#gov-supporting-evidence')).not.toHaveAttribute('open', ''));
    await test.step('13 response fits without horizontal overflow', async () => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });

  test('keyboard proof preview persists, is selectable, and closes with Escape', async ({ page }) => {
    await mockGovernanceJourney(page);
    await page.goto('/governance');
    const squad = page.locator('[data-loop-squad="DMS"]');
    await expect(squad).toBeVisible({ timeout: 15000 });
    await squad.focus();
    const popover = page.locator('.gov-loop-proof-popover');
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAttribute('role', 'dialog');
    await expect(popover).toContainText('No Jira proof');
    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
  });

  test('lenses emphasize evidence without reordering squads and diagnostics stay concealed', async ({ page }) => {
    await mockGovernanceJourney(page);
    await page.goto('/governance');
    const order = async () => page.locator('[data-story-squad]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-story-squad')));
    const original = await order();
    await page.locator('[data-story-lens="rework"]').click();
    expect(await order()).toEqual(original);
    await expect(page.locator('.gov-diagnostics-drawer')).toHaveCount(0);
    await page.locator('[data-governance-diagnostics]').dblclick();
    await expect(page.locator('.gov-diagnostics-drawer')).toContainText('fixture-sha');
  });

  test('proof drawer exposes source, proof, work split, owner path, history, and only valid actions', async ({ page }) => {
    await mockGovernanceJourney(page);
    await page.goto('/governance');
    await page.locator('[data-loop-primary]').click();
    const drawer = page.locator('.gov-loop-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('Approved Q2 planning pack');
    await expect(drawer).toContainText('12 business days');
    await expect(drawer).toContainText('38% unplanned work');
    await expect(drawer).toContainText('Legacy Database Migrations');
    await expect(drawer).toContainText('Amina N.');
    await expect(drawer).toContainText('Nudge and reaction history');
    await expect(drawer).toContainText('Ready to Promise');
    await expect(drawer).toContainText('Trade-off Guardrail');
    await expect(drawer.locator('[data-loop-action="approve-match"]')).toHaveCount(0);
    await expect(drawer.locator('[data-loop-action="send-nudge"]')).toHaveCount(1);
    await expect(drawer.locator('[data-loop-action="amend-contract"]')).toHaveCount(1);
  });

  test('nudge queues one correlated reference and never claims synchronous delivery', async ({ page }) => {
    await mockGovernanceJourney(page);
    await page.goto('/governance');
    await page.locator('[data-loop-primary]').click();
    await page.locator('[data-loop-action="send-nudge"]').click();
    const status = page.locator('.gov-loop-action-status');
    await expect(status).toContainText('Nudge queued with reference DLV-2026-A1B2C3D4');
    await expect(status).not.toContainText('sent successfully');
  });

  test('amendment appends an approved decision while keeping original promise visible', async ({ page }) => {
    await mockGovernanceJourney(page);
    await page.goto('/governance');
    await page.locator('[data-loop-primary]').click();
    const original = page.locator('.gov-loop-drawer-verdict > strong');
    await expect(original).toContainText('Launch the verified customer journey integration');
    await page.locator('[data-loop-action="amend-contract"]').click();
    await page.locator('.gov-loop-amend-form select').selectOption('move-to-next-quarter');
    await page.locator('.gov-loop-amend-form textarea').fill('Business and squad approved movement to Q3.');
    await page.locator('.gov-loop-amend-form input').fill('PI forum 2026-07-17');
    await page.locator('.gov-loop-amend-form button[type="submit"]').click();
    await expect(page.locator('.gov-loop-action-status')).toContainText('Decision recorded without changing the original promise');
    await expect(original).toContainText('Launch the verified customer journey integration');
  });

  test('stale decisions fail closed and preserve the user context', async ({ page }) => {
    test.info().annotations.push({ type: 'allow-http-status-console', description: '412' });
    await mockGovernanceJourney(page, { decisionStatus: 412 });
    await page.goto('/governance');
    await page.locator('[data-loop-primary]').click();
    await page.locator('[data-loop-action="accept-risk"]').click();
    const warning = page.locator('.gov-loop-stale-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('updated by another PI Team user');
    await expect(page.locator('.gov-loop-drawer-verdict')).toContainText('Launch the verified customer journey integration');
  });

  test('mobile viewport preserves action hierarchy and 44px touch targets', async ({ page }) => {
    await mockGovernanceJourney(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    const hero = page.getByTestId('governance-active-loop');
    await expect(hero).toBeVisible({ timeout: 15000 });
    const target = await hero.locator('[data-loop-primary]').boundingBox();
    expect(target?.height || 0).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
