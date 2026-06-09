import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import { captureBrowserTelemetry, assertTelemetryClean } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import {
  buildCommandAnswerSentence,
  buildWorkerReceipt,
  buildSetupGaps,
  computeSinceLastRun,
} from '../lib/Delivera-Governance-Worker-03Receipt-SSOT.js';
import { groupDoNowByOwner } from '../public/Delivera-App-Governance-Brief-06Surface-Dedupe-SSOT.js';
import { buildSquadInsight } from '../lib/Delivera-Governance-Executive-01View-SSOT.js';

const COMMAND_BRIEF = {
  briefId: 'MPSA-Q1',
  generatedAt: new Date().toISOString(),
  projects: ['MPSA', 'MAS'],
  freshness: { confidenceLimit: 'live', cacheAgeMinutes: 0 },
  deliveryTruth: { committed: 3, done: 1, staleInProgress: 2, blocked: 1 },
  executiveView: {
    verdictTier: 'blocked',
    verdictLine: 'DELIVERY BLOCKED — two stale items need decisions today.',
    businessHeadline: 'Stale work blocking sprint close',
  },
  leadershipNarrative: {
    meetingAnswer: 'DELIVERY BLOCKED — two stale items need decisions today.',
    narratedBy: 'template',
  },
  topRisks: [
    {
      issueKey: 'MPSA-2', assigneeName: 'Amani', decisionNeededFrom: 'Tech Lead',
      recommendedAction: 'Confirm blocker', ageHours: 96, evidence: 'status unchanged 96h',
      escalation: 'escalate', displayTitle: 'Stuck item', summary: 'Stuck',
    },
    {
      issueKey: 'MPSA-4', assigneeName: 'Amani', decisionNeededFrom: 'Tech Lead',
      recommendedAction: 'Confirm blocker', ageHours: 100, evidence: 'status unchanged',
      escalation: 'escalate', displayTitle: 'Another stuck', summary: 'Another',
    },
    {
      issueKey: 'MPSA-9', assigneeName: 'Bob', decisionNeededFrom: 'Scrum Master',
      recommendedAction: 'Review dependency', ageHours: 30, evidence: 'depends-on-MAS',
      escalation: 'act-today', displayTitle: 'Dependency', summary: 'Dep',
    },
  ],
  portfolioRisks: [{ riskType: 'no-active-sprint', squad: 'RPA', displayTitle: 'No sprint' }],
  squadInsights: [
    { projectKey: 'MPSA', verdictTier: 'blocked', boardResolved: true, hidePulseBar: false, healthSignals: { sprintSetup: 'ok' } },
    { projectKey: 'RPA', verdictTier: 'watch', boardResolved: true, hidePulseBar: true, healthSignals: { sprintSetup: 'limited' } },
  ],
  portfolioRollup: { summaryLine: '2 squads need attention' },
  evidencePack: {
    rows: [
      { issueKey: 'MPSA-2', changelogAvailable: true, whyFlagged: 'stale' },
      { issueKey: 'MPSA-4', changelogAvailable: true, whyFlagged: 'stale' },
    ],
  },
  meta: {
    narratedBy: 'template',
    safeToSend: true,
    commandAnswerSentence: 'DELIVERY BLOCKED — two stale items need decisions today.',
    workerReceipt: { line: 'Last run: 2m ago · Checked: Jira, sprint, evidence · Prepared: 1 brief, 2 nudges · Needs: pi baseline' },
    setupGaps: [{ id: 'pi-baseline', action: 'set-baseline', severity: 'high' }],
    sinceLastRun: { summary: 'Since last brief: +1 blocker, MPSA-2 unchanged' },
  },
};

async function mockCommandSurfacePage(page) {
  await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'MPSA,MAS'); });
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(COMMAND_BRIEF),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [{ label: 'Q1 FY27', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ byMetric: {}, total: 0 }),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      briefs: [{ id: 'b1', type: 'brief', summary: 'Ready', safeToSend: true, approvalRequired: false, createdAt: new Date().toISOString() }],
      nudges: [{ id: 'n1', type: 'nudge', summary: 'Nudge', safeToSend: true, approvalRequired: true, createdAt: new Date().toISOString() }],
      piDrift: [], confirm: [], impact: [], total: 2,
    }),
  }));
  await page.route('**/api/leadership-summary.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ velocity: { source: 'unavailable' } }),
  }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ projects: ['MPSA', 'MAS'], boards: [{ id: 1, projectKey: 'MPSA' }, { id: 2, projectKey: 'MAS' }], projectErrors: [] }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, agents: [], lastImprovements: [] }),
  }));
}

