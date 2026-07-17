/**
 * Persistent Jira-style top chrome — global actions SSOT (sidebar toggle, surfaces, search, Create, settings).
 */
import { getContextDisplayString } from './Delivera-Shared-Context-From-Storage.js';
import { readSharedProjectsCsv } from './Delivera-Shared-Storage-Keys.js';
import {
  readNotificationSummary,
  effectiveNotificationTotal,
  openNotificationDockFromStore,
} from './Delivera-Shared-Notifications-Dock-Manager.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { resolveAiTrustDisplay } from './Delivera-AI-Trust-Display-01SSOT.js';
import { openImproveDeliveraModal } from './Delivera-Shared-ImproveDelivera-01Modal-UI.js';
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

export const TOP_CHROME_ID = 'app-top-chrome';
export const NOTIFICATION_SLOT_ID = 'app-notification-slot';
export const SUB_CHROME_SLOT_ID = 'app-sub-chrome-slot';
export const TOP_CHROME_SELECTORS = {
  root: `#${TOP_CHROME_ID}`,
  toggle: '[data-top-action="sidebar-toggle"]',
  create: '[data-top-action="create-work"]',
  settings: '[data-top-action="settings"]',
  search: '#app-top-search',
  switcher: '.app-top-switcher-item',
  notifications: '#app-notification-toggle',
  agent: '[data-top-action="agent"]',
  help: '[data-top-action="help"]',
  improve: '[data-top-action="improve-delivera"]',
  avatar: '[data-top-action="avatar"]',
};

const PAGE_LOGIN = 'login';
const PAGE_GOVERNANCE = 'governance';
const PAGE_SPRINTS = 'sprints';
const PAGE_REPORT = 'report';
const PAGE_SETTINGS = 'settings';
const SIDEBAR_COLLAPSED_KEY = 'delivera_sidebar_collapsed';
const SIDEBAR_COLLAPSED_PRESET_KEY = 'delivera_sidebar_collapsed_preset_v1';

const SURFACE_SWITCHER = [
  { key: PAGE_GOVERNANCE, label: 'Answer', href: '/governance' },
  { key: PAGE_SPRINTS, label: 'Today', href: '/current-sprint' },
  { key: PAGE_REPORT, label: 'Proof', href: '/report' },
];

function getPathState() {
  const path = typeof window !== 'undefined' && window.location ? window.location.pathname || '' : '';
  const hash = typeof window !== 'undefined' && window.location ? window.location.hash || '' : '';
  return { path, hash };
}

export function getCurrentPageForChrome() {
  const { path } = getPathState();
  if (path === '/login' || path.endsWith('/login')) return PAGE_LOGIN;
  if (path === '/governance' || path.endsWith('/governance') || path === '/brief' || path.endsWith('/brief')) return PAGE_GOVERNANCE;
  if (path === '/current-sprint' || path.endsWith('/current-sprint') || path === '/sprints' || path.endsWith('/sprints')) return PAGE_SPRINTS;
  if (path === '/settings' || path.endsWith('/settings')) return PAGE_SETTINGS;
  if (path === '/report' || path.endsWith('/report')) return PAGE_REPORT;
  return PAGE_REPORT;
}

function searchPlaceholder(page) {
  if (page === PAGE_GOVERNANCE) return 'Search squads…';
  if (page === PAGE_SPRINTS) return 'Jump to issue KEY…';
  if (page === PAGE_REPORT) return 'Filter proof view…';
  if (page === PAGE_SETTINGS) return 'Filter settings…';
  return 'Search…';
}

function readProjectsCsvForCreate() {
  try {
    return readSharedProjectsCsv() || '';
  } catch (_) {
    return '';
  }
}

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch (_) {}
  document.body.classList.toggle('sidebar-collapsed', !!collapsed);
}

export function syncSidebarCollapsedFromStorage() {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  const mobile = window.matchMedia('(max-width: 1200px)').matches;
  if (mobile) {
    document.body.classList.remove('sidebar-collapsed');
    return;
  }
  writeSidebarCollapsed(readSidebarCollapsed());
}

function applyDefaultSidebarCollapsed(current) {
  try {
    if (localStorage.getItem(SIDEBAR_COLLAPSED_PRESET_KEY)) return;
    if (current === PAGE_REPORT || current === PAGE_GOVERNANCE) {
      writeSidebarCollapsed(true);
      localStorage.setItem(SIDEBAR_COLLAPSED_PRESET_KEY, '1');
    }
  } catch (_) {}
}

