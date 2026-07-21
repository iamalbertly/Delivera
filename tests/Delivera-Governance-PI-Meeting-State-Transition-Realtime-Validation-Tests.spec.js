import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { allowedActionsForPromise, buildDoingInstead, calculateWorkSplit, classifyStoryFreshness } from '../lib/Delivera-Governance-ActiveLoop-01Domain-SSOT.js';
import { projectSquadSprintTruth } from '../lib/Delivera-Governance-Sprint-Reality-01SSOT.js';
import { projectActiveLoopCases } from '../lib/Delivera-Governance-ActiveLoop-02Store-IO.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';

const NOW = new Date('2026-07-17T10:32:00.000Z');
const baseline = (type, label) => ({ state: type === 'missing' ? 'missing' : 'verified', sourceType: type, sourceLabel: label, copy: type === 'missing' ? 'Cannot verify · baseline missing · save baseline to compare.' : `${label} verified 12 Jul.` });
const squad = (key, sourceType, sourceLabel, overrides = {}) => ({
  squad: key, displayName: { DMS: 'M-Pesa Delivery', RPA: 'Robotics Process Automation', AMS: 'AMS', TRS: 'Transformers', OPS: 'Operations Support' }[key] || key,
  promiseCount: 1, attentionCount: key === 'AMS' ? 0 : 1, piPct: sourceType === 'missing' ? null : (key === 'DMS' ? 31 : 78), topState: sourceType === 'missing' ? 'cannot verify' : (key === 'AMS' ? 'aligned' : '1 no-proof promise'), proofState: key === 'AMS' ? 'fresh proof' : 'stale proof',
  baselineCoverage: baseline(sourceType, sourceLabel), sprintReality: { state: 'watch', copy: 'Sprint started 6 days ago. 3 PI-linked items have not moved. 2 items carried over. 1 reopened after Done.' },
  doingInstead: { major: key === 'DMS' ? { title: 'Legacy Database Migration', percentage: 38 } : null, operationalNoise: { ticketCount: 14 }, copy: key === 'DMS' ? 'Major diversion: Legacy Database Migration. Smaller items grouped as operational noise (14).' : 'Operational noise, 14 low-priority tickets.' },
  workSplit: { method: 'ticket-count', piPct: 31, unplannedPct: 38, unknownPct: 31, explanation: 'Calculated by ticket count because time logging is incomplete.', largestUnmappedCluster: key === 'DMS' ? 'Legacy Database Migration' : '' },
  contractState: { label: sourceType === 'missing' ? 'Cannot verify' : (key === 'AMS' ? 'Aligned' : 'Needs attention'), detail: sourceType === 'missing' ? 'Baseline missing.' : 'Compared with saved PI contract.' },
  sprintCadence: { label: 'Sprint active', detail: 'Sprint started 6 days ago.' },
  trustFactor: { level: sourceType === 'missing' ? 'low' : 'limited', label: sourceType === 'missing' ? 'Low trust' : 'Trust limited', reasons: sourceType === 'missing' ? ['Baseline missing'] : ['Proof is stale'] },
  version: 4, nextAction: sourceType === 'missing' ? { id: 'save-baseline', label: 'Save baseline to compare' } : { id: 'recheck-promise', label: 'Re-check this promise' }, ...overrides,
});

