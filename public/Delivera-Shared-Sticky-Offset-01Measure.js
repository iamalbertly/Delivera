/**
 * Measures sticky chrome heights and publishes CSS custom properties for scroll offsets.
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
