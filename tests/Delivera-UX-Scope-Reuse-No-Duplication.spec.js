import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

test('governance page has single scope bar', async ({ page }) => {
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"portfolio":"MPSA","freshness":{"confidenceLimit":"live"},"deliveryTruth":{},"topRisks":[],"portfolioRisks":[],"leadershipNarrative":{"meetingAnswer":"ok"}}' }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"quarters":[]}' }));
  await page.goto('/governance');
  if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
  await expect(page.locator('#gov-scope-bar-mount')).toHaveCount(1);
});
