#!/usr/bin/env node
/**
 * SSOT: browser-use MCP validation checklist for Round 11 portfolio direct-value.
 * Run after Playwright green: npm run test:mcp:round11
 */
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(process.cwd());
const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

const steps = [
  `Navigate: ${baseUrl}/governance`,
  'Assert: [data-portfolio-signal] visible within 8s',
  'Assert: [data-testid="portfolio-bento-card"] count >= 4',
  'Assert: [data-testid="portfolio-scope-breadcrumb"] contains Compare',
  'Click: [data-testid="portfolio-bento-card"] (second card)',
  'Click: [data-portfolio-decision-radios] input (first option)',
  'Click: [data-portfolio-action="view-governance-evidence"]',
  'Navigate: /current-sprint?projects=SD',
  'Assert: #stories-card or sprint shell visible',
  'Navigate: /actions?tab=ready',
  'Assert: #actions-preview-rail visible on desktop viewport',
  'Screenshot: full page governance + actions',
  'Telemetry: user-facing runtime alerts = 0 without ?debug=1',
];

console.log('=== Round 11 browser-use MCP validation checklist ===');
console.log(`Base URL: ${baseUrl}`);
console.log(`Governance fixture optional: ${existsSync(join(ROOT, 'data', 'testing_q2fy27_dms_commitments.png')) ? 'yes' : 'no'}`);
steps.forEach((s, i) => console.log(`${String(i + 1).padStart(2, '0')}. ${s}`));
console.log('=== Run Playwright first: npm run test:journey:portfolio-round11 ===');
