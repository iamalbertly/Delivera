/**
 * Customer · Realism & Simplicity · Speed & Trust — cross-surface direct-value contracts.
 * Journey-value assertions (roles, data attrs, layout geometry) — not brittle marketing copy.
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import {
  assertTelemetryClean,
  captureBrowserTelemetry,
  skipIfRedirectedToLogin,
} from './Delivera-Tests-Shared-PreviewExport-Helpers.js';
import { PROJECTS_SSOT_KEY } from '../public/Delivera-Shared-Storage-Keys.js';

function stubBlockedBrief(overrides = {}) {
  return JSON.stringify({
    briefId: 'CST-BRIEF',
    projects: ['SD'],
    executiveView: { verdictTier: 'blocked', verdictLine: 'DELIVERY BLOCKED', businessHeadline: 'Leadership must unblock today' },
    leadershipNarrative: {
      confidence: 'low',
      meetingAnswer: 'Blocked on leadership decision',
      meetingScript: 'We are blocked until leadership confirms PI scope.',
      narratedBy: 'template',
    },
    portfolioRollup: { summaryLine: '1 blocker · 1 bottleneck', behindPiCount: 0 },
    squadInsights: [{
      projectKey: 'SD',
      verdictTier: 'blocked',
      verdictLabel: 'DELIVERY BLOCKED',
      bottleneckLine: 'Blocked by Leadership',
      productivityLine: 'Stale work detected',
      sprintPulse: { committed: 4, done: 1, daysElapsed: 8 },
      piCommitted: 4,
      piDone: 1,
      cardRisks: [{ issueKey: 'SD-1', displayTitle: 'Stuck epic' }],
      squadRoles: { scrumMaster: { displayName: 'Sam SM' }, productOwner: { displayName: 'Pat PO' } },
    }],
    topRisks: [{
      issueKey: 'SD-1',
      assigneeName: 'Amani',
      decisionNeededFrom: 'Leadership',
      recommendedAction: 'Confirm PI baseline today',
      escalation: 'act-today',
      issueUrl: 'https://example/SD-1',
      displayTitle: 'Stuck item',
      summary: 'Stuck',
      ageHours: 216,
    }, {
      issueKey: 'SD-2',
      assigneeName: 'Amani',
      decisionNeededFrom: 'Leadership',
      recommendedAction: 'Review scope',
      escalation: 'watch',
      displayTitle: 'Second item',
      summary: 'Second',
      ageHours: 48,
    }],
    freshness: { confidenceLimit: 'live', generatedAt: new Date().toISOString() },
    meta: {
      narratedBy: 'template',
      commandAnswerSentence: 'DELIVERY BLOCKED — leadership must act',
      safeToSend: false,
      periodWindow: '28d',
      workerReceipt: { line: 'Last run: 2m ago', inboxTotal: 5 },
      piConfidence: {
        trusted: false,
        confidencePct: null,
        counts: { committed: 0, offPlan: 0, onTrack: 0, missingDates: 2, atRisk: 0 },
        timelineChips: [],
      },
      setupGaps: [{ id: 'pi-baseline', label: 'PI baseline missing', action: 'set-baseline', severity: 'high' }],
      teamRoster: [{ displayName: 'Amani Okoye' }],
      ...overrides.meta,
    },
    evidencePack: {
      rows: [
        { issueKey: 'SD-1', statusNow: 'In Progress', statusLastWeek: 'To Do', whyFlagged: 'stale' },
        { issueKey: 'SD-2', statusNow: 'Blocked', statusLastWeek: 'In Progress', whyFlagged: 'blocked' },
        { issueKey: 'SD-3', statusNow: 'Done', statusLastWeek: 'In Progress', whyFlagged: 'done' },
      ],
    },
    ...overrides,
  });
}

async function mockCustomerSimplicityRoutes(page) {
  await page.addInitScript((projectsKey) => {
    try { localStorage.setItem(projectsKey, 'SD'); } catch (_) {}
  }, PROJECTS_SSOT_KEY);
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: stubBlockedBrief(),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      nudges: [{ id: 'n1', type: 'nudge', summary: 'Nudge', payload: { owner: 'Amani', board: 'SD' } }],
      confirm: [{ id: 'c1', type: 'confirm', summary: 'Claim', payload: { owner: 'A', board: 'SD' } }],
      briefs: [], piDrift: [], impact: [], poReadiness: [],
    }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, agents: [], lastImprovements: [] }),
  }));
  await page.route('**/api/governance/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
}

