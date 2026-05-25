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
      case 'ollama':
        return await testOllamaHost(host);
      default:
        return { valid: true };
    }
  } catch (err) {
    return { valid: false, error: String(err?.message || 'Unknown error') };
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

async function callClaude(system, user, apiKey) {
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

async function callOpenAi(system, user, apiKey) {
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

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function callGemini(system, user, apiKey) {
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
