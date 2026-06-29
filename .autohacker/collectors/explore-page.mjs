/**
 * Agnostic adaptive page exploration — discovers interactives, clicks, captures console + shots.
 * Env: BASE_URL, AUTOHACKER_TARGET, AUTOHACKER_RUN_DIR, AUTOHACKER_RUN_ID, HEADLESS=1
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const targetName = process.env.AUTOHACKER_TARGET || 'governance';
const runDir = process.env.AUTOHACKER_RUN_DIR || join(root, '.autohacker', 'runs', process.env.AUTOHACKER_RUN_ID || 'local');
const headless = process.env.HEADLESS === '1' || process.env.CI === '1';

function resolveBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  try {
    if (existsSync(join(root, '.delivera-dev-port'))) {
      const port = Number(readFileSync(join(root, '.delivera-dev-port'), 'utf8').trim());
      if (Number.isFinite(port) && port > 0) return `http://127.0.0.1:${port}`;
    }
  } catch (_) { /* ignore */ }
  return 'http://127.0.0.1:3001';
}

function loadTarget() {
  const cfg = JSON.parse(readFileSync(join(root, '.autohacker', 'config', 'targets.json'), 'utf8'));
  const t = cfg[targetName];
  if (!t) throw new Error(`Unknown target: ${targetName}`);
  return t;
}

const target = loadTarget();
const BASE = resolveBaseUrl();
const path = target.path.startsWith('/') ? target.path : `/${target.path}`;
const url = `${BASE}${path}`;
const shotsDir = join(runDir, 'screenshots');
mkdirSync(shotsDir, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const report = {
  capturedAt: new Date().toISOString(),
  target: targetName,
  url,
  viewports: {},
  brokenInteractions: [],
  consoleIssues: [],
  clickReductionIdeas: [],
  visualUxIssues: [],
  screenshots: [],
  summary: {},
};

const browser = await chromium.launch({ headless });

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const consoleLogs = [];
  const pageErrors = [];
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) consoleLogs.push({ type: m.type(), text: m.text(), viewport: vp.name });
  });
  page.on('pageerror', (e) => pageErrors.push({ message: e.message, viewport: vp.name }));

  await page.addInitScript(() => {
    try { localStorage.setItem('delivera_selectedProjects', 'SD'); } catch (_) {}
    try { localStorage.setItem('delivera_sidebar_collapsed', '1'); } catch (_) {}
    try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (page.url().includes('/login')) {
    report.viewports[vp.name] = { redirectedToLogin: true };
    await page.close();
    continue;
  }
  await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});

  const foldShot = join(shotsDir, `${vp.name}-fold.png`);
  await page.screenshot({ path: foldShot, fullPage: false });
  report.screenshots.push(foldShot);

  await page.evaluate(() => window.scrollTo(0, Math.min(500, document.documentElement.scrollHeight)));
  await page.waitForTimeout(400);
  const scrollShot = join(shotsDir, `${vp.name}-scroll.png`);
  await page.screenshot({ path: scrollShot, fullPage: false });
  report.screenshots.push(scrollShot);

  const layout = await page.evaluate(({ valueAnchors, chromeAnchors }) => {
    const pick = (sels) => {
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (el && el.getBoundingClientRect().height > 2) return el;
      }
      return null;
    };
    const valueEl = pick(valueAnchors);
    const vr = valueEl?.getBoundingClientRect();
    let chromeBottom = 0;
    for (const sel of chromeAnchors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      chromeBottom = Math.max(chromeBottom, el.getBoundingClientRect().bottom);
    }
    return {
      briefState: document.getElementById('main-content')?.getAttribute('data-gov-brief-state'),
      foldDeadBandPx: vr ? Math.max(0, Math.round(vr.top - chromeBottom)) : null,
      valueAnchor: valueEl ? (valueEl.id || String(valueEl.className).slice(0, 40)) : null,
      docScrollHeight: document.documentElement.scrollHeight,
    };
  }, { valueAnchors: target.valueAnchors, chromeAnchors: target.chromeAnchors });

  if (layout.foldDeadBandPx > 150) {
    report.visualUxIssues.push({
      viewport: vp.name,
      issue: 'large_fold_dead_band',
      foldDeadBandPx: layout.foldDeadBandPx,
      rationale: 'Excess vertical gap before primary value block - merge chrome or elevate answer',
    });
    report.clickReductionIdeas.push(`Elevate primary value above fold on ${vp.name}: foldDeadBandPx=${layout.foldDeadBandPx}px - collapse scope chrome or merge hero card`);
  }

  const hiddenInFold = await page.evaluate(() => {
    const items = [];
    document.querySelectorAll('button, a').forEach((el) => {
      const t = (el.textContent || '').trim();
      if (/^open (sprint|evidence)/i.test(t)) items.push(t);
    });
    document.querySelectorAll('[data-tile-detail][hidden]').forEach((el) => {
      items.push(`hidden squad detail: ${el.getAttribute('data-tile-detail')}`);
    });
    return items.slice(0, 15);
  });
  for (const h of hiddenInFold) {
    report.clickReductionIdeas.push(`Surface without click on ${vp.name}: ${h}`);
  }

  const interactives = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('button, a[href], summary, [role="button"], input[type="button"], input[type="submit"]')];
    return nodes.slice(0, 80).map((el, i) => {
      const r = el.getBoundingClientRect();
      const hidden = r.width < 2 || r.height < 2 || el.hidden || getComputedStyle(el).visibility === 'hidden';
      return {
        i,
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        class: (el.className || '').toString().slice(0, 60),
        text: (el.textContent || '').trim().slice(0, 50),
        hidden,
        disabled: !!el.disabled,
        inViewport: r.top >= 0 && r.top < window.innerHeight,
      };
    }).filter((x) => !x.hidden);
  });

  const clickResults = [];
  let tested = 0;
  for (const item of interactives) {
    if (tested >= 25) break;
    if (item.disabled) continue;
    const sel = item.id ? `#${item.id}` : null;
    if (!sel && !item.class) continue;
    const loc = sel ? page.locator(sel).first() : page.locator(`${item.tag}.${item.class.split(/\s+/)[0]}`).first();
    if (await loc.count() === 0) continue;
    tested += 1;
    let ok = true;
    let err = null;
    try {
      await loc.click({ timeout: 3000 });
      await page.waitForTimeout(200);
    } catch (e) {
      ok = false;
      err = String(e.message || e).slice(0, 120);
    }
    clickResults.push({ viewport: vp.name, label: item.text || item.id || item.class, ok, error: err });
    if (!ok) {
      report.brokenInteractions.push({ viewport: vp.name, control: item.text || item.id, error: err });
    }
  }

  for (const c of consoleLogs) {
    report.clickReductionIdeas.push(`Fix console ${c.type} on ${vp.name}: ${(c.text || '').slice(0, 80)}`);
  }
  for (const cr of clickResults.filter((x) => !x.ok)) {
    report.clickReductionIdeas.push(`Repair broken click on ${vp.name}: ${cr.label}`);
  }
  if (layout.docScrollHeight > vp.height * 2) {
    report.clickReductionIdeas.push(`Reduce page height on ${vp.name} (${layout.docScrollHeight}px) - inline queue and evidence`);
  }

  for (const item of interactives.slice(0, 15)) {
    if (item.inViewport) {
      report.clickReductionIdeas.push(`Reduce clicks on ${vp.name}: inline outcome for "${item.text || item.id || 'control'}"`);
    }
  }
  const chipCount = await page.evaluate(() => document.querySelectorAll('.gov-scope-chip, [data-period-chip]').length);
  if (chipCount > 12) {
    report.clickReductionIdeas.push(`Collapse ${chipCount} scope chips on ${vp.name} into selected + overflow menu`);
  }

  report.viewports[vp.name] = { layout, interactivesFound: interactives.length, clicksTested: tested, clickResults };
  for (const c of consoleLogs) report.consoleIssues.push(c);
  for (const e of pageErrors) report.consoleIssues.push({ type: 'pageerror', text: e.message, viewport: vp.name });

  await page.close();
}

