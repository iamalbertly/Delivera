/**
 * SSOT: Epic hygiene scoring, naming suggestions, ad-hoc epic detection.
 *
 * Canonical PI epic title shape (Delivera + aligned squads):
 *   `FY27 Q2 - DMS - NBA - Integration of CVM for Channel Productivity Campaign`
 *   → fiscalPeriod | squad/initiative | platform/product | commitment title
 *
 * Prefer this over Fix Version / label-only period diagnosis when the summary matches.
 */
export const STRUCTURED_EPIC_RE = /^FY\d{2}\s+Q\d\s+[-–]\s+\S/i;
export const PARTIAL_EPIC_RE = /^FY\d{2}\s+Q\d/i;
const PERIOD_IN_TEXT_RE = /\bFY\s*(\d{2,4})\s*[-_ ]?Q([1-4])\b/i;

function asNum(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

/** Parse FY/Q – squad – platform – title from an epic/promise summary. */
export function parseEpicTitleParts(summary = '') {
  const raw = String(summary || '').trim();
  if (!raw) {
    return {
      raw: '',
      fiscalPeriod: '',
      squad: '',
      platform: '',
      title: '',
      structured: false,
      partial: false,
    };
  }
  const periodMatch = raw.match(PERIOD_IN_TEXT_RE);
  const fiscalPeriod = periodMatch
    ? `FY${String(periodMatch[1]).slice(-2)} Q${periodMatch[2]}`
    : '';
  const structured = STRUCTURED_EPIC_RE.test(raw);
  const partial = PARTIAL_EPIC_RE.test(raw);
  if (!structured && !partial) {
    return {
      raw,
      fiscalPeriod,
      squad: '',
      platform: '',
      title: raw,
      structured: false,
      partial: false,
    };
  }
  const withoutPeriod = raw
    .replace(PERIOD_IN_TEXT_RE, '')
    .replace(/^\s*[-–—|:]\s*/, '')
    .trim();
  const segs = withoutPeriod.split(/\s*[-–—|]\s*/).map((p) => p.trim()).filter(Boolean);
  const squad = segs[0] || '';
  const platform = segs.length >= 3 ? segs[1] : '';
  const title = segs.length >= 3
    ? segs.slice(2).join(' — ')
    : (segs.slice(1).join(' — ') || raw);
  return {
    raw,
    fiscalPeriod,
    squad,
    platform,
    title: title || raw,
    structured,
    partial,
  };
}

/** Fiscal period from epic/promise summary when present (title SSOT beats Fix Version). */
export function periodFromEpicSummary(summary = '') {
  return parseEpicTitleParts(summary).fiscalPeriod || '';
}

/** True when summary encodes FY/Qn — enough PI period truth without Fix Version. */
export function epicSummaryHasPiPeriod(summary = '') {
  return Boolean(periodFromEpicSummary(summary));
}

export function scoreEpicName(summary = '') {
  const t = String(summary || '').trim();
  if (!t) return 0;
  if (STRUCTURED_EPIC_RE.test(t)) return 100;
  if (PARTIAL_EPIC_RE.test(t)) return 60;
  if (t.length >= 20) return 40;
  return 20;
}

export function suggestEpicName(summary = '', quarter = 'FY27 Q1') {
  const t = String(summary || '').trim().slice(0, 80);
  if (STRUCTURED_EPIC_RE.test(t)) return null;
  const parts = t.split(/[-–]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return `${quarter} – ${parts[0]} – ${parts[1]} – ${parts.slice(2).join(' ')}`;
  }
  return `${quarter} – Program – System – ${t || 'Product Goal'}`;
}

export function collectEpicsFromPayloads(boardPayloads = []) {
  const byKey = new Map();
  for (const entry of boardPayloads) {
    const squad = entry?.payload?.board?.name || entry?.board?.name || '';
    for (const s of (entry?.payload?.stories || [])) {
      const key = String(s.epicKey || '').toUpperCase();
      if (!key || byKey.has(key)) continue;
      byKey.set(key, {
        issueKey: key,
        summary: s.epicSummary || s.summary || key,
        squad,
        created: s.created || '',
      });
    }
  }
  return [...byKey.values()];
}

/**
 * Score epic naming hygiene per squad and portfolio.
 */
export function scoreEpicHygiene(brief = {}, boardPayloads = []) {
  const epics = collectEpicsFromPayloads(boardPayloads);
  if (!epics.length) {
    return { score: null, bySquad: [], weak: [], suggestions: [], epicCount: 0 };
  }

  const bySquad = new Map();
  for (const e of epics) {
    const sk = e.squad || 'Unknown';
    if (!bySquad.has(sk)) bySquad.set(sk, { squad: sk, scores: [], epics: [] });
    const sc = scoreEpicName(e.summary);
    bySquad.get(sk).scores.push(sc);
    bySquad.get(sk).epics.push({ ...e, score: sc });
  }

  const squadRows = [...bySquad.values()].map((row) => {
    const avg = row.scores.length
      ? Math.round(row.scores.reduce((a, b) => a + b, 0) / row.scores.length)
      : 0;
    return { squad: row.squad, score: avg, epicCount: row.epics.length };
  });

  const portfolioScore = epics.length
    ? Math.round(epics.reduce((a, e) => a + scoreEpicName(e.summary), 0) / epics.length)
    : null;

  const quarter = brief?.period?.vodacomQuarter || 'FY27 Q1';
  const weak = epics.filter((e) => scoreEpicName(e.summary) < 80);
  const suggestions = weak.slice(0, 5).map((e) => ({
    issueKey: e.issueKey,
    current: e.summary,
    suggested: suggestEpicName(e.summary, quarter),
    squad: e.squad,
  }));

  return {
    score: portfolioScore,
    epicCount: epics.length,
    formatAlignedCount: epics.filter((e) => STRUCTURED_EPIC_RE.test(e.summary)).length,
    formatPartialCount: epics.filter((e) => PARTIAL_EPIC_RE.test(e.summary) && !STRUCTURED_EPIC_RE.test(e.summary)).length,
    bySquad: squadRows,
    weak,
    suggestions,
    summaryLine: squadRows.length
      ? squadRows.map((r) => `${r.squad.split(' ')[0] || r.squad} ${r.score}%`).join(' · ')
      : 'No epics in scope',
  };
}

/**
 * Epics active in Jira but not in PI baseline committed items.
 */
export function detectAdHocEpics(brief = {}, boardPayloads = []) {
  const committedKeys = new Set(
    (brief?.meta?.piBaselineCommittedKeys || []).map((k) => String(k || '').toUpperCase()),
  );
  const epicKeys = collectEpicsFromPayloads(boardPayloads);
  const adHoc = [];

  for (const e of epicKeys) {
    if (committedKeys.has(e.issueKey)) continue;
    const parts = parseEpicTitleParts(e.summary);
    const ageDays = e.created
      ? Math.max(0, Math.round((Date.now() - new Date(e.created).getTime()) / 86400000))
      : null;
    let reason = 'not in PI baseline';
    if (!parts.partial) reason = 'title missing FY/Qn — treat as ad-hoc / non-aligned naming';
    else if (!parts.structured) reason = 'partial FY/Qn only — missing squad–platform–title shape';
    if (ageDays != null && ageDays > 60) reason = `active ${ageDays} days, no end date`;

    adHoc.push({
      issueKey: e.issueKey,
      summary: e.summary,
      title: parts.title || e.summary,
      squad: e.squad || parts.squad,
      platform: parts.platform,
      fiscalPeriod: parts.fiscalPeriod,
      formatAligned: parts.structured,
      ageDays,
      reason,
      classification: 'unapproved-scope',
    });
  }

  return adHoc;
}

export const AD_HOC_CLASSIFICATIONS = Object.freeze([
  'pi-commitment',
  'operational-support',
  'incident',
  'regulatory',
  'executive-request',
  'unapproved-scope',
]);
