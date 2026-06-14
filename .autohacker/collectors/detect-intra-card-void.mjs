/**
 * Detects large vertical gaps inside primary content cards (not chrome-to-value fold).
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const targetName = process.env.AUTOHACKER_TARGET || 'governance';
const runDir = process.env.AUTOHACKER_RUN_DIR || join(root, '.autohacker', 'runs', process.env.AUTOHACKER_RUN_ID || 'local');
const maxVoidPx = Number(process.env.MAX_INTRA_CARD_VOID_PX || 120);
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
  return JSON.parse(readFileSync(join(root, '.autohacker', 'config', 'targets.json'), 'utf8'))[targetName];
}

const CARD_SELECTORS = [
  '.gov-portfolio-grid-wrap--single',
  '.gov-portfolio-grid-wrap',
  '#gov-scope-expanded',
  '.gov-owner-cluster',
  '.gov-command-answer',
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

const voids = await page.evaluate(({ selectors, maxGap }) => {
  const results = [];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const children = [...el.children].filter((c) => c.getBoundingClientRect().height > 8);
    if (children.length < 2) continue;
    for (let i = 0; i < children.length - 1; i++) {
      const a = children[i].getBoundingClientRect();
      const b = children[i + 1].getBoundingClientRect();
      const gap = Math.round(b.top - a.bottom);
      if (gap > maxGap) {
        results.push({
          container: sel,
          gapPx: gap,
          between: `${children[i].className?.toString?.().slice(0, 40) || children[i].tagName} -> ${children[i + 1].className?.toString?.().slice(0, 40) || children[i + 1].tagName}`,
        });
      }
    }
    const r = el.getBoundingClientRect();
    const contentBottom = Math.max(...children.map((c) => c.getBoundingClientRect().bottom));
    const innerVoid = Math.round(r.bottom - contentBottom);
    if (innerVoid > maxGap) {
      results.push({ container: sel, gapPx: innerVoid, between: 'content-to-container-bottom' });
    }
  }
  return results;
}, { selectors: CARD_SELECTORS, maxGap: maxVoidPx });

await browser.close();

const report = {
  capturedAt: new Date().toISOString(),
  url,
  maxVoidPxThreshold: maxVoidPx,
  voidCount: voids.length,
  maxVoidPx: voids.reduce((m, v) => Math.max(m, v.gapPx), 0),
  voids,
};

mkdirSync(runDir, { recursive: true });
const outPath = join(runDir, 'intra-card-void-report.json');
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log('Wrote', outPath);
console.log(JSON.stringify({ voidCount: report.voidCount, maxVoidPx: report.maxVoidPx }, null, 2));