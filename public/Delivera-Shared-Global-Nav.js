import { renderSidebarContextCard } from './Delivera-Shared-Context-From-Storage.js';
import {
  ensureTopChrome,
  refreshTopChromeBrand,
  syncSidebarCollapsedFromStorage,
  writeSidebarCollapsed,
} from './Delivera-Shared-Top-Chrome-01Render-UI.js';
import { bootstrapSubChrome } from './Delivera-Shared-Sub-Chrome-01Bootstrap.js';
import { initStickyOffsetMeasure } from './Delivera-Shared-Sticky-Offset-01Measure.js';
import {
  readNotificationSummary,
  effectiveNotificationTotal,
  getTimeTrackingTotal,
  getRuntimeAlertCount,
  refreshNotificationDockFromStore,
} from './Delivera-Shared-Notifications-Dock-Manager.js';

import {
  PAGE_DASHBOARD,
  PAGE_PI,
  PAGE_REPORT,
  PAGE_EVIDENCE,
  PAGE_SPRINTS,
  PAGE_VALUE,
  PAGE_RISKS,
  PAGE_LEADERSHIP,
  PAGE_ACTIONS,
  PAGE_GOVERNANCE,
  PAGE_TEAMS,
  PAGE_SETTINGS,
  PAGE_LOGIN,
  LEADERSHIP_HASH,
  PRIMARY_NAV_KEYS,
  SURFACE_SWITCHER,
  getPathState,
  getCurrentPage,
} from './Delivera-Shared-Page-Route-01Resolve-SSOT.js';
const SURFACE_LABELS = Object.fromEntries(SURFACE_SWITCHER.map((s) => [s.key, s.label]));
const MOBILE_BREAKPOINT = 1200;
const NAV_HREF_OVERRIDES = {
  [PAGE_RISKS]: '/current-sprint#stuck-card',
  [PAGE_TEAMS]: '/current-sprint',
  [PAGE_REPORT]: '/actions?tab=proof',
  [PAGE_EVIDENCE]: '/actions',
};
const NAV_LABELS = {
  [PAGE_DASHBOARD]: 'Today',
  [PAGE_SPRINTS]: SURFACE_LABELS[PAGE_SPRINTS] || 'Squads',
  [PAGE_REPORT]: 'Actions',
  [PAGE_EVIDENCE]: 'Actions',
  [PAGE_RISKS]: 'Risks',
  [PAGE_TEAMS]: SURFACE_LABELS[PAGE_SPRINTS] || 'Squads',
  [PAGE_LEADERSHIP]: SURFACE_LABELS[PAGE_GOVERNANCE] || 'Portfolio',
  [PAGE_GOVERNANCE]: SURFACE_LABELS[PAGE_GOVERNANCE] || 'Portfolio',
  [PAGE_PI]: 'PI Baseline',
  [PAGE_VALUE]: 'Actions',
  [PAGE_SETTINGS]: SURFACE_LABELS[PAGE_SETTINGS] || 'Settings',
  [PAGE_ACTIONS]: SURFACE_LABELS[PAGE_ACTIONS] || 'Actions',
};
const MOBILE_LABELS = {
  ...SURFACE_LABELS,
  [PAGE_REPORT]: 'Actions',
  [PAGE_EVIDENCE]: 'Actions',
};

const NAV_ITEMS = [
  {
    key: PAGE_GOVERNANCE,
    label: 'Portfolio',
    href: '/governance',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15H6zm8 1.5V8h4.5zM8 12h8v1.6H8zm0 3.2h8v1.6H8zm0-6.4h4v1.6H8z"/></svg>',
  },
  {
    key: PAGE_SPRINTS,
    label: 'Squads',
    href: '/current-sprint',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4zM7 3h2v4H7zm8 0h2v4h-2z"/></svg>',
  },
  {
    key: PAGE_ACTIONS,
    label: 'Actions',
    href: '/actions',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4zm-1 7h2v8H8zm4 0h2v8h-2z"/></svg>',
  },
  {
    key: PAGE_SETTINGS,
    label: 'Settings',
    href: '/settings',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19.4 13 .1-2-1.8-.7a5.6 5.6 0 0 0-.4-1l.8-1.8-1.4-1.4-1.8.8a5.6 5.6 0 0 0-1-.4L13 3h-2l-.7 1.8a5.6 5.6 0 0 0-1 .4l-1.8-.8-1.4 1.4.8 1.8a5.6 5.6 0 0 0-.4 1L3 11v2l1.8.7a5.6 5.6 0 0 0 .4 1l-.8 1.8 1.4 1.4 1.8-.8a5.6 5.6 0 0 0 1 .4L11 21h2l.7-1.8a5.6 5.6 0 0 0 1-.4l1.8.8 1.4-1.4-.8-1.8a5.6 5.6 0 0 0 .4-1ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"/></svg>',
  },
];

