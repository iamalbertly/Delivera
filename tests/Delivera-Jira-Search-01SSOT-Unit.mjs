import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { searchIssuesJql, getIssueByKey } from '../lib/Delivera-Jira-Search-01SSOT.js';

describe('Delivera-Jira-Search-01SSOT', () => {
  it('searchIssuesJql prefers enhanced POST and falls back to legacy POST', async () => {
    const calls = [];
    const client = {
      issueSearch: {
        searchForIssuesUsingJqlEnhancedSearchPost: async (params) => {
          calls.push('enhanced');
          throw Object.assign(new Error('gone'), { response: { status: 410 } });
        },
        searchForIssuesUsingJqlPost: async (params) => {
          calls.push('legacy');
          return { issues: [{ key: 'SD-1', fields: { summary: 'Test' } }], total: 1 };
        },
      },
    };
    const { issues, method } = await searchIssuesJql(client, { jql: 'project = SD', maxResults: 5 });
    assert.deepEqual(calls, ['enhanced', 'legacy']);
    assert.equal(method, 'legacy-post');
    assert.equal(issues[0].key, 'SD-1');
  });

  it('searchIssuesJql returns enhanced results when available', async () => {
    const client = {
      issueSearch: {
        searchForIssuesUsingJqlEnhancedSearchPost: async () => ({
          issues: [{ key: 'SD-5314', fields: { summary: 'Integration with CVM' } }],
          total: 1,
        }),
        searchForIssuesUsingJqlPost: async () => {
          throw new Error('should not call legacy');
        },
      },
    };
    const { issues, method } = await searchIssuesJql(client, { jql: 'project = SD', maxResults: 3 });
    assert.equal(method, 'enhanced-post');
    assert.equal(issues[0].key, 'SD-5314');
  });

  it('getIssueByKey uses issues.getIssue', async () => {
    let gotKey = '';
    const client = {
      issues: {
        getIssue: async ({ issueIdOrKey }) => {
          gotKey = issueIdOrKey;
          return { key: issueIdOrKey, fields: { summary: 'FY27 Q2 – DMS – EVOD Upgrade' } };
        },
      },
    };
    const issue = await getIssueByKey(client, 'sd-5309', ['summary']);
    assert.equal(gotKey, 'SD-5309');
    assert.equal(issue.key, 'SD-5309');
  });
});
