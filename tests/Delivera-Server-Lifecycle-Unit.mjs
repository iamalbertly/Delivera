import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerFatalHandlers, registerGracefulShutdown } from '../lib/Delivera-Server-Lifecycle-01Graceful.js';

test('registerFatalHandlers registers without throwing', () => {
  const shutdownCalls = [];
  const gracefulShutdown = registerGracefulShutdown(null, {});
  registerFatalHandlers(null, (signal, code) => shutdownCalls.push({ signal, code }));
  assert.equal(shutdownCalls.length, 0);
});
