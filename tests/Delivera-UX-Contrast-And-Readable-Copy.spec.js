import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  mockGovernancePage,
  waitForGovernanceReady,
  legacyBrief,
} from './Delivera-Portfolio-Primary-Test-Helpers.js';

test('brief body text is dark on light background', async ({ page }) => {
  await mockGovernancePage(page, {
    brief: {
      portfolio: 'MPSA', freshness: { confidenceLimit: 'live' },
      deliveryTruth: {}, topRisks: [], portfolioRisks: [],
      executiveView: { verdictTier: 'watch', verdictLabel: 'NEEDS WATCH', businessHeadline: 'Readable answer text.', sprintPulse: { done: 1, committed: 3, pct: 33 } },
      leadershipNarrative: { meetingAnswer: 'NEEDS WATCH. Readable answer text.', whatToSay: 'Say this.', decisionsNeeded: [] },
    },
  });
  await page.addInitScript(() => {
    localStorage.setItem('delivera_selectedProjects', 'MPSA');
  });
  await page.goto('/governance');
  if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
  await waitForGovernanceReady(page);
  const color = await legacyBrief(page, '.gov-command-answer-detail, .gov-portfolio-banner-line, .gov-answer-block-value').first().evaluate((el) => getComputedStyle(el).color);
  expect(color).toMatch(/rgb\(17|rgba\(17|rgb\(31|rgb\(55|rgb\(30, 58, 95\)/);
  await expect(legacyBrief(page, '.gov-command-answer')).toHaveAttribute('aria-label', /delivery answer/i);
});
