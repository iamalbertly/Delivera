/**
 * UX friction metrics — geometry-based (not DOM-tree-only).
 * Reads target anchors from .autohacker/config/targets.json
 * Env: BASE_URL, AUTOHACKER_TARGET, AUTOHACKER_RUN_DIR, AUTOHACKER_RUN_ID, HEADLESS=1
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const targetName = process.env.AUTOHACKER_TARGET || 'governance';
const runId = process.env.AUTOHACKER_RUN_ID || 'local';
const runDir = process.env.AUTOHACKER_RUN_DIR || join(root, '.autohacker', 'runs', runId);
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
  const cfgPath = join(root, '.autohacker', 'config', 'targets.json');
  const all = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const t = all[targetName];
  if (!t) throw new Error(`Unknown AUTOHACKER_TARGET: ${targetName}`);
  return t;
}

const target = loadTarget();
const BASE = resolveBaseUrl();
const path = target.path.startsWith('/') ? target.path : `/${target.path}`;
const url = `${BASE}${path}`;

const browser = await chromium.launch({ headless });
const viewports = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const snapshot = {
  capturedAt: new Date().toISOString(),
  target: targetName,
  url,
  viewports: {},
};

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.addInitScript(() => {
    try { localStorage.setItem('delivera_selectedProjects', 'SD'); } catch (_) {}
    try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
  });

  const telemetry = { consoleErrors: [], pageErrors: [] };
  page.on('console', (m) => { if (m.type() === 'error') telemetry.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => telemetry.pageErrors.push(e.message));

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (page.url().includes('/login')) {
    snapshot.viewports[vp.name] = { redirectedToLogin: true };
    await page.close();
    continue;
  }
  await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});

  const metrics = await page.evaluate(({ valueAnchors, chromeAnchors }) => {
    const pick = (sels) => {
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (el && el.getBoundingClientRect().height > 2) return el;
      }
      return null;
    };
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const vh = window.innerHeight;
    const valueEl = pick(valueAnchors);
    const valueRect = rect(valueEl);

    let chromeBottom = 0;
    let stickyChromePx = 0;
    for (const sel of chromeAnchors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = rect(el);
      const st = getComputedStyle(el);
      if (!r || r.height < 2) continue;
      if (st.position === 'fixed' || st.position === 'sticky' || r.top <= 120) {
        stickyChromePx += r.height;
        chromeBottom = Math.max(chromeBottom, r.bottom);
      }
    }

    const foldDeadBandPx = valueRect
      ? Math.max(0, Math.round(valueRect.top - chromeBottom))
      : null;

    let scrollToPrimaryValuePx = 0;
    if (valueRect && valueRect.top > vh - 40) {
      scrollToPrimaryValuePx = Math.round(valueRect.top + window.scrollY - stickyChromePx);
    }

    const stickyChromeRatio = vh > 0 ? Math.round((stickyChromePx / vh) * 1000) / 1000 : 0;

    let overlapPxTotal = 0;
    const chromeEls = chromeAnchors.map((s) => document.querySelector(s)).filter(Boolean);
    for (let i = 0; i < chromeEls.length; i++) {
      for (let j = i + 1; j < chromeEls.length; j++) {
        const a = chromeEls[i].getBoundingClientRect();
        const b = chromeEls[j].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 0 && h > 0) overlapPxTotal += Math.round(w * h);
      }
    }

    return {
      pageTitle: document.title,
      briefState: document.getElementById('main-content')?.getAttribute('data-gov-brief-state'),
      docScrollHeight: document.documentElement.scrollHeight,
      viewportH: vh,
      valueAnchor: valueEl ? (valueEl.id || valueEl.className?.toString?.().slice(0, 40)) : null,
      valueTopPx: valueRect ? Math.round(valueRect.top) : null,
      chromeBottomPx: Math.round(chromeBottom),
      foldDeadBandPx,
      scrollToPrimaryValuePx,
      stickyChromePx: Math.round(stickyChromePx),
      stickyChromeRatio,
      overlapPxTotal,
      clickableCount: document.querySelectorAll('button, a[href], summary, [role="button"]').length,
    };
  }, { valueAnchors: target.valueAnchors, chromeAnchors: target.chromeAnchors });

  snapshot.viewports[vp.name] = { ...metrics, telemetry };
  await page.close();
}

await browser.close();

const desktop = snapshot.viewports.desktop || {};
snapshot.scrollToPrimaryValuePx = desktop.scrollToPrimaryValuePx ?? 9999;
snapshot.foldDeadBandPx = desktop.foldDeadBandPx ?? 9999;
snapshot.stickyChromeRatio = desktop.stickyChromeRatio ?? 0.5;
snapshot.overlapPxTotal = desktop.overlapPxTotal ?? 0;
snapshot.brokenClickCount = 0;

mkdirSync(runDir, { recursive: true });
const outPath = join(runDir, 'metrics-snapshot.json');
writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
console.log('Wrote', outPath);
console.log(JSON.stringify({
  scrollToPrimaryValuePx: snapshot.scrollToPrimaryValuePx,
  foldDeadBandPx: snapshot.foldDeadBandPx,
  stickyChromeRatio: snapshot.stickyChromeRatio,
}, null, 2));
