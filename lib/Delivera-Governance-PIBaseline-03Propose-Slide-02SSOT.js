/**
 * SSOT: PI baseline propose tier 3 — slide vision extraction.
 * Supports roadmap (month×theme) and ambition-table (module + delivery plan) layouts.
 */
import { runVisionAITask, AI_TASK_TYPES } from './Delivera-AI-Orchestrator-01Router-SSOT.js';
import {
  resolveSlideCommitments,
  toProposeRows,
  searchJiraEpicsForResolved,
  buildCreateWorkNarrative,
} from './Delivera-Governance-PIBaseline-05Slide-Epic-Resolver-SSOT.js';
import { squadKey, playbookForProjects, quarterKey } from './Delivera-Governance-PIBaseline-05Slide-Playbook-01SSOT.js';
import { MAX_CANDIDATES } from './Delivera-Governance-PIBaseline-03Propose-Board-01SSOT.js';
import { loadEpicFormatConfig } from './Delivera-Governance-Epic-Format-01Store-IO.js';
import {
  slideVisionNamingRule,
  resolveSquadAlias,
  DEFAULT_EPIC_FORMAT,
} from './Delivera-Governance-Epic-Format-01SSOT.js';
import { SLIDE_VISION_SYSTEM_PROMPT } from './Delivera-AI-Provider-TaskPrompts-01Helper.js';

const LOW_CONFIDENCE_MIN_ITEMS = 3;

/**
 * Infer the quarter from context when the AI didn't return one.
 * Parses patterns like "q2fy27", "fy27q2", "Q2 FY27" from the quarter string
 * or project context. Returns "" if no match.
 */
export function inferQuarterFromContext(projects = [], quarter = '') {
  const haystack = `${quarter} ${projects.join(' ')}`.toLowerCase();
  const m = haystack.match(/q([1-4])\s*fy\s*(\d{2,4})/) || haystack.match(/fy\s*(\d{2,4})\s*q([1-4])/);
  if (m) {
    const q = m[1].length === 1 ? m[1] : m[2];
    const fy = m[1].length === 1 ? m[2] : m[1];
    const fyShort = fy.length === 4 ? fy.slice(-2) : fy;
    return `FY${fyShort} Q${q}`;
  }
  return '';
}

/** Normalize RAG / status text from ambition-table slides. */
export function normalizeRagStatus(raw = '') {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  if (/deliver/.test(s) || s === 'complete' || s === 'done') return 'delivered';
  if (/progress|on\s*track|yellow/.test(s)) return 'in-progress';
  if (/off\s*track|red|risk|blocked/.test(s)) return 'off-track';
  return s.slice(0, 40);
}

function inferMonthFromTimeline(timeline = '') {
  const t = String(timeline || '').trim();
  const m = t.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i);
  return m ? m[1] : t;
}

function titleCaseWords(text = '') {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length <= 2 && /^(itp|rfi|3rd)$/i.test(w) ? w.toUpperCase() : (w.charAt(0).toUpperCase() + w.slice(1))))
    .join(' ');
}

/**
 * Expand ambition-table module rows (with deliveryPlan[]) into one commitment per delivery item.
 * Already-flat deliveryItem rows pass through.
 */
export function normalizeAmbitionTableRows(rows = [], meta = {}) {
  const program = String(meta.program || '').trim();
  const programKey = program.replace(/\s+/g, '').toUpperCase() || '';
  const out = [];
  for (const row of rows || []) {
    const moduleName = String(row.module || row.theme || '').trim();
    const month = inferMonthFromTimeline(row.month || row.timeline || '');
    const plans = Array.isArray(row.deliveryPlan) && row.deliveryPlan.length
      ? row.deliveryPlan
      : null;
    if (plans) {
      for (const item of plans) {
        const itemObj = typeof item === 'string' ? { item } : (item || {});
        const deliveryItem = String(itemObj.item || itemObj.name || itemObj.bullet || item || '').trim();
        if (!deliveryItem) continue;
        const ragStatus = normalizeRagStatus(itemObj.ragStatus || itemObj.status || row.ragStatus || '');
        out.push({
          layout: 'ambition-table',
          month,
          theme: moduleName,
          module: moduleName,
          deliveryItem,
          program,
          ragStatus,
          bullet: deliveryItem,
          title: deliveryItem,
          notes: String(row.notes || row.ambition || row.how || '').trim(),
          suggestedEpicTitle: String(row.suggestedEpicTitle || '').trim(),
        });
      }
      continue;
    }
    const deliveryItem = String(row.deliveryItem || row.bullet || row.title || '').trim();
    if (!deliveryItem && !moduleName) continue;
    out.push({
      layout: 'ambition-table',
      month,
      theme: moduleName || String(row.theme || '').trim(),
      module: moduleName,
      deliveryItem: deliveryItem || moduleName,
      program,
      ragStatus: normalizeRagStatus(row.ragStatus),
      bullet: deliveryItem || moduleName,
      title: deliveryItem || moduleName,
      notes: String(row.notes || '').trim(),
      suggestedEpicTitle: String(row.suggestedEpicTitle || row.suggestedEpic || '').trim(),
      programKey,
    });
  }
  return out;
}

