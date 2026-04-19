/**
 * Ensures browser preview budget helpers stay aligned with server SSOT
 * (`lib/Delivera-Preview-Client-Budget-SSOT.js`).
 */
import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';
import { derivePreviewClientBudgetMs as serverDerive } from '../lib/Delivera-Preview-Client-Budget-SSOT.js';
import { derivePreviewClientBudgetMs as clientDerive } from '../public/Delivera-Report-Page-Preview-Complexity-Config.js';

const cases = [
  { previewMode: 'normal', rangeDays: 10, clientBudgetMsOverride: Number.NaN },
  { previewMode: 'normal', rangeDays: 90, clientBudgetMsOverride: Number.NaN },
  { previewMode: 'recent-first', rangeDays: 30, clientBudgetMsOverride: Number.NaN },
  { previewMode: 'recent-only', rangeDays: 400, clientBudgetMsOverride: Number.NaN },
  { previewMode: 'normal', rangeDays: 20, clientBudgetMsOverride: 88000 },
];

test('derivePreviewClientBudgetMs matches server SSOT for representative inputs', () => {
  for (const c of cases) {
    expect(clientDerive(c)).toBe(serverDerive(c));
  }
});
