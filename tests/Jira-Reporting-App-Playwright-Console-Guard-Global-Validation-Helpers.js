import { test as base, expect } from '@playwright/test';
import { IGNORE_CONSOLE_ERRORS } from './JiraReporting-Tests-Shared-PreviewExport-Helpers.js';

/**
 * Global console + pageerror guard for Jira Reporting App Playwright tests.
 * Fails the current test (and, via --max-failures=1 in orchestration, the run)
 * on any browser console warning/error or uncaught page error.
 */

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const consoleMessages = [];
    const allowHttpStatusConsole = new Set(
      testInfo.annotations
        .filter((annotation) => annotation?.type === 'allow-http-status-console')
        .flatMap((annotation) => String(annotation.description || '').split(','))
        .map((value) => value.trim())
        .filter(Boolean)
    );

    const handleConsole = (msg) => {
      const type = msg.type();
      if (type !== 'error' && type !== 'warning') return;
      const text = msg.text();
      const location = typeof msg.location === 'function' ? msg.location() : {};
      const url = location && location.url ? String(location.url) : '';
      // Known expected case: outcome-intake dedupe tests intentionally simulate a 409 Conflict
      // from /api/outcome-from-narrative. We treat that as handled UX, not a failing console error.
      const isExpectedOutcomeConflict =
        url.includes('/api/outcome-from-narrative') &&
        /status of 409/i.test(text || '');
      if (isExpectedOutcomeConflict) return;
      const isExpectedPreviewHttpRecovery =
        /preview\.json/i.test(url || text || '') &&
        /status of (401|403|429)\b/i.test(text || '');
      if (isExpectedPreviewHttpRecovery) return;
      const isAllowedHttpStatusConsole = Array.from(allowHttpStatusConsole).some((statusCode) =>
        new RegExp(`status of ${statusCode}\\b`, 'i').test(text || '')
      );
      if (isAllowedHttpStatusConsole) return;
      if (IGNORE_CONSOLE_ERRORS.some((ignored) => text === ignored || text.includes(ignored))) return;
      consoleMessages.push(`[console:${type}] ${text}`);
    };

    const handlePageError = (error) => {
      const message = (error && error.message) ? error.message : String(error || 'Unknown page error');
      consoleMessages.push(`[pageerror] ${message}`);
    };

    page.on('console', handleConsole);
    page.on('pageerror', handlePageError);

    await use(page);

    page.off('console', handleConsole);
    page.off('pageerror', handlePageError);

    if (consoleMessages.length) {
      // Surface as a hard failure with details; orchestration already uses --max-failures=1.
      const details = consoleMessages.join('\n');
      try {
        testInfo.annotations.push({
          type: 'console-errors',
          description: details,
        });
      } catch (_) {
        // best-effort; annotation is optional
      }
      throw new Error('Console errors or warnings detected during test run:\n' + details);
    }
  },
});

export { expect } from '@playwright/test';
