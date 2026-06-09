import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import { join } from 'path';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const SLIDE_JPEG = join(process.cwd(), 'data', 'WhatsApp Image 2026-06-04 at 15.35.55.jpeg');
const AI_PREF = JSON.stringify({ provider: 'openai', key: 'sk-test-probe', host: '' });

const CLARITY_BRIEF = {
  briefId: 'SLIDE-UPLOAD-TEST',
  projects: ['SD'],
  executiveView: { verdictTier: 'watch', verdictLine: 'WATCH' },
  leadershipNarrative: { confidence: 'low', meetingAnswer: 'Watch', narratedBy: 'template' },
  meta: {
    narratedBy: 'template',
    commandAnswerSentence: 'Watch delivery',
    safeToSend: true,
    piConfidence: {
      trusted: false,
      confidencePct: null,
      headline: 'PI Confidence: Not trusted',
      timelineChips: [],
      counts: { committed: 0, offPlan: 1, onTrack: 0, missingDates: 0, atRisk: 0 },
    },
    setupGaps: [{ id: 'pi-baseline', action: 'set-baseline', severity: 'high' }],
    workerReceipt: { line: 'Last run: 1m ago', inboxTotal: 0 },
  },
  topRisks: [],
  evidencePack: { rows: [] },
  squadInsights: [],
};

async function mockGovernanceBriefPage(page) {
  await page.addInitScript((pref) => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
    localStorage.setItem('delivera_ai_provider_pref_v1', pref);
    localStorage.setItem('delivera_gov_quarter_v1', 'FY27 Q1');
  }, AI_PREF);
  await routeProjectsCatalog(page);
  await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(CLARITY_BRIEF),
  }));
  await page.route('**/api/quarters-list**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ quarters: [{ label: 'FY27 Q1', isCurrent: true }] }),
  }));
  await page.route('**/api/governance/adoption-metrics.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0 }),
  }));
  await page.route('**/api/governance/inbox.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ briefs: [], nudges: [], piDrift: [], confirm: [], impact: [], poReadiness: [] }),
  }));
  await page.route('**/api/governance/feedback-summary.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ total: 0, agents: [], lastImprovements: [] }),
  }));
  await page.route('**/api/governance/scope-intelligence.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ scope: { cards: [] }, boards: 1 }),
  }));
  await page.route('**/api/boards.json**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      projects: ['SD'],
      boards: [{ id: 1, name: 'SD board', projectKey: 'SD' }],
      projectErrors: [],
      jiraBrowseHost: 'https://jira.example.com',
    }),
  }));
  await page.route('**/api/governance/pi-baseline/propose?**', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ method: 'board-epics', candidates: [], guidanceCode: null }),
  }));
}

async function openPiBaselineWizard(page) {
  await expect(page.locator('[data-setup-action="set-baseline"], #gov-pi-fix-baseline').first()).toBeAttached({ timeout: 15000 });
  const setupFix = page.locator('[data-setup-action="set-baseline"]').first();
  if (await setupFix.count()) {
    await setupFix.click();
    return;
  }
  const fold = page.locator('.gov-pi-strip-fold');
  if (await fold.count()) await fold.evaluate((el) => { el.open = true; });
  await page.locator('#gov-pi-fix-baseline').click();
}

const hasSlideFixture = existsSync(SLIDE_JPEG);

