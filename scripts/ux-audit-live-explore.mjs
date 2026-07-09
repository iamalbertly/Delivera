/**
 * Live UX exploration — governance, current-sprint, actions.
 * Run: node scripts/ux-audit-live-explore.mjs
 */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUT = 'test-results/ux-audit-live-explore.json';

async function explorePage(page, path, interactions) {
  const consoleLogs = [];
  const pageErrors = [];
  const networkFails = [];
  page.on('console', (msg) => consoleLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('response', (res) => {
    if (res.status() >= 400) networkFails.push({ url: res.url(), status: res.status() });
  });

  const t0 = Date.now();
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);

  const layout = await page.evaluate(() => {
    const main = document.getElementById('main-content') || document.querySelector('main');
    const rect = main?.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const chrome = document.querySelector('.app-top-chrome');
    const chromeRect = chrome?.getBoundingClientRect();
    const dialogs = [...document.querySelectorAll('dialog, [role="dialog"], .gov-right-drawer-panel, .work-draft-drawer')].map((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        tag: el.tagName,
        class: el.className?.slice?.(0, 80) || '',
        hidden: el.hidden,
        zIndex: style.zIndex,
        top: r.top,
        height: r.height,
        clippedByChrome: chromeRect ? r.top < chromeRect.bottom && style.position === 'fixed' : false,
      };
    });
    const rightVoid = rect ? Math.max(0, vw - rect.right) / vw : 0;
    return {
      url: location.href,
      docHeight: document.documentElement.scrollHeight,
      viewport: { w: vw, h: vh },
      mainWidth: rect?.width || 0,
      mainRight: rect?.right || 0,
      rightVoidRatio: rightVoid,
      clickable: document.querySelectorAll('button, a[href], summary, [role="button"]').length,
      cadence: document.querySelector('[data-testid="gov-cadence-pack"]')?.innerText?.trim() || null,
      cadenceHealth: document.querySelector('[data-testid="gov-cadence-pack"]')?.getAttribute('data-movement-health') || null,
      portfolioSignal: !!document.querySelector('[data-portfolio-signal]'),
      briefState: document.getElementById('main-content')?.getAttribute('data-gov-brief-state'),
      dialogs,
      duplicateTexts: (() => {
        const texts = new Map();
        document.querySelectorAll('p, span, button, summary, h2, h3').forEach((el) => {
          const t = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
          if (t.length < 12) return;
          texts.set(t, (texts.get(t) || 0) + 1);
        });
        return [...texts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8);
      })(),
    };
  });

  const results = [];
  for (const item of interactions) {
    const loc = page.locator(item.sel).first();
    const count = await loc.count().catch(() => 0);
    if (!count) {
      results.push({ ...item, outcome: 'missing' });
      continue;
    }
    const visible = await loc.isVisible().catch(() => false);
    if (!visible) {
      results.push({ ...item, outcome: 'hidden' });
      continue;
    }
    try {
      await loc.scrollIntoViewIfNeeded({ timeout: 3000 });
      await loc.click({ timeout: 8000 });
      await page.waitForTimeout(600);
      results.push({ ...item, outcome: 'ok' });
    } catch (e) {
      results.push({ ...item, outcome: 'fail', detail: String(e.message).slice(0, 120) });
    }
  }

  return {
    path,
    loadMs: Date.now() - t0,
    layout,
    interactions: results,
    consoleErrors: consoleLogs.filter((l) => l.type === 'error'),
    consoleWarnings: consoleLogs.filter((l) => l.type === 'warning').slice(0, 15),
    pageErrors,
    networkFails: networkFails.slice(0, 20),
  };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.addInitScript(() => {
  try {
    localStorage.setItem('delivera_selectedProjects', 'DMS');
    sessionStorage.setItem('gov-pi-auto-open-dismissed', '1');
  } catch (_) {}
});