const promise = {
  promiseId: 'prm-dms-1', contractId: 'q2-contract', squad: 'DMS', originalText: 'Enable 3-click recharge path', issueKey: 'DMS-42', statusNow: 'In Progress', matchState: 'partly-matched', matchLabel: 'Partly matched', caseState: 'reply-received-ready-to-recheck', version: 4,
  squadDisplayName: 'M-Pesa Delivery', source: 'DMS baseline image', sourceReference: 'Image captured 12 July', proofAge: { state: 'stale', businessDays: 12, copy: 'This work has not moved in 12 business days. Ask the owner if it is blocked or already done.' },
  ownerRoute: { role: 'Squad PO', displayName: 'Irene', accountId: 'irene-1', source: 'settings-product-owner', unresolved: false },
  actionLifecycle: 'Nudge sent 14h ago · reply received 2h ago · owner says links were updated · ready to re-check', nextAction: { id: 'recheck-promise', label: 'Re-check this promise' },
  amendmentSentence: 'Enable 3-click recharge path → moved to next quarter, approved by Irene on 12 Jul because Lipa M-Pesa launch took priority.',
  amendmentHistory: [{ type: 'move-to-next-quarter', reason: 'Lipa M-Pesa launch took priority', approvedBy: 'Irene', approvedAt: '2026-07-12T08:00:00Z' }], actionHistory: [{ type: 'owner-replied', replyExcerpt: 'Links were updated.' }],
  readiness: { copy: 'Ready to promise.' }, tradeOffGuardrail: { copy: 'This request adds 8% more work to the quarter.' },
  allowedActions: [{ id: 'recheck-promise', allowed: true, reason: 'Re-run deterministic match rules only for this promise.' }, { id: 'send-nudge', allowed: true, reason: 'Will send via Squad PO.' }, { id: 'amend-contract', allowed: true, reason: 'Preserves history.' }],
};

const STORY = {
  schemaVersion: 2, presentationContractVersion: 3, buildSha: 'test', compatibilitySchemaVersion: 1, answerId: 'story-v2', answerVersion: 4, missionHeader: 'FY27 Q2 PI contract governance', contract: { id: 'q2-contract', piName: 'FY27 Q2', source: 'approved-portfolio-baselines' },
  scope: { mode: 'all-squads', projects: ['DMS', 'RPA', 'AMS', 'TRS', 'OPS'], expectedSquads: 5, verifiedSquads: 5, piGovernedSquads: 4, excludedOperationalGroups: 1, complete: true, partialProjects: [] },
  answer: '2 squads are not aligned to PI promises. DMS has 1 no-proof promise. RPA has 1 partial match.', sourceLine: 'Compared with FY27 Q2 PI contract · 4 promises checked · last verified 10:32 UTC', deliveraDid: 'Delivera matched the contract to Jira, checked proof age and work split, and prepared 2 safe owner asks.', verifiedAt: NOW.toISOString(), loopCompletion: 25,
  decisionCoverage: { closed: 1, total: 4, preparedOwnerAsks: 2, copy: 'Decision coverage: 1 of 4 gaps closed' },
  lensSummaries: { overall: '2 squads need PI Team attention. Resolve the prepared owner ask first.', rework: 'No high-confidence possible rework is promoted.' },
  squads: [squad('DMS', 'squad-image', 'DMS baseline image'), squad('RPA', 'missing', 'Baseline missing'), squad('AMS', 'full-deck', 'AMS deck source'), squad('TRS', 'manual', 'Transformers manual baseline')],
  excludedOperationalGroups: [{ ...squad('OPS', 'missing', 'Baseline missing'), operatingModel: 'operational-group', operatingModelEvidence: { signals: ['No PI commitments', 'Operational naming pattern'], evidence: { piLinkedCommitmentCount: 0 } } }],
  promises: [{ ...promise, allowedActions: undefined, actionHistory: undefined, amendmentHistory: undefined }], nextDecisionPromiseId: 'prm-dms-1',
};

