/**
 * SSOT: 3-tier PI baseline propose — board cache, Jira title/fix-version, AI validate, slide vision.
 */
import {
  collectEpicsFromPayloads,
  PARTIAL_EPIC_RE,
  scoreEpicName,
} from './Delivera-Governance-EpicHygiene-01Score-SSOT.js';
import {
  runStructuredAITask,
  runVisionAITask,
  AI_TASK_TYPES,
} from './Delivera-AI-Orchestrator-01Router-SSOT.js';
import { SLIDE_VISION_SYSTEM_PROMPT } from './Delivera-AI-Provider-TaskPrompts-01Helper.js';
import {
  emptyVisionResultError,
  visionProviderError,
} from './Delivera-AI-Vision-Provider-Error-01SSOT.js';
import {
  boardPayloadsFromBriefMeta,
  loadEpicActivityFromBriefCache,
  enrichCandidatesWithEpicActivity,
  enrichActivityFromJiraExistence,
} from './Delivera-Governance-PIBaseline-04Epic-Activity-Intelligence-SSOT.js';

const GOVERNANCE_NS = 'governanceBrief';
export const MAX_CANDIDATES = 42;
const QUARTER_RE = /Q[1-4]|FY\d{2}|PI\s*\d/i;

function normalizeProjects(projects = []) {
  return Array.from(new Set(
    (Array.isArray(projects) ? projects : []).map((p) => String(p || '').trim().toUpperCase()).filter(Boolean),
  ));
}

function epicMatchesQuarter(summary = '', quarter = '') {
  const t = String(summary || '').trim();
  if (!t) return false;
  if (PARTIAL_EPIC_RE.test(t)) {
    if (!quarter) return true;
    const qNorm = String(quarter).replace(/\s+/g, ' ').trim();
    return t.toUpperCase().includes(qNorm.toUpperCase().slice(0, 7));
  }
  if (quarter && QUARTER_RE.test(quarter)) {
    return QUARTER_RE.test(t);
  }
  return scoreEpicName(t) >= 40;
}

export function toCandidate(epic, method, extra = {}) {
  return {
    issueKey: epic.issueKey,
    title: epic.title || epic.summary || epic.issueKey,
    squad: epic.squad || epic.projectKey || String(epic.issueKey || '').split('-')[0],
    method,
    confidence: extra.confidence ?? scoreEpicName(epic.title || epic.summary) / 100,
    fixVersion: extra.fixVersion || '',
    selected: extra.selected !== false,
    slideMatch: extra.slideMatch || null,
  };
}

export function mergeCandidates(existing, incoming) {
  const byKey = new Map();
  for (const c of existing) {
    const k = String(c.issueKey || '').toUpperCase();
    if (k) byKey.set(k, c);
  }
  for (const c of incoming) {
    const k = String(c.issueKey || '').toUpperCase();
    if (!k) continue;
    const prev = byKey.get(k);
    if (!prev || (c.confidence || 0) > (prev.confidence || 0)) {
      byKey.set(k, { ...prev, ...c, issueKey: k });
    }
  }
  return [...byKey.values()].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
}

function rebuildBoardPayloadsFromBrief(brief, projects) {
  const pkSet = new Set(normalizeProjects(projects));
  let payloads = boardPayloadsFromBriefMeta(brief);
  if (pkSet.size) {
    payloads = payloads.filter((e) => {
      const pk = String(e?.board?.location?.projectKey || e?.board?.name || '').toUpperCase();
      return pkSet.has(pk);
    });
  }
  if (payloads.length) return payloads;
  const adHoc = brief?.meta?.adHocEpics || [];
  if (!adHoc.length) return [];
  const stories = adHoc
    .filter((e) => !pkSet.size || pkSet.has(String(e.issueKey || '').split('-')[0]))
    .map((e) => ({ epicKey: e.issueKey, epicSummary: e.summary, summary: e.summary }));
  return [{ board: { name: projects[0] || 'board' }, payload: { stories, sprint: { state: 'active' } } }];
}

/**
 * Tier 1: epics from cached governance brief (no extra Jira calls).
 */
export async function proposeFromBoardCache({ projects, cache, quarter = '' }) {
  const pks = normalizeProjects(projects);
  const candidates = [];
  let method = 'board-epics';

  for (const pk of pks.slice(0, 5)) {
    const cacheKey = `${GOVERNANCE_NS}:${pk}:e1:p1`;
    const cached = await cache.get(cacheKey, { namespace: GOVERNANCE_NS });
    const brief = cached?.value || cached;
    if (!brief) continue;

    const payloads = rebuildBoardPayloadsFromBrief(brief, pks);
    const epics = collectEpicsFromPayloads(payloads);
    for (const e of epics) {
      if (quarter && !epicMatchesQuarter(e.summary, quarter)) continue;
      candidates.push(toCandidate(
        { issueKey: e.issueKey, title: e.summary, squad: e.squad || pk },
        'board-epics',
        { confidence: scoreEpicName(e.summary) / 100 },
      ));
    }
  }

  if (!candidates.length && pks.length > 1) {
    const joined = await cache.get(`${GOVERNANCE_NS}:${pks.join(',')}:e1:p1`, { namespace: GOVERNANCE_NS });
    const brief = joined?.value || joined;
    if (brief) {
      const payloads = rebuildBoardPayloadsFromBrief(brief, pks);
      for (const e of collectEpicsFromPayloads(payloads)) {
        if (quarter && !epicMatchesQuarter(e.summary, quarter)) continue;
        candidates.push(toCandidate(
          { issueKey: e.issueKey, title: e.summary, squad: e.squad },
          'board-epics',
        ));
      }
    }
  }

  return { candidates: mergeCandidates([], candidates).slice(0, MAX_CANDIDATES), method };
}

