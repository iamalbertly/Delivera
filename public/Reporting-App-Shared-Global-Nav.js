import { renderSidebarContextCard } from './Reporting-App-Shared-Context-From-Storage.js';
import { readNotificationSummary } from './Reporting-App-Shared-Notifications-Dock-Manager.js';

const PAGE_REPORT = 'report';
const PAGE_SPRINT = 'current-sprint';
const PAGE_LEADERSHIP = 'leadership';
const PAGE_LOGIN = 'login';
const MOBILE_BREAKPOINT = 1200;
const LEADERSHIP_HASH = '#trends';

const NAV_ITEMS = [
  {
    key: PAGE_REPORT,
    label: 'Performance - History (Report)',
    href: '/report',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v3H4zm0 6h10v3H4zm0 6h16v3H4z"/></svg>',
  },
  {
    key: PAGE_SPRINT,
    label: 'Performance - Current Sprint (Squad)',
    href: '/current-sprint',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4zM7 3h2v4H7zm8 0h2v4h-2z"/></svg>',
  },
  {
    key: PAGE_LEADERSHIP,
    label: 'Leadership HUD',
    href: '/leadership',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm7 4a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm7-8a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>',
  },
];

function getPathState() {
  const path = typeof window !== 'undefined' && window.location ? window.location.pathname || '' : '';
  const hash = typeof window !== 'undefined' && window.location ? window.location.hash || '' : '';
  return { path, hash };
}

function getCurrentPage() {
  const { path, hash } = getPathState();
  if (path === '/login' || path.endsWith('/login')) return PAGE_LOGIN;
  if ((path === '/report' || path.endsWith('/report')) && hash === LEADERSHIP_HASH) return PAGE_REPORT;
  if (path === '/report' || path.endsWith('/report')) return PAGE_REPORT;
  if (path === '/current-sprint' || path.endsWith('/current-sprint')) return PAGE_SPRINT;
  if (path === '/leadership' || path.endsWith('/leadership') || path === '/sprint-leadership' || path.endsWith('/sprint-leadership')) return PAGE_LEADERSHIP;
  return PAGE_REPORT;
}

function getNavItems(current) {
  return NAV_ITEMS.map((item) => ({ ...item, active: current === item.key }));
}

function buildSidebarHTML() {
  const current = getCurrentPage();
  const items = getNavItems(current);
  let html = '<div class="sidebar-brand"><span class="sidebar-brand-mark" aria-hidden="true">VA</span><span class="sidebar-brand-text">VodaAgileBoard</span></div>';
  html += '<nav class="app-sidebar-nav app-nav" aria-label="Main">';
  for (const item of items) {
    const className = 'sidebar-link' + (item.active ? ' active current' : '');
    if (item.active) {
      html += '<span class="' + className + '" aria-current="page" data-nav-key="' + item.key + '">' + item.icon + '<span>' + item.label + '</span></span>';
    } else {
      html += '<a class="' + className + '" href="' + item.href + '" data-nav-key="' + item.key + '">' + item.icon + '<span>' + item.label + '</span></a>';
    }
  }
  html += '</nav>';
  html += '<div id="sidebar-context-card" class="sidebar-context-card" aria-live="polite"></div>';
  html += '<div class="sidebar-footer sidebar-data-pulse" id="sidebar-data-pulse" aria-live="polite" title="Data freshness indicator"></div>';
  return html;
}

