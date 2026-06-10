/**
 * Governance feature audit v2 — isolated clicks, console capture, negative tests.
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';

async function freshPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const logs = { errors: [], warnings: [], pageErrors: [], apiFails: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') logs.errors.push(m.text());
    if (m.type() === 'warning') logs.warnings.push(m.text());
  });
  page.on('pageerror', (e) => logs.pageErrors.push(e.message));
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.status() >= 400) logs.apiFails.push({ url: r.url(), status: r.status() });
  });
  await page.addInitScript(() => localStorage.setItem('delivera_selectedProjects', 'SD'));
  return { ctx, page, logs };
}

async function gotoBrief(page) {
  await page.goto(`${BASE}/governance`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
  await page.waitForSelector('.gov-scope-status-chip, .gov-owner-cluster, .gov-portfolio-grid-wrap', { timeout: 30000 }).catch(() => {});
}

async function tryClick(page, label, fn) {
  const beforeErrors = [];
  let ok = false;
  let detail = '';
  let observed = {};
  try {
    observed = await fn();
    ok = true;
  } catch (e) {
    detail = String(e.message || e).slice(0, 300);
  }
  await page.waitForTimeout(500);
  return { label, ok, detail, observed };
}

async function runSuite(browser, viewport, mode) {
  const results = [];
  const scenarios = [
    {
      label: 'load-brief',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const state = await page.evaluate(() => ({
          briefState: document.getElementById('main-content')?.getAttribute('data-gov-brief-state'),
          error: document.getElementById('gov-error')?.textContent?.trim(),
          verdict: document.querySelector('.gov-command-answer, .gov-portfolio-banner-line')?.textContent?.slice(0, 80),
          queueRail: !!document.querySelector('#gov-right-rail-mount[data-right-rail-has-queue]'),
          piStrip: document.querySelector('#gov-pi-strip-mount')?.innerText?.slice(0, 60),
        }));
        results.push({ scenario: 'load-brief', ok: state.briefState === 'content', state, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'scope-switch-SD-to-MAS',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'scope MAS', async () => {
          const chip = page.locator('[data-project="MAS"]').first();
          await chip.click({ timeout: 8000 });
          await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 60000 }).catch(() => {});
          return { selected: await page.locator('[data-project="MAS"]').first().getAttribute('aria-pressed') };
        });
        results.push({ scenario: 'scope-switch-SD-to-MAS', ...r, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'compare-add-shift-click',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'compare add', async () => {
          const add = page.locator('[data-compare-add="MAS"]').first();
          if (!(await add.count())) return { skipped: 'no compare tray' };
          await add.click({ modifiers: ['Shift'], timeout: 8000 });
          await page.waitForTimeout(2000);
          const compareRail = await page.locator('#gov-compare-rail-mount [data-compare-rail]').count();
          return { compareRail };
        });
        results.push({ scenario: 'compare-add-shift-click', ...r, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'refresh-brief',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'refresh', async () => {
          await page.locator('#gov-scope-refresh').click({ timeout: 8000 });
          await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 60000 }).catch(() => {});
          return { reloaded: true };
        });
        results.push({ scenario: 'refresh-brief', ...r, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'copy-answer',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'copy answer', async () => {
          const btn = page.locator('#gov-copy-answer-inline, [data-copy-answer]').first();
          if (!(await btn.count())) return { skipped: 'no copy btn' };
          await btn.click({ timeout: 8000 });
          return { text: await btn.textContent() };
        });
        results.push({ scenario: 'copy-answer', ...r, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'open-queue-drawer',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'queue', async () => {
          const q = page.locator('[data-queue-open]').first();
          if (!(await q.count())) return { skipped: 'no queue chip' };
          await q.click({ timeout: 8000 });
          const drawer = await page.locator('.gov-right-drawer-panel, .gov-inbox-drawer').first().isVisible();
          return { drawer };
        });
        results.push({ scenario: 'open-queue-drawer', ...r, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'draft-nudge',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'nudge', async () => {
          const n = page.locator('[data-grouped-nudge]').first();
          if (!(await n.count())) return { skipped: 'no nudge' };
          await n.click({ timeout: 8000 });
          const sheet = await page.locator('.gov-nudge-sheet, .gov-right-drawer-panel').first().isVisible().catch(() => false);
          return { sheet };
        });
        results.push({ scenario: 'draft-nudge', ...r, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'pi-baseline-wizard',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'pi baseline', async () => {
          const fix = page.locator('[data-setup-action="set-baseline"], [data-setup-baseline]').first();
          if (!(await fix.count())) return { skipped: 'no baseline gap' };
          await fix.click({ timeout: 8000 });
          const wizard = await page.locator('.gov-baseline-wizard-title, .gov-right-drawer-panel').first().isVisible();
          return { wizard };
        });
        results.push({ scenario: 'pi-baseline-wizard', ...r, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'proof-chip-hover',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'proof', async () => {
          const p = page.locator('[data-proof-cluster]').first();
          if (!(await p.count())) return { skipped: 'no proof control' };
          await p.click({ timeout: 8000 });
          const evidence = await page.locator('#gov-supporting-evidence[open], .gov-evidence-drawer').first().isVisible().catch(() => false);
          return { evidence };
        });
        results.push({ scenario: 'proof-chip-hover', ...r, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'advanced-scope-drawer',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'advanced scope', async () => {
          const adv = page.locator('#gov-scope-advanced').first();
          if (!(await adv.count())) return { skipped: 'no advanced btn' };
          await adv.click({ timeout: 8000 });
          const drawer = await page.locator('.gov-scope-intel-drawer, .gov-right-drawer-panel').first().isVisible().catch(() => false);
          return { drawer };
        });
        results.push({ scenario: 'advanced-scope-drawer', ...r, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'period-window-14d',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'period 14d', async () => {
          const chip = page.locator('[data-period-chip="14d"]').first();
          if (!(await chip.count())) return { skipped: 'no period chip' };
          await chip.click({ timeout: 8000 });
          await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 60000 }).catch(() => {});
          return { on: await chip.getAttribute('class') };
        });
        results.push({ scenario: 'period-window-14d', ...r, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'mobile-scope-change',
      run: async () => {
        if (mode !== 'mobile') return;
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'scope change', async () => {
          const ch = page.locator('#gov-scope-change').first();
          if (!(await ch.isVisible())) return { skipped: 'desktop expanded scope' };
          await ch.click({ timeout: 8000 });
          return { expanded: await page.locator('#gov-scope-expanded').isVisible() };
        });
        results.push({ scenario: 'mobile-scope-change', ...r, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'negative-double-refresh-no-crash',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'dbl refresh', async () => {
          await page.locator('#gov-scope-refresh').dblclick({ timeout: 8000 });
          await page.waitForTimeout(1500);
          return { briefState: await page.locator('#main-content').getAttribute('data-gov-brief-state') };
        });
        results.push({ scenario: 'negative-double-refresh', ...r, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'negative-rapid-scope-4x',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'rapid scope', async () => {
          for (const pk of ['MAS', 'FIN', 'BIO', 'SD']) {
            await page.locator(`[data-project="${pk}"]`).first().click({ timeout: 5000 }).catch(() => {});
          }
          await page.waitForTimeout(2000);
          const stale = await page.locator('.gov-stale-overlay, [data-brief-stale]').first().isVisible().catch(() => false);
          const loading = await page.locator('#gov-loading').isVisible().catch(() => false);
          return { stale, loading, error: await page.locator('#gov-error:not([hidden])').textContent().catch(() => null) };
        });
        results.push({ scenario: 'negative-rapid-scope-4x', ...r, console: logs });
        await ctx.close();
      },
    },
    {
      label: 'negative-create-work-disabled',
      run: async () => {
        const { ctx, page, logs } = await freshPage(browser, viewport);
        await gotoBrief(page);
        const r = await tryClick(page, 'disabled create', async () => {
          const btn = page.locator('#wdd-create-safe-btn');
          const visible = await btn.isVisible().catch(() => false);
          if (!visible) return { skipped: 'drawer closed' };
          const disabled = await btn.isDisabled();
          await btn.click({ force: true, timeout: 3000 }).catch((e) => ({ forcedClickError: e.message }));
          return { disabled };
        });
        results.push({ scenario: 'negative-create-work-disabled', ...r, console: logs });
        await ctx.close();
      },
    },
  ];

  for (const s of scenarios) await s.run();
  return { mode, viewport, results };
}

const browser = await chromium.launch({ headless: true });
const desktop = await runSuite(browser, { width: 1280, height: 900 }, 'desktop');
const mobile = await runSuite(browser, { width: 375, height: 812 }, 'mobile');
await browser.close();

const out = { auditedAt: new Date().toISOString(), baseUrl: BASE, desktop, mobile };
writeFileSync('test-results/governance-feature-audit-v2.json', JSON.stringify(out, null, 2));

for (const suite of [desktop, mobile]) {
  console.log(`\n=== ${suite.mode} ===`);
  for (const r of suite.results) {
    const errs = r.console?.errors?.length || 0;
    console.log(`${r.ok ? 'OK' : 'FAIL'} ${r.scenario}${r.detail ? ' — ' + r.detail.slice(0, 80) : ''}${errs ? ' [console errors: ' + errs + ']' : ''}`);
  }
}
