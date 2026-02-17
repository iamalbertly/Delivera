#!/usr/bin/env node

/**
 * Test Orchestration Runner for Jira Reporting App
 * Runs all tests in sequence, shows steps in foreground, terminates on first error
 */

import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import net from 'net';
import { getSteps } from './Jira-Reporting-App-Test-Orchestration-Steps.js';
import { getSpecPathFromStep, selectStepsForRun } from './Jira-Reporting-App-Test-Selection-Helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const steps = getSteps(projectRoot);
const stateFilePath = join(projectRoot, 'scripts', 'Jira-Reporting-App-Test-Orchestration-State.json');
const cancelFilePath = join(projectRoot, 'scripts', 'Jira-Reporting-App-Test-Orchestration-Cancel.json');
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const resolvedPort = (() => {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.port) return Number(parsed.port);
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch (error) {
    return Number(process.env.PORT) || 3000;
  }
})();

let summaryState = {
  startedAt: null,
  totalAvailableSteps: steps.length,
  selectedStepsCount: 0,
  stepNames: [],
  completedStepNames: [],
  lastStartedStepName: null,
};

function safeWriteJson(filePath, value) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
  } catch {
    // best-effort; ignore
  }
}

function readJsonIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStatePatch(patch) {
  try {
    const current = readJsonIfExists(stateFilePath) || {};
    const next = { ...current, ...patch };
    safeWriteJson(stateFilePath, next);
  } catch {
    // ignore
  }
}

function clearStateFile() {
  try {
    if (fs.existsSync(stateFilePath)) {
      fs.unlinkSync(stateFilePath);
    }
  } catch {
    // ignore
  }
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
    socket.connect(port, '127.0.0.1');
  });
}

