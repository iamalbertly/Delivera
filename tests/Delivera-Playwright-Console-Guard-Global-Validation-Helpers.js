import { test as base, expect } from '@playwright/test';
import { IGNORE_CONSOLE_ERRORS } from './Delivera-Tests-Shared-PreviewExport-Helpers.js';

/**
 * Global console + pageerror guard for Delivera Playwright tests.
 * Fails the current test (and, via --max-failures=1 in orchestration, the run)
 * on any browser console warning/error or uncaught page error.
 */

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const consoleMessages = [];
    const getAllowHttpStatusConsole = () => new Set(
      testInfo.annotations
        .filter((annotation) => annotation?.type === 'allow-http-status-console')
        .flatMap((annotation) => String(annotation.description || '').split(','))
        .map((value) => value.trim())
        .filter(Boolean)
    );
    const getAllowConsolePatterns = () => testInfo.annotations
      .filter((annotation) => annotation?.type === 'allow-console-pattern')
      .map((annotation) => {
        try {
          return new RegExp(String(annotation.description || ''), 'i');
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);

    const handleConsole = (msg) => {
      const type = msg.type();
      if (type !== 'error' && type !== 'warning') return;
      const text = msg.text();
      const location = typeof msg.location === 'function' ? msg.location() : {};
      const url = location && location.url ? String(location.url) : '';
      const title = String(testInfo.title || '');
      if (/stubbed preview/i.test(title) && /502 \(Bad Gateway\)/i.test(text || '')) return;
      // Known expected case: outcome-intake tests intentionally simulate handled
      // 409 duplicate and 422 validation responses from /api/outcome-from-narrative.
      const isExpectedOutcomeConflict =
        url.includes('/api/outcome-from-narrative') &&
        /status of (409|422)\b/i.test(text || '');
      if (isExpectedOutcomeConflict) return;
      const isExpectedOutcomeDraftClientError =
        url.includes('/api/outcome-draft') &&
        (/status of 400\b/i.test(text || '') || /400 \(Bad Request\)/i.test(text || ''));
      if (isExpectedOutcomeDraftClientError) return;
      const isExpectedSlideProposeError =
        url.includes('/api/governance/pi-baseline/propose-from-image') &&
        (/status of (400|500)\b/i.test(text || '') || /(400|500) \(/i.test(text || ''));
      if (isExpectedSlideProposeError) return;
      const isExpectedPreviewHttpRecovery =
        /preview\.json/i.test(url || text || '') &&
        (/status of (401|403|429|502)\b/i.test(text || '') || /502 \(Bad Gateway\)/i.test(text || ''));
      if (isExpectedPreviewHttpRecovery) return;
      const isExpectedCiDummyJiraGatewayFailure =
        process.env.CI === 'true' &&
        /example\.atlassian\.net/i.test(process.env.JIRA_HOST || '') &&
        /502 \(Bad Gateway\)/i.test(text || '') &&
        /failed to load resource/i.test(text || '');
      if (isExpectedCiDummyJiraGatewayFailure) return;
      const isTransientNetworkFlake =
        (/ERR_NETWORK_CHANGED|net::ERR_NETWORK_CHANGED/i.test(text || '') ||
          (/Failed to load resource/i.test(text || '') && /ERR_NETWORK_CHANGED/i.test(text || ''))) &&
        !/(Delivera-|\/public\/|governance-brief|portfolio-decision|gov-)/i.test(`${text} ${url}`);
      if (isTransientNetworkFlake) return;
      const allowHttpStatusConsole = getAllowHttpStatusConsole();
      const isAllowedHttpStatusConsole = Array.from(allowHttpStatusConsole).some((statusCode) =>
        new RegExp(`status of ${statusCode}\\b`, 'i').test(text || '')
      );
      if (isAllowedHttpStatusConsole) return;
      const allowConsolePatterns = getAllowConsolePatterns();
      if (allowConsolePatterns.some((pattern) => pattern.test(String(text || '')))) return;
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
