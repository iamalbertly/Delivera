// SSOT: Playwright spec → journey → layer → page mapping
// This module centralises which real-world journeys each spec protects so that
// npm scripts, orchestration steps, and documentation can all share the same view.

export const specMetadata = {
  // Current Sprint – core UX, risks, health, leadership bridge
  'tests/Delivera-Current-Sprint-UX-SSOT-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-CurrentSprint-Redesign-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-CurrentSprint-Mission-Control-Direct-Value-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-Current-Sprint-Health-And-SSOT-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-Current-Sprint-Blockers-Snapshot-Direct-Value-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-Current-Sprint-Blockers-Trust-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-Current-Sprint-Blockers-EdgeCases-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-Current-Sprint-Work-Risks-Hierarchy-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-Current-Sprint-Burndown-Truthfulness-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-Current-Sprint-Edge-Semantics-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-Current-Sprint-Summary-UX-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-Current-Sprint-Clipboard-Markdown-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-Current-Sprint-Export-Last-Action-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-Vodacom-Executive-Shell-And-Sprint-Cockpit-Validation-Tests.spec.js': {
    journey: 'journey.current-sprint',
    layer: 'page-ux',
    page: '/home,/backlog-intake,/roadmap,/teams,/settings,/current-sprint',
  },

  // Leadership journeys (leadership page + leadership-flavoured current sprint)
  'tests/Delivera-Current-Sprint-Leadership-View-Tests.spec.js': {
    journey: 'journey.leadership',
    layer: 'page-ux',
    page: '/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-Leadership-Trends-Usage-Validation-Tests.spec.js': {
    journey: 'journey.leadership',
    layer: 'page-ux',
    page: '/sprint-leadership',
  },
  'tests/Delivera-Boards-Summary-Filters-Export-Validation-Tests.spec.js': {
    journey: 'journey.leadership',
    layer: 'page-ux',
    page: '/sprint-leadership,/report',
  },
  'tests/Delivera-Leadership-Investment-KPI-Validation-Tests.spec.js': {
    journey: 'journey.leadership',
    layer: 'page-ux',
    page: '/leadership,/report#trends',
  },

  // Outcome intake and outcome-first UX
  'tests/Delivera-Outcome-Intake-And-Readiness-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-Outcome-Draft-Assistant-Direct-Value-Logcat-Realtime-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/report',
  },
  'tests/Delivera-Outcome-Validation-Screen-And-Epic-Level-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/report',
  },
  'tests/Delivera-Outcome-First-Direct-Value-IA-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/report',
  },
  'tests/Delivera-Outcome-Context-Trust-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/current-sprint,/report',
  },
  'tests/Delivera-Outcome-First-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-Outcome-First-No-Click-Hidden-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/report,/current-sprint',
  },
  'tests/Delivera-Outcome-First-Nav-And-Trust-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-Outcome-First-First-Paint-Validation-Tests.spec.js': {
    journey: 'journey.outcome-intake',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-Viewport-Compression-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'layout/responsiveness',
    page: '/report,/current-sprint,/sprint-leadership',
  },

  // Global UX, navigation, trust, responsiveness
  'tests/Delivera-UX-Trust-And-Export-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-UX-Customer-Simplicity-Trust-Full-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/login,/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-Customer-Speed-Simplicity-Trust-Realtime-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-Customer-Simplicity-Trust-Recovery-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report',
  },
  'tests/Delivera-Navigation-Consistency-Mobile-Trust-Realtime-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'layout/responsiveness',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-Mobile-Responsive-UX-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'layout/responsiveness',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Project-Delivera-UX-Responsiveness-Customer-Simplicity-Trust-Logcat-Realtime-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'layout/responsiveness',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-UX-Login-Trust-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/login',
  },
  'tests/Delivera-UX-Report-Flow-And-Exports-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report',
  },
  'tests/Delivera-UX-Enhancements.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-Direct-To-Value-UX-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/current-sprint',
  },
  'tests/Delivera-CSS-Build-And-Mobile-Responsive-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'layout/responsiveness',
    page: '/report,/current-sprint',
  },
  'tests/Delivera-Feedback-UX-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint',
  },
  'tests/Delivera-Performance-Budgets-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint',
  },
  'tests/Delivera-UX-Consolidation-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/leadership',
  },
  'tests/Delivera-Overlay-Context-And-Attention-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/leadership',
  },
  'tests/Delivera-Report-Chrome-Direct-Value-Realtime-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report',
  },

  // API + data integrity, exports, contracts
  'tests/Delivera-API-Integration-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'api-contract',
    page: '/api',
  },
  'tests/Delivera-Data-Integrity-Coherence-Contracts.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/api',
  },
  'tests/Delivera-Refactor-SSOT-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Delivera-Four-Projects-Q4-Data-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Delivera-Vodacom-Quarters-SSOT-Sprint-Order-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report,/sprint-leadership',
  },
  'tests/Delivera-General-Performance-Quarters-UI-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'page-ux',
    page: '/report',
  },
  'tests/Delivera-Report-GrowthVelocity-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Delivera-DateWindow-Ordering.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Delivera-Preview-Budget-Parity-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Delivera-Throughput-Merge.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Delivera-CSV-Export-Fallback.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Delivera-Excel-Export-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report',
  },
  'tests/Delivera-Column-Tooltip-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'page-ux',
    page: '/report',
  },
  'tests/Delivera-Server-Feedback-Endpoint-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'api-contract',
    page: '/api',
  },
  'tests/Delivera-Validation-Plan-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'data-contract',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-Vodacom-Executive-Api-Contract-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'api-contract',
    page: '/api/current-sprint.json',
  },

  // Reliability, errors, preview, cross-page behaviour
  'tests/Delivera-Server-Errors-And-Export-Validation-Tests.spec.js': {
    journey: 'journey.data-integrity',
    layer: 'services',
    page: '/report',
  },
  'tests/Delivera-UX-Reliability-Fixes-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-UX-Critical-Fixes-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-Linkification-EmptyState-UI-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint',
  },
  'tests/Delivera-Cross-Page-Persistence-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'page-ux',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-Preview-Timeout-Error-UI-Validation-Tests.spec.js': {
    journey: 'journey.ux-core',
    layer: 'services',
    page: '/report',
  },
  'tests/Delivera-Preview-Retry.spec.js': {
    journey: 'journey.ux-core',
    layer: 'services',
    page: '/report',
  },

  // E2E journeys, deploy and load robustness
  'tests/Delivera-Login-Security-Deploy-Validation-Tests.spec.js': {
    journey: 'journey.e2e',
    layer: 'e2e-journey',
    page: '/login',
  },
  'tests/Delivera-Deploy-Smoke-Validation-Tests.spec.js': {
    journey: 'journey.e2e',
    layer: 'e2e-journey',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-E2E-User-Journey-Tests.spec.js': {
    journey: 'journey.e2e',
    layer: 'e2e-journey',
    page: '/report,/current-sprint,/sprint-leadership',
  },
  'tests/Delivera-E2E-Loading-Meta-Robustness-Tests.spec.js': {
    journey: 'journey.e2e',
    layer: 'e2e-journey',
    page: '/report,/current-sprint,/sprint-leadership',
  },

  // Misc focused tests that still fit buckets
  'tests/Delivera-EpicKeyLinks.spec.js': {
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
      'tests/Delivera-CurrentSprint-Mission-Control-Direct-Value-Validation-Tests.spec.js',
      'tests/Delivera-CurrentSprint-Redesign-Validation-Tests.spec.js',
      'tests/Delivera-Outcome-Intake-And-Readiness-Validation-Tests.spec.js',
      'tests/Delivera-CSS-Build-And-Mobile-Responsive-Validation-Tests.spec.js',
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
