import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEpicsFromSlideResolved,
  reconcileSlideEpics,
} from '../lib/Delivera-Governance-PIBaseline-06Slide-Epic-Create-SSOT.js';
import { SLIDE_EPIC_STATUS } from '../lib/Delivera-Governance-PIBaseline-05Slide-Epic-Resolver-SSOT.js';

function mockClient({ existing = [], createKeys = [] } = {}) {
  let createIdx = 0;
  return {
    issueSearch: {
      searchForIssuesUsingJql: async ({ jql }) => {
        const jqlLower = String(jql || '').toLowerCase();
        const termMatch = jqlLower.match(/summary\s*~\s*"([^"]+)"/);
        const term = termMatch ? termMatch[1].toLowerCase() : '';
        const hits = existing.filter((e) => {
          const titleLower = String(e.title || '').toLowerCase();
          if (!term) return true;
          return titleLower.includes(term);
        });
        return {
          issues: hits.map((e) => ({
            key: e.key,
            fields: { summary: e.title, status: { name: 'To Do' } },
          })),
        };
      },
    },
    issues: {
      createIssue: async ({ fields }) => {
        const key = createKeys[createIdx] || `SD-NEW-${createIdx + 1}`;
        createIdx += 1;
        return { key, fields };
      },
    },
  };
}

describe('PI baseline create epics from slide', () => {
  it('links duplicate-risk when action is link', async () => {
    const result = await createEpicsFromSlideResolved({
      version3Client: mockClient(),
      projects: ['SD'],
      quarter: 'FY27 Q2',
      actions: {
        'FY27 Q2 – DMS – NBA – E-HOD Regional Profile': 'link',
      },
      resolved: [{
        status: SLIDE_EPIC_STATUS.DUPLICATE_RISK,
        suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – E-HOD Regional Profile',
        issueKey: 'SD-4671',
        duplicateRisk: { issueKey: 'SD-4671', title: 'Leaders Version' },
        childStories: [],
      }],
    });
    assert.equal(result.linked.length, 1);
    assert.equal(result.linked[0].issueKey, 'SD-4671');
    assert.equal(result.created.length, 0);
    assert.equal(result.resolved[0].status, SLIDE_EPIC_STATUS.MATCHED);
  });

  it('blocks duplicate-risk create without createAnyway', async () => {
    const result = await createEpicsFromSlideResolved({
      version3Client: mockClient(),
      projects: ['SD'],
      createAnyway: false,
      actions: {
        'FY27 Q2 – DMS – NBA – EVOD Upgrade': 'create',
      },
      resolved: [{
        status: SLIDE_EPIC_STATUS.DUPLICATE_RISK,
        suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – EVOD Upgrade',
        issueKey: 'SD-5115',
        suggestedAction: 'review',
        duplicateRisk: { issueKey: 'SD-5115', title: 'DEVSECOPS' },
        childStories: [],
      }],
    });
    assert.equal(result.created.length, 0);
    assert.ok(result.errors.some((e) => e.code === 'DUPLICATE_RISK_BLOCKED'));
  });

  it('creates missing epic with child stories', async () => {
    const client = mockClient({ createKeys: ['SD-100', 'SD-101', 'SD-102', 'SD-103'] });
    const result = await createEpicsFromSlideResolved({
      version3Client: client,
      projects: ['SD'],
      quarter: 'FY27 Q2',
      includeChildStories: true,
      createHelpers: { epicLinkFieldId: 'customfield_10014', host: 'https://jira.example.com' },
      actions: {
        'FY27 Q2 – DMS – NBA – Integration of CVM for Channel Productivity Campaigns': 'create',
      },
      resolved: [{
        status: SLIDE_EPIC_STATUS.MISSING,
        suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – Integration of CVM for Channel Productivity Campaigns',
        issueKey: '',
        childStories: [
          { title: 'NBA should display CVM-managed Pilot Soga Focus Cluster campaign', description: 'Pilot' },
          { title: 'NBA should display all CVM-managed productivity and channel campaigns' },
          { title: 'NBA should display Inactive Freelancers campaign' },
        ],
      }],
    });
    assert.equal(result.created.length, 1);
    assert.equal(result.created[0].issueKey, 'SD-100');
    assert.equal(result.created[0].childKeys.length, 3);
  });

  it('createAnyway creates when action create on duplicate-risk', async () => {
    const client = mockClient({ createKeys: ['SD-200'] });
    const result = await createEpicsFromSlideResolved({
      version3Client: client,
      projects: ['SD'],
      createAnyway: true,
      actions: {
        'FY27 Q2 – DMS – NBA – EVOD Upgrade': 'create',
      },
      resolved: [{
        status: SLIDE_EPIC_STATUS.DUPLICATE_RISK,
        suggestedEpicTitle: 'FY27 Q2 – DMS – NBA – EVOD Upgrade',
        issueKey: 'SD-5115',
        duplicateRisk: { issueKey: 'SD-5115', title: 'DEVSECOPS' },
        childStories: [],
      }],
    });
    assert.equal(result.created.length, 1);
    assert.equal(result.created[0].issueKey, 'SD-200');
  });

  it('reconcileSlideEpics returns matched after Jira find', async () => {
    const client = mockClient({
      existing: [{ key: 'SD-88', title: 'FY27 Q2 – DMS – VOP Upgrade' }],
    });
    const out = await reconcileSlideEpics({
      version3Client: client,
      projects: ['SD'],
      quarter: 'FY27 Q2',
      resolved: [{
        status: SLIDE_EPIC_STATUS.MISSING,
        suggestedEpicTitle: 'FY27 Q2 – DMS – VOP Upgrade',
        issueKey: '',
        childStories: [],
      }],
    });
    assert.equal(out.matchedCount, 1);
    assert.ok(out.candidates.some((c) => c.issueKey === 'SD-88'));
  });
});
