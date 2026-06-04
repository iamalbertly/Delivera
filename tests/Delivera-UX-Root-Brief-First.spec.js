import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

test('root opens governance brief when authed', async ({ page }) => {
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ portfolio: 'MPSA', leadershipNarrative: { meetingAnswer: 'ok' }, deliveryTruth: {}, topRisks: [], portfolioRisks: [], freshness: { confidenceLimit: 'live' } }) }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [] }) }));
  await page.goto('/');
  if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
  expect(page.url()).toMatch(/\/governance/);
});
