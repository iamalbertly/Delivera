/**
 * SSOT: Resolve a concrete squad key when scope may be All Projects (__ALL__).
 * Never pass PORTFOLIO_ALL into Jira / wizard / sticky API paths.
 */
import { PORTFOLIO_ALL, rankProjectsByDataDensity, densityFromBrief } from './Delivera-Governance-Portfolio-Scope-Rank-01SSOT.js';

/**
 * @param {object} opts
 * @param {string} [opts.anchor]
 * @param {string[]} [opts.projects]
 * @param {object} [opts.brief]
 * @param {boolean} [opts.allowAll] when true, may return PORTFOLIO_ALL
 * @returns {string} uppercase project key or '' 
 */
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
      const ranked = rankProjectsByDataDensity(list.length ? list : Object.keys(densityFromBrief(brief)), densityFromBrief(brief));
      if (ranked[0]) return ranked[0];
    }
    return list[0] || '';
  }
  return A;
}

export function isPortfolioAllKey(key = '') {
  return String(key || '').trim().toUpperCase() === PORTFOLIO_ALL;
}
