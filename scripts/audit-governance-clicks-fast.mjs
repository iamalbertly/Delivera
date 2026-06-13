/**
 * Fast governance click sweep — key controls only, real server.
 * Run: node scripts/audit-governance-clicks-fast.mjs
 */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUT = 'test-results/governance-click-audit-fast.json';

const KEY_SELECTORS = [
  { id: 'gov-copy-answer-scope', label: 'Copy answer' },
  { id: 'gov-scope-refresh', label: 'Refresh' },
  { id: 'gov-scope-change', label: 'Change scope' },
  { id: 'gov-scope-status-action', label: 'Status chip jump', attr: 'data-scope-status-action' },
  { sel: '[data-proof-cluster]', label: 'Proof cluster' },
  { sel: '[data-setup-action="set-baseline"]', label: 'Fix PI baseline' },
  { sel: '[data-queue-open]', label: 'Queue open' },
  { sel: '[data-compare-add]', label: 'Compare add', first: true },
  { sel: '#gov-supporting-evidence summary', label: 'Supporting evidence' },
  { sel: '[data-investment-open]', label: 'Investment lens' },
  { sel: '.gov-inbox-inline-approve', label: 'Inline approve', first: true },
  { sel: '#gov-pi-fix-baseline', label: 'PI fix baseline' },
  { sel: '[data-drawer-tab="investment"]', label: 'Drawer investment tab' },
  { sel: 'nav a[href="/current-sprint"]', label: 'Nav Today' },
  { sel: 'nav a[href="/report"]', label: 'Nav Proof' },
  { sel: '#gov-setup-gaps-expand', label: 'Setup gaps expand' },
];

async function auditMode(browser, mode) {
  const context = await browser.newContext({ viewport: mode });
  const page = await context.newPage();
  const consoleLogs = [];
  const pageErrors = [];
  const networkFails = [];
  const perf = { domContentLoaded: 0, briefReady: 0, firstPaint: 0 };

  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text(), mode: mode.name });
  });
  page.on('pageerror', (err) => pageErrors.push({ message: err.message, mode: mode.name }));
  page.on('response', (res) => {
    if (res.status() >= 400) networkFails.push({ url: res.url(), status: res.status(), mode: mode.name });
  });

  await page.addInitScript(() => {
    localStorage.setItem('delivera_selectedProjects', 'SD');
    sessionStorage.setItem('gov-pi-auto-open-dismissed', '1');
  });

  const t0 = Date.now();
  const resp = await page.goto(`${BASE}/governance`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  perf.domContentLoaded = Date.now() - t0;

  if (page.url().includes('/login')) {
    await context.close();
    return { mode: mode.name, redirectedToLogin: true, consoleLogs, pageErrors, networkFails };
  }

  await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
  perf.briefReady = Date.now() - t0;

  const loadState = await page.evaluate(() => ({
    briefState: document.getElementById('main-content')?.getAttribute('data-gov-brief-state'),
    errorVisible: !document.getElementById('gov-error')?.hidden,
    errorText: document.getElementById('gov-error')?.textContent?.trim() || null,
    heroSquad: !!document.querySelector('[data-hero-squad]'),
    scopeExpanded: document.getElementById('gov-scope-expanded')?.hasAttribute('hidden') === false,
    stickyAnswer: !!document.querySelector('.gov-sticky-answer-bar'),
    clickableCount: document.querySelectorAll('button, a[href], [role="button"], summary').length,
  }));

  const clicks = [];
  for (const item of KEY_SELECTORS) {
    let loc;
    if (item.id) loc = page.locator(`#${item.id}`);
    else if (item.attr) loc = page.locator(`[${item.attr}="1"]`).first();
    else loc = item.first ? page.locator(item.sel).first() : page.locator(item.sel);

    const count = await loc.count().catch(() => 0);
    if (!count) {
      clicks.push({ label: item.label, outcome: 'missing' });
      continue;
    }
    const visible = await loc.isVisible().catch(() => false);
    if (!visible) {
      clicks.push({ label: item.label, outcome: 'hidden' });
      continue;
    }

    const beforeConsole = consoleLogs.filter((l) => l.type === 'error').length;
    let outcome = 'ok';
    let detail = '';
    try {
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 });
      await loc.click({ timeout: 8000 });
      await page.waitForTimeout(500);
    } catch (e) {
      outcome = 'fail';
      detail = String(e.message || e).slice(0, 180);
    }
    const afterErrors = consoleLogs.filter((l) => l.type === 'error').length - beforeConsole;
    clicks.push({ label: item.label, outcome, detail, newConsoleErrors: afterErrors });
    await page.keyboard.press('Escape').catch(() => {});
    if (page.url().includes('/login') || !page.url().includes('/governance')) {
      await page.goto(`${BASE}/governance`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
    }
  }

  const negative = [];
  try {
    await page.locator('#gov-scope-refresh').dblclick({ timeout: 3000 });
    await page.waitForTimeout(600);
    negative.push({ test: 'double-refresh', state: await page.locator('#main-content').getAttribute('data-gov-brief-state') });
  } catch (e) {
    negative.push({ test: 'double-refresh', outcome: 'fail', detail: String(e.message) });
  }

  if (mode.name === 'mobile') {
    try {
      const change = page.locator('#gov-scope-change');
      if (await change.isVisible()) {
        await change.click();
        await page.waitForTimeout(400);
        negative.push({
          test: 'mobile-scope-sheet',
          sheetOpen: await page.locator('.gov-right-drawer-panel--scope-sheet').isVisible(),
        });
        await page.keyboard.press('Escape');
      }
    } catch (e) {
      negative.push({ test: 'mobile-scope-sheet', outcome: 'fail', detail: String(e.message) });
    }
  }

  try {
    await page.evaluate(() => document.getElementById('gov-hidden-create-work')?.click());
    negative.push({ test: 'hidden-create-work', modal: await page.locator('dialog, [data-outcome-modal]').first().isVisible().catch(() => false) });
    await page.keyboard.press('Escape');
  } catch (e) {
    negative.push({ test: 'hidden-create-work', outcome: 'fail' });
  }

  const scrollDepth = await page.evaluate(() => ({
    docHeight: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
    aboveFoldClusters: !!document.querySelector('#gov-action-clusters-mount .gov-owner-cluster'),
    evidenceOpen: document.getElementById('gov-supporting-evidence')?.open,
  }));

  await context.close();
  return {
    mode: mode.name,
    viewport: mode,
    perf,
    loadState,
    scrollDepth,
    clicks,
    failures: clicks.filter((c) => c.outcome === 'fail'),
    missing: clicks.filter((c) => c.outcome === 'missing'),
    consoleErrors: consoleLogs.filter((l) => l.type === 'error'),
    consoleWarnings: consoleLogs.filter((l) => l.type === 'warning'),
    pageErrors,
    networkFails: networkFails.filter((n) => n.url.includes('/api/')),
    negative,
  };
}

mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
const desktop = await auditMode(browser, { name: 'desktop', width: 1280, height: 900 });
const mobile = await auditMode(browser, { name: 'mobile', width: 375, height: 812 });
await browser.close();

const report = { auditedAt: new Date().toISOString(), baseUrl: BASE, desktop, mobile };
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('Wrote', OUT);
console.log('Desktop fails:', desktop.failures?.length ?? 'login');
console.log('Mobile fails:', mobile.failures?.length ?? 'login');
console.log('Desktop console errors:', desktop.consoleErrors?.length ?? 0);
console.log('Mobile console errors:', mobile.consoleErrors?.length ?? 0);
