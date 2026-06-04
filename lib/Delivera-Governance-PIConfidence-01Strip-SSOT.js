/**
 * SSOT: PI Confidence strip — leadership object for PI commitment health.
 */
import { BASELINE_VERDICTS } from './Delivera-Governance-PIBaseline-02Compare.js';

function asNum(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function parseDateMs(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function daysBetween(start, end) {
  const a = parseDateMs(start);
  const b = parseDateMs(end);
  if (a == null || b == null || b <= a) return null;
  return Math.max(1, Math.round((b - a) / 86400000));
}

/**
 * Build PI confidence strip payload from brief + board payloads.
 */
export function buildPIConfidenceStrip(brief = {}, boardPayloads = []) {
  const baseline = brief?.baselineComparison;
  const hasBaseline = Boolean(baseline?.summary);
  const summary = baseline?.summary || {};
  const items = Array.isArray(baseline?.items) ? baseline.items : [];

  const committed = asNum(summary.totalCommitted, items.length);
  const delivered = asNum(summary.delivered, 0);
  const delayed = asNum(summary.delayed, 0);
  const onTrack = asNum(summary.onTrack, 0);
  const addedAfter = asNum(summary.addedAfterBaseline, 0);
  const removed = asNum(summary.removed, 0);

  let confidencePct = null;
  if (hasBaseline && committed > 0) {
    confidencePct = Math.round(((delivered + onTrack) / committed) * 100);
  }

  const missingDates = items.filter((i) => !i.targetDate).length;
  const atRisk = delayed + removed;
  const offPlan = addedAfter;

  const timelineChips = items.slice(0, 8).map((item) => {
    const start = item.plannedStartDate || item.targetDate || '';
    const end = item.targetDate || '';
    const totalDays = daysBetween(start, end) || null;
    const elapsedPct = totalDays && parseDateMs(start)
      ? Math.min(100, Math.round(((Date.now() - parseDateMs(start)) / (totalDays * 86400000)) * 100))
      : null;
    const verdict = item.verdict || '';
    let confidenceLabel = 'Medium';
    if (verdict === BASELINE_VERDICTS.DELIVERED) confidenceLabel = 'High';
    else if (verdict === BASELINE_VERDICTS.DELAYED || verdict === BASELINE_VERDICTS.REMOVED) confidenceLabel = 'Low';
    else if (!end) confidenceLabel = 'Limited';

    return {
      issueKey: item.issueKey,
      title: item.title || item.issueKey,
      plannedStartDate: start,
      plannedEndDate: end,
      elapsedPct,
      deliveryPct: verdict === BASELINE_VERDICTS.DELIVERED ? 100 : null,
      confidenceLabel,
      missingDates: !end,
    };
  });

  if (!hasBaseline) {
    const candidateEpics = countCandidateEpics(boardPayloads);
    const adHoc = brief?.meta?.adHocEpics?.length || 0;
    return {
      trusted: false,
      confidencePct: null,
      headline: 'PI Confidence: Not trusted yet',
      subline: `Committed epics: 0 confirmed · Candidate epics: ${candidateEpics} · Ad-hoc: ${adHoc} · Missing dates: ${missingDates || candidateEpics}`,
      counts: { committed: 0, onTrack: 0, atRisk: 0, offPlan: adHoc, missingDates: missingDates || candidateEpics },
      timelineChips: [],
    };
  }

  return {
    trusted: confidencePct != null && confidencePct >= 50,
    confidencePct,
    headline: confidencePct != null
      ? `PI Confidence: ${confidencePct}%`
      : 'PI Confidence: Limited',
    subline: `${committed} committed · ${onTrack + delivered} on track · ${atRisk} at risk · ${offPlan} ad-hoc · ${missingDates} missing end date`,
    counts: {
      committed,
      onTrack: onTrack + delivered,
      atRisk,
      offPlan,
      missingDates,
    },
    timelineChips,
  };
}

function countCandidateEpics(boardPayloads) {
  const keys = new Set();
  for (const { payload } of boardPayloads || []) {
    for (const s of (payload?.stories || [])) {
      const k = String(s.epicKey || '').toUpperCase();
      if (k) keys.add(k);
    }
  }
  return keys.size;
}

/** PI-forum-ready copy (deterministic). */
export function buildPIForumAnswer(brief = {}) {
  const strip = brief?.meta?.piConfidence || buildPIConfidenceStrip(brief);
  const period = brief?.period?.vodacomQuarter || 'this PI';
  const projects = (brief?.projects || []).join(' + ') || 'portfolio';
  if (!strip.trusted && strip.confidencePct == null) {
    const c = strip.counts || {};
    return `${period} ${projects} has ${c.offPlan || 0} candidate epics not yet confirmed in baseline. `
      + `${c.atRisk || 0} items need dates or baseline confirmation. `
      + 'Confidence remains low until baseline and end dates are confirmed.';
  }
  const c = strip.counts || {};
  return `${period} ${projects}: PI confidence ${strip.confidencePct}%. `
    + `${c.committed || 0} committed, ${c.onTrack || 0} on track, ${c.atRisk || 0} at risk, ${c.offPlan || 0} ad-hoc. `
    + `${c.missingDates || 0} missing end dates.`;
}

/** De-personalized escalation copy. */
export function buildProtectMeAnswer(brief = {}) {
  const line = brief?.meta?.commandAnswerSentence
    || brief?.executiveView?.verdictLine
    || 'Delivery needs attention in this scope.';
  return `Safest wording: This is a delivery confidence issue supported by evidence, not a person issue. ${line} `
    + 'Recommended next step: confirm scope, owner lane, and end date before escalation.';
}