const MORE_NAV_KEYS = [];
function getNavItems(current) {
  const { path, hash } = getPathState();
  const onSprintRisksLens = (path === '/current-sprint' || path.endsWith('/current-sprint'))
    && (hash === '#stuck-card' || hash === '#work-risks');
  return NAV_ITEMS.map((item) => {
    let active = current === item.key;
    if (item.key === PAGE_RISKS && onSprintRisksLens) active = true;
    const href = NAV_HREF_OVERRIDES[item.key] || item.href;
    return {
      ...item,
      href,
      label: NAV_LABELS[item.key] || item.label,
      active,
    };
  });
}

function buildSidebarHTML() {
  const current = getCurrentPage();
  const items = getNavItems(current);
  const primaryItems = PRIMARY_NAV_KEYS.map((key) => items.find((item) => item.key === key)).filter(Boolean);
  const moreItems = items.filter((item) => MORE_NAV_KEYS.includes(item.key));
  const moreIsActive = moreItems.some((item) => item.active);
  const hidePrimaryNav = document.body?.classList?.contains('executive-surface-page');
  let html = '<div class="sidebar-brand"><span class="sidebar-brand-mark" aria-hidden="true">De</span><span class="sidebar-brand-text">Delivera</span><span class="sidebar-brand-tagline">Grow my Impact</span></div>';
  if (!hidePrimaryNav) {
    html += '<nav class="app-sidebar-nav app-nav" aria-label="Main">';
    for (const item of primaryItems) {
    const className = 'sidebar-link' + (item.active ? ' active current' : '');
    const badge = item.key === PAGE_GOVERNANCE ? '<span class="sidebar-nav-badge" data-sidebar-badge="governance" hidden></span>' : '';
    if (item.active) {
      html += '<span class="' + className + '" aria-current="page" data-nav-key="' + item.key + '">' + item.icon + '<span>' + item.label + '</span>' + badge + '</span>';
    } else {
      html += '<a class="' + className + '" href="' + item.href + '" data-nav-key="' + item.key + '">' + item.icon + '<span>' + item.label + '</span>' + badge + '</a>';
    }
  }
  if (moreItems.length) {
    html += '<details class="sidebar-more" ' + (moreIsActive ? 'open' : '') + '>';
    html += '<summary class="sidebar-more-summary' + (moreIsActive ? ' active' : '') + '"><span class="sidebar-more-dot" aria-hidden="true">+</span><span>More</span></summary>';
    html += '<div class="sidebar-more-panel">';
    for (const item of moreItems) {
      const className = 'sidebar-more-link' + (item.active ? ' active current' : '');
      if (item.active) {
        html += '<span class="' + className + '" aria-current="page" data-nav-key="' + item.key + '">' + item.icon + '<span>' + item.label + '</span></span>';
      } else {
        html += '<a class="' + className + '" href="' + item.href + '" data-nav-key="' + item.key + '">' + item.icon + '<span>' + item.label + '</span></a>';
      }
    }
    html += '</div></details>';
  }
  html += '</nav>';
  }
  html += '<div id="sidebar-context-card" class="sidebar-context-card" aria-live="polite"></div>';
  html += '<div class="sidebar-footer sidebar-data-pulse" id="sidebar-data-pulse" aria-live="polite" title="Data freshness indicator"></div>';
  return html;
}

