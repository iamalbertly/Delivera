/**
 * SSOT: right-side drawer host (inbox, evidence, etc.).
 */
import { escapeHtml } from './Delivera-App-Governance-Brief-Page-02Render-Decisions-UI.js';

let host = null;

function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.id = 'delivera-gov-right-drawer';
  host.className = 'gov-right-drawer-host';
  host.hidden = true;
  document.body.appendChild(host);
  return host;
}

export function openRightDrawer({ title = 'Details', bodyHtml = '', onClose } = {}) {
  const el = ensureHost();
  el.innerHTML = `
    <div class="gov-right-drawer-backdrop" data-drawer-close tabindex="-1"></div>
    <aside class="gov-right-drawer-panel" role="dialog" aria-labelledby="gov-right-drawer-title">
      <header class="gov-right-drawer-head">
        <h2 id="gov-right-drawer-title" class="gov-right-drawer-title">${escapeHtml(title)}</h2>
        <button type="button" class="btn btn-link btn-compact" data-drawer-close aria-label="Close">Close</button>
      </header>
      <div class="gov-right-drawer-body">${bodyHtml}</div>
    </aside>`;
  el.hidden = false;
  document.body.classList.add('gov-right-drawer-open');
  const close = () => {
    el.hidden = true;
    document.body.classList.remove('gov-right-drawer-open');
    onClose?.();
  };
  el.querySelectorAll('[data-drawer-close]').forEach((n) => n.addEventListener('click', close));
  return { close, el };
}

export function closeRightDrawer() {
  if (!host) return;
  host.hidden = true;
  document.body.classList.remove('gov-right-drawer-open');
}
