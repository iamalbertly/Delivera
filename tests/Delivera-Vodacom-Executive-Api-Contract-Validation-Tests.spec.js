import { test, expect } from './Delivera-Playwright-Console-Guard-Global-Validation-Helpers.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Vodacom executive API contract validation', () => {
  test('current sprint API exposes the decision cockpit contract when a board is available', async ({ request }) => {
    const boardsResponse = await request.get(`${BASE_URL}/api/boards.json`);
    if ([401, 403].includes(boardsResponse.status())) {
      test.skip(true, 'Auth is required for live API contract validation');
      return;
    }
    expect(boardsResponse.ok()).toBeTruthy();
    const boardsBody = await boardsResponse.json();
    const firstBoard = Array.isArray(boardsBody?.boards) ? boardsBody.boards[0] : null;
    if (!firstBoard?.id) {
      test.skip(true, 'No board available for current sprint contract validation');
      return;
    }

    const sprintResponse = await request.get(`${BASE_URL}/api/current-sprint.json?boardId=${encodeURIComponent(firstBoard.id)}`);
    if ([401, 403].includes(sprintResponse.status())) {
      test.skip(true, 'Auth is required for live API contract validation');
      return;
    }
    expect(sprintResponse.ok()).toBeTruthy();
    const body = await sprintResponse.json();

    expect(body).toHaveProperty('decisionCockpit');
    expect(body.decisionCockpit).toHaveProperty('health');
    expect(body.decisionCockpit).toHaveProperty('nextBestAction');
    expect(body.decisionCockpit).toHaveProperty('keySignals');
    expect(body.decisionCockpit).toHaveProperty('metrics');
    expect(Array.isArray(body.decisionCockpit.topRisks || [])).toBeTruthy();
    expect(Array.isArray(body.decisionCockpit.quickActions || [])).toBeTruthy();
    expect(body.decisionCockpit).toHaveProperty('insights');
    expect(Array.isArray(body.decisionCockpit.workMovementAnnotations || [])).toBeTruthy();
  });
});
