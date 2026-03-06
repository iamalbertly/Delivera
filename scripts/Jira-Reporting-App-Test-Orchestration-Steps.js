/**
 * Test orchestration step definitions for Jira Reporting App.
 * SSOT for the ordered list of test steps. Used by Jira-Reporting-App-Test-Orchestration-Runner.js.
 * Playwright steps use --max-failures=1 so the run terminates on first failure (fail-fast).
 *
 * @param {string} projectRoot - Project root path (used as cwd for each step)
 * @returns {Array<{ name: string, command: string, args: string[], cwd: string }>}
 */

const PLAYWRIGHT_CMD = 'playwright';
const PLAYWRIGHT_BASE_ARGS = ['test'];
const PLAYWRIGHT_COMMON_FLAGS = ['--reporter=list', '--max-failures=1'];

function pwArgs(specPath, extra = []) {
  return [PLAYWRIGHT_CMD, ...PLAYWRIGHT_BASE_ARGS, specPath, ...extra, ...PLAYWRIGHT_COMMON_FLAGS];
}

export function getSteps(projectRoot) {
  const installStep = process.env.SKIP_NPM_INSTALL === 'true'
    ? []
    : [{ name: 'Install Dependencies', command: 'npm', args: ['install'], cwd: projectRoot }];

  return [
    ...installStep,
    {
      name: 'Run Focused SSOT Host and Table Containment Tests',
      command: 'npx',
      args: [
        PLAYWRIGHT_CMD,
        ...PLAYWRIGHT_BASE_ARGS,
        'tests/Jira-Reporting-App-API-Integration-Tests.spec.js',
        'tests/Jira-Reporting-App-UX-Reliability-Fixes-Tests.spec.js',
        '--grep',
        'jiraHostResolved',
        ...PLAYWRIGHT_COMMON_FLAGS,
      ],
      cwd: projectRoot
    },
    { name: 'Run Focused Cache Reliability API Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-API-Integration-Tests.spec.js', ['--grep', 'cache']), cwd: projectRoot },
    { name: 'Run Navigation Consistency Mobile Trust Realtime Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Navigation-Consistency-Mobile-Trust-Realtime-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Focused Mobile Responsive UX Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Mobile-Responsive-UX-Validation-Tests.spec.js'), cwd: projectRoot },
    {
      name: 'Run Focused Sprint Mobile Cards and Stale Selection Recovery Tests',
      command: 'npx',
      args: [
        PLAYWRIGHT_CMD,
        ...PLAYWRIGHT_BASE_ARGS,
        'tests/Jira-Reporting-App-Mobile-Responsive-UX-Validation-Tests.spec.js',
        'tests/Jira-Reporting-App-Current-Sprint-UX-SSOT-Validation-Tests.spec.js',
        '--grep',
        'stories render as cards|try-last-quarter recovery|stale saved sprint selection',
        ...PLAYWRIGHT_COMMON_FLAGS,
      ],
      cwd: projectRoot
    },
    { name: 'Run Realtime Logcat-Equivalent Responsive Validation Tests', command: 'npx', args: pwArgs('tests/Project-Jira-Reporting-UX-Responsiveness-Customer-Simplicity-Trust-Logcat-Realtime-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Direct-To-Value UX Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Direct-To-Value-UX-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Customer Speed Simplicity Trust Realtime Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Customer-Speed-Simplicity-Trust-Realtime-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run CSS Build And Mobile Responsive Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-CSS-Build-And-Mobile-Responsive-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Outcome-First First-Paint Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Outcome-First-First-Paint-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Customer Simplicity Trust Recovery Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Customer-Simplicity-Trust-Recovery-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Focused Current Sprint Health & SSOT Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Current-Sprint-Health-And-SSOT-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Outcome Intake And Readiness Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Outcome-Intake-And-Readiness-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Focused UX Outcome-First Nav And Trust Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-UX-Outcome-First-Nav-And-Trust-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Four Projects Q4 Data Validation Test', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Four-Projects-Q4-Data-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run API Integration Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-API-Integration-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Server Errors and Export Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Server-Errors-And-Export-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run UX Trust and Export Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-UX-Trust-And-Export-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Login Security Deploy Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Login-Security-Deploy-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run E2E User Journey Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-E2E-User-Journey-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run UX Reliability Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-UX-Reliability-Fixes-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run UX Critical Fixes Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-UX-Critical-Fixes-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run UX Report Flow & Exports Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-UX-Report-Flow-And-Exports-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Leadership Trends Usage & Guardrails Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Leadership-Trends-Usage-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run UX Outcome-First Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-UX-Outcome-First-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run UX Outcome-First No-Click-Hidden Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-UX-Outcome-First-No-Click-Hidden-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run UX Customer Simplicity Trust Full Validation Tests (SSOT)', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-UX-Customer-Simplicity-Trust-Full-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Feedback & Date Display Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Feedback-UX-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run CSV Export Fallback Test', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-CSV-Export-Fallback.spec.js'), cwd: projectRoot },
    { name: 'Run Date Window Ordering Test', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-DateWindow-Ordering.spec.js'), cwd: projectRoot },
    { name: 'Run Throughput Merge Test', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Throughput-Merge.spec.js'), cwd: projectRoot },
    { name: 'Run Epic Key Link Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-EpicKeyLinks.spec.js'), cwd: projectRoot },
    { name: 'Run Preview Retry Test', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Preview-Retry.spec.js'), cwd: projectRoot },
    { name: 'Run Preview Timeout and Error UI Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Preview-Timeout-Error-UI-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Server Feedback Endpoint Test', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Server-Feedback-Endpoint-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Column Titles & Tooltips Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Column-Tooltip-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Validation Plan Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Validation-Plan-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Excel Export Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Excel-Export-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Refactor SSOT Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Refactor-SSOT-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Boards Summary Filters Export Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Boards-Summary-Filters-Export-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Current Sprint and Leadership View Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Current-Sprint-Leadership-View-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Current Sprint UX and SSOT Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Current-Sprint-UX-SSOT-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Current Sprint Direct Value Blockers and Snapshot Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Current-Sprint-Blockers-Snapshot-Direct-Value-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Current Sprint Blockers Trust Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Current-Sprint-Blockers-Trust-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Current Sprint Blockers Edge Cases Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Current-Sprint-Blockers-EdgeCases-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Current Sprint Work Risks Hierarchy Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Current-Sprint-Work-Risks-Hierarchy-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Current Sprint Burndown Truthfulness Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Current-Sprint-Burndown-Truthfulness-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Current Sprint Edge Semantics Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Current-Sprint-Edge-Semantics-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Current Sprint Summary UX Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Current-Sprint-Summary-UX-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Current Sprint Clipboard & Markdown Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Current-Sprint-Clipboard-Markdown-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Current Sprint Export Last Action Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Current-Sprint-Export-Last-Action-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Cross-Page Persistence Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Cross-Page-Persistence-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Linkification and Empty-state UI Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Linkification-EmptyState-UI-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Vodacom Quarters SSOT Sprint Order Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Vodacom-Quarters-SSOT-Sprint-Order-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run General Performance Quarters UI Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-General-Performance-Quarters-UI-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run E2E Loading Meta Robustness Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-E2E-Loading-Meta-Robustness-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run UX Enhancements Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-UX-Enhancements.spec.js'), cwd: projectRoot },
    { name: 'Run Outcome Context Trust Validation Tests', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Outcome-Context-Trust-Validation-Tests.spec.js'), cwd: projectRoot },
    { name: 'Run Growth Velocity Test', command: 'npx', args: pwArgs('tests/Jira-Reporting-App-Report-GrowthVelocity-Validation-Tests.spec.js'), cwd: projectRoot },
  ];
}
