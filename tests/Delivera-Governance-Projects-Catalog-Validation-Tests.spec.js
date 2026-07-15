import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { GOV_CATALOG_KEYS, routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import { readCatalogKeys } from '../public/Delivera-Shared-Projects-Catalog-01SSOT.js';
import { waitForGovernanceReady, mockPortfolioDecision } from './Delivera-Portfolio-Primary-Test-Helpers.js';

const MOCK_BRIEF = {
  briefId: 'CATALOG-TEST',
  projects: ['MPSA', 'MAS'],
  generatedAt: new Date().toISOString(),
  freshness: { confidenceLimit: 'live' },
  executiveView: { verdictTier: 'watch', verdictLabel: 'WATCH' },
  leadershipNarrative: { meetingAnswer: 'Watch', narratedBy: 'template' },
  topRisks: [],
  meta: { narratedBy: 'template' },
};

function legacyBriefAll(page, selector) {
  return page.locator(`#gov-brief-content ${selector}`);
}

test.describe('Governance projects catalog SSOT', () => {
  test('catalog SSOT matches report squad count', () => {
    expect(readCatalogKeys().length).toBeGreaterThanOrEqual(12);
    expect(GOV_CATALOG_KEYS.length).toBe(readCatalogKeys().length);
  });

  test('portfolio scope shows catalog squads and cadence pack', async ({ page }) => {
    await routeProjectsCatalog(page);
    await mockPortfolioDecision(page);
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        ...MOCK_BRIEF,
        meta: {
          ...MOCK_BRIEF.meta,
          scopeIntelligence: {
            cards: GOV_CATALOG_KEYS.map((key) => ({
              projectKey: key,
              sprint: key === 'MPSA' ? 'active' : 'none',
              isSelected: key === 'MPSA' || key === 'MAS',
              epicCount: 1,
              cadence: { lastSprintName: 'Sprint 12', lastSprintEnd: '2026-06-01', sprintState: 'active' },
            })),
          },
        },
      }),
    }));
    await page.route('**/api/quarters-list**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [{ label: 'Q1', isCurrent: true }] }),
    }));
    await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
    }));
    await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
    }));
    await page.route('**/api/boards.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ jiraBrowseHost: 'https://jira.example.com', boards: [{ projectKey: 'MPSA' }, { projectKey: 'MAS' }] }),
    }));
    await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'MPSA,MAS'); });
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await waitForGovernanceReady(page);
    await expect(page.locator('#portfolio-scope-selected option')).toHaveCount(GOV_CATALOG_KEYS.length + 1);
    await expect(page.locator('#portfolio-scope-selected option').first()).toHaveAttribute('value', '__ALL__');
    await expect(page.locator('#portfolio-scope-selected option').first()).toContainText(/All Projects/i);
    await expect(page.locator('[data-testid="gov-cadence-pack"]')).toBeVisible();
  });

  test('limited access chips still hydrate in legacy brief scope', async ({ page }) => {
    await routeProjectsCatalog(page, { MVA: false, BIO: false });
    await mockPortfolioDecision(page);
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BRIEF),
    }));
    await page.route('**/api/quarters-list**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [] }),
    }));
    await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
    }));
    await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
    }));
    await page.route('**/api/boards.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ jiraBrowseHost: 'https://jira.example.com', boards: [] }),
    }));
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await waitForGovernanceReady(page);
    const limited = legacyBriefAll(page, '.gov-scope-chip--limited');
    await expect.poll(() => limited.count(), { timeout: 10000 }).toBe(2);
  });

  test('owner cluster hydrates with review nudge when clusters present', async ({ page }) => {
    const brief = {
      ...MOCK_BRIEF,
      projects: ['MPSA'],
      executiveView: { verdictTier: 'blocked', verdictLabel: 'BLOCKED' },
      meta: { narratedBy: 'template', safeToSend: false },
      topRisks: [{
        issueKey: 'MPSA-9', assigneeName: 'Sam', decisionNeededFrom: 'Scrum Master',
        recommendedAction: 'Unblock', escalation: 'act-today', issueUrl: 'https://example/MPSA-9',
        summary: 'Blocked item', displayTitle: 'Blocked item',
      }],
    };
    await routeProjectsCatalog(page);
    await mockPortfolioDecision(page);
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(brief),
    }));
    await page.route('**/api/quarters-list**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [{ label: 'Q1', isCurrent: true }] }),
    }));
    await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
    }));
    await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
    }));
    await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], poReadiness: [] }),
    }));
    await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'MPSA'); });
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await waitForGovernanceReady(page);
    const nudge = legacyBriefAll(page, '.gov-owner-cluster [data-grouped-nudge]');
    await expect(nudge).toHaveCount(1);
    await expect(page.locator('[data-portfolio-signal]')).toBeVisible();
  });
});
