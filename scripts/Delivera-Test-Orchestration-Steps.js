/**
 * Test orchestration step definitions for Delivera.
 * SSOT for the ordered list of test steps. Used by Delivera-Test-Orchestration-Runner.js.
 * Playwright steps use --max-failures=1 so the run terminates on first failure (fail-fast).
 * Runner uses stdio: inherit so each command’s output streams live in the terminal (see Delivera-Test-Orchestration-Runner.js).
 * Header declutter plan: `todo-orchestration` — build:css + check:css run before any journey (fail-fast CSS SSOT).
 *
 * @param {string} projectRoot - Project root path (used as cwd for each step)
 * @returns {Array<{ name: string, command: string, args: string[], cwd: string }>}
 */

import { getJourneySpecs } from './Delivera-Tests-Journey-Buckets-Map-SSOT.js';

const PLAYWRIGHT_CMD = 'playwright';
const PLAYWRIGHT_BASE_ARGS = ['test'];
const PLAYWRIGHT_COMMON_FLAGS = ['--reporter=list', '--max-failures=1'];

function pwJourneyArgs(journeyId, extra = []) {
  const specs = getJourneySpecs(journeyId);
  if (!specs || specs.length === 0) {
    throw new Error(`No specs registered for journeyId=${journeyId}`);
  }
  return [PLAYWRIGHT_CMD, ...PLAYWRIGHT_BASE_ARGS, ...specs, ...extra, ...PLAYWRIGHT_COMMON_FLAGS];
}

export function getSteps(projectRoot) {
  const installStep =
    process.env.SKIP_NPM_INSTALL === 'true'
      ? []
      : [{ name: 'Install Dependencies', command: 'npm', args: ['install'], cwd: projectRoot }];

  return [
    ...installStep,
    {
      name: 'Build CSS From Partials',
      command: 'npm',
      args: ['run', 'build:css'],
      cwd: projectRoot,
    },
    {
      name: 'Verify Generated CSS Is In Sync',
      command: 'npm',
      args: ['run', 'check:css'],
      cwd: projectRoot,
    },
    {
      name: 'Run Governance Decision Cockpit Journey',
      command: 'npx',
      args: pwJourneyArgs('journey.governance'),
      cwd: projectRoot,
    },
    {
      name: 'Run Data Integrity & API Contracts Journey',
      command: 'npx',
      args: pwJourneyArgs('journey.data-integrity'),
      cwd: projectRoot,
    },
    {
      name: 'Run Outcome Intake & Create Work Journey (covers most-recently-changed files)',
      command: 'npx',
      args: pwJourneyArgs('journey.outcome-intake'),
      cwd: projectRoot,
    },
    {
      name: 'Run UX Core Journeys (Navigation, Trust, Responsiveness)',
      command: 'npx',
      args: pwJourneyArgs('journey.ux-core'),
      cwd: projectRoot,
    },
    {
      name: 'Run Current Sprint Mission-Control Journey',
      command: 'npx',
      args: pwJourneyArgs('journey.current-sprint'),
      cwd: projectRoot,
    },
    {
      name: 'Run Human Nudge Review Trust Journey',
      command: 'npx',
      args: [...pwJourneyArgs('journey.human-nudge-trust'), '--workers=1'],
      cwd: projectRoot,
    },
    {
      name: 'Run Leadership HUD & Boards Journey',
      command: 'npx',
      args: pwJourneyArgs('journey.leadership'),
      cwd: projectRoot,
    },
    {
      name: 'Run Full E2E Journeys & Deploy Smoke',
      command: 'npx',
      args: pwJourneyArgs('journey.e2e'),
      cwd: projectRoot,
    },
  ];
}
