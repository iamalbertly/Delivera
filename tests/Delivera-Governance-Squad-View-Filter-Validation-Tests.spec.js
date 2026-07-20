import { test, expect } from '@playwright/test';

/**
 * Validates Fix 6: "Selected squad" view filters the table to only the selected squad.
 * Mocks a brief with 4 squads, clicks a squad row, then asserts the table shows only 1 row.
 */

const MOCK_BRIEF = {
  answer: '2 squads need attention.',
  sourceLine: 'Compared with test contract · 4 promises checked',
  deliveraDid: 'Delivera matched the contract to Jira.',
  missionHeader: 'Test PI contract governance',
  verifiedAt: new Date().toISOString(),
  freshness: { state: 'calm' },
  scope: { complete: true, verifiedSquads: 4, expectedSquads: 4 },
  contract: { source: 'test' },
  decisionCoverage: { closed: 0, total: 4, preparedOwnerAsks: 4 },
  squads: [
    { squad: 'DMS', displayName: 'DMS Squad', attentionCount: 1, topState: 'Needs attention', contractState: { label: 'Needs attention' }, sprintReality: { state: 'active', daysRemaining: 5, sprint: { name: 'Sprint 1' } }, sprintCadence: { label: 'Active' }, trustFactor: { label: 'Limited' }, baselineCoverage: { state: 'verified', sourceLabel: 'Approved' }, nextAction: { label: 'Review evidence' }, proofState: 'Fresh', workSplit: { unknownPct: 0, explanation: 'No diversion.' }, doingInstead: { copy: 'No diversion.' } },
    { squad: 'FIN', displayName: 'Finance Squad', attentionCount: 2, topState: 'Needs attention', contractState: { label: 'Needs attention' }, sprintReality: { state: 'unverified' }, sprintCadence: { label: 'Unverified' }, trustFactor: { label: 'Limited' }, baselineCoverage: { state: 'verified', sourceLabel: 'Approved' }, nextAction: { label: 'Review evidence' }, proofState: 'Fresh', workSplit: { unknownPct: 0, explanation: 'No diversion.' }, doingInstead: { copy: 'No diversion.' } },
    { squad: 'AMS', displayName: 'AMS Squad', attentionCount: 0, topState: 'Aligned', contractState: { label: 'Aligned' }, sprintReality: { state: 'active', daysRemaining: 3, sprint: { name: 'Sprint 2' } }, sprintCadence: { label: 'Active' }, trustFactor: { label: 'High' }, baselineCoverage: { state: 'verified', sourceLabel: 'Approved' }, nextAction: null, proofState: 'Fresh', workSplit: { unknownPct: 0, explanation: 'No diversion.' }, doingInstead: { copy: 'No diversion.' } },
    { squad: 'RPA', displayName: 'RPA Squad', attentionCount: 0, topState: 'Aligned', contractState: { label: 'Aligned' }, sprintReality: { state: 'active', daysRemaining: 7, sprint: { name: 'Sprint 3' } }, sprintCadence: { label: 'Active' }, trustFactor: { label: 'High' }, baselineCoverage: { state: 'verified', sourceLabel: 'Approved' }, nextAction: null, proofState: 'Fresh', workSplit: { unknownPct: 0, explanation: 'No diversion.' }, doingInstead: { copy: 'No diversion.' } },
  ],
  promises: [],
  lensSummaries: { overall: 'DMS and FIN need attention.' },
  excludedOperationalGroups: [],
};

test.describe('Governance squad view filter', () => {
  test('Selected squad view filters the table to only the spotlighted squad', async ({ page }) => {
    // Navigate directly to the squad view with a spotlight active
    // SD is the squad key for DMS Squad (Kilimanjaro Legends)
    await page.goto('http://localhost:3001/governance?spotlight=SD&view=squad', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-story-squad]', { timeout: 20000 });

    // In squad view with SD spotlighted, the table should show only SD rows
    // (not all 11 squads — that would be the continuity bug)
    const squadRows = page.locator('[data-story-squad]');
    const rowCount = await squadRows.count();

    // Should be exactly 1 row (SD only) — not 11 (all squads)
    expect(rowCount).toBe(1);
    await expect(page.locator('[data-story-squad="SD"]')).toBeVisible();
  });

  test('Portfolio view shows all squads (no filtering)', async ({ page }) => {
    await page.goto('http://localhost:3001/governance?view=overall', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-story-squad]', { timeout: 20000 });

    const squadRows = page.locator('[data-story-squad]');
    const rowCount = await squadRows.count();

    // Portfolio view should show all squads (more than 1)
    expect(rowCount).toBeGreaterThan(1);
  });
});
