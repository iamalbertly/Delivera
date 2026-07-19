import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { buildDeliveryTruthContext, assertTruthConsistency } from '../lib/Delivera-Governance-Delivery-Truth-01SSOT.js';
import { governanceBriefCacheKey, governanceStoryCacheKey } from '../lib/Delivera-Governance-Story-Cache-01SSOT.js';

const now = new Date().toISOString();

function promise({ promiseId, squad, issueKey, title }) {
  return {
    promiseId, squad, squadDisplayName: squad === 'SD' ? 'DMS Squad' : 'Finance Squad', issueKey,
    originalText: title, matchState: 'no-jira-proof', matchLabel: 'No Jira proof', caseState: 'needs-attention',
    actionLifecycle: 'Review missing proof', version: 2, contractId: 'fy27-q2',
    proofAge: { state: 'aging', copy: 'Evidence has not moved in 7 business days.' },
    ownerRoute: { displayName: squad === 'SD' ? 'DMS Product Owner' : 'Finance Product Owner', role: 'Product Owner', unresolved: false },
    nextAction: { id: 'send-nudge', label: 'Review missing proof', dueState: 'today' },
    allowedActions: [{ id: 'send-nudge', allowed: true, reason: 'Verified owner route.' }], actionHistory: [], amendmentHistory: [],
  };
}

function squad(squadId, displayName, sprintName) {
  return {
    squad: squadId, displayName, riskOrder: squadId === 'SD' ? 1 : 2, payloadHash: `hash-${squadId}`,
    attentionCount: 1, topState: 'no-jira-proof', proofState: 'aging',
    contractState: { label: '1 proof gap', detail: 'Approved PI commitment needs Jira evidence.' },
    trustFactor: { label: 'Limited, evidence aging', level: 'limited' },
    baselineCoverage: { state: 'verified', sourceLabel: 'FY27 Q2 contract', copy: 'Approved baseline verified.' },
    sprintReality: { state: 'active', sprint: { id: squadId === 'SD' ? 42 : 77, name: sprintName, state: 'active' }, sprintName, daysRemaining: 6, copy: `${sprintName} is active in Jira.` },
    workSplit: { method: 'ticket-count', percentages: { pi: 70, support: 10, unplanned: 10, unknown: 10 }, explanation: 'Calculated from active Jira work using one denominator.' },
    unknownWork: { promoted: false }, possibleRework: { promoted: null, copy: 'No evidence-backed rework signal.' },
    doingInstead: { copy: 'No major diversion proven.', clusters: [] },
    nextAction: { label: 'Review missing proof' }, currentWork: [{ title: `${displayName} active work`, themeId: `${squadId}-work` }],
  };
}

function activeAnswer() {
  const squads = [squad('SD', 'DMS Squad', 'FY27DMS06'), squad('RPA', 'Finance Squad', 'Finance Sprint 8')];
  const promises = [
    promise({ promiseId: 'promise-dms', squad: 'SD', issueKey: 'SD-5310', title: 'DMS consent journey' }),
    promise({ promiseId: 'promise-finance', squad: 'RPA', issueKey: 'RPA-88', title: 'Finance launch' }),
  ];
  return {
    schemaVersion: 2, presentationContractVersion: 3, answerVersion: 7, missionHeader: 'Protect FY27 Q2 commitments',
    answer: 'Two squads need one evidence decision each.', sourceLine: 'Compared with FY27 Q2 PI contract · 2 promises checked · verified now',
    deliveraDid: 'Delivera reconciled Jira sprint truth and prepared the safest owner asks.', verifiedAt: now, evidenceObservedAt: now,
    freshness: { state: 'live' }, contract: { id: 'fy27-q2', piName: 'FY27 Q2', source: 'approved-baseline' },
    scope: { projects: ['SD', 'RPA'], expectedSquads: 2, verifiedSquads: 2, complete: true },
    decisionCoverage: { closed: 0, total: 2, preparedOwnerAsks: 2 }, nextDecisionPromiseId: 'promise-finance',
    lensSummaries: { overall: 'DMS is the highest decision priority.' }, excludedOperationalGroups: [], squads, promises,
  };
}

