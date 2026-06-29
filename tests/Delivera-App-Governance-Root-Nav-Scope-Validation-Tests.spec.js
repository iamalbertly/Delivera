import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { waitForGovernanceReady } from './Delivera-Portfolio-Primary-Test-Helpers.js';

const MOCK_BRIEF = {
  briefId: 'MPSA-MAS-Q1-2026-W23',
  projects: ['MPSA'],
  generatedAt: new Date().toISOString(),
  freshness: { confidenceLimit: 'live', jiraFetchedAt: new Date().toISOString() },
  portfolio: 'MPSA + MAS',
  deliveryTruth: { committed: 2, done: 1, staleInProgress: 0, blocked: 0, lateAdded: 0 },
  topRisks: [{
    issueKey: 'MPSA-2', squad: 'MPSA', audience: 'delivery', riskType: 'stale-in-progress', riskLabel: 'Stale',
    displayTitle: 'Stale work', evidence: '60h', decisionNeededFrom: 'Tech Lead', recommendedAction: 'Ping owner', ruleFired: 'stale-in-progress',
  }],
  portfolioRisks: [],
  evidencePack: { rows: [] },
  executiveView: {
    verdictTier: 'watch', verdictLabel: 'NEEDS WATCH', businessHeadline: 'Test headline',
    sprintPulse: { done: 1, committed: 2, pct: 50 },
  },
  leadershipNarrative: {
    confidence: 'medium', headline: 'Test headline', oneParagraph: 'Test paragraph.',
    meetingAnswer: 'NEEDS WATCH. Test headline',
    decisionsNeeded: [{ issueKey: 'MPSA-2', decisionNeededFrom: 'Tech Lead', action: 'Ping', riskLabel: 'Stale' }],
  },
  meta: { narratedBy: 'template' },
};

const CATALOG_KEYS = ['MPSA', 'MAS', 'RPA', 'MVA', 'ASG', 'FIN', 'SD', 'MPSA2', 'TRS', 'VB', 'AMS2', 'BIO'];

async function mockGovernanceApis(page) {
  await page.route('**/api/projects-catalog.json**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ projects: CATALOG_KEYS.map((key) => ({ key, label: key, accessible: true })) }),
  }));
  await page.route('**/api/governance-brief.json**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BRIEF),
  }));
  await page.route('**/api/quarters-list**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'Q1 FY26', period: 'Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/adoption-metrics.json**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ byMetric: {}, total: 0 }),
  }));
  await page.route('**/api/leadership-summary.json**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ velocity: { source: 'unavailable' }, reworkPct: { source: 'unavailable' } }),
  }));
  await page.route('**/api/governance/interventions/seed-from-brief**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, seeded: 0, cases: [] }),
  }));
  await page.route('**/api/governance/portfolio-decision.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      decision: {
        headline: 'MPSA needs a scope and proof decision today',
        narrative: { headline: 'MPSA needs a scope and proof decision today', summary: 'Test summary.' },
        aboveFold: { exposedCommitments: 1, actionsReady: 1, poResponsesRequired: 0, nextDeadline: null },
        affectedCommitments: [{ id: 'c1', title: 'Stale work', status: 'open', reason: 'Stale', decisionNeeded: true }],
        preparedActions: { groups: [{ role: 'Product Owner', count: 1, label: '1 PO action' }], items: [], nextDeadline: null, escalationReady: false },
        decisionOptions: [{ id: 'keep', label: 'Keep funding', impactPreview: 'Continue current path.' }],
        monitoring: { liveCases: 1, exposedCommitmentCount: 1, commitmentCount: 0 },
      },
      cards: [],
    }),
  }));
}

test.describe('Governance root, nav, and scope cockpit', () => {
  test('root / redirects to /governance when authed', async ({ page }) => {
    await mockGovernanceApis(page);
    await page.goto('/');
    if (page.url().includes('/login')) {
      test.skip(true, 'Auth required');
      return;
    }
    expect(page.url()).toMatch(/\/governance/);
  });

  test('sidebar includes settings and top chrome provides settings gear', async ({ page }) => {
    await mockGovernanceApis(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) {
      test.skip(true, 'Auth required');
      return;
    }
    await expect(page.locator('.app-sidebar a.sidebar-link[data-nav-key="settings"]')).toHaveCount(1);
    await expect(page.locator('#app-top-chrome [data-top-action="settings"]')).toBeVisible();
  });

  test('nav lists Portfolio before Squads and Actions', async ({ page }) => {
    await mockGovernanceApis(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) {
      test.skip(true, 'Auth required');
      return;
    }
    const labels = await page.locator('.app-top-switcher-item').allTextContents();
    const portfolioIdx = labels.findIndex((t) => /portfolio/i.test(t));
    const squadsIdx = labels.findIndex((t) => /squads/i.test(t));
    const actionsIdx = labels.findIndex((t) => /actions/i.test(t));
    expect(portfolioIdx).toBeGreaterThanOrEqual(0);
    expect(squadsIdx).toBeGreaterThan(portfolioIdx);
    expect(actionsIdx).toBeGreaterThan(squadsIdx);
  });

  test('portfolio scope visible; legacy brief surfaces stay hidden but hydrated', async ({ page }) => {
    await mockGovernanceApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('delivera_selectedProjects', 'MPSA');
    });
    await page.goto('/governance');
    if (page.url().includes('/login')) {
      test.skip(true, 'Auth required');
      return;
    }
    await waitForGovernanceReady(page);
    await expect(page.locator('[data-portfolio-signal]')).toBeVisible();
    await expect(page.locator('#portfolio-scope-bar-mount, .portfolio-scope-filters').first()).toBeVisible();
    await expect(page.locator('#gov-brief-content')).toBeHidden();
    await expect(page.locator('#gov-scope-bar-mount')).toBeAttached();
    await expect(page.locator('#gov-verdict-mount')).toBeAttached();
    await expect(page.locator('#gov-action-clusters-mount')).toBeAttached();
    await expect(page.locator('#gov-proof-risks, #gov-right-rail-proof-mount .gov-evidence-preview').first()).toBeAttached();
    await expect(page.locator('.governance-decisions-table')).toHaveCount(0);
    await expect(page.locator('.app-notification-toggle')).toHaveCount(0);
  });

  test('/leadership redirects to portfolio decision anchor', async ({ page }) => {
    await mockGovernanceApis(page);
    await page.goto('/leadership');
    if (page.url().includes('/login')) {
      test.skip(true, 'Auth required');
      return;
    }
    expect(page.url()).toMatch(/\/governance#portfolio-decision/);
  });
});
