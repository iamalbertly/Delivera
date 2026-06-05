/**
 * Client-safe helpers for command surface UI (no lib imports).
 */
import { COPY } from './Delivera-App-Shared-Delivery-Copy-01Language-SSOT.js';

export function commandAnswerSentence(brief) {
  return brief?.meta?.commandAnswerSentence
    || brief?.executiveView?.verdictLine
    || brief?.leadershipNarrative?.meetingAnswer
    || '';
}

export function proofChipSummary(brief, issueKeys = []) {
  const rows = brief?.evidencePack?.rows || [];
  const keys = new Set((issueKeys || []).map((k) => String(k).toUpperCase()));
  const matched = keys.size
    ? rows.filter((r) => keys.has(String(r.issueKey).toUpperCase()))
    : rows;
  const changelog = matched.filter((r) => r.changelogAvailable).length;
  const fresh = brief?.freshness?.confidenceLimit === 'live' ? 'live' : 'cached';
  const age = brief?.freshness?.cacheAgeMinutes;
  const freshLabel = fresh === 'live' ? 'live' : age != null ? `cached ${age}m` : fresh;
  return `Proof: ${matched.length || keys.size} keys · ${changelog} changelog checks · ${freshLabel}`;
}

export { riskToUseCase } from './Delivera-App-Governance-Brief-RiskToUseCase-01Map-SSOT.js';

function hasPiBaselineGap(brief = {}) {
  if (brief?.baselineComparison) return false;
  const gaps = brief?.meta?.setupGaps || [];
  return gaps.some((g) => String(g.id || '').toLowerCase() === 'pi-baseline');
}

export function sendReadinessBadge(brief) {
  if (brief?.freshness?.confidenceLimit === 'stale') return { label: 'Stale — refresh first', tier: 'stale' };
  if (hasPiBaselineGap(brief)) return { label: COPY.piBaselineFixFirst, tier: 'setup' };
  if (brief?.meta?.safeToSend === false) return { label: 'Needs edit', tier: 'weak' };
  if (brief?.meta?.safeToSend === true) return { label: 'Safe to send', tier: 'safe' };
  return { label: 'Weak evidence', tier: 'weak' };
}
