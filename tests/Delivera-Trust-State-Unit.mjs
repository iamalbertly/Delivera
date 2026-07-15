import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLogContext } from '../lib/Delivera-Server-Logging-Utility.js';
import { explainSurfaceFailure } from '../public/Delivera-Shared-Instant-Shell-01UI.js';

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
