/**
 * Barrel: PI baseline propose agent (board + slide tiers).
 */
export {
  MAX_CANDIDATES,
  toCandidate,
  mergeCandidates,
  proposeFromBoardCache,
  proposeFromJiraFallback,
  validateCandidatesWithAI,
  runProposePipeline,
} from './Delivera-Governance-PIBaseline-03Propose-Board-01SSOT.js';

export {
  parseSlideExtraction,
  proposeFromSlideImage,
} from './Delivera-Governance-PIBaseline-03Propose-Slide-02SSOT.js';

export { reconcileSlideEpics } from './Delivera-Governance-PIBaseline-06Slide-Epic-Create-SSOT.js';

export {
  reconcileResolvedWithEpics,
  linkResolvedToExisting,
} from './Delivera-Governance-PIBaseline-05Slide-Epic-Resolver-SSOT.js';
