#!/usr/bin/env node

// SSOT journey runner: executes Playwright specs for a given journey bucket.
// Usage:
//   node scripts/Jira-Reporting-Tests-Journey-Runner-SSOT.js journey.current-sprint
//   node scripts/Jira-Reporting-Tests-Journey-Runner-SSOT.js journey.ux-core -- --grep "some pattern"

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { journeyBuckets, getJourneySpecs } from './Jira-Reporting-Tests-Journey-Buckets-Map-SSOT.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function printUsageAndExit() {
  const ids = Object.keys(journeyBuckets).sort();
  console.error('Usage: node scripts/Jira-Reporting-Tests-Journey-Runner-SSOT.js <journeyId> [-- <extra playwright args>]');
  console.error('Known journeyIds:');
  ids.forEach((id) => {
    const label = journeyBuckets[id]?.label || '';
    console.error(`  - ${id}${label ? `  (${label})` : ''}`);
  });
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    printUsageAndExit();
    return;
  }

  const separatorIndex = argv.indexOf('--');
  const journeyId = separatorIndex === -1 ? argv[0] : argv[0];
  const extraArgs = separatorIndex === -1 ? argv.slice(1) : argv.slice(separatorIndex + 1);

  const specs = getJourneySpecs(journeyId);
  if (!specs.length) {
    console.error(`Unknown or empty journey bucket: ${journeyId}`);
    printUsageAndExit();
    return;
  }

  const args = [
    'playwright',
    'test',
    ...specs,
    '--max-failures=1',
    '--reporter=list',
    ...extraArgs,
  ];

  const startedAt = Date.now();
  const timestamp = () => new Date().toISOString();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${timestamp()}] Journey run: ${journeyId}`);
  console.log(`Specs:`);
  specs.forEach((s) => console.log(`  - ${s}`));
  if (extraArgs.length) {
    console.log(`Extra Playwright args: ${extraArgs.join(' ')}`);
  }
  console.log(`${'='.repeat(60)}\n`);

  const proc = spawn('npx', args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
    },
  });

  proc.on('close', (code) => {
    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    if (code === 0) {
      console.log(`\n[${timestamp()}] OK journey ${journeyId} completed in ${elapsedSec}s\n`);
      process.exit(0);
    } else {
      console.error(`\n[${timestamp()}] FAILED journey ${journeyId} with code ${code} after ${elapsedSec}s\n`);
      process.exit(code || 1);
    }
  });

  proc.on('error', (error) => {
    console.error(`\n[${timestamp()}] ERROR starting journey ${journeyId}: ${error.message}\n`);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error('Unexpected error in journey runner:', error && error.message ? error.message : error);
  process.exit(1);
});

