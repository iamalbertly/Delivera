/**
 * Client mirror: resolve concrete squad when scope may be All Projects.
 */
import { PORTFOLIO_ALL, rankProjectsByDataDensity, densityFromBrief } from './Delivera-Governance-Portfolio-Scope-Rank-01SSOT.js';

export function resolveEffectiveSquad({
  anchor = '',
  projects = [],
  brief = null,
  allowAll = false,
} = {}) {
  const A = String(anchor || '').trim().toUpperCase();
  const list = (Array.isArray(projects) ? projects : [])
    .map((p) => String(p || '').trim().toUpperCase())
    .filter((p) => p && p !== PORTFOLIO_ALL);

  if (A === PORTFOLIO_ALL || !A) {
    if (allowAll && A === PORTFOLIO_ALL) return PORTFOLIO_ALL;
    if (brief) {
      const catalog = list.length ? list : Object.keys(densityFromBrief(brief));
      const ranked = rankProjectsByDataDensity(catalog, densityFromBrief(brief));
      if (ranked[0]) return ranked[0];
    }
    return list[0] || '';
  }
  return A;
}

export function isPortfolioAllKey(key = '') {
  return String(key || '').trim().toUpperCase() === PORTFOLIO_ALL;
}

export { PORTFOLIO_ALL };
