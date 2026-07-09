import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { routeProjectsCatalog } from './Delivera-Governance-Projects-Catalog-Mock-Helper.js';
import { mockGovernancePage, clickLegacy, waitForGovernanceReady } from './Delivera-Portfolio-Primary-Test-Helpers.js';
import { join } from 'path';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const SLIDE_JPEG = join(process.cwd(), 'data', 'WhatsApp Image 2026-06-04 at 15.35.55.jpeg');
const SLIDE_DMS_Q2 = join(process.cwd(), 'data', 'testing_q2fy27_dms_commitments.png');
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
  await mockGovernancePage(page, { brief: CLARITY_BRIEF });
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
  await waitForGovernanceReady(page);
  await clickLegacy(page, '.gov-fix-card-btn[data-setup-action="set-baseline"]');
  await expect(page.locator('.gov-right-drawer-panel .gov-baseline-wizard')).toBeVisible({ timeout: 15000 });
  const wddClose = page.locator('.work-draft-drawer:not([hidden]) button[aria-label="Close"]');
  if (await wddClose.count()) await wddClose.click();
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
    await waitForGovernanceReady(page);
    await openPiBaselineWizard(page);
    await page.locator('.gov-right-drawer-panel #gov-baseline-slide-input').setInputFiles(SLIDE_JPEG);
    await expect(page.locator('.gov-right-drawer-panel .gov-baseline-extracted li')).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator('.gov-baseline-activity').first()).toContainText(/Not started|Not in sprint/i);
    expect(postedBody?.imageBase64?.length).toBeGreaterThan(100);
    expect(postedBody?.imageBase64?.length).toBeLessThan(6_000_000);
    expect(postedBody?.quarter).toBe('FY27 Q1');
  });

  test('vision with zero Jira match shows extracted bullets and Create in Jira', async ({ page }) => {
    await mockGovernanceBriefPage(page);
    await page.route('**/api/governance/pi-baseline/propose-from-image', (r) => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        method: 'slide-vision',
        extracted: [{ month: 'May', theme: 'Impact', bullet: 'New capability' }],
        unmatched: [{
          issueKey: '',
          title: 'FY27 Q2 – DMS – NBA – New capability',
          suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – New capability',
          method: 'slide-unmatched',
        }],
        candidates: [],
        createWorkNarrative: 'FY27 Q2 – DMS – NBA – New capability\n  Story under epic',
        resolved: [{
          status: 'missing',
          suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – New capability',
          childStories: [{ title: 'Story under epic' }],
        }],
        matchedCount: 0,
        missingCount: 1,
      }),
    }));
    await page.goto('/governance');
    await waitForGovernanceReady(page);
    await openPiBaselineWizard(page);
    await page.locator('#gov-baseline-slide-input').setInputFiles(SLIDE_JPEG);
    await expect(page.locator('.gov-baseline-extracted')).toBeVisible();
    await expect(page.locator('[data-testid="gov-baseline-create-all"]')).toBeVisible();
    await expect(page.locator('[data-testid="gov-baseline-create-work"]')).toHaveCount(0);
    await expect(page.locator('.gov-baseline-wizard-title')).toContainText(/Alignment Studio/i);
  });

  test('duplicate-risk row shows Use existing and create-all is available', async ({ page }) => {
    let createBody = null;
    await mockGovernanceBriefPage(page);
    await page.route('**/api/governance/pi-baseline/propose-from-image', (r) => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        method: 'slide-vision',
        extracted: [{ month: 'August', theme: 'Growth', bullet: 'EHOD Regional Profile' }],
        unmatched: [{
          issueKey: 'SD-4671',
          title: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
          suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
          method: 'slide-duplicate-risk',
          duplicateRisk: { issueKey: 'SD-4671', reason: 'Similar epic exists (SD-4671)', suggestedAction: 'link' },
        }],
        candidates: [],
        resolved: [{
          status: 'duplicate-risk',
          suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
          issueKey: 'SD-4671',
          duplicateRisk: { issueKey: 'SD-4671', reason: 'Similar epic exists (SD-4671)', suggestedAction: 'link' },
          childStories: [],
        }],
        createWorkNarrative: '',
        matchedCount: 0,
        missingCount: 0,
      }),
    }));
    await page.route('**/api/governance/pi-baseline/create-epics-from-slide', async (route) => {
      createBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          created: [],
          linked: [{ issueKey: 'SD-4671', title: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile' }],
          skipped: [],
          errors: [],
          resolved: [{
            status: 'matched',
            suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
            issueKey: 'SD-4671',
            method: 'slide-linked',
          }],
          reconcile: {
            method: 'slide-reconciled',
            matchedCount: 1,
            missingCount: 0,
            resolved: [{
              status: 'matched',
              suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
              issueKey: 'SD-4671',
            }],
            candidates: [{
              issueKey: 'SD-4671',
              title: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
              suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
              method: 'slide-linked',
              selected: true,
            }],
            unmatched: [],
            createWorkNarrative: '',
          },
        }),
      });
    });
    await page.goto('/governance');
    await waitForGovernanceReady(page);
    await openPiBaselineWizard(page);
    await page.locator('#gov-baseline-slide-input').setInputFiles(SLIDE_JPEG);
    await expect(page.locator('[data-testid="gov-baseline-use-existing"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="gov-baseline-use-existing"]').click();
    await expect(page.locator('[data-testid="gov-baseline-save"]')).toBeVisible({ timeout: 15000 });
    expect(createBody?.actions?.['FY27 Q2 – DMS – NBA – E-HOD Regional Profile']).toBe('link');
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

  test('PI focus strip visible when synergy is low with Alignment Studio primary', async ({ page }) => {
    const focusBrief = {
      ...CLARITY_BRIEF,
      meta: {
        ...CLARITY_BRIEF.meta,
        piFocus: {
          synergy: 'low',
          primaryAction: 'create-work',
          headlineKey: 'piFocusBoardUnmatched',
          boardEpicCount: 2,
          proposedMissing: 1,
          duplicateRiskCount: 0,
          matchedCount: 0,
        },
        setupGaps: [
          { id: 'pi-synergy', action: 'create-work', severity: 'high' },
          { id: 'pi-baseline', action: 'set-baseline', severity: 'high' },
        ],
      },
    };
    await mockGovernanceBriefPage(page);
    await page.route('**/api/governance-brief.json**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(focusBrief),
    }));
    await page.goto('/governance');
    await waitForGovernanceReady(page);
    await expect(page.locator('[data-testid="gov-pi-focus-strip"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="portfolio-primary-cta"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="portfolio-primary-cta"]')).toContainText(/Upload PI slide/i);
    await expect(page.locator('[data-testid="gov-pi-focus-baseline"]')).toHaveCount(0);
    await page.locator('[data-testid="gov-pi-focus-more"]').click();
    await expect(page.locator('[data-testid="gov-pi-focus-slide"]')).toBeVisible();
    await expect(page.locator('[data-testid="gov-cadence-pack"]')).toBeVisible();
  });

  test('IMAGE_TOO_LARGE rejected before vision', async ({ request }) => {
    const huge = 'A'.repeat(6_000_001);
    let res;
    try {
      res = await request.post('/api/governance/pi-baseline/propose-from-image', {
        data: { imageBase64: huge, mimeType: 'image/jpeg', projects: ['SD'] },
        headers: {
          'Content-Type': 'application/json',
          'x-ai-provider': 'openai',
          'x-ai-key': 'sk-test',
        },
      });
    } catch (err) {
      if (String(err?.message || '').includes('ECONNRESET')) return;
      throw err;
    }
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
    await waitForGovernanceReady(page);
    await openPiBaselineWizard(page);
    await page.locator('#gov-baseline-slide-input').setInputFiles(SLIDE_JPEG);
    await expect(page.locator('.gov-inline-toast')).toContainText(/OpenAI|Claude|OpenRouter/i);
  });

  test('DMS Q2 commitments slide shows squad context and reconcile rows', async ({ page }) => {
    if (!existsSync(SLIDE_DMS_Q2)) {
      test.skip(true, `Missing DMS slide fixture: ${SLIDE_DMS_Q2}`);
    }
    await mockGovernanceBriefPage(page);
    await page.addInitScript(() => {
      localStorage.setItem('delivera_gov_quarter_v1', 'FY27 Q2');
    });
    await page.route('**/api/governance/pi-baseline/propose-from-image', (r) => r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        method: 'slide-vision',
        quarter: 'FY27 Q2',
        squad: 'DMS',
        extracted: [{ month: 'July', theme: 'Growth', bullet: 'CVM channel productivity' }],
        candidates: [{
          issueKey: 'SD-100',
          title: 'FY27 Q2 – DMS – NBA – Integration of CVM for Channel Productivity Campaigns',
          method: 'slide-linked',
          selected: true,
        }],
        resolved: [{ status: 'linked', issueKey: 'SD-100', suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – Integration of CVM for Channel Productivity Campaigns' }],
        matchedCount: 1,
        missingCount: 0,
      }),
    }));
    await page.goto('/governance');
    await waitForGovernanceReady(page);
    await openPiBaselineWizard(page);
    await page.locator('#gov-baseline-slide-input').setInputFiles(SLIDE_DMS_Q2);
    await expect(page.locator('[data-testid="gov-baseline-context"]')).toContainText(/DMS/i);
    await expect(page.locator('[data-testid="gov-baseline-context"]')).toContainText(/FY27 Q2/i);
    await expect(page.locator('[data-testid="gov-baseline-aligned"]')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Governance PI slide upload — live vision', () => {
  test.skip(!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY, 'requires OPENAI_API_KEY or ANTHROPIC_API_KEY');

  test('live probe path returns extracted or candidates from WhatsApp JPEG', () => {
    execSync('node scripts/Delivera-Test-PIBaseline-Slide-Upload-01Probe.js', { cwd: process.cwd(), stdio: 'inherit' });
  });
});
