import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  proposeFromBoardCache,
  proposeFromJiraFallback,
  runProposePipeline,
  parseSlideExtraction,
  proposeFromSlideImage,
} from '../lib/Delivera-Governance-PIBaseline-03Propose-Agent.js';
import {
  buildEpicActivityByKey,
  enrichCandidatesWithEpicActivity,
} from '../lib/Delivera-Governance-PIBaseline-04Epic-Activity-Intelligence-SSOT.js';

function mockCache(briefByKey = {}) {
  return {
    async get(key) {
      const k = String(key);
      for (const [pattern, brief] of Object.entries(briefByKey)) {
        if (k.includes(pattern)) return { value: brief };
      }
      return null;
    },
  };
}

describe('PI baseline propose agent', () => {
  it('proposeFromBoardCache finds epics from boardEpicIndex', async () => {
    const brief = {
      meta: {
        boardEpicIndex: [
          { issueKey: 'SD-100', title: 'FY27 Q1 – DMS – NBA – Recharge Growth Trends', squad: 'SD board', projectKey: 'SD' },
          { issueKey: 'SD-200', title: 'Random backlog item', squad: 'SD board', projectKey: 'SD' },
        ],
      },
    };
    const cache = mockCache({ 'SD:e1:p1': brief });
    const { candidates, method } = await proposeFromBoardCache({
      projects: ['SD'],
      cache,
      quarter: 'FY27 Q1',
    });
    assert.equal(method, 'board-epics');
    assert.ok(candidates.some((c) => c.issueKey === 'SD-100'));
    assert.ok(!candidates.some((c) => c.issueKey === 'SD-200'));
  });

  it('proposeFromJiraFallback accepts epic title without fix version', async () => {
    const version3Client = {
      issueSearch: {
        searchForIssuesUsingJql: async () => ({
          issues: [
            {
              key: 'MAS-1',
              fields: {
                summary: 'FY27 Q1 – Program – System – Goal',
                fixVersions: [],
                labels: [],
              },
            },
          ],
        }),
      },
    };
    const { candidates } = await proposeFromJiraFallback({
      projects: ['MAS'],
      version3Client,
      quarter: 'FY27 Q1',
    });
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].issueKey, 'MAS-1');
    assert.equal(candidates[0].method, 'epic-title');
  });

  it('runProposePipeline uses board cache before manual', async () => {
    const brief = {
      meta: {
        boardEpicIndex: [
          { issueKey: 'RPA-1', title: 'FY27 Q1 – Ops – Tool – Upgrade', projectKey: 'RPA' },
        ],
      },
    };
    const cache = mockCache({ 'RPA:e1:p1': brief });
    const body = await runProposePipeline({
      projects: ['RPA'],
      cache,
      version3Client: null,
      quarter: 'FY27 Q1',
      providerConfig: { provider: 'built-in', apiKey: '' },
    });
    assert.ok(body.candidates.length >= 1);
    assert.equal(body.method, 'board-epics');
    assert.equal(body.guidance, null);
  });

  it('parseSlideExtraction returns parseError on invalid JSON', () => {
    const { extracted, parseError } = parseSlideExtraction('not json');
    assert.equal(extracted.length, 0);
    assert.ok(parseError);
  });

  it('buildEpicActivityByKey labels in-flight epics with sprint count', () => {
    const payloads = [{
      board: { name: 'SD', location: { projectKey: 'SD' } },
      payload: {
        sprint: { id: 's1', state: 'active', startDate: '2026-04-01' },
        stories: [
          { epicKey: 'SD-1', epicSummary: 'FY27 Q1 Epic', status: 'In Progress' },
          { epicKey: 'SD-1', epicSummary: 'FY27 Q1 Epic', status: 'Done' },
        ],
      },
    }, {
      board: { name: 'SD2' },
      payload: {
        sprint: { id: 's2', state: 'closed', startDate: '2026-05-01' },
        stories: [{ epicKey: 'SD-1', status: 'In Progress' }],
      },
    }];
    const map = buildEpicActivityByKey(payloads);
    const act = map.get('SD-1');
    assert.equal(act.lifecycle, 'in-flight');
    assert.ok(act.sprintCount >= 2);
    assert.ok(act.activityLabel.includes('In flight'));
  });

  it('enrichCandidatesWithEpicActivity adds activityLabel', () => {
    const activity = new Map([['SD-9', { lifecycle: 'not-started', activityLabel: 'Not started in sprint yet' }]]);
    const out = enrichCandidatesWithEpicActivity([{ issueKey: 'SD-9', title: 'Epic' }], activity);
    assert.equal(out[0].epicActivity.activityLabel, 'Not started in sprint yet');
  });

  it('proposeFromSlideImage rejects gemini before vision call', async () => {
    await assert.rejects(
      () => proposeFromSlideImage({
        imageBase64: 'abc',
        projects: ['SD'],
        providerConfig: { provider: 'gemini', apiKey: 'test-key' },
        boardEpics: [],
      }),
      /OpenAI or Claude/i,
    );
  });
});
