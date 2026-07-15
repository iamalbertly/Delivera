/**
 * Page route resolution SSOT — pathname/hash → page key (nav + top chrome).
 */
export const PAGE_DASHBOARD = 'dashboard';
export const PAGE_PI = 'program-increment';
export const PAGE_REPORT = 'report';
export const PAGE_EVIDENCE = 'evidence';
export const PAGE_SPRINTS = 'sprints';
export const PAGE_VALUE = 'value-delivery';
export const PAGE_RISKS = 'risks-blockers';
export const PAGE_LEADERSHIP = 'leadership';
export const PAGE_ACTIONS = 'actions';
export const PAGE_GOVERNANCE = 'governance';
export const PAGE_TEAMS = 'teams';
export const PAGE_SETTINGS = 'settings';
export const PAGE_LOGIN = 'login';

export const LEADERSHIP_HASH = '#trends';

/** Portfolio command surface primaries (top chrome switcher). */
export const PRIMARY_NAV_KEYS = [PAGE_GOVERNANCE, PAGE_ACTIONS];

export const SURFACE_SWITCHER = [
  { key: PAGE_GOVERNANCE, label: 'Governance', href: '/governance' },
  { key: PAGE_ACTIONS, label: 'Actions', href: '/actions' },
];

/**
 * Hidden surfaces — not ready for production use. Kept in codebase for
 * future activation but removed from nav. (Audit 2026-07-15: Squads and
 * Settings pages are not production-ready; Notifications and Help icons
 * are non-functional.)
 */
export const HIDDEN_SURFACES = [PAGE_SPRINTS, PAGE_SETTINGS];

/** Short descriptions for settings quick-nav cards (keyed by page). */
export const SURFACE_QUICK_DESC = {
  [PAGE_GOVERNANCE]: 'AI signal & decisions',
  [PAGE_SPRINTS]: 'Blockers & nudges today',
  [PAGE_ACTIONS]: 'Ready nudges & proof',
  [PAGE_REPORT]: 'Evidence drill-down',
  [PAGE_SETTINGS]: 'Defaults & integrations',
};

/**
 * Quick links for settings hub and cross-surface jumps.
 * @param {string[]} [extraKeys] — e.g. PAGE_REPORT for Proof card
 */
export function getSurfaceQuickLinks(extraKeys = []) {
  const keys = [...PRIMARY_NAV_KEYS, ...extraKeys];
  const byKey = Object.fromEntries(SURFACE_SWITCHER.map((s) => [s.key, s]));
  if (extraKeys.includes(PAGE_REPORT)) {
    byKey[PAGE_REPORT] = { key: PAGE_REPORT, label: 'Proof', href: '/report' };
  }
  return keys.map((key) => {
    const item = byKey[key];
    if (!item) return null;
    return {
      href: item.href,
      label: item.label,
      desc: SURFACE_QUICK_DESC[key] || '',
    };
  }).filter(Boolean);
}

export function getPathState(pathname, hash) {
  const path = pathname != null
    ? pathname
    : (typeof window !== 'undefined' && window.location ? window.location.pathname || '' : '');
  const h = hash != null
    ? hash
    : (typeof window !== 'undefined' && window.location ? window.location.hash || '' : '');
  return { path, hash: h };
}

/**
 * Resolve canonical page key from path (and optional hash).
 * @param {string} [pathname]
 * @param {string} [hash]
 */
export function getCurrentPage(pathname, hash) {
  const { path, hash: h } = getPathState(pathname, hash);
  if (path === '/login' || path.endsWith('/login')) return PAGE_LOGIN;
  if (path === '/dashboard' || path.endsWith('/dashboard') || path === '/home' || path.endsWith('/home')) return PAGE_DASHBOARD;
  if (path === '/program-increment' || path.endsWith('/program-increment') || path === '/roadmap' || path.endsWith('/roadmap')) return PAGE_PI;
  if ((path === '/report' || path.endsWith('/report')) && h === LEADERSHIP_HASH) return PAGE_REPORT;
  if (path === '/report' || path.endsWith('/report')) return PAGE_REPORT;
  if (path === '/evidence' || path.endsWith('/evidence') || path === '/impact' || path.endsWith('/impact') || path === '/actions' || path.endsWith('/actions')) return PAGE_ACTIONS;
  if (path === '/current-sprint' || path.endsWith('/current-sprint') || path === '/sprints' || path.endsWith('/sprints')) return PAGE_SPRINTS;
  if (path === '/value-delivery' || path.endsWith('/value-delivery') || path === '/backlog-intake' || path.endsWith('/backlog-intake')) return PAGE_VALUE;
  if (path === '/risks-blockers' || path.endsWith('/risks-blockers')) return PAGE_RISKS;
  if (path === '/leadership' || path.endsWith('/leadership') || path === '/sprint-leadership' || path.endsWith('/sprint-leadership')) return PAGE_GOVERNANCE;
  if (path === '/governance' || path.endsWith('/governance') || path === '/brief' || path.endsWith('/brief') || path === '/portfolio' || path.endsWith('/portfolio')) return PAGE_GOVERNANCE;
  if (path === '/teams' || path.endsWith('/teams')) return PAGE_TEAMS;
  if (path === '/settings' || path.endsWith('/settings')) return PAGE_SETTINGS;
  return PAGE_REPORT;
}

/** Map any page to a primary surface switcher key (Proof bookmarks → Actions). */
export function getChromeSurfacePage(pathname, hash) {
  const page = getCurrentPage(pathname, hash);
  if (page === PAGE_GOVERNANCE || page === PAGE_LEADERSHIP || page === PAGE_PI || page === PAGE_DASHBOARD) return PAGE_GOVERNANCE;
  if (page === PAGE_SPRINTS || page === PAGE_RISKS || page === PAGE_TEAMS) return PAGE_SPRINTS;
  if (page === PAGE_ACTIONS || page === PAGE_REPORT || page === PAGE_EVIDENCE || page === PAGE_VALUE) return PAGE_ACTIONS;
  if (page === PAGE_SETTINGS) return PAGE_SETTINGS;
  if (page === PAGE_LOGIN) return PAGE_LOGIN;
  return PAGE_GOVERNANCE;
}

/** @deprecated Use getChromeSurfacePage — kept for top-chrome call sites during migration. */
export function getCurrentPageForChrome(pathname, hash) {
  return getChromeSurfacePage(pathname, hash);
}