export function detectSlideLayout(result = {}, extracted = []) {
  const explicit = String(result.layout || '').toLowerCase();
  if (explicit === 'ambition-table' || explicit === 'ambition_table') return 'ambition-table';
  if (explicit === 'roadmap') return 'roadmap';
  const hasModule = extracted.some((r) => r.module || (Array.isArray(r.deliveryPlan) && r.deliveryPlan.length));
  const hasProgram = Boolean(result.program || result.projectName);
  if (hasModule || hasProgram) return 'ambition-table';
  return 'roadmap';
}

export function parseSlideExtraction(rawText) {
  try {
    const cleaned = String(rawText || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const json = JSON.parse(cleaned);
    const items = Array.isArray(json.commitments) ? json.commitments : (Array.isArray(json.items) ? json.items : []);
    const layout = detectSlideLayout(json, items);
    const mapped = items.map((row) => ({
      month: String(row.month || row.timeline || '').trim(),
      theme: String(row.theme || row.category || row.module || '').trim(),
      module: String(row.module || '').trim(),
      deliveryItem: String(row.deliveryItem || '').trim(),
      deliveryPlan: Array.isArray(row.deliveryPlan) ? row.deliveryPlan : [],
      ragStatus: String(row.ragStatus || row.status || '').trim(),
      bullet: String(row.bullet || row.deliveryItem || row.title || row.name || '').trim(),
      title: String(row.title || row.bullet || row.deliveryItem || '').trim(),
      notes: String(row.notes || row.ambition || row.how || '').trim(),
      suggestedEpicTitle: String(row.suggestedEpicTitle || row.suggestedEpic || '').trim(),
    }));
    let extracted = mapped.filter((r) => r.bullet || r.title || r.module || r.deliveryPlan.length);
    if (layout === 'ambition-table') {
      extracted = normalizeAmbitionTableRows(extracted, {
        program: json.program || json.projectName || '',
      });
    }
    return {
      extracted,
      layout,
      squad: String(json.squad || json.squadName || '').trim(),
      squadNickname: String(json.squadNickname || json.nickname || '').trim(),
      program: String(json.program || json.projectName || '').trim(),
      quarter: String(json.quarter || json.period || '').trim(),
      parseError: null,
      lowConfidence: layout === 'ambition-table' && extracted.length < LOW_CONFIDENCE_MIN_ITEMS,
    };
  } catch (err) {
    return {
      extracted: [],
      layout: 'roadmap',
      parseError: String(err?.message || 'Invalid slide JSON'),
      lowConfidence: true,
    };
  }
}

function resolveSuggestedScope(inferredSquad, scopeSquad) {
  if (!inferredSquad || inferredSquad === scopeSquad) return null;
  if (inferredSquad === 'DMS') return 'SD';
  if (inferredSquad === 'FIN') return 'FIN';
  return inferredSquad;
}

export async function proposeFromSlideImage({
  imageBase64,
  mimeType = 'image/png',
  projects = [],
  quarter = '',
  providerConfig = {},
  boardEpics = [],
  version3Client = null,
}) {
  const { provider, apiKey } = providerConfig || {};
  if (!imageBase64) throw new Error('Image is required for slide extraction');
  if (!apiKey || provider === 'built-in') {
    throw new Error('AI API key required. Add key in Settings (stored in this browser only).');
  }
  if (provider === 'gemini') {
    throw new Error('Slide reading needs OpenAI, Claude, or OpenRouter. Change provider in Settings.');
  }

  const userText = `Extract all PI commitments from this slide for quarter ${quarter || 'current'}. Projects: ${projects.join(', ')}. Detect roadmap vs ambition-table layout.`;
  const epicFormat = await loadEpicFormatConfig();
  const namingLine = slideVisionNamingRule(epicFormat);
  const systemPrompt = SLIDE_VISION_SYSTEM_PROMPT.replace(
    /Naming rule for suggestedEpicTitle:.*Do not invent/s,
    `${namingLine}\nDo not invent`,
  );
  const { result, fallbackUsed, error: visionError } = await runVisionAITask(
    AI_TASK_TYPES.PI_SLIDE_VISION,
    {
      imageBase64,
      mimeType,
      quarter,
      projects,
      userText,
      systemPrompt,
    },
    { providerConfig, runId: `slide-${Date.now()}` },
  );

  const rawExtracted = result.commitments || result.extracted || [];
  let parsed;
  if (rawExtracted.length) {
    const layout = detectSlideLayout(result, rawExtracted);
    let extracted = rawExtracted.map((row) => ({
      ...row,
      suggestedEpicTitle: row.suggestedEpicTitle || row.suggestedEpic || '',
    }));
    if (layout === 'ambition-table') {
      extracted = normalizeAmbitionTableRows(extracted, {
        program: result.program || result.projectName || '',
      });
    }
    parsed = {
      extracted,
      layout,
      squad: String(result.squad || '').trim(),
      squadNickname: String(result.squadNickname || '').trim(),
      program: String(result.program || result.projectName || '').trim(),
      quarter: String(result.quarter || '').trim(),
      parseError: null,
      lowConfidence: layout === 'ambition-table' && extracted.length < LOW_CONFIDENCE_MIN_ITEMS,
    };
  } else {
    parsed = parseSlideExtraction(JSON.stringify(result));
  }

  const extracted = parsed.extracted;
  const layout = parsed.layout || 'roadmap';
  const program = parsed.program || String(result.program || '').trim();

  const inferredSquadRaw = String(parsed.squad || result.squad || parsed.squadNickname || '').trim();
  const inferredSquad = inferredSquadRaw
    ? resolveSquadAlias(inferredSquadRaw)
    : squadKey(projects);
  const inferredQuarter = String(parsed.quarter || result.quarter || quarter || '').trim()
    || inferQuarterFromContext(projects, quarter);
  const scopeSquad = squadKey(projects);
  const slideScopeMismatch = Boolean(inferredSquadRaw && inferredSquad !== scopeSquad);
  const suggestedScope = slideScopeMismatch ? resolveSuggestedScope(inferredSquad, scopeSquad) : null;
  const commitmentCount = extracted.length;
  const lowConfidence = Boolean(parsed.lowConfidence)
    || (layout === 'ambition-table' && commitmentCount < LOW_CONFIDENCE_MIN_ITEMS);
  const qKey = quarterKey(inferredQuarter) || 'FY27 Q2';
  const resolveProjects = suggestedScope
    ? [suggestedScope, ...projects.filter((p) => String(p).toUpperCase() !== suggestedScope)]
    : projects;
  const playbook = playbookForProjects(resolveProjects, qKey);

  let jiraEpics = [];
  if (version3Client) {
    const preResolved = resolveSlideCommitments({
      extracted,
      quarter: inferredQuarter,
      projects: resolveProjects,
      boardEpics,
      jiraEpics: [],
      epicFormat,
      program,
      layout,
      forceReview: lowConfidence,
    });
    jiraEpics = await searchJiraEpicsForResolved(version3Client, preResolved, resolveProjects, {
      quarter: inferredQuarter,
      playbook,
    });
  }

  const resolved = resolveSlideCommitments({
    extracted,
    quarter: inferredQuarter,
    projects: resolveProjects,
    boardEpics,
    jiraEpics,
    epicFormat,
    program,
    layout,
    forceReview: lowConfidence,
  });
  const { candidates: playbookCandidates, unmatched, duplicateRisk } = toProposeRows(resolved);

  const createWorkNarrative = buildCreateWorkNarrative(resolved);
  const matchedCount = resolved.filter((r) => r.status === 'matched').length;
  const missingCount = resolved.filter((r) => r.status === 'missing').length;
  const allRows = [...playbookCandidates, ...unmatched].slice(0, MAX_CANDIDATES);

  const layoutLabel = layout === 'ambition-table'
    ? `Ambition table${program ? ` · ${program}` : ''} · ${commitmentCount} commitments`
    : `Roadmap · ${commitmentCount} commitments`;

  return {
    method: 'slide-vision',
    layout,
    program,
    layoutLabel,
    lowConfidence,
    extracted,
    resolved,
    unmatched,
    duplicateRisk,
    createWorkNarrative,
    matchedCount,
    missingCount,
    matcherPoolSize: boardEpics.length + jiraEpics.length,
    parseError: parsed.parseError,
    candidates: allRows,
    aiContributed: !fallbackUsed,
    inferredSquad,
    inferredQuarter,
    slideScopeMismatch,
    squadNickname: parsed.squadNickname || '',
    guidance: lowConfidence
      ? 'Low confidence read — verify every commitment before creating.'
      : (commitmentCount
        ? (playbookCandidates.length
          ? (unmatched.length ? `${unmatched.length} slide item(s) need new epics in Jira.` : null)
          : (parsed.parseError ? `Could not read slide structure: ${parsed.parseError}` : 'Slide read — review commitments below.'))
        : (parsed.parseError
          ? `Could not read slide structure: ${parsed.parseError}`
          : (fallbackUsed
            ? (apiKey
              ? (visionError
                ? `Slide read failed: ${visionError}`
                : 'Slide read timed out or returned no text — retry or upload a clearer image.')
              : 'No AI key set — add one in Settings to read slides.')
            : 'Slide read — no readable text detected. Upload a clearer export.'))),
    extractionMeta: {
      aiContributed: !fallbackUsed,
      fallbackUsed,
      parseError: parsed.parseError,
      commitmentCount,
      visionError: visionError || null,
      layout,
      program,
      lowConfidence,
    },
    suggestedScope,
  };
}

export { titleCaseWords, LOW_CONFIDENCE_MIN_ITEMS };
