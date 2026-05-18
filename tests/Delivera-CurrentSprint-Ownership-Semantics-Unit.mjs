import assert from 'node:assert/strict';
import {
  buildMergedWorkRiskRows,
  getUnifiedRiskCounts,
} from '../public/Delivera-CurrentSprint-Data-WorkRisk-Rows.js';

function story(issueKey, { assignee = '', reporter = '', status = 'In Progress' } = {}) {
  return {
    issueKey,
    key: issueKey,
    summary: `${issueKey} story`,
    status,
    issueType: 'Story',
    assignee,
    reporter,
    created: '2026-05-18T06:00:00.000Z',
    updated: '2026-05-18T06:00:00.000Z',
  };
}

function subtask(issueKey, parentKey, { assignee = '', reporter = '', status = 'In Progress' } = {}) {
  return {
    issueKey,
    key: issueKey,
    parentKey,
    parentIssueKey: parentKey,
    parentSummary: `${parentKey} parent`,
    summary: `${issueKey} subtask`,
    status,
    issueType: 'Sub-task',
    assignee,
    reporter,
    estimateHours: 2,
    loggedHours: 1,
    hoursInStatus: 2,
    updated: '2026-05-18T06:10:00.000Z',
  };
}

{
  const data = {
    meta: { generatedAt: 'case-owned-by-subtask' },
    stories: [story('SD-101')],
    subtaskTracking: {
      rows: [subtask('SD-102', 'SD-101', { assignee: 'Jane Contributor' })],
    },
  };
  const rows = buildMergedWorkRiskRows(data);
  const storyRow = rows.find((row) => row.issueKey === 'SD-101');
  assert.equal(storyRow?.owner, 'Jane Contributor');
  assert.equal(storyRow?.ownerSource, 'subtask-assignee');
  assert.equal(storyRow?.isUnownedOutcome, false);
  assert.equal(getUnifiedRiskCounts(data).unownedOutcomes, 0);
}

{
  const data = {
    meta: { generatedAt: 'case-no-story-or-subtask-owner' },
    stories: [story('SD-201')],
    subtaskTracking: {
      rows: [subtask('SD-202', 'SD-201')],
    },
  };
  const rows = buildMergedWorkRiskRows(data);
  const storyRow = rows.find((row) => row.issueKey === 'SD-201');
  assert.equal(storyRow?.owner, '');
  assert.equal(storyRow?.isUnownedOutcome, true);
  assert.equal(getUnifiedRiskCounts(data).unownedOutcomes, 1);
}

console.log('Ownership semantics regression passed');
