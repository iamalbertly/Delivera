/**
 * SSOT: Slide commitment matching, duplicate risk, reconcile, narrative.
 */
import {
  EPIC_DELIM,
  commitmentLabel,
  deriveTargetDate,
  findPlaybookEntry,
  mergeChildStories,
  normalizeEpicTitle,
  playbookForProjects,
  quarterKey,
  squadKey,
} from './Delivera-Governance-PIBaseline-05Slide-Playbook-01SSOT.js';
import { DEFAULT_EPIC_FORMAT, buildEpicTitleFromFormat } from './Delivera-Governance-Epic-Format-01SSOT.js';
import { epicMatchesFinancialQuarter } from './Delivera-Jira-Board-Epics-01SSOT.js';
import { SEMANTIC_MATCH_THRESHOLD, titleSimilarity } from '../public/Delivera-Governance-TitleSimilarity-01SSOT.js';

export const SLIDE_EPIC_STATUS = Object.freeze({
  MATCHED: 'matched',
  MISSING: 'missing',
  DUPLICATE_RISK: 'duplicate-risk',
});

export const SLIDE_SUGGESTED_ACTION = Object.freeze({
  LINK: 'link',
  CREATE: 'create',
  REVIEW: 'review',
});

/** Map slide RAG text to commitment provenance labels. */
export function mapRagToProvenance(ragStatus = '') {
  const s = String(ragStatus || '').toLowerCase();
  if (/deliver/.test(s)) return { label: 'Delivered on slide', tone: 'on-track' };
  if (/progress|on.?track/.test(s)) return { label: 'In progress on slide', tone: 'watch' };
  if (/off.?track/.test(s)) return { label: 'Off track on slide', tone: 'blocked' };
  return null;
}

/** Bidirectional title aliases for Jira ↔ playbook drift (of/with CVM, Enhancements). */
export function canonicalizeForMatch(title = '') {
  let t = normalizeJiraEpicTitle(title);
  const pairs = [
    ['integration of cvm', 'integration with cvm'],
    ['nba enhancements', 'enhancement based on user feedback'],
    ['enhancements', 'enhancement based on user feedback'],
  ];
  for (const [from, to] of pairs) {
    if (t.includes(from)) t = t.replace(from, to);
  }
  return t;
}

/** Normalize Jira hierarchy titles (DMS > NBA > X) and EHOD/E-HOD aliases for matching. */
export function normalizeJiraEpicTitle(title = '') {
  let t = String(title || '').trim();
  const hier = t.match(/>\s*([^>]+)$/);
  if (hier) t = hier[1].trim();
  return normalizeEpicTitle(t)
    .replace(/\be\s*-\s*hod\b/g, 'ehod')
    .replace(/\be\s*hod\b/g, 'ehod')
    .replace(/\behod\b/g, 'ehod');
}

const ISSUE_KEY_IN_TERM_RE = /^[a-z]{2,10}-\d+$/i;

function hierarchyTail(title = '') {
  const m = String(title || '').match(/>\s*([^>]+)$/);
  return m ? normalizeJiraEpicTitle(m[1]) : '';
}

function capabilitySegment(title = '') {
  const norm = normalizeJiraEpicTitle(title);
  const parts = norm.split(' - ');
  return parts[parts.length - 1] || norm;
}

/**
 * Playbook canonical title wins over AI drift.
 * Ambition-table rows use module + deliveryItem for 5-segment titles.
 */
