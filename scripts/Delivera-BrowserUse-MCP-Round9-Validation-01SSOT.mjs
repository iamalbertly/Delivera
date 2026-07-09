#!/usr/bin/env node
/**
 * SSOT: browser-use MCP validation checklist for Round 9 squad reality honesty.
 * Run after Playwright green: npm run test:mcp:round9
 */
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(process.cwd());
const DMS_FIXTURE = join(ROOT, 'data', 'testing_q2fy27_dms_commitments.png');
const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

const steps = [
  `Navigate: ${baseUrl}/governance`,
  'Assert: red .app-top-chrome visible',
  'Click: [data-testid="gov-pi-focus-set-baseline"] if present',
  'Navigate: /current-sprint?boardId=1',
  'Assert: [data-testid="sprint-next-up"] or limbo copy — not Healthy-only on idle squad',
  'Assert: [data-testid="sprint-commitment-risk"] list expanded',
  'Navigate: /actions — tabs show Send now / Needs decision',
  'Assert: [data-testid="actions-cadence-strip"] when worker receipt available',
  `Upload fixture: ${DMS_FIXTURE} via PI baseline wizard`,
  'Telemetry: no console errors across governance → sprint → actions',
];

console.log('=== Round 9 browser-use MCP validation checklist ===');
console.log(`Fixture present: ${existsSync(DMS_FIXTURE) ? 'yes' : 'NO'}`);
console.log(`Base URL: ${baseUrl}`);
steps.forEach((s, i) => console.log(`${String(i + 1).padStart(2, '0')}. ${s}`));
console.log('=== Run Playwright first: npm run test:journey:direct-value-r9 ===');
