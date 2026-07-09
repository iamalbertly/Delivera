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

function envOnlyConfig() {
  return resolveProviderConfig({});
}

/**
 * @param {object} [reqHeaders]
 * @returns {{ provider: string, label: string, configured: boolean, slideVisionReady: boolean, source: string, slideVision: object, visionModelWarning: string|null }}
 */
export function buildAiProviderStatus(reqHeaders = {}) {
  const resolved = resolveProviderConfig(reqHeaders || {});
  const envResolved = envOnlyConfig();
  const envProvider = aiProviderEnvConfig.defaultProvider || 'built-in';
  const provider = resolved.provider || 'built-in';
  const hasKey = Boolean(resolved.apiKey) || provider === 'ollama';
  const configured = provider !== 'built-in' && hasKey;
  const slideVisionReady = configured && VISION_PROVIDERS.has(provider);
  const source = resolved.source || 'none';

  const visionModelWarning = (provider === 'openrouter' && !aiProviderEnvConfig.openrouterModelVision)
    ? 'OPENROUTER_MODEL_VISION unset — using governance model for slide reading'
    : null;

  return {
    provider,
    label: providerLabel(provider),
    configured,
    slideVisionReady,
    source,
    slideVision: {
      ready: slideVisionReady,
      provider,
      source,
      envProvider,
      envReady: Boolean(envResolved.apiKey) && VISION_PROVIDERS.has(envResolved.provider),
    },
    visionModelWarning,
  };
}
