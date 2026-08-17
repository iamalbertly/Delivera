/**
 * FocusStrip SSOT — one squad pill + one next-surface link inside sub-chrome.
 * Does not add a second fixed bar; top chrome already owns Answer / Today / Proof.
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';
import {
  currentSprintSquadHref,
  governanceSpotlightHref,
  persistLastFocusSquad,
  resolveFocusSquadKey,
} from './Delivera-Shared-Continuity-Link-01Build.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import { ensureSubChromeSlot, SUB_CHROME_SLOT_ID } from './Delivera-Shared-Top-Chrome-01Render-UI.js';

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

function kanbanChip() {
  const warn = document.querySelector('[data-registry-board-warn="1"]');
  if (!warn) return '';
  return `<span class="focus-strip-kanban" data-focus-kanban="1">${escapeHtml(COPY.kanbanSprintUnavailable || 'Non-scrum board — sprint view unavailable')}</span>`;
}

function nextSurfaceLink(kind, squad) {
  if (!squad) {
    return `<a href="/governance" class="focus-strip-link" data-focus-next="governance">Governance</a>`;
  }
  if (kind === 'sprint') {
    return `<a href="${escapeHtml(governanceSpotlightHref(squad))}" class="focus-strip-link" data-focus-next="governance">${escapeHtml(squad)} evidence</a>`;
  }
  if (kind === 'actions') {
    return `<a href="${escapeHtml(currentSprintSquadHref(squad))}" class="focus-strip-link" data-focus-next="sprint">${escapeHtml(squad)} today</a>`;
  }
  return `<a href="${escapeHtml(governanceSpotlightHref(squad))}" class="focus-strip-link" data-focus-next="governance">${escapeHtml(squad)} evidence</a>`;
}

function renderStripInner(squadKey, { freshnessCopy = '' } = {}) {
  const kind = pageKind();
  const squad = String(squadKey || '').trim().toUpperCase();
  if (squad) persistLastFocusSquad(squad);
  const pill = squad
    ? `<span class="focus-strip-squad-pill" data-focus-squad="${escapeHtml(squad)}">${escapeHtml(squad)}</span>`
    : '<span class="focus-strip-squad-pill focus-strip-squad-pill--portfolio">Portfolio</span>';
  const prepared = preparedSprintChip();
  const fresh = prepared || freshnessChip(freshnessCopy);
  const kanban = kind === 'settings' || kind === 'sprint' ? kanbanChip() : '';
  return `<div class="focus-strip-inner" data-focus-strip="1">
    ${pill}
    <nav class="focus-strip-nav" aria-label="Focus strip">${nextSurfaceLink(kind, squad)}</nav>
    ${kanban}
    ${fresh}
  </div>`;
}

export function mountFocusStrip({ squadKey = '', freshnessCopy = '' } = {}) {
  const mount = document.getElementById(FOCUS_STRIP_MOUNT_ID);
  if (!mount) return;
  const squad = String(squadKey || resolveFocusSquadKey() || '').trim().toUpperCase();
  mount.innerHTML = renderStripInner(squad, { freshnessCopy });
  mount.hidden = false;
  document.body.classList.add('has-focus-strip', 'has-sub-chrome');
}

export function ensureFocusStripMount() {
  let mount = document.getElementById(FOCUS_STRIP_MOUNT_ID);
  if (mount) return mount;
  mount = document.createElement('div');
  mount.id = FOCUS_STRIP_MOUNT_ID;
  mount.className = 'app-focus-strip-mount';
  mount.setAttribute('aria-label', 'Focus strip');
  const slot = ensureSubChromeSlot() || document.getElementById(SUB_CHROME_SLOT_ID);
  if (slot) {
    const agent = slot.querySelector('#gov-global-agent-bar');
    if (agent) slot.insertBefore(mount, agent);
    else slot.prepend(mount);
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
