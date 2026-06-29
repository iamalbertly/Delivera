/**
 * State matrix summary — worst metrics across configured states.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { resolveProjectRoot, resolveRunDir } from './autohacker-collector-lib.mjs';

const root = resolveProjectRoot(import.meta.url);
const runDir = resolveRunDir(root);

function readJson(name) {
  const p = join(runDir, name);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

const reports = {
  horizontalVoid: readJson('horizontal-void-report.json'),
  contentOverlap: readJson('content-overlap-report.json'),
  negativeVoid: readJson('negative-void-report.json'),
  mainColumnVoid: readJson('main-column-void-report.json'),
  hiddenValue: readJson('hidden-value-report.json'),
  metrics: readJson('metrics-snapshot.json'),
  screenshotDensity: readJson('screenshot-density-report.json'),
};

const summary = {
  capturedAt: new Date().toISOString(),
  worst: {
    horizontalVoidRatio: reports.horizontalVoid?.horizontalVoidRatio ?? null,
    overlapPxTotal: reports.contentOverlap?.overlapPxTotal ?? null,
    stackingDetected: reports.negativeVoid?.stackingDetected ?? reports.mainColumnVoid?.stackingDetected ?? false,
    mainColumnVoidPx: reports.mainColumnVoid?.mainColumnVoidPx ?? reports.negativeVoid?.mainColumnVoidPx ?? null,
    hiddenValueCount: reports.hiddenValue?.hiddenValueCount ?? null,
    stickyChromeRatio: reports.metrics?.stickyChromeRatio ?? null,
    leftWhitespaceRatio: reports.screenshotDensity?.leftWhitespaceRatio ?? null,
  },
  pass: Boolean(
    reports.horizontalVoid?.pass !== false
    && reports.contentOverlap?.pass !== false
    && reports.negativeVoid?.pass !== false
    && (reports.mainColumnVoid?.pass !== false)
    && (reports.hiddenValue?.pass !== false)
    && (reports.screenshotDensity?.pass !== false),
  ),
  reportsPresent: Object.fromEntries(Object.entries(reports).map(([k, v]) => [k, !!v])),
};

mkdirSync(runDir, { recursive: true });
const outPath = join(runDir, 'state-matrix-summary.json');
writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log('Wrote', outPath);
console.log(JSON.stringify(summary.worst, null, 2));
