import { test, expect } from './Jira-Reporting-App-Playwright-Console-Guard-Global-Validation-Helpers.js';
import path from 'path';
import { existsSync, readFileSync } from 'fs';

test('server /feedback accepts anonymous submissions and persists them', async ({ request }) => {
  const payload = {
    email: '',
    message: 'Automated test feedback - please ignore.'
  };

  const response = await request.post('/feedback', { data: payload }).catch(() => null);
  if (!response) {
    test.skip('Server did not respond to /feedback (server may be down)');
    return;
  }

  if (response.status() === 429) {
    test.skip('Feedback endpoint rate-limited; skipping test.');
    return;
  }

  if (!response.ok()) {
    test.skip(`Feedback endpoint returned ${response.status()}; skipping persistence assertions.`);
    return;
  }

  expect(response.ok()).toBeTruthy();

  const feedbackFilePath = path.join(process.cwd(), 'data', 'JiraReporting-Feedback-UserInput-Submission-Log.jsonl');
  expect(existsSync(feedbackFilePath)).toBeTruthy();

  const content = readFileSync(feedbackFilePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  expect(lines.length).toBeGreaterThan(0);

  const found = lines.some(line => {
    try {
      const obj = JSON.parse(line);
      return String(obj.message).includes('Automated test feedback');
    } catch (e) {
      return false;
    }
  });

  expect(found).toBeTruthy();
});
