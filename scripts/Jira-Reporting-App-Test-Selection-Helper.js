/**
 * Smart test selection helper for Jira Reporting App test orchestration.
 *
 * This module is intentionally pure in its core selection logic: given
 * - the full ordered list of steps (from Jira-Reporting-App-Test-Orchestration-Steps.js)
 * - a list of changed files (relative paths from git)
 * - a list of last-failed spec paths
 * - a configured smoke pack of spec paths
 *
 * it returns an ordered subset of steps to run, plus metadata that can be
 * surfaced to developers for transparency and trust.
 */

import { basename } from 'path';

/**
 * Extract the first spec path (tests/....spec.js) from a step definition.
 * Kept for backward compatibility; prefer getSpecPathsFromStep for new logic.
 *
 * @param {{ args?: string[] }} step
 * @returns {string | null}
 */
export function getSpecPathFromStep(step) {
  const specs = getSpecPathsFromStep(step);
  return specs.length > 0 ? specs[0] : null;
}

/**
 * Extract all spec paths (tests/....spec.js) from a step definition.
 *
 * @param {{ args?: string[] }} step
 * @returns {string[]}
 */
export function getSpecPathsFromStep(step) {
  if (!step || !Array.isArray(step.args)) return null;
  return step.args.filter(
    (arg) => typeof arg === 'string' && arg.startsWith('tests/') && arg.endsWith('.spec.js'),
  );
}

/**
 * Build a mapping from spec path -> array of step indices that invoke it.
 *
 * @param {Array<{ args?: string[] }>} steps
 * @returns {{ specToStepIndexes: Map<string, number[]>, allSpecPaths: string[] }}
 */
export function buildSpecIndex(steps) {
  const specToStepIndexes = new Map();
  const allSpecPaths = [];

  steps.forEach((step, index) => {
    const specPaths = getSpecPathsFromStep(step);
    if (!specPaths || specPaths.length === 0) return;
    specPaths.forEach((specPath) => {
      if (!specToStepIndexes.has(specPath)) {
        specToStepIndexes.set(specPath, []);
        allSpecPaths.push(specPath);
      }
      specToStepIndexes.get(specPath).push(index);
    });
  });

  return { specToStepIndexes, allSpecPaths };
}

/**
 * Basic heuristic mapping from changed files to spec paths, using:
 * - exact matches for changed test files
 * - simple name-based matching between changed file basenames and spec basenames
 *
 * @param {string[]} changedFiles
 * @param {string[]} allSpecPaths
 * @returns {Set<string>} set of impacted spec paths
 */
export function deriveImpactedSpecs(changedFiles, allSpecPaths) {
  const impacted = new Set();
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) {
    return impacted;
  }

  const normalizedSpecs = allSpecPaths.map((specPath) => ({
    specPath,
    base: basename(specPath).toLowerCase(),
  }));

  const strongKeywords = [
    'preview',
    'current',
    'sprint',
    'leadership',
    'export',
    'excel',
    'csv',
    'feedback',
    'api',
    'e2e',
    'mobile',
    'responsive',
    'navigation',
    'quarters',
    'ssot',
    'trust',
    'velocity',
    'host',
    'table',
  ];

  for (const rawChanged of changedFiles) {
    if (typeof rawChanged !== 'string' || !rawChanged.trim()) continue;

    // Normalize path separators to forward slashes for matching.
    const changed = rawChanged.replace(/\\/g, '/');

    // If the changed file itself is a spec that appears in the steps list, include it directly.
    if (changed.startsWith('tests/') && changed.endsWith('.spec.js')) {
      if (allSpecPaths.includes(changed)) {
        impacted.add(changed);
        continue;
      }
    }

    const changedBase = basename(changed).toLowerCase();
    if (!changedBase) continue;

    // Tokenize the changed file name on non-alphanumeric boundaries.
    const tokens = changedBase
      .split(/[^a-z0-9]+/i)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);

    if (tokens.length === 0) continue;

    for (const { specPath, base } of normalizedSpecs) {
      // Strong match: share at least one strong keyword token.
      const hasStrongKeyword = strongKeywords.some(
        (kw) => changedBase.includes(kw) && base.includes(kw),
      );

      // Fallback match: any token from the changed filename appears in spec filename.
      const hasTokenMatch = tokens.some((t) => base.includes(t));

      if (hasStrongKeyword || hasTokenMatch) {
        impacted.add(specPath);
      }
    }
  }

  return impacted;
}

