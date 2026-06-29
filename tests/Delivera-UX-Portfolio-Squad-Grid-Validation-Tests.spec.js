import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  mockGovernancePage,
  waitForGovernanceReady,
  legacyBrief,
  clickLegacy,
} from './Delivera-Portfolio-Primary-Test-Helpers.js';

const PROJECTS = ['MPSA', 'MAS', 'RPA', 'SD'];

function squadInsight(projectKey, tier, done, committed, daysElapsed) {
  return {
    projectKey,
    boardResolved: true,
    boardName: `${projectKey} board`,
    verdictTier: tier,
    verdictLabel: tier === 'blocked' ? 'DELIVERY BLOCKED' : tier === 'watch' ? 'NEEDS WATCH' : 'ON TRACK',
    sprintPulse: {
      done,
      committed,
      pct: committed > 0 ? Math.round((done / committed) * 100) : 0,
      daysElapsed,
      daysRemaining: 7 - daysElapsed,
      phaseHint: done === 0 && daysElapsed >= 3 ? 'blocked_signals' : 'in_progress',
    },
    statusLine: done === 0 ? `${daysElapsed} days spent, zero progress` : 'On track to deliver',
    bottleneckLine: tier === 'blocked' ? 'Blocked by Tech Lead' : 'None',
    sprintStartLabel: 'Started: 1 Apr',
    capacityLine: tier === 'watch' ? 'Capacity gap: 1 unassigned in progress' : '',
    leadTimeLine: tier === 'blocked' ? 'Avg. lead time signal: 7 days' : '',
    leadTimeTrend: tier === 'blocked' ? 'worsening' : 'stable',
    productivityLine: tier === 'blocked' ? 'Stale work detected — squad may be stuck' : 'Productivity looks healthy',
    assigneeHighlight: tier === 'blocked' ? 'Amani N' : '',
  };
}

const PORTFOLIO_MOCK = {
  portfolio: 'MPSA + MAS + RPA + SD',
  projects: PROJECTS,
  freshness: { confidenceLimit: 'live' },
  deliveryTruth: { committed: 20, done: 7, staleInProgress: 3 },
  executiveView: {
    verdictTier: 'blocked',
    verdictLabel: 'DELIVERY BLOCKED',
    businessHeadline: 'Portfolio needs attention',
    sprintPulse: { done: 7, committed: 20, pct: 35, daysElapsed: 5 },
  },
  squadInsights: [
    squadInsight('MPSA', 'onTrack', 6, 7, 2),
    squadInsight('MAS', 'watch', 0, 7, 5),
    squadInsight('RPA', 'blocked', 1, 9, 7),
    squadInsight('SD', 'blocked', 0, 4, 7),
  ],
  portfolioRollup: {
    totalSquads: 4,
    blockerCount: 2,
    bottleneckCount: 2,
    summaryLine: 'Out of 4 squads: 2 blockers · 2 bottlenecks',
  },
  topRisks: [],
  portfolioRisks: [],
  leadershipNarrative: { meetingAnswer: 'DELIVERY BLOCKED. Portfolio needs attention' },
  evidencePack: { rows: [] },
};

const SINGLE_MOCK = {
  portfolio: 'SD',
  projects: ['SD'],
  freshness: { confidenceLimit: 'live' },
  deliveryTruth: { committed: 4, done: 0 },
  executiveView: {
    verdictTier: 'blocked',
    verdictLabel: 'DELIVERY BLOCKED',
    businessHeadline: 'SD delivery blocked',
    sprintPulse: { done: 0, committed: 4, pct: 0, daysElapsed: 3 },
  },
  topRisks: [],
  portfolioRisks: [],
  leadershipNarrative: { meetingAnswer: 'DELIVERY BLOCKED. SD delivery blocked' },
  evidencePack: { rows: [] },
  squadInsights: [squadInsight('SD', 'blocked', 0, 4, 3)],
};

async function mockApis(page, body) {
  await routeProjectsCatalog(page);
  const comparison = {
    cards: (body.projects || PROJECTS).map((pk) => ({
      projectKey: pk,
      squadName: pk,
      statusTier: pk === 'RPA' || pk === 'SD' ? 'blocked' : 'watch',
      mainIssue: 'Delivery signal',
      decisionLine: 'Confirm scope',
      nextAction: 'Review',
    })),
  };
  await mockGovernancePage(page, { brief: body, comparison });
}

async function setProjects(page, csv) {
  await page.addInitScript((key) => {
    localStorage.setItem('delivera_selectedProjects', key);
  }, csv);
}

test.describe('Portfolio squad grid', () => {
  test('multi-select shows rollup line and four heat tiles', async ({ page }) => {
    await setProjects(page, PROJECTS.join(','));
    await mockApis(page, PORTFOLIO_MOCK);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await waitForGovernanceReady(page);
  await expect(legacyBrief(page, '.gov-portfolio-banner-line')).toContainText(/4 squads/i);
  await expect(page.locator('.portfolio-carousel-card, .portfolio-squad-card')).toHaveCount(4);
  await expect(legacyBrief(page, '.gov-verdict-zone')).toHaveCount(0);
  });

  test('single project keeps hero squad grid', async ({ page }) => {
    await setProjects(page, 'SD');
    await mockApis(page, SINGLE_MOCK);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await waitForGovernanceReady(page);
    await expect(legacyBrief(page, '#gov-verdict-mount .gov-portfolio-grid-wrap--single')).toBeAttached();
    await expect(legacyBrief(page, '.gov-verdict-zone')).toHaveCount(0);
    await expect(legacyBrief(page, '.gov-risk-heat-row')).toHaveCount(0);
  });
});
