import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLogContext } from '../lib/Delivera-Server-Logging-Utility.js';
import { explainSurfaceFailure } from '../public/Delivera-Shared-Instant-Shell-01UI.js';
import { applyEvidenceAccessState } from '../lib/Delivera-Governance-Brief-01Service.js';

test('log context redacts nested credentials and authorization headers', () => {
  const context = buildLogContext({
    request: {
      headers: { Authorization: 'Bearer should-never-log', cookie: 'session=secret' },
      config: { jiraApiToken: 'secret-token' },
    },
  });

  assert.equal(context.request.headers.Authorization, '[redacted]');
  assert.equal(context.request.headers.cookie, '[redacted]');
  assert.equal(context.request.config.jiraApiToken, '[redacted]');
  assert.doesNotMatch(JSON.stringify(context), /should-never-log|session=secret|secret-token/);
});

test('surface failure copy distinguishes expired evidence access from generic outage', () => {
  const auth = explainSurfaceFailure(Object.assign(new Error('HTTP 401'), { status: 401 }));
  const outage = explainSurfaceFailure(Object.assign(new Error('HTTP 502'), { status: 502 }));

  assert.equal(auth.title, 'Evidence access expired');
  assert.match(auth.message, /No health judgment has been guessed/);
  assert.equal(outage.title, 'Live evidence service unavailable');
  assert.match(outage.message, /will not present an invented result/);
});

test('governance never converts inaccessible Jira evidence into a delivery verdict', () => {
  const brief = applyEvidenceAccessState({
    freshness: { confidenceLimit: 'live', jiraFetchedAt: '2026-07-15T10:00:00.000Z' },
    leadershipNarrative: { meetingAnswer: 'NEEDS WATCH. SD: 0 of 0 items delivered' },
    executiveView: { verdictTier: 'watch' },
    meta: { evidenceFetched: 0, setupGaps: [] },
  }, ['SD'], [{
    projectKey: 'SD',
    code: 'JIRA_UNAUTHORIZED',
    message: 'Jira rejected credentials or access for this project.',
    detail: 'credential-bearing diagnostic must not cross the API',
  }], []);

  assert.equal(brief.freshness.confidenceLimit, 'unavailable');
  assert.equal(brief.freshness.jiraFetchedAt, null);
  assert.equal(brief.meta.evidenceUnavailable, true);
  assert.equal(brief.executiveView.verdictTier, 'cannot-verify');
  assert.match(brief.leadershipNarrative.meetingAnswer, /CANNOT VERIFY/);
  assert.doesNotMatch(JSON.stringify(brief), /credential-bearing diagnostic/);
});

test('governance revalidates cached decisions and removes inaccessible evidence from client cache', async () => {
  const bridgeSource = await import('node:fs/promises').then((fs) => fs.readFile(
    new URL('../public/Delivera-Shared-Brief-Client-Cache-01Bridge.js', import.meta.url),
    'utf8',
  ));
  const loadSource = await import('node:fs/promises').then((fs) => fs.readFile(
    new URL('../public/Delivera-Governance-Brief-Page-03Load-Controller.js', import.meta.url),
    'utf8',
  ));

  assert.match(loadSource, /revalidate:\s*true/);
  assert.match(bridgeSource, /brief\?\.meta\?\.evidenceUnavailable/);
  assert.match(bridgeSource, /invalidateBriefCacheEntry\(pk, quarter, periodKey\)/);
});