function updateToggleState(toggle, isExpanded) {
  const value = isExpanded ? 'true' : 'false';
  if (toggle) toggle.setAttribute('aria-expanded', value);
  document.querySelectorAll('.sidebar-toggle, .app-top-sidebar-toggle').forEach((node) => node.setAttribute('aria-expanded', value));
}

function syncBodySidebarState(sidebar) {
  const isOpen = !!(sidebar && sidebar.classList.contains('open'));
  if (isOpen) {
    document.body.classList.add('sidebar-open');
    document.body.classList.add('sidebar-scroll-lock');
    return;
  }
  document.body.classList.remove('sidebar-open');
  document.body.classList.remove('sidebar-scroll-lock');
}

function setBackdropActive(isActive) {
  document.querySelectorAll('.sidebar-backdrop').forEach((node) => {
    node.classList.toggle('active', !!isActive);
    node.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });
}

function closeSidebar(sidebar, toggle, backdrop) {
  sidebar?.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
  setBackdropActive(false);
  syncBodySidebarState(sidebar);
  updateToggleState(toggle, false);
}

function openSidebar(sidebar, toggle, backdrop) {
  sidebar?.classList.add('open');
  if (backdrop) backdrop.classList.add('active');
  setBackdropActive(true);
  syncBodySidebarState(sidebar);
  updateToggleState(toggle, true);
}

function isMobileViewport() {
  return window.matchMedia && window.matchMedia('(max-width: ' + MOBILE_BREAKPOINT + 'px)').matches;
}