async function loadSessionMetaIntoAvatar() {
  const btn = document.querySelector('[data-top-action="avatar"]');
  if (!btn) return;
  try {
    const res = await fetch('/api/session-meta.json', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();
    const initials = String(data?.initials || 'DL').slice(0, 2).toUpperCase();
    btn.textContent = initials;
    if (data?.emailMasked) btn.setAttribute('title', data.emailMasked);
  } catch (_) {}
}

function isMobileTopChrome() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(max-width: 768px)').matches;
}

function buildAiTrustPillHTML() {
  const mobileDot = isMobileTopChrome();
  return `<span class="app-top-ai-trust-pill app-top-ai-trust-pill--loading" data-ai-trust-pill="loading" title="Checking AI status">${mobileDot ? '<span class="app-top-ai-trust-dot" aria-hidden="true"></span>' : 'AI · …'}</span>`;
}

export async function refreshAiTrustPill() {
  const chrome = document.getElementById(TOP_CHROME_ID);
  if (!chrome) return;
  const slot = chrome.querySelector('[data-top-slot="actions"]');
  const createBtn = slot?.querySelector('[data-top-action="create-work"]');
  if (!slot || !createBtn) return;
  const trust = await resolveAiTrustDisplay({ mobileDot: isMobileTopChrome() });
  const existing = slot.querySelector('[data-ai-trust-pill]');
  if (existing) existing.remove();
  createBtn.insertAdjacentHTML('afterend', trust.pillHtml);
}

function buildSwitcherHTML(current) {
  let html = '<div class="app-top-switcher" role="navigation" aria-label="Surfaces">';
  for (const item of SURFACE_SWITCHER) {
    const active = current === item.key;
    const cls = 'app-top-switcher-item' + (active ? ' is-active' : '');
    if (active) {
      html += `<span class="${cls}" aria-current="page" data-top-surface="${item.key}">${item.label}</span>`;
    } else {
      html += `<a class="${cls}" href="${item.href}" data-top-surface="${item.key}">${item.label}</a>`;
    }
  }
  html += '</div>';
  return html;
}

