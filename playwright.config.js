import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';

function resolveTestBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  try {
    if (existsSync('.delivera-dev-port')) {
      const port = Number(readFileSync('.delivera-dev-port', 'utf8').trim());
      if (Number.isFinite(port) && port > 0) return `http://localhost:${port}`;
    }
  } catch (_) { /* ignore */ }
  return 'http://localhost:3000';
}

const testBaseUrl = resolveTestBaseUrl();
const testServerPort = new URL(testBaseUrl).port || (testBaseUrl.startsWith('https:') ? '443' : '80');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  timeout: 120000, // 2 minutes for tests that call real Jira API
  use: {
    baseURL: testBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true, // Run in background for speed; use --headed when debugging
    actionTimeout: 30000, // 30 seconds for actions
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.SKIP_WEBSERVER !== 'true' ? {
    command: process.env.CI ? 'npm run start' : 'node scripts/Delivera-Dev-Port-Guard-01Check.js && npm run start',
    url: `${testBaseUrl}/governance`,
    env: { ...process.env, PORT: testServerPort },
    reuseExistingServer: process.env.REUSE_DEV_SERVER === 'true' && !process.env.CI,
    timeout: 120000,
  } : undefined,
});
