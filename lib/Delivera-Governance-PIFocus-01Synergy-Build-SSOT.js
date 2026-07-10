/**
 * SSOT: PI focus / synergy state for governance brief meta.
 * Surfaces when board work and PI commitments lack alignment.
 */
import {
  DRIFT_LOW_OVERLAP_THRESHOLD,
  SEMANTIC_MATCH_THRESHOLD,
  countSemanticBoardMatches,
  titleSimilarity,
} from '../public/Delivera-Governance-TitleSimilarity-01SSOT.js';

function quarterEpicTitles(boardEpicIndex = []) {
  return (boardEpicIndex || [])
    .map((e) => String(e.title || e.summary || '').trim())
    .filter((t) => /\bfy\s*\d{2}\s*q[1-4]\b/i.test(t));
}

function buildPiFocusSummary({ synergy, reason, matchedCount, boardEpicCount, committedCount, proposedMissing }) {
  if (synergy === 'ok') {
    return matchedCount > 0
      ? `${matchedCount} of ${boardEpicCount} board epics align with ${committedCount} PI commitments`
      : '';
  }
  if (reason === 'board-unmatched') {
    return 'Board epics do not match PI commitment titles — confirm scope before investing';
  }
  if (reason === 'committed-drift') {
    return `${proposedMissing || 0} board epics drift from saved PI baseline — review before quarter decisions`;
  }
  return 'PI promised work is not saved — align board work with the quarter slide';
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
  const baselineItems = brief?.baselineComparison?.items || [];
  const committedKeys = meta.piBaselineCommittedKeys
    || baselineItems.map((i) => i.issueKey)
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
  const matchedCount = hasBaseline && baselineItems.length
    ? countSemanticBoardMatches(boardEpicIndex, baselineItems, SEMANTIC_MATCH_THRESHOLD)
    : 0;

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
    const semanticCoverage = boardEpicCount > 0 ? matchedCount / boardEpicCount : 0;
    if (semanticCoverage < 0.5) {
      synergy = 'low';
      reason = 'committed-drift';
      primaryAction = 'create-work';
      proposedMissing = offPlan;
    }
  }

  if (hasBaseline && committedCount > 0 && boardEpicCount > committedCount + 2) {
    const committedTitles = baselineItems.map((i) => i.title || '');
    const boardTitles = boardEpicIndex.map((e) => e.title || e.summary || '');
    let lowOverlap = 0;
    for (const bt of boardTitles.slice(0, 12)) {
      const best = committedTitles.reduce((m, ct) => Math.max(m, titleSimilarity(bt, ct)), 0);
      if (best < DRIFT_LOW_OVERLAP_THRESHOLD) lowOverlap += 1;
    }
    const semanticCoverage = boardEpicCount > 0 ? matchedCount / boardEpicCount : 0;
    if (lowOverlap >= 2 && semanticCoverage < 0.5) {
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

  const summary = buildPiFocusSummary({
    synergy,
    reason,
    matchedCount,
    boardEpicCount,
    committedCount,
    proposedMissing,
  });

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
    summary,
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
