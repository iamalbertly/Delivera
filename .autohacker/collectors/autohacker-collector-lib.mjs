/**
 * Shared helpers for AutoHacker v5 collectors.
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export function resolveProjectRoot(fromMetaUrl) {
  return join(dirname(fileURLToPath(fromMetaUrl)), '..', '..');
}

export function resolveBaseUrl(root) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  try {
    if (existsSync(join(root, '.delivera-dev-port'))) {
      const port = Number(readFileSync(join(root, '.delivera-dev-port'), 'utf8').trim());
      if (Number.isFinite(port) && port > 0) return `http://127.0.0.1:${port}`;
    }
  } catch (_) { /* ignore */ }
  return 'http://127.0.0.1:3001';
}

export function loadTarget(root, targetName = process.env.AUTOHACKER_TARGET || 'governance') {
  const cfg = JSON.parse(readFileSync(join(root, '.autohacker', 'config', 'targets.json'), 'utf8'));
  const t = cfg[targetName];
  if (!t) throw new Error(`Unknown AUTOHACKER_TARGET: ${targetName}`);
  return t;
}

export function loadStates(root) {
  const path = join(root, '.autohacker', 'config', 'states.json');
  if (!existsSync(path)) {
    return [{ id: 'sd-collapsed', label: 'SD collapsed', localStorage: { delivera_selectedProjects: 'SD' }, sessionStorage: { 'gov-pi-auto-open-dismissed': '1' } }];
  }
  const cfg = JSON.parse(readFileSync(path, 'utf8'));
  return cfg.states || [];
}

export function resolveRunDir(root) {
  return process.env.AUTOHACKER_RUN_DIR || join(root, '.autohacker', 'runs', process.env.AUTOHACKER_RUN_ID || 'local');
}

export function buildTargetUrl(base, target) {
  const path = target.path.startsWith('/') ? target.path : `/${target.path}`;
  return `${base}${path}`;
}

export function stateInitScript(state) {
  return ({ ls, ss, bodyClassRemove, bodyClassAdd, queryAppend }) => {
    for (const [k, v] of Object.entries(ls || {})) {
      try { localStorage.setItem(k, v); } catch (_) {}
    }
    for (const [k, v] of Object.entries(ss || {})) {
      try { sessionStorage.setItem(k, v); } catch (_) {}
    }
    if (bodyClassRemove) {
      for (const c of bodyClassRemove) document.body.classList.remove(c);
    }
    if (bodyClassAdd) {
      for (const c of bodyClassAdd) document.body.classList.add(c);
    }
    if (queryAppend && !window.location.search.includes(queryAppend.replace(/^\?/, ''))) {
      const u = new URL(window.location.href);
      const q = queryAppend.replace(/^\?/, '');
      for (const part of q.split('&')) {
        const [k, v] = part.split('=');
        if (k) u.searchParams.set(k, v || '1');
      }
      window.history.replaceState({}, '', u.toString());
    }
  };
}

export async function seedPageState(page, state) {
  await page.addInitScript(stateInitScript(state), {
    ls: state.localStorage || {},
    ss: state.sessionStorage || {},
    bodyClassRemove: state.bodyClassRemove || null,
    bodyClassAdd: state.bodyClassAdd || null,
    queryAppend: state.query || null,
  });
}

export async function gotoGovernance(page, url, timeout = 90000) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  if (page.url().includes('/login')) return { redirectedToLogin: true };
  await page.waitForSelector('#gov-loading', { state: 'hidden', timeout: 120000 }).catch(() => {});
  await page.waitForSelector('#main-content[data-gov-layout-ready="1"]', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(150);
  return { redirectedToLogin: false };
}

export function measureMainColumnVoid(scopeBottom, documentRef = document) {
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
    documentRef.querySelectorAll(sel).forEach((el) => {
      if (el.closest('[hidden], #gov-secondary-chrome, .gov-secondary-chrome')) return;
      const r = el.getBoundingClientRect();
      if (r.height <= 8 || r.width <= 8) return;
      if (r.top + 4 < scopeBottom) return;
      if (!firstValue || r.top < firstValue.top) {
        firstValue = { sel, top: r.top, bottom: r.bottom };
      }
    });
  }
  const mainColumnVoidPx = firstValue ? Math.round(firstValue.top - scopeBottom) : 9999;
  return {
    firstValueSelector: firstValue?.sel || null,
    mainColumnVoidPx,
    stackingDetected: mainColumnVoidPx < 0,
  };
}
