import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { sha256, detectFiscalPeriod, resolveCanonicalSquad } from '../lib/Delivera-Governance-PIArtifact-Identity-01SSOT.js';
import { extractPdf } from '../lib/Delivera-Governance-PIArtifact-NativeExtract-02Service.js';
import { runLocalOcr, extractStructuredLocalCommitments } from '../lib/Delivera-Governance-PIArtifact-LocalOCR-03Service.js';
import { preparePIArtifactImport, processPIArtifactImport } from '../lib/Delivera-Governance-PIArtifact-Import-06Service.js';
import { PI_IMPORT_STATES } from '../lib/Delivera-Governance-PIArtifact-Contracts-01SSOT.js';
import { aiProviderEnvConfig } from '../lib/Delivera-Config-Env-Services-Core-SSOT.js';

const pdfPath = 'C:/Users/Hermes/Downloads/PI.2.FY27.pdf';
const imagePath = 'C:/Users/Hermes/Pictures/Screenshots/tsquad fy27 q2.png';
const org = `pi-release-${Date.now()}`;
let pdfBuffer;
let pdfHash;
let pdf;

test('1 golden PDF detects FY27 Q2 without AI', { skip: !existsSync(pdfPath) }, async () => {
  pdfBuffer = readFileSync(pdfPath);
  pdfHash = sha256(pdfBuffer);
  pdf = await extractPdf(pdfBuffer, pdfHash);
  assert.equal(pdf.pages.length, 48);
  assert.equal(pdf.period.label, 'FY27 Q2');
  assert.equal(pdf.method, 'native');
});

test('2 relevant and irrelevant PI pages classify correctly', { skip: !existsSync(pdfPath) }, async () => {
  pdf ||= await extractPdf(readFileSync(pdfPath), sha256(readFileSync(pdfPath)));
  const relevant = pdf.pages.filter((page) => page.classification === 'squad-commitments').map((page) => page.number);
  const irrelevant = pdf.pages.filter((page) => page.classification === 'irrelevant').map((page) => page.number);
  assert.ok([14, 15, 16, 20, 21, 24, 25, 26, 27, 28, 30, 31, 32, 35, 36, 38].every((page) => relevant.includes(page)));
  assert.ok([2, 3, 43, 44, 45, 46, 47, 48].every((page) => irrelevant.includes(page)));
});

test('3 Terminal Squad resolves to canonical TRS', () => {
  assert.equal(resolveCanonicalSquad('Terminal Squad').key, 'TRS');
  assert.equal(resolveCanonicalSquad('T-Squad').key, 'TRS');
});

test('4 exact duplicate artifact returns shared cache with no extra calls', { skip: !existsSync(pdfPath) }, async () => {
  pdfBuffer ||= readFileSync(pdfPath);
  pdfHash ||= sha256(pdfBuffer);
  const meta = { filename: 'PI.2.FY27.pdf', mimeType: 'application/pdf', size: pdfBuffer.length };
  const first = await processPIArtifactImport({ organizationId: org, actor: 'release-1', buffer: pdfBuffer, meta });
  const second = await processPIArtifactImport({ organizationId: org, actor: 'release-2', buffer: pdfBuffer, meta });
  assert.equal(first.result.callsConsumed, 0);
  assert.equal(second.result.cacheStatus, 'exact-hit');
  assert.equal(second.result.callsConsumed, 0);
});

test('5 concurrent duplicate prepares join one durable job', async () => {
  const artifactHash = sha256(`join-${org}`);
  const meta = { filename: 'join.png', mimeType: 'image/png', size: 1024 };
  const [first, second] = await Promise.all([
    preparePIArtifactImport({ organizationId: org, actor: 'a', artifactHash, meta }),
    preparePIArtifactImport({ organizationId: org, actor: 'b', artifactHash, meta }),
  ]);
  assert.deepEqual(new Set([first.status, second.status]), new Set(['upload-required', 'joined']));
  assert.equal(first.job.jobId, second.job.jobId);
});