function trapSidebarFocus(event, sidebar, toggle) {
  if (!sidebar || !sidebar.classList.contains('open') || !isMobileViewport()) return;
  if (event.key !== 'Tab') return;
  const focusable = Array.from(sidebar.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])'))
    .filter((el) => !el.hasAttribute('disabled'));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    (toggle || last).focus();
    return;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function dispatchHashSync() {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function navigateTo(itemKey, itemHref) {
  const { path, hash } = getPathState();
  const isReportPath = path === '/report' || path.endsWith('/report');

  if (itemKey === PAGE_REPORT && isReportPath) {
    if (hash) history.replaceState(null, '', '/report');
    dispatchHashSync();
    return;
  }
  window.location.href = itemHref;
}

function buildBottomNavHTML() {
  const current = getCurrentPage();
  const items = PRIMARY_NAV_KEYS.map((key) => getNavItems(current).find((item) => item.key === key)).filter(Boolean);
  let html = '<nav class="mobile-bottom-nav" aria-label="Primary mobile navigation">';
  for (const item of items) {
    const className = 'mobile-bottom-nav-item' + (item.active ? ' active' : '');
    const shortLabel = MOBILE_LABELS[item.key] || item.label;
    html += '<a class="' + className + '" href="' + item.href + '" data-nav-key="' + item.key + '">';
    html += '<span class="mobile-bottom-nav-icon" aria-hidden="true">' + item.icon + '</span>';
    html += '<span class="mobile-bottom-nav-label">' + shortLabel + '</span>';
    html += '<span class="mobile-bottom-nav-badge" data-mobile-badge="' + item.key + '" hidden></span>';
    html += '</a>';
  }
  html += '</nav>';
  return html;
}

function ensureBottomNav() {
  const current = getCurrentPage();
  if (current === PAGE_LOGIN || document.getElementById('app-top-chrome')) {
    document.querySelector('.mobile-bottom-nav-wrap')?.remove();
    return;
  }
  let wrap = document.querySelector('.mobile-bottom-nav-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'mobile-bottom-nav-wrap';
    document.body.appendChild(wrap);
  }
  wrap.innerHTML = buildBottomNavHTML();
  wrap.onclick = (event) => {
    const link = event.target.closest('a[data-nav-key]');
    if (!link) return;
    event.preventDefault();
    navigateTo(link.getAttribute('data-nav-key') || '', link.getAttribute('href') || '/report');
  };
}

function updateBottomNavBadge(itemKey, text, title) {
  const el = document.querySelector('[data-mobile-badge="' + itemKey + '"]');
  if (!el) return;
  const label = String(text || '').trim();
  if (!label) {
    el.hidden = true;
    el.textContent = '';
    el.removeAttribute('title');
    return;
  }
  el.hidden = false;
  el.textContent = label;
  if (title) el.setAttribute('title', title);
}

function getSidebarToggles() {
  return Array.from(document.querySelectorAll('.sidebar-toggle, .app-top-sidebar-toggle'));
}

function handleSidebarToggleClick(sidebar, backdrop) {
  const toggles = getSidebarToggles();
  const toggle = toggles[0];
  if (!isMobileViewport()) {
    const collapsed = !document.body.classList.contains('sidebar-collapsed');
    writeSidebarCollapsed(collapsed);
    toggles.forEach((node) => node.setAttribute('aria-expanded', collapsed ? 'false' : 'true'));
    return;
  }
  const open = sidebar.classList.contains('open');
  if (open) {
    closeSidebar(sidebar, toggle, backdrop);
    toggle?.focus();
  } else {
    openSidebar(sidebar, toggle, backdrop);
    const firstLink = sidebar.querySelector('a.sidebar-link, span.sidebar-link.current');
    if (firstLink && typeof firstLink.focus === 'function') firstLink.focus();
  }
}

function initSidebarController() {
  const sidebar = document.querySelector('.app-sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (!sidebar || !backdrop || sidebar.dataset.sidebarBound === '1') return;
  sidebar.dataset.sidebarBound = '1';
  syncSidebarCollapsedFromStorage();

  getSidebarToggles().forEach((toggle) => {
    toggle.addEventListener('click', () => handleSidebarToggleClick(sidebar, backdrop));
  });

  backdrop.addEventListener('click', () => {
    const toggle = getSidebarToggles()[0];
    closeSidebar(sidebar, toggle, backdrop);
    toggle?.focus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (isMobileViewport() && sidebar.classList.contains('open')) {
        const toggle = getSidebarToggles()[0];
        closeSidebar(sidebar, toggle, backdrop);
        toggle?.focus();
      }
      return;
    }
    trapSidebarFocus(event, sidebar, getSidebarToggles()[0]);
  });

  document.addEventListener('click', (event) => {
    if (!isMobileViewport() || !sidebar.classList.contains('open')) return;
    const insideSidebar = !!event.target.closest('.app-sidebar');
    const onToggle = !!event.target.closest('.sidebar-toggle, .app-top-sidebar-toggle');
    if (!insideSidebar && !onToggle) {
      closeSidebar(sidebar, getSidebarToggles()[0], backdrop);
    }
  }, { capture: true });

  sidebar.addEventListener('click', (event) => {
    const link = event.target.closest('a.sidebar-link');
    if (!link) return;
    const key = link.getAttribute('data-nav-key') || '';
    const href = link.getAttribute('href') || '/report';
    event.preventDefault();
    if (isMobileViewport()) closeSidebar(sidebar, getSidebarToggles()[0], backdrop);
    navigateTo(key, href);
  });

  // Perceived-speed: warm next surface APIs on hover (deduped; respects browser HTTP cache).
  const warmPrefetch = new Set();
  sidebar.addEventListener('mouseenter', (event) => {
    const link = event.target.closest?.('a.sidebar-link, a.sidebar-more-link');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (!href || warmPrefetch.has(href)) return;
    warmPrefetch.add(href);
    let url = null;
    if (href.includes('governance') || href === '/' || href === '/portfolio') {
      url = '/api/governance-brief.json';
    } else if (href.includes('current-sprint')) {
      url = '/api/current-sprint.json';
    } else if (href.includes('leadership')) {
      url = '/api/leadership-hud.json';
    }
    if (!url) return;
    try {
      fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).catch(() => {});
    } catch (_) { /* ignore */ }
  }, true);

  window.addEventListener('resize', () => {
    syncSidebarCollapsedFromStorage();
    if (!isMobileViewport()) closeSidebar(sidebar, getSidebarToggles()[0], backdrop);
  });
  syncBodySidebarState(sidebar);
}

