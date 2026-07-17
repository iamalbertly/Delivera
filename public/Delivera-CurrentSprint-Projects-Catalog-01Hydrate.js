/**
 * Hydrate Current Sprint project select from shared catalog SSOT.
 */
import { catalogProjectKeys } from './Delivera-Shared-ProjectScope-01Picker.js';
import { PROJECT_CATALOG, loadProjectCatalog } from './Delivera-Shared-Projects-Catalog-01SSOT.js';
import { currentSprintKeys } from './Delivera-CurrentSprint-Page-Context.js';

function readStoredProjectKey() {
  try {
    const raw = localStorage.getItem(currentSprintKeys.projectsKey)
      || localStorage.getItem('delivera_selectedProjects')
      || '';
    return String(raw).split(',')[0]?.trim().toUpperCase() || '';
  } catch (_) {
    return '';
  }
}

export async function hydrateCurrentSprintProjectsSelect() {
  const select = document.getElementById('current-sprint-projects');
  if (!select) return;
  const catalog = await loadProjectCatalog();
  const storedKey = readStoredProjectKey();
  const fallbackKey = PROJECT_CATALOG.find((p) => p.defaultSelected)?.key || PROJECT_CATALOG[0]?.key || 'MPSA';
  const selectedKey = storedKey || fallbackKey;
  select.innerHTML = '';
  for (const entry of catalog) {
    const opt = document.createElement('option');
    opt.value = entry.key;
    opt.textContent = entry.label;
    if (entry.key === selectedKey) opt.selected = true;
    select.appendChild(opt);
  }
}