/**
 * Core selection function.
 *
 * @param {Object} options
 * @param {Array<{ name: string, command: string, args: string[], cwd: string }>} options.steps
 * @param {string[]} options.changedFiles - relative paths from git
 * @param {string[]} options.lastFailedSpecs - spec paths from previous run
 * @param {string[]} options.smokeSpecPaths - core smoke tests (subset of spec paths)
 * @param {boolean} options.full - when true, bypass selection and return all steps
 * @returns {{ steps: Array, info: { mode: string, totalSteps: number, selectedCount: number, lastFailedCount: number, impactedCount: number, smokeCount: number, changedFilesCount: number } }}
 */
export function selectStepsForRun({
  steps,
  changedFiles = [],
  lastFailedSpecs = [],
  smokeSpecPaths = [],
  full = false,
}) {
  const totalSteps = Array.isArray(steps) ? steps.length : 0;

  if (!Array.isArray(steps) || totalSteps === 0) {
    return {
      steps: [],
      info: {
        mode: 'empty',
        totalSteps: 0,
        selectedCount: 0,
        lastFailedCount: 0,
        impactedCount: 0,
        smokeCount: 0,
        changedFilesCount: Array.isArray(changedFiles) ? changedFiles.length : 0,
      },
    };
  }

  if (full) {
    return {
      steps,
      info: {
        mode: 'full',
        totalSteps,
        selectedCount: totalSteps,
        lastFailedCount: 0,
        impactedCount: totalSteps,
        smokeCount: 0,
        changedFilesCount: Array.isArray(changedFiles) ? changedFiles.length : 0,
      },
    };
  }

  const { specToStepIndexes, allSpecPaths } = buildSpecIndex(steps);
  const changedFilesSafe = Array.isArray(changedFiles) ? changedFiles : [];

  const lastFailedSet = new Set(
    (Array.isArray(lastFailedSpecs) ? lastFailedSpecs : []).filter((s) => specToStepIndexes.has(s)),
  );

  const impactedSpecs = deriveImpactedSpecs(changedFilesSafe, allSpecPaths);

  const impactedSet = new Set(
    Array.from(impactedSpecs).filter((s) => specToStepIndexes.has(s) && !lastFailedSet.has(s)),
  );

  const smokeSet = new Set(
    (Array.isArray(smokeSpecPaths) ? smokeSpecPaths : []).filter((s) => specToStepIndexes.has(s)),
  );

  const selectedIndexes = [];
  const seenIndexes = new Set();

  const addSpecGroup = (specPaths) => {
    for (const specPath of specPaths) {
      const indexes = specToStepIndexes.get(specPath);
      if (!indexes || indexes.length === 0) continue;
      // Use the first step index for a given spec path to avoid running duplicates.
      const index = indexes[0];
      if (!seenIndexes.has(index)) {
        seenIndexes.add(index);
        selectedIndexes.push(index);
      }
    }
  };

  // 1. Last-failed specs first.
  addSpecGroup(lastFailedSet);

  // 2. Impacted specs from changed files.
  addSpecGroup(impactedSet);

  // 3. Smoke pack as fallback when nothing is selected.
  let smokeUsed = new Set();
  if (selectedIndexes.length === 0 && smokeSet.size > 0) {
    smokeUsed = smokeSet;
    addSpecGroup(smokeSet);
  }

  const selectedSteps =
    selectedIndexes.length === 0
      ? steps
      : selectedIndexes.sort((a, b) => a - b).map((index) => steps[index]);

  const mode =
    selectedIndexes.length === 0 && (lastFailedSet.size > 0 || changedFilesSafe.length > 0)
      ? 'fallback-full'
      : selectedIndexes.length === 0
        ? 'fallback-full'
        : lastFailedSet.size > 0 && impactedSet.size > 0
          ? 'last-failed-and-impacted'
          : lastFailedSet.size > 0
            ? 'last-failed-only'
            : impactedSet.size > 0
              ? 'impacted-only'
              : smokeUsed.size > 0
                ? 'smoke-only'
                : 'fallback-full';

  return {
    steps: selectedSteps,
    info: {
      mode,
      totalSteps,
      selectedCount: selectedSteps.length,
      lastFailedCount: lastFailedSet.size,
      impactedCount: impactedSet.size,
      smokeCount: smokeUsed.size,
      changedFilesCount: changedFilesSafe.length,
    },
  };
}
