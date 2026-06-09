/**
 * Advanced scope drawer for Governance Brief — extra projects and governance rules note.
 */
import { PROJECTS_SSOT_KEY } from './Delivera-Shared-Storage-Keys.js';
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';

/**
 * @param {object} opts
 * @param {() => void} opts.onClose
 * @param {() => void} opts.onApply
 */
export function openGovernanceScopeDrawer({ onClose, onApply } = {}) {
  let drawer = document.getElementById('gov-scope-drawer');
  if (!drawer) {
    drawer = document.createElement('aside');
    drawer.id = 'gov-scope-drawer';
    drawer.className = 'gov-scope-drawer';
    drawer.hidden = true;
    document.body.appendChild(drawer);
  }
  const raw = localStorage.getItem(PROJECTS_SSOT_KEY) || 'MPSA,MAS';
  drawer.innerHTML = `
    <div class="gov-scope-drawer-panel" role="dialog" aria-label="Scope settings">
      <header class="gov-scope-drawer-head">
        <h2>Scope settings</h2>
        <button type="button" class="btn btn-link btn-compact" id="gov-drawer-close">Close</button>
      </header>
      <label class="gov-scope-drawer-field">Projects (comma-separated)
        <input type="text" id="gov-drawer-projects" class="gov-scope-input" value="${escapeHtml(raw)}" />
      </label>
      <p class="gov-scope-drawer-note">Governance rules use Vodacom delivery grammar (stale-in-progress, late scope, data confidence). Strict changelog sprint membership is deferred.</p>
      <div class="gov-scope-drawer-actions">
        <button type="button" class="btn btn-primary btn-compact" id="gov-drawer-apply">Apply</button>
        <button type="button" class="btn btn-secondary btn-compact" id="gov-drawer-reset">Reset to MPSA, MAS</button>
      </div>
    </div>
    <button type="button" class="gov-scope-drawer-backdrop" id="gov-drawer-backdrop" aria-label="Close scope settings"></button>`;
  drawer.hidden = false;
  const close = () => { drawer.hidden = true; onClose?.(); };
  drawer.querySelector('#gov-drawer-close')?.addEventListener('click', close);
  drawer.querySelector('#gov-drawer-backdrop')?.addEventListener('click', close);
  drawer.querySelector('#gov-drawer-apply')?.addEventListener('click', () => {
    const val = drawer.querySelector('#gov-drawer-projects')?.value || '';
    try { localStorage.setItem(PROJECTS_SSOT_KEY, val); } catch (_) { /* ignore */ }
    close();
    onApply?.();
  });
  drawer.querySelector('#gov-drawer-reset')?.addEventListener('click', () => {
    const input = drawer.querySelector('#gov-drawer-projects');
    if (input) input.value = 'MPSA,MAS';
  });
}
