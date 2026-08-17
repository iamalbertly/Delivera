/**
 * FocusStrip SSOT — squad pill, continuity links, freshness chip on sprint/actions/settings.
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import {
  actionsSquadHref,
  currentSprintSquadHref,
  governanceSpotlightHref,
  renderSquadIdentityStrip,
  resolveFocusSquadKey,
} from './Delivera-Shared-Continuity-Link-01Build.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

export const FOCUS_STRIP_MOUNT_ID = 'app-focus-strip-mount';

function pageKind() {
  if (document.body?.classList?.contains('current-sprint-page')) return 'sprint';
  if (document.body?.classList?.contains('actions-page')) return 'actions';
  if (document.body?.classList?.contains('settings-page')) return 'settings';
  return '';
}

function freshnessChip(copy = '') {
  const text = String(copy || '').trim();
  if (!text) return '';
  return `<span class="focus-strip-freshness" data-focus-freshness="1">${escapeHtml(text)}</span>`;
}

function preparedSprintChip() {
  const el = document.querySelector('[data-prepared-sprint-truth="1"], .prepared-sprint-truth-banner');
  if (!el || el.hidden) return '';
  return freshnessChip(COPY.preparedSprintTruth || 'Showing last verified · refreshing quietly');
}

function renderStripInner(squadKey, { freshnessCopy = '' } = {}) {
  const kind = pageKind();
  const squad = String(squadKey || '').trim().toUpperCase();
  const links = squad
    ? renderSquadIdentityStrip(squad, {
      ariaLabel: 'Focus strip continuity',
      primaryReturnTo: kind === 'actions' ? '/actions' : (kind === 'sprint' ? '/current-sprint' : '/settings'),
      primaryLabelForSquad: (k) => `${k} evidence`,
      secondaryLabelForSquad: (k) => `${k} today`,
    })
    : '';
  const actionsHref = squad ? actionsSquadHref(squad) : '/actions';
  const sprintHref = squad ? currentSprintSquadHref(squad) : '/current-sprint';
  const govHref = squad ? governanceSpotlightHref(squad) : '/governance';
  const pill = squad
    ? `<span class="focus-strip-squad-pill" data-focus-squad="${escapeHtml(squad)}">${escapeHtml(squad)}</span>`
    : '<span class="focus-strip-squad-pill focus-strip-squad-pill--portfolio">Portfolio</span>';
  const nav = `<nav class="focus-strip-nav" aria-label="Focus strip">
    <a href="${escapeHtml(govHref)}" class="focus-strip-link">Governance</a>
    <a href="${escapeHtml(sprintHref)}" class="focus-strip-link">Sprint</a>
    <a href="${escapeHtml(actionsHref)}" class="focus-strip-link">Actions</a>
  </nav>`;
  const prepared = preparedSprintChip();
  const fresh = prepared || freshnessChip(freshnessCopy);
  return `<div class="focus-strip-inner" data-focus-strip="1">
    ${pill}
    ${links || nav}
    ${fresh}
  </div>`;
}

export function mountFocusStrip({ squadKey = '', freshnessCopy = '' } = {}) {
  const mount = document.getElementById(FOCUS_STRIP_MOUNT_ID);
  if (!mount) return;
  const squad = String(squadKey || resolveFocusSquadKey() || '').trim().toUpperCase();
  mount.innerHTML = renderStripInner(squad, { freshnessCopy });
  mount.hidden = false;
  document.body.classList.add('has-focus-strip');
}

export function ensureFocusStripMount() {
  let mount = document.getElementById(FOCUS_STRIP_MOUNT_ID);
  if (mount) return mount;
  mount = document.createElement('div');
  mount.id = FOCUS_STRIP_MOUNT_ID;
  mount.className = 'app-focus-strip-mount';
  mount.setAttribute('aria-label', 'Focus strip');
  const slot = document.getElementById('app-sub-chrome-slot');
  if (slot?.parentNode) {
    slot.parentNode.insertBefore(mount, slot.nextSibling);
  } else {
    document.body.prepend(mount);
  }
  return mount;
}

export function bootstrapFocusStrip() {
  if (document.body?.classList?.contains('login-page')) return;
  if (document.body?.classList?.contains('governance-page')) return;
  ensureFocusStripMount();
  mountFocusStrip();
}

if (typeof window !== 'undefined') {
  window.addEventListener('delivera:focus-strip-refresh', (event) => {
    mountFocusStrip({
      squadKey: event?.detail?.squadKey,
      freshnessCopy: event?.detail?.freshnessCopy,
    });
  });
}
