/**
 * Shared continuity URL + identity-link builders.
 * Keeps spotlight / squad / returnTo tokens consistent across Governance, Sprint, Actions, Dashboard.
 */

const LAST_FOCUS_SQUAD_KEY = 'delivera:continuity:last-focus-squad:v1';

export function normalizeSquadKey(value) {
  return String(value || '').trim().toUpperCase();
}

export function persistLastFocusSquad(squadKey) {
  const key = normalizeSquadKey(squadKey);
  if (!key || typeof sessionStorage === 'undefined') return;
  try { sessionStorage.setItem(LAST_FOCUS_SQUAD_KEY, key); } catch (_) { /* privacy / quota */ }
}

export function readLastFocusSquad() {
  try {
    return normalizeSquadKey(typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(LAST_FOCUS_SQUAD_KEY) : '');
  } catch (_) {
    return '';
  }
}

/** URL tokens first; fall back to last focus so chrome Sprint/Evidence never drop squad mid-tunnel. */
export function resolveFocusSquadKey(url = typeof location !== 'undefined' ? location.href : '') {
  const tokens = readContinuityTokens(url);
  const fromUrl = normalizeSquadKey(tokens.squad || tokens.spotlight);
  if (fromUrl) {
    persistLastFocusSquad(fromUrl);
    return fromUrl;
  }
  return readLastFocusSquad();
}

export function readContinuityTokens(url = typeof location !== 'undefined' ? location.href : '') {
  try {
    const parsed = new URL(url, typeof location !== 'undefined' ? location.origin : 'http://localhost');
    const spotlightRaw = parsed.searchParams.get('spotlight');
    const squadRaw = parsed.searchParams.get('squad');

    // Canonical write is `squad`. `spotlight` remains a read alias for older deep links.
    const squad = normalizeSquadKey(squadRaw || spotlightRaw);
    const spotlight = squad;
    if (squad) persistLastFocusSquad(squad);
    return {
      spotlight,
      squad,
      sprintId: String(parsed.searchParams.get('sprintId') || '').trim(),
      view: String(parsed.searchParams.get('view') || '').trim(),
      returnTo: String(parsed.searchParams.get('returnTo') || '').trim(),
      evidenceScope: String(parsed.searchParams.get('evidenceScope') || '').trim(),
    };
  } catch (_) {
    return { spotlight: '', squad: '', sprintId: '', view: '', returnTo: '', evidenceScope: '' };
  }
}

function withParams(pathname, params = {}) {
  const target = new URL(pathname, typeof location !== 'undefined' ? location.origin : 'http://localhost');
  Object.entries(params).forEach(([key, value]) => {
    const next = value == null ? '' : String(value).trim();
    if (next) target.searchParams.set(key, next);
  });
  return `${target.pathname}${target.search}${target.hash}`;
}

export function governanceSpotlightHref(squadKey, { returnTo = '', view = 'squad' } = {}) {
  const squad = normalizeSquadKey(squadKey);
  if (!squad) return '/governance';
  // Write canonical `squad` only; readers still accept legacy `spotlight`.
  return withParams('/governance', {
    squad,
    projects: squad,
    view: view || 'squad',
    returnTo: returnTo || undefined,
  });
}

export function currentSprintSquadHref(squadKey, { sprintId = '', boardId = '' } = {}) {
  const squad = normalizeSquadKey(squadKey);
  if (!squad) return '/current-sprint';
  // projects= must match squad so Current Sprint cannot load another squad's board set first.
  return withParams('/current-sprint', {
    squad,
    projects: squad,
    sprintId: sprintId || undefined,
    boardId: boardId ? String(boardId) : undefined,
  });
}

export function actionsSquadHref(squadKey, { source = '' } = {}) {
  const squad = normalizeSquadKey(squadKey);
  return withParams('/actions', {
    squad: squad || undefined,
    source: source || undefined,
  });
}

export function reportSquadHref(squadKey) {
  const squad = normalizeSquadKey(squadKey);
  if (!squad) return '/report';
  // projects= must match squad so Report cannot hydrate another squad's inventory first.
  return withParams('/report', {
    squad,
    projects: squad,
  });
}

/** Continuity deep-link for a single Jira issue (Evidence / Report surface). */
export function reportIssueHref(issueKey, { squad = '' } = {}) {
  const key = String(issueKey || '').trim().toUpperCase();
  if (!key) return '/report';
  const squadKey = normalizeSquadKey(squad);
  return withParams('/report', {
    issueKey: key,
    squad: squadKey || undefined,
    projects: squadKey || undefined,
  });
}

