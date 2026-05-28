/**
 * Server-authoritative outcome draft (phase 1): parse + profile hints + readiness + dedupe signals.
 * No Jira writes. Shared precheck/readiness logic for POST /api/outcome-draft.
 */

import { parseOutcomeIntake, OUTCOME_STRUCTURE_MODE } from '../public/Delivera-Shared-Outcome-Intake-Parser.js';
import {
  pickPrecheckMessage,
  detectInputSignals,
  OUTCOME_PRECHECK_KEYS,
  getPrecheckMessageByKey,
} from './Delivera-Outcome-Precheck-Messages.js';
import { combinedTextSimilarity } from './Delivera-Outcome-Similarity-01Core.js';

const QUARTER_RE = /\b(fy\s*\d{2}\s*q[1-4]|q[1-4]\s*['']?\s*\d{2,4})\b/i;
const AC_RE = /\b(acceptance|given|when|then|criteria)\b/i;
const OWNER_RE = /\b(po|product owner|chapter|business owner|stakeholder)\b/i;

function buildIssueUrl(host, issueKey) {
  return host && issueKey ? `${String(host).replace(/\/+$/, '')}/browse/${issueKey}` : '';
}

export function buildReadinessWarnings(rawText, profile, quarterHint = '') {
  const text = String(rawText || '').trim();
  const warnings = [];
  const qInText = QUARTER_RE.test(text);
  const qCtx = String(quarterHint || '').trim().length > 0;
  if (!qInText && !qCtx) {
    warnings.push({ code: 'MISSING_QUARTER', message: 'No quarter label detected — confirm quarter before commit if your squad uses quarter epics.' });
  }
  const acronymsInText = (text.match(/\b[A-Z]{2,5}\b/g) || []).filter((w) => w.length >= 2);
  const top = new Set((profile?.topAcronyms || []).map((a) => String(a).toUpperCase()));
  const hasSystem = acronymsInText.some((a) => top.has(a.toUpperCase()));
  if (!hasSystem && text.length > 20) {
    warnings.push({ code: 'MISSING_SYSTEM', message: 'No known system acronym from this board matched — add NBA, DMS, etc. if relevant.' });
  }
  if (!OWNER_RE.test(text) && text.length > 30) {
    warnings.push({ code: 'MISSING_OWNER_CONTEXT', message: 'No PO or business owner mentioned — optional for grooming.' });
  }
  if (!AC_RE.test(text) && text.length > 40) {
    warnings.push({ code: 'MISSING_ACCEPTANCE_HINT', message: 'No acceptance-style hints detected — refine before estimation if needed.' });
  }
  const sig = detectInputSignals(text);
  if (sig.mixed) {
    warnings.push({ code: 'PLANNED_VS_SUPPORT', message: 'Planned and support-style phrases mixed — review split rows before commit.' });
  }
  return warnings;
}

function bestDelimiter(profile) {
  const d = profile?.delimiterBias || {};
  if (d.pipe >= d.dash && d.pipe >= d.emdash && d.pipe > 0) return ' | ';
  if (d.emdash >= d.dash && d.emdash > 0) return ' – ';
  return ' - ';
}

function suggestEpicTitleFromProfile(parsed, profile, rawText) {
  const base = parsed?.epic?.title || 'Outcome from narrative';
  const samples = profile?.epicTitleSamples || [];
  if (samples.length && QUARTER_RE.test(samples[0])) {
    const m = rawText.match(QUARTER_RE);
    const q = m ? m[0].replace(/\s+/g, ' ').toUpperCase() : '';
    const ac = (profile.topAcronyms || [])[0] || '';
    const sep = bestDelimiter(profile);
    if (q && ac) return `${q}${sep}${ac}${sep}${base.slice(0, 80)}`;
  }
  return base;
}

