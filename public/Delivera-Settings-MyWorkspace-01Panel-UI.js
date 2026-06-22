/**
 * Settings — personal workspace prefs (editable).
 */
import { escapeHtml } from './Delivera-Shared-Dom-Escape-Helpers.js';
import {
  PROJECTS_SSOT_KEY,
  SIMPLE_MODE_KEY,
  REPORT_NAMED_VIEWS_KEY,
  CURRENT_SPRINT_LAST_VIEW_KEY,
  readSharedProjectsCsv,
} from './Delivera-Shared-Storage-Keys.js';
import { ensureProjectCatalogLoaded, seedProjectCatalogCache } from './Delivera-Shared-Project-Display-01Resolve-SSOT.js';

function readSimpleMode() {
  try { return localStorage.getItem(SIMPLE_MODE_KEY) === '1'; } catch (_) { return false; }
}

function writeSimpleMode(on) {
  try {
    if (on) localStorage.setItem(SIMPLE_MODE_KEY, '1');
    else localStorage.removeItem(SIMPLE_MODE_KEY);
  } catch (_) { /* ignore */ }
}

function writeProjects(keys) {
  const csv = (keys || []).map((k) => String(k).trim().toUpperCase()).filter(Boolean).join(',');
  try { localStorage.setItem(PROJECTS_SSOT_KEY, csv); } catch (_) { /* ignore */ }
}

function readNamedViewLinks() {
  const links = [];
  try {
    const reportRaw = localStorage.getItem(REPORT_NAMED_VIEWS_KEY);
    if (reportRaw) {
      const views = JSON.parse(reportRaw);
      if (Array.isArray(views) && views[0]?.id) {
        links.push({ label: `Proof: ${views[0].label || views[0].id}`, href: '/report' });
      }
    }
    const sprintView = localStorage.getItem(CURRENT_SPRINT_LAST_VIEW_KEY);
    if (sprintView) links.push({ label: 'Sprint: last view', href: '/current-sprint' });
  } catch (_) { /* ignore */ }
  return links;
}

export function mountMyWorkspacePanel(mount) {
  if (!mount) return;

  async function render() {
    await ensureProjectCatalogLoaded();
    let catalog = [];
    try {
      const res = await fetch('/api/projects-catalog.json', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        seedProjectCatalogCache(data);
        catalog = data.projects || [];
      }
    } catch (_) { /* ignore */ }

    const selected = readSharedProjectsCsv();
    const simpleOn = readSimpleMode();
    const defaultKeys = catalog.filter((p) => p.defaultSelected).map((p) => p.key);
    const checks = catalog.map((entry) => {
      const on = selected.length ? selected.includes(entry.key) : entry.defaultSelected;
      const label = entry.shortLabel || entry.label || entry.key;
      return `<label class="settings-workspace-check">
        <input type="checkbox" class="settings-workspace-project" value="${escapeHtml(entry.key)}"${on ? ' checked' : ''} />
        <span class="settings-workspace-project-label">${escapeHtml(label)}</span>
        <span class="settings-workspace-project-key">${escapeHtml(entry.key)}</span>
      </label>`;
    }).join('');

    const savedLinks = readNamedViewLinks();
    const savedHtml = savedLinks.length
      ? `<ul class="settings-workspace-saved">${savedLinks.map((l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`).join('')}</ul>`
      : '<p class="gov-ai-helper-note">Saved views appear here after you use Proof or Sprint filters.</p>';

    mount.innerHTML = `
      <section id="my-workspace" class="surface-card settings-section-card" tabindex="-1">
        <h2>My workspace</h2>
        <p class="gov-ai-helper-lead">Personal defaults stay in this browser. Organization settings are managed by your administrator.</p>

        <h3 class="gov-ai-helper-sub">Language</h3>
        <label class="settings-workspace-toggle">
          <input type="checkbox" id="settings-simple-mode" ${simpleOn ? 'checked' : ''} />
          <span>Simple mode — plain English across Brief and Sprint</span>
        </label>

        <h3 class="gov-ai-helper-sub">Default project scope</h3>
        <div class="settings-workspace-projects" role="group" aria-label="Default projects">${checks || '<p class="gov-ai-helper-note">Could not load project catalog.</p>'}</div>
        <div class="gov-ai-helper-actions">
          <button type="button" class="btn btn-primary btn-compact" id="settings-save-workspace">Save defaults</button>
          <button type="button" class="btn btn-secondary btn-compact" id="settings-reset-workspace">Reset to org defaults</button>
        </div>
        <p id="settings-workspace-status" class="gov-ai-helper-result" aria-live="polite"></p>

        <h3 class="gov-ai-helper-sub">Saved views</h3>
        ${savedHtml}
      </section>`;

    mount.querySelector('#settings-simple-mode')?.addEventListener('change', (ev) => {
      writeSimpleMode(ev.target.checked);
    });

    mount.querySelector('#settings-save-workspace')?.addEventListener('click', () => {
      const keys = [...mount.querySelectorAll('.settings-workspace-project:checked')].map((el) => el.value);
      if (!keys.length) {
        const status = mount.querySelector('#settings-workspace-status');
        if (status) status.textContent = 'Select at least one project.';
        return;
      }
      writeProjects(keys);
      const status = mount.querySelector('#settings-workspace-status');
      if (status) status.textContent = 'Defaults saved.';
    });

    mount.querySelector('#settings-reset-workspace')?.addEventListener('click', () => {
      const keys = defaultKeys.length ? defaultKeys : catalog.slice(0, 2).map((p) => p.key);
      writeProjects(keys);
      render();
      const status = mount.querySelector('#settings-workspace-status');
      if (status) status.textContent = 'Reset to organization defaults.';
    });
  }

  render();
}
