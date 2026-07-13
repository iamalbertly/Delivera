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

  const tier0Css = [
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
  ];

  const tier1Recent = [
    {
      name: 'Churn Trust Repair Journey (P0 governance + portfolio)',
      command: 'npm',
      args: ['run', 'test:journey:churn-trust-repair'],
      cwd: projectRoot,
    },
    {
      name: 'Server Lifecycle Unit Tests (uptime guards)',
      command: 'node',
      args: ['--test', 'tests/Delivera-Server-Lifecycle-Unit.mjs'],
      cwd: projectRoot,
    },
    {
      name: 'Governance Intervention Unit Tests',
      command: 'node',
      args: ['--test', 'tests/Delivera-Governance-Intervention-Case-Unit.mjs'],
      cwd: projectRoot,
    },
    {
      name: 'Portfolio Decision Intelligence Unit Tests',
      command: 'node',
      args: ['--test', 'tests/Delivera-Portfolio-Decision-Intelligence-Unit.mjs'],
      cwd: projectRoot,
    },
    {
      name: 'Cache Age-Tier TTL Unit Tests',
      command: 'node',
      args: ['--test', 'tests/Delivera-Cache-AgeTier-TTL-Unit.mjs'],
      cwd: projectRoot,
    },
  ];

  const tier2LastFailed = [
    {
      name: 'Run Cross-Page Persistence (last failed)',
      command: 'npx',
      args: ['playwright', 'test', 'tests/Delivera-Cross-Page-Persistence-Validation-Tests.spec.js', '--max-failures=1', '--workers=1', '--reporter=list'],
      cwd: projectRoot,
    },
    {
      name: 'Run API Integration Contracts',
      command: 'npm',
      args: ['run', 'test:journey:api-integration'],
      cwd: projectRoot,
    },
    {
      name: 'Run Value Retention Master Plan Journey',
      command: 'npm',
      args: ['run', 'test:journey:value-retention'],
      cwd: projectRoot,
    },
    {
      name: 'Run Direct Value Master Plan Journey',
      command: 'npm',
      args: ['run', 'test:journey:direct-value-masterplan'],
      cwd: projectRoot,
    },
    {
      name: 'Run Focused Playwright Contracts',
      command: 'npm',
      args: ['run', 'test:focused'],
      cwd: projectRoot,
    },
    {
      name: 'Run Layout Overlap Journey',
      command: 'npm',
      args: ['run', 'test:journey:layout-overlap'],
      cwd: projectRoot,
    },
    {
      name: 'Run Current Sprint Dedupe Fold Journey',
      command: 'npm',
      args: ['run', 'test:current-sprint:dedupe-fold'],
      cwd: projectRoot,
    },
  ];

  const tier3Critical = [
    {
      name: 'Run Brief SSOT Loading And Scope Journey',
      command: 'npm',
      args: ['run', 'test:journey:brief-ssot'],
      cwd: projectRoot,
    },
    {
      name: 'Run Governance Decision Cockpit Journey',
      command: 'npx',
      args: pwJourneyArgs('journey.governance'),
      cwd: projectRoot,
    },
  ];

  const tier4Layout = [
    {
      name: 'Run Governance AutoHacker v6 Fold Journey',
      command: 'npm',
      args: ['run', 'test:journey:governance-autohacker-v6'],
      cwd: projectRoot,
    },
    {
      name: 'Run Governance Flatten L3 Journey',
      command: 'npm',
      args: ['run', 'test:journey:governance-flatten-l3'],
      cwd: projectRoot,
    },
  ];

  const tier5Regression = [
    {
      name: 'Run Settings Master Plan Journey',
      command: 'npm',
      args: ['run', 'test:journey:settings-masterplan'],
      cwd: projectRoot,
    },
    {
      name: 'PI Baseline Propose Agent Unit Tests',
      command: 'node',
      args: ['--test', 'tests/Delivera-Governance-PIBaseline-Propose-Agent-Unit.mjs'],
      cwd: projectRoot,
    },
    {
      name: 'PI Baseline Slide Upload Probe (WhatsApp JPEG)',
      command: 'node',
      args: ['scripts/Delivera-Test-PIBaseline-Slide-Upload-01Probe.js'],
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

  const allSteps = [
    ...installStep,
    ...tier0Css,
    ...tier1Recent,
    ...tier2LastFailed,
    ...tier3Critical,
    ...tier4Layout,
    ...tier5Regression,
  ];
  return allSteps;
}

const PRIORITY_STEP_NAMES = new Set([
  'Install Dependencies',
  'Build CSS From Partials',
  'Verify Generated CSS Is In Sync',
  'Churn Trust Repair Journey (P0 governance + portfolio)',
  'Server Lifecycle Unit Tests (uptime guards)',
  'Governance Intervention Unit Tests',
  'Portfolio Decision Intelligence Unit Tests',
  'Cache Age-Tier TTL Unit Tests',
  'Run Cross-Page Persistence (last failed)',
  'Run API Integration Contracts',
  'Run Layout Overlap Journey',
  'Run Current Sprint Dedupe Fold Journey',
  'Run Brief SSOT Loading And Scope Journey',
]);

export function getPrioritySteps(projectRoot) {
  return getSteps(projectRoot).filter((step) => PRIORITY_STEP_NAMES.has(step.name));
}
