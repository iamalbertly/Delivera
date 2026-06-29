/**
 * Detects primary value hidden behind clicks (Open *, collapsed details, truncated fold copy).
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
  return JSON.parse(readFileSync(join(root, '.autohacker', 'config', 'targets.json'), 'utf8'))[targetName];
}

const target = loadTarget();
const url = `${resolveBaseUrl()}${target.path.startsWith('/') ? target.path : `/${target.path}`}`;

const browser = await chromium.launch({ headless });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => {
  try { localStorage.setItem('delivera_selectedProjects', 'SD'); } catch (_) {}
  try { localStorage.setItem('delivera_sidebar_collapsed', '1'); } catch (_) {}
  try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});

const findings = await page.evaluate(() => {
  const items = [];
  const push = (kind, label, sel) => items.push({ kind, label: (label || '').slice(0, 80), selector: sel });

  document.querySelectorAll('button, a, summary').forEach((el) => {
    if (el.closest('[data-direct-value]')) return;
    const text = (el.textContent || '').trim();
    if (/^open (sprint|evidence|drawer)/i.test(text)) {
      push('open-gated-value', text, el.id ? `#${el.id}` : el.className?.toString?.().slice(0, 40));
    }
  });

  document.querySelectorAll('details:not([open])').forEach((el) => {
    const summary = (el.querySelector('summary')?.textContent || '').trim();
    if (summary) push('collapsed-details', summary, 'details:not([open])');
  });

  document.querySelectorAll('[data-tile-detail][hidden]').forEach((el) => {
    push('hidden-tile-detail', el.getAttribute('data-tile-detail') || 'squad-detail', `[data-tile-detail="${el.getAttribute('data-tile-detail')}"]`);
  });

  document.querySelectorAll('[data-setup-baseline-ssot]').forEach((el) => {
    push('setup-gap-click', (el.textContent || '').trim(), '[data-setup-baseline-ssot]');
  });

  const foldBottom = window.innerHeight * 0.85;
  document.querySelectorAll('.gov-owner-cluster, [data-grouped-send], .gov-inbox-inline-approve').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top > foldBottom && r.height > 4) {
      push('below-fold-action', (el.textContent || el.className || '').slice(0, 60), el.id ? `#${el.id}` : null);
    }
  });

  document.querySelectorAll('p, li, span').forEach((el) => {
    const st = getComputedStyle(el);
    if (st.textOverflow === 'ellipsis' && st.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 4) {
      push('truncated-copy', (el.textContent || '').trim(), el.className?.toString?.().slice(0, 40));
    }
  });

  return items.slice(0, 40);
});

await browser.close();

const report = {
  capturedAt: new Date().toISOString(),
  url,
  hiddenValueCount: findings.length,
  byKind: findings.reduce((acc, f) => { acc[f.kind] = (acc[f.kind] || 0) + 1; return acc; }, {}),
  findings,
};

mkdirSync(runDir, { recursive: true });
const outPath = join(runDir, 'hidden-value-report.json');
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log('Wrote', outPath);
console.log(JSON.stringify({ hiddenValueCount: report.hiddenValueCount, byKind: report.byKind }, null, 2));