export function resolveReturnToHref(returnTo, { squad = '' } = {}) {
  const raw = String(returnTo || '').trim();
  if (!raw) return '';
  try {
    const target = new URL(raw, typeof location !== 'undefined' ? location.origin : 'http://localhost');
    if (target.origin !== (typeof location !== 'undefined' ? location.origin : target.origin)) return '';
    if (!['/actions', '/current-sprint', '/report', '/dashboard', '/home', '/governance'].includes(target.pathname)) {
      return '';
    }
    const squadKey = normalizeSquadKey(squad || target.searchParams.get('squad') || target.searchParams.get('spotlight'));
    if (target.pathname === '/actions' && squadKey) target.searchParams.set('squad', squadKey);
    if (target.pathname === '/current-sprint' && squadKey) {
      target.searchParams.set('squad', squadKey);
      target.searchParams.set('projects', squadKey);
    }
    if (target.pathname === '/report' && squadKey) {
      target.searchParams.set('squad', squadKey);
      target.searchParams.set('projects', squadKey);
    }
    if (target.pathname === '/governance' && squadKey) {
      // Canonical write is `squad` only; drop legacy spotlight dual-write.
      target.searchParams.delete('spotlight');
      target.searchParams.set('squad', squadKey);
      target.searchParams.set('projects', squadKey);
      target.searchParams.set('view', 'squad');
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch (_) {
    return '';
  }
}

export function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Structured identity-link row used by Governance hero and Dashboard.
 * items: [{ key, label, secondaryLabel?, mode: 'button'|'link', href?, focusAttr? }]
 */
export function renderIdentityLinkRow(items, { ariaLabel = 'Headline focus links' } = {}) {
  const list = (items || []).filter((item) => item?.key && item?.label).slice(0, 6);
  if (!list.length) return '';
  return `<div class="gov-loop-identity-links" aria-label="${escapeAttr(ariaLabel)}">
    ${list.map((item) => {
      if (item.mode === 'button') {
        return `<button type="button" class="gov-loop-identity-link" data-hero-focus-squad="${escapeAttr(item.key)}">${escapeText(item.label)}</button>`;
      }
      const href = item.href || governanceSpotlightHref(item.key);
      const cls = item.secondary ? 'gov-loop-identity-link gov-loop-identity-link-secondary' : 'gov-loop-identity-link';
      return `<a class="${cls}" href="${escapeAttr(href)}">${escapeText(item.secondaryLabel || item.label)}</a>`;
    }).join('')}
  </div>`;
}

/**
 * Renders the shared 2-link-per-squad identity strip (Governance evidence + Sprint cockpit).
 * De-duplicates the dashboard and actions page continuity strip rendering.
 *
 * @param {string|string[]} squadKeys
 * @param {Object} opts
 * @param {string} [opts.ariaLabel]
 * @param {number} [opts.maxSquads]
 * @param {(squadKey: string) => string} [opts.labelForSquad]
 * @param {(squadKey: string) => string} [opts.primaryLabelForSquad]
 * @param {(squadKey: string) => string} [opts.secondaryLabelForSquad]
 * @param {string} [opts.primaryReturnTo]
 * @returns {string} HTML
 */
export function renderSquadIdentityStrip(squadKeys, {
  ariaLabel = 'Squad identity links',
  maxSquads = 3,
  labelForSquad = (k) => normalizeSquadKey(k),
  primaryLabelForSquad,
  secondaryLabelForSquad = () => 'Sprint',
  primaryReturnTo = '',
} = {}) {
  const list = Array.isArray(squadKeys) ? squadKeys : (squadKeys ? [squadKeys] : []);
  const keys = list.map(normalizeSquadKey).filter(Boolean).slice(0, maxSquads);
  if (!keys.length) return '';

  const primaryLabelFn = primaryLabelForSquad || ((k) => labelForSquad(k));
  const items = [];

  keys.forEach((squadKey) => {
    items.push({
      key: squadKey,
      label: primaryLabelFn(squadKey),
      mode: 'link',
      href: governanceSpotlightHref(squadKey, { returnTo: primaryReturnTo }),
    });
    items.push({
      key: squadKey,
      label: 'Sprint',
      secondaryLabel: secondaryLabelForSquad(squadKey),
      mode: 'link',
      secondary: true,
      href: currentSprintSquadHref(squadKey),
    });
  });

  return renderIdentityLinkRow(items, { ariaLabel });
}

export function renderShellSummaryChips(chips = []) {
  return chips
    .filter(Boolean)
    .map((chip) => `<span class="report-filter-strip-chip">${escapeText(chip)}</span>`)
    .join('');
}

/** SSOT: rewrite URL continuity params without inventing a second history helper. */
export function rewriteContinuityUrl({ squad, boardId, sprintId, projects, spotlight, view } = {}) {
  try {
    const url = new URL(typeof location !== 'undefined' ? location.href : 'http://localhost');
    if (squad) {
      const key = normalizeSquadKey(squad);
      url.searchParams.set('squad', key);
      persistLastFocusSquad(key);
    }
    if (spotlight) {
      const key = normalizeSquadKey(spotlight);
      url.searchParams.set('spotlight', key);
      persistLastFocusSquad(key);
    }
    if (projects) url.searchParams.set('projects', String(projects).trim());
    if (boardId) url.searchParams.set('boardId', String(boardId));
    if (view) url.searchParams.set('view', String(view));
    if (sprintId) url.searchParams.set('sprintId', String(sprintId));
    else url.searchParams.delete('sprintId');
    if (typeof history !== 'undefined') history.replaceState({}, '', url.toString());
    return url.toString();
  } catch (_) {
    return '';
  }
}