await browser.close();

const paddedCount = Math.max(0, 20 - report.clickReductionIdeas.length);
report.summary = {
  brokenCount: report.brokenInteractions.length,
  consoleIssueCount: report.consoleIssues.length,
  visualIssueCount: report.visualUxIssues.length,
  ideaCount: report.clickReductionIdeas.length,
  realIdeaCount: report.clickReductionIdeas.length,
  paddedToTwenty: paddedCount > 0,
  qualityPass: report.clickReductionIdeas.length >= 20 && paddedCount === 0,
};

mkdirSync(runDir, { recursive: true });
const jsonPath = join(runDir, 'exploration-report.json');
const mdPath = join(runDir, 'exploration-report.md');
writeFileSync(jsonPath, JSON.stringify(report, null, 2));

const md = [
  '# Exploration Report',
  `URL: ${url}`,
  `Captured: ${report.capturedAt}`,
  '',
  '## Summary',
  `- Broken interactions: ${report.summary.brokenCount}`,
  `- Console issues: ${report.summary.consoleIssueCount}`,
  `- Visual UX issues: ${report.summary.visualIssueCount}`,
  `- Click reduction ideas: ${report.summary.ideaCount}`,
  '',
  '## Visual UX',
  ...report.visualUxIssues.map((v) => `- [${v.viewport}] ${v.issue}: ${v.rationale} (${v.foldDeadBandPx}px)`),
  '',
  '## Click reduction ideas (sample)',
  ...report.clickReductionIdeas.slice(0, 25).map((x) => `- ${x}`),
].join('\n');
writeFileSync(mdPath, md);

console.log('Wrote', jsonPath);
console.log(JSON.stringify(report.summary, null, 2));
