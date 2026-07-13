import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCanonicalEpicTitle,
  deriveTargetDate,
  resolveSlideCommitments,
  findDuplicateRisk,
  resolveSuggestedEpicTitle,
  normalizeJiraEpicTitle,
  buildCreateWorkNarrative,
  toProposeRows,
  reconcileResolvedWithEpics,
  linkResolvedToExisting,
  boostResolvedWithBoardEpics,
  canonicalizeForMatch,
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

  it('resolveSlideCommitments matches playbook CVM epic when Jira pool has DMS > NBA title', () => {
    const resolved = resolveSlideCommitments({
      extracted: [
        { month: 'July', theme: 'Growth', bullet: 'NBA integration with CVM for Channel' },
      ],
      quarter: 'FY27 Q2',
      projects: ['SD'],
      jiraEpics: [{
        issueKey: 'SD-8001',
        title: 'DMS > NBA > CVM Channel Productivity Campaigns',
      }],
    });
    assert.equal(resolved[0].status, SLIDE_EPIC_STATUS.MATCHED);
    assert.equal(resolved[0].issueKey, 'SD-8001');
    assert.match(resolved[0].suggestedEpicTitle, /CVM for Channel Productivity/);
  });

  it('playbook canonical title overrides AI EVOD segment drift', () => {
    const title = resolveSuggestedEpicTitle({
      row: { bullet: 'EVOD Upgrade performance scalability' },
      entry: {
        epicTitle: 'FY27 Q2 – DMS – NBA – EVOD Upgrade',
      },
      qKey: 'FY27 Q2',
      squad: 'DMS',
      normalizedAiTitle: 'FY27 Q2 – DMS – EVOD – Upgrade for Performance, Scalability, and Customer Experience',
    });
    assert.equal(title, 'FY27 Q2 – DMS – NBA – EVOD Upgrade');
  });

  it('normalizeJiraEpicTitle handles DMS > NBA > hierarchy and EHOD aliases', () => {
    assert.equal(normalizeJiraEpicTitle('DMS > NBA > Leaders Version'), 'leaders version');
    assert.equal(normalizeJiraEpicTitle('FY27 Q2 – DMS – NBA – E-HOD Regional'), 'fy27 q2 - dms - nba - ehod regional');
  });

  it('auto-links playbook duplicate-risk SD-4671 via issue key in search terms', () => {
    const resolved = resolveSlideCommitments({
      extracted: [{ month: 'August', theme: 'Growth', bullet: 'EHOD Regional Profile realtime performance' }],
      quarter: 'FY27 Q2',
      projects: ['SD'],
      jiraEpics: [{ issueKey: 'SD-4671', title: 'DMS > NBA > Leaders Version' }],
    });
    assert.equal(resolved[0].status, SLIDE_EPIC_STATUS.MATCHED);
    assert.equal(resolved[0].issueKey, 'SD-4671');
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

  it('promotes 55%+ duplicate-risk to matched when epic exists in Jira', () => {
    const resolved = resolveSlideCommitments({
      extracted: [{ month: 'July', theme: 'Growth', bullet: 'EHOD Regional Profile realtime performance' }],
      quarter: 'FY27 Q2',
      projects: ['SD'],
      jiraEpics: [{
        issueKey: 'SD-4671',
        title: 'DMS > NBA > Leaders Version E-HOD Regional Profile',
      }],
    });
    assert.equal(resolved[0].status, SLIDE_EPIC_STATUS.MATCHED);
    assert.equal(resolved[0].issueKey, 'SD-4671');
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

  it('canonicalizeForMatch normalizes of/with CVM drift to the same string', () => {
    const slide = canonicalizeForMatch('FY27 Q2 – DMS – NBA – Integration of CVM for Channel Productivity Campaigns');
    const jira = canonicalizeForMatch('FY27 Q2 – DMS – NBA – Integration with CVM for Channel Productivity Campaigns');
    assert.equal(slide, jira);
    assert.match(slide, /integration with cvm/);
  });

  it('boostResolvedWithBoardEpics links SD-5314 when slide says of CVM and board says with CVM', () => {
    const boosted = boostResolvedWithBoardEpics(
      [{
        status: SLIDE_EPIC_STATUS.MISSING,
        suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – Integration of CVM for Channel Productivity Campaigns',
        issueKey: '',
      }],
      [{
        issueKey: 'SD-5314',
        title: 'FY27 Q2 – DMS – NBA – Integration with CVM for Channel Productivity Campaigns',
      }],
      'FY27 Q2',
    );
    assert.equal(boosted[0].status, SLIDE_EPIC_STATUS.MATCHED);
    assert.equal(boosted[0].issueKey, 'SD-5314');
    assert.equal(boosted[0].method, 'slide-board-link');
  });

  it('boostResolvedWithBoardEpics links Enhancements to Enhancement Based on User Feedback', () => {
    const boosted = boostResolvedWithBoardEpics(
      [{
        status: SLIDE_EPIC_STATUS.MISSING,
        suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – Enhancements',
        issueKey: '',
      }],
      [{
        issueKey: 'SD-5315',
        title: 'FY27 Q2 – DMS – Enhancement Based on User Feedback',
      }],
      'FY27 Q2',
    );
    assert.equal(boosted[0].status, SLIDE_EPIC_STATUS.MATCHED);
    assert.equal(boosted[0].issueKey, 'SD-5315');
  });
});
