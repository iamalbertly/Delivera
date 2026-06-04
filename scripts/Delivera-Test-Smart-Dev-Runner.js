#!/usr/bin/env node
/**
 * Delivera Smart Dev Test Runner — default `npm test` target.
 *
 * Runs ONLY what matters right now, fail-fast, serial:
 *   Tier 1 — Specs for files changed since branch base (touched source OR test files)
 *   Tier 2 — Specs that failed in the previous run (persisted in Delivera-Test-Last-Failed.json)
 *   Tier 3 — 3 critical smoke specs (always run to confirm health)
 *
 * For full regression: npm run test:all
 */

import { spawnSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { deriveImpactedSpecs } from './Delivera-Test-Selection-Helper.js';
import { specMetadata } from './Delivera-Tests-Journey-Buckets-Map-SSOT.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const LAST_FAILED_PATH = path.join(projectRoot, 'scripts', 'Delivera-Test-Last-Failed.json');

// Always verify these 3 pass regardless of what was touched — core value journeys.
const CRITICAL_SMOKE_SPECS = [
  'tests/Delivera-Jira-Top-Chrome-E2E-Validation-Tests.spec.js',
  'tests/Delivera-Data-Integrity-Coherence-Contracts.spec.js',
  'tests/Delivera-CurrentSprint-Mission-Control-Direct-Value-Validation-Tests.spec.js',
  'tests/Delivera-E2E-User-Journey-Tests.spec.js',
];

function getChangedFiles() {
  const allChanged = new Set();

  // Primary: uncommitted working-tree changes (staged + unstaged) — "just touched"
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: projectRoot, encoding: 'utf8' });
  if (status.status === 0 && status.stdout.trim()) {
    status.stdout.trim().split('\n').filter(Boolean)
      .map(l => l.slice(3).trim())
      .filter(Boolean)
      .forEach(f => allChanged.add(f));
  }

  // Secondary: last commit (HEAD vs HEAD~1) — picks up very recent commits
  const lastCommit = spawnSync('git', ['diff', '--name-only', 'HEAD~1', 'HEAD'], {
    cwd: projectRoot, encoding: 'utf8',
  });
  if (lastCommit.status === 0 && lastCommit.stdout.trim()) {
    lastCommit.stdout.trim().split('\n').filter(Boolean).forEach(f => allChanged.add(f));
  }

  return Array.from(allChanged);
}

function loadLastFailed() {
  try {
    if (!fs.existsSync(LAST_FAILED_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(LAST_FAILED_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveLastFailed(specs) {
  try {
    const unique = Array.from(new Set(specs.filter(s => typeof s === 'string')));
    fs.writeFileSync(LAST_FAILED_PATH, JSON.stringify(unique, null, 2), 'utf8');
  } catch { /* best-effort */ }
}

function specExists(spec) {
  return fs.existsSync(path.join(projectRoot, spec));
}

function runPlaywright(specs) {
  return new Promise((resolve, reject) => {
    const args = ['playwright', 'test', ...specs, '--max-failures=1', '--workers=1', '--reporter=list'];
    console.log(`\nCommand: npx ${args.join(' ')}\n${'='.repeat(60)}\n`);
    const proc = spawn('npx', args, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    proc.on('close', code => (code === 0 ? resolve() : reject(new Error(`Exit code ${code}`))));
    proc.on('error', reject);
  });
}

async function main() {
  const ts = () => new Date().toISOString();

  console.log('\n' + '='.repeat(60));
  console.log('Delivera Smart Dev Tests  —  npm test');
  console.log('Full regression: npm run test:all');
  console.log('='.repeat(60));

  const changedFiles = getChangedFiles();
  const allSpecs = Object.keys(specMetadata);
  const impacted = new Set(deriveImpactedSpecs(changedFiles, allSpecs));
  const lastFailed = loadLastFailed().filter(s => specExists(s));

  const seen = new Set();
  const tiers = { TOUCHED: [], 'LAST-FAILED': [], CRITICAL: [] };

  const isDeleteCandidate = (spec) => path.basename(spec).startsWith('DeleteThisFile_');
  const add = (spec, tier) => {
    if (seen.has(spec) || !specExists(spec)) return;
    if (isDeleteCandidate(spec)) return; // pending-deletion specs excluded from auto-selection
    seen.add(spec);
    tiers[tier].push(spec);
  };

  // Tier 1: test files that were directly changed
  changedFiles.filter(f => f.startsWith('tests/') && f.endsWith('.spec.js')).forEach(s => add(s, 'TOUCHED'));
  // Tier 1b: specs related to changed source/CSS/config files
  [...impacted].forEach(s => add(s, 'TOUCHED'));
  // Tier 2: specs that failed in the previous run
  lastFailed.forEach(s => add(s, 'LAST-FAILED'));
  // Tier 3: 3 critical smoke specs (always at end)
  CRITICAL_SMOKE_SPECS.forEach(s => add(s, 'CRITICAL'));

  const allToRun = [...tiers.TOUCHED, ...tiers['LAST-FAILED'], ...tiers.CRITICAL];

  console.log(`\n  Changed files   : ${changedFiles.length}`);
  console.log(`  Impacted specs  : ${[...impacted].length}`);
  console.log(`  Last-failed     : ${lastFailed.length}`);
  console.log(`  Total to run    : ${allToRun.length}`);

  ['TOUCHED', 'LAST-FAILED', 'CRITICAL'].forEach(tier => {
    if (tiers[tier].length) {
      console.log(`\n  [${tier}]`);
      tiers[tier].forEach(s => console.log(`    ${s}`));
    }
  });

  if (allToRun.length === 0) {
    console.log('\n  Nothing impacted. Run npm run test:all for full regression.\n');
    process.exit(0);
  }

  console.log(`\n[${ts()}] Starting ${allToRun.length} spec(s) — fail-fast, serial\n`);

  try {
    await runPlaywright(allToRun);
    console.log(`\n[${ts()}] OK All selected tests passed.\n`);
    saveLastFailed([]);
    process.exit(0);
  } catch {
    console.error(`\n[${ts()}] FAILED — fix the failing test then re-run: npm test\n`);
    // TOUCHED re-derives from git status on the next run — no need to persist it.
    // Only carry forward the previous last-failed set; the broken spec is still in TOUCHED.
    saveLastFailed(tiers['LAST-FAILED']);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[FATAL]', err && err.message ? err.message : err);
  process.exit(1);
});
