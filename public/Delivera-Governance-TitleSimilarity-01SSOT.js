/**
 * SSOT: semantic title matching for PI baseline ↔ board epic alignment.
 */
export const SEMANTIC_MATCH_THRESHOLD = 0.55;
export const DRIFT_LOW_OVERLAP_THRESHOLD = 0.25;

export function titleSimilarity(a = '', b = '') {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
  const ta = new Set(norm(a));
  const tb = new Set(norm(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

export function bestTitleMatchScore(title = '', candidates = []) {
  const t = String(title || '').trim();
  if (!t || !candidates.length) return 0;
  return candidates.reduce((best, c) => {
    const ct = String(c?.title || c?.summary || c || '').trim();
    return Math.max(best, titleSimilarity(t, ct));
  }, 0);
}

export function matchesAnyBaselineTitle(epicTitle = '', baselineItems = [], minScore = SEMANTIC_MATCH_THRESHOLD) {
  const items = Array.isArray(baselineItems) ? baselineItems : [];
  return bestTitleMatchScore(epicTitle, items) >= minScore;
}

export function countSemanticBoardMatches(boardEpics = [], baselineItems = [], minScore = SEMANTIC_MATCH_THRESHOLD) {
  const items = Array.isArray(baselineItems) ? baselineItems : [];
  if (!items.length) return 0;
  let matched = 0;
  for (const epic of boardEpics) {
    const title = epic?.title || epic?.summary || '';
    if (matchesAnyBaselineTitle(title, items, minScore)) matched += 1;
  }
  return matched;
}
