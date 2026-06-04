/**
 * SSOT: Epic hygiene scoring, naming suggestions, ad-hoc epic detection.
 */
const STRUCTURED_EPIC_RE = /^FY\d{2}\s+Q\d\s+[-–]\s+\S/i;
const PARTIAL_EPIC_RE = /^FY\d{2}\s+Q\d/i;

function asNum(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

function scoreEpicName(summary = '') {
  const t = String(summary || '').trim();
  if (!t) return 0;
  if (STRUCTURED_EPIC_RE.test(t)) return 100;
  if (PARTIAL_EPIC_RE.test(t)) return 60;
  if (t.length >= 20) return 40;
  return 20;
}

function suggestEpicName(summary = '', quarter = 'FY27 Q1') {
  const t = String(summary || '').trim().slice(0, 80);
  if (STRUCTURED_EPIC_RE.test(t)) return null;
  const parts = t.split(/[-–]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return `${quarter} – ${parts[0]} – ${parts[1]} – ${parts.slice(2).join(' ')}`;
  }
  return `${quarter} – Program – System – ${t || 'Product Goal'}`;
}

function collectEpicsFromPayloads(boardPayloads = []) {
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
  const baseline = brief?.baselineComparison;
  const committedKeys = new Set(
    (baseline?.items || []).map((i) => String(i.issueKey || '').toUpperCase()),
  );
  const epicKeys = collectEpicsFromPayloads(boardPayloads);
  const adHoc = [];

  for (const e of epicKeys) {
    if (committedKeys.has(e.issueKey)) continue;
    const ageDays = e.created
      ? Math.max(0, Math.round((Date.now() - new Date(e.created).getTime()) / 86400000))
      : null;
    let reason = 'not in PI baseline';
    if (!PARTIAL_EPIC_RE.test(e.summary)) reason = 'no FY quarter code in name';
    if (ageDays != null && ageDays > 60) reason = `active ${ageDays} days, no end date`;

    adHoc.push({
      issueKey: e.issueKey,
      summary: e.summary,
      squad: e.squad,
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
