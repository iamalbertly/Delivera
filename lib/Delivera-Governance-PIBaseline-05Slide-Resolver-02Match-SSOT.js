/**
 * SSOT: Slide commitment matching, duplicate risk, reconcile, narrative.
 */
import {
  EPIC_DELIM,
  buildCanonicalEpicTitle,
  commitmentLabel,
  deriveTargetDate,
  findPlaybookEntry,
  mergeChildStories,
  normalizeEpicTitle,
  playbookForProjects,
  quarterKey,
  squadKey,
} from './Delivera-Governance-PIBaseline-05Slide-Playbook-01SSOT.js';
import { DEFAULT_EPIC_FORMAT } from './Delivera-Governance-Epic-Format-01SSOT.js';

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

function titleSimilarity(a = '', b = '') {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
  const ta = new Set(norm(a));
  const tb = new Set(norm(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

function findBestEpicMatch(suggestedTitle, epics = [], minScore = 0.55) {
  let best = null;
  let bestScore = 0;
  for (const e of epics) {
    const title = e.title || e.summary || '';
    const score = Math.max(
      titleSimilarity(suggestedTitle, title),
      titleSimilarity(normalizeEpicTitle(suggestedTitle), normalizeEpicTitle(title)),
    );
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  if (best && bestScore >= minScore) return { epic: best, score: bestScore };
  return null;
}

export function findDuplicateRisk(suggestedTitle, epics = [], playbookEntry = null) {
  const searchTerms = playbookEntry?.duplicateSearchTerms || [];
  const programTerms = playbookEntry?.duplicatePrograms || [];
  const capNorm = normalizeEpicTitle(suggestedTitle).split(' - ').pop() || '';
  const suggQ = quarterKey(suggestedTitle);

  for (const e of epics) {
    const title = String(e.title || e.summary || '').toLowerCase();
    const sim = titleSimilarity(suggestedTitle, e.title || e.summary);
    const termHit = searchTerms.some((term) => title.includes(String(term).toLowerCase()));
    const programHit = programTerms.some((term) => title.includes(String(term).toLowerCase()));
    const crossQuarter = Boolean(
      capNorm
      && title.includes(capNorm)
      && suggQ
      && !normalizeEpicTitle(e.title || e.summary).includes(suggQ.toLowerCase()),
    );

    if (!termHit && !programHit && !crossQuarter) continue;
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
    const suggestedEpicTitle = normalizedAiTitle
      || entry?.epicTitle
      || buildCanonicalEpicTitle({
        quarter: qKey,
        program: squad,
        system: epicFormat?.defaultSubsystem || 'NBA',
        capability: commitmentLabel(row).slice(0, 80) || 'Product Goal',
      }, epicFormat);

    const titleKey = normalizeEpicTitle(suggestedEpicTitle);
    const month = row.month || entry?.month || '';
    const targetDate = deriveTargetDate(month, qKey);

    if (byTitle.has(titleKey)) {
      const existing = byTitle.get(titleKey);
      existing.childStories = mergeChildStories(existing.childStories, entry?.childStories || []);
      if (!existing.month && month) existing.month = month;
      if (!existing.targetDate && targetDate) existing.targetDate = targetDate;
      if (entry?.notes && !existing.notes) existing.notes = entry.notes;
      continue;
    }

    const match = findBestEpicMatch(suggestedEpicTitle, allEpics);
    const dupRisk = !match ? findDuplicateRisk(suggestedEpicTitle, allEpics, entry) : null;

    let status = SLIDE_EPIC_STATUS.MISSING;
    if (match) status = SLIDE_EPIC_STATUS.MATCHED;
    else if (dupRisk) status = SLIDE_EPIC_STATUS.DUPLICATE_RISK;

    const suggestedAction = match
      ? SLIDE_SUGGESTED_ACTION.LINK
      : (dupRisk?.suggestedAction || SLIDE_SUGGESTED_ACTION.CREATE);

    byTitle.set(titleKey, {
      ...row,
      month,
      theme: row.theme || entry?.theme || '',
      suggestedEpicTitle,
      status,
      issueKey: match?.epic?.issueKey || dupRisk?.issueKey || '',
      matchedTitle: match?.epic?.title || dupRisk?.title || '',
      matchScore: match?.score || 0,
      duplicateRisk: dupRisk,
      childStories: entry?.childStories || [],
      notes: entry?.notes || '',
      playbookApplied: Boolean(entry),
      targetDate,
      suggestedAction,
    });
  }

  return [...byTitle.values()];
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
      candidates.push({ ...base, issueKey: row.issueKey, method: 'slide-playbook' });
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

export function reconcileResolvedWithEpics(resolved = [], jiraEpics = [], boardEpics = []) {
  const allEpics = [...boardEpics, ...jiraEpics];
  return (resolved || []).map((row) => {
    if (row.status === SLIDE_EPIC_STATUS.MATCHED && row.issueKey) return row;
    const match = findBestEpicMatch(row.suggestedEpicTitle, allEpics);
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
    const dup = findDuplicateRisk(row.suggestedEpicTitle, allEpics, {
      duplicateSearchTerms: String(row.suggestedEpicTitle || '').split(EPIC_DELIM).slice(-1),
      duplicatePrograms: ['devsecops', 'devops', 'evod', 'vop'],
    });
    if (dup) {
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
