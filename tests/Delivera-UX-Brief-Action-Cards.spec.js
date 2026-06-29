import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import {
  mockGovernancePage,
  waitForGovernanceReady,
  legacyBrief,
} from './Delivera-Portfolio-Primary-Test-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';

const MOCK = {
  projects: ['SD'],
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
  await page.addInitScript(() => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
  });
  await routeProjectsCatalog(page);
  await mockGovernancePage(page, { brief: MOCK });
  await page.goto('/governance');
  if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
  await waitForGovernanceReady(page);
  await expect(page.locator('[data-portfolio-signal]')).toBeVisible();
  await expect(legacyBrief(page, '.gov-owner-cluster')).toBeAttached();
  await expect(legacyBrief(page, '.governance-decisions-table')).toHaveCount(0);
  await expect(legacyBrief(page, '.attention-queue-table')).toHaveCount(0);
});
