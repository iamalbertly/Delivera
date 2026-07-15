#!/usr/bin/env node
/**
 * Focused fail-fast validation for governance parity work.
 *
 * This is intentionally smaller than the historical 100+ test sweep:
 * 1. Recently touched build gates and unit contracts.
 * 2. Last-failed governance click-friction journeys.
 * 3. Most important browser journeys affected by shared chrome/scope changes.
 * 4. Fast click audit.
 * 5. Optional Vercel build with --vercel.
 */
import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const includeVercel = process.argv.includes('--vercel');
const baseUrl = process.env.BASE_URL || 'http://localhost:3002';

function run(label, command, args, opts = {}) {
  console.log(`\n[focused-parity] ${label}`);
  console.log(`[focused-parity] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: isWindows,
    env: {
      ...process.env,
      BASE_URL: baseUrl,
      SKIP_WEBSERVER: process.env.SKIP_WEBSERVER || 'true',
      ...opts.env,
    },
  });
  if (result.error) {
    console.error(`[focused-parity] ${result.error.message}`);
  }
  if (result.status !== 0) {
    console.error(`[focused-parity] FAILED: ${label}`);
    process.exit(result.status || 1);
  }
}

run('UTF-8 and CSS build', npmCmd, ['run', 'build:css']);
run('CSS sync check', npmCmd, ['run', 'check:css']);
run('Focused governance/portfolio unit contracts', 'node', [
  '--test',
  'tests/Delivera-Trust-Speed-State-Unit.mjs',
  'tests/Delivera-Governance-PriorityBrief-Unit.mjs',
  'tests/Delivera-Portfolio-Decision-Intelligence-Unit.mjs',
  'tests/Delivera-Governance-PortfolioDecision-Service-Unit.mjs',
  'tests/Delivera-Cache-AgeTier-TTL-Unit.mjs',
]);
run('Portfolio command surface journey', npxCmd, [
  'playwright', 'test',
  'tests/Delivera-Portfolio-Command-Surface-Realtime-Validation-Tests.spec.js',
  '--max-failures=1', '--workers=1', '--reporter=list', '--timeout=180000',
]);
run('Governance click friction journeys', npxCmd, [
  'playwright', 'test',
  'tests/Delivera-Governance-Click-Friction-MasterPlan-Realtime-Validation-Tests.spec.js',
  'tests/Delivera-Governance-Click-Friction-MasterPlan-Round3-Realtime-Validation-Tests.spec.js',
  '--max-failures=1', '--workers=1', '--reporter=list', '--timeout=180000',
]);
run('Current sprint chrome smoke', npxCmd, [
  'playwright', 'test',
  'tests/Delivera-Current-Sprint-Header-Declutter-Validation-Tests.spec.js',
  '--max-failures=1', '--workers=1', '--reporter=list', '--timeout=180000',
]);
run('Governance fast click audit', 'node', ['scripts/audit-governance-clicks-fast.mjs']);

if (includeVercel) {
  run('Local Vercel production build', npxCmd, ['vercel', 'build']);
}

console.log('\n[focused-parity] OK');
