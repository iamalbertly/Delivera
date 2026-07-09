/**
 * Unit: AI provider precedence — env default, browser override when confirmed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.OPENROUTER_API_KEY = 'env-openrouter-key';
process.env.AI_PROVIDER = 'openrouter';

const { resolveProviderConfig } = await import('../lib/Delivera-AI-Provider-Gateway.js');
const { buildAiProviderStatus } = await import('../lib/Delivera-AI-Provider-Status-01SSOT.js');

test('env openrouter used when no browser override headers', () => {
  const cfg = resolveProviderConfig({});
  assert.equal(cfg.provider, 'openrouter');
  assert.equal(cfg.apiKey, 'env-openrouter-key');
  assert.equal(cfg.source, 'server');
});

test('browser override wins when x-ai-override and key present', () => {
  const cfg = resolveProviderConfig({
    'x-ai-provider': 'openai',
    'x-ai-key': 'browser-openai-key',
    'x-ai-override': '1',
  });
  assert.equal(cfg.provider, 'openai');
  assert.equal(cfg.apiKey, 'browser-openai-key');
  assert.equal(cfg.source, 'browser');
});

test('header provider without override flag falls back to env', () => {
  const cfg = resolveProviderConfig({
    'x-ai-provider': 'openai',
    'x-ai-key': 'browser-openai-key',
  });
  assert.equal(cfg.provider, 'openrouter');
  assert.equal(cfg.apiKey, 'env-openrouter-key');
});

test('buildAiProviderStatus exposes slideVision contract', () => {
  const status = buildAiProviderStatus({});
  assert.equal(status.slideVisionReady, true);
  assert.equal(status.slideVision.ready, true);
  assert.equal(status.slideVision.envProvider, 'openrouter');
});
