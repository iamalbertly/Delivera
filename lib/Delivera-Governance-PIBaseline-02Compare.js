/**
 * SSOT: PI Baseline vs Now comparison.
 *
 * Compares an approved PI baseline snapshot against the current delivery reality
 * (the fact contract) and classifies each commitment: delivered, delayed,
 * removed, not-planned, split, added-after-baseline, or not-traceable.
 *
 * Pure: baseline object + current keys/status, returns classified diff. No IO.
 */

export const BASELINE_VERDICTS = Object.freeze({
  DELIVERED: 'delivered',
  DELAYED: 'delayed',
  REMOVED: 'removed',
  NOT_PLANNED: 'not-planned',
  ADDED_AFTER_BASELINE: 'added-after-baseline',
  NOT_TRACEABLE: 'not-traceable',
  ON_TRACK: 'on-track',
});

function statusIsDone(status) {
  return String(status || '').toLowerCase().includes('done');
}

function resolveLifecycle(item = {}) {
  return String(item?.epicActivity?.lifecycle || item?.lifecycle || '').trim().toLowerCase();
}

/**
 * Board-absent baseline item: distinguish "in Jira, no stories" from truly gone.
 * Keys present on the slide with any non-missing lifecycle (or no lifecycle yet)
 * are treated as not-planned — not removed — so cause language stays honest.
 */
function verdictWhenAbsentFromBoard(item = {}) {
  const key = String(item.issueKey || '').trim().toUpperCase();
  const lifecycle = resolveLifecycle(item);
  if (!key || lifecycle === 'missing') {
    return {
      verdict: BASELINE_VERDICTS.REMOVED,
      statusNow: lifecycle === 'missing' ? 'not in Jira' : 'not found',
    };
  }
  if (lifecycle === 'jira-only' || lifecycle === 'not-started' || lifecycle === 'unknown' || !lifecycle) {
    return {
      verdict: BASELINE_VERDICTS.NOT_PLANNED,
      statusNow: 'in Jira · no stories on selected boards',
    };
  }
  return {
    verdict: BASELINE_VERDICTS.NOT_PLANNED,
    statusNow: 'in Jira · no stories on selected boards',
  };
}

/**
 * @param {object} args
 * @param {object} args.baseline saved baseline { committedItems[], baselineDate }
 * @param {Map|object} args.currentByKey issueKey -> { status, updated, inActiveSprint }
 * @param {string[]} [args.currentKeys] all issue keys currently in the portfolio (for added-after detection)
 * @returns {object} { piName, baselineDate, summary: {...counts}, items: [...] }
 */
export function comparePIBaselineToNow({ baseline = {}, currentByKey = new Map(), currentKeys = [] } = {}) {
  const lookup = (key) => {
    if (currentByKey instanceof Map) return currentByKey.get(key) || null;
    return currentByKey[key] || null;
  };
  const committed = Array.isArray(baseline?.committedItems) ? baseline.committedItems : [];
  const committedKeySet = new Set(committed.map((i) => String(i.issueKey || '').trim().toUpperCase()));
  const baselineDateMs = baseline?.baselineDate ? new Date(baseline.baselineDate).getTime() : NaN;

  const items = [];
  const summary = {
    delivered: 0,
    delayed: 0,
    removed: 0,
    notPlanned: 0,
    addedAfterBaseline: 0,
    notTraceable: 0,
    onTrack: 0,
    totalCommitted: committed.length,
  };

  for (const item of committed) {
    const key = String(item.issueKey || '').trim().toUpperCase();
    const current = lookup(key);
    let verdict;
    let statusNow;
    if (!current) {
      const absent = verdictWhenAbsentFromBoard(item);
      verdict = absent.verdict;
      statusNow = absent.statusNow;
      if (verdict === BASELINE_VERDICTS.NOT_PLANNED) summary.notPlanned += 1;
      else summary.removed += 1;
    } else if (statusIsDone(current.status)) {
      verdict = BASELINE_VERDICTS.DELIVERED;
      summary.delivered += 1;
      statusNow = current.status;
    } else if (item.targetDate && new Date(item.targetDate).getTime() < Date.now()) {
      verdict = BASELINE_VERDICTS.DELAYED;
      summary.delayed += 1;
      statusNow = current.status;
    } else {
      verdict = BASELINE_VERDICTS.ON_TRACK;
      summary.onTrack += 1;
      statusNow = current.status;
    }
    items.push({
      issueKey: key,
      title: item.title,
      squad: item.squad,
      owner: item.owner,
      targetDate: item.targetDate,
      statusNow: statusNow || current?.status || 'not found',
      verdict,
      epicActivity: item.epicActivity || null,
      sourceBullet: item.sourceBullet || '',
      matchScore: item.matchScore,
      matchMethod: item.matchMethod,
    });
  }

  // Added after baseline: keys present now but not in the committed set, created after baseline date.
  for (const rawKey of (Array.isArray(currentKeys) ? currentKeys : [])) {
    const key = String(rawKey || '').trim().toUpperCase();
    if (!key || committedKeySet.has(key)) continue;
    const current = lookup(key);
    const createdMs = current?.created ? new Date(current.created).getTime() : NaN;
    const isAfter = Number.isFinite(baselineDateMs) && Number.isFinite(createdMs) ? createdMs > baselineDateMs : true;
    if (isAfter) {
      summary.addedAfterBaseline += 1;
      items.push({ issueKey: key, title: current?.title || '', statusNow: current?.status || '', verdict: BASELINE_VERDICTS.ADDED_AFTER_BASELINE });
    } else {
      summary.notTraceable += 1;
      items.push({ issueKey: key, title: current?.title || '', statusNow: current?.status || '', verdict: BASELINE_VERDICTS.NOT_TRACEABLE });
    }
  }

  return {
    piName: baseline?.piName || null,
    baselineDate: baseline?.baselineDate || null,
    approvedBy: baseline?.approvedBy || null,
    summary,
    items,
  };
}