/**
 * Tier 2: Jira epic search — title regex + fix version/label (portfolio-wide).
 */
export async function proposeFromJiraFallback({ projects, version3Client, quarter = '' }) {
  const pks = normalizeProjects(projects);
  const candidates = [];
  let method = 'manual';

  for (const pk of pks.slice(0, 5)) {
    try {
      const jql = `project = ${pk} AND issuetype = Epic ORDER BY updated DESC`;
      const resJira = await version3Client.issueSearch.searchForIssuesUsingJql({
        jql,
        maxResults: 50,
        fields: ['summary', 'status', 'fixVersions', 'labels'],
      });
      for (const issue of resJira?.issues || []) {
        const key = issue?.key || '';
        const summary = issue?.fields?.summary || '';
        const fvs = (issue?.fields?.fixVersions || []).map((v) => v?.name || '').filter(Boolean);
        const matchFv = fvs.find((n) => QUARTER_RE.test(n));
        const labels = issue?.fields?.labels || [];
        const matchLabel = labels.some((l) => QUARTER_RE.test(String(l)));
        const titleMatch = epicMatchesQuarter(summary, quarter);

        if (matchFv || matchLabel || titleMatch) {
          const m = matchFv ? 'fix-version' : matchLabel ? 'label' : 'epic-title';
          if (method === 'manual') method = m;
          candidates.push(toCandidate(
            { issueKey: key, title: summary, squad: pk },
            m,
            { fixVersion: matchFv || '', confidence: titleMatch ? 0.75 : 0.65 },
          ));
        }
      }
    } catch (_) { /* per-project fail */ }
  }

  const merged = mergeCandidates([], candidates).slice(0, MAX_CANDIDATES);
  return {
    candidates: merged,
    method: merged.length ? (merged[0].method || 'jira-mixed') : 'manual',
  };
}

export async function validateCandidatesWithAI(candidates, quarter, providerConfig) {
  const { provider, apiKey } = providerConfig || {};
  if (!candidates.length || provider === 'built-in' || !apiKey) return candidates;

  try {
    const { result, fallbackUsed } = await runStructuredAITask(
      AI_TASK_TYPES.PI_BASELINE_CLASSIFY,
      { candidates, quarter, allowedIssueKeys: candidates.map((c) => c.issueKey) },
      { providerConfig },
    );
    if (fallbackUsed) return candidates;
    const byKey = new Map((result.candidateItems || []).map((i) => [String(i.issueKey || '').toUpperCase(), i]));
    return candidates.map((c) => {
      const row = byKey.get(String(c.issueKey || '').toUpperCase());
      if (!row) return c;
      return {
        ...c,
        confidence: Math.min(1, Math.max(0, Number(row.confidence ?? c.confidence))),
        selected: row.classification === 'pi-commitment' || row.isPiCommitment !== false,
        method: `${c.method}+ai`,
      };
    }).filter((c) => c.selected !== false)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  } catch (_) {
    return candidates;
  }
}