test.describe('Governance command surface — unit', () => {
  test('buildCommandAnswerSentence uses verdict line', () => {
    const s = buildCommandAnswerSentence(COMMAND_BRIEF);
    expect(s).toContain('DELIVERY BLOCKED');
  });

  test('buildWorkerReceipt includes prepared counts', async () => {
    const r = await buildWorkerReceipt(COMMAND_BRIEF, { briefs: [{ id: '1' }], nudges: [{ id: '2' }, { id: '3' }] }, []);
    expect(r.line).toMatch(/Prepared: 1 brief, 2 nudges/);
  });

  test('groupDoNowByOwner groups Amani issues', () => {
    const groups = groupDoNowByOwner(COMMAND_BRIEF.topRisks);
    const amani = groups.find((g) => /amani/i.test(g.assigneeName));
    expect(amani?.issues?.length).toBe(2);
  });

  test('squad health avoids healthy copy when no active sprint', () => {
    const payload = {
      board: { name: 'RPA board' },
      sprint: { state: 'closed' },
      meta: { activeSprintCount: 0 },
      stories: [],
      stuckCandidates: [],
    };
    const squad = buildSquadInsight('RPA', [{ payload }], {
      freshness: { confidenceLimit: 'live' },
      topRisks: [{ riskType: 'no-active-sprint', squad: 'RPA' }],
      portfolioRisks: [],
    }, {});
    expect(squad.productivityLine).toMatch(/no active sprint/i);
    expect(squad.healthSignals?.sprintSetup).toBe('limited');
  });

  test('computeSinceLastRun reports deltas', () => {
    const delta = computeSinceLastRun(COMMAND_BRIEF, {
      outputs: { snapshot: { blockers: 0, stale: 1, topIssueKey: 'MPSA-2' } },
    });
    expect(delta?.summary).toMatch(/Since last brief/);
  });

  test('buildSetupGaps flags PI baseline and AI key', () => {
    const gaps = buildSetupGaps({ portfolioRisks: [{ riskType: 'no-active-sprint' }] }, { aiKeyConfigured: false });
    expect(gaps.some((g) => g.id === 'pi-baseline')).toBe(true);
    expect(gaps.some((g) => g.id === 'ai-key')).toBe(true);
  });
});

