const DEFAULT_NOTIFICATION_STORE_KEY = 'appNotificationsV1';
const DEFAULT_NOTIFICATION_DOCK_STATE_KEY = 'appNotificationsDockStateV1';
const DEFAULT_TOGGLE_ID = 'app-notification-toggle';
const DEFAULT_DOCK_ID = 'app-notification-dock';
/** Matches `NOTIFICATION_SLOT_ID` in Delivera-Shared-Top-Chrome-01Render-UI.js (no import — avoids cycle). */
const NOTIFICATION_SLOT_ID = 'app-notification-slot';

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
  return summary.runtimeAlerts.filter((a) => !a.diagnosticsOnly).length;
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

function pageContextFromPath() {
  const path = typeof window !== 'undefined' && window.location ? window.location.pathname || '' : '';
  if (path.includes('governance') || path.includes('/brief')) return 'governance';
  if (path.includes('settings')) return 'settings';
  if (path.includes('current-sprint')) return 'current-sprint';
  if (path.includes('leadership')) return 'leadership';
  return 'report';
}

function notificationFocusLink(pageContext) {
  if (pageContext === 'governance') return { href: '/governance', label: 'Open Brief queue' };
  if (pageContext === 'settings') return { href: '/settings', label: 'Open settings' };
  if (pageContext === 'current-sprint') return { href: '/current-sprint#stories-card', label: 'Focus sprint work' };
  if (pageContext === 'leadership') return { href: '/governance#decision-snapshot', label: 'Open Brief snapshot' };
  return { href: '/report', label: 'Open proof view' };
}

function mountNotificationDockElement(summary, pageContext = 'report') {
  const tt = getTimeTrackingTotal(summary);
  const rt = getRuntimeAlertCount(summary);
  const eff = effectiveNotificationTotal(summary);
  let dock = document.getElementById(DEFAULT_DOCK_ID);
  if (dock) dock.remove();

  dock = document.createElement('aside');
  dock.id = DEFAULT_DOCK_ID;
  dock.className = 'app-notification-dock';
  dock.setAttribute('aria-label', 'Notifications');
  const parts = [];
  if (tt > 0) parts.push(`Sprint logging: ${tt}`);
  if (rt > 0) parts.push(`Console/runtime: ${rt}`);
  const meta = [summary?.boardName, summary?.sprintName].filter(Boolean).join(' · ');
  dock.innerHTML = ''
    + '<div class="app-notification-title">'
    + `<span>Alerts (${eff})</span>`
    + '<div class="app-notification-actions">'
    + '<button type="button" class="btn-ghost" data-notification-collapse aria-label="Collapse">−</button>'
    + '<button type="button" class="btn-ghost" data-notification-dismiss aria-label="Dismiss">×</button>'
    + '</div></div>'
    + `<div class="app-notification-body">${parts.join(' · ') || 'No alert detail'}</div>`
    + (meta ? `<div class="app-notification-sub">${meta}</div>` : '')
    + `<a class="app-notification-link" href="${notificationFocusLink(pageContext).href}">${notificationFocusLink(pageContext).label}</a>`;

  dock.querySelector('[data-notification-collapse]')?.addEventListener('click', () => {
    dock.classList.toggle('is-collapsed');
    const state = readNotificationDockState();
    writeNotificationDockState({ ...state, collapsed: dock.classList.contains('is-collapsed'), hidden: false });
    if (dock.classList.contains('is-collapsed')) {
      document.body.classList.remove('notification-dock-open');
    } else {
      document.body.classList.add('notification-dock-open');
    }
  });
  dock.querySelector('[data-notification-dismiss]')?.addEventListener('click', () => {
    const state = readNotificationDockState();
    writeNotificationDockState({ ...state, hidden: true }, DEFAULT_NOTIFICATION_DOCK_STATE_KEY);
    dock.remove();
    document.body.classList.remove('notification-dock-visible', 'notification-dock-open');
  });

  const slot = document.getElementById(NOTIFICATION_SLOT_ID);
  (slot || document.body).appendChild(dock);
  document.body.classList.add('notification-dock-visible');
  if (pageContext === 'governance' && !dock.classList.contains('is-collapsed')) {
    document.body.classList.add('notification-dock-open');
  }
  updateSidebarAlertFooter(summary || { total: 0 }, pageContext);
  window.dispatchEvent(new CustomEvent('app:notification-summary-updated'));
  return dock;
}