function buildTopChromeHTML(current) {
  const contextLine = getContextDisplayString();
  const projects = readProjectsCsvForCreate();
  const placeholder = searchPlaceholder(current);
  return ''
    + `<div class="app-top-chrome-inner">`
    + `<div data-top-slot="toggle">`
    + `<button type="button" class="app-top-btn app-top-sidebar-toggle" data-top-action="sidebar-toggle" aria-label="Expand or collapse sidebar" aria-controls="app-sidebar" aria-expanded="true">`
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v14H3V5zm2 2v10h2V7H5zm4 0v10h10V7H9z"/></svg>'
    + '</button></div>'
    + `<div data-top-slot="switcher">${buildSwitcherHTML(current)}</div>`
    + `<div data-top-slot="brand">`
    + `<a class="app-top-brand" href="/governance" title="Delivera Brief">`
    + '<span class="app-top-brand-mark" aria-hidden="true">De</span>'
    + '<span class="app-top-brand-text">'
    + '<span class="app-top-brand-name">Delivera</span>'
    + `<span class="app-top-brand-context" title="${escapeAttr(contextLine)}">${escapeHtml(truncate(contextLine, 48))}</span>`
    + '</span></a></div>'
    + `<div data-top-slot="search">`
    + '<div class="app-top-search-wrap">'
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>'
    + `<input type="search" id="app-top-search" autocomplete="off" placeholder="${escapeAttr(placeholder)}" aria-label="Context search">`
    + '</div></div>'
    + `<div data-top-slot="actions" role="group" aria-label="Global actions">`
    + `<button type="button" class="app-top-create" data-top-action="create-work" data-open-outcome-modal data-outcome-context="Create work from global chrome." data-outcome-projects="${escapeAttr(projects)}">`
    + '<span aria-hidden="true">+</span><span class="app-top-create-label">Create</span></button>'
    + buildAiTrustPillHTML()
    + (current === PAGE_GOVERNANCE ? '' : `<button type="button" class="app-top-agent-pill is-visible" data-top-action="agent">Actions</button>`)
    + `<button type="button" class="app-top-btn app-top-icon-btn" data-top-action="notifications" id="app-top-notifications-btn" aria-label="Notifications" title="Notifications">`
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z"/></svg>'
    + '<span class="app-top-notify-badge" id="app-top-notify-badge" hidden></span></button>'
    + `<button type="button" class="app-top-btn app-top-icon-btn" data-top-action="help" aria-label="Help" title="Help">`
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/></svg></button>'
    + `<button type="button" class="app-top-btn app-top-icon-btn" data-top-action="improve-delivera" aria-label="${escapeAttr(COPY.improveDelivera)}" title="${escapeAttr(COPY.improveDelivera)}">`
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12zM7 9h2v2H7V9zm4 0h2v2h-2V9zm4 0h2v2h-2V9z"/></svg></button>'
    + `<a class="app-top-btn app-top-icon-btn" data-top-action="settings" href="/settings" aria-label="Settings" title="Settings">`
    + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19.4 13 .1-2-1.8-.7a5.6 5.6 0 0 0-.4-1l.8-1.8-1.4-1.4-1.8.8a5.6 5.6 0 0 0-1-.4L13 3h-2l-.7 1.8a5.6 5.6 0 0 0-1 .4l-1.8-.8-1.4 1.4.8 1.8a5.6 5.6 0 0 0-.4 1L3 11v2l1.8.7a5.6 5.6 0 0 0 .4 1l-.8 1.8 1.4 1.4 1.8-.8a5.6 5.6 0 0 0 1 .4L11 21h2l.7-1.8a5.6 5.6 0 0 0 1-.4l1.8.8 1.4-1.4-.8-1.8a5.6 5.6 0 0 0 .4-1ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"/></svg></a>'
    + `<button type="button" class="app-top-avatar" data-top-action="avatar" aria-label="Account menu" title="Account">DL</button>`
    + '</div></div>'
    + '<div id="app-top-help-popover" class="app-top-help-popover" hidden role="dialog" aria-label="Help">'
    + '<p><a href="/settings#gov-ai-helper">Governance AI helper</a></p>'
    + '<p><a href="/settings#jira-activity">Jira activity &amp; reconnect</a></p>'
    + '<p><strong>Search:</strong> Brief squads · Sprint issue KEY · Proof projects.</p>'
    + '<p><strong>Tests:</strong> <code>npm run test:journey:ux-core</code> · <code>npm run test:journey:governance</code></p>'
    + '</div>'
    + '<div id="app-top-avatar-menu" class="app-top-avatar-menu" hidden role="menu">'
    + '<a href="/settings" role="menuitem">Settings</a>'
    + '<button type="button" role="menuitem" data-top-action="copy-context">Copy squad context</button>'
    + '</div>';
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function truncate(s, max) {
  const t = String(s || '').trim();
  if (t.length <= max) return t || 'No context yet';
  return t.slice(0, max - 1) + '…';
}

function delegateSearch(page, query) {
  const q = String(query || '').trim();
  if (page === PAGE_GOVERNANCE) {
    const mount = document.getElementById('gov-scope-bar-mount');
    mount?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    const input = document.querySelector('#gov-scope-bar-mount input[type="search"], #gov-scope-bar-mount input[type="text"]');
    if (input) {
      input.focus();
      if (q) {
        input.value = q;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    return;
  }
  if (page === PAGE_SPRINTS) {
    const jump = document.getElementById('issue-jump-input');
    if (jump) {
      jump.focus();
      if (q) {
        jump.value = q;
        jump.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    return;
  }
  if (page === PAGE_REPORT) {
    const handler = typeof window !== 'undefined' && window.__deliveraHandleReportChromeAction;
    if (typeof handler === 'function') {
      handler('open-project-filters');
    }
    const tabSearch = document.getElementById('report-tab-search');
    const projectSearch = document.getElementById('project-search');
    const active = document.querySelector('.report-tab-panel:not([hidden])');
    const useTab = active && tabSearch && !projectSearch;
    const target = useTab ? tabSearch : projectSearch;
    window.setTimeout(() => {
      if (!target) return;
      if (q) {
        target.value = q;
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
      target.focus();
    }, 50);
    return;
  }
  if (page === PAGE_SETTINGS) {
    const sections = document.querySelectorAll('main h2, main h3, .settings-section-title');
    const lower = q.toLowerCase();
    for (const el of sections) {
      if (!q || String(el.textContent || '').toLowerCase().includes(lower)) {
        el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
  }
}

function updateNotificationBadge() {
  const summary = readNotificationSummary();
  const eff = effectiveNotificationTotal(summary);
  const badge = document.getElementById('app-top-notify-badge');
  const btn = document.getElementById('app-top-notifications-btn');
  if (!badge || !btn) return;
  if (eff > 0) {
    badge.hidden = false;
    badge.textContent = String(eff);
    btn.setAttribute('aria-label', `Notifications: ${eff} alert${eff === 1 ? '' : 's'}`);
  } else {
    badge.hidden = true;
    badge.textContent = '';
    btn.setAttribute('aria-label', 'Notifications');
  }
}

function dismissTopSearchActive(chrome) {
  const search = chrome?.querySelector('#app-top-search');
  if (search && document.activeElement === search) search.blur();
  document.body.classList.remove('top-search-active');
  syncMobileSearchCollapse(chrome);
}

function syncMobileSearchCollapse(chrome) {
  const wrap = chrome?.querySelector('.app-top-search-wrap');
  const search = chrome?.querySelector('#app-top-search');
  if (!wrap || !search) return;
  const mobile = isMobileTopChrome();
  const active = document.body.classList.contains('top-search-active');
  if (!mobile || active) {
    wrap.classList.remove('is-collapsed');
    return;
  }
  wrap.classList.add('is-collapsed');
  if (document.activeElement === search) search.blur();
}

function bindTopChromeInteractions(chrome, current) {
  if (chrome.dataset.topChromeBound === '1') return;
  chrome.dataset.topChromeBound = '1';

  const search = chrome.querySelector('#app-top-search');
  const searchWrap = chrome.querySelector('.app-top-search-wrap');
  let searchTimer = 0;
  search?.addEventListener('input', () => {
    if (searchTimer) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      delegateSearch(getCurrentPageForChrome(), search.value);
    }, 200);
  });
  search?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      delegateSearch(getCurrentPageForChrome(), search.value);
    }
  });
  search?.addEventListener('focus', () => {
    document.body.classList.add('top-search-active');
    searchWrap?.classList.remove('is-collapsed');
  });
  search?.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (document.activeElement === search) return;
      dismissTopSearchActive(chrome);
    }, 0);
  });
  if (!window.__deliveraTopChromeEscapeBound) {
    window.__deliveraTopChromeEscapeBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !document.body.classList.contains('top-search-active')) return;
      const el = document.getElementById(TOP_CHROME_ID);
      if (el) dismissTopSearchActive(el);
    });
  }
  if (!window.__deliveraTopChromeResizeBound) {
    window.__deliveraTopChromeResizeBound = true;
    window.addEventListener('resize', () => {
      const el = document.getElementById(TOP_CHROME_ID);
      if (el) syncMobileSearchCollapse(el);
    });
  }
  if (!window.__deliveraTopChromeSlashBound) {
    window.__deliveraTopChromeSlashBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = String(e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
      e.preventDefault();
      const s = document.getElementById('app-top-search');
      if (s) { s.focus(); s.select?.(); }
    });
  }
  syncMobileSearchCollapse(chrome);

  chrome.querySelector('[data-top-action="help"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const pop = document.getElementById('app-top-help-popover');
    if (!pop) return;
    const open = pop.hidden;
    pop.hidden = !open;
    document.getElementById('app-top-avatar-menu')?.setAttribute('hidden', '');
  });

  chrome.querySelector('[data-top-action="improve-delivera"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('app-top-help-popover')?.setAttribute('hidden', '');
    document.getElementById('app-top-avatar-menu')?.setAttribute('hidden', '');
    openImproveDeliveraModal();
  });

  if (!window.__deliveraImproveFeedbackKeyBound) {
    window.__deliveraImproveFeedbackKeyBound = true;
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'f' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const tag = String(ev.target?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ev.target?.isContentEditable) return;
      if (!document.body?.classList?.contains('has-top-chrome')) return;
      ev.preventDefault();
      openImproveDeliveraModal();
    });
  }

  chrome.querySelector('[data-top-action="avatar"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('app-top-avatar-menu');
    if (!menu) return;
    const open = menu.hidden;
    menu.hidden = !open;
    document.getElementById('app-top-help-popover')?.setAttribute('hidden', '');
  });

  chrome.querySelector('[data-top-action="copy-context"]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getContextDisplayString());
    } catch (_) {}
    document.getElementById('app-top-avatar-menu')?.setAttribute('hidden', '');
  });

  chrome.querySelector('[data-top-action="notifications"]')?.addEventListener('click', () => {
    openNotificationDockFromStore();
  });

  chrome.querySelector('[data-top-action="agent"]')?.addEventListener('click', () => {
    if (current === PAGE_GOVERNANCE) {
      document.querySelector('[data-gov-inbox-open], [data-action="open-inbox"], #gov-inbox-chip')?.click?.()
        || document.getElementById('gov-sticky-answer-mount')?.scrollIntoView?.({ behavior: 'smooth' });
      return;
    }
    const actionTarget = document.querySelector('[data-send-top-nudge], [data-action="send-top-nudge-to-jira"], .cs-cockpit-quick-create, .gov-cluster-nudge-primary, #stories-card, #jira-activity');
    if (actionTarget) {
      actionTarget.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      actionTarget.focus?.({ preventScroll: true });
      return;
    }
    window.dispatchEvent(new CustomEvent('delivera-gov-scroll-first-action'));
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('#app-top-help-popover, [data-top-action="help"]')) return;
    if (e.target.closest('#app-top-avatar-menu, [data-top-action="avatar"]')) return;
    document.getElementById('app-top-help-popover')?.setAttribute('hidden', '');
    document.getElementById('app-top-avatar-menu')?.setAttribute('hidden', '');
  });

  window.addEventListener('storage', (ev) => {
    if (ev.key === 'appNotificationsV1') updateNotificationBadge();
  });
  window.addEventListener('app:notification-summary-updated', updateNotificationBadge);

  const createBtn = chrome.querySelector('[data-top-action="create-work"]');
  const refreshCreateProjects = () => {
    if (createBtn) createBtn.setAttribute('data-outcome-projects', readProjectsCsvForCreate());
  };
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'delivera_selectedProjects') refreshCreateProjects();
  });
  refreshCreateProjects();

}

