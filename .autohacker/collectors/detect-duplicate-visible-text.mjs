/**
 * Detects duplicate visible copy in governance main column (same risk/title repeated).
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const targetName = process.env.AUTOHACKER_TARGET || 'governance';
const runDir = process.env.AUTOHACKER_RUN_DIR || join(root, '.autohacker', 'runs', process.env.AUTOHACKER_RUN_ID || 'local');
const headless = process.env.HEADLESS === '1' || process.env.CI === '1';
const CATALOG_FULL = process.env.AUTOHACKER_CATALOG === 'full';
const FULL_KEYS = ['MPSA', 'MAS', 'RPA', 'MVA', 'ASG', 'FIN', 'SD', 'MPSA2', 'TRS', 'VB', 'AMS2', 'BIO'];

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

const target = loadTarget();
const url = `${resolveBaseUrl()}${target.path.startsWith('/') ? target.path : `/${target.path}`}`;
const catalogSeed = CATALOG_FULL ? FULL_KEYS.join(',') : 'SD';

const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript((seed) => {
  try { localStorage.setItem('delivera_selectedProjects', seed); } catch (_) {}
  try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
}, catalogSeed);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});

const report = await page.evaluate(() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && st.opacity !== '0';
  };
  const main = document.querySelector('#main-content') || document.body;
  const buckets = new Map();
  const push = (text, ctx) => {
    const key = norm(text);
    if (!key || key.length < 6) return;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(ctx);
  };

  main.querySelectorAll('li, p, h2, h3, .gov-heat-key, .gov-command-answer').forEach((el) => {
    if (!visible(el)) return;
    const text = (el.textContent || '').trim();
    if (text.length < 8 || text.length > 120) return;
    push(text, { tag: el.tagName, class: el.className?.toString?.().slice(0, 48), sel: el.getAttribute('data-direct-value') || el.className?.toString?.().slice(0, 24) });
  });

  const duplicates = [];
  for (const [text, hits] of buckets.entries()) {
    if (hits.length < 2) continue;
    const distinctParents = new Set(hits.map((h) => h.class));
    if (distinctParents.size < 2 && hits.length === 2) continue;
    duplicates.push({ text: text.slice(0, 80), count: hits.length, hits: hits.slice(0, 4) });
  }
  duplicates.sort((a, b) => b.count - a.count);
  return {
    duplicateCount: duplicates.length,
    totalRepeatedInstances: duplicates.reduce((n, d) => n + d.count, 0),
    duplicates: duplicates.slice(0, 20),
  };
});

await browser.close();

const out = {
  capturedAt: new Date().toISOString(),
  url,
  catalogProfile: CATALOG_FULL ? 'full' : 'sd-only',
  ...report,
};

mkdirSync(runDir, { recursive: true });
const outName = process.env.AUTOHACKER_DUP_OUT || 'duplicate-text-report.json';
const outPath = join(runDir, outName);
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Wrote', outPath);
console.log(JSON.stringify({ duplicateCount: out.duplicateCount, totalRepeatedInstances: out.totalRepeatedInstances }, null, 2));
