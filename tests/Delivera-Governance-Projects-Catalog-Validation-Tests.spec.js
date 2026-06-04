import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { GOV_CATALOG_KEYS, routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import { readCatalogKeys } from '../public/Delivera-Shared-Projects-Catalog-01SSOT.js';

const MOCK_BRIEF = {
  briefId: 'CATALOG-TEST',
  generatedAt: new Date().toISOString(),
  freshness: { confidenceLimit: 'live' },
  executiveView: { verdictTier: 'watch', verdictLabel: 'WATCH' },
  leadershipNarrative: { meetingAnswer: 'Watch', narratedBy: 'template' },
  topRisks: [],
  meta: { narratedBy: 'template' },
};

test.describe('Governance projects catalog SSOT', () => {
  test('catalog SSOT matches report squad count', () => {
    expect(readCatalogKeys().length).toBeGreaterThanOrEqual(12);
    expect(GOV_CATALOG_KEYS.length).toBe(readCatalogKeys().length);
  });

  test('scope bar renders full catalog chips when expanded', async ({ page }) => {
    await routeProjectsCatalog(page);
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_BRIEF),
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
    await page.addInitScript(() => { localStorage.setItem('delivera_selectedProjects', 'MPSA,MAS'); });
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await page.locator('#gov-scope-change').click();
    await expect(page.locator('#gov-scope-bar-mount .gov-scope-chip')).toHaveCount(GOV_CATALOG_KEYS.length);
    await expect(page.locator('.gov-scope-chip--limited')).toHaveCount(0);
  });

  test('limited access chips styled when catalog marks inaccessible', async ({ page }) => {
    await routeProjectsCatalog(page, { MVA: false, BIO: false });
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
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await page.locator('#gov-scope-change').click();
    await expect(page.locator('.gov-scope-chip--limited')).toHaveCount(2);
  });
});
