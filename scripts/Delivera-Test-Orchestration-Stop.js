#!/usr/bin/env node

/**
 * Cooperative stop helper for Jira Reporting App test orchestration.
 *
 * Writes a cancel flag file that the orchestration runner checks between steps.
 * This avoids using broad taskkill and lets the runner print its own summary.
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const stateFilePath = join(projectRoot, 'scripts', 'Jira-Reporting-App-Test-Orchestration-State.json');
const cancelFilePath = join(projectRoot, 'scripts', 'Jira-Reporting-App-Test-Orchestration-Cancel.json');

function main() {
  try {
    if (!fs.existsSync(stateFilePath)) {
      console.log('[INFO] No active test orchestration run found (no state file).');
      return;
    }
  } catch {
    console.log('[WARN] Unable to read orchestration state. Nothing to stop.');
    return;
  }

  const payload = {
    cancelRequestedAt: Date.now(),
  };

  try {
    fs.writeFileSync(cancelFilePath, JSON.stringify(payload, null, 2), 'utf8');
    console.log('[INFO] Cancel flag written. The orchestration will stop after the current step and print a summary.');
  } catch (err) {
    console.log('[ERROR] Failed to write cancel flag file:', err && err.message ? err.message : String(err));
  }
}

main();

