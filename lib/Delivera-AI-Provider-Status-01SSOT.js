/**
 * SSOT: server-side AI provider readiness (env + optional request headers).
 */
import { aiProviderEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';
import { resolveProviderConfig } from './Delivera-AI-Provider-Gateway.js';

const VISION_PROVIDERS = new Set(['openai', 'claude', 'openrouter']);

function providerLabel(provider) {
  if (provider === 'openrouter') return 'OpenRouter';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'claude') return 'Claude';
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'ollama') return 'Ollama';
  return 'Built-in templates';
}

/**
 * @param {object} [reqHeaders]
 * @returns {{ provider: string, label: string, configured: boolean, slideVisionReady: boolean, source: string }}
 */
export function buildAiProviderStatus(reqHeaders = {}) {
  const resolved = resolveProviderConfig(reqHeaders || {});
  const envProvider = aiProviderEnvConfig.defaultProvider || 'built-in';
  const provider = resolved.provider || 'built-in';
  const hasKey = Boolean(resolved.apiKey) || provider === 'ollama';
  const configured = provider !== 'built-in' && hasKey;
  const slideVisionReady = configured && VISION_PROVIDERS.has(provider);
  const envHasKey = Boolean(
    aiProviderEnvConfig.openrouterApiKey
    || aiProviderEnvConfig.openaiApiKey
    || aiProviderEnvConfig.claudeApiKey
    || aiProviderEnvConfig.geminiApiKey,
  );
  const source = configured && envHasKey && provider === envProvider ? 'server' : (configured ? 'browser' : 'none');

  return {
    provider,
    label: providerLabel(provider),
    configured,
    slideVisionReady,
    source,
  };
}
