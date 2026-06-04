import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

test('brief body text is dark on light background', async ({ page }) => {
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      portfolio: 'MPSA', freshness: { confidenceLimit: 'live' },
      deliveryTruth: {}, topRisks: [], portfolioRisks: [],
      executiveView: { verdictTier: 'watch', verdictLabel: 'NEEDS WATCH', businessHeadline: 'Readable answer text.', sprintPulse: { done: 1, committed: 3, pct: 33 } },
      leadershipNarrative: { meetingAnswer: 'NEEDS WATCH. Readable answer text.', whatToSay: 'Say this.', decisionsNeeded: [] },
    }),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"quarters":[]}' }));
  await page.addInitScript(() => {
    localStorage.setItem('delivera_selectedProjects', 'MPSA');
  });
  await page.goto('/governance');
  if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
  const color = await page.locator('.gov-verdict-business-line').evaluate((el) => getComputedStyle(el).color);
  expect(color).toMatch(/rgb\(17|rgba\(17|rgb\(31|rgb\(55/);
  await expect(page.locator('h1.governance-title')).toContainText("Today's delivery answer");
});
