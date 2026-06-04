import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

test('copy meeting answer has no technical labels', async ({ page, context }) => {
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      portfolio: 'SD', freshness: { confidenceLimit: 'live' },
      deliveryTruth: { committed: 2, done: 0 }, topRisks: [], portfolioRisks: [],
      leadershipNarrative: { confidence: 'low', meetingAnswer: 'SD is at risk.', whatToSay: 'Confirm scope today.', decisionsNeeded: [] },
    }),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"quarters":[]}' }));
  await page.goto('/governance');
  if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('#gov-copy-meeting').click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('at risk');
  expect(text).not.toMatch(/narrated by|Brief ID|template/i);
});