function updateToggleState(toggle, isExpanded) {
  const value = isExpanded ? 'true' : 'false';
  if (toggle) toggle.setAttribute('aria-expanded', value);
  document.querySelectorAll('.sidebar-toggle').forEach((node) => node.setAttribute('aria-expanded', value));
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
  const items = getNavItems(current);
  let html = '<nav class="mobile-bottom-nav" aria-label="Primary mobile navigation">';
  for (const item of items) {
    const className = 'mobile-bottom-nav-item' + (item.active ? ' active' : '');
    const shortLabel = item.key === PAGE_SPRINT ? 'Sprint' : (item.key === PAGE_LEADERSHIP ? 'Leadership' : 'Reports');
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
  if (current === PAGE_LOGIN) {
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

function initSidebarController() {
  const sidebar = document.querySelector('.app-sidebar');
  const toggle = document.querySelector('.sidebar-toggle');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (!sidebar || !toggle || !backdrop || sidebar.dataset.sidebarBound === '1') return;
  sidebar.dataset.sidebarBound = '1';

  toggle.addEventListener('click', () => {
    if (!isMobileViewport()) return;
    const open = sidebar.classList.contains('open');
    if (open) {
      closeSidebar(sidebar, toggle, backdrop);
      toggle.focus();
    } else {
      openSidebar(sidebar, toggle, backdrop);
      const firstLink = sidebar.querySelector('a.sidebar-link, span.sidebar-link.current');
      if (firstLink && typeof firstLink.focus === 'function') firstLink.focus();
    }
  });

  backdrop.addEventListener('click', () => {
    closeSidebar(sidebar, toggle, backdrop);
    toggle.focus();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSidebar(sidebar, toggle, backdrop);
      toggle.focus();
      return;
    }
    trapSidebarFocus(event, sidebar, toggle);
  });

  document.addEventListener('click', (event) => {
    if (!isMobileViewport() || !sidebar.classList.contains('open')) return;
    const insideSidebar = !!event.target.closest('.app-sidebar');
    const onToggle = !!event.target.closest('.sidebar-toggle');
    if (!insideSidebar && !onToggle) {
      closeSidebar(sidebar, toggle, backdrop);
    }
  }, { capture: true });

  sidebar.addEventListener('click', (event) => {
    const link = event.target.closest('a.sidebar-link');
    if (!link) return;
    const key = link.getAttribute('data-nav-key') || '';
    const href = link.getAttribute('href') || '/report';
    event.preventDefault();
    if (isMobileViewport()) closeSidebar(sidebar, toggle, backdrop);
    navigateTo(key, href);
  });

  window.addEventListener('resize', () => {
    if (!isMobileViewport()) closeSidebar(sidebar, toggle, backdrop);
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

    const toggles = Array.from(document.querySelectorAll('.sidebar-toggle'));
    toggles.slice(1).forEach((node) => node.remove());
    let toggle = toggles[0] || null;
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.className = 'sidebar-toggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-label', 'Toggle navigation');
      toggle.setAttribute('aria-controls', 'app-sidebar');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>';
      document.body.appendChild(toggle);
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
    updateToggleState(toggle, sidebar.classList.contains('open'));
    initDataPulseListener();
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
    if (!summary || typeof summary.total === 'undefined') return;
    const total = Number(summary.total || 0);
    updateBottomNavBadge(PAGE_SPRINT, total > 0 ? String(total) : '', total > 0 ? (total + ' sprint blockers') : '');
    el.innerHTML = '<button type="button" class="sidebar-alert-footer-chip' + (total <= 0 ? ' is-healthy' : '') + '" data-sidebar-alert-jump="true" title="Open Current Sprint and focus Issues in this sprint">Logging alerts: ' + total + (total <= 0 ? ' · Healthy' : '') + '</button>';
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
    updateBottomNavBadge(PAGE_LEADERSHIP, hasCritical ? '!' : '', hasCritical ? 'Leadership attention required' : '');
  } catch (_) {}
}

let dataPulseBound = false;
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
    updateSidebarAlertFooterFromStore();
  });
  window.addEventListener('app:notification-summary-updated', () => updateSidebarAlertFooterFromStore());
  window.addEventListener('app:nav-rendered', () => updateLeadershipBadgeFromPageState());
  window.addEventListener('report-preview-shown', () => updateLeadershipBadgeFromPageState());
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