export function refreshTopChromeBrand() {
  const el = document.querySelector('.app-top-brand-context');
  if (!el) return;
  const line = getContextDisplayString();
  el.textContent = truncate(line, 48);
  el.setAttribute('title', line);
}

export function ensureNotificationSlot() {
  const chrome = document.getElementById(TOP_CHROME_ID);
  if (!chrome) return null;
  let slot = document.getElementById(NOTIFICATION_SLOT_ID);
  if (!slot) {
    slot = document.createElement('div');
    slot.id = NOTIFICATION_SLOT_ID;
    slot.className = 'app-notification-slot';
    slot.setAttribute('aria-live', 'polite');
  }
  if (slot.previousElementSibling?.id !== TOP_CHROME_ID) {
    chrome.insertAdjacentElement('afterend', slot);
  }
  return slot;
}

export function ensureSubChromeSlot() {
  const notifySlot = ensureNotificationSlot();
  if (!notifySlot) return null;
  let slot = document.getElementById(SUB_CHROME_SLOT_ID);
  if (!slot) {
    slot = document.createElement('div');
    slot.id = SUB_CHROME_SLOT_ID;
    slot.className = 'app-sub-chrome-slot';
    slot.setAttribute('aria-live', 'polite');
  }
  if (slot.previousElementSibling?.id !== NOTIFICATION_SLOT_ID) {
    notifySlot.insertAdjacentElement('afterend', slot);
  }
  return slot;
}

