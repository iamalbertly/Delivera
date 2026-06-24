/**
 * Governance scope bar — mode dispatch (portfolio vs brief).
 */
import { isPortfolioScopePage } from './Delivera-App-Governance-Brief-ScopeBar-03Shared-Kernel-SSOT.js';
import { mountPortfolioScopeBarMode } from './Delivera-App-Governance-Brief-ScopeBar-04Portfolio-Mode-Render-UI.js';
import { mountBriefScopeBarMode } from './Delivera-App-Governance-Brief-ScopeBar-05Brief-Mode-Render-UI.js';

/**
 * @param {object} opts
 */
export function mountGovernanceScopeBar(opts) {
  if (isPortfolioScopePage(opts?.mount)) {
    return mountPortfolioScopeBarMode(opts);
  }
  return mountBriefScopeBarMode(opts);
}

/** @deprecated Use mountGovernanceScopeBar — portfolio mode is auto-detected. */
export function mountPortfolioScopeBar(opts) {
  return mountPortfolioScopeBarMode(opts);
}