function ensureGlobalNav() {
  try {
    const current = getCurrentPage();
    const oldInlineNav = document.querySelector('header nav.app-nav');
    if (oldInlineNav) oldInlineNav.remove();

    if (current === PAGE_LOGIN) {
      document.querySelector('.skip-to-content')?.remove();
      document.querySelector('.app-global-nav-wrap')?.remove();
      document.querySelector('.app-sidebar')?.remove();
      document.querySelector('.sidebar-toggle')?.remove();
      document.querySelector('.sidebar-backdrop')?.remove();
      document.querySelector('.mobile-bottom-nav-wrap')?.remove();
      document.body.classList.remove('sidebar-open');
      document.body.classList.remove('sidebar-scroll-lock');
      ensureTopChrome();
      return;
    }

    const sidebars = Array.from(document.querySelectorAll('.app-sidebar'));
    sidebars.slice(1).forEach((node) => node.remove());
    let sidebar = sidebars[0] || null;
    let skipLink = document.querySelector('.skip-to-content');
    if (!skipLink) {
      skipLink = document.createElement('a');
      skipLink.className = 'skip-to-content';
      skipLink.href = '#main-content';
      skipLink.textContent = 'Skip to main content';
      document.body.insertBefore(skipLink, document.body.firstChild);
    }
    document.querySelector('.app-global-nav-wrap')?.remove();
    if (!sidebar) {
      sidebar = document.createElement('aside');
      sidebar.className = 'app-sidebar';
      sidebar.id = 'app-sidebar';
      sidebar.setAttribute('aria-label', 'Primary');
      document.body.insertBefore(sidebar, document.body.firstChild);
    }
    sidebar.innerHTML = buildSidebarHTML();
    delete sidebar.dataset.sidebarBound;
    renderSidebarContextCard();

    document.querySelectorAll('.sidebar-toggle').forEach((node) => node.remove());

    ensureTopChrome();
    bootstrapSubChrome();
    initStickyOffsetMeasure();
    refreshNotificationDockFromStore();
    const topChrome = document.getElementById('app-top-chrome');
    if (topChrome && skipLink && skipLink.parentNode) {
      if (skipLink.nextElementSibling !== topChrome) {
        skipLink.insertAdjacentElement('afterend', topChrome);
      }
    }

    const backdrops = Array.from(document.querySelectorAll('.sidebar-backdrop'));
    backdrops.slice(1).forEach((node) => node.remove());
    let backdrop = backdrops[0] || null;
    if (!backdrop) {
      backdrop = document.createElement('button');
      backdrop.className = 'sidebar-backdrop';
      backdrop.type = 'button';
      backdrop.setAttribute('aria-label', 'Close navigation');
      backdrop.tabIndex = -1;
      document.body.appendChild(backdrop);
    }

    initSidebarController();
    ensureBottomNav();
    const topToggle = document.querySelector('.app-top-sidebar-toggle');
    updateToggleState(topToggle, isMobileViewport() ? sidebar.classList.contains('open') : !document.body.classList.contains('sidebar-collapsed'));
    initDataPulseListener();
    refreshTopChromeBrand();
    window.dispatchEvent(new CustomEvent('app:nav-rendered', { detail: { current } }));
  } catch (_) {}
}

function updateDataPulse(label, state) {
  const el = document.getElementById('sidebar-data-pulse');
  if (!el) return;
  if (el.querySelector('[data-sidebar-alert-jump]')) return;
  const dotClass = state === 'live' ? 'pulse-live' : (state === 'stale' ? 'pulse-stale' : 'pulse-idle');
  el.innerHTML = '<span class="pulse-dot ' + dotClass + '" aria-hidden="true"></span> ' + (label || '');
  updateBottomNavBadge(PAGE_REPORT, state === 'stale' ? '!' : '', state === 'stale' ? 'Report data may be stale' : '');
}

