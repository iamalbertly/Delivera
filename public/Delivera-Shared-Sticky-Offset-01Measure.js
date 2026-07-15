/**
 * Measures sticky chrome heights and publishes CSS custom properties for scroll offsets.
 *
 * Contract (consumers must not double-count):
 *   --sticky-global-nav-top = top chrome + sub-chrome (viewport-relative sticky / scroll-margins)
 *   --sticky-offset = nav + --gov-scope-bar-height (drawers / rails BELOW the scope bar)
 *   --gov-scope-bar-height = scope bar alone
 *   --current-sprint-hud-below-nav = sprint HUD (+ page header) height below nav
 * Scope bar sticky `top` must be 0 under body.has-top-chrome (body padding clears chrome;
 * overflow-x:hidden makes body the sticky CB — using --sticky-global-nav-top doubles ~56px).
 * Never use --sticky-offset as `top` on the scope bar itself — that includes its own height.
 */
import { TOP_CHROME_ID, SUB_CHROME_SLOT_ID } from './Delivera-Shared-Top-Chrome-01Render-UI.js';

let observer = null;
let bound = false;

function measureEl(id) {
  const el = document.getElementById(id);
  if (!el || el.hidden) return 0;
  const rect = el.getBoundingClientRect();
  return Math.ceil(rect.height || 0);
}

function measureHudBelowNav() {
  const hud = document.querySelector('.current-sprint-header-bar');
  if (!hud) return 0;
  const pageHeader = document.querySelector('body.current-sprint-page header');
  const pageHeaderH = pageHeader && !pageHeader.classList.contains('current-sprint-header-sr-only')
    ? Math.ceil(pageHeader.getBoundingClientRect().height || 0)
    : 0;
  return Math.ceil(hud.getBoundingClientRect().height || 0) + pageHeaderH;
}

function publishStickyOffsets() {
  const root = document.documentElement;
  const topChrome = measureEl(TOP_CHROME_ID);
  const subChromeSlot = document.getElementById(SUB_CHROME_SLOT_ID);
  const subChromeVisible = subChromeSlot
    && !subChromeSlot.hidden
    && subChromeSlot.querySelector('#gov-global-agent-bar:not([hidden])');
  const subChrome = subChromeVisible ? Math.ceil(subChromeSlot.getBoundingClientRect().height || 0) : 0;
  const topChromeH = topChrome || 56;
  const subChromeH = subChrome || 0;
  const stickyNavTop = topChromeH + subChromeH;

  root.style.setProperty('--top-chrome-measured', `${topChromeH}px`);
  root.style.setProperty('--sub-chrome-height', `${subChromeH}px`);
  root.style.setProperty('--sticky-global-nav-top', `${stickyNavTop}px`);
  root.style.setProperty('--sticky-summary-top', `${stickyNavTop + 8}px`);

  // Audit fix: measure the governance portfolio scope bar so right drawers
  // and sticky elements can offset below it instead of being clipped by it.
  // The scope bar is position: sticky; top: 0 under body.has-top-chrome
  // (body padding clears fixed chrome; body is the sticky containing block).
  // --sticky-offset = nav + this bar's height for drawers/rails below it.
  const govScopeBar = document.querySelector('#portfolio-scope-bar-mount.portfolio-scope-bar, .portfolio-scope-bar');
  const govScopeBarH = govScopeBar && !govScopeBar.hidden
    ? Math.ceil(govScopeBar.getBoundingClientRect().height || 0)
    : 0;
  root.style.setProperty('--gov-scope-bar-height', `${govScopeBarH}px`);
  root.style.setProperty('--sticky-offset', `${stickyNavTop + govScopeBarH}px`);
  // Audit fix: body.has-top-chrome sets --sticky-offset in CSS, which would
  // override the :root value we just set (body is more specific than :root
  // for the body subtree). Set it on body too so the drawer (a child of
  // body) inherits the combined top-chrome + scope-bar height instead of
  // just the top-chrome height — preventing the sticky scope bar from
  // clipping the drawer header.
  document.body?.style.setProperty('--sticky-offset', `${stickyNavTop + govScopeBarH}px`);

  const hudBelow = measureHudBelowNav();
  if (hudBelow > 0) {
    root.style.setProperty('--current-sprint-hud-below-nav', `${hudBelow}px`);
  }
}

function observeTargets() {
  if (typeof ResizeObserver === 'undefined') {
    publishStickyOffsets();
    return;
  }
  if (!observer) {
    observer = new ResizeObserver(() => publishStickyOffsets());
  }
  [
    document.getElementById(TOP_CHROME_ID),
    document.getElementById(SUB_CHROME_SLOT_ID),
    document.querySelector('.current-sprint-header-bar'),
    document.querySelector('body.current-sprint-page header'),
    document.querySelector('#portfolio-scope-bar-mount.portfolio-scope-bar, .portfolio-scope-bar'),
  ].filter(Boolean).forEach((node) => observer.observe(node));
  publishStickyOffsets();
}

export function initStickyOffsetMeasure() {
  if (bound) {
    observeTargets();
    return;
  }
  bound = true;
  observeTargets();
  window.addEventListener('resize', publishStickyOffsets, { passive: true });
  window.addEventListener('app:top-chrome-rendered', observeTargets);
  window.addEventListener('delivera:currentSprintPayloadReady', observeTargets);
  window.addEventListener('delivera:currentSprintScopeRelocated', observeTargets);
  document.addEventListener('scroll', () => {
    window.requestAnimationFrame(publishStickyOffsets);
  }, { passive: true, capture: true });
}
