import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

test('stale data shows plain English minutes warning', async ({ page }) => {
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      portfolio: 'SD', freshness: { confidenceLimit: 'stale', cacheAgeMinutes: 37 },
      deliveryTruth: {}, topRisks: [], portfolioRisks: [],
      leadershipNarrative: { meetingAnswer: 'SD at risk.', decisionsNeeded: [] },
    }),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"quarters":[]}' }));
  await page.goto('/governance');
  if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
  await expect(page.locator('.governance-freshness-pill')).toContainText(/37 minutes|Refresh before/i);
});
