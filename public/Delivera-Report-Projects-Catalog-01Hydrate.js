/**
 * Hydrate Report project checkboxes from shared catalog SSOT.
 */
import { PROJECT_CATALOG } from './Delivera-Shared-Projects-Catalog-01SSOT.js';
import { PROJECTS_SSOT_KEY } from './Delivera-Shared-Storage-Keys.js';

function slugKey(key) {
  return String(key || '').trim().toLowerCase();
}

export function hydrateReportProjectCheckboxes() {
  const host = document.querySelector('.filter-group-who');
  if (!host) return;
  const tools = host.querySelector('.project-tools');
  const labelEl = host.querySelector('.project-group-label');
  let stored = [];
  try {
    const raw = localStorage.getItem(PROJECTS_SSOT_KEY);
    if (raw) stored = raw.split(',').map((p) => p.trim().toUpperCase()).filter(Boolean);
  } catch (_) { /* ignore */ }
  host.querySelectorAll('.checkbox-label').forEach((el) => el.remove());
  let mount = host.querySelector('#projects-catalog-mount');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'projects-catalog-mount';
    mount.setAttribute('aria-label', 'Project catalog');
  } else {
    mount.innerHTML = '';
  }
  for (const entry of PROJECT_CATALOG) {
    const pk = entry.key;
    const checked = stored.length
      ? stored.includes(pk)
      : Boolean(entry.defaultSelected);
    const row = document.createElement('label');
    row.className = 'checkbox-label';
    row.innerHTML = `
      <input type="checkbox" id="project-${slugKey(pk)}" class="project-checkbox" data-project="${pk}"${checked ? ' checked' : ''} />
      <span class="project-code">${pk}</span>
      <span class="project-desc">${entry.label}</span>`;
    mount.appendChild(row);
  }
  if (labelEl) labelEl.insertAdjacentElement('afterend', mount);
  else if (tools) tools.insertAdjacentElement('afterend', mount);
  else host.appendChild(mount);
}
