const DEFAULT_NOTIFICATION_STORE_KEY = 'appNotificationsV1';
const DEFAULT_NOTIFICATION_DOCK_STATE_KEY = 'appNotificationsDockStateV1';
const DEFAULT_TOGGLE_ID = 'app-notification-toggle';
const DEFAULT_DOCK_ID = 'app-notification-dock';

export function readNotificationSummary(storageKey = DEFAULT_NOTIFICATION_STORE_KEY) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (_) {
    return null;
  }
}

export function writeNotificationSummary(summary, storageKey = DEFAULT_NOTIFICATION_STORE_KEY) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(summary));
  } catch (_) {}
}

export function readNotificationDockState(stateKey = DEFAULT_NOTIFICATION_DOCK_STATE_KEY) {
  try {
    const raw = localStorage.getItem(stateKey);
    if (!raw) return { collapsed: false, hidden: false };
    const parsed = JSON.parse(raw);
    return {
      collapsed: !!parsed.collapsed,
      hidden: !!parsed.hidden,
    };
  } catch (_) {
    return { collapsed: false, hidden: false };
  }
}

export function writeNotificationDockState(next, stateKey = DEFAULT_NOTIFICATION_DOCK_STATE_KEY) {
  try {
    localStorage.setItem(stateKey, JSON.stringify(next));
  } catch (_) {}
}

function renderToggleButton({ toggleId, stateKey, onShow, summary } = {}) {
  let toggle = document.getElementById(toggleId);
  if (!toggle) {
    const container = document.querySelector('header .header-row') || document.body;
    toggle = document.createElement('button');
    toggle.id = toggleId;
    toggle.className = 'app-notification-toggle';
    toggle.type = 'button';
    const total = summary && summary.total ? Number(summary.total) : 0;
    toggle.setAttribute('aria-label', 'Show notifications');
    toggle.innerHTML = `🔔 <span class="app-notification-badge">${total}</span>`;
    toggle.addEventListener('click', () => {
      const state = readNotificationDockState(stateKey);
      writeNotificationDockState({ ...state, hidden: false }, stateKey);
      toggle.remove();
      if (onShow) onShow();
    });
    container.appendChild(toggle);
  } else if (summary && typeof summary.total !== 'undefined') {
    const badge = toggle.querySelector('.app-notification-badge');
    if (badge) badge.textContent = String(summary.total);
  }
}

function updateSidebarAlertFooter(summary, pageContext = 'report') {
  const el = document.getElementById('sidebar-data-pulse');
  if (!el) return;
  const total = summary && summary.total != null ? Number(summary.total) : 0;
  const healthy = total <= 0;
  const label = healthy ? 'Logging alerts: 0 · Healthy' : `Logging alerts: ${total}`;
  el.innerHTML = `<button type="button" class="sidebar-alert-footer-chip${healthy ? ' is-healthy' : ''}" data-sidebar-alert-jump="true" title="Open Current Sprint and focus Work risks">${label}</button>`;
  const btn = el.querySelector('[data-sidebar-alert-jump]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    try {
      if (pageContext === 'current-sprint') {
        const target = document.getElementById('stuck-card') || document.getElementById('work-risks-table') || document.getElementById('stories-card');
        target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } else {
        window.location.href = '/current-sprint#stuck-card';
      }
    } catch (_) {}
  });
}

export function renderNotificationDock(options = {}) {
  const {
    summary,
    storageKey = DEFAULT_NOTIFICATION_STORE_KEY,
    stateKey = DEFAULT_NOTIFICATION_DOCK_STATE_KEY,
    dockId = DEFAULT_DOCK_ID,
    toggleId = DEFAULT_TOGGLE_ID,
    linkHref = '/current-sprint',
    title = 'Time tracking alerts',
    pageContext = 'report',
    collapsedByDefault = false,
  } = options;
  const resolvedSummary = summary || readNotificationSummary(storageKey);
  const existing = document.getElementById(dockId);
  let stateSource = 'default';
  try {
    const rawState = localStorage.getItem(stateKey);
    if (rawState) stateSource = 'stored';
  } catch (_) {}
  const state = readNotificationDockState(stateKey);
  if (stateSource === 'default' && collapsedByDefault) {
    state.collapsed = true;
  }

  const total = resolvedSummary && resolvedSummary.total != null ? Number(resolvedSummary.total) : 0;

  if (existing) existing.remove();
  const toggle = document.getElementById(toggleId);
  if (toggle) toggle.remove();
  document.body.classList.remove('notification-dock-visible');

  const sprintNavLink = document.querySelector('.app-nav a[href*="current-sprint"]');
  if (sprintNavLink) {
    if (total > 0) {
      sprintNavLink.innerHTML = 'Current Sprint (Squad) <span class="nav-alert-badge">' + total + '</span>';
      sprintNavLink.title = 'Time tracking alerts: ' + total + '. Open to resolve.';
    } else {
      sprintNavLink.textContent = 'Current Sprint (Squad)';
      sprintNavLink.removeAttribute('title');
    }
  }

  updateSidebarAlertFooter(resolvedSummary || { total: 0 }, pageContext);

  if (total <= 0) return;
}

export const NOTIFICATION_STORE_KEY = DEFAULT_NOTIFICATION_STORE_KEY;
export const NOTIFICATION_DOCK_STATE_KEY = DEFAULT_NOTIFICATION_DOCK_STATE_KEY;
export const NOTIFICATION_TOGGLE_ID = DEFAULT_TOGGLE_ID;
