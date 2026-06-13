/**
 * SSOT: right-side drawer host (inbox, evidence, scope sheet, etc.).
 */
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

let host = null;
let drawerCloseFn = null;
let escapeBound = false;

function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.id = 'delivera-gov-right-drawer';
  host.className = 'gov-right-drawer-host';
  host.hidden = true;
  document.body.appendChild(host);
  return host;
}

function bindEscapeOnce() {
  if (escapeBound) return;
  escapeBound = true;
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (host && !host.hidden) {
      ev.preventDefault();
      closeRightDrawer();
      return;
    }
    const nudge = document.getElementById('delivera-jira-nudge-review-sheet');
    if (nudge && !nudge.hidden) {
      ev.preventDefault();
      nudge.hidden = true;
      nudge.innerHTML = '';
      document.body.classList.remove('jira-nudge-review-open');
      return;
    }
    closeWddModalIfOpen();
  });
}

export function closeWddModalIfOpen() {
  const wdd = document.querySelector('.work-draft-drawer:not([hidden]), dialog[data-outcome-modal]:not([hidden])');
  if (wdd) {
    wdd.querySelector('[data-close-outcome], [data-wdd-close], button[aria-label="Close"]')?.click?.();
  }
}

export function closeAllGovernanceOverlays() {
  closeRightDrawer();
  const nudge = document.getElementById('delivera-jira-nudge-review-sheet');
  if (nudge && !nudge.hidden) {
    nudge.hidden = true;
    nudge.innerHTML = '';
    document.body.classList.remove('jira-nudge-review-open');
  }
  closeWddModalIfOpen();
}

export function openRightDrawer({ title = 'Details', bodyHtml = '', onClose, panelClass = '', lockScroll = true } = {}) {
  closeAllGovernanceOverlays();
  bindEscapeOnce();
  const el = ensureHost();
  const panelCls = panelClass ? ` gov-right-drawer-panel--${panelClass}` : '';
  el.innerHTML = `
    <div class="gov-right-drawer-backdrop" data-drawer-close tabindex="-1"></div>
    <aside class="gov-right-drawer-panel${panelCls}" role="dialog" aria-labelledby="gov-right-drawer-title">
      <header class="gov-right-drawer-head">
        <h2 id="gov-right-drawer-title" class="gov-right-drawer-title">${escapeHtml(title)}</h2>
        <button type="button" class="btn btn-link btn-compact" data-drawer-close aria-label="Close">Close</button>
      </header>
      <div class="gov-right-drawer-body">${bodyHtml}</div>
    </aside>`;
  el.hidden = false;
  if (lockScroll) document.body.classList.add('gov-right-drawer-open');
  const close = () => {
    el.hidden = true;
    document.body.classList.remove('gov-right-drawer-open');
    drawerCloseFn = null;
    onClose?.();
  };
  drawerCloseFn = close;
  el.querySelectorAll('[data-drawer-close]').forEach((n) => n.addEventListener('click', close));
  return { close, el };
}

export function closeRightDrawer() {
  if (drawerCloseFn) {
    drawerCloseFn();
    return;
  }
  if (!host) return;
  host.hidden = true;
  document.body.classList.remove('gov-right-drawer-open');
}
