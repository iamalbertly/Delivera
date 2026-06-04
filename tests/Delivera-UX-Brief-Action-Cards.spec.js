import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

const MOCK = {
  portfolio: 'SD',
  freshness: { confidenceLimit: 'live' },
  deliveryTruth: { committed: 4, done: 0 },
  executiveView: { verdictTier: 'blocked', verdictLabel: 'DELIVERY BLOCKED', businessHeadline: 'SD at risk', sprintPulse: { done: 0, committed: 4, pct: 0 } },
  topRisks: [{
    issueKey: 'SD-1',
    audience: 'delivery',
    displayTitle: 'Scope gap',
    decisionNeededFrom: 'Product Owner',
    recommendedAction: 'Confirm scope',
    evidence: '0 done',
    escalation: 'act-today',
    riskLabel: 'Gap',
  }],
  portfolioRisks: [],
  leadershipNarrative: { confidence: 'low', meetingAnswer: 'DELIVERY BLOCKED. SD at risk', whatToSay: 'Need a decision.', decisionsNeeded: [] },
};

test('brief shows do-now cards not decisions table above fold', async ({ page }) => {
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK) }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [] }) }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto('/governance');
  if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
  await expect(page.locator('.gov-donow-card')).toHaveCount(1);
  await expect(page.locator('.governance-decisions-table')).toHaveCount(0);
  await expect(page.locator('.attention-queue-table')).toHaveCount(0);
});
