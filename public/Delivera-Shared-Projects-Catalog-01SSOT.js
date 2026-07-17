/**
 * Canonical project catalog (aligned with Report page squads).
 */
export const PROJECT_CATALOG = [
  { key: 'MPSA', label: 'M-SQUAD', defaultSelected: true },
  { key: 'MAS', label: 'Mini - Apps Squad', defaultSelected: true },
  { key: 'RPA', label: 'Robotics Process Automation (RPA)', defaultSelected: false },
  { key: 'MVA', label: 'Digital Squad', defaultSelected: false },
  { key: 'ASG', label: 'Agile and Security Guild', defaultSelected: false },
  { key: 'FIN', label: 'Finance Squad', defaultSelected: false },
  { key: 'SD', label: 'DMS Squad (Kilimanjaro Legends)', defaultSelected: false },
  { key: 'MPSA2', label: 'TRANSFORMERS', defaultSelected: false },
  { key: 'TRS', label: 'T-Squad', defaultSelected: false },
  { key: 'VB', label: 'Vodacom Business', defaultSelected: false },
  { key: 'AMS2', label: 'AMS Squad (Tachyons)', defaultSelected: false },
  { key: 'BIO', label: 'Bio metric KYC & KYA', defaultSelected: false },
];

let catalogRequest = null;

export async function loadProjectCatalog() {
  if (!catalogRequest) {
    catalogRequest = fetch('/api/projects-catalog.json', { credentials: 'same-origin' })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => Array.isArray(body?.projects) && body.projects.length ? body.projects : PROJECT_CATALOG)
      .catch(() => PROJECT_CATALOG);
  }
  return catalogRequest;
}

export function projectDisplayName(key, catalog = PROJECT_CATALOG) {
  const normalized = String(key || '').trim().toUpperCase();
  return catalog.find((entry) => entry.key === normalized)?.label || normalized;
}

export function readCatalogKeys() {
  return PROJECT_CATALOG.map((p) => p.key);
}

export function defaultSelectedKeys() {
  return PROJECT_CATALOG.filter((p) => p.defaultSelected).map((p) => p.key);
}

export function catalogEntry(key) {
  const k = String(key || '').trim().toUpperCase();
  return PROJECT_CATALOG.find((p) => p.key === k) || null;
}
