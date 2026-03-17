// SSOT: Playwright spec → journey → layer → page mapping
// This module centralises which real-world journeys each spec protects so that
// npm scripts, orchestration steps, and documentation can all share the same view.

export const specMetadata = {
  // Current Sprint – core UX, risks, health, leadership bridge
  'tests/Jira-Reporting-App-Current-Sprint-UX-SSOT-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-CurrentSprint-Redesign-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-CurrentSprint-Mission-Control-Direct-Value-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-Current-Sprint-Health-And-SSOT-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-Current-Sprint-Blockers-Snapshot-Direct-Value-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-Current-Sprint-Blockers-Trust-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-Current-Sprint-Blockers-EdgeCases-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-Current-Sprint-Work-Risks-Hierarchy-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-Current-Sprint-Burndown-Truthfulness-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-Current-Sprint-Edge-Semantics-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-Current-Sprint-Summary-UX-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-Current-Sprint-Clipboard-Markdown-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-Current-Sprint-Export-Last-Action-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },

  // Leadership journeys (leadership page + leadership-flavoured current sprint)
  'tests/Jira-Reporting-App-Current-Sprint-Leadership-View-Tests.spec.js': {
    journey: 'journey.leadership',
    layer: 'page-ux',
    page: '/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-Leadership-Trends-Usage-Validation-Tests.spec.js': {
    journey: 'journey.leadership',
    layer: 'page-ux',
    page: '/sprint-leadership',
  },
  'tests/Jira-Reporting-App-Boards-Summary-Filters-Export-Validation-Tests.spec.js': {
    journey: 'journey.leadership',
    layer: 'page-ux',
    page: '/sprint-leadership,/report',
  },

  // Outcome intake and outcome-first UX
  'tests/Jira-Reporting-App-Outcome-Intake-And-Readiness-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-Outcome-Context-Trust-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/current-sprint,/report',
  },
  'tests/Jira-Reporting-App-Outcome-First-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-Outcome-First-No-Click-Hidden-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/report,/current-sprint',
  },
  'tests/Jira-Reporting-App-Outcome-First-Nav-And-Trust-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-Outcome-First-First-Paint-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-Viewport-Compression-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'layout/responsiveness',
    page: '/report,/current-sprint,/sprint-leadership',
  },

  // Global UX, navigation, trust, responsiveness
  'tests/Jira-Reporting-App-UX-Trust-And-Export-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-UX-Customer-Simplicity-Trust-Full-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/login,/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-Customer-Speed-Simplicity-Trust-Realtime-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-Customer-Simplicity-Trust-Recovery-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report',
  },
  'tests/Jira-Reporting-App-Navigation-Consistency-Mobile-Trust-Realtime-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'layout/responsiveness',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-Mobile-Responsive-UX-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'layout/responsiveness',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Project-Jira-Reporting-UX-Responsiveness-Customer-Simplicity-Trust-Logcat-Realtime-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'layout/responsiveness',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-UX-Login-Trust-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/login',
  },
  'tests/Jira-Reporting-App-UX-Report-Flow-And-Exports-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report',
  },
  'tests/Jira-Reporting-App-UX-Enhancements.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-Direct-To-Value-UX-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Jira-Reporting-App-CSS-Build-And-Mobile-Responsive-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'layout/responsiveness',
    page: '/report,/current-sprint',
  },
  'tests/Jira-Reporting-App-Feedback-UX-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint',
  },
  'tests/Jira-Reporting-App-Performance-Budgets-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint',
  },
  'tests/Jira-Reporting-App-UX-Consolidation-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/leadership',
  },

  // API + data integrity, exports, contracts
  'tests/Jira-Reporting-App-API-Integration-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'api-contract',
    page: '/api',
  },
  'tests/Jira-Reporting-App-Data-Integrity-Coherence-Contracts.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/api',
  },
  'tests/Jira-Reporting-App-Refactor-SSOT-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Jira-Reporting-App-Four-Projects-Q4-Data-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Jira-Reporting-App-Vodacom-Quarters-SSOT-Sprint-Order-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-General-Performance-Quarters-UI-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'page-ux',
    page: '/report',
  },
  'tests/Jira-Reporting-App-Report-GrowthVelocity-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Jira-Reporting-App-DateWindow-Ordering.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Jira-Reporting-App-Throughput-Merge.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Jira-Reporting-App-CSV-Export-Fallback.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Jira-Reporting-App-Excel-Export-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Jira-Reporting-App-Column-Tooltip-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'page-ux',
    page: '/report',
  },
  'tests/Jira-Reporting-App-Server-Feedback-Endpoint-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'api-contract',
    page: '/api',
  },
  'tests/Jira-Reporting-App-Validation-Plan-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report,/current-sprint,/sprint-leadership',
  },

  // Reliability, errors, preview, cross-page behaviour
  'tests/Jira-Reporting-App-Server-Errors-And-Export-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'services',
    page: '/report',
  },
  'tests/Jira-Reporting-App-UX-Reliability-Fixes-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-UX-Critical-Fixes-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-Linkification-EmptyState-UI-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint',
  },
  'tests/Jira-Reporting-App-Cross-Page-Persistence-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-Preview-Timeout-Error-UI-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'services',
    page: '/report',
  },
  'tests/Jira-Reporting-App-Preview-Retry.spec.js': {
    journey: 'journey.ux-core',
    layer: 'services',
    page: '/report',
  },

  // E2E journeys, deploy and load robustness
  'tests/Jira-Reporting-App-Login-Security-Deploy-Validation-Tests.spec.js': {
    journey: 'journey.e2e',
    layer: 'e2e-journey',
    page: '/login',
  },
  'tests/Jira-Reporting-App-Deploy-Smoke-Validation-Tests.spec.js': {
    journey: 'journey.e2e',
    layer: 'e2e-journey',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-E2E-User-Journey-Tests.spec.js': {
    journey: 'journey.e2e',
    layer: 'e2e-journey',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Jira-Reporting-App-E2E-Loading-Meta-Robustness-Tests.spec.js': {
    journey: 'journey.e2e',
    layer: 'e2e-journey',
    page: '/report,/current-sprint,/sprint-leadership',
  },

  // Misc focused tests that still fit buckets
  'tests/Jira-Reporting-App-EpicKeyLinks.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'page-ux',
    page: '/report',
  },
};

