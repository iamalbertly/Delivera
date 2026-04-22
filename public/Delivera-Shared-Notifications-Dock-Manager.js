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

export function buildNotificationSummaryFromSprintData(data) {
  if (!data?.sprint) return null;
  const tracking = data.subtaskTracking?.summary || {};
  const missingEstimate = tracking.missingEstimate ?? 0;
  const missingLogged = tracking.missingLogged ?? 0;
  return {
    total: missingEstimate + missingLogged,
    missingEstimate,
    missingLogged,
    boardId: data.board?.id || '',
    boardName: data.board?.name || '',
    sprintId: data.sprint?.id || '',
    sprintName: data.sprint?.name || '',
    updatedAt: new Date().toISOString(),
  };
}

/** Sprint/time-tracking total (number), excluding console/runtime bridge entries. */
export function getTimeTrackingTotal(summary) {
  if (!summary || typeof summary.total === 'undefined') return 0;
  return Math.max(0, Number(summary.total) || 0);
}

export function getRuntimeAlertCount(summary) {
  if (!summary || !Array.isArray(summary.runtimeAlerts)) return 0;
  return summary.runtimeAlerts.length;
}

/** Combined count for badges: sprint logging alerts + localhost runtime/console alerts. */
export function effectiveNotificationTotal(summary) {
  return getTimeTrackingTotal(summary) + getRuntimeAlertCount(summary);
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

function ariaLabelForNotificationToggle(summary) {
  const tt = getTimeTrackingTotal(summary);
  const rt = getRuntimeAlertCount(summary);
  const n = tt + rt;
  if (n === 0) return 'Show notifications';
  const parts = [];
  if (tt > 0) parts.push(`${tt} sprint logging alert${tt === 1 ? '' : 's'}`);
  if (rt > 0) parts.push(`${rt} console/runtime alert${rt === 1 ? '' : 's'}`);
  return `Show notifications: ${parts.join(' · ')}`;
}

function renderToggleButton({ toggleId, stateKey, onShow, summary } = {}) {
  let toggle = document.getElementById(toggleId);
  const eff = effectiveNotificationTotal(summary);
  if (!toggle) {
    const container = document.querySelector('header .header-row') || document.body;
    toggle = document.createElement('button');
    toggle.id = toggleId;
    toggle.className = 'app-notification-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', ariaLabelForNotificationToggle(summary));
    toggle.innerHTML = `Bell <span class="app-notification-badge">${eff}</span>`;
    toggle.addEventListener('click', () => {
      const state = readNotificationDockState(stateKey);
      writeNotificationDockState({ ...state, hidden: false }, stateKey);
      toggle.remove();
      if (onShow) onShow();
    });
    container.appendChild(toggle);
  } else if (summary) {
    const badge = toggle.querySelector('.app-notification-badge');
    if (badge) badge.textContent = String(eff);
    toggle.setAttribute('aria-label', ariaLabelForNotificationToggle(summary));
  }
}

function updateSidebarAlertFooter(summary, pageContext = 'report') {
  const el = document.getElementById('sidebar-data-pulse');
  if (!el) return;
  const tt = summary && summary.total != null ? Number(summary.total) : 0;
  const rt = getRuntimeAlertCount(summary);
  const healthy = tt <= 0 && rt <= 0;
  const trustLabel = summary && summary.trustLabel ? String(summary.trustLabel) : '';
  let label;
  if (healthy) {
    label = `Logging alerts: 0${trustLabel ? ` | ${trustLabel}` : ' | Evidence complete'}`;
  } else {
    const parts = [];
    if (tt > 0) parts.push(`Sprint: ${tt}`);
    if (rt > 0) parts.push(`Console/runtime: ${rt}`);
    label = `Alerts — ${parts.join(' · ')}${trustLabel ? ` | ${trustLabel}` : ''}`;
  }
  el.innerHTML = `<button type="button" class="sidebar-alert-footer-chip${healthy ? ' is-healthy' : ''}" data-sidebar-alert-jump="true" title="Open Current Sprint and focus Work risks">${label}</button>`;
  const btn = el.querySelector('[data-sidebar-alert-jump]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    try {
      if (pageContext === 'current-sprint') {
        const target = document.getElementById('stories-card') || document.getElementById('stuck-card');
        if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(target);
        else target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } else {
        window.location.href = '/current-sprint#stories-card';
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

  const eff = effectiveNotificationTotal(resolvedSummary);

  if (existing) existing.remove();
  const toggle = document.getElementById(toggleId);
  if (toggle) toggle.remove();
  document.body.classList.remove('notification-dock-visible');

  const sprintNavLink = document.querySelector('.app-nav a[href*="current-sprint"]');
  if (sprintNavLink) {
    if (eff > 0) {
      sprintNavLink.innerHTML = 'Current Sprint (Squad) <span class="nav-alert-badge">' + eff + '</span>';
      sprintNavLink.title = 'Open alerts: ' + eff + ' (sprint logging and/or console on localhost).';
    } else {
      sprintNavLink.textContent = 'Current Sprint (Squad)';
      sprintNavLink.removeAttribute('title');
    }
  }

  updateSidebarAlertFooter(resolvedSummary || { total: 0 }, pageContext);

  if (eff <= 0) return;
  renderToggleButton({ toggleId, stateKey, summary: resolvedSummary });
}

/**
 * Re-render dock from localStorage after runtime alerts or external updates.
 * Safe to call from localhost console bridge; no-ops on paths without app chrome.
 */
export function refreshNotificationDockFromStore() {
  if (typeof window === 'undefined' || !window.location) return;
  const path = window.location.pathname || '';
  if (path.includes('/login') || path.endsWith('login')) return;
  if (path.includes('current-sprint')) {
    renderNotificationDock({ pageContext: 'current-sprint', collapsedByDefault: false });
  } else if (path.includes('leadership')) {
    renderNotificationDock({ pageContext: 'leadership', collapsedByDefault: true });
  } else {
    renderNotificationDock({ pageContext: 'report', collapsedByDefault: true });
  }
}

export const NOTIFICATION_STORE_KEY = DEFAULT_NOTIFICATION_STORE_KEY;
export const NOTIFICATION_DOCK_STATE_KEY = DEFAULT_NOTIFICATION_DOCK_STATE_KEY;
export const NOTIFICATION_TOGGLE_ID = DEFAULT_TOGGLE_ID;