export function resolveSuggestedEpicTitle({
  row = {},
  entry = null,
  qKey = '',
  squad = 'DMS',
  epicFormat = DEFAULT_EPIC_FORMAT,
  normalizedAiTitle = '',
  program = '',
} = {}) {
  if (entry?.epicTitle) return entry.epicTitle;
  if (normalizedAiTitle) return normalizedAiTitle;
  const moduleName = String(row.module || entry?.module || '').trim();
  const capability = String(
    row.deliveryItem || row.bullet || row.title || commitmentLabel(row),
  ).slice(0, 80) || 'Product Goal';
  const subsystem = moduleName
    ? (String(program || row.program || 'TOWERCO').replace(/\s+/g, '').toUpperCase() || 'TOWERCO')
    : (epicFormat?.defaultSubsystem || 'NBA');
  return buildEpicTitleFromFormat({
    quarter: qKey,
    squad,
    subsystem,
    module: moduleName,
    capability,
  }, epicFormat);
}

function findBestEpicMatch(suggestedTitle, epics = [], minScore = SEMANTIC_MATCH_THRESHOLD, bullet = '') {
  let best = null;
  let bestScore = 0;
  const capSuggested = capabilitySegment(suggestedTitle);
  const bulletNorm = normalizeJiraEpicTitle(bullet || '');
  const suggNorm = normalizeJiraEpicTitle(suggestedTitle);
  const suggCanon = canonicalizeForMatch(suggestedTitle);
  for (const e of epics) {
    const title = e.title || e.summary || '';
    const capEpic = capabilitySegment(title);
    const jiraNorm = normalizeJiraEpicTitle(title);
    const jiraCanon = canonicalizeForMatch(title);
    const hierCap = hierarchyTail(title);
    const score = Math.max(
      titleSimilarity(suggestedTitle, title),
      titleSimilarity(suggNorm, jiraNorm),
      titleSimilarity(suggCanon, jiraCanon),
      capSuggested && capEpic ? titleSimilarity(capSuggested, capEpic) : 0,
      bulletNorm && capEpic ? titleSimilarity(bulletNorm, capEpic) : 0,
      bulletNorm ? titleSimilarity(bulletNorm, jiraNorm) : 0,
      bulletNorm && hierCap ? titleSimilarity(bulletNorm, hierCap) : 0,
      capSuggested && hierCap ? titleSimilarity(capSuggested, hierCap) : 0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  const effectiveMin = bulletNorm && capSuggested ? Math.min(minScore, 0.38) : minScore;
  if (best && bestScore >= effectiveMin) return { epic: best, score: bestScore };
  return null;
}

/** Second pass: link FY quarter board epics when canonical titles almost match (SD-5314 of/with CVM). */
export function boostResolvedWithBoardEpics(resolved = [], boardEpics = [], quarter = '') {
  const qKey = quarterKey(quarter) || '';
  return (resolved || []).map((row) => {
    if (row.status === SLIDE_EPIC_STATUS.MATCHED && row.issueKey) return row;
    const suggCanon = canonicalizeForMatch(row.suggestedEpicTitle || '');
    const capS = capabilitySegment(row.suggestedEpicTitle || '');
    let best = null;
    let bestScore = 0;
    for (const e of boardEpics || []) {
      const title = e.title || e.summary || '';
      if (qKey && !epicMatchesFinancialQuarter(title, qKey)) continue;
      const jiraCanon = canonicalizeForMatch(title);
      const score = Math.max(
        titleSimilarity(suggCanon, jiraCanon),
        capS ? titleSimilarity(capS, capabilitySegment(title)) : 0,
      );
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (!best || bestScore < 0.38) return row;
    return {
      ...row,
      status: SLIDE_EPIC_STATUS.MATCHED,
      issueKey: best.issueKey,
      matchedTitle: best.title || best.summary,
      matchScore: bestScore,
      duplicateRisk: null,
      suggestedAction: SLIDE_SUGGESTED_ACTION.LINK,
      method: 'slide-board-link',
    };
  });
}

function issueKeysFromPlaybookEntry(playbookEntry = null) {
  const keys = new Set();
  const hay = [
    ...(playbookEntry?.duplicateSearchTerms || []),
    playbookEntry?.notes || '',
  ].join(' ');
  const m = hay.match(/\b[A-Z]{2,10}-\d+\b/g);
  if (m) for (const k of m) keys.add(k.toUpperCase());
  return keys;
}

export function findDuplicateRisk(suggestedTitle, epics = [], playbookEntry = null) {
  const searchTerms = playbookEntry?.duplicateSearchTerms || [];
  const programTerms = playbookEntry?.duplicatePrograms || [];
  const knownKeys = issueKeysFromPlaybookEntry(playbookEntry);
  const capNorm = normalizeJiraEpicTitle(suggestedTitle).split(' - ').pop() || '';
  const suggQ = quarterKey(suggestedTitle);

  for (const e of epics) {
    const rawTitle = String(e.title || e.summary || '');
    const title = rawTitle.toLowerCase();
    const jiraNorm = normalizeJiraEpicTitle(rawTitle);
    const hierCap = hierarchyTail(rawTitle);
    const epicKey = String(e.issueKey || '').toUpperCase();
    const sim = Math.max(
      titleSimilarity(suggestedTitle, rawTitle),
      titleSimilarity(normalizeJiraEpicTitle(suggestedTitle), jiraNorm),
    );

    if (knownKeys.has(epicKey)) {
      return {
        issueKey: epicKey,
        title: rawTitle,
        reason: `Playbook references existing epic (${epicKey})`,
        similarity: Math.max(sim, 0.9),
        suggestedAction: SLIDE_SUGGESTED_ACTION.LINK,
      };
    }

    const termHit = searchTerms.some((term) => {
      const tl = String(term).toLowerCase();
      if (ISSUE_KEY_IN_TERM_RE.test(tl)) return epicKey === tl.toUpperCase();
      return title.includes(tl)
        || jiraNorm.includes(tl.replace(/\s+/g, ' '))
        || hierCap.includes(tl.replace(/\s+/g, ' '));
    });
    const programHit = programTerms.some((term) => title.includes(String(term).toLowerCase()));
    const hierarchyHit = /dms\s*>\s*nba/i.test(rawTitle) && termHit;
    const crossQuarter = Boolean(
      capNorm
      && (title.includes(capNorm) || jiraNorm.includes(capNorm))
      && suggQ
      && !normalizeEpicTitle(rawTitle).includes(suggQ.toLowerCase()),
    );

    if (!termHit && !programHit && !crossQuarter && !hierarchyHit) continue;
    // 55% similarity threshold — above this, it's a likely duplicate that needs user decision.
    if (sim >= 0.55) {
      return {
        issueKey: e.issueKey,
        title: e.title || e.summary,
        reason: `55%+ match to existing epic (${e.issueKey}) — merge or create new?`,
        similarity: sim,
        suggestedAction: SLIDE_SUGGESTED_ACTION.REVIEW,
      };
    }
    // Below 55% but with term/program hits — lower confidence duplicate risk.

    let suggestedAction = SLIDE_SUGGESTED_ACTION.REVIEW;
    if (programHit) suggestedAction = SLIDE_SUGGESTED_ACTION.REVIEW;
    else if (sim >= 0.42 || termHit) suggestedAction = SLIDE_SUGGESTED_ACTION.LINK;

    return {
      issueKey: e.issueKey,
      title: e.title || e.summary,
      reason: programHit
        ? `Similar epic may live under DevSecOps (${e.issueKey})`
        : `Similar epic exists (${e.issueKey})`,
      similarity: sim,
      suggestedAction,
    };
  }
  return null;
}

export function resolveSlideCommitments({
  extracted = [],
  quarter = '',
  projects = [],
  boardEpics = [],
  jiraEpics = [],
  epicFormat = DEFAULT_EPIC_FORMAT,
  program = '',
  layout = 'roadmap',
  forceReview = false,
} = {}) {
  const qKey = quarterKey(quarter) || 'FY27 Q2';
  const squad = squadKey(projects);
  const playbook = playbookForProjects(projects, qKey);
  const allEpics = [...boardEpics, ...jiraEpics];
  const byTitle = new Map();

  for (const row of extracted) {
    const entry = findPlaybookEntry(row, playbook);
    // Normalize AI-generated titles to follow the org epic format.
    // The AI may produce "Q2–DMS–NBA–..." but the org format expects "FY27 Q2 – DMS – NBA – ...".
    const rawAiTitle = row.suggestedEpicTitle || '';
    const fyMatch = qKey.match(/^(FY\d{2}\s+Q\d)/i);
    const fyPrefix = fyMatch ? fyMatch[1] : qKey;
    const delim = epicFormat?.delimiter || ' – ';
    const needsNormalization = rawAiTitle && !rawAiTitle.match(/^FY\d{2}\s+Q\d/i);
    const normalizedAiTitle = needsNormalization && rawAiTitle
      ? rawAiTitle.replace(/^Q\d+/i, fyPrefix).replace(/\s*–\s*/g, delim)
      : rawAiTitle;
    const suggestedEpicTitle = resolveSuggestedEpicTitle({
      row,
      entry,
      qKey,
      squad,
      epicFormat,
      normalizedAiTitle,
      program: program || row.program || '',
    });

    const titleKey = normalizeEpicTitle(suggestedEpicTitle);
    const month = row.month || entry?.month || '';
    const targetDate = deriveTargetDate(month, qKey);
    const provenance = mapRagToProvenance(row.ragStatus || '');
    const rowMeta = {
      module: row.module || entry?.module || '',
      layout: row.layout || layout,
      program: program || row.program || '',
      ragStatus: row.ragStatus || '',
      slideProvenance: provenance,
    };

    if (byTitle.has(titleKey)) {
      const existing = byTitle.get(titleKey);
      existing.childStories = mergeChildStories(existing.childStories, entry?.childStories || []);
      if (!existing.month && month) existing.month = month;
      if (!existing.targetDate && targetDate) existing.targetDate = targetDate;
      if (entry?.notes && !existing.notes) existing.notes = entry.notes;
      if (provenance && !existing.slideProvenance) existing.slideProvenance = provenance;
      continue;
    }

    const match = forceReview
      ? null
      : findBestEpicMatch(suggestedEpicTitle, allEpics, SEMANTIC_MATCH_THRESHOLD, row.bullet || row.title || row.deliveryItem || '');
    let dupRisk = (!match && !forceReview) ? findDuplicateRisk(suggestedEpicTitle, allEpics, entry) : null;
    const shouldAutoLink = !forceReview && !match && dupRisk?.issueKey && (
      dupRisk.similarity >= 0.55
      || (entry && dupRisk.suggestedAction === SLIDE_SUGGESTED_ACTION.LINK)
    );
    if (shouldAutoLink) {
      const linkedEpic = allEpics.find((e) => String(e.issueKey).toUpperCase() === String(dupRisk.issueKey).toUpperCase())
        || { issueKey: dupRisk.issueKey, title: dupRisk.title };
      const linkScore = dupRisk.similarity;
      const linkTitle = dupRisk.title;
      dupRisk = null;
      byTitle.set(titleKey, {
        ...row,
        ...rowMeta,
        month,
        theme: row.theme || entry?.theme || '',
        suggestedEpicTitle,
        status: SLIDE_EPIC_STATUS.MATCHED,
        issueKey: linkedEpic.issueKey,
        matchedTitle: linkedEpic.title || linkedEpic.summary || linkTitle || '',
        matchScore: linkScore,
        duplicateRisk: null,
        childStories: entry?.childStories || [],
        notes: entry?.notes || row.notes || '',
        playbookApplied: Boolean(entry),
        targetDate,
        suggestedAction: SLIDE_SUGGESTED_ACTION.LINK,
        method: 'slide-semantic-link',
      });
      continue;
    }

    let status = SLIDE_EPIC_STATUS.MISSING;
    if (match) status = SLIDE_EPIC_STATUS.MATCHED;
    else if (dupRisk) status = SLIDE_EPIC_STATUS.DUPLICATE_RISK;

    let suggestedAction = match
      ? SLIDE_SUGGESTED_ACTION.LINK
      : (dupRisk?.suggestedAction || SLIDE_SUGGESTED_ACTION.CREATE);
    if (forceReview) suggestedAction = SLIDE_SUGGESTED_ACTION.REVIEW;

    byTitle.set(titleKey, {
      ...row,
      ...rowMeta,
      month,
      theme: row.theme || entry?.theme || '',
      suggestedEpicTitle,
      status,
      issueKey: match?.epic?.issueKey || dupRisk?.issueKey || '',
      matchedTitle: match?.epic?.title || dupRisk?.title || '',
      matchScore: match?.score || 0,
      duplicateRisk: dupRisk,
      childStories: entry?.childStories || [],
      notes: entry?.notes || row.notes || '',
      playbookApplied: Boolean(entry),
      targetDate,
      suggestedAction,
    });
  }

  return boostResolvedWithBoardEpics([...byTitle.values()], allEpics, qKey);
}

export function buildCreateWorkNarrative(resolved = []) {
  const lines = [];
  const missing = resolved.filter((r) => r.status === SLIDE_EPIC_STATUS.MISSING);
  const dupRisk = resolved.filter((r) => r.status === SLIDE_EPIC_STATUS.DUPLICATE_RISK);

  if (missing.length === 1 && (missing[0].childStories || []).length) {
    const row = missing[0];
    lines.push(row.suggestedEpicTitle);
    for (const story of row.childStories || []) {
      lines.push(`  ${story.title}`);
    }
  } else {
    for (const row of missing) {
      lines.push(row.suggestedEpicTitle);
      for (const story of row.childStories || []) {
        lines.push(`- ${story.title}`);
      }
    }
  }

  for (const row of dupRisk) {
    lines.push(`# Review before create: ${row.suggestedEpicTitle}`);
    lines.push(`  Possible duplicate: ${row.duplicateRisk?.issueKey || ''} ${row.duplicateRisk?.title || ''}`);
    if (row.notes) lines.push(`  ${row.notes}`);
  }

  return lines.filter(Boolean).join('\n');
}

export function toProposeRows(resolved = []) {
  const candidates = [];
  const unmatched = [];
  const duplicateRisk = [];

  for (const row of resolved) {
    const base = {
      title: row.suggestedEpicTitle,
      suggestedEpicTitle: row.suggestedEpicTitle,
      slideMatch: row,
      childStories: row.childStories || [],
      notes: row.notes || '',
      targetDate: row.targetDate || '',
      suggestedAction: row.suggestedAction || SLIDE_SUGGESTED_ACTION.CREATE,
      confidence: row.matchScore || (row.status === SLIDE_EPIC_STATUS.MISSING ? 0.3 : 0.5),
      selected: row.status === SLIDE_EPIC_STATUS.MATCHED,
    };

    if (row.status === SLIDE_EPIC_STATUS.MATCHED && row.issueKey) {
      candidates.push({ ...base, issueKey: row.issueKey, method: row.method || 'slide-playbook' });
    } else if (row.status === SLIDE_EPIC_STATUS.DUPLICATE_RISK && row.issueKey && (row.duplicateRisk?.similarity >= 0.55 || row.matchScore >= 0.55)) {
      candidates.push({
        ...base,
        issueKey: row.issueKey,
        method: 'slide-semantic-link',
        duplicateRisk: row.duplicateRisk,
        confidence: row.matchScore || row.duplicateRisk?.similarity || 0.55,
        selected: true,
      });
    } else if (row.status === SLIDE_EPIC_STATUS.DUPLICATE_RISK) {
      duplicateRisk.push({
        ...base,
        issueKey: row.issueKey || '',
        method: 'slide-duplicate-risk',
        duplicateRisk: row.duplicateRisk,
      });
      unmatched.push({
        ...base,
        issueKey: row.issueKey || '',
        method: 'slide-duplicate-risk',
        duplicateRisk: row.duplicateRisk,
      });
    } else {
      unmatched.push({ ...base, issueKey: '', method: 'slide-unmatched' });
    }
  }

  return { candidates, unmatched, duplicateRisk };
}

export function reconcileResolvedWithEpics(resolved = [], jiraEpics = [], boardEpics = [], options = {}) {
  const allEpics = [...boardEpics, ...jiraEpics];
  const playbook = options.playbook || [];
  const quarter = options.quarter || quarterKey(resolved[0]?.suggestedEpicTitle || '') || '';
  const next = (resolved || []).map((row) => {
    if (row.status === SLIDE_EPIC_STATUS.MATCHED && row.issueKey) return row;
    const entry = findPlaybookEntry(row, playbook);
    const match = findBestEpicMatch(
      row.suggestedEpicTitle,
      allEpics,
      SEMANTIC_MATCH_THRESHOLD,
      row.bullet || row.title || '',
    );
    if (match) {
      return {
        ...row,
        status: SLIDE_EPIC_STATUS.MATCHED,
        issueKey: match.epic.issueKey,
        matchedTitle: match.epic.title || match.epic.summary,
        matchScore: match.score,
        duplicateRisk: null,
        suggestedAction: SLIDE_SUGGESTED_ACTION.LINK,
        method: 'slide-reconciled',
      };
    }
    const dup = findDuplicateRisk(row.suggestedEpicTitle, allEpics, entry || {
      duplicateSearchTerms: [
        ...String(row.suggestedEpicTitle || '').split(EPIC_DELIM).slice(-1),
        ...(row.bullet || '').split(/\s+/).filter((w) => w.length > 3).slice(0, 4),
      ],
      duplicatePrograms: ['devsecops', 'devops'],
    });
    if (dup) {
      if (dup.similarity >= 0.55 || (entry && dup.suggestedAction === SLIDE_SUGGESTED_ACTION.LINK)) {
        return {
          ...row,
          status: SLIDE_EPIC_STATUS.MATCHED,
          issueKey: dup.issueKey,
          matchedTitle: dup.title,
          matchScore: dup.similarity,
          duplicateRisk: null,
          suggestedAction: SLIDE_SUGGESTED_ACTION.LINK,
          method: 'slide-semantic-link',
        };
      }
      return {
        ...row,
        status: SLIDE_EPIC_STATUS.DUPLICATE_RISK,
        issueKey: dup.issueKey,
        matchedTitle: dup.title,
        duplicateRisk: dup,
        suggestedAction: dup.suggestedAction,
      };
    }
    return {
      ...row,
      status: SLIDE_EPIC_STATUS.MISSING,
      issueKey: '',
      suggestedAction: SLIDE_SUGGESTED_ACTION.CREATE,
    };
  });
  return boostResolvedWithBoardEpics(next, allEpics, quarter);
}

export function linkResolvedToExisting(resolved = [], suggestedEpicTitle = '', issueKey = '', title = '') {
  const key = String(issueKey || '').toUpperCase();
  const titleNorm = normalizeEpicTitle(suggestedEpicTitle);
  return (resolved || []).map((row) => {
    if (normalizeEpicTitle(row.suggestedEpicTitle) !== titleNorm) return row;
    return {
      ...row,
      status: SLIDE_EPIC_STATUS.MATCHED,
      issueKey: key,
      matchedTitle: title || row.matchedTitle || row.duplicateRisk?.title || '',
      duplicateRisk: null,
      suggestedAction: SLIDE_SUGGESTED_ACTION.LINK,
      method: 'slide-linked',
      notes: row.notes || 'Linked from prior work — on-track continues',
    };
  });
}