function runStep(step, stepIndex, totalSteps, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let args = step.args || [];
    if (process.env.TEST_LAST_FAILED === '1' || process.env.TEST_LAST_FAILED === 'true') {
      const isPlaywright = step.command === 'npx' && args.some(a => a === 'playwright');
      if (isPlaywright && !args.includes('--last-failed')) {
        args = [...args, '--last-failed', '--pass-with-no-tests'];
      }
    }
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Step ${stepIndex + 1}/${totalSteps}: ${step.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Command: ${step.command} ${args.join(' ')}`);
    console.log(`Working Directory: ${step.cwd}`);
    console.log(`${'='.repeat(60)}\n`);

    const proc = spawn(step.command, args, {
      cwd: step.cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, ...envOverrides },
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.error(`\n${'='.repeat(60)}`);
        console.error(`FAILED: Step ${stepIndex + 1} (${step.name}) exited with code ${code} after ${elapsedSec}s`);
        console.error(`${'='.repeat(60)}\n`);
        reject(new Error(`Step ${step.name} failed with exit code ${code}`));
      } else {
        const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`\nOK Step ${stepIndex + 1} (${step.name}) completed successfully in ${elapsedSec}s\n`);
        resolve();
      }
    });

    proc.on('error', (error) => {
      console.error(`\n${'='.repeat(60)}`);
      console.error(`ERROR: Failed to start step ${stepIndex + 1} (${step.name})`);
      console.error(`Error: ${error.message}`);
      console.error(`${'='.repeat(60)}\n`);
      reject(error);
    });
  });
}

function loadLastFailedSpecs() {
  try {
    const filePath = join(projectRoot, 'scripts', 'Jira-Reporting-App-Test-Last-Failed.json');
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => typeof v === 'string');
  } catch {
    return [];
  }
}

function resolveAvailableBaseRef(preferredRef) {
  const candidates = [preferredRef, 'origin/master', 'master', 'main', 'HEAD~1']
    .filter((v, idx, arr) => v && arr.indexOf(v) === idx);
  for (const ref of candidates) {
    try {
      const verify = spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], {
        cwd: projectRoot,
        encoding: 'utf8',
      });
      if (verify.status === 0) return ref;
    } catch {
      // continue trying next candidate
    }
  }
  return null;
}

function resolveMergeBaseRef(targetRef) {
  if (!targetRef) return null;
  try {
    const result = spawnSync('git', ['merge-base', 'HEAD', targetRef], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    if (result.status === 0 && result.stdout) {
      const sha = result.stdout.trim();
      if (sha) return sha;
    }
  } catch {
    // fall through
  }
  return null;
}

function saveLastFailedSpecs(specPaths) {
  try {
    const filePath = join(projectRoot, 'scripts', 'Jira-Reporting-App-Test-Last-Failed.json');
    const unique = Array.from(new Set((Array.isArray(specPaths) ? specPaths : []).filter((v) => typeof v === 'string')));
    fs.writeFileSync(filePath, JSON.stringify(unique, null, 2), 'utf8');
  } catch {
    // Best-effort; do not fail the run if we cannot persist last-failed state.
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('Jira Reporting App - Test Orchestration');
  console.log('='.repeat(60));
  console.log(`Total Steps (available): ${steps.length}`);
  console.log('Terminating on first error\n');

  // Clear any stale cancel file from previous runs.
  try {
    if (fs.existsSync(cancelFilePath)) {
      fs.unlinkSync(cancelFilePath);
    }
  } catch {
    // ignore
  }

  const fullRun = process.env.FULL === '1' || process.env.FULL === 'true';
  const disableLastFailed = process.env.DISABLE_LAST_FAILED === '1' || process.env.DISABLE_LAST_FAILED === 'true';

  // Determine changed files via git (best-effort).
  let changedFiles = [];
  if (!fullRun) {
    const preferredBaseRef = process.env.TEST_BASE_REF || 'origin/main';
    const baseRef = resolveAvailableBaseRef(preferredBaseRef);
    const diffRef = resolveMergeBaseRef(baseRef) || baseRef;
    try {
      const diffArgs = diffRef
        ? ['diff', '--name-only', `${diffRef}...HEAD`]
        : ['status', '--porcelain'];
      if (!diffRef) {
        console.log('[INFO] No configured base ref found; using working-tree fallback for impacted test selection.');
      } else if (diffRef !== baseRef) {
        console.log(`[INFO] Using merge-base ${diffRef.slice(0, 12)} against ${baseRef} for impacted test selection.`);
      }
      const result = spawnSync('git', diffArgs, {
        cwd: projectRoot,
        encoding: 'utf8',
      });
      if (result.status === 0 && result.stdout && diffRef) {
        changedFiles = result.stdout
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('package-lock.json'));
      } else if (result.status === 0 && result.stdout && !diffRef) {
        changedFiles = result.stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.slice(3).trim())
          .filter((line) => line && !line.startsWith('package-lock.json'));
      } else if (result.status !== 0 && result.stderr) {
        console.log('[WARN] git diff against base ref failed, trying local working-tree fallback.');
        console.log('[WARN] git stderr:', result.stderr.trim());
        const fallback = spawnSync('git', ['status', '--porcelain'], {
          cwd: projectRoot,
          encoding: 'utf8',
        });
        if (fallback.status === 0 && fallback.stdout) {
          changedFiles = fallback.stdout
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => line.slice(3).trim())
            .filter((line) => line && !line.startsWith('package-lock.json'));
        }
      }
    } catch (gitError) {
      console.log('[WARN] Unable to run git diff for changed files:', gitError.message || gitError);
    }
  }

  const smokeSpecPaths = [
    'tests/Jira-Reporting-App-API-Integration-Tests.spec.js',
    'tests/Jira-Reporting-App-E2E-User-Journey-Tests.spec.js',
    'tests/Jira-Reporting-App-UX-Customer-Simplicity-Trust-Full-Validation-Tests.spec.js',
  ];

  const lastFailedSpecs = disableLastFailed ? [] : loadLastFailedSpecs();

  const selection = selectStepsForRun({
    steps,
    changedFiles,
    lastFailedSpecs,
    smokeSpecPaths,
    full: fullRun,
  });

  const stepsToRun = selection.steps;

  summaryState.startedAt = Date.now();
  summaryState.totalAvailableSteps = steps.length;
  summaryState.selectedStepsCount = stepsToRun.length;
  summaryState.stepNames = stepsToRun.map((s) => s.name);
  summaryState.completedStepNames = [];
  summaryState.lastStartedStepName = null;

  // Persist high-level state so external tools can target this run.
  writeStatePatch({
    pid: process.pid,
    startedAt: summaryState.startedAt,
    mode: selection.info.mode,
    totalAvailableSteps: summaryState.totalAvailableSteps,
    selectedStepsCount: summaryState.selectedStepsCount,
    stepNames: summaryState.stepNames,
    completedStepNames: summaryState.completedStepNames,
    lastStartedStepName: summaryState.lastStartedStepName,
    finished: false,
    cancelled: false,
    failed: false,
  });

  console.log('[INFO] Test selection summary:');
  console.log(`  Mode: ${selection.info.mode}`);
  console.log(`  Changed files: ${selection.info.changedFilesCount}`);
  console.log(`  Selected steps: ${selection.info.selectedCount}/${selection.info.totalSteps}`);
  console.log(`  Last-failed specs: ${selection.info.lastFailedCount}`);
  console.log(`  Impacted specs: ${selection.info.impactedCount}`);
  console.log(`  Smoke specs used: ${selection.info.smokeCount}\n`);
  if (!fullRun && selection.info.selectedCount < selection.info.totalSteps) {
    const skipped = selection.info.totalSteps - selection.info.selectedCount;
    console.log(`[INFO] Skipping ${skipped} steps unrelated to current changes. Set FULL=1 to run full regression.`);
  }
  if (!fullRun && !disableLastFailed) {
    console.log('[INFO] TEST_LAST_FAILED is applied implicitly. Use DISABLE_LAST_FAILED=1 to turn this off for debugging.\n');
  }

  let manualServer = null;
  let lastStartedStep = null;
  try {
    const portInUse = await isPortInUse(resolvedPort);
    const skipWebServer = process.env.SKIP_WEBSERVER === 'true' || portInUse;
    if (portInUse && process.env.SKIP_WEBSERVER !== 'true') {
      console.log(`[INFO] Port ${resolvedPort} already in use. Reusing existing server.`);
    }
    console.log(`[INFO] BASE_URL: ${baseUrl}`);
    console.log(`[INFO] WebServer: ${skipWebServer ? 'skip (reuse existing)' : 'managed by Playwright'}\n`);

    if (skipWebServer && !portInUse) {
      console.log(`[INFO] Starting local server on port ${resolvedPort}...`);
      manualServer = spawn('node', ['server.js'], {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: { ...process.env, PORT: String(resolvedPort), NODE_ENV: 'test' },
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Clear server caches before test steps so no test reads stale data
    const clearCacheUrl = `${baseUrl.replace(/\/$/, '')}/api/test/clear-cache`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(clearCacheUrl, { method: 'POST', signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          console.log('[INFO] Server caches cleared.\n');
          break;
        }
        if (res.status === 404) {
          console.log('[WARN] Clear-cache endpoint not available (404). Continue without clearing.\n');
          break;
        }
      } catch (err) {
        const message = err && err.message ? err.message : String(err);
        if (attempt === 3) {
          if (!skipWebServer) {
            console.log('[WARN] Cache clear endpoint unavailable before managed webserver startup; continuing.\n');
            break;
          }
          console.error('[ERROR] Failed to clear server cache after 3 attempts:', message);
          console.error('[ERROR] Server at BASE_URL may be unreachable. Aborting test run early.\n');
          if (manualServer) {
            manualServer.kill();
          }
          process.exit(1);
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    const totalToRun = stepsToRun.length;
    const runStartedAt = Date.now();
    for (let i = 0; i < stepsToRun.length; i++) {
      // Allow external cancel between steps via cancel flag file.
      try {
        if (fs.existsSync(cancelFilePath) && fs.existsSync(stateFilePath)) {
          console.log('\n[INFO] Cancel flag detected before starting next step. Stopping orchestration.');
          printOrchestrationSummary('cancel-request');
          writeStatePatch({
            finished: true,
            cancelled: true,
            failed: false,
            completedStepNames: summaryState.completedStepNames,
            lastStartedStepName: summaryState.lastStartedStepName,
          });
          clearStateFile();
          try {
            fs.unlinkSync(cancelFilePath);
          } catch {
            // ignore
          }
          process.exit(130);
        }
      } catch {
        // If we cannot read cancel flag, continue; this should not crash the run.
      }

      const step = stepsToRun[i];
      const stepStartedAt = Date.now();
      lastStartedStep = step;
      summaryState.lastStartedStepName = step.name;
      writeStatePatch({
        lastStartedStepName: summaryState.lastStartedStepName,
        currentStepIndex: i,
      });
      await runStep(step, i, totalToRun, {
        BASE_URL: baseUrl,
        PORT: process.env.PORT || String(resolvedPort),
        SKIP_WEBSERVER: skipWebServer ? 'true' : (process.env.SKIP_WEBSERVER || ''),
        PLAYWRIGHT_LIST_PRINT_STEPS: '1',
        CI: process.env.CI || '',
        TEST_LAST_FAILED: (!fullRun && !disableLastFailed) ? '1' : (process.env.TEST_LAST_FAILED || ''),
      });
      const stepElapsedSec = ((Date.now() - stepStartedAt) / 1000).toFixed(1);
      const cumulativeElapsedSec = ((Date.now() - runStartedAt) / 1000).toFixed(1);
      console.log(`[INFO] Step duration: ${stepElapsedSec}s | Cumulative after step ${i + 1}/${totalToRun}: ${cumulativeElapsedSec}s\n`);
      summaryState.completedStepNames.push(step.name);
      writeStatePatch({
        completedStepNames: summaryState.completedStepNames,
      });
    }

    const runElapsedSec = ((Date.now() - runStartedAt) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('OK ALL TESTS PASSED');
    console.log(`Total runtime (selected steps): ${runElapsedSec}s`);
    console.log('='.repeat(60) + '\n');
    if (manualServer) {
      manualServer.kill();
    }
    // Clear last-failed metadata on a fully successful run.
    saveLastFailedSpecs([]);
    writeStatePatch({
      finished: true,
      cancelled: false,
      failed: false,
      completedStepNames: summaryState.completedStepNames,
    });
    clearStateFile();
    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('ERROR TEST ORCHESTRATION FAILED');
    console.error('='.repeat(60));
    console.error(`Error: ${error.message}\n`);
    if (lastStartedStep) {
      const failingSpec = getSpecPathFromStep(lastStartedStep);
      if (failingSpec) {
        saveLastFailedSpecs([failingSpec]);
      }
    }
    if (manualServer) {
      manualServer.kill();
    }
    writeStatePatch({
      finished: true,
      cancelled: false,
      failed: true,
      completedStepNames: summaryState.completedStepNames,
      lastStartedStepName: summaryState.lastStartedStepName,
      errorMessage: error && error.message ? error.message : String(error),
    });
    process.exit(1);
  }
}

function printOrchestrationSummary(reason) {
  const selected = summaryState.selectedStepsCount || 0;
  const completed = summaryState.completedStepNames.length || 0;
  const remaining = selected > completed ? selected - completed : 0;
  console.log('\n' + '='.repeat(60));
  console.log(`Test orchestration summary (${reason})`);
  console.log('='.repeat(60));
  console.log(`Selected steps: ${selected}/${summaryState.totalAvailableSteps}`);
  console.log(`Completed steps: ${completed}`);
  if (remaining > 0) {
    console.log(`Remaining steps (not run): ${remaining}`);
  }
  if (summaryState.completedStepNames.length > 0) {
    const names = summaryState.completedStepNames.slice(0, 5).join(', ');
    console.log(`Completed step names (first 5): ${names}`);
  }
  if (summaryState.lastStartedStepName) {
    console.log(`Last started step: ${summaryState.lastStartedStepName}`);
  }
  console.log('='.repeat(60) + '\n');
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\nTest orchestration interrupted by user');
  printOrchestrationSummary('interrupted');
  writeStatePatch({
    finished: true,
    cancelled: true,
    failed: false,
    completedStepNames: summaryState.completedStepNames,
    lastStartedStepName: summaryState.lastStartedStepName,
  });
  clearStateFile();
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n\nTest orchestration terminated');
  printOrchestrationSummary('terminated');
  writeStatePatch({
    finished: true,
    cancelled: true,
    failed: false,
    completedStepNames: summaryState.completedStepNames,
    lastStartedStepName: summaryState.lastStartedStepName,
  });
  clearStateFile();
  process.exit(143);
});

runAllTests();
