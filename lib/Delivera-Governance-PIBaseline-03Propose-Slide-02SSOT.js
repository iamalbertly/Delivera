/**
 * SSOT: PI baseline propose tier 3 — slide vision extraction.
 */
import { runVisionAITask, AI_TASK_TYPES } from './Delivera-AI-Orchestrator-01Router-SSOT.js';
import {
  resolveSlideCommitments,
  toProposeRows,
  searchJiraEpicsForResolved,
  buildCreateWorkNarrative,
} from './Delivera-Governance-PIBaseline-05Slide-Epic-Resolver-SSOT.js';
import { squadKey } from './Delivera-Governance-PIBaseline-05Slide-Playbook-01SSOT.js';
import { MAX_CANDIDATES } from './Delivera-Governance-PIBaseline-03Propose-Board-01SSOT.js';
import { loadEpicFormatConfig } from './Delivera-Governance-Epic-Format-01Store-IO.js';
import { slideVisionNamingRule, DEFAULT_EPIC_FORMAT } from './Delivera-Governance-Epic-Format-01SSOT.js';
import { SLIDE_VISION_SYSTEM_PROMPT } from './Delivera-AI-Provider-TaskPrompts-01Helper.js';

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
      squad: String(json.squad || json.squadName || '').trim(),
      quarter: String(json.quarter || json.period || '').trim(),
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

  const userText = `Extract all PI commitments from this slide for quarter ${quarter || 'current'}. Projects: ${projects.join(', ')}.`;
  const epicFormat = await loadEpicFormatConfig();
  const namingLine = slideVisionNamingRule(epicFormat);
  const systemPrompt = SLIDE_VISION_SYSTEM_PROMPT.replace(
    /Naming rule for suggestedEpicTitle:.*Do not invent/s,
    `${namingLine}\nDo not invent`,
  );
  const { result, fallbackUsed } = await runVisionAITask(
    AI_TASK_TYPES.PI_SLIDE_VISION,
    {
      imageBase64,
      mimeType,
      quarter,
      projects,
      userText,
      systemPrompt,
    },
    { providerConfig },
  );

  const rawExtracted = result.commitments || result.extracted || [];
  const parsed = rawExtracted.length
    ? { extracted: rawExtracted, squad: String(result.squad || '').trim(), quarter: String(result.quarter || '').trim(), parseError: null }
    : parseSlideExtraction(JSON.stringify(result));

  const extracted = parsed.extracted.map((row) => ({
    ...row,
    suggestedEpicTitle: row.suggestedEpicTitle || row.suggestedEpic || '',
  }));

  const inferredSquadRaw = String(parsed.squad || result.squad || '').trim();
  const inferredSquad = inferredSquadRaw
    ? inferredSquadRaw.toUpperCase().replace(/\s+SQUAD$/i, '')
    : squadKey(projects);
  const inferredQuarter = String(parsed.quarter || result.quarter || quarter || '').trim() || quarter;
  const scopeSquad = squadKey(projects);
  const slideScopeMismatch = Boolean(inferredSquadRaw && inferredSquad !== scopeSquad);
  const suggestedScope = slideScopeMismatch && inferredSquad === 'DMS' ? 'SD' : null;
  const commitmentCount = extracted.length;

  let jiraEpics = [];
  if (version3Client) {
    const preResolved = resolveSlideCommitments({
      extracted,
      quarter: inferredQuarter,
      projects,
      boardEpics,
      jiraEpics: [],
      epicFormat,
    });
    jiraEpics = await searchJiraEpicsForResolved(version3Client, preResolved, projects);
  }

  const resolved = resolveSlideCommitments({
    extracted,
    quarter: inferredQuarter,
    projects,
    boardEpics,
    jiraEpics,
    epicFormat,
  });
  const { candidates: playbookCandidates, unmatched, duplicateRisk } = toProposeRows(resolved);

  const createWorkNarrative = buildCreateWorkNarrative(resolved);
  const matchedCount = resolved.filter((r) => r.status === 'matched').length;
  const missingCount = resolved.filter((r) => r.status === 'missing').length;
  const allRows = [...playbookCandidates, ...unmatched].slice(0, MAX_CANDIDATES);

  return {
    method: 'slide-vision',
    extracted,
    resolved,
    unmatched,
    duplicateRisk,
    createWorkNarrative,
    matchedCount,
    missingCount,
    parseError: parsed.parseError,
    candidates: allRows,
    aiContributed: !fallbackUsed,
    inferredSquad,
    inferredQuarter,
    slideScopeMismatch,
    guidance: commitmentCount
      ? (playbookCandidates.length
        ? (unmatched.length ? `${unmatched.length} slide item(s) need new epics in Jira.` : null)
        : (parsed.parseError ? `Could not read slide structure: ${parsed.parseError}` : 'Slide read — review commitments below.'))
      : (parsed.parseError
        ? `Could not read slide structure: ${parsed.parseError}`
        : (fallbackUsed ? 'Could not read commitments from slide — check AI key or retry.' : 'Slide read — no commitments detected.')),
    extractionMeta: {
      aiContributed: !fallbackUsed,
      fallbackUsed,
      parseError: parsed.parseError,
      commitmentCount,
    },
    suggestedScope,
  };
}
