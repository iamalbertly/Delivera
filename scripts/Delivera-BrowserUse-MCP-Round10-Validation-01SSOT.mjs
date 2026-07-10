#!/usr/bin/env node
/**
 * SSOT: browser-use MCP validation checklist for PI slide vision + epic format.
 * Run after Playwright green: npm run test:mcp:round10
 */
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(process.cwd());
const DMS_FIXTURE = join(ROOT, 'data', 'testing_q2fy27_dms_commitments.png');
const DMS_FIXTURE_ALT = join(ROOT, 'data', 'testing_q2fy27_dms_commitments.jpeg');
const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

const steps = [
  `Navigate: ${baseUrl}/governance`,
  'Click: [data-testid="portfolio-primary-cta"] or Upload PI slide',
  'Assert: [data-testid="gov-baseline-slide-optional"] open with enabled #gov-baseline-slide-input',
  `Upload fixture via Playwright: ${DMS_FIXTURE}`,
  'Assert: [data-testid="gov-baseline-context"] contains DMS and FY27 Q2 after successful extraction',
  'Assert: [data-testid="gov-baseline-slide-summary"] shows matched/missing counts',
  `Navigate: ${baseUrl}/settings#organization`,
  'Assert: [data-testid="settings-epic-format-panel"] visible with preview',
  'Telemetry: no console errors governance → settings → current-sprint',
];

console.log('=== Round 10 browser-use MCP validation checklist ===');
console.log(`Fixture present: ${(existsSync(DMS_FIXTURE) || existsSync(DMS_FIXTURE_ALT)) ? 'yes' : 'NO — add data/testing_q2fy27_dms_commitments.png'}`);
console.log(`Base URL: ${baseUrl}`);
steps.forEach((s, i) => console.log(`${String(i + 1).padStart(2, '0')}. ${s}`));
console.log('=== Run Playwright first: npm run test:journey:governance-p0 ===');
