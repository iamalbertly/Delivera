/**
 * Barrel: Slide epic resolver SSOT (playbook + match + search).
 */
export {
  EPIC_DELIM,
  EPIC_PLAYBOOKS,
  buildCanonicalEpicTitle,
  deriveTargetDate,
  quarterKey,
  squadKey,
  normalizeEpicTitle,
  playbookForProjects,
} from './Delivera-Governance-PIBaseline-05Slide-Playbook-01SSOT.js';

export {
  SLIDE_EPIC_STATUS,
  SLIDE_SUGGESTED_ACTION,
  findDuplicateRisk,
  resolveSlideCommitments,
  buildCreateWorkNarrative,
  toProposeRows,
  reconcileResolvedWithEpics,
  linkResolvedToExisting,
} from './Delivera-Governance-PIBaseline-05Slide-Resolver-02Match-SSOT.js';

export { searchJiraEpicsForResolved } from './Delivera-Governance-PIBaseline-05Slide-Resolver-03Search-SSOT.js';
