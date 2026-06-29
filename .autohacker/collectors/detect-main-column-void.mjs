/**
 * Measures dead air in main column between scope chrome and first direct-value block.
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const targetName = process.env.AUTOHACKER_TARGET || 'governance';
const runDir = process.env.AUTOHACKER_RUN_DIR || join(root, '.autohacker', 'runs', process.env.AUTOHACKER_RUN_ID || 'local');
const headless = process.env.HEADLESS === '1' || process.env.CI === '1';
const maxMainVoidPx = Number(process.env.MAX_MAIN_COLUMN_VOID_PX || 180);

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
  try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
});
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
await page.waitForSelector('#main-content[data-gov-layout-ready="1"]', { timeout: 120000 }).catch(() => {});

const metrics = await page.evaluate(() => {
  const rect = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.getBoundingClientRect() : null;
  };
  const scope = rect('#gov-scope-bar-mount') || rect('#gov-scope-expanded');
  const scopeBottom = scope ? scope.bottom : 0;
  const valueSelectors = [
    '[data-direct-value]',
    '[data-grouped-send]',
    '.gov-owner-cluster',
    '.gov-command-answer',
    '#gov-answer-mount .gov-command-answer',
    '.gov-portfolio-banner-line',
  ];
  let firstValue = null;
  for (const sel of valueSelectors) {
    document.querySelectorAll(sel).forEach((el) => {
      if (el.closest('[hidden], #gov-secondary-chrome, .gov-secondary-chrome')) return;
      const r = el.getBoundingClientRect();
      if (r.height <= 8 || r.width <= 8) return;
      if (r.top + 4 < scopeBottom) return;
      if (!firstValue || r.top < firstValue.top) {
        firstValue = { sel, top: r.top, bottom: r.bottom };
      }
    });
  }
  const scopeBottomPx = Math.round(scopeBottom);
  const mainVoidPx = firstValue ? Math.round(firstValue.top - scopeBottom) : 9999;
  const main = document.querySelector('#main-content');
  const mainRect = main ? main.getBoundingClientRect() : null;
  const actionMount = rect('#gov-action-clusters-mount');
  const verdictMount = rect('#gov-verdict-mount');
  const gridVoidPx = (scope && verdictMount)
    ? Math.round(verdictMount.top - scope.bottom)
    : null;
  return {
    scopeBottomPx: Math.round(scopeBottom),
    firstValueSelector: firstValue?.sel || null,
    mainColumnVoidPx: mainVoidPx,
    stackingDetected: mainVoidPx < 0,
    gridScopeToVerdictPx: gridVoidPx,
    mainContentHeightPx: mainRect ? Math.round(mainRect.height) : null,
    actionMountTopPx: actionMount ? Math.round(actionMount.top) : null,
  };
});

await browser.close();

const out = {
  capturedAt: new Date().toISOString(),
  url,
  maxMainColumnVoidPx: maxMainVoidPx,
  ...metrics,
  pass: metrics.mainColumnVoidPx >= 0 && metrics.mainColumnVoidPx <= maxMainVoidPx,
};

mkdirSync(runDir, { recursive: true });
const outPath = join(runDir, 'main-column-void-report.json');
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Wrote', outPath);
console.log(JSON.stringify({ mainColumnVoidPx: out.mainColumnVoidPx, pass: out.pass }, null, 2));
