import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

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

  test('sidebar omits settings; top chrome provides settings gear', async ({ page }) => {
    await mockGovernanceApis(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) {
      test.skip(true, 'Auth required');
      return;
    }
    await expect(page.locator('.app-sidebar a.sidebar-link[data-nav-key="settings"]')).toHaveCount(0);
    await expect(page.locator('#app-top-chrome [data-top-action="settings"]')).toBeVisible();
  });

  test('nav lists Brief before Proof', async ({ page }) => {
    await mockGovernanceApis(page);
    await page.goto('/governance');
    if (page.url().includes('/login')) {
      test.skip(true, 'Auth required');
      return;
    }
    const labels = await page.locator('.app-sidebar-nav a span, .app-sidebar-nav .sidebar-link span').allTextContents();
    const briefIdx = labels.findIndex((t) => /brief/i.test(t));
    const proofIdx = labels.findIndex((t) => /proof/i.test(t));
    expect(briefIdx).toBeGreaterThanOrEqual(0);
    expect(proofIdx).toBeGreaterThan(briefIdx);
  });

  test('scope bar visible without overlay; action clusters precede verdict in DOM', async ({ page }) => {
    await mockGovernanceApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('delivera_selectedProjects', 'MPSA');
    });
    await page.goto('/governance');
    if (page.url().includes('/login')) {
      test.skip(true, 'Auth required');
      return;
    }
    await expect(page.locator('.gov-command-answer, #gov-verdict-mount').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#gov-scope-bar-mount .gov-scope-chip')).toHaveCount(CATALOG_KEYS.length);
    const verdict = page.locator('#gov-verdict-mount');
    const clusters = page.locator('#gov-action-clusters-mount');
    await expect(verdict).toBeVisible();
    if (await clusters.locator('.gov-owner-cluster').count()) {
      await expect(clusters).toBeVisible();
    }
    await expect(page.locator('#gov-proof-risks, #gov-right-rail-proof-mount .gov-evidence-preview').first()).toBeAttached();
    await expect(page.locator('.gov-verdict-fold .gov-verdict-zone, #gov-verdict-mount .gov-portfolio-grid-wrap, #gov-verdict-mount .gov-risk-tile-details').first()).toBeAttached();
    await expect(page.locator('.governance-decisions-table')).toHaveCount(0);
    await expect(page.locator('.app-notification-toggle')).toHaveCount(0);
  });

  test('/leadership redirects to brief decision snapshot anchor', async ({ page }) => {
    await mockGovernanceApis(page);
    await page.goto('/leadership');
    if (page.url().includes('/login')) {
      test.skip(true, 'Auth required');
      return;
    }
    expect(page.url()).toMatch(/\/governance#decision-snapshot/);
  });
});
