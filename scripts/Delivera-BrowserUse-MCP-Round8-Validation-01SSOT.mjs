#!/usr/bin/env node
/**
 * SSOT: browser-use MCP validation checklist for Round 8 AI trust sync.
 * Run after Playwright green: npm run test:mcp:round8
 *
 * Agent steps (user-browser-use MCP):
 * 1. browser_navigate → {BASE_URL}/governance (authenticated session)
 * 2. browser_get_state — trust pill data-ai-slide-ready=1 when .env OpenRouter set
 * 3. browser_click PI focus "Upload PI slide"
 * 4. browser_extract_content — [data-ai-slide-ready="1"] in drawer
 * 5. Playwright handles file upload (MCP has no setInputFiles); verify via step 6 after manual/agent upload
 * 6. browser_screenshot — context banner shows DMS + FY27 Q2 after data/testing_q2fy27_dms_commitments.png
 * 7. browser_navigate → /settings — #gov-ai-helper data-ai-slide-ready
 * 8. browser_get_state — zero console errors
 *
 * Live probe (optional): node scripts/Delivera-Test-PIBaseline-Slide-Upload-01Probe.js --dms-q2
 */
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(process.cwd());
const DMS_FIXTURE = join(ROOT, 'data', 'testing_q2fy27_dms_commitments.png');
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const steps = [
  `Navigate: ${baseUrl}/governance`,
  'Assert: [data-ai-trust-pill][data-ai-slide-ready] on top chrome',
  'Click: [data-testid="gov-pi-focus-set-baseline"]',
  'Assert: [data-ai-slide-ready="1"] and #gov-baseline-slide-input not disabled',
  `Upload fixture: ${DMS_FIXTURE} via Playwright or app UI`,
  'Assert: [data-testid="gov-baseline-context"] contains DMS and FY27 Q2',
  `Navigate: ${baseUrl}/settings — #gov-ai-helper visible`,
  'Telemetry: no console errors on governance → settings → governance',
];

console.log('=== Round 8 browser-use MCP validation checklist ===');
console.log(`Fixture present: ${existsSync(DMS_FIXTURE) ? 'yes' : 'NO — add data/testing_q2fy27_dms_commitments.png'}`);
console.log(`Base URL: ${baseUrl}`);
steps.forEach((s, i) => console.log(`${String(i + 1).padStart(2, '0')}. ${s}`));
console.log('=== Run Playwright first: npm run test:journey:direct-value-r8 ===');
