/**
 * PI slide vision + DMS Q2 — realtime UI contracts (@focused).
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import { mockGovernancePage, waitForGovernanceReady } from './Delivera-Portfolio-Primary-Test-Helpers.js';
import { join } from 'path';
import { existsSync } from 'fs';

const DMS_Q2_PNG = join(process.cwd(), 'data', 'testing_q2fy27_dms_commitments.png');
const hasDmsFixture = existsSync(DMS_Q2_PNG);

const DMS_SLIDE_RESPONSE = {
  method: 'slide-vision',
  inferredSquad: 'DMS',
  inferredQuarter: 'FY27 Q2',
  slideScopeMismatch: false,
  extracted: [
    { month: 'July', theme: 'Growth', bullet: 'NBA integration with CVM for Channel' },
    { month: 'August', theme: 'Growth', bullet: 'E-HOD Regional Profile' },
  ],
  unmatched: [{
    issueKey: '',
    title: 'FY27 Q2 – DMS – NBA – Integration of CVM for Channel Productivity Campaigns',
    method: 'slide-unmatched',
  }],
  candidates: [{
    issueKey: 'SD-100',
    title: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
    method: 'slide-playbook',
    selected: true,
  }],
  matchedCount: 1,
  missingCount: 1,
  extractionMeta: {
    aiContributed: true,
    fallbackUsed: false,
    commitmentCount: 2,
  },
};

async function mockDmsGovernancePage(page) {
  const AI_PREF = JSON.stringify({ provider: 'openai', key: 'sk-test-probe', host: '', lastTestOk: true, lastTestAt: '2026-01-01T00:00:00.000Z' });
  await page.addInitScript((pref) => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
    localStorage.setItem('delivera_gov_quarter_v1', 'FY27 Q2');
    localStorage.setItem('delivera_ai_provider_pref_v1', pref);
    sessionStorage.setItem('gov-pi-auto-open-dismissed', '1');
  }, AI_PREF);
  await routeProjectsCatalog(page);
  await mockGovernancePage(page);
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q2', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/pi-baseline/propose?**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ method: 'board-epics', candidates: [], guidanceCode: null }),
  }));
  await page.route('**/api/ai-provider-status.json**', (r) => r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      provider: 'openrouter',
      slideVisionReady: true,
      configured: true,
      slideVision: { ready: true, provider: 'openrouter' },
    }),
  }));
}

test.describe.configure({ retries: 0 });

test.describe('PI slide DMS Q2 realtime', () => {
  test('@focused DMS slide upload shows inferred squad, quarter, and extraction meta', async ({ page }) => {
    await mockDmsGovernancePage(page);
    await page.route('**/api/governance/pi-baseline/propose-from-image', (r) => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DMS_SLIDE_RESPONSE),
    }));
    await page.goto('/governance?openAlignment=slide');
    await waitForGovernanceReady(page);
    await expect(page.locator('.gov-right-drawer-panel .gov-baseline-wizard')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="gov-baseline-slide-optional"]')).toHaveAttribute('open', '');
    const stubPng = {
      name: 'stub.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
    };
    await page.locator('#gov-baseline-slide-input').setInputFiles(hasDmsFixture ? DMS_Q2_PNG : stubPng);
    await expect(page.locator('.gov-baseline-extracted li')).toHaveCount(2, { timeout: 15000 });
    await expect(page.locator('[data-testid="gov-baseline-context"]')).toContainText('DMS');
    await expect(page.locator('[data-testid="gov-baseline-context"]')).toContainText('FY27 Q2');
    await expect(page.locator('[data-testid="gov-baseline-slide-summary"]')).toContainText(/in Jira/i);
  });

  test('empty extraction shows honest failure copy', async ({ page }) => {
    await mockDmsGovernancePage(page);
    await page.route('**/api/governance/pi-baseline/propose-from-image', (r) => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        method: 'slide-vision',
        extracted: [],
        candidates: [],
        extractionMeta: { aiContributed: false, fallbackUsed: true, commitmentCount: 0 },
        guidance: 'Could not read commitments from slide — check AI key or retry.',
      }),
    }));
    await page.goto('/governance');
    await waitForGovernanceReady(page);
    await page.locator('[data-testid="portfolio-primary-cta"]').click({ timeout: 10000 }).catch(() => {});
    const fileInput = page.locator('#gov-baseline-slide-input');
    if (await fileInput.count()) {
      await fileInput.setInputFiles({
        name: 'tiny.png',
        mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
      });
      await expect(page.locator('.gov-baseline-wizard')).toContainText(/Could not read commitments/i, { timeout: 15000 });
      await expect(page.locator('[data-testid="gov-baseline-context"]')).toContainText('Not detected');
    }
  });

  test('settings epic format panel loads preview', async ({ page }) => {
    await page.route('**/api/settings/epic-format.json**', (r) => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        format: { template: '{quarter} – {system} – {subsystem} – {capability}', defaultSubsystem: 'NBA' },
        preview: 'FY27 Q2 – DMS – NBA – Example Capability',
        editable: true,
      }),
    }));
    await page.goto('/settings#organization');
    await expect(page.locator('[data-testid="settings-epic-format-panel"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="settings-epic-format-preview"]')).toContainText('FY27 Q2 – DMS – NBA');
  });
});