function detailFor(squadId) {
  const answer = activeAnswer();
  const found = answer.squads.find((item) => item.squad === squadId);
  return { schemaVersion: 3, storyVersion: 7, context: { squadId }, squad: found, promises: answer.promises.filter((item) => item.squad === squadId), currentWork: found.currentWork, sprintReality: found.sprintReality, workSplit: found.workSplit };
}

async function mockGovernance(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body = {};
    if (path === '/api/governance/active-loop.json') body = activeAnswer();
    else if (path.includes('/api/governance/squads/SD/detail.json')) body = detailFor('SD');
    else if (path.includes('/api/governance/squads/RPA/detail.json')) body = detailFor('RPA');
    else if (path.includes('/api/governance/cases/')) {
      const p = activeAnswer().promises.find((item) => path.includes(item.promiseId)) || activeAnswer().promises[0];
      body = { schemaVersion: 2, storyVersion: 7, promise: p, squad: activeAnswer().squads.find((item) => item.squad === p.squad) };
    } else if (path === '/api/governance-brief.json') body = { briefId: 'trust-recovery', projects: ['SD', 'RPA'], generatedAt: now, freshness: { confidenceLimit: 'live' }, deliveryTruth: { committed: 2, done: 0 }, executiveView: { verdictTier: 'watch' }, leadershipNarrative: { meetingAnswer: 'Two decisions need attention.' }, meta: { safeToSend: true, partialProjects: [], boardEpicIndex: [] }, evidencePack: { rows: [] }, topRisks: [], squadInsights: [] };
    else if (path === '/api/projects-catalog.json') body = { projects: [{ key: 'SD', label: 'DMS Squad', accessible: true }, { key: 'RPA', label: 'Finance Squad', accessible: true }] };
    else if (path === '/api/quarters-list') body = { quarters: [{ label: 'FY27 Q2', isCurrent: true }] };
    else if (path === '/api/boards.json') body = { boards: [{ id: 1, projectKey: 'SD' }, { id: 2, projectKey: 'RPA' }], projectErrors: [] };
    else if (path === '/api/governance/inbox.json') body = { briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], poReadiness: [], total: 0 };
    else if (path === '/api/governance/feedback-summary.json' || path === '/api/governance/adoption-metrics.json') body = { total: 0, byMetric: {} };
    else if (path === '/api/ai-provider-status.json') body = { configured: false, effectiveMode: 'deterministic' };
    else if (path === '/api/session-meta.json') body = { authenticated: true, initials: 'DL' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test.describe('Governance trust recovery master plan @focused', () => {
  test('1 canonical truth is stable and cache scope is order-independent', async () => {
    const registry = { version: 4, squads: [{ squadKey: 'SD', friendlyName: 'DMS Squad', revision: 3, participationState: 'pi-governed' }] };
    const context = buildDeliveryTruthContext({ squad: squad('SD', 'DMS Squad', 'FY27DMS06'), registry, projectKeys: ['SD'] });
    expect(context).toMatchObject({ squadId: 'SD', squadName: 'DMS Squad', sprintName: 'FY27DMS06', registryVersion: 4, squadRevision: 3 });
    expect(assertTruthConsistency([context])).toHaveLength(1);
    expect(governanceBriefCacheKey(['RPA', 'SD'])).toBe(governanceBriefCacheKey(['SD', 'RPA']));
    expect(governanceStoryCacheKey(['RPA', 'SD'], 'FY27 Q2')).toBe(governanceStoryCacheKey(['SD', 'RPA'], 'FY27 Q2'));
  });

  test('2 governance first viewport has four truth columns and three views', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page); await mockGovernance(page);
    await page.goto('/governance?projects=SD,RPA');
    await expect(page.getByTestId('governance-active-loop')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.gov-story-columns > span')).toHaveCount(4);
    await expect(page.locator('[data-story-lens]')).toHaveCount(3);
    await expect(page.locator('.gov-story-columns')).not.toContainText(/Proof Age|Trust Basis/i);
    await expect(page.locator('[data-governance-diagnostics]')).toHaveText('Diagnostics');
    assertTelemetryClean(telemetry);
  });

  test('3 selected DMS context controls detail and primary decision', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page); await mockGovernance(page);
    let detailQuery = '';
    page.on('request', (request) => { if (request.url().includes('/squads/SD/detail.json')) detailQuery = request.url(); });
    await page.goto('/governance?projects=SD,RPA');
    await page.locator('[data-story-squad="SD"]').click();
    await expect(page).toHaveURL(/spotlight=SD/);
    await expect(page.locator('#gov-squad-spotlight')).toContainText('FY27DMS06');
    expect(detailQuery).toMatch(/projects=SD/); expect(detailQuery).not.toMatch(/projects=SD%2CRPA/);
    await page.locator('[data-loop-primary]').click();
    await expect(page.locator('.gov-right-drawer-panel')).toContainText('DMS consent journey');
    await expect(page.locator('.gov-right-drawer-panel')).not.toContainText('Finance launch');
    assertTelemetryClean(telemetry);
  });

  test('4 global Actions navigation preserves selected squad', async ({ page }) => {
    await mockGovernance(page);
    await page.goto('/governance?projects=SD,RPA&spotlight=SD');
    await expect(page.getByTestId('governance-active-loop')).toBeVisible({ timeout: 20000 });
    await page.locator('[data-top-action="agent"]').click();
    await expect(page).toHaveURL(/\/actions\?squad=SD&source=governance/);
  });

  test('5 actions queue remains squad-isolated and deep-links to evidence', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    let requested = '';
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url()); requested = url.pathname === '/api/governance/actions.json' ? url.search : requested;
      const body = url.pathname === '/api/governance/actions.json' ? { schemaVersion: 3, cases: [{ ...promise({ promiseId: 'promise-dms', squad: 'SD', issueKey: 'SD-5310', title: 'DMS consent journey' }), squadId: 'SD', groupKey: 'SD|review|SD-5310|today', actionType: 'review', sourceEntityId: 'SD-5310', dueState: 'today', detailHref: '/api/governance/cases/promise-dms/detail.json?projects=SD' }] } : {};
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto('/actions?squad=SD');
    await expect(page.locator('[data-action-case]')).toHaveCount(1);
    await expect(page.locator('[data-action-case]')).toContainText('DMS Squad · SD-5310');
    await expect(page.locator('.action-case-source')).toHaveAttribute('href', /spotlight=SD/);
    expect(requested).toContain('squad=SD'); assertTelemetryClean(telemetry);
  });

  test('6 settings applies pending squads as one reasoned atomic update', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    const squads = ['SD', 'RPA', 'AMS'].map((key, index) => ({ squadKey: key, friendlyName: key === 'SD' ? 'DMS Squad' : key, participationState: index < 2 ? 'pending-consent' : 'pi-governed', revision: 1, suggestions: { people: [], boardMapping: [] } }));
    let submitted = null;
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/governance/registry' && route.request().method() === 'PATCH') {
        submitted = route.request().postDataJSON();
        const updated = squads.map((item) => submitted.changes.some((change) => change.squadKey === item.squadKey) ? { ...item, participationState: 'pi-governed', revision: 2 } : item);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 2, squads: updated, auditHistory: [], receipt: { id: 'receipt-1' } }) });
      }
      const body = url.pathname === '/api/governance/registry.json' ? { version: 1, squads, auditHistory: [] } : {};
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto('/settings');
    await page.locator('[data-select-pending]').click();
    await page.locator('[data-bulk-participation]').selectOption('pi-governed');
    await page.locator('[data-bulk-reason]').fill('Consent confirmed by portfolio governance.');
    await page.locator('[data-bulk-preview]').click();
    await expect.poll(() => submitted?.changes?.length || 0).toBe(2);
    expect(submitted.reason).toContain('Consent confirmed');
    await expect(page.locator('[data-bulk-status]')).toContainText('2 squads updated');
    assertTelemetryClean(telemetry);
  });

  test('7 settings dirty state disables save after a reverted edit', async ({ page }) => {
    await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(new URL(route.request().url()).pathname === '/api/governance/registry.json' ? { version: 1, auditHistory: [], squads: [{ squadKey: 'SD', friendlyName: 'DMS Squad', participationState: 'pi-governed', revision: 1, suggestions: { people: [{ displayName: 'DMS PO', evidence: 'Jira', confidence: 'observed' }], boardMapping: [] } }] } : {}) }));
    await page.goto('/settings');
    const form = page.locator('[data-registry-squad="SD"]');
    await form.locator('[data-registry-edit]').click();
    await form.locator('[name="participationState"]').selectOption('pending-consent');
    await form.locator('[name="reason"]').fill('Testing a reversible draft.');
    await expect(form.locator('[type="submit"]')).toBeEnabled();
    await form.locator('[name="participationState"]').selectOption('pi-governed');
    await expect(form.locator('[type="submit"]')).toBeDisabled();
    await expect(form.locator('[data-registry-status]')).toContainText('No unsaved change');
  });

  test('8 exact sprint intervention identity and mobile accessibility stay clean', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page); await mockGovernance(page);
    await page.goto('/governance?projects=SD,RPA');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('governance-active-loop')).toBeVisible({ timeout: 20000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact))).toEqual([]);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(async () => {
      document.body.className = 'current-sprint-page';
      const data = { board: { id: 1, name: 'DMS board', projectKeys: ['SD'] }, sprint: { id: 42, name: 'FY27DMS06', state: 'active' }, summary: { totalStories: 2, doneStories: 0, percentDone: 0 }, daysMeta: { daysRemainingWorking: 6 }, stories: [{ issueKey: 'SD-5304', summary: 'Other issue', status: 'In Progress' }, { issueKey: 'SD-5310', summary: 'Bound blocker', status: 'Blocked' }], stuckCandidates: [{ issueKey: 'SD-5310', summary: 'Bound blocker', status: 'Blocked' }], meta: { projects: 'SD' } };
      window.__deliveraCurrentSprintPayload = data;
      const mod = await import('/Delivera-CurrentSprint-Header-Bar.js');
      document.body.innerHTML = `<main id="current-sprint-content">${mod.renderHeaderBar(data)}<table id="stories-table"><tbody><tr data-issue-key="SD-5304"><td><a href="https://jira.example/browse/SD-5304">SD-5304</a></td><td class="story-summary-cell">Other issue</td><td class="story-status-cell">In Progress</td></tr><tr data-issue-key="SD-5310" data-risk-tags="blocker"><td><a href="https://jira.example/browse/SD-5310">SD-5310</a></td><td class="story-summary-cell">Bound blocker</td><td class="story-status-cell">Blocked</td></tr></tbody></table></main>`;
      mod.wireHeaderBarHandlers();
    });
    await expect(page.locator('[data-header-action="focus-remediation"]')).toHaveAttribute('data-issue-key', 'SD-5310');
    await page.locator('[data-header-action="focus-remediation"]').dispatchEvent('click');
    await expect(page.locator('#delivera-jira-nudge-review-sheet')).toContainText('SD-5310');
    await expect(page.locator('#delivera-jira-nudge-review-sheet')).not.toContainText('SD-5304');
    assertTelemetryClean(telemetry);
  });
});
