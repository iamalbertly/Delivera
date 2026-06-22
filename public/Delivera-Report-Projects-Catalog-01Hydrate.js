/**
 * Hydrate Report project checkboxes from shared catalog API.
 */
import { PROJECTS_SSOT_KEY } from './Delivera-Shared-Storage-Keys.js';
import {
  fetchProjectsCatalog,
  readStoredProjectKeys,
  isProjectSelected,
} from './Delivera-Shared-Projects-Catalog-01Hydrate-SSOT.js';

function slugKey(key) {
  return String(key || '').trim().toLowerCase();
}

export async function hydrateReportProjectCheckboxes() {
  const host = document.querySelector('.filter-group-who');
  if (!host) return;
  const tools = host.querySelector('.project-tools');
  const labelEl = host.querySelector('.project-group-label');
  let catalog = [];
  try {
    const data = await fetchProjectsCatalog();
    catalog = data.projects || [];
  } catch (_) {
    return;
  }
  const stored = readStoredProjectKeys();
  host.querySelectorAll('.checkbox-label').forEach((el) => el.remove());
  let mount = host.querySelector('#projects-catalog-mount');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'projects-catalog-mount';
    mount.setAttribute('aria-label', 'Project catalog');
  } else {
    mount.innerHTML = '';
  }
  for (const entry of catalog) {
    const pk = entry.key;
    const checked = isProjectSelected(pk, stored, entry);
    const row = document.createElement('label');
    row.className = 'checkbox-label';
    row.innerHTML = `
      <input type="checkbox" id="project-${slugKey(pk)}" class="project-checkbox" data-project="${pk}"${checked ? ' checked' : ''} />
      <span class="project-code">${pk}</span>
      <span class="project-desc">${entry.label || pk}</span>`;
    mount.appendChild(row);
  }
  if (labelEl) labelEl.insertAdjacentElement('afterend', mount);
  else if (tools) tools.insertAdjacentElement('afterend', mount);
  else host.appendChild(mount);
}