export function ensureTopChrome() {
  const current = getCurrentPageForChrome();
  if (current === PAGE_LOGIN) {
    document.getElementById(TOP_CHROME_ID)?.remove();
    document.getElementById(NOTIFICATION_SLOT_ID)?.remove();
    document.getElementById(SUB_CHROME_SLOT_ID)?.remove();
    document.body.classList.remove('has-top-chrome', 'chrome-suppress-page-create', 'has-sub-chrome');
    return null;
  }

  let chrome = document.getElementById(TOP_CHROME_ID);
  if (!chrome) {
    chrome = document.createElement('header');
    chrome.id = TOP_CHROME_ID;
    chrome.className = 'app-top-chrome';
    chrome.setAttribute('role', 'banner');
    document.body.insertBefore(chrome, document.body.firstChild);
  }
  ensureNotificationSlot();
  ensureSubChromeSlot();

  delete chrome.dataset.topChromeBound;
  chrome.innerHTML = buildTopChromeHTML(current);
  document.body.classList.add('has-top-chrome', 'chrome-suppress-page-create');
  applyDefaultSidebarCollapsed(current);
  syncSidebarCollapsedFromStorage();
  bindTopChromeInteractions(chrome, current);
  syncMobileSearchCollapse(chrome);
  updateNotificationBadge();
  refreshTopChromeBrand();
  loadSessionMetaIntoAvatar();
  void refreshAiTrustPill();

  window.dispatchEvent(new CustomEvent('app:top-chrome-rendered', { detail: { current } }));
  return chrome;
}