const gov = await explorePage(page, '/governance', [
  { label: 'Squad select', sel: 'select[aria-label="Selected squad"]' },
  { label: 'Blocked status chip', sel: '[data-scope-status-action="1"]' },
  { label: 'Baseline dropdown', sel: 'select[aria-label="Baseline"]' },
  { label: 'Portfolio cockpit evidence', sel: '[data-testid="portfolio-cockpit"] button, .portfolio-decision-cockpit button' },
  { label: 'Commitment row', sel: '.portfolio-commitment-row, [data-commitment-row]' },
  { label: 'Action stream queue', sel: '[data-queue-open], button:has-text("intervention")' },
  { label: 'Decision panel confirm', sel: 'button:has-text("Confirm commitment")' },
  { label: 'Nav Squads', sel: 'nav a[href="/current-sprint"]' },
]);

const sprint = await explorePage(page, '/current-sprint', [
  { label: 'Header blocker CTA', sel: '.sprint-intervention-item-primary' },
  { label: 'Role lens', sel: '[data-header-role], button:has-text("View as")' },
  { label: 'Stories card', sel: '#stories-card summary, #stories-card' },
  { label: 'Burndown', sel: '#burndown-card summary, #burndown-card' },
  { label: 'Risks insights', sel: '#risks-insights-card summary, #risks-insights-card' },
  { label: 'Header drawer', sel: '.header-drawer summary, [data-header-drawer]' },
  { label: 'Export', sel: '[data-export-action], button:has-text("Export")' },
  { label: 'Nav Portfolio', sel: 'nav a[href="/governance"]' },
]);

const actions = await explorePage(page, '/actions', [
  { label: 'Ready tab', sel: '.actions-tab[data-tab="ready"]' },
  { label: 'Waiting tab', sel: '.actions-tab[data-tab="waiting"]' },
  { label: 'Escalations tab', sel: '.actions-tab[data-tab="escalations"]' },
  { label: 'Proof tab', sel: '.actions-tab[data-tab="proof"]' },
  { label: 'Blocker nudge', sel: '[data-actions-nudge]' },
  { label: 'Case approve', sel: 'button:has-text("Approve")' },
  { label: 'Nav Actions refresh', sel: '#actions-refresh, button:has-text("Refresh")' },
  { label: 'Nav Portfolio', sel: 'nav a[href="/governance"]' },
]);

// PI baseline slide upload probe
let baselineProbe = { skipped: true };
const slidePath = join(process.cwd(), 'data', 'testing_q2fy27_dms_commitments.png');
if (existsSync(slidePath)) {
  await page.goto(`${BASE}/governance`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const baselineBtn = page.locator('[data-setup-action="set-baseline"], [data-testid="gov-pi-focus-set-baseline"], select[aria-label="Baseline"]').first();
  if (await baselineBtn.count()) {
    try {
      const tag = await baselineBtn.evaluate((el) => el.tagName);
      if (tag === 'SELECT') await baselineBtn.selectOption({ index: 0 });
      else await baselineBtn.click();
      await page.waitForTimeout(1500);
      const input = page.locator('#gov-baseline-slide-input, input[type="file"]').first();
      if (await input.count()) {
        await input.setInputFiles(slidePath);
        await page.waitForTimeout(4000);
        baselineProbe = {
          context: await page.locator('[data-testid="gov-baseline-context"]').innerText().catch(() => ''),
          aligned: await page.locator('[data-testid="gov-baseline-aligned"]').count(),
          extracted: await page.locator('.gov-baseline-extracted li, [data-testid="gov-baseline-row"]').count(),
        };
      } else baselineProbe = { error: 'no file input found' };
    } catch (e) {
      baselineProbe = { error: String(e.message).slice(0, 200) };
    }
  } else baselineProbe = { error: 'no baseline entry point' };
}

mkdirSync('test-results', { recursive: true });
writeFileSync(OUT, JSON.stringify({ auditedAt: new Date().toISOString(), governance: gov, currentSprint: sprint, actions, baselineProbe }, null, 2));
console.log('Wrote', OUT);
console.log('Gov console errors:', gov.consoleErrors.length);
console.log('Sprint console errors:', sprint.consoleErrors.length);
console.log('Actions console errors:', actions.consoleErrors.length);
await browser.close();
