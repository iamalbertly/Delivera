import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCanonicalEpicTitle,
  deriveTargetDate,
  resolveSlideCommitments,
  findDuplicateRisk,
  buildCreateWorkNarrative,
  toProposeRows,
  reconcileResolvedWithEpics,
  linkResolvedToExisting,
  SLIDE_EPIC_STATUS,
  SLIDE_SUGGESTED_ACTION,
} from '../lib/Delivera-Governance-PIBaseline-05Slide-Epic-Resolver-SSOT.js';

describe('PI baseline slide epic resolver', () => {
  it('buildCanonicalEpicTitle uses FY## Q# – Program – System – Capability', () => {
    const title = buildCanonicalEpicTitle({
      quarter: 'FY27 Q2',
      program: 'DMS',
      system: 'NBA',
      capability: 'EVOD Upgrade',
    });
    assert.equal(title, 'FY27 Q2 – DMS – NBA – EVOD Upgrade');
  });

  it('deriveTargetDate maps July FY27 Q2 to 2026-07-31', () => {
    assert.equal(deriveTargetDate('July', 'FY27 Q2'), '2026-07-31');
    assert.equal(deriveTargetDate('August', 'FY27 Q2'), '2026-08-31');
    assert.equal(deriveTargetDate('September', 'FY27 Q2'), '2026-09-30');
  });

  it('resolveSlideCommitments matches playbook CVM epic and attaches child stories + targetDate', () => {
    const resolved = resolveSlideCommitments({
      extracted: [
        { month: 'July', theme: 'Growth', bullet: 'NBA integration with CVM for Channel' },
        { month: 'July', theme: 'Growth', bullet: 'Pilot Soga Focus Cluster campaign' },
      ],
      quarter: 'FY27 Q2',
      projects: ['SD'],
      boardEpics: [],
      jiraEpics: [],
    });
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].status, SLIDE_EPIC_STATUS.MISSING);
    assert.match(resolved[0].suggestedEpicTitle, /CVM for Channel Productivity/);
    assert.equal(resolved[0].targetDate, '2026-07-31');
    assert.ok(resolved[0].childStories.length >= 3);
  });

  it('merges E-HOD regional + drill-down into one epic with combined child stories', () => {
    const resolved = resolveSlideCommitments({
      extracted: [
        { month: 'August', theme: 'Growth', bullet: 'EHOD Regional Profile realtime performance' },
        { month: 'August', theme: 'Growth', bullet: 'EHOD Drill Down territory Cluster Site profile' },
      ],
      quarter: 'FY27 Q2',
      projects: ['SD'],
    });
    assert.equal(resolved.length, 1);
    assert.match(resolved[0].suggestedEpicTitle, /E-HOD Regional Profile/);
    assert.ok(resolved[0].childStories.length >= 3);
  });

  it('flags SD-4671 Leaders Version as duplicate-risk with suggestedAction link', () => {
    const risk = findDuplicateRisk(
      'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
      [{ issueKey: 'SD-4671', title: 'DMS > NBA > Leaders Version' }],
      {
        duplicateSearchTerms: ['ehod', 'regional profile', 'leaders version', 'sd-4671'],
      },
    );
    assert.ok(risk);
    assert.equal(risk.issueKey, 'SD-4671');
    assert.equal(risk.suggestedAction, SLIDE_SUGGESTED_ACTION.LINK);
  });

  it('flags DevSecOps EVOD as duplicate-risk with suggestedAction review', () => {
    const risk = findDuplicateRisk(
      'FY27 Q2 – DMS – NBA – EVOD Upgrade',
      [{ issueKey: 'SD-5115', title: 'DEVSECOPS EVOD Upgrade' }],
      {
        duplicateSearchTerms: ['evod'],
        duplicatePrograms: ['devsecops', 'devops'],
      },
    );
    assert.ok(risk);
    assert.equal(risk.issueKey, 'SD-5115');
    assert.equal(risk.suggestedAction, SLIDE_SUGGESTED_ACTION.REVIEW);
  });

  it('resolveSlideCommitments marks matched when exact epic exists', () => {
    const resolved = resolveSlideCommitments({
      extracted: [{ month: 'July', theme: 'Growth', bullet: 'EVOD Upgrade' }],
      quarter: 'FY27 Q2',
      projects: ['SD'],
      jiraEpics: [{
        issueKey: 'SD-9001',
        title: 'FY27 Q2 – DMS – NBA – EVOD Upgrade',
      }],
    });
    assert.equal(resolved[0].status, SLIDE_EPIC_STATUS.MATCHED);
    assert.equal(resolved[0].issueKey, 'SD-9001');
  });

  it('buildCreateWorkNarrative emits FY lines for MULTIPLE_EPICS parser', () => {
    const narrative = buildCreateWorkNarrative([
      {
        status: SLIDE_EPIC_STATUS.MISSING,
        suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – EVOD Upgrade',
        childStories: [],
      },
      {
        status: SLIDE_EPIC_STATUS.MISSING,
        suggestedEpicTitle: 'FY27 Q2 – DMS – VOP Upgrade',
        childStories: [],
      },
    ]);
    assert.match(narrative, /FY27 Q2/);
    assert.ok(narrative.split('\n').filter((l) => /FY27 Q2/.test(l)).length >= 2);
  });

  it('toProposeRows splits matched / unmatched / duplicate-risk', () => {
    const { candidates, unmatched, duplicateRisk } = toProposeRows([
      {
        status: SLIDE_EPIC_STATUS.MATCHED,
        suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – EVOD Upgrade',
        issueKey: 'SD-1',
        matchScore: 0.9,
        childStories: [],
      },
      {
        status: SLIDE_EPIC_STATUS.DUPLICATE_RISK,
        suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
        issueKey: 'SD-4671',
        duplicateRisk: { issueKey: 'SD-4671', reason: 'Similar', suggestedAction: 'link' },
        childStories: [],
      },
      {
        status: SLIDE_EPIC_STATUS.MISSING,
        suggestedEpicTitle: 'FY27 Q2 – DMS – DMS Capability Merging',
        issueKey: '',
        childStories: [],
      },
    ]);
    assert.equal(candidates.length, 1);
    assert.equal(duplicateRisk.length, 1);
    assert.equal(unmatched.length, 2);
  });

  it('linkResolvedToExisting promotes duplicate-risk to matched', () => {
    const next = linkResolvedToExisting(
      [{
        status: SLIDE_EPIC_STATUS.DUPLICATE_RISK,
        suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
        issueKey: 'SD-4671',
        duplicateRisk: { issueKey: 'SD-4671' },
      }],
      'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
      'SD-4671',
      'Leaders Version',
    );
    assert.equal(next[0].status, SLIDE_EPIC_STATUS.MATCHED);
    assert.equal(next[0].issueKey, 'SD-4671');
    assert.equal(next[0].method, 'slide-linked');
  });

  it('reconcileResolvedWithEpics promotes missing to matched when Jira finds epic', () => {
    const next = reconcileResolvedWithEpics(
      [{
        status: SLIDE_EPIC_STATUS.MISSING,
        suggestedEpicTitle: 'FY27 Q2 – DMS – VOP Upgrade',
        issueKey: '',
      }],
      [{ issueKey: 'SD-88', title: 'FY27 Q2 – DMS – VOP Upgrade' }],
    );
    assert.equal(next[0].status, SLIDE_EPIC_STATUS.MATCHED);
    assert.equal(next[0].issueKey, 'SD-88');
  });
});