function updateSidebarAlertFooterFromStore() {
  try {
    const el = document.getElementById('sidebar-data-pulse');
    if (!el) return;
    const summary = readNotificationSummary();
    if (!summary) return;
    if (typeof summary.total === 'undefined' && !Array.isArray(summary.runtimeAlerts)) return;
    const tt = getTimeTrackingTotal(summary);
    const rt = getRuntimeAlertCount(summary);
    const eff = effectiveNotificationTotal(summary);
    updateBottomNavBadge(PAGE_SPRINTS, eff > 0 ? String(eff) : '', eff > 0 ? (eff + ' alerts (sprint and/or console)') : '');
    const healthy = tt <= 0 && rt <= 0;
    // Hide the logging alerts chip when healthy — it's developer telemetry that adds
    // visual noise for end users with no alerts. Only show when there are actual alerts.
    if (healthy) {
      el.innerHTML = '';
      return;
    }
    const label = 'Alerts — ' + (tt > 0 ? 'Sprint: ' + tt : '') + (tt > 0 && rt > 0 ? ' · ' : '') + (rt > 0 ? 'Console/runtime: ' + rt : '');
    el.innerHTML = '<button type="button" class="sidebar-alert-footer-chip' + (healthy ? ' is-healthy' : '') + '" data-sidebar-alert-jump="true" title="Open Current Sprint and focus Issues in this sprint">' + label + '</button>';
    const btn = el.querySelector('[data-sidebar-alert-jump]');
    btn?.addEventListener('click', () => {
      const path = window.location.pathname || '';
      if (path.endsWith('/current-sprint') || path === '/current-sprint') {
        (document.getElementById('stories-card') || document.getElementById('stuck-card'))?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        return;
      }
      window.location.href = '/current-sprint#stories-card';
    }, { once: true });
  } catch (_) {}
}

function updateLeadershipBadgeFromPageState() {
  try {
    const hasCritical = document.querySelector('.board-severity-pill.critical, .leadership-board-card-grade.critical');
    updateBottomNavBadge(PAGE_LEADERSHIP, hasCritical ? '!' : '', hasCritical ? 'Leadership: review priorities' : '');
  } catch (_) {}
}

let dataPulseBound = false;
let sidebarFooterRefreshTimer = 0;

function scheduleSidebarAlertFooterFromStore() {
  if (sidebarFooterRefreshTimer) window.clearTimeout(sidebarFooterRefreshTimer);
  sidebarFooterRefreshTimer = window.setTimeout(() => {
    sidebarFooterRefreshTimer = 0;
    updateSidebarAlertFooterFromStore();
  }, 80);
}

function initDataPulseListener() {
  if (dataPulseBound) return;
  dataPulseBound = true;
  window.addEventListener('app:data-freshness', (ev) => {
    try {
      const { label, state } = ev.detail || {};
      updateDataPulse(label || '', state || 'idle');
    } catch (_) {}
  });
  updateDataPulse('No data loaded', 'idle');
  updateSidebarAlertFooterFromStore();
  window.addEventListener('storage', (event) => {
    if (event.key && event.key !== 'appNotificationsV1') return;
    scheduleSidebarAlertFooterFromStore();
  });
  window.addEventListener('app:notification-summary-updated', () => scheduleSidebarAlertFooterFromStore());
  window.addEventListener('app:nav-rendered', () => updateLeadershipBadgeFromPageState());
  window.addEventListener('report-preview-shown', () => updateLeadershipBadgeFromPageState());
  window.addEventListener('delivera:currentSprintPayloadReady', () => {
    try {
      renderSidebarContextCard();
      refreshTopChromeBrand();
    } catch (_) {}
  });
  window.addEventListener('app:top-chrome-rendered', () => refreshTopChromeBrand());
}

/** Brief queue badge on sidebar + mobile nav (B5). */
export function setBriefNavBadge(inboxTotal = 0) {
  const n = Number(inboxTotal) || 0;
  const label = n > 0 ? String(n) : '';
  const el = document.querySelector('[data-sidebar-badge="governance"]');
  if (el) {
    if (label) {
      el.hidden = false;
      el.textContent = label;
      el.setAttribute('title', `${n} items in agent queue`);
    } else {
      el.hidden = true;
      el.textContent = '';
    }
  }
  updateBottomNavBadge(PAGE_GOVERNANCE, label, n > 0 ? `${n} queue items` : '');
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureGlobalNav);
  } else {
    ensureGlobalNav();
  }
  window.addEventListener('hashchange', ensureGlobalNav);
  window.addEventListener('popstate', ensureGlobalNav);
}
