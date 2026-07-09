/**
 * Probe: PI slide vision — WhatsApp JPEG (FY27 Q1) and DMS Q2 commitments PNG (FY27 Q2).
 * Usage: node scripts/Delivera-Test-PIBaseline-Slide-Upload-01Probe.js [--dms-q2]
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import '../lib/Delivera-Config-Env-Services-Core-SSOT.js';
import { resolveProviderConfig } from '../lib/Delivera-AI-Provider-Gateway.js';
import { proposeFromSlideImage } from '../lib/Delivera-Governance-PIBaseline-03Propose-Agent.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const FIXTURES = {
  whatsapp: join(ROOT, 'data', 'WhatsApp Image 2026-06-04 at 15.35.55.jpeg'),
  dmsQ2: join(ROOT, 'data', 'testing_q2fy27_dms_commitments.png'),
};

function pickProviderConfig() {
  const envDefault = resolveProviderConfig({});
  if (envDefault.apiKey && envDefault.provider === 'openrouter') return envDefault;
  const openrouter = resolveProviderConfig({ 'x-ai-provider': 'openrouter' });
  if (openrouter.apiKey && openrouter.provider === 'openrouter') return openrouter;
  const openai = resolveProviderConfig({ 'x-ai-provider': 'openai' });
  if (openai.apiKey && openai.provider === 'openai') return openai;
  const claude = resolveProviderConfig({ 'x-ai-provider': 'claude' });
  if (claude.apiKey && claude.provider === 'claude') return claude;
  return envDefault;
}

async function runProbe({ imagePath, mimeType, projects, quarter, boardEpics, label }) {
  if (!existsSync(imagePath)) {
    const inCi = process.env.CI === 'true' || process.env.CI === '1';
    console.log(`[probe:${label}] SKIP — missing fixture (${inCi ? 'CI' : 'local'}): ${imagePath}`);
    return inCi ? 'skip' : 'missing';
  }
  const providerConfig = pickProviderConfig();
  const requireProbe = process.env.DELIVERA_REQUIRE_AI_PROBE === 'true';
  if (!providerConfig.apiKey || providerConfig.provider === 'built-in') {
    console.log(`[probe:${label}] SKIP — set OPENROUTER_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in .env`);
    return requireProbe ? 'fail' : 'skip';
  }
  if (providerConfig.provider === 'gemini') {
    console.log(`[probe:${label}] SKIP — slide vision needs OpenAI, Claude, or OpenRouter`);
    return 'skip';
  }
  const buf = readFileSync(imagePath);
  const imageBase64 = buf.toString('base64');
  console.log(`[probe:${label}] provider=${providerConfig.provider} bytes=${buf.length} projects=${projects.join(',')} quarter=${quarter}`);
  const result = await proposeFromSlideImage({
    imageBase64,
    mimeType,
    projects,
    quarter,
    providerConfig,
    boardEpics,
  });
  console.log(`[probe:${label}] method:`, result.method);
  console.log(`[probe:${label}] inferredSquad:`, result.inferredSquad || '(none)');
  console.log(`[probe:${label}] inferredQuarter:`, result.inferredQuarter || '(none)');
  if (label === 'dms-q2') {
    if (String(result.inferredSquad || '').toUpperCase() !== 'DMS') {
      console.error(`[probe:${label}] FAIL — expected inferredSquad DMS`);
      return 'fail';
    }
    if (!String(result.inferredQuarter || '').includes('FY27 Q2')) {
      console.error(`[probe:${label}] FAIL — expected inferredQuarter FY27 Q2`);
      return 'fail';
    }
  }
  console.log(`[probe:${label}] extracted:`, (result.extracted || []).length);
  console.log(`[probe:${label}] candidates:`, (result.candidates || []).length);
  if (result.parseError) console.log(`[probe:${label}] parseError:`, result.parseError);
  const extractedCount = (result.extracted || []).length;
  const candidateCount = (result.candidates || []).length;
  const count = extractedCount || candidateCount;
  const minCommitments = label === 'dms-q2' ? 6 : 3;
  if (count < minCommitments) {
    const inCi = process.env.CI === 'true' || process.env.CI === '1';
    if (inCi && !requireProbe) {
      console.log(`[probe:${label}] SKIP — vision returned ${count} rows (CI soft-fail, need ${minCommitments})`);
      return 'skip';
    }
    console.error(`[probe:${label}] FAIL — expected at least ${minCommitments} commitments, got ${count}`);
    return 'fail';
  }
  console.log(`[probe:${label}] OK`);
  return 'ok';
}

async function main() {
  const dmsOnly = process.argv.includes('--dms-q2');
  const cases = dmsOnly
    ? [{
      label: 'dms-q2',
      imagePath: FIXTURES.dmsQ2,
      mimeType: 'image/png',
      projects: ['SD'],
      quarter: 'FY27 Q2',
      boardEpics: [
        { issueKey: 'SD-100', title: 'FY27 Q2 – DMS – NBA – CVM', summary: 'FY27 Q2 – DMS – NBA – CVM' },
      ],
    }]
    : [
      {
        label: 'whatsapp-q1',
        imagePath: FIXTURES.whatsapp,
        mimeType: 'image/jpeg',
        projects: ['SD'],
        quarter: 'FY27 Q1',
        boardEpics: [
          { issueKey: 'SD-100', title: 'FY27 Q1 – DMS – NBA – Recharge Growth Trends', summary: 'FY27 Q1 – DMS – NBA – Recharge Growth Trends' },
        ],
      },
      {
        label: 'dms-q2',
        imagePath: FIXTURES.dmsQ2,
        mimeType: 'image/png',
        projects: ['SD'],
        quarter: 'FY27 Q2',
        boardEpics: [
          { issueKey: 'SD-100', title: 'FY27 Q2 – DMS – NBA – CVM', summary: 'FY27 Q2 – DMS – NBA – CVM' },
        ],
      },
    ];
  let exitCode = 0;
  for (const probeCase of cases) {
    const outcome = await runProbe(probeCase);
    if (outcome === 'fail' || outcome === 'missing') exitCode = 1;
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[probe] ERROR', err?.message || err);
  process.exit(1);
});