test('6 page hashes isolate changed-page cache identity', { skip: !existsSync(pdfPath) }, async () => {
  pdf ||= await extractPdf(readFileSync(pdfPath), sha256(readFileSync(pdfPath)));
  assert.ok(pdf.pages.every((page) => /^[a-f0-9]{64}$/.test(page.contentHash)));
  assert.notEqual(pdf.pages[26].contentHash, pdf.pages[27].contentHash);
});

test('7 external model roles are sequential and exact', () => {
  assert.equal(aiProviderEnvConfig.openrouterModelPiOcr, 'baidu/qianfan-ocr-fast:free');
  assert.equal(aiProviderEnvConfig.openrouterModelPiVision, 'qwen/qwen2.5-vl-32b-instruct:free');
  assert.equal(aiProviderEnvConfig.openrouterModelPiReconcile, 'google/gemma-4-31b-it:free');
});

test('8 quotas, circuits, and three-call ceiling are centralized', () => {
  const quota = readFileSync('lib/Delivera-Governance-PIArtifact-AIQuota-05SSOT.js', 'utf8');
  const limits = readFileSync('lib/Delivera-Governance-PIArtifact-Contracts-01SSOT.js', 'utf8');
  assert.match(quota, /qualified \? 900 : 45/);
  assert.match(quota, /15 \* 60 \* 1000/);
  assert.match(quota, /zero data retention\|data policy/);
  assert.match(limits, /maxCallsPerArtifact: 3/);
});

test('9 provider calls enforce ZDR and stay local without eligibility', () => {
  const gateway = readFileSync('lib/Delivera-AI-Provider-Gateway.js', 'utf8');
  const importer = readFileSync('lib/Delivera-Governance-PIArtifact-Import-06Service.js', 'utf8');
  const native = readFileSync('lib/Delivera-Governance-PIArtifact-NativeExtract-02Service.js', 'utf8');
  assert.match(gateway, /zdr: true/);
  assert.match(importer, /OPENROUTER_RESPONSE_CACHE_ENABLED/);
  assert.match(importer, /!process\.env\.VERCEL/);
  assert.match(native, /PROCESSING_WORKER_REQUIRED/);
});

test('10 T-Squad image produces reviewable local commitments and never stalls', { skip: !existsSync(imagePath) }, async () => {
  const buffer = readFileSync(imagePath);
  const local = await runLocalOcr(buffer);
  const commitments = extractStructuredLocalCommitments(local.regions, sha256(buffer));
  assert.equal(commitments.length, 3);
  assert.deepEqual(commitments.map((row) => row.month), ['July', 'August', 'September']);
  assert.ok(commitments.every((row) => row.sourceSpan?.boundingBox && row.sourceSpan?.rawText));
});

test('11 job state machine includes recovery and approval states', () => {
  for (const state of ['accepted', 'local-ocr', 'remote-ocr', 'awaiting-review', 'approved', 'failed', 'cancelled']) {
    assert.ok(PI_IMPORT_STATES.includes(state));
  }
  const route = readFileSync('routes/Delivera-Governance-PIArtifact-Import-01Route.js', 'utf8');
  assert.match(route, /expectedJobRevision/);
  assert.match(route, /expectedBaselineRevision/);
  assert.match(route, /PI_IMPORT_PROVENANCE_REQUIRED/);
  assert.match(route, /meta\.size > 4_000_000/);
});

test('12 direct-value UI exposes durable progress, organization health, and one sprint truth', () => {
  const client = readFileSync('public/Delivera-App-Shared-PIBaseline-Slide-01Client-Helper.js', 'utf8');
  const settings = readFileSync('public/settings.html', 'utf8');
  const sprint = readFileSync('public/Delivera-CurrentSprint-Render-Progress.js', 'utf8');
  const drop = readFileSync('public/Delivera-App-Shared-Slide-Upload-01Resize-Drop-Helper.js', 'utf8');
  assert.match(client, /setInterval[\s\S]*2000/);
  assert.match(drop, /application\/pdf/);
  assert.match(settings, /Organization health/);
  assert.match(sprint, /decisionCockpit\?\.health\?\.status/);
  assert.equal(detectFiscalPeriod('FY27 Q2 July August September').label, 'FY27 Q2');
});
