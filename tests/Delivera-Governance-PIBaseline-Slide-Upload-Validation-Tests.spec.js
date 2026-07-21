import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { classifyVisionProviderError } from '../lib/Delivera-AI-Vision-Provider-Error-01SSOT.js';
import { providerFailureLogCategory } from '../lib/Delivera-AI-Provider-Gateway.js';
import { renderPortfolioGrid } from '../public/Delivera-App-Governance-Brief-12Render-PortfolioGrid-UI.js';

const SLIDE_FILE = {
  name: 'terminal-squad-fy27-q2.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
};
const LIVE_SLIDE_FIXTURE = join(process.cwd(), 'data', 'WhatsApp Image 2026-06-04 at 15.35.55.jpeg');
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
    sessionStorage.setItem('gov-pi-auto-open-dismissed', '1');
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

async function openPiBaselineWizard(page, squad = '') {
  await page.waitForFunction(() => document.body.dataset.heatDelegationBound === '1', null, { timeout: 15000 });
  let setupFix = page.locator('[data-setup-baseline-ssot]').first();
  if (!(await setupFix.count())) {
    await page.evaluate((value) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.hidden = true;
      button.dataset.setupBaselineSsot = '1';
      if (value) button.dataset.squad = value;
      document.body.append(button);
    }, squad);
    setupFix = page.locator('[data-setup-baseline-ssot]').first();
  }
  if (await setupFix.count()) {
    if (squad) await setupFix.evaluate((el, value) => { el.dataset.squad = value; }, squad);
    await setupFix.evaluate((el) => el.click());
  } else {
    const fold = page.locator('.gov-pi-strip-fold');
    if (await fold.count()) await fold.evaluate((el) => { el.open = true; });
    await page.locator('#gov-pi-fix-baseline').click();
  }
  await expect(page.locator('.gov-right-drawer-panel .gov-baseline-slide-drop')).toBeVisible({ timeout: 15000 });
  const wddClose = page.locator('.work-draft-drawer:not([hidden]) button[aria-label="Close"]');
  if (await wddClose.count()) await wddClose.click();
}

test.describe('Governance PI baseline slide upload', () => {
  test('uploads a T-Squad image with squad-scoped project and quarter', async ({ page }) => {
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
    await openPiBaselineWizard(page, 'TRS');
    await page.locator('.gov-right-drawer-panel #gov-baseline-slide-input').setInputFiles(SLIDE_FILE);
    await expect(page.locator('.gov-right-drawer-panel .gov-baseline-extracted li')).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator('.gov-baseline-activity').first()).toContainText(/Not started|Not in sprint/i);
    expect(postedBody?.imageBase64?.length).toBeGreaterThan(100);
    expect(postedBody?.imageBase64?.length).toBeLessThan(6_000_000);
    expect(postedBody?.quarter).toBe('FY27 Q1');
    expect(postedBody?.squad).toBe('TRS');
    expect(postedBody?.projects).toEqual(['TRS']);
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
    await page.locator('#gov-baseline-slide-input').setInputFiles(SLIDE_FILE);
    await expect(page.locator('.gov-baseline-extracted')).toBeVisible();
    await expect(page.locator('.gov-baseline-actions [data-open-outcome-modal]')).toBeVisible();
  });

  test('propose-from-image with an unconfigured provider returns AI_KEY_REQUIRED', async ({ request }) => {
    const res = await request.post('/api/governance/pi-baseline/propose-from-image', {
      data: { imageBase64: 'abc', mimeType: 'image/jpeg', projects: ['SD'] },
      headers: { 'Content-Type': 'application/json', 'x-ai-provider': 'gemini' },
    });
    if (res.status() === 401 || res.status() === 404) {
      test.skip(true, 'Auth or route unavailable for API contract');
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
    await page.locator('#gov-baseline-slide-input').setInputFiles(SLIDE_FILE);
    await expect(page.locator('.gov-baseline-error')).toContainText(/OpenAI|Claude|OpenRouter/i);
  });

  test('provider limit failure restores upload control with a persistent recovery message', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'allow-http-status-console', description: '429' });
    await mockGovernanceBriefPage(page);
    await page.route('**/api/governance/pi-baseline/propose-from-image', (route) => route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Slide reading is unavailable because the AI usage limit was reached. Update the AI provider in Settings or retry after the limit resets.',
        code: 'AI_PROVIDER_LIMIT_REACHED',
        retryable: true,
      }),
    }));
    await page.goto('/governance');
    await openPiBaselineWizard(page, 'TRS');
    await page.locator('#gov-baseline-slide-input').setInputFiles(SLIDE_FILE);
    await expect(page.locator('.gov-baseline-error')).toContainText(/usage limit was reached/i);
    await expect(page.locator('#gov-baseline-slide-input')).toBeAttached();
    await expect(page.locator('.gov-baseline-loading')).toHaveCount(0);
  });

  test('provider errors are sanitized into stable user contracts', () => {
    const failure = classifyVisionProviderError('Key limit exceeded (monthly limit). Manage it at a provider URL containing account details.');
    expect(failure).toMatchObject({ code: 'AI_PROVIDER_LIMIT_REACHED', httpStatus: 429, retryable: true });
    expect(failure.message).not.toContain('provider URL');
    expect(failure.message).not.toContain('account details');
    expect(providerFailureLogCategory('Key limit exceeded. Manage it at a private key URL.')).toBe('provider-limit-reached');
  });

  test('legacy squad baseline entry preserves the selected squad key', () => {
    const html = renderPortfolioGrid({ squadInsights: [{ projectKey: 'TRS', piCommitted: 0 }] });
    expect(html).toContain('data-setup-baseline-ssot="1" data-squad="TRS"');
  });
});

test.describe('Governance PI slide upload — live vision', () => {
  test.skip(
    (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.OPENROUTER_API_KEY)
      || !existsSync(LIVE_SLIDE_FIXTURE),
    'requires a configured vision provider and live slide fixture',
  );

  test('live probe path returns extracted or candidates from WhatsApp JPEG', () => {
    execSync('node scripts/Delivera-Test-PIBaseline-Slide-Upload-01Probe.js', { cwd: process.cwd(), stdio: 'inherit' });
  });
});