export const journeyBuckets = {
  'journey.current-sprint': {
    id: 'journey.current-sprint',
    label: 'Current Sprint – Core & Risks',
    specs: Object.keys(specMetadata).filter(
      (spec) => specMetadata[spec].journey === 'journey.current-sprint',
    ),
  },
  'journey.leadership': {
    id: 'journey.leadership',
    label: 'Leadership – Trends & Boards',
    specs: Object.keys(specMetadata).filter(
      (spec) => specMetadata[spec].journey === 'journey.leadership',
    ),
  },
  'journey.outcome-intake': {
    id: 'journey.outcome-intake',
    label: 'Outcome Intake – Outcome-First Readiness',
    specs: Object.keys(specMetadata).filter(
      (spec) => specMetadata[spec].journey === 'journey.outcome-intake',
    ),
  },
  'journey.ux-core': {
    id: 'journey.ux-core',
    label: 'UX Core – Navigation, Trust, Responsiveness',
    specs: Object.keys(specMetadata).filter(
      (spec) => specMetadata[spec].journey === 'journey.ux-core',
    ),
  },
  'journey.shell-direct-value': {
    id: 'journey.shell-direct-value',
    label: 'Shell Direct Value â€“ Report, Current Sprint, Outcome, Responsive',
    specs: [
      'tests/Jira-Reporting-App-CurrentSprint-Mission-Control-Direct-Value-Validation-Tests.spec.js',
      'tests/Jira-Reporting-App-CurrentSprint-Redesign-Validation-Tests.spec.js',
      'tests/Jira-Reporting-App-Outcome-Intake-And-Readiness-Validation-Tests.spec.js',
      'tests/Jira-Reporting-App-CSS-Build-And-Mobile-Responsive-Validation-Tests.spec.js',
    ],
  },
  'journey.data-integrity': {
    id: 'journey.data-integrity',
    label: 'Data Integrity – API, Contracts, Exports',
    specs: Object.keys(specMetadata).filter(
      (spec) => specMetadata[spec].journey === 'journey.data-integrity',
    ),
  },
  'journey.e2e': {
    id: 'journey.e2e',
    label: 'Full E2E Journeys & Deploy Smoke',
    specs: Object.keys(specMetadata).filter(
      (spec) => specMetadata[spec].journey === 'journey.e2e',
    ),
  },
};

export function getJourneySpecs(journeyId) {
  const bucket = journeyBuckets[journeyId];
  return bucket ? bucket.specs.slice() : [];
}

export function getSpecMeta(specPath) {
  return specMetadata[specPath] || null;
}