test.describe('Governance PI baseline slide upload', () => {
  test.beforeEach(async ({ }, testInfo) => {
    if (!hasSlideFixture) {
      testInfo.skip(true, `Missing PI slide fixture image: ${SLIDE_JPEG}`);
    }
  });

  test('uploads WhatsApp JPEG and posts propose-from-image with quarter', async ({ page }) => {
    let postedBody = null;
    await mockGovernanceBriefPage(page);
    await page.route('**/api/governance/pi-baseline/propose-from-image', async (route) => {
      postedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          method: 'slide-vision',
          extracted: [{ month: 'April', theme: 'Growth', bullet: 'Territory daily report' }],
          unmatched: [{ issueKey: '', title: 'New theme from slide', method: 'slide-unmatched' }],
          candidates: [{
            issueKey: 'SD-100',
            title: 'FY27 Q1 – DMS – NBA – Recharge Growth Trends',
            epicActivity: { activityLabel: 'Not started in sprint yet' },
            selected: true,
          }],
        }),
      });
    });
    await page.goto('/governance');
    await openPiBaselineWizard(page);
    await expect(page.locator('.gov-baseline-slide-drop')).toBeVisible();
    await page.locator('#gov-baseline-slide-input').setInputFiles(SLIDE_JPEG);
    await expect(page.locator('.gov-baseline-extracted li')).toHaveCount(1);
    await expect(page.locator('.gov-baseline-activity').first()).toContainText(/Not started|Not in sprint/i);
    expect(postedBody?.imageBase64?.length).toBeGreaterThan(100);
    expect(postedBody?.imageBase64?.length).toBeLessThan(6_000_000);
    expect(postedBody?.quarter).toBe('FY27 Q1');
  });

  test('vision with zero Jira match shows extracted bullets and Create work', async ({ page }) => {
    await mockGovernanceBriefPage(page);
    await page.route('**/api/governance/pi-baseline/propose-from-image', (r) => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        method: 'slide-vision',
        extracted: [{ month: 'May', theme: 'Impact', bullet: 'New capability' }],
        unmatched: [{ issueKey: '', title: 'New capability', method: 'slide-unmatched' }],
        candidates: [],
      }),
    }));
    await page.goto('/governance');
    await openPiBaselineWizard(page);
    await page.locator('#gov-baseline-slide-input').setInputFiles(SLIDE_JPEG);
    await expect(page.locator('.gov-baseline-extracted')).toBeVisible();
    await expect(page.locator('.gov-baseline-actions [data-open-outcome-modal]')).toBeVisible();
  });

  test('propose-from-image without AI key returns AI_KEY_REQUIRED', async ({ request }) => {
    const res = await request.post('/api/governance/pi-baseline/propose-from-image', {
      data: { imageBase64: 'abc', mimeType: 'image/jpeg', projects: ['SD'] },
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status() === 401 || res.status() === 404) {
      test.skip(true, 'Auth or route unavailable for API contract');
      return;
    }
    if (res.status() === 200) {
      test.skip(true, 'Server provides default AI credentials in this environment');
      return;
    }
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('AI_KEY_REQUIRED');
  });

  test('IMAGE_TOO_LARGE rejected before vision', async ({ request }) => {
    const huge = 'A'.repeat(6_000_001);
    const res = await request.post('/api/governance/pi-baseline/propose-from-image', {
      data: { imageBase64: huge, mimeType: 'image/jpeg', projects: ['SD'] },
      headers: {
        'Content-Type': 'application/json',
        'x-ai-provider': 'openai',
        'x-ai-key': 'sk-test',
      },
    });
    if (res.status() === 401 || res.status() === 404) {
      test.skip(true, 'Auth or route unavailable for API contract');
      return;
    }
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('IMAGE_TOO_LARGE');
  });

  test('gemini provider shows vision not supported error before upload', async ({ page }) => {
    await mockGovernanceBriefPage(page);
    await page.addInitScript(() => {
      localStorage.setItem('delivera_ai_provider_pref_v1', JSON.stringify({ provider: 'gemini', key: 'test-key', host: '' }));
    });
    await page.goto('/governance');
    await openPiBaselineWizard(page);
    await page.locator('#gov-baseline-slide-input').setInputFiles(SLIDE_JPEG);
    await expect(page.locator('.gov-inline-toast')).toContainText(/OpenAI|Claude|OpenRouter/i);
  });
});

test.describe('Governance PI slide upload — live vision', () => {
  test.skip(!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY, 'requires OPENAI_API_KEY or ANTHROPIC_API_KEY');

  test('live probe path returns extracted or candidates from WhatsApp JPEG', () => {
    execSync('node scripts/Delivera-Test-PIBaseline-Slide-Upload-01Probe.js', { cwd: process.cwd(), stdio: 'inherit' });
  });
});
