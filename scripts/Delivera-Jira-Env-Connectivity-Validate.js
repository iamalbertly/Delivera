#!/usr/bin/env node
/**
 * Loads the same .env resolution as the app (via Delivera-Config-Env-Services-Core-SSOT),
 * then calls Jira GET /rest/api/3/myself using jira.js. Exits 0 on success, 1 on failure.
 * Does not print secrets (no API token, no full email).
 */
import { createVersion3Client } from '../lib/jiraClients.js';
import { jiraEnvConfig, validateRuntimeConfiguration } from '../lib/Delivera-Config-Env-Services-Core-SSOT.js';

async function main() {
  const v = validateRuntimeConfiguration();
  if (!v.ok) {
    console.error('Configuration errors:', v.errors.join(' | '));
    process.exit(1);
  }
  const host = jiraEnvConfig.host || '';
  const emailHint = jiraEnvConfig.email.includes('@')
    ? `${jiraEnvConfig.email.split('@')[0].slice(0, 2)}***@${jiraEnvConfig.email.split('@')[1]}`
    : '(set)';
  console.log('Using Jira host:', host);
  console.log('Using Jira email (masked):', emailHint);
  console.log('API token length:', jiraEnvConfig.apiToken.length);
  try {
    const client = createVersion3Client();
    const me = await client.myself.getCurrentUser();
    const who = me.displayName || me.emailAddress || me.accountId || 'unknown';
    console.log('Jira connectivity OK. Authenticated as:', who);
    process.exit(0);
  } catch (err) {
    const status = err?.statusCode || err?.cause?.response?.status || err?.response?.status || '';
    console.error('Jira API call failed.', status ? `HTTP ${status}.` : '', err?.message || String(err));
    console.error('Check JIRA_HOST (base URL only, no trailing path), JIRA_EMAIL matches token owner, and token is active in Atlassian.');
    process.exit(1);
  }
}

main();
