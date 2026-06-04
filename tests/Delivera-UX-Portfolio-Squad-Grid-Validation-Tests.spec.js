import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

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
};

async function mockApis(page, body) {
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(body),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [] }),
  }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '{}',
  }));
}

async function setProjects(page, csv) {
  await page.addInitScript((key) => {
    localStorage.setItem('delivera_selectedProjects', key);
  }, csv);
}

test.describe('Portfolio squad grid', () => {
  test('multi-select shows leaderboard banner and four squad cards', async ({ page }) => {
    await setProjects(page, PROJECTS.join(','));
    await mockApis(page, PORTFOLIO_MOCK);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('.gov-portfolio-banner')).toBeVisible();
    await expect(page.locator('.gov-portfolio-banner-line')).toContainText(/4 squads/i);
    await expect(page.locator('.gov-squad-card')).toHaveCount(4);
    await expect(page.locator('.gov-squad-card[data-project="MPSA"] .gov-pulse-bars')).toBeVisible();
    await expect(page.locator('.gov-squad-card[data-project="RPA"][data-verdict-tier="blocked"]')).toBeVisible();
    await expect(page.locator('.gov-verdict-zone')).toHaveCount(0);
    await expect(page.locator('#gov-scope-bar-mount .gov-scope-chip.is-on')).toHaveCount(4);
  });

  test('single project keeps verdict zone', async ({ page }) => {
    await setProjects(page, 'SD');
    await mockApis(page, SINGLE_MOCK);
    await page.goto('/governance');
    if (page.url().includes('/login')) { test.skip(true, 'Auth required'); return; }
    await expect(page.locator('.gov-verdict-zone')).toBeVisible();
    await expect(page.locator('.gov-squad-grid')).toHaveCount(0);
  });
});