/** Open dock in-place (top chrome bell) without page navigation. */
export function openNotificationDockFromStore(options = {}) {
  const summary = options.summary || readNotificationSummary(options.storageKey);
  const eff = effectiveNotificationTotal(summary);
  const pageContext = options.pageContext || pageContextFromPath();
  const stateKey = options.stateKey || DEFAULT_NOTIFICATION_DOCK_STATE_KEY;
  const state = readNotificationDockState(stateKey);
  writeNotificationDockState({ ...state, hidden: false, collapsed: false }, stateKey);
  if (eff <= 0) {
    const dock = mountNotificationDockElement({ total: 0, runtimeAlerts: [] }, pageContext);
    if (pageContext === 'governance') document.body.classList.add('notification-dock-open');
    return dock;
  }
  const dock = mountNotificationDockElement(summary, pageContext);
  if (pageContext === 'governance') document.body.classList.add('notification-dock-open');
  return dock;
}

function renderToggleButton({ toggleId, stateKey, onShow, summary } = {}) {
  if (document.getElementById('app-top-chrome')) return;
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
      else openNotificationDockFromStore({ summary, stateKey });
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
  // Hide the logging alerts chip when healthy — developer telemetry noise for end users.
  if (healthy) {
    el.innerHTML = '';
    return;
  }
  const parts = [];
  if (tt > 0) parts.push(`Sprint: ${tt}`);
  if (rt > 0) parts.push(`Console/runtime: ${rt}`);
  const label = `Alerts — ${parts.join(' · ')}${trustLabel ? ` | ${trustLabel}` : ''}`;
  el.innerHTML = `<button type="button" class="sidebar-alert-footer-chip${healthy ? ' is-healthy' : ''}" data-sidebar-alert-jump="true" title="Open notifications">`
    + `${label}</button>`;
  const btn = el.querySelector('[data-sidebar-alert-jump]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    try {
      if (document.getElementById('app-top-chrome')) {
        openNotificationDockFromStore({ summary, pageContext });
        return;
      }
      if (pageContext === 'governance') {
        document.querySelector('[data-queue-open], [data-gov-inbox-open]')?.click?.()
          || document.getElementById('gov-right-rail-mount')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (pageContext === 'current-sprint') {
        const target = document.getElementById('stories-card') || document.getElementById('stuck-card');
        if (typeof window.currentSprintScrollToTarget === 'function') window.currentSprintScrollToTarget(target);
        else target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      } else {
        window.location.href = notificationFocusLink(pageContext).href;
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
    pageContext = pageContextFromPath(),
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
  if (state.hidden) {
    document.body.classList.remove('notification-dock-visible');
  }

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

  if (document.getElementById('app-top-chrome')) {
    window.dispatchEvent(new CustomEvent('app:notification-summary-updated'));
    return;
  }

  if (eff <= 0) return;
  if (!state.hidden) {
    mountNotificationDockElement(resolvedSummary, pageContext);
    if (state.collapsed) {
      document.getElementById(dockId)?.classList.add('is-collapsed');
    }
    return;
  }
  renderToggleButton({ toggleId, stateKey, summary: resolvedSummary });
}

/**
 * Re-render dock from localStorage after runtime alerts or external updates.
 */
export function refreshNotificationDockFromStore() {
  if (typeof window === 'undefined' || !window.location) return;
  const path = window.location.pathname || '';
  if (path.includes('/login') || path.endsWith('login')) return;
  const pageContext = pageContextFromPath();
  const collapsedByDefault = pageContext !== 'current-sprint';
  renderNotificationDock({ pageContext, collapsedByDefault });
}

export const NOTIFICATION_STORE_KEY = DEFAULT_NOTIFICATION_STORE_KEY;
export const NOTIFICATION_DOCK_STATE_KEY = DEFAULT_NOTIFICATION_DOCK_STATE_KEY;
export const NOTIFICATION_TOGGLE_ID = DEFAULT_TOGGLE_ID;
