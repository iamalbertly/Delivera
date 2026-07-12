/**
 * SSOT: Freshness pill render guard — scope bar chip owns freshness on priority brief pages.
 */
export function shouldSkipFreshnessRender({ freshnessEl = null, scopeHasStatusChip = false } = {}) {
  return scopeHasStatusChip || !freshnessEl;
}
