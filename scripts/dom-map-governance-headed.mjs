/**
 * One-shot headed DOM map for /governance — writes test-results/governance-dom-map.json
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OUT = 'test-results/governance-dom-map.json';

function nodePath(el) {
  const parts = [];
  let n = el;
  while (n && n.nodeType === 1 && parts.length < 8) {
    const id = n.id ? `#${n.id}` : '';
    const cls = (n.className && typeof n.className === 'string')
      ? `.${n.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
    parts.unshift(`${n.tagName.toLowerCase()}${id}${cls}`);
    n = n.parentElement;
  }
  return parts.join(' > ');
}

async function mapDom(page) {
  return page.evaluate(() => {
    const friction = [];
    const stickyEls = [...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return (s.position === 'sticky' || s.position === 'fixed') && el.getBoundingClientRect().height > 0;
    }).map((el) => ({
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      class: (el.className || '').toString().slice(0, 80),
      top: Math.round(el.getBoundingClientRect().top),
      z: getComputedStyle(el).zIndex,
      pointerEvents: getComputedStyle(el).pointerEvents,
    }));

    const clickables = [...document.querySelectorAll('button, a[href], [role="button"], summary, [data-proof-cluster], [data-queue-open]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
      });

    for (const el of clickables.slice(0, 40)) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const topEl = document.elementFromPoint(cx, cy);
      if (topEl && topEl !== el && !el.contains(topEl)) {
        friction.push({
          kind: 'click-intercept',
          label: (el.getAttribute('aria-label') || el.textContent || el.id || '').replace(/\s+/g, ' ').trim().slice(0, 60),
          blockedBy: topEl.tagName.toLowerCase() + (topEl.id ? `#${topEl.id}` : '') + (topEl.className ? `.${String(topEl.className).split(' ')[0]}` : ''),
        });
      }
    }

    const scrollContainers = [...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 8;
    }).map((el) => ({
      id: el.id || null,
      class: (el.className || '').toString().slice(0, 80),
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      nestedDepth: (() => { let d = 0; let p = el.parentElement; while (p) { d++; p = p.parentElement; } return d; })(),
    }));

    const tree = {
      scopeBar: document.getElementById('gov-scope-bar-mount')?.innerHTML?.length || 0,
      scopeExpandedHidden: document.getElementById('gov-scope-expanded')?.hasAttribute('hidden'),
      stickyAnswerVisible: document.querySelector('#gov-sticky-answer-mount.is-visible') != null,
      drawerOpen: !document.getElementById('delivera-gov-right-drawer')?.hidden,
      ownerClusters: document.querySelectorAll('.gov-owner-cluster').length,
      overflowMenu: document.getElementById('gov-overflow-menu')?.hidden === false,
      supportingEvidenceOpen: document.getElementById('gov-supporting-evidence')?.open,
      rightRailSticky: getComputedStyle(document.querySelector('.gov-right-rail') || document.body).position,
    };

    return { stickyEls, friction: friction.slice(0, 20), scrollContainers: scrollContainers.slice(0, 15), tree };
  });
}

mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ headless: false, slowMo: 80 });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => {
  localStorage.setItem('delivera_selectedProjects', 'SD');
  sessionStorage.setItem('gov-pi-auto-open-dismissed', '1');
});
await page.goto(`${BASE}/governance`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
await page.waitForTimeout(2500);

const atTop = await mapDom(page);
await page.evaluate(() => window.scrollTo(0, 420));
await page.waitForTimeout(600);
const scrolled = await mapDom(page);

await page.locator('#gov-scope-change').click().catch(() => {});
await page.waitForTimeout(400);
const scopeExpanded = await mapDom(page);

const report = {
  auditedAt: new Date().toISOString(),
  url: page.url(),
  atTop,
  scrolled,
  scopeExpanded,
};
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log('Wrote', OUT);
await page.waitForTimeout(1500);
await browser.close();
