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

function rankDuplicateAction(bestEpic, bestOpenStory, completedHit) {
  const out = {
    suggestedAction: 'createNew',
    primaryReason: 'none',
    epic: bestEpic,
    story: bestOpenStory,
    completedRecently: completedHit && completedHit.similarity >= 0.68 ? completedHit : null,
  };
  if (bestEpic && bestEpic.similarity >= 0.72) {
    out.suggestedAction = 'attachToExistingEpic';
    out.primaryReason = 'epic_match';
  } else if (bestOpenStory && bestOpenStory.similarity >= 0.78) {
    out.suggestedAction = 'mergeIntoExistingStory';
    out.primaryReason = 'story_match';
  }
  return out;
}

async function fetchCandidatePool(version3Client, projectKey) {
  const jql = `project = ${projectKey} AND updated >= -90d ORDER BY updated DESC`;
  try {
    const res = await version3Client.issueSearch.searchForIssuesUsingJqlPost({
      jql,
      maxResults: 40,
      fields: ['summary', 'issuetype', 'status', 'statusCategory', 'resolutiondate'],
    });
    return Array.isArray(res?.issues) ? res.issues : [];
  } catch (_) {
    return [];
  }
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
  const precheck = truncated
    ? { key: OUTCOME_PRECHECK_KEYS.TRUNCATED, message: getPrecheckMessageByKey(OUTCOME_PRECHECK_KEYS.TRUNCATED) }
    : pickPrecheckMessage(narrative, inputMode);

  const readinessWarnings = buildReadinessWarnings(narrative, profile || {}, quarterHint);
  const epicHint = suggestEpicTitleFromProfile(parsed, profile || {}, narrative);

  let pool = [];
  if (version3Client && projectKey) {
    pool = await fetchCandidatePool(version3Client, projectKey);
  }

  const rows = [];
  const previewRows = parsed.previewRows || [];

  previewRows.forEach((pr, index) => {
    const title = String(pr.title || '').trim();
    if (!title) return;
    const parentChild = parsed.structureMode === OUTCOME_STRUCTURE_MODE.EPIC_WITH_STORIES
      || parsed.structureMode === OUTCOME_STRUCTURE_MODE.STORY_WITH_SUBTASKS;
    const childItemIndex = parentChild && index > 0 ? index - 1 : (parentChild ? null : index);
    const bestEpic = scorePoolAgainstTitle(pool, title, { epicOnly: true });
    const bestOpenStory = scorePoolAgainstTitle(pool, title, { epicOnly: false, openOnly: true });
    const completedHit = scorePoolAgainstTitle(pool, title, { epicOnly: false, doneOnly: true });
    const dup = rankDuplicateAction(bestEpic, bestOpenStory, completedHit);

    const warnings = [];
    if (dup.completedRecently) {
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

    const confidence = Number(parsed.confidenceScore || 0);
    const lowConfidence = confidence < 0.45 || (parsed.structureMode === OUTCOME_STRUCTURE_MODE.EPIC_WITH_STORIES && index > 0 && confidence < 0.55);
    if (lowConfidence) warnings.push({ code: 'LOW_CONFIDENCE', message: 'Low structure confidence — review before commit.' });

    rows.push({
      id: `r${index}`,
      index,
      childItemIndex,
      kind: pr.kind || 'ISSUE',
      title,
      description: pr.description || '',
      epicHint: pr.kind === 'EPIC' || (index === 0 && parsed.structureMode === OUTCOME_STRUCTURE_MODE.EPIC_WITH_STORIES) ? epicHint : epicHint,
      jiraKeys: pr.jiraKeys || [],
      labels: pr.labels || [],
      confidence,
      confidenceLabel: parsed.confidenceLabel,
      duplicate: {
        suggestedAction: dup.suggestedAction,
        primaryReason: dup.primaryReason,
        epicCandidate: dup.epic || null,
        storyCandidate: dup.story || null,
        completedRecently: dup.completedRecently,
      },
      warnings,
      selected: true,
    });
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
    rows,
    profileMeta: {
      degraded: !!profile?.degraded,
      degradeReason: profile?.degradeReason || '',
      sampleCounts: profile?.sampleCounts || {},
    },
  };
}
