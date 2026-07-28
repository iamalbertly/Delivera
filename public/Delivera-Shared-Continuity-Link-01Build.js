/**
 * Shared continuity URL + identity-link builders.
 * Keeps spotlight / squad / returnTo tokens consistent across Governance, Sprint, Actions, Dashboard.
 */

export function normalizeSquadKey(value) {
  return String(value || '').trim().toUpperCase();
}

export function readContinuityTokens(url = typeof location !== 'undefined' ? location.href : '') {
  try {
    const parsed = new URL(url, typeof location !== 'undefined' ? location.origin : 'http://localhost');
    return {
      spotlight: normalizeSquadKey(parsed.searchParams.get('spotlight') || parsed.searchParams.get('squad')),
      squad: normalizeSquadKey(parsed.searchParams.get('squad') || parsed.searchParams.get('spotlight')),
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
  const spotlight = normalizeSquadKey(squadKey);
  if (!spotlight) return '/governance';
  return withParams('/governance', {
    spotlight,
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
  return withParams('/report', { squad });
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
    if (target.pathname === '/current-sprint' && squadKey) target.searchParams.set('squad', squadKey);
    if (target.pathname === '/governance' && squadKey) {
      target.searchParams.set('spotlight', squadKey);
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

export function renderShellSummaryChips(chips = []) {
  return chips
    .filter(Boolean)
    .map((chip) => `<span class="report-filter-strip-chip">${escapeText(chip)}</span>`)
    .join('');
}
