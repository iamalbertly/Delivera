#!/usr/bin/env node
/**
 * CI guard: verifies public/styles.css matches a fresh build from partials.
 * Fails with exit code 1 if someone edited styles.css directly instead of a partial.
 *
 * Usage: node scripts/check-css.js
 * Add to CI: npm run build:css && npm run check:css
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const cssDir = path.join(projectRoot, 'public', 'css');
const outPath = path.join(projectRoot, 'public', 'styles.css');

const PARTIALS = [
  '01-reset-vars.css',
  '02-layout-container.css',
  '03-nav-sidebar.css',
  '12-top-chrome.css',
  '04-filters-report.css',
  '05-tables-export.css',
  '06-current-sprint.css',
  '07-leadership.css',
  '08-modals-misc.css',
  '09-governance.css',
  '10-meeting-first-surfaces.css',
  '11-executive-pulse.css',
];

const BUILD_COMMENT = `/* ═══════════════════════════════════════════════════════════════
   GENERATED FILE — DO NOT EDIT
   Built from public/css/ (12 partials — see public/css/README.md)
   To change styles: edit a partial, then run: npm run build:css
   ═══════════════════════════════════════════════════════════════ */\n`;

function buildExpected() {
  const chunks = [BUILD_COMMENT];
  for (const name of PARTIALS) {
    const filePath = path.join(cssDir, name);
    if (!fs.existsSync(filePath)) {
      console.error(`[check-css] Missing partial: ${name}`);
      process.exit(1);
    }
    chunks.push(fs.readFileSync(filePath, 'utf-8'));
    if (!chunks[chunks.length - 1].endsWith('\n')) chunks.push('\n');
  }
  return chunks.join('');
}

const expected = buildExpected();
// Normalize line endings for comparison (Windows CRLF vs LF)
const normalize = (s) => s.replace(/\r\n/g, '\n');
const actual = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf-8') : '';

if (normalize(actual) !== normalize(expected)) {
  console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  CHECK FAILED: public/styles.css is out of sync with partials.  ║
║                                                                  ║
║  public/styles.css is GENERATED — do not edit it directly.      ║
║  1. Edit the correct partial in public/css/                      ║
║  2. Run: npm run build:css                                       ║
║  See: public/css/README.md for which partial to edit.            ║
╚══════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

console.log('[check-css] ✓ public/styles.css is in sync with partials.');