test.describe('Governance command surface — UI', () => {
  test('command answer bar visible with hero squad layout', async ({ page }) => {
    await mockCommandSurfacePage(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    const telemetry = await captureBrowserTelemetry(page);
    await expect(page.locator('.gov-command-answer')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#gov-verdict-mount[data-hero-squad="true"], .gov-scope-status-chip').first()).toBeVisible();
    await expect(page.locator('.gov-scope-status-chip, .gov-answer-block--status').first()).toContainText(/Blocked|DELIVERY BLOCKED|✕/i);
    assertTelemetryClean(telemetry);
  });

  test('worker receipt rail shows agent line', async ({ page }) => {
    await mockCommandSurfacePage(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('.gov-worker-receipt-line')).toContainText(/Last run/i);
  });

  test('queue chips open drawer not inline panel', async ({ page }) => {
    await mockCommandSurfacePage(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('#gov-inbox-toggle')).toHaveCount(0);
    await page.locator('[data-queue-open]').click();
    await expect(page.locator('.gov-right-drawer-panel')).toBeVisible();
    await expect(page.locator('.gov-inbox-panel')).toHaveCount(0);
  });

  test('scope capsule shows squad count on desktop expanded scope', async ({ page }) => {
    await mockCommandSurfacePage(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('.gov-scope-capsule-text')).toContainText(/squad/i);
    await expect(page.locator('#gov-scope-expanded[data-scope-expanded-visible="1"]')).toBeVisible();
  });

  test('portfolio heat tiles without pulse bars by default', async ({ page }) => {
    await mockCommandSurfacePage(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('.gov-heat-tile')).toHaveCount(2);
    await expect(page.locator('.gov-pulse-bars-wrap:visible')).toHaveCount(0);
  });

  test('owner cluster groups Amani once', async ({ page }) => {
    await mockCommandSurfacePage(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('.gov-owner-cluster')).toHaveCount(2);
    await expect(page.locator('.gov-owner-cluster-name').filter({ hasText: /Amani/ })).toHaveCount(1);
    await expect(page.locator('.gov-cluster-nudge-primary')).toHaveCount(2);
    await expect(page.locator('[data-grouped-nudge="0"]')).toContainText(/Draft nudge/i);
    await expect(page.locator('#gov-issues-drawer-mount')).toHaveCount(0);
  });

  test('proof chip uses right-rail SSOT when preview mounted', async ({ page }) => {
    await mockCommandSurfacePage(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await page.locator('[data-proof-cluster="0"]').click();
    const railPreview = page.locator('#gov-right-rail-proof-mount .gov-evidence-preview');
    if (await railPreview.count() > 0) {
      await expect(railPreview).toBeVisible();
    } else {
      await expect(page.locator('.gov-right-drawer-title')).toContainText(/Evidence/i);
    }
  });

  test('setup debt strip shows PI gap', async ({ page }) => {
    await mockCommandSurfacePage(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('.gov-setup-debt--compact')).toBeVisible();
    const expand = page.locator('#gov-setup-gaps-expand');
    if (await expand.count()) await expand.click();
    await expect(page.locator('.gov-fix-card-btn[data-setup-action="set-baseline"]')).toBeVisible();
    await expect(page.locator('.gov-fix-card-btn[data-setup-action="set-baseline"]')).toContainText(/Confirm promised work/i);
  });

  test('safe send blocked until promised work saved', async ({ page }) => {
    await mockCommandSurfacePage(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    const badge = page.locator('.gov-command-answer .gov-send-badge');
    await expect(badge.first()).toContainText(/Fix promised work first/i);
    await expect(badge).not.toContainText(/Safe to send/i);
  });

  test('setup compact expand does not duplicate fix card rows', async ({ page }) => {
    await mockCommandSurfacePage(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('#gov-setup-debt-mount .gov-fix-card')).toHaveCount(1);
    const expand = page.locator('#gov-setup-gaps-expand');
    if (await expand.count()) {
      await expand.click();
      await expect(expand).toHaveCount(0);
    }
    await expect(page.locator('#gov-setup-debt-mount .gov-fix-card-row')).toHaveCount(1);
  });

  test('cluster issue without issueUrl uses preview key link only', async ({ page }) => {
    const noUrl = {
      ...COMMAND_BRIEF,
      projects: ['MPSA'],
      topRisks: [{
        issueKey: 'MPSA-7', assigneeName: 'Sam', decisionNeededFrom: 'Tech Lead',
        recommendedAction: 'Unblock', ageHours: 40, escalation: 'act-today',
        displayTitle: 'No URL risk', summary: 'No URL',
      }],
    };
    await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'MPSA'); });
    await routeProjectsCatalog(page);
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(noUrl),
    }));
    await page.route('**/api/quarters-list**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [{ label: 'Q1', isCurrent: true }] }),
    }));
    await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
    }));
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [] }),
    }));
    await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
    }));
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('#gov-action-clusters-mount .gov-owner-cluster')).toBeVisible({ timeout: 15000 });
    const toggle = page.locator('[data-cluster-toggle="0"]');
    if (await toggle.count()) await toggle.click();
    const keyLink = page.locator('.gov-cluster-issue-key.gov-issue-key-link, .gov-owner-cluster .gov-issue-key-link').first();
    await expect(keyLink).toBeVisible();
    await expect(keyLink).toHaveAttribute('href', '/current-sprint?issue=MPSA-7');
    await expect(page.locator('.gov-cluster-issue a[href^="http"]')).toHaveCount(0);
  });

  test('send readiness badge when stale brief', async ({ page }) => {
    const stale = { ...COMMAND_BRIEF, freshness: { confidenceLimit: 'stale', cacheAgeMinutes: 120 }, meta: { ...COMMAND_BRIEF.meta, safeToSend: false } };
    await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'MPSA,MAS'); });
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stale) }));
    await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [] }) }));
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], total: 0 }) }));
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('.gov-send-badge--stale').first()).toContainText(/Stale/i);
  });

  test('settings AI helper when key missing', async ({ page }) => {
    await page.route('**/api/ai-provider-status.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ configured: false, slideVisionReady: false, label: 'Templates' }),
    }));
    await page.route('**/api/settings/ai-usage.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ totalCalls: 0, fallbacks: 0 }),
    }));
    await page.goto('/settings');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('#gov-ai-helper')).toBeVisible();
    await expect(page.locator('#gov-ai-helper')).toContainText(/Browser override|Built-in \(no key\)/i);
  });

  test('copy answer inline works', async ({ page, context }) => {
    await mockCommandSurfacePage(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await page.locator('#gov-copy-answer-inline').click();
    await expect(page.locator('#gov-copy-answer-inline')).toContainText(/Copied/i);
  });
});