async function mockMeeting(page, { story = STORY, detailPromises = [promise] } = {}) {
  await page.addInitScript(() => localStorage.clear());
  await routeProjectsCatalog(page);
  await page.route('**/api/governance/active-loop.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(story) }));
  await page.route('**/api/governance/squads/DMS/detail.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schemaVersion: 2, storyVersion: 4, squad: STORY.squads[0], promises: detailPromises, currentWork: [{ title: 'Legacy Database Migration', percentage: 38 }, { title: 'Operational noise', ticketCount: 14 }], sprintReality: STORY.squads[0].sprintReality, workSplit: STORY.squads[0].workSplit }) }));
  await page.route('**/api/governance/cases/prm-dms-1/detail.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schemaVersion: 2, storyVersion: 4, promise, squad: STORY.squads[0] }) }));
  await page.route('**/api/governance-brief.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ projects: STORY.scope.projects, meta: {}, topRisks: [], evidencePack: { rows: [] }, squadInsights: [] }) }));
  await page.route('**/api/boards.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ boards: [], projectErrors: [] }) }));
  await page.route('**/api/quarters-list**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [] }) }));
  for (const pattern of ['**/api/governance/adoption-metrics.json**', '**/api/governance/inbox.json**', '**/api/governance/feedback-summary.json**', '**/api/governance/scope-intelligence.json**']) await page.route(pattern, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
}

test.describe('Meeting-ready governance deterministic policy', () => {
  test('Doing Instead promotes structural demand and groups operational noise', () => {
    const items = [...Array.from({ length: 6 }, (_, i) => ({ id: `pi-${i}`, category: 'pi', summary: 'PI work' })), ...Array.from({ length: 5 }, (_, i) => ({ id: `div-${i}`, category: 'unplanned', epicTitle: 'Legacy Database Migration' })), ...Array.from({ length: 4 }, (_, i) => ({ id: `noise-${i}`, category: 'unplanned', summary: 'Password cleanup task' }))];
    const split = calculateWorkSplit({ activeItems: items }); const result = buildDoingInstead({ activeItems: items, workSplit: split });
    expect(result.major?.title).toBe('Legacy Database Migration'); expect(result.major?.percentage).toBeGreaterThanOrEqual(15); expect(result.operationalNoise.ticketCount).toBe(4);
    const tiny = buildDoingInstead({ activeItems: [{ category: 'unplanned', epicTitle: 'Tiny diversion' }, { category: 'pi' }] }); expect(tiny.major).toBeNull();
  });

  test('freshness and action states are explicit and deterministic', () => {
    expect(classifyStoryFreshness({ verifiedAt: '2026-07-17T10:22:00Z', now: NOW }).state).toBe('calm');
    expect(classifyStoryFreshness({ verifiedAt: '2026-07-17T10:02:00Z', now: NOW }).state).toBe('paused');
    expect(classifyStoryFreshness({ verifiedAt: '2026-07-17T09:02:00Z', now: NOW }).state).toBe('stale');
    expect(classifyStoryFreshness({ verifiedAt: NOW, jiraFailed: true, now: NOW }).state).toBe('failed');
    const cases = projectActiveLoopCases([{ id: 'n1', promiseId: 'p1', type: 'nudge-sent', ts: '2026-07-15T08:00:00Z', nextVersion: 2, payload: { responseDueAt: '2026-07-16T08:00:00Z' } }], { now: NOW });
    expect(cases.p1.state).toBe('escalation-due');
  });

  test('source writes remain pending until source confirmation and retain failure correction', () => {
    const pending = projectActiveLoopCases([{ id: 'w1', promiseId: 'p1', type: 'source-write-queued', ts: NOW.toISOString(), nextVersion: 2, payload: { receiptId: 'r1', idempotencyKey: 'k1', targetSystem: 'jira', targetObject: 'DMS-1' } }], { now: NOW });
    expect(pending.p1.sourceWrites[0].state).toBe('queued');
    expect(pending.p1.state).toBe('needs-attention');
    const failed = projectActiveLoopCases([
      { id: 'w1', promiseId: 'p1', type: 'source-write-queued', ts: NOW.toISOString(), nextVersion: 2, payload: { receiptId: 'r1', idempotencyKey: 'k1', targetSystem: 'jira', targetObject: 'DMS-1' } },
      { id: 'w2', promiseId: 'p1', type: 'source-write-failed', ts: NOW.toISOString(), nextVersion: 3, payload: { receiptId: 'r1', failureReason: 'Required Components field is missing', correctionPath: 'Fix Components and retry.' } },
    ], { now: NOW });
    expect(failed.p1.sourceWrites).toHaveLength(1);
    expect(failed.p1.sourceWrites[0].state).toBe('source-failed');
    expect(failed.p1.sourceWrites[0].correctionPath).toContain('retry');
  });
});

test.describe('Meeting-ready governance browser journey @focused', () => {
  test('Layer 1 owns the first viewport and shows dense per-squad truth', async ({ page }) => {
    await mockMeeting(page, { story: { ...STORY, decisionCoverage: { closed: 0, total: 0, preparedOwnerAsks: 2 } } }); await page.goto('/governance'); const hero = page.getByTestId('governance-active-loop'); await expect(hero).toBeVisible({ timeout: 15000 });
    await expect(hero).toContainText('Portfolio mission'); await expect(hero.locator('[data-story-squad]')).toHaveCount(4); await expect(hero.locator('[data-story-squad="RPA"]')).toContainText('Cannot verify'); await expect(hero.locator('[data-story-squad="RPA"]')).not.toContainText('off-plan');
    await expect(hero.locator('.gov-loop-decision-count')).toContainText('of 4');
    await expect(hero.locator('.gov-story-columns')).toContainText('Squad');
    await expect(hero.locator('.gov-story-columns')).toContainText('Current reality');
    await expect(hero.locator('.gov-story-columns')).toContainText('PI impact');
    await expect(hero.locator('.gov-story-columns')).toContainText('Next move');
    await expect(hero.locator('.gov-story-columns')).not.toContainText('Proof / next');
    await expect(hero.locator('.gov-story-columns')).not.toContainText('Trust factor');
    await expect(hero.locator('[data-story-squad="DMS"]')).toContainText('M-Pesa Delivery'); await expect(hero.locator('[data-story-squad="DMS"]')).not.toContainText('DMS Squad');
    await expect(hero.locator('[data-story-squad="DMS"]')).toContainText('DMS baseline image'); await expect(hero.locator('[data-story-squad="AMS"]')).toContainText('AMS deck source'); await expect(hero.locator('[data-story-squad="TRS"]')).toContainText('Transformers manual baseline');
    await expect(hero.locator('[data-operating-firewall]')).toContainText('Operations Support');
    await expect(page.locator('.gov-portfolio-grid-wrap:visible')).toHaveCount(0); await expect(hero.locator('[data-loop-primary]')).toHaveCount(1);
  });

  test('squad spotlight synchronizes the meeting story and history', async ({ page }) => {
    const repeatedPromise = { ...promise, promiseId: 'prm-dms-2', originalText: 'Confirm recharge receipt copy' };
    await mockMeeting(page, { detailPromises: [promise, repeatedPromise] }); await page.goto('/governance'); await page.locator('[data-story-squad="DMS"]').click();
    await expect(page).toHaveURL(/spotlight=DMS/); const spot = page.locator('#gov-squad-spotlight'); await expect(spot).toContainText('Current Work Reality'); await expect(spot).toContainText('Sprint Reality'); await expect(spot).toContainText('Doing Instead'); await expect(spot).toContainText('Promise Evidence'); await expect(spot).toContainText('Action Trail'); await expect(spot).toContainText('Legacy Database Migration'); await expect(spot).toContainText('Re-check this promise');
    await expect(spot.locator('.gov-action-lifecycle')).toHaveCount(1);
    await expect(spot.locator('.gov-action-lifecycle')).toContainText('2 promises share this state');
    await page.locator('[data-story-all]').click(); await expect(page).not.toHaveURL(/spotlight=/); await expect(spot).toBeEmpty();
  });

  test('verified squad can rebaseline without losing squad scope', async ({ page }) => {
    await mockMeeting(page);
    await page.route('**/api/ai-provider-status.json**', (route) => route.fulfill({ json: { slideVisionReady: true, label: 'server' } }));
    await page.route('**/api/governance/pi-baseline/propose**', (route) => route.fulfill({ json: { method: 'manual', candidates: [] } }));
    await page.goto('/governance');
    await page.locator('[data-story-squad="DMS"]').click();
    const rebaseline = page.locator('[data-rebaseline="1"]');
    await expect(rebaseline).toBeVisible();
    await expect(rebaseline).toHaveAttribute('data-squad', 'DMS');
    await rebaseline.click();
    await expect(page.getByTestId('gov-baseline-context')).toContainText('DMS');
  });

  test('amendment context is visible without opening audit settings', async ({ page }) => {
    await mockMeeting(page); await page.goto('/governance'); await page.locator('[data-story-squad="DMS"]').click(); const spot = page.locator('#gov-squad-spotlight'); await expect(spot).toContainText('Enable 3-click recharge path'); await expect(spot).toContainText('approved by Irene'); await expect(spot).toContainText('Lipa M-Pesa launch took priority');
  });

  test('recipient is explicit and editable before a nudge is queued', async ({ page }) => {
    let sentBody = null; await mockMeeting(page); await page.route('**/api/governance/cases/prm-dms-1/nudges**', async (route) => { sentBody = route.request().postDataJSON(); await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ deliveraRef: 'DLV-2026-MEETING', version: 5 }) }); });
    await page.goto('/governance'); await page.locator('[data-loop-primary]').click(); const drawer = page.locator('.gov-loop-drawer'); await expect(drawer).toContainText('Nudge will go to Squad PO: Irene'); await drawer.locator('[data-recipient-name]').fill('Asha'); await drawer.locator('[data-recipient-role]').fill('Stream Lead'); await drawer.locator('[data-loop-action="send-nudge"]').click(); await expect(drawer.locator('.gov-loop-action-status')).toContainText('DLV-2026-MEETING'); expect(sentBody.recipient.displayName).toBe('Asha'); expect(sentBody.recipient.role).toBe('Stream Lead'); expect(sentBody.saveAsSquadDefault).not.toBe(true);
  });

  test('targeted sync carries only the selected squad scope and joins one job', async ({ page }) => {
    let body = null; await mockMeeting(page);
    await page.route('**/api/governance/refreshes/shared-job', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'completed', jobId: 'shared-job', answerVersion: 5, squadPatch: { ...STORY.squads[0], sprintReality: { state: 'active', sprintName: 'FY27DMS06', copy: 'FY27DMS06 is active, 12 days remaining.' } } }) }));
    await page.route('**/api/governance/refreshes', async (route) => { body = route.request().postDataJSON(); await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ attached: true, jobId: 'shared-job' }) }); });
    await page.goto('/governance'); await page.locator('[data-story-squad="DMS"]').click(); await page.locator('[data-force-squad]').click(); expect(body).toMatchObject({ scopeType: 'squad', scopeId: 'DMS' }); expect(body.scopeType).not.toBe('portfolio'); await expect(page.locator('#gov-squad-spotlight')).toContainText('FY27DMS06 is active');
  });

  test('background evidence waits behind the read lock', async ({ page }) => {
    await mockMeeting(page); await page.goto('/governance'); await page.locator('[data-story-squad="DMS"]').focus();
    const before = await page.locator('[data-story-squad]').allTextContents(); const updated = structuredClone(STORY); updated.answerVersion = 5; updated.squads.reverse();
    await page.evaluate(async (story) => { const mod = await import('/Delivera-App-Governance-ActiveLoop-01UI.js'); mod.renderActiveGovernanceLoop(story); }, updated);
    await expect(page.locator('.gov-story-update')).toBeVisible(); expect(await page.locator('[data-story-squad]').allTextContents()).toEqual(before); await page.locator('[data-story-apply]').click(); await expect(page.locator('[data-story-squad]').first()).toHaveAttribute('data-story-squad', 'TRS'); await expect(page.locator('[data-story-squad]').first()).toContainText('Transformers');
  });

  test('mobile matrix and actions remain touchable', async ({ page }) => {
    await mockMeeting(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/governance'); await expect(page.getByTestId('governance-source-line')).toContainText('FY27 Q2'); const rows = page.locator('[data-story-squad]'); await expect(rows).toHaveCount(4); expect((await rows.first().boundingBox()).height).toBeGreaterThanOrEqual(44); await rows.first().click(); const sync = page.locator('[data-force-squad]'); await expect(sync).toBeVisible(); expect((await sync.boundingBox()).height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('Direct-to-value governance release — exactly five fail-fast scenarios', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/governance/pi-confidence.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ piConfidence: null, piForumAnswer: '', protectMeAnswer: '', cached: true }) }));
    await page.route('**/api/boards.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ boards: [], projectErrors: [] }) }));
  });

  test('release 1 governance truth and first value', async ({ page }) => {
    await mockMeeting(page);
    const started = Date.now();
    await page.goto('/governance');
    const hero = page.getByTestId('governance-active-loop');
    await expect(hero).toBeVisible({ timeout: 2000 });
    expect(Date.now() - started).toBeLessThan(2000);
    await expect(hero).toContainText('2 squads are not aligned');
    await expect(hero.locator('[data-story-squad]')).toHaveCount(4);
    await expect(hero.locator('[data-story-squad="RPA"]')).toContainText('Cannot verify');
    await expect(hero.locator('.gov-story-columns')).toContainText('Current reality');
    await expect(hero.locator('.gov-story-columns')).toContainText('PI impact');
    await expect(hero.locator('.gov-story-columns')).toContainText('Next move');
    await expect(page.locator('#gov-action-clusters-mount:visible')).toHaveCount(0);
    await expect(page.locator('#work-draft-drawer')).toBeHidden();
    await expect(page.locator('#work-draft-drawer')).toHaveAttribute('inert', '');
    await expect(hero.locator('[data-hero-squad="DMS"]')).toBeVisible();
    await hero.locator('[data-hero-squad="DMS"]').click();
    await expect(page).toHaveURL(/spotlight=DMS/);
    await expect(page.locator('#gov-squad-spotlight')).toContainText('Legacy Database Migration');
  });

  test('release 2 sprint SSOT and safe action eligibility', () => {
    const payload = { sprint: { id: 77, name: 'DMS Sprint 14', state: 'active', startDate: '2026-07-17T00:00:00Z', endDate: '2026-07-31T00:00:00Z' }, meta: { generatedAt: NOW.toISOString() }, sprintPulse: { stalled: 3, carryover: 2, reopened: 1 } };
    const currentSprintTruth = projectSquadSprintTruth(payload, { now: NOW });
    const governanceTruth = projectSquadSprintTruth(payload, { now: NOW });
    expect(governanceTruth).toEqual(currentSprintTruth);
    expect(governanceTruth.state).toBe('active');
    expect(governanceTruth.copy).toContain('DMS Sprint 14 is active');
    expect(governanceTruth.payloadHash).toBe(currentSprintTruth.payloadHash);
    expect(governanceTruth.version).toBe(currentSprintTruth.version);
    const actions = allowedActionsForPromise({ matchState: 'partly-matched', issueKey: 'DMS-42', caseState: 'reply-received-ready-to-recheck', proofAge: { state: 'stale' }, ownerRoute: promise.ownerRoute }, { hasBaseline: true, jiraAvailable: false, restrictFreshActions: true });
    expect(actions.find((item) => item.id === 'send-nudge').allowed).toBe(false);
    expect(actions.find((item) => item.id === 'recheck-promise').allowed).toBe(false);
    expect(actions.find((item) => item.id === 'assign-owner').allowed).toBe(false);
    const overdue = projectActiveLoopCases([{ id: 'legacy-nudge', promiseId: 'prm-overdue', type: 'nudge-sent', ts: '2026-07-15T08:00:00.000Z', payload: {} }], { now: NOW });
    expect(overdue['prm-overdue'].state).toBe('escalation-due');
  });

  test('release 3 Actions renders the shared visible queue', async ({ page }) => {
    await page.route('**/api/governance/actions.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schemaVersion: 2, storyVersion: 4, cases: [{ promiseId: promise.promiseId, squad: promise.squad, squadDisplayName: promise.squadDisplayName, title: promise.originalText, state: promise.caseState, lifecycle: promise.actionLifecycle, ownerRoute: promise.ownerRoute, nextAction: promise.nextAction, version: 4 }] }) }));
    await page.route('**/api/governance/cases/prm-dms-1/detail.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schemaVersion: 2, storyVersion: 4, promise, squad: STORY.squads[0] }) }));
    await page.goto('/actions');
    await expect(page).toHaveURL(/\/actions$/);
    await expect(page.locator('[data-action-case="prm-dms-1"]')).toContainText('ready to re-check');
    await expect(page.locator('[data-action-case="prm-dms-1"] button')).toHaveText('Re-check this promise');
  });

  test('Actions groups repeated unresolved owner corrections by squad', async ({ page }) => {
    const unresolved = { role: 'PI Team queue', displayName: '', unresolved: true };
    const cases = ['prm-dms-1', 'prm-dms-2'].map((promiseId, index) => ({
      promiseId, squad: 'DMS', squadDisplayName: 'M-Pesa Delivery', title: `Promise ${index + 1}`,
      state: 'needs-attention', lifecycle: 'No governance action has been sent yet.', ownerRoute: unresolved,
      nextAction: { label: 'Owner route missing · resolve in drawer' },
    }));
    await page.route('**/api/governance/actions.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cases }) }));
    await page.goto('/actions');
    await expect(page.locator('[data-action-case]')).toHaveCount(1);
    await expect(page.locator('[data-action-case]')).toContainText('2 promises share this correction');
  });

  test('release 4 Settings persists versioned organization truth and preserves conflict drafts', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'allow-http-status-console', description: '412' });
    const registry = { version: 7, squads: [
      { squadKey: 'SD', friendlyName: 'DMS Squad', participationState: 'pi-governed', boardMapping: [12], productOwner: { displayName: 'Irene' }, scrumMaster: null, streamLead: null },
      { squadKey: 'RPA', friendlyName: 'Robotics Process Automation', participationState: 'pending-consent', boardMapping: [], productOwner: null, scrumMaster: null, streamLead: null },
    ] };
    let patchBody = null;
    await page.route('**/api/governance/registry.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(registry) }));
    await page.route('**/api/governance/registry', async (route) => { patchBody = route.request().postDataJSON(); await route.fulfill({ status: 412, contentType: 'application/json', body: JSON.stringify({ error: 'Organization settings changed while you were editing.' }) }); });
    await page.route('**/api/settings/ai-usage.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ totalCalls: 0, fallbackCalls: 0 }) }));
    await page.route('**/api/jira-activity**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [] }) }));
    await page.route('**/api/governance-brief.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ projects: ['SD'], squadInsights: [], meta: {} }) }));
    await page.route('**/api/leadership-summary.json**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto('/settings');
    const row = page.locator('[data-registry-squad="SD"]');
    await expect(row).toBeVisible();
    await page.locator('[data-registry-filter]').fill('Robotics');
    await expect(row).toBeHidden();
    await expect(page.locator('[data-registry-squad="RPA"]')).toBeVisible();
    await page.locator('[data-registry-filter]').fill('');
    await expect(row.locator('[type="submit"]')).toBeDisabled();
    await row.locator('[data-registry-edit]').click();
    await row.locator('[name="participationState"]').selectOption('pending-consent');
    await row.locator('[name="reason"]').fill('Squad onboarding consent is pending');
    await row.locator('[type="submit"]').click();
    await expect(row.locator('[data-registry-status]')).toContainText('changed while you were editing');
    await expect(row.locator('[name="reason"]')).toHaveValue('Squad onboarding consent is pending');
    expect(patchBody.reason).toBe('Squad onboarding consent is pending');
    expect(patchBody.changes[0]).toMatchObject({ squadKey: 'SD', patch: { participationState: 'pending-consent' } });
  });

  test('release 5 continuity degradation and realtime safety', async ({ page }) => {
    await mockMeeting(page);
    await page.goto('/governance?view=evidence&spotlight=DMS');
    await expect(page.locator('#gov-squad-spotlight')).toContainText('M-Pesa Delivery');
    await page.locator('[data-story-squad="DMS"]').focus();
    const before = await page.locator('[data-story-squad]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-story-squad')));
    const updated = structuredClone(STORY); updated.answerVersion = 5; updated.squads.reverse();
    await page.evaluate(async (story) => { const module = await import('/Delivera-App-Governance-ActiveLoop-01UI.js'); module.renderActiveGovernanceLoop(story); }, updated);
    await expect(page.locator('.gov-story-update')).toBeVisible();
    expect(await page.locator('[data-story-squad]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-story-squad')))).toEqual(before);
    await expect(page).toHaveURL(/view=evidence/);
    await expect(page).toHaveURL(/spotlight=DMS/);
  });
});
