import { aiProviderEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';

/**
 * Resolve the AI provider config for a request.
 * Admin env vars take precedence; user-supplied header keys are used as fallback.
 *
 * @param {object} reqHeaders  - Request headers object (lowercased keys)
 * @returns {{ provider: string, apiKey: string, host: string }}
 */
export function resolveProviderConfig(reqHeaders = {}) {
  const headerProvider = String(reqHeaders['x-ai-provider'] || '').trim().toLowerCase();
  const headerKey = String(reqHeaders['x-ai-key'] || '').trim();
  const headerHost = String(reqHeaders['x-ai-host'] || '').trim();

  const envProvider = aiProviderEnvConfig.defaultProvider;
  const provider = (headerProvider && headerProvider !== 'built-in') ? headerProvider : envProvider;

  let apiKey = '';
  let host = '';

  switch (provider) {
    case 'claude':
      apiKey = aiProviderEnvConfig.claudeApiKey || headerKey;
      break;
    case 'openai':
      apiKey = aiProviderEnvConfig.openaiApiKey || headerKey;
      break;
    case 'gemini':
      apiKey = aiProviderEnvConfig.geminiApiKey || headerKey;
      break;
    case 'openrouter':
      apiKey = aiProviderEnvConfig.openrouterApiKey || headerKey;
      break;
    case 'ollama':
      host = aiProviderEnvConfig.ollamaHost || headerHost || 'http://localhost:11434';
      break;
    default:
      break;
  }

  return { provider: provider || 'built-in', apiKey, host };
}

/**
 * Parse a narrative using the configured AI provider.
 * Falls back to the built-in parser on any provider error.
 *
 * @param {string} narrative
 * @param {object} context  - { projectKey, boardStyleProfile, quarterHint }
 * @param {object} providerConfig  - From resolveProviderConfig()
 * @param {Function} builtInFn  - Async function to call when provider = 'built-in' or on fallback
 * @returns {Promise<object>} Draft payload
 */
export async function parseViaNarrative(narrative, context, providerConfig, builtInFn) {
  const { provider, apiKey, host } = providerConfig;
  if (provider === 'built-in' || (!apiKey && !host && provider !== 'ollama')) {
    return builtInFn();
  }
  try {
    const result = await dispatchToProvider(narrative, context, provider, apiKey, host);
    return result;
  } catch (err) {
    console.warn(`[AI-Gateway] ${provider} failed (${err?.message}), falling back to built-in`);
    const fallback = await builtInFn();
    return { ...fallback, _aiProviderFallback: true, _aiProviderError: String(err?.message || '') };
  }
}

/**
 * Test whether a provider config is valid (cheap handshake).
 * Returns { valid: boolean, error?: string }
 */
export async function testProviderConfig(provider, apiKey, host) {
  try {
    switch (provider) {
      case 'claude':
        return await testClaudeKey(apiKey);
      case 'openai':
        return await testOpenAiKey(apiKey);
      case 'gemini':
        return await testGeminiKey(apiKey);
      case 'openrouter':
        return await testOpenRouterKey(apiKey);
      case 'ollama':
        return await testOllamaHost(host);
      default:
        return { valid: true };
    }
  } catch (err) {
    return { valid: false, error: String(err?.message || 'Unknown error') };
  }
}

// ─── Governance brief narration (evidence-bound, advisor role) ─────────────────

const ISSUE_KEY_RE = /\b[A-Z][A-Z0-9]+-\d+\b/g;

/** Every issue key the advisor is allowed to mention, from the contract. */
function collectAllowedKeys(contract) {
  const keys = new Set();
  const add = (k) => { const v = String(k || '').trim().toUpperCase(); if (v) keys.add(v); };
  for (const r of (Array.isArray(contract?.risks) ? contract.risks : [])) add(r.issueKey);
  for (const r of (Array.isArray(contract?.topRisks) ? contract.topRisks : [])) add(r.issueKey);
  const dk = contract?.deliveryTruthKeys || {};
  for (const arr of Object.values(dk)) for (const k of (Array.isArray(arr) ? arr : [])) add(k);
  return keys;
}

function buildBriefSystemPrompt(contract) {
  return `You are a Vodacom delivery-governance writer. You convert a STRUCTURED FACT CONTRACT into a short leadership narrative. \
You are an advisor refining wording only - you must not invent facts, owners, dates, counts, or issue keys.

Hard rules:
- Use ONLY information present in the fact contract JSON provided.
- You may reference an issue key ONLY if it appears in the contract. Never fabricate a key.
- Do not invent numbers; restate the counts as given.
- Keep it leadership-ready: clear, plain English, no jargon, no blame language.

Output ONLY valid JSON, no markdown fences:
{
  "headline": "one sentence",
  "oneParagraph": "3-5 sentences",
  "decisionsNeeded": [ { "issueKey": "KEY", "decisionNeededFrom": "role", "action": "imperative" } ]
}

Allowed issue keys: ${Array.from(collectAllowedKeys(contract)).join(', ') || '(none)'}`;
}

function buildBriefUserPrompt(contract) {
  const slim = {
    portfolio: contract?.portfolio,
    period: contract?.period,
    confidence: contract?.leadershipNarrative?.confidence,
    freshness: contract?.freshness,
    deliveryTruth: contract?.deliveryTruth,
    topRisks: (contract?.topRisks || []).map((r) => ({
      issueKey: r.issueKey, riskType: r.riskType, evidence: r.evidence,
      owner: r.owner, decisionNeededFrom: r.decisionNeededFrom, recommendedAction: r.recommendedAction,
    })),
  };
  return `Fact contract:\n\n${JSON.stringify(slim, null, 2)}`;
}

function parseBriefResponse(rawText, allowedKeys) {
  let json;
  try {
    const cleaned = String(rawText || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    json = JSON.parse(cleaned);
  } catch (_) {
    throw new Error('Advisor returned non-JSON narration');
  }
  const headline = String(json?.headline || '').trim();
  const oneParagraph = String(json?.oneParagraph || '').trim();
  if (!headline || !oneParagraph) throw new Error('Advisor narration missing headline/paragraph');
  // Evidence binding: every key mentioned must exist in the contract.
  const mentioned = `${headline} ${oneParagraph} ${JSON.stringify(json?.decisionsNeeded || [])}`.match(ISSUE_KEY_RE) || [];
  for (const k of mentioned) {
    if (!allowedKeys.has(k.toUpperCase())) throw new Error(`Advisor referenced unknown issue key ${k}`);
  }
  const decisionsNeeded = (Array.isArray(json?.decisionsNeeded) ? json.decisionsNeeded : [])
    .map((d) => ({
      issueKey: String(d?.issueKey || '').trim().toUpperCase(),
      decisionNeededFrom: String(d?.decisionNeededFrom || '').trim(),
      action: String(d?.action || '').trim(),
    }))
    .filter((d) => !d.issueKey || allowedKeys.has(d.issueKey));
  return { headline, oneParagraph, decisionsNeeded };
}

async function dispatchBriefToProvider(contract, provider, apiKey, host) {
  const system = buildBriefSystemPrompt(contract);
  const user = buildBriefUserPrompt(contract);
  let rawText = '';
  switch (provider) {
    case 'claude': rawText = await callClaude(system, user, apiKey); break;
    case 'openai': rawText = await callOpenAi(system, user, apiKey); break;
    case 'gemini': rawText = await callGemini(system, user, apiKey); break;
    case 'openrouter': rawText = await callOpenRouter(system, user, apiKey); break;
    case 'ollama': rawText = await callOllama(system, user, host); break;
    default: throw new Error(`Unknown provider: ${provider}`);
  }
  return parseBriefResponse(rawText, collectAllowedKeys(contract));
}

/**
 * Narrate the brief via the optional advisor, validating every claim against the
 * contract. Falls back to the template narrative on ANY error or validation fail.
 * @param {object} contract enriched fact contract
 * @param {object} providerConfig from resolveProviderConfig()
 * @param {Function} templateFn () => template narrative (always works)
 * @returns {Promise<object>} narrative with narratedBy: 'advisor' | 'template'
 */
export async function narrateBriefViaProvider(contract, providerConfig, templateFn) {
  const { provider, apiKey, host } = providerConfig || {};
  if (!provider || provider === 'built-in' || (!apiKey && !host && provider !== 'ollama')) {
    return templateFn();
  }
  try {
    const advisor = await dispatchBriefToProvider(contract, provider, apiKey, host);
    const base = templateFn();
    return {
      confidence: base.confidence,
      headline: advisor.headline,
      oneParagraph: advisor.oneParagraph,
      decisionsNeeded: advisor.decisionsNeeded.length ? advisor.decisionsNeeded : base.decisionsNeeded,
      narratedBy: 'advisor',
    };
  } catch (err) {
    console.warn(`[Brief-Narrator] ${provider} failed (${err?.message}), falling back to template`);
    const fallback = templateFn();
    return { ...fallback, _advisorError: String(err?.message || '') };
  }
}

// ─── Provider dispatch ────────────────────────────────────────────────────────

async function dispatchToProvider(narrative, context, provider, apiKey, host) {
  const systemPrompt = buildSystemPrompt(context);
  const userPrompt = buildUserPrompt(narrative);
  let rawText = '';
  switch (provider) {
    case 'claude':
      rawText = await callClaude(systemPrompt, userPrompt, apiKey);
      break;
    case 'openai':
      rawText = await callOpenAi(systemPrompt, userPrompt, apiKey);
      break;
    case 'gemini':
      rawText = await callGemini(systemPrompt, userPrompt, apiKey);
      break;
    case 'openrouter':
      rawText = await callOpenRouter(systemPrompt, userPrompt, apiKey);
      break;
    case 'ollama':
      rawText = await callOllama(systemPrompt, userPrompt, host);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
  return parseProviderResponse(rawText, narrative);
}

// ─── Prompt construction ──────────────────────────────────────────────────────

function buildSystemPrompt(context = {}) {
  const projectKey = String(context.projectKey || '').toUpperCase();
  const boardSummary = context.boardStyleProfile
    ? `\n\nActive project context:\n${JSON.stringify(context.boardStyleProfile, null, 2).slice(0, 2000)}`
    : '';
  const quarterHint = context.quarterHint ? `\nCurrent quarter: ${context.quarterHint}` : '';
  return `You are a work planning assistant for a software delivery team using Jira. \
Your job is to parse a brain dump narrative into structured Jira work items.${quarterHint}

Output ONLY valid JSON with this schema:
{
  "rows": [
    {
      "title": "string (concise, action-oriented, <180 chars)",
      "type": "Epic | Story | Task | Note | Ignore",
      "depth": 0,
      "confidence": 0.0-1.0,
      "warnings": ["string"],
      "isParent": true
    }
  ],
  "rationale": "string"
}

Rules:
- type "Epic" = major outcome or goal (depth 0, isParent true)
- type "Story" = deliverable work item (depth 1 under an Epic)
- type "Task" = small technical task (depth 1 under a Story)
- type "Note" = context/comment, not a Jira issue
- type "Ignore" = non-work line (chat noise, personal note)
- confidence < 0.5 means you are uncertain about type, parent, or intent
- warnings are actionable — explain what is unclear
- do not invent requirements not in the narrative
- output only valid JSON, no markdown fences${boardSummary}

Project key: ${projectKey || '(use context)'}`;
}

function buildUserPrompt(narrative) {
  return `Parse this narrative into work items:\n\n${narrative}`;
}

// ─── Response parsing ─────────────────────────────────────────────────────────

function parseProviderResponse(rawText, _narrative) {
  let json;
  try {
    const cleaned = String(rawText || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    json = JSON.parse(cleaned);
  } catch (_) {
    throw new Error('AI provider returned non-JSON response');
  }
  if (!json || !Array.isArray(json.rows)) throw new Error('AI provider response missing "rows" array');
  const rows = json.rows.map((row, idx) => ({
    id: `ai-${idx}`,
    title: String(row.title || '').trim().slice(0, 180),
    type: String(row.type || 'Story'),
    depth: Number(row.depth ?? (row.isParent ? 0 : 1)),
    isParent: !!row.isParent,
    confidence: Math.min(1, Math.max(0, Number(row.confidence ?? 0.7))),
    warnings: (Array.isArray(row.warnings) ? row.warnings : []).map((w) => String(w)).filter(Boolean),
    childItemIndex: idx,
    selected: String(row.type || '').toLowerCase() !== 'ignore',
    duplicate: null,
  })).filter((row) => row.title);
  return { rows, rationale: String(json.rationale || ''), _aiProvider: true };
}

// ─── Claude ──────────────────────────────────────────────────────────────────

export async function callClaude(system, user, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Claude API error ${res.status}`);
  }
  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

async function testClaudeKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No API key provided' };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
  });
  if (res.status === 401) return { valid: false, error: 'Invalid API key' };
  return { valid: res.ok || res.status === 400 };
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

export async function callOpenAi(system, user, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI API error ${res.status}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function testOpenAiKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No API key provided' };
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (res.status === 401) return { valid: false, error: 'Invalid API key' };
  return { valid: res.ok };
}

// ─── OpenRouter (OpenAI-compatible) ───────────────────────────────────────────

export async function callOpenRouter(system, user, apiKey) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://delivera.local',
      'X-Title': 'Delivera',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenRouter API error ${res.status}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

async function testOpenRouterKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No API key provided' };
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (res.status === 401 || res.status === 403) return { valid: false, error: 'Invalid API key' };
  return { valid: res.ok };
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

export async function callGemini(system, user, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error ${res.status}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function testGeminiKey(apiKey) {
  if (!apiKey) return { valid: false, error: 'No API key provided' };
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (res.status === 400 || res.status === 403) return { valid: false, error: 'Invalid API key' };
  return { valid: res.ok };
}

// ─── Vision (PI slide / plan images) ─────────────────────────────────────────

export async function callClaudeVision(system, userText, imageBase64, mimeType, apiKey) {
  const media = String(mimeType || 'image/png').split(';')[0].trim() || 'image/png';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: media, data: imageBase64 },
          },
          { type: 'text', text: userText },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Claude vision error ${res.status}`);
  }
  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

export async function callOpenAiVision(system, userText, imageBase64, mimeType, apiKey) {
  const media = String(mimeType || 'image/png').split(';')[0].trim() || 'image/png';
  const dataUrl = `data:${media};base64,${imageBase64}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI vision error ${res.status}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ─── Ollama ───────────────────────────────────────────────────────────────────

async function callOllama(system, user, host) {
  const base = String(host || 'http://localhost:11434').replace(/\/$/, '');
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.2',
      format: 'json',
      stream: false,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const data = await res.json();
  return data?.message?.content || '';
}

async function testOllamaHost(host) {
  const base = String(host || 'http://localhost:11434').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return { valid: res.ok };
  } catch (_) {
    return { valid: false, error: 'Ollama not reachable at ' + base };
  }
}