test.describe('Customer simplicity trust direct value validation', () => {
  test.describe.configure({ retries: 0 });

  test('governance desktop direct-value journey contracts', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await mockCustomerSimplicityRoutes(page);
    await page.setViewportSize({ width: 1400, height: 900 });

    await test.step('01 brief loads owner cluster without extra scroll target', async () => {
      await page.goto('/governance');
      if (await skipIfRedirectedToLogin(page, test)) return;
      await expect(page.locator('.gov-owner-cluster')).toBeVisible({ timeout: 20000 });
      assertTelemetryClean(telemetry);
    });

    await test.step('02 desktop grid uses two columns', async () => {
      const grid = page.locator('#main-content.governance-shell--desktop-grid');
      await expect(grid).toBeVisible();
      const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
      expect(cols.split(' ').length).toBeGreaterThanOrEqual(2);
      assertTelemetryClean(telemetry);
    });

    await test.step('03 single PI baseline CTA in scope expanded area', async () => {
      await expect(page.locator('#gov-scope-baseline')).toHaveCount(0);
      await expect(page.locator('#gov-pi-fix-baseline')).toHaveCount(1);
      assertTelemetryClean(telemetry);
    });

    await test.step('04 period window not duplicated in portfolio banner', async () => {
      const banner = page.locator('[data-portfolio-banner]');
      if (await banner.count()) {
        await expect(banner).not.toContainText(/Window:/i);
      }
      await expect(page.locator('.gov-period-chip.is-on')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('05 lead issue visible without cluster toggle', async () => {
      await expect(page.locator('[data-cluster-lead="0"]')).toBeVisible();
      await expect(page.locator('[data-cluster-lead="0"] .gov-cluster-issue-key')).toContainText('SD-1');
      assertTelemetryClean(telemetry);
    });

    await test.step('06 high severity setup gap auto visible', async () => {
      await expect(page.locator('.gov-setup-debt--auto .gov-fix-card')).toBeVisible();
      await expect(page.locator('#gov-setup-gaps-expand')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('07 proof preview above fold without opening details', async () => {
      await expect(page.locator('.gov-evidence-preview')).toBeVisible();
      await expect(page.locator('#gov-supporting-evidence')).not.toHaveAttribute('open', /.+/);
      await expect(page.locator('.gov-evidence-preview-table tbody tr')).toHaveCount(2);
      assertTelemetryClean(telemetry);
    });

    await test.step('08 agent queue auto opens when inbox pending', async () => {
      await expect(page.locator('#gov-top-chrome-mount')).toHaveJSProperty('open', true);
      assertTelemetryClean(telemetry);
    });

    await test.step('09 status chip opens inbox on click', async () => {
      const tabs = page.getByRole('tablist', { name: 'Agent queue' });
      if (!(await tabs.isVisible().catch(() => false))) {
        await page.locator('.gov-scope-status-chip[data-scope-status-action="inbox"]').click();
      }
      await expect(page.locator('#delivera-gov-right-drawer')).toBeVisible({ timeout: 8000 });
      await expect(tabs).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('10 blocked meeting script promoted open', async () => {
      await expect(page.locator('.gov-promoted-meeting-script .gov-meeting-script[open]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('11 cluster mode compacts command answer on desktop', async () => {
      await expect(page.locator('.gov-command-answer--cluster-mode')).toBeVisible();
      await expect(page.locator('.gov-command-answer--cluster-mode .gov-visual-answer-blocks')).toBeHidden();
      assertTelemetryClean(telemetry);
    });

    await test.step('12 squad nudge hidden when owner cluster owns nudge', async () => {
      await expect(page.locator('[data-squad-nudge="SD"]')).toHaveCount(0);
      await expect(page.locator('[data-grouped-nudge="0"]')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('13 single squad skips heat tile picker', async () => {
      await expect(page.locator('.gov-portfolio-grid-wrap--single')).toBeVisible();
      await expect(page.locator('[data-heat-tile="SD"]')).toHaveCount(0);
      await expect(page.locator('.gov-risk-tile-details--always-open .gov-pulse-bars')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('14 scope selectors expanded by default on desktop', async () => {
      await expect(page.locator('#gov-scope-expanded')).toBeVisible();
      await expect(page.locator('#gov-scope-expanded')).not.toHaveAttribute('hidden');
      assertTelemetryClean(telemetry);
    });

    await test.step('15 copy answer still reachable in cluster mode', async () => {
      await expect(page.locator('#gov-copy-answer-inline')).toBeVisible();
      assertTelemetryClean(telemetry);
    });

    await test.step('16 verdict mount in right column sticky rail', async () => {
      const verdict = page.locator('#gov-verdict-mount');
      const col = await verdict.evaluate((el) => {
        const shell = el.closest('.governance-shell');
        if (!shell) return '';
        const style = getComputedStyle(el);
        return style.gridColumnStart || style.gridColumn || '';
      });
      expect(String(col)).not.toBe('auto');
      assertTelemetryClean(telemetry);
    });

    await test.step('17 proof preview links to sprint issue', async () => {
      const href = await page.locator('.gov-evidence-preview-table a.gov-issue-key-link').first().getAttribute('href');
      expect(href || '').toMatch(/\/current-sprint\?issue=/);
      assertTelemetryClean(telemetry);
    });

    await test.step('18 trust row collapsed; send badge on cluster not duplicated', async () => {
      await expect(page.locator('.gov-command-answer--cluster-mode .gov-trust-part[data-hover-proof="evidence-count"]')).toHaveCount(0);
      await expect(page.locator('.gov-owner-cluster-head .gov-send-badge')).toBeVisible();
      await expect(page.locator('.gov-command-answer--cluster-mode .gov-trust-chip-row .gov-send-badge')).toBeHidden();
      assertTelemetryClean(telemetry);
    });
  });

  test('home dashboard single CTA and brief micro', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: stubBlockedBrief(),
    }));
    await page.route('**/api/current-sprint.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ sprint: { name: 'Sprint 12' }, stories: [], meta: {} }),
    }));
    await page.addInitScript((projectsKey) => {
      try { localStorage.setItem(projectsKey, 'SD'); } catch (_) {}
    }, PROJECTS_SSOT_KEY);

    await page.goto('/home');
    if (await skipIfRedirectedToLogin(page, test)) return;

    await test.step('19 single primary CTA not duplicate Open Brief buttons', async () => {
      await expect(page.locator('#surface-primary-cta')).toHaveCount(1);
      await expect(page.locator('#surface-continue-cta')).toHaveCount(0);
      assertTelemetryClean(telemetry);
    });

    await test.step('20 brief micro line hydrates from API', async () => {
      await expect(page.locator('#surface-verdict-micro')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#surface-verdict-micro')).not.toBeEmpty();
      assertTelemetryClean(telemetry);
    });
  });

  test('report proof surface retains single refresh action', async ({ page }) => {
    const telemetry = captureBrowserTelemetry(page);
    await page.goto('/report');
    if (await skipIfRedirectedToLogin(page, test)) return;
    await expect(page.locator('[data-report-refresh-proof]')).toHaveCount(1);
    assertTelemetryClean(telemetry);
  });
});
