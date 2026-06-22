/**
 * Hydrate Current Sprint project select from shared catalog API.
 */
import {
  fetchProjectsCatalog,
  readStoredProjectKeys,
  fallbackDefaultKey,
} from './Delivera-Shared-Projects-Catalog-01Hydrate-SSOT.js';
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
  let catalog = [];
  try {
    const data = await fetchProjectsCatalog();
    catalog = data.projects || [];
  } catch (_) {
    return;
  }
  const storedKey = readStoredProjectKeys()[0] || readStoredProjectKey();
  const selectedKey = storedKey || fallbackDefaultKey(catalog);
  select.innerHTML = '';
  for (const entry of catalog) {
    const opt = document.createElement('option');
    opt.value = entry.key;
    const label = entry.shortLabel || entry.label || entry.key;
    opt.textContent = `${label} (${entry.key})`;
    if (entry.key === selectedKey) opt.selected = true;
    select.appendChild(opt);
  }
}