/** Normalized token overlap similarity (0–1). */
function titleSimilarity(a = '', b = '') {
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
  const ta = new Set(norm(a));
  const tb = new Set(norm(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

export function matchSlideToEpics(extracted = [], boardEpics = []) {
  const matched = [];
  const unmatched = [];
  for (const row of extracted) {
    const label = [...new Set([row.theme, row.bullet, row.title].filter(Boolean))].join(' ');
    let best = null;
    let bestScore = 0;
    for (const e of boardEpics) {
      const score = titleSimilarity(label, e.title || e.summary);
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best && bestScore >= 0.35) {
      matched.push({
        ...toCandidate(best, 'slide-vision', { confidence: bestScore, slideMatch: row }),
        slideScore: bestScore,
      });
    } else {
      unmatched.push({
        issueKey: '',
        title: label.slice(0, 120),
        squad: '',
        method: 'slide-unmatched',
        confidence: 0.3,
        selected: false,
        slideMatch: row,
      });
    }
  }
  return {
    candidates: mergeCandidates([], matched),
    unmatched,
  };
}

export function parseSlideExtraction(rawText) {
  try {
    const cleaned = String(rawText || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const json = JSON.parse(cleaned);
    const items = Array.isArray(json.commitments) ? json.commitments : (Array.isArray(json.items) ? json.items : []);
    return {
      extracted: items.map((row) => ({
        month: String(row.month || '').trim(),
        theme: String(row.theme || row.category || '').trim(),
        bullet: String(row.bullet || row.title || row.name || '').trim(),
        title: String(row.title || row.bullet || '').trim(),
      })).filter((r) => r.bullet || r.title),
      parseError: null,
    };
  } catch (err) {
    return { extracted: [], parseError: String(err?.message || 'Invalid slide JSON') };
  }
}

export async function proposeFromSlideImage({
  imageBase64,
  mimeType = 'image/png',
  projects = [],
  quarter = '',
  providerConfig = {},
  boardEpics = [],
  squad = '',
}) {
  const { provider, apiKey } = providerConfig || {};
  if (!imageBase64) throw new Error('Image is required for slide extraction');
  if (!apiKey || provider === 'built-in') {
    throw new Error('AI API key required. Add key in Settings (stored in this browser only).');
  }
  if (provider === 'gemini') {
    throw new Error('Slide reading needs OpenAI, Claude, or OpenRouter. Change provider in Settings.');
  }

  // Filter board epics to only the specified squad when provided
  const filteredEpics = squad
    ? boardEpics.filter((e) => {
        const eSquad = String(e.squad || e.projectKey || '').toUpperCase();
        const eKey = String(e.issueKey || '').split('-')[0].toUpperCase();
        return eSquad === squad.toUpperCase() || eKey === squad.toUpperCase();
      })
    : boardEpics;

  const userText = `Extract all PI commitments from this slide for quarter ${quarter || 'current'}. Projects: ${projects.join(', ')}. Squad: ${squad || 'unspecified'}.`;
  const { result, fallbackUsed, error: providerError } = await runVisionAITask(
    AI_TASK_TYPES.PI_BASELINE_CLASSIFY,
    {
      imageBase64,
      mimeType,
      quarter,
      projects,
      systemPrompt: SLIDE_VISION_SYSTEM_PROMPT,
      userText,
    },
    { providerConfig },
  );
  if (fallbackUsed) throw visionProviderError(providerError || 'Vision provider fallback returned no trustworthy extraction.');

  const rawExtracted = result.commitments || result.extracted || [];
  const { extracted, parseError } = rawExtracted.length
    ? { extracted: rawExtracted, parseError: null }
    : parseSlideExtraction(JSON.stringify(result));
  if (!extracted.length) throw emptyVisionResultError();

  const { candidates, unmatched } = matchSlideToEpics(extracted, filteredEpics);
  const allRows = [...candidates, ...unmatched].slice(0, MAX_CANDIDATES);
  return {
    method: 'slide-vision',
    extracted,
    unmatched,
    parseError,
    candidates: allRows,
    aiContributed: !fallbackUsed,
    guidance: candidates.length
      ? (unmatched.length ? `${unmatched.length} slide item(s) need new epics in Jira.` : null)
      : (parseError ? `Could not read slide structure: ${parseError}` : 'Slide read — no Jira epic match.'),
  };
}

/**
 * Full propose pipeline for GET /propose.
 */
export async function runProposePipeline({
  projects,
  cache,
  version3Client,
  quarter = '',
  providerConfig = {},
}) {
  const pks = normalizeProjects(projects);
  let { candidates, method } = await proposeFromBoardCache({ projects: pks, cache, quarter });

  if (!candidates.length && version3Client) {
    const jira = await proposeFromJiraFallback({ projects: pks, version3Client, quarter });
    candidates = jira.candidates;
    method = jira.method;
  } else if (candidates.length) {
    method = 'board-epics';
  }

  if (candidates.length && providerConfig?.apiKey && providerConfig.provider !== 'built-in') {
    candidates = await validateCandidatesWithAI(candidates, quarter, providerConfig);
    if (method && !String(method).includes('ai')) method = `${method}+ai`;
  }

  if (candidates.length) {
    let activity = cache
      ? await loadEpicActivityFromBriefCache({ projects: pks, cache, namespace: GOVERNANCE_NS })
      : new Map();
    if (version3Client) {
      activity = await enrichActivityFromJiraExistence(candidates, activity, version3Client, 10);
    }
    candidates = enrichCandidatesWithEpicActivity(candidates, activity);
  }

  const boardEpicCount = candidates.filter((c) => String(c.method || '').includes('board')).length;
  let guidanceCode = null;
  let totalBoardEpics = 0;
  if (cache) {
    const unfiltered = await proposeFromBoardCache({ projects: pks, cache, quarter: '' });
    totalBoardEpics = (unfiltered.candidates || []).length;
  }
  if (!candidates.length) {
    guidanceCode = totalBoardEpics > 0 ? 'jira-unmatched' : 'no-board-epics';
  } else if (boardEpicCount === 0) {
    guidanceCode = 'jira-unmatched';
  } else if (quarter && totalBoardEpics > candidates.length) {
    guidanceCode = 'quarter-filter-empty';
  }

  return {
    method: candidates.length ? method : 'manual',
    candidates,
    guidanceCode,
    totalBoardEpics: totalBoardEpics || candidates.length,
    boardEpicCount: candidates.length,
    cached: false,
  };
}