function rankDuplicateAction(bestEpic, bestOpenStory, completedHit, titleLength = 0) {
  // Short titles produce noisy similarity — require higher confidence for titles under 20 chars
  const shortTitle = titleLength > 0 && titleLength < 20;
  const doneThreshold = shortTitle ? 0.72 : 0.55;
  const openThreshold = shortTitle ? 0.82 : 0.65;
  const epicThreshold = shortTitle ? 0.80 : 0.65;
  const completedMatch = completedHit && completedHit.similarity >= doneThreshold ? completedHit : null;
  const out = {
    suggestedAction: 'createNew',
    primaryReason: 'none',
    epic: bestEpic,
    story: bestOpenStory,
    completedRecently: completedMatch,
    key: null,
    similarity: null,
    isDoneMatch: false,
  };
  if (completedMatch && completedMatch.similarity >= doneThreshold) {
    // Done item is the strongest signal — block creation by default
    out.suggestedAction = 'skipAlreadyDone';
    out.primaryReason = 'done_match';
    out.key = completedMatch.key;
    out.similarity = completedMatch.similarity;
    out.isDoneMatch = true;
  } else if (bestEpic && bestEpic.similarity >= epicThreshold) {
    out.suggestedAction = 'attachToExistingEpic';
    out.primaryReason = 'epic_match';
    out.key = bestEpic.key;
    out.similarity = bestEpic.similarity;
  } else if (bestOpenStory && bestOpenStory.similarity >= openThreshold) {
    out.suggestedAction = 'mergeIntoExistingStory';
    out.primaryReason = 'story_match';
    out.key = bestOpenStory.key;
    out.similarity = bestOpenStory.similarity;
  } else if (bestOpenStory && bestOpenStory.similarity >= 0.45) {
    // Fuzzy warning: not high enough to block but worth flagging
    out.suggestedAction = 'reviewSimilar';
    out.primaryReason = 'fuzzy_match';
    out.key = bestOpenStory.key;
    out.similarity = bestOpenStory.similarity;
  }
  return out;
}

async function fetchCandidatePool(version3Client, projectKey) {
  const fields = ['summary', 'issuetype', 'status', 'statusCategory', 'resolutiondate', 'assignee'];
  const [recentRes, doneRes] = await Promise.allSettled([
    version3Client.issueSearch.searchForIssuesUsingJqlPost({
      jql: `project = ${projectKey} AND updated >= -90d ORDER BY updated DESC`,
      maxResults: 60,
      fields,
    }),
    version3Client.issueSearch.searchForIssuesUsingJqlPost({
      jql: `project = ${projectKey} AND statusCategory = Done AND updated >= -365d ORDER BY updated DESC`,
      maxResults: 60,
      fields,
    }),
  ]);
  const recent = recentRes.status === 'fulfilled' ? (recentRes.value?.issues || []) : [];
  const done = doneRes.status === 'fulfilled' ? (doneRes.value?.issues || []) : [];
  // Merge, deduplicate by key — recent-window entries take precedence
  const seen = new Set(recent.map((i) => i.key));
  return [...recent, ...done.filter((i) => !seen.has(i.key))];
}

function scorePoolAgainstTitle(pool, title, { epicOnly = false, doneOnly = false, openOnly = false }) {
  let best = null;
  pool.forEach((issue) => {
    const typeName = String(issue?.fields?.issuetype?.name || '');
    const isEpic = /epic|initiative|theme/i.test(typeName) && !issue?.fields?.issuetype?.subtask;
    const isSub = issue?.fields?.issuetype?.subtask === true;
    if (epicOnly && !isEpic) return;
    if (!epicOnly && isSub) return;
    const cat = String(issue?.fields?.status?.statusCategory?.key || '').toLowerCase();
    if (doneOnly && cat !== 'done') return;
    if (openOnly && cat === 'done') return;
    const sum = String(issue?.fields?.summary || '');
    const sim = combinedTextSimilarity(title, sum);
    if (!best || sim > best.similarity) {
      best = { key: issue.key, summary: sum, similarity: sim, statusCategory: cat };
    }
  });
  return best;
}

