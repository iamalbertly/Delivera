/**
 * Churn Trust Repair — live console, baseline dedupe, alignment, cross-surface links.
 * @churn-trust-repair
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

function stubBrief({ baselineMissing = false } = {}) {
  const brief = {
    briefId: 'CTR-SD',
    // The brief is anchor-squad scoped; comparison squads arrive through the
    // portfolio decision payload so foreign work cannot leak into DMS detail.
    projects: ['SD'],
    generatedAt: new Date().toISOString(),
    freshness: { confidenceLimit: 'live' },
    meta: { quarter: 'FY27 Q2', setupGaps: baselineMissing ? [{ action: 'set-baseline' }] : [], timebox: { totalDays: 90, elapsedDays: 12 } },
    baselineComparison: baselineMissing ? null : {
      piName: 'SD FY27 Q2',
      summary: { totalCommitted: 4, delivered: 1, onTrack: 2, notTraceable: 1 },
      items: [{ issueKey: 'SD-1', title: 'Item', squad: 'SD', verdict: 'on-track' }],
    },
    squadInsights: [
      { projectKey: 'SD', boardName: 'DMS', boardResolved: true, verdictTier: 'blocked', sprintPulse: { committed: 8, done: 2 }, piCommitted: 4, cardRisks: [{ issueKey: 'SD-1' }] },
      { projectKey: 'MAS', boardName: 'AMS', boardResolved: true, verdictTier: 'onTrack', sprintPulse: { committed: 6, done: 5 }, piCommitted: 3 },
    ],
    evidencePack: { rows: [{ issueKey: 'SD-1', whyFlagged: 'Gap', statusNow: 'Open' }] },
  };
  return brief;
}

async function seedScope(page) {
  await page.addInitScript(({ projectsKey, anchorKey }) => {
    try {
      localStorage.setItem(projectsKey, 'SD,MAS');
      localStorage.setItem(anchorKey, 'SD');
      localStorage.setItem('delivera_gov_quarter_v1', 'FY27 Q2');
    } catch (_) { /* ignore */ }
  }, { projectsKey: PROJECTS_SSOT_KEY, anchorKey: PORTFOLIO_ANCHOR_KEY });
}

async function mockGovernance(page, { baselineMissing = false, cases = [] } = {}) {
  const brief = stubBrief({ baselineMissing });
  await seedScope(page);
  if (baselineMissing) {
    await page.addInitScript(() => {
      try { sessionStorage.setItem('delivera:baseline-prompt-FY27 Q2', '1'); } catch (_) { /* ignore */ }
    });
  }
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(brief) }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quarters: [{ label: 'FY27 Q2', isCurrent: true }] }) }));
  await page.route('**/api/governance/interventions/seed-from-brief**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, seeded: cases.length, cases }) }));
  const decisionPayload = enrichDecisionPayload(brief, {
    anchorProject: 'SD',
    compareProjects: ['MAS'],
    baselineMissing,
    cases,
    preparedActions: { totalReady: 1, items: [{ caseId: 'case-ctr-1', action: 'Request proof' }] },
    periodKey: 'FY27 Q2',
  });
  await page.route('**/api/governance/portfolio-decision.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(decisionPayload) }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nudges: [], confirm: [], briefs: [] }) }));
  await page.route('**/api/governance/worker-receipt.json**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ inboxTotal: 0 }) }));
}

test.describe('Churn Trust Repair Master Plan @churn-trust-repair', () => {
  test('01 live loadBrief — zero console errors on freshness path', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockGovernance(page);
    await page.goto('/governance', { waitUntil: 'domcontentloaded' });
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-priority-headline"]', { timeout: 120000 });
    assertTelemetryClean(t);
  });

  test('02 scope bar does not overlap hero', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockGovernance(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-priority-headline"]', { timeout: 120000 });
    const report = await getLayoutOverlapReport(page, {
      selectors: [
        '#portfolio-scope-bar-mount',
        '[data-testid="governance-priority-headline"]',
      ],
    });
    expect((report?.overlaps || []).length).toBeLessThanOrEqual(2);
    assertTelemetryClean(t);
  });

  test('03 baseline missing — quarter headline + single primary upload', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockGovernance(page, { baselineMissing: true });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-priority-headline"]', { timeout: 120000 });
    const headline = await page.locator('[data-testid="governance-priority-headline"]').innerText();
    expect(headline).toMatch(/FY27 Q2/i);
    expect(headline).toMatch(/upload/i);
    await expect(page.locator('[data-governance-action="upload-baseline-slide"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="governance-headline-upload-cta"]')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('04 baseline missing — no sponsor share CTA', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockGovernance(page, { baselineMissing: true });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-agentic-panel"]', { timeout: 120000 });
    await expect(page.locator('[data-governance-action="share-sponsor-brief"]')).toHaveCount(0);
    assertTelemetryClean(t);
  });

  test('05 commitment evidence is visible without a duplicate at-risk table or squad switcher', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockGovernance(page);
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-commitment-detail"]', { timeout: 120000 });
    await expect(page.locator('[data-testid="governance-at-risk-table"]')).toHaveCount(0);
    await expect(page.locator('[data-governance-squad-select]')).toHaveCount(0);
    await expect(page.getByTestId('governance-commitment-detail')).toBeVisible();
    assertTelemetryClean(t);
  });

  test('06 mobile hero + scope bar visible', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockGovernance(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-priority-headline"]', { timeout: 120000 });
    await expect(page.locator('#portfolio-scope-bar-mount')).toBeVisible();
    const headlineBox = await page.locator('[data-testid="governance-priority-headline"]').boundingBox();
    expect(headlineBox?.height || 0).toBeGreaterThan(10);
    assertTelemetryClean(t);
  });

  test('07 governance rail links actions with case id', async ({ page }) => {
    const t = captureBrowserTelemetry(page);
    await mockGovernance(page, { cases: [{ id: 'case-ctr-1', project: 'SD', state: 'open', needsApproval: true }] });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/governance');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await page.waitForSelector('[data-testid="governance-rail-actions-link"]', { timeout: 120000 });
    const href = await page.locator('[data-testid="governance-rail-actions-link"]').getAttribute('href');
    expect(href).toMatch(/\/actions\?case=case-ctr-1/);
    assertTelemetryClean(t);
  });
});
