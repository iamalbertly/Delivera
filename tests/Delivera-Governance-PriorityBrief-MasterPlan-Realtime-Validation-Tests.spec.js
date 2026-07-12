/**
 * Governance Priority Brief — Master Plan realtime validation.
 * Journey-value assertions via data-testid; console guard fail-fast.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  skipIfRedirectedToLogin,
  getLayoutOverlapReport,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY, PORTFOLIO_ANCHOR_KEY } from '../public/Delivera-Shared-Storage-Keys.js';
import { enrichDecisionPayload } from './Delivera-Governance-PriorityBrief-Mock-Helper.js';

function stubPriorityBrief() {
  return {
    briefId: 'PB-SD',
    projects: ['SD', 'MAS', 'RPA', 'MPSA2'],
    generatedAt: new Date().toISOString(),
    freshness: { confidenceLimit: 'live' },
    meta: { quarter: 'FY27 Q2', setupGaps: [], timebox: { totalDays: 90, elapsedDays: 45 } },
    deliveryTruthKeys: { lateAdded: ['SD-5237'] },
    baselineComparison: {
      piName: 'DMS FY27 Q2 PI baseline',
      baselineDate: '2026-03-28',
      summary: { totalCommitted: 6, delivered: 2, onTrack: 2, removed: 1, notTraceable: 1 },
      items: [
        { issueKey: 'SD-5237', title: 'Access Review', squad: 'SD', verdict: 'on-track', statusNow: 'In Progress' },
        { issueKey: 'SD-5240', title: 'Service Governance Automation', squad: 'SD', verdict: 'not-traceable', statusNow: 'not found' },
      ],
    },
    squadInsights: [
      { projectKey: 'SD', boardName: 'DMS Squad', boardResolved: true, verdictTier: 'blocked', sprintPulse: { committed: 10, done: 2 }, offPlanHours: 42, piCommitted: 6, cardRisks: [{ issueKey: 'SD-5237' }] },
      { projectKey: 'MAS', boardName: 'AMS', boardResolved: true, verdictTier: 'onTrack', sprintPulse: { committed: 8, done: 7 }, offPlanHours: 2, piCommitted: 5, piDone: 5 },
      { projectKey: 'RPA', boardName: 'RPA', boardResolved: true, verdictTier: 'watch', sprintPulse: { committed: 8, done: 4 }, offPlanHours: 8, piCommitted: 5 },
      { projectKey: 'MPSA2', boardName: 'Transformers', boardResolved: true, verdictTier: 'onTrack', sprintPulse: { committed: 9, done: 8 }, offPlanHours: 3, piCommitted: 5, piDone: 5 },
    ],
    topRisks: [{ issueKey: 'SD-5237', riskType: 'late-scope', summary: 'Access Review moved after planning', projectKey: 'SD' }],
    evidencePack: { rows: [{ issueKey: 'SD-5240', whyFlagged: 'No acceptance proof', statusNow: 'In Progress' }] },
  };
}

async function mockPriorityBriefPage(page, { baselineMissing = false, stale = false, cases = [] } = {}) {
  const brief = stubPriorityBrief();
  if (baselineMissing) {
    brief.baselineComparison = null;
    brief.meta.setupGaps = [{ action: 'set-baseline', label: 'Set PI baseline' }];
  }
  if (stale) brief.freshness.confidenceLimit = 'stale';

  await page.addInitScript(({ projectsKey, anchorKey }) => {
    try {
      localStorage.setItem(projectsKey, 'SD,MAS,RPA,MPSA2');
      localStorage.setItem(anchorKey, 'SD');
    } catch (_) { /* ignore */ }
  }, { projectsKey: PROJECTS_SSOT_KEY, anchorKey: PORTFOLIO_ANCHOR_KEY });

  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(brief) }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [{ label: 'FY27 Q2', isCurrent: true }] }) }));
  await page.route('**/api/governance/interventions/seed-from-brief**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, seeded: cases.length, cases }),
  }));

  const decisionPayload = enrichDecisionPayload(brief, {
    anchorProject: 'SD',
    compareProjects: ['MAS', 'RPA', 'MPSA2'],
    baselineMissing,
    cases,
    preparedActions: {
      totalReady: 2,
      items: [{ action: 'Request evidence from PO' }, { action: 'Request acceptance proof' }],
      nextDeadline: 'Jul 15',
    },
    decisionRequired: { owner: 'Sponsor', dueAt: 'Jul 15', recommendedAction: 'Accept scope move' },
    meta: { cached: stale },
  });

  await page.route('**/api/governance/portfolio-decision.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(decisionPayload),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nudges: [], confirm: [], briefs: [] }) }));
  await page.route('**/api/governance/worker-receipt.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ inboxTotal: 0 }) }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }) }));
  await page.route('**/api/governance/adoption-metric**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
}

test.describe('Governance Priority Brief Master Plan @governance-priority-brief', () => {
  test('01 load governance priority surface with clean console', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPriorityBriefPage(page);
    await page.goto('/governance', { waitUntil: 'domcontentloaded' });
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-priority-brief"]', { timeout: 120000 });
    await expect(page.locator('[data-testid="governance-priority-surface"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('02 headline exposes squad judgment without percentages', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPriorityBriefPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-priority-headline"]', { timeout: 120000 });
    const headline = await page.locator('[data-testid="governance-priority-headline"]').innerText();
    expect(headline).toMatch(/decision|off-plan|unsupported|DMS/i);
    expect(headline).not.toMatch(/\d+%/);
    assertTelemetryClean(t);
  });

  test('03 agentic bands separate completed prepared and human decision', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPriorityBriefPage(page, { cases: [{ id: 'c1', project: 'SD', state: 'decision-required' }] });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-delivera-completed"]', { timeout: 120000 });
    await expect(page.locator('[data-testid="governance-delivera-prepared"]')).toBeVisible();
    await expect(page.locator('[data-testid="governance-human-decision"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('04 exactly one primary CTA and verb-specific evidence action', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPriorityBriefPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-primary-action"]', { timeout: 120000 });
    await expect(page.locator('[data-testid="governance-primary-action"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="governance-evidence-action"]')).toContainText(/Inspect/i);
    assertTelemetryClean(t);
  });

  test('05 exception rail shows collapsed safe squads line', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPriorityBriefPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-exception-rail"]', { timeout: 120000 });
    await expect(page.locator('[data-testid="governance-squad-collapsed"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('06 baseline provenance visible on first paint', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPriorityBriefPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-baseline-provenance"]', { timeout: 120000 });
    await expect(page.locator('[data-testid="governance-baseline-provenance"]')).toContainText(/Compared against|Extracted/i);
    assertTelemetryClean(t);
  });

  test('07 missing baseline cannot verify not off-plan', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPriorityBriefPage(page, { baselineMissing: true });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-baseline-provenance"]', { timeout: 120000 });
    const text = await page.locator('[data-testid="governance-baseline-provenance"]').innerText();
    expect(text.toLowerCase()).toMatch(/cannot|verify|unavailable/);
    expect(text.toLowerCase()).not.toMatch(/off plan/);
    assertTelemetryClean(t);
  });

  test('08 squad switch updates brief in place without navigation', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPriorityBriefPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-squad-row"]', { timeout: 120000 });
    const before = page.url();
    await page.locator('[data-testid="governance-squad-row"]').first().click();
    await page.waitForTimeout(500);
    expect(page.url()).toBe(before);
    await expect(page.locator('[data-testid="governance-priority-headline"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('09 legacy carousel hidden above fold', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPriorityBriefPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-priority-brief"]', { timeout: 120000 });
    await expect(page.locator('#portfolio-carousel-mount')).toBeHidden();
    await expect(page.locator('#portfolio-signal-mount')).toBeHidden();
    assertTelemetryClean(t);
  });

  test('10 commitment detail uses specific decision labels not Resolve gap', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPriorityBriefPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-commitment-detail"]', { timeout: 120000 });
    const detail = await page.locator('[data-testid="governance-commitment-detail"]').innerText();
    expect(detail).not.toMatch(/Resolve gap|Review match/i);
    assertTelemetryClean(t);
  });

  test('11 layout overlap report clean on hero', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPriorityBriefPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-priority-brief"]', { timeout: 120000 });
    const report = await getLayoutOverlapReport(page);
    expect(report.overlappingPairs?.length || 0).toBeLessThanOrEqual(2);
    assertTelemetryClean(t);
  });

  test('12 share sponsor brief action present', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockPriorityBriefPage(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-governance-action="share-sponsor-brief"]', { timeout: 120000 });
    await expect(page.locator('[data-governance-action="share-sponsor-brief"]')).toBeVisible();
    assertTelemetryClean(t);
  });
});
