/** Shared Playwright mock for GET /api/projects-catalog.json */
export const GOV_CATALOG_KEYS = ['MPSA', 'MAS', 'RPA', 'MVA', 'ASG', 'FIN', 'SD', 'MPSA2', 'TRS', 'VB', 'AMS2', 'BIO'];

const CATALOG_LABELS = {
  SD: { label: 'DMS Squad', shortLabel: 'DMS' },
  MPSA: { label: 'M-SQUAD', shortLabel: 'M-SQUAD' },
};

export async function routeProjectsCatalog(page, access = {}) {
  await page.route('**/api/projects-catalog.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      projects: GOV_CATALOG_KEYS.map((key) => ({
        key,
        label: CATALOG_LABELS[key]?.label || key,
        shortLabel: CATALOG_LABELS[key]?.shortLabel || key,
        defaultSelected: key === 'MPSA' || key === 'MAS',
        accessible: access[key] !== false,
      })),
      keys: GOV_CATALOG_KEYS,
      displayMode: 'label',
      catalogSource: 'json',
    }),
  }));
}
