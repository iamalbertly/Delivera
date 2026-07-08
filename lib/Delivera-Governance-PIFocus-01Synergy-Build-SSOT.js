/**
 * SSOT: PI focus / synergy state for governance brief meta.
 * Surfaces when board work and PI commitments lack alignment.
 */

function tokenSet(text = '') {
  return new Set(
    String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2),
  );
}

function titleOverlap(a = '', b = '') {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

function quarterEpicTitles(boardEpicIndex = []) {
  return (boardEpicIndex || [])
    .map((e) => String(e.title || e.summary || '').trim())
    .filter((t) => /\bfy\s*\d{2}\s*q[1-4]\b/i.test(t));
}

/**
 * @param {object} brief assembled contract (partial)
 * @returns {object} piFocus meta block
 */
export function buildPiFocusState(brief = {}) {
  const meta = brief?.meta || {};
  const boardEpicIndex = meta.boardEpicIndex || [];
  const boardEpicCount = boardEpicIndex.length;
  const hasBaseline = Boolean(brief?.baselineComparison);
  const committedKeys = meta.piBaselineCommittedKeys
    || brief?.baselineComparison?.items?.map((i) => i.issueKey)
    || [];
  const committedCount = committedKeys.length;
  const piConfidence = meta.piConfidence || {};
  const offPlan = Number(piConfidence?.counts?.offPlan || 0);
  const quarterEpics = quarterEpicTitles(boardEpicIndex);
  const epicHygiene = meta.epicHygiene || {};
  const hygieneScore = Number(epicHygiene.score || epicHygiene.hygieneScore || 100);

  let reason = '';
  let synergy = 'ok';
  let primaryAction = 'set-baseline';
  let proposedMissing = 0;
  let duplicateRiskCount = 0;
  let matchedCount = 0;

  if (!hasBaseline && boardEpicCount > 0 && quarterEpics.length === 0) {
    synergy = 'low';
    reason = 'board-unmatched';
    primaryAction = 'create-work';
  } else if (!hasBaseline && boardEpicCount === 0) {
    synergy = 'low';
    reason = 'no-baseline';
    primaryAction = 'create-work';
  } else if (!hasBaseline) {
    synergy = 'low';
    reason = 'no-baseline';
    primaryAction = 'set-baseline';
  } else if (offPlan > 0 || hygieneScore < 55) {
    synergy = 'low';
    reason = 'committed-drift';
    primaryAction = 'create-work';
    proposedMissing = offPlan;
  }

  if (hasBaseline && committedCount > 0 && boardEpicCount > committedCount + 2) {
    const committedTitles = (brief?.baselineComparison?.items || []).map((i) => i.title || '');
    const boardTitles = boardEpicIndex.map((e) => e.title || '');
    let lowOverlap = 0;
    for (const bt of boardTitles.slice(0, 12)) {
      const best = committedTitles.reduce((m, ct) => Math.max(m, titleOverlap(bt, ct)), 0);
      if (best < 0.25) lowOverlap += 1;
    }
    if (lowOverlap >= 2) {
      synergy = 'low';
      reason = 'committed-drift';
      primaryAction = 'create-work';
      proposedMissing = lowOverlap;
    }
  }

  const headlineKey = synergy === 'low'
    ? (reason === 'board-unmatched' ? 'piFocusBoardUnmatched'
      : reason === 'committed-drift' ? 'piFocusCommittedDrift'
        : 'piFocusNoBaseline')
    : '';

  return {
    synergy,
    reason: reason || 'ok',
    boardEpicCount,
    committedCount,
    proposedMissing,
    matchedCount,
    duplicateRiskCount,
    headlineKey,
    primaryAction,
    createWorkNarrative: '',
  };
}

/**
 * Re-order setup gaps when PI synergy is low — Create Work before set-baseline.
 */
export function applyPiFocusToSetupGaps(gaps = [], piFocus = {}) {
  const list = Array.isArray(gaps) ? [...gaps] : [];
  if (piFocus?.synergy !== 'low') return list;
  const filtered = list.filter((g) => g.id !== 'pi-synergy');
  const synergyGap = {
    id: 'pi-synergy',
    label: 'Board work and PI commitments need alignment',
    action: piFocus.primaryAction === 'create-work' ? 'create-work' : 'set-baseline',
    severity: 'high',
  };
  const baselineIdx = filtered.findIndex((g) => g.id === 'pi-baseline');
  if (baselineIdx >= 0) {
    filtered.splice(baselineIdx, 0, synergyGap);
    return filtered;
  }
  return [synergyGap, ...filtered];
}
