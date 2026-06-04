/** Shared Playwright mock for GET /api/projects-catalog.json */
export const GOV_CATALOG_KEYS = ['MPSA', 'MAS', 'RPA', 'MVA', 'ASG', 'FIN', 'SD', 'MPSA2', 'TRS', 'VB', 'AMS2', 'BIO'];

export async function routeProjectsCatalog(page, access = {}) {
  await page.route('**/api/projects-catalog.json**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      projects: GOV_CATALOG_KEYS.map((key) => ({
        key,
        label: key,
        accessible: access[key] !== false,
      })),
    }),
  }));
}
