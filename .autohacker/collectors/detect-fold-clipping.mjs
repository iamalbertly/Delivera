/**
 * Flags high-value blocks clipped below the fold on desktop governance.
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const targetName = process.env.AUTOHACKER_TARGET || 'governance';
const runDir = process.env.AUTOHACKER_RUN_DIR || join(root, '.autohacker', 'runs', process.env.AUTOHACKER_RUN_ID || 'local');
const headless = process.env.HEADLESS === '1' || process.env.CI === '1';
const maxBelowFold = Number(process.env.MAX_FOLD_CLIPPED_COUNT || 3);

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
  return JSON.parse(readFileSync(join(root, '.autohacker', 'config', 'targets.json'), 'utf8'))[targetName];
}

const VALUE_SELECTORS = [
  '[data-direct-value="evidence"]',
  '[data-direct-value="squad-detail"]',
  '[data-direct-value="sprint-link"]',
  '[data-grouped-send]',
  '.gov-command-answer',
  '[data-promoted-script="1"] details[open]',
];

const target = loadTarget();
const url = `${resolveBaseUrl()}${target.path.startsWith('/') ? target.path : `/${target.path}`}`;

const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => {
  try { localStorage.setItem('delivera_selectedProjects', 'SD'); } catch (_) {}
  try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});

const report = await page.evaluate(({ selectors, foldRatio }) => {
  const foldY = window.innerHeight * foldRatio;
  const clipped = [];
  for (const sel of selectors) {
    document.querySelectorAll(sel).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height < 6) return;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') return;
      if (el.closest('[hidden]')) return;
      if (sel.includes('details') && !el.open) return;
      const belowFold = r.top > foldY;
      const partiallyClipped = r.top < foldY && r.bottom > foldY + 40;
      if (belowFold || partiallyClipped) {
        clipped.push({
          selector: sel,
          topPx: Math.round(r.top),
          bottomPx: Math.round(r.bottom),
          foldY: Math.round(foldY),
          belowFold,
          label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60),
        });
      }
    });
  }
  return {
    foldViewportPx: Math.round(window.innerHeight),
    foldLinePx: Math.round(foldY),
    clippedCount: clipped.length,
    clipped: clipped.slice(0, 25),
  };
}, { selectors: VALUE_SELECTORS, foldRatio: 0.82 });

await browser.close();

const out = {
  capturedAt: new Date().toISOString(),
  url,
  maxFoldClippedCount: maxBelowFold,
  ...report,
  pass: report.clippedCount <= maxBelowFold,
};

mkdirSync(runDir, { recursive: true });
const outPath = join(runDir, 'fold-clipping-report.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Wrote', outPath);
console.log(JSON.stringify({ clippedCount: out.clippedCount, pass: out.pass }, null, 2));
