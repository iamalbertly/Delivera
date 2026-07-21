/**
 * Probe: PI slide vision on WhatsApp JPEG (requires OPENAI_API_KEY or ANTHROPIC_API_KEY in .env).
 * Usage: node scripts/Delivera-Test-PIBaseline-Slide-Upload-01Probe.js
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import '../lib/Delivera-Config-Env-Services-Core-SSOT.js';
import { resolveProviderConfig } from '../lib/Delivera-AI-Provider-Gateway.js';
import { proposeFromSlideImage } from '../lib/Delivera-Governance-PIBaseline-03Propose-Agent.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const IMAGE_PATH = process.env.DELIVERA_PI_SLIDE_PATH
  || process.argv[2]
  || join(ROOT, 'data', 'WhatsApp Image 2026-06-04 at 15.35.55.jpeg');

function pickProviderConfig() {
  const openai = resolveProviderConfig({ 'x-ai-provider': 'openai' });
  if (openai.apiKey && openai.provider === 'openai') return openai;
  const claude = resolveProviderConfig({ 'x-ai-provider': 'claude' });
  if (claude.apiKey && claude.provider === 'claude') return claude;
  return resolveProviderConfig({});
}

async function main() {
  if (!existsSync(IMAGE_PATH)) {
    const inCi = process.env.CI === 'true' || process.env.CI === '1';
    console.log(`[probe] SKIP — missing fixture image (${inCi ? 'CI' : 'local'}): ${IMAGE_PATH}`);
    process.exit(inCi ? 0 : 1);
  }
  const providerConfig = pickProviderConfig();
  const requireProbe = process.env.DELIVERA_REQUIRE_AI_PROBE === 'true';
  if (!providerConfig.apiKey || providerConfig.provider === 'built-in') {
    console.log('[probe] SKIP — set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env');
    process.exit(requireProbe ? 1 : 0);
  }
  if (providerConfig.provider === 'gemini') {
    console.log('[probe] SKIP — slide vision needs OpenAI or Claude');
    process.exit(0);
  }
  const buf = readFileSync(IMAGE_PATH);
  const imageBase64 = buf.toString('base64');
  const mimeType = 'image/jpeg';
  console.log(`[probe] provider=${providerConfig.provider} bytes=${buf.length} projects=SD quarter=FY27 Q1`);
  const result = await proposeFromSlideImage({
    imageBase64,
    mimeType,
    projects: ['SD'],
    quarter: 'FY27 Q1',
    providerConfig,
    boardEpics: [
      { issueKey: 'SD-100', title: 'FY27 Q1 – DMS – NBA – Recharge Growth Trends', summary: 'FY27 Q1 – DMS – NBA – Recharge Growth Trends' },
    ],
  });
  console.log('[probe] method:', result.method);
  console.log('[probe] extracted:', (result.extracted || []).length);
  console.log('[probe] candidates:', (result.candidates || []).length);
  console.log('[probe] unmatched:', (result.unmatched || []).length);
  if (result.parseError) console.log('[probe] parseError:', result.parseError);
  if (!(result.extracted || []).length && !(result.candidates || []).length) {
    console.error('[probe] FAIL — no slide output');
    process.exit(1);
  }
  console.log('[probe] OK');
}

main().catch((err) => {
  console.error('[probe] ERROR', err?.message || err);
  process.exit(1);
});
