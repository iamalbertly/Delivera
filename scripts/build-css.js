#!/usr/bin/env node
/**
 * Concatenates CSS partials from public/css/ in order into public/styles.css.
 * Skips write when concatenated content is unchanged (faster cold boot).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CSS_PARTIALS as PARTIALS } from './Delivera-CSS-Partial-Order-01SSOT.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const cssDir = path.join(projectRoot, 'public', 'css');
const outPath = path.join(projectRoot, 'public', 'styles.css');

const BUILD_COMMENT = `/* ═══════════════════════════════════════════════════════════════
   GENERATED FILE — DO NOT EDIT
   Built from public/css/ (13 partials — see public/css/README.md)
   To change styles: edit a partial, then run: npm run build:css
   ═══════════════════════════════════════════════════════════════ */\n`;

function main() {
  for (const name of PARTIALS) {
    const filePath = path.join(cssDir, name);
    if (!fs.existsSync(filePath)) {
      console.error(`[build-css] Missing required partial: ${name}`);
      process.exit(1);
    }
  }

  const chunks = [BUILD_COMMENT];
  for (const name of PARTIALS) {
    const filePath = path.join(cssDir, name);
    chunks.push(fs.readFileSync(filePath, 'utf-8'));
    if (!chunks[chunks.length - 1].endsWith('\n')) {
      chunks.push('\n');
    }
  }

  const next = chunks.join('');
  if (fs.existsSync(outPath)) {
    try {
      const prev = fs.readFileSync(outPath, 'utf-8');
      if (prev === next) {
        console.log('[build-css] Skipped (unchanged)');
        return;
      }
    } catch (_) { /* rewrite below */ }
  }

  fs.writeFileSync(outPath, next, 'utf-8');
  console.log('[build-css] Wrote public/styles.css');
}

main();
