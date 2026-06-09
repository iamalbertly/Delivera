import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  runStructuredAITask,
  runVisionAITask,
  AI_TASK_TYPES,
} from '../lib/Delivera-AI-Orchestrator-01Router-SSOT.js';

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = null;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('AI orchestrator routing and output cleanup', () => {
  it('uses the cheap-capable OpenRouter default and deduplicates grouped actions', async () => {
    let requestBody = null;
    global.fetch = async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return {
        ok: true,
        async json() {
          return {
            model: requestBody.model,
            usage: { prompt_tokens: 10, completion_tokens: 8 },
            choices: [{
              message: {
                content: JSON.stringify({
                  doFirst: 'Unblock MPSA-2',
                  groupedActions: [
                    { owner: 'Tech Lead', issueKeys: ['MPSA-2'], action: 'Unblock MPSA-2', nudgeDraft: 'Please unblock MPSA-2', approvalRequired: true },
                    { owner: 'Tech Lead', issueKeys: ['mpsa-2'], action: 'Unblock MPSA-2 now', nudgeDraft: 'Please unblock MPSA-2', approvalRequired: true },
                    { owner: 'Scrum Master', issueKeys: ['MAS-1'], action: 'Confirm MAS-1 owner', nudgeDraft: 'Who owns MAS-1?', approvalRequired: true },
                  ],
                }),
              },
            }],
          };
        },
      };
    };

    const { result, fallbackUsed, confidence } = await runStructuredAITask(
      AI_TASK_TYPES.ACTION_PLAN,
      {
        topRisks: [
          { issueKey: 'MPSA-2', recommendedAction: 'Unblock MPSA-2', decisionNeededFrom: 'Tech Lead' },
          { issueKey: 'MAS-1', recommendedAction: 'Confirm owner', decisionNeededFrom: 'Scrum Master' },
        ],
        allowedIssueKeys: ['MPSA-2', 'MAS-1'],
      },
      {
        runId: `test-action-${Date.now()}`,
        providerConfig: { provider: 'openrouter', apiKey: 'test-key' },
      },
    );

    assert.equal(fallbackUsed, false);
    assert.equal(confidence, 'safe');
    assert.equal(requestBody.model, 'google/gemini-2.5-flash-lite');
    assert.equal(requestBody.max_tokens, 2048);
    assert.equal(result.groupedActions.length, 2);
    assert.deepEqual(result.groupedActions[0].issueKeys, ['MPSA-2']);
  });

  it('sends image content to OpenRouter vision tasks', async () => {
    let userContent = null;
    global.fetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      userContent = body.messages[1].content;
      return {
        ok: true,
        async json() {
          return {
            model: body.model,
            usage: { prompt_tokens: 12, completion_tokens: 5 },
            choices: [{
              message: {
                content: JSON.stringify({
                  candidateItems: [],
                  needsHumanConfirmation: true,
                }),
              },
            }],
          };
        },
      };
    };

    const { fallbackUsed } = await runVisionAITask(
      AI_TASK_TYPES.PI_BASELINE_CLASSIFY,
      { imageBase64: 'abc123', mimeType: 'image/png', candidates: [], allowedIssueKeys: [] },
      {
        runId: `test-vision-${Date.now()}`,
        providerConfig: { provider: 'openrouter', apiKey: 'test-key' },
      },
    );

    assert.equal(fallbackUsed, false);
    assert.ok(Array.isArray(userContent));
    assert.equal(userContent[0].type, 'text');
    assert.equal(userContent[1].type, 'image_url');
    assert.match(userContent[1].image_url.url, /^data:image\/png;base64,abc123$/);
  });
});
