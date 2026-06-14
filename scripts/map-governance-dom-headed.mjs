/**
 * Headed DOM map for /governance — friction nesting audit.
 * Run: node scripts/map-governance-dom-headed.mjs
 */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';

function resolveBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  try {
    if (existsSync('.delivera-dev-port')) {
      const port = Number(readFileSync('.delivera-dev-port', 'utf8').trim());
      if (Number.isFinite(port) && port > 0) return `http://127.0.0.1:${port}`;
    }
  } catch (_) { /* ignore */ }
  return 'http://127.0.0.1:3001';
}

const BASE = resolveBaseUrl();
const OUT = 'test-results/governance-dom-map-headed.json';

function domTree(el, depth = 0, maxDepth = 6) {
  if (!el || depth > maxDepth) return null;
  const tag = el.tagName?.toLowerCase() || '';
  const id = el.id ? `#${el.id}` : '';
  const cls = (el.className && typeof el.className === 'string')
    ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
    : '';
  const sticky = getComputedStyle(el).position === 'sticky' ? '[sticky]' : '';
  const hidden = el.hidden || el.getAttribute('aria-hidden') === 'true' ? '[hidden]' : '';
  const overflow = ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) ? '[scroll-y]' : '';
  const node = { sel: `${tag}${id}${cls}${sticky}${hidden}${overflow}`.slice(0, 120), depth };
  const kids = [];
  for (const child of el.children) {
    const sub = domTree(child, depth + 1, maxDepth);
    if (sub) kids.push(sub);
  }
  if (kids.length) node.children = kids;
  return node;
}

const headless = process.env.HEADLESS === '1' || process.env.CI === '1';
const browser = await chromium.launch({ headless, slowMo: headless ? 0 : 80 });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => {
  try { localStorage.setItem('delivera_selectedProjects', 'SD'); } catch (_) {}
  try { sessionStorage.setItem('gov-pi-auto-open-dismissed', '1'); } catch (_) {}
});

await page.goto(`${BASE}/governance`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});

const beforeScroll = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const rect = (el) => el ? el.getBoundingClientRect() : null;
  const stickyLayers = qa('*').filter((el) => getComputedStyle(el).position === 'sticky').map((el) => ({
    id: el.id || null,
    class: el.className?.toString?.().slice(0, 80) || '',
    top: getComputedStyle(el).top,
    zIndex: getComputedStyle(el).zIndex,
    height: rect(el)?.height,
  }));
  const nestedClickTargets = qa('button, a[href], summary, [role="button"]').length;
  const scopeExpandedHidden = q('#gov-scope-expanded')?.hasAttribute('hidden');
  const scopeDrawer = qa('.gov-right-drawer-panel--scope-sheet').length;
  const stickyAnswer = qa('.gov-sticky-answer--governance, #gov-sticky-answer-mount').length;
  const ownerClusters = qa('.gov-owner-cluster').length;
  const hiddenIssueLists = qa('.gov-cluster-issues').filter((el) => el.hidden || el.offsetParent === null).length;
  const proofChips = qa('[data-proof-cluster]').length;
  const rightDrawerOpen = document.body.classList.contains('gov-right-drawer-open');
  const supportingEvidenceOpen = q('#gov-supporting-evidence')?.open;
  const rightRailScroll = q('#gov-right-rail-mount') ? getComputedStyle(q('#gov-right-rail-mount')).overflowY : null;
  return {
    url: location.href,
    briefState: q('#main-content')?.getAttribute('data-gov-brief-state'),
    stickyLayers,
    nestedClickTargets,
    scopeExpandedHidden,
    scopeDrawer,
    stickyAnswer,
    ownerClusters,
    hiddenIssueLists,
    proofChips,
    rightDrawerOpen,
    supportingEvidenceOpen,
    rightRailScroll,
    docHeight: document.documentElement.scrollHeight,
    viewportH: window.innerHeight,
  };
});

await page.evaluate(() => window.scrollTo(0, 400));
await page.waitForTimeout(600);

const afterScroll = await page.evaluate(() => {
  const qa = (s) => [...document.querySelectorAll(s)];
  return {
    scrollY: window.scrollY,
    stickyAnswerVisible: qa('.gov-sticky-answer--governance.is-visible, #gov-sticky-answer-mount.is-visible').length,
    stickyAnswerAny: qa('.gov-sticky-answer--governance, #gov-sticky-answer-mount').length,
    scopeBarVisible: !!document.querySelector('#gov-scope-bar-mount')?.getBoundingClientRect?.().height,
  };
});

const tree = await page.evaluate(() => {
  function domTree(el, depth = 0, maxDepth = 5) {
    if (!el || depth > maxDepth) return null;
    const tag = el.tagName?.toLowerCase() || '';
    const id = el.id ? `#${el.id}` : '';
    const cls = (el.className && typeof el.className === 'string')
      ? `.${el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')}`
      : '';
    const flags = [];
    if (getComputedStyle(el).position === 'sticky') flags.push('sticky');
    if (el.hidden) flags.push('hidden');
    if (['auto', 'scroll'].includes(getComputedStyle(el).overflowY)) flags.push('scroll-y');
    const node = { sel: `${tag}${id}${cls}${flags.length ? `[${flags.join(',')}]` : ''}`.slice(0, 100), depth };
    const kids = [];
    for (const child of el.children) {
      const sub = domTree(child, depth + 1, maxDepth);
      if (sub) kids.push(sub);
    }
    if (kids.length) node.children = kids;
    return node;
  }
  return domTree(document.body);
});

// Click proof cluster if present
let proofClick = { clicked: false };
const proof = page.locator('[data-proof-cluster]').first();
if (await proof.count()) {
  try {
    await proof.click({ timeout: 5000 });
    await page.waitForTimeout(500);
    proofClick = await page.evaluate(() => ({
      clicked: true,
      drawerOpen: !document.getElementById('delivera-gov-right-drawer')?.hidden,
      supportingEvidenceOpen: document.getElementById('gov-supporting-evidence')?.open,
      bodyScrollLocked: document.body.classList.contains('gov-right-drawer-open'),
    }));
  } catch (e) {
    proofClick = { clicked: false, error: String(e.message || e) };
  }
  await page.keyboard.press('Escape').catch(() => {});
}

mkdirSync('test-results', { recursive: true });
const report = { mappedAt: new Date().toISOString(), baseUrl: BASE, beforeScroll, afterScroll, proofClick, tree };
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('Wrote', OUT);
console.log(JSON.stringify({ beforeScroll, afterScroll, proofClick }, null, 2));

await page.waitForTimeout(1500);
await browser.close();