export async function buildOutcomeDraft({
  rawNarrative,
  projectKey,
  boardId = null,
  inputMode = 'mixed',
  quarterHint = '',
  version3Client,
  host = '',
  profile = null,
}) {
  const MAX = 10000;
  let narrative = String(rawNarrative || '').trim();
  let truncated = false;
  if (narrative.length > MAX) {
    narrative = narrative.slice(0, MAX);
    truncated = true;
  }

  const parsed = parseOutcomeIntake(narrative);
  const looksQuarterlyEpicBatch = parsed.structureMode === OUTCOME_STRUCTURE_MODE.MULTIPLE_EPICS
    && (parsed.previewRows || []).length >= 3
    && (parsed.previewRows || []).every((row) => QUARTER_RE.test(String(row?.title || '')));
  const precheck = truncated
    ? { key: OUTCOME_PRECHECK_KEYS.TRUNCATED, message: getPrecheckMessageByKey(OUTCOME_PRECHECK_KEYS.TRUNCATED) }
    : (looksQuarterlyEpicBatch
      ? { key: 'quarterly_epic_batch', message: 'Quarterly epic batch detected — each line is treated as a top-level epic.' }
      : (parsed.structureMode === OUTCOME_STRUCTURE_MODE.SEQUENTIAL_TASK_CLUSTER
        ? { key: 'sequential_task_cluster', message: 'Numbered task list — each step becomes a flat sprint-ready task.' }
        : pickPrecheckMessage(narrative, inputMode)));

  const readinessWarnings = buildReadinessWarnings(narrative, profile || {}, quarterHint);
  const epicHint = suggestEpicTitleFromProfile(parsed, profile || {}, narrative);

  let pool = [];
  if (version3Client && projectKey) {
    pool = await fetchCandidatePool(version3Client, projectKey);
  }

  // Acronym coherence: fraction of preview rows that contain a known board acronym
  const topAcronymSet = new Set((profile?.topAcronyms || []).map((a) => String(a).toUpperCase()));
  const previewRowsForAcronym = parsed.previewRows || [];
  const acronymMatchCount = previewRowsForAcronym.filter((row) =>
    (String(row.title || '').match(/\b[A-Z]{2,5}\b/g) || []).some((a) => topAcronymSet.has(a))
  ).length;
  const acronymCoherenceRatio = previewRowsForAcronym.length > 0
    ? acronymMatchCount / previewRowsForAcronym.length : 0;
  const coherenceBoost = acronymCoherenceRatio >= 0.5 ? 0.20 : (acronymCoherenceRatio >= 0.3 ? 0.10 : 0);

  // Assignee inference: tally most common assignee per board acronym from pool history
  const assigneeAcronymTally = {};
  pool.forEach((issue) => {
    const assigneeName = issue?.fields?.assignee?.displayName;
    if (!assigneeName) return;
    (String(issue?.fields?.summary || '').match(/\b[A-Z]{2,5}\b/g) || [])
      .filter((a) => topAcronymSet.has(a))
      .forEach((a) => {
        if (!assigneeAcronymTally[a]) assigneeAcronymTally[a] = {};
        assigneeAcronymTally[a][assigneeName] = (assigneeAcronymTally[a][assigneeName] || 0) + 1;
      });
  });
  const topAssigneeByAcronym = Object.fromEntries(
    Object.entries(assigneeAcronymTally).map(([a, counts]) => [
      a, Object.entries(counts).sort((x, y) => y[1] - x[1])[0]?.[0],
    ])
  );

  // Sprint capacity fit: estimate avg items per sprint (pool covers ~3 sprints / 90 days)
  const sprintCapacityAvg = pool.length >= 10 ? Math.round(pool.length / 3) : null;

  const rows = [];
  const previewRows = parsed.previewRows || [];
  const seenTitles = new Set();

  previewRows.forEach((pr, index) => {
    const title = String(pr.title || '').trim();
    if (!title) return;
    const normalizedTitle = title.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    const parentChild = parsed.structureMode === OUTCOME_STRUCTURE_MODE.EPIC_WITH_STORIES
      || parsed.structureMode === OUTCOME_STRUCTURE_MODE.STORY_WITH_SUBTASKS;
    const childItemIndex = parentChild && index > 0 ? index - 1 : (parentChild ? null : index);
    const bestEpic = scorePoolAgainstTitle(pool, title, { epicOnly: true });
    const bestOpenStory = scorePoolAgainstTitle(pool, title, { epicOnly: false, openOnly: true });
    const completedHit = scorePoolAgainstTitle(pool, title, { epicOnly: false, doneOnly: true });
    const dup = rankDuplicateAction(bestEpic, bestOpenStory, completedHit, title.length);

    // Per-row similarity boost: board history confirms this type of work
    const simBoost = (bestOpenStory?.similarity >= 0.45 ? 0.15 : 0)
      + (completedHit?.similarity >= 0.5 ? 0.10 : 0);

    // Assignee inference: find best match from board acronym history
    const rowAcronyms = (String(title).match(/\b[A-Z]{2,5}\b/g) || []).filter((a) => topAcronymSet.has(a));
    const suggestedAssignee = rowAcronyms.map((a) => topAssigneeByAcronym[a]).filter(Boolean)[0] || null;

    const warnings = [];
    if (seenTitles.has(normalizedTitle)) {
      warnings.push({
        code: 'DUPLICATE_LINE_IN_INPUT',
        message: 'This line duplicates another line in your draft and will be unselected by default.',
      });
    }
    if (dup.suggestedAction === 'skipAlreadyDone' && dup.completedRecently) {
      warnings.push({
        code: 'ALREADY_DONE',
        message: `Already done: ${dup.completedRecently.key} (${Math.round(dup.completedRecently.similarity * 100)}% match)`,
        url: buildIssueUrl(host, dup.completedRecently.key),
      });
    } else if (dup.completedRecently) {
      warnings.push({
        code: 'COMPLETED_RECENTLY',
        message: `Similar work completed recently: ${dup.completedRecently.key}`,
        url: buildIssueUrl(host, dup.completedRecently.key),
      });
    }
    if (dup.suggestedAction === 'attachToExistingEpic' && dup.epic) {
      warnings.push({
        code: 'DUPLICATE_EPIC',
        message: `Near-duplicate epic: ${dup.epic.key} — prefer attach.`,
        url: buildIssueUrl(host, dup.epic.key),
      });
    }
    if (dup.suggestedAction === 'mergeIntoExistingStory' && dup.primaryReason === 'story_match' && dup.story) {
      warnings.push({
        code: 'DUPLICATE_STORY',
        message: `Similar open issue: ${dup.story.key}`,
        url: buildIssueUrl(host, dup.story.key),
      });
    }
    if (dup.suggestedAction === 'reviewSimilar' && dup.key) {
      warnings.push({
        code: 'FUZZY_MATCH',
        message: `Similar item in backlog: ${dup.key} (${Math.round((dup.similarity || 0))}% match) — review before creating`,
        url: buildIssueUrl(host, dup.key),
      });
    }

    const baseConfidence = Math.min(1, Number(parsed.confidenceScore || 0) + coherenceBoost);
    const rowConfidence = Math.min(1, baseConfidence + simBoost);
    const lowConfidence = rowConfidence < 0.45 || (parsed.structureMode === OUTCOME_STRUCTURE_MODE.EPIC_WITH_STORIES && index > 0 && rowConfidence < 0.55);
    if (lowConfidence) warnings.push({ code: 'LOW_CONFIDENCE', message: 'Low structure confidence — review before commit.' });

    // Map issueType to canvas chip type: Task→T, Epic→E, Sub-task→T, else S
    const issueTypeChip = pr.issueType === 'Task' || pr.issueType === 'Sub-task' ? 'T'
      : pr.issueType === 'Epic' ? 'E' : null;

    rows.push({
      id: `r${index}`,
      index,
      childItemIndex,
      kind: pr.kind || 'ISSUE',
      issueType: pr.issueType || null,
      type: issueTypeChip,
      title,
      description: pr.description || '',
      epicHint,
      jiraKeys: pr.jiraKeys || [],
      labels: pr.labels || [],
      confidence: rowConfidence,
      confidenceLabel: parsed.confidenceLabel,
      suggestedAssignee,
      duplicate: {
        suggestedAction: dup.suggestedAction,
        primaryReason: dup.primaryReason,
        key: dup.key || null,
        similarity: dup.similarity != null ? Math.round(dup.similarity * 100) : null,
        isDoneMatch: dup.isDoneMatch === true,
        url: dup.key ? buildIssueUrl(host, dup.key) : null,
        epicCandidate: dup.epic || null,
        storyCandidate: dup.story || null,
        completedRecently: dup.completedRecently,
      },
      warnings,
      selected: !seenTitles.has(normalizedTitle),
    });
    seenTitles.add(normalizedTitle);
  });

  const supportEpic = (profile?.supportEpicCandidates || [])[0] || null;
  const supportBias = inputMode === 'support' || detectInputSignals(narrative).supportBias;
  if (supportBias && supportEpic) {
    rows.forEach((r) => {
      if (r.kind === 'STORY' && !r.jiraKeys?.length) {
        r.duplicate.supportBucketEpicKey = supportEpic.key;
        r.duplicate.supportBucketSummary = supportEpic.summary;
        r.warnings.push({
          code: 'SUPPORT_ROUTE',
          message: `Support-style item — default route under ${supportEpic.key}.`,
          url: buildIssueUrl(host, supportEpic.key),
        });
      }
    });
  }

  const capacityFitHint = sprintCapacityAvg !== null && previewRows.length > 0 && previewRows.length <= sprintCapacityAvg * 1.5
    ? `${previewRows.length} item${previewRows.length === 1 ? '' : 's'} fits your team's sprint pattern (~${sprintCapacityAvg}/sprint based on recent history).`
    : null;

  return {
    ok: true,
    phase: 1,
    projectKey: String(projectKey || '').toUpperCase(),
    boardId: boardId != null ? Number(boardId) : null,
    inputMode,
    narrative: narrative,
    structureMode: parsed.structureMode,
    parsedSummary: {
      rationale: parsed.rationale,
      confidenceScore: parsed.confidenceScore,
      confidenceLabel: parsed.confidenceLabel,
    },
    precheck,
    readinessWarnings,
    epicHintDefault: epicHint,
    capacityFitHint,
    rows,
    profileMeta: {
      degraded: !!profile?.degraded,
      degradeReason: profile?.degradeReason || '',
      sampleCounts: profile?.sampleCounts || {},
    },
  };
}
