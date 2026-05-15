import { AgileClient } from 'jira.js/agile';
import { Version3Client } from 'jira.js';
import { logger } from './Delivera-Server-Logging-Utility.js';
import { jiraEnvConfig } from './Delivera-Config-Env-Services-Core-SSOT.js';
// Note: Jira env is loaded in Delivera-Config-Env-Services-Core-SSOT (repo-root .env + trim).

/**
* Validates Jira credentials from environment configuration
* @returns {{host: string, email: string, apiToken: string}}
* @throws {Error} If required environment variables are missing
*/
function validateJiraCredentials() {
  const host = jiraEnvConfig.host;
  const email = jiraEnvConfig.email;
  const apiToken = jiraEnvConfig.apiToken;

  if (!host || !email || !apiToken) {
    const missing = [];
    if (!host) missing.push('JIRA_HOST');
    if (!email) missing.push('JIRA_EMAIL');
    if (!apiToken) missing.push('JIRA_API_TOKEN');
    throw new Error(`Missing required Jira credentials: ${missing.join(', ')}. Please ensure .env file exists in the project root and contains all required variables.`);
  }

  return { host, email, apiToken };
}

/**
 * Creates and returns an AgileClient instance for Jira Agile API
 * @returns {AgileClient}
 * @throws {Error} If required environment variables are missing
 */
export function createAgileClient() {
  const { host, email, apiToken } = validateJiraCredentials();
  
  // Log successful client creation (without sensitive data)
  logger.info('Creating AgileClient', { host, emailPrefix: email.substring(0, 3) + '***' });

  return new AgileClient({
    host,
    authentication: {
      basic: {
        email,
        apiToken,
      },
    },
  });
}

/**
 * Creates and returns a Version3Client instance for Jira Platform API
 * @returns {Version3Client}
 * @throws {Error} If required environment variables are missing
 */
export function createVersion3Client() {
  const { host, email, apiToken } = validateJiraCredentials();
  
  // Log successful client creation (without sensitive data)
  logger.info('Creating Version3Client', { host, emailPrefix: email.substring(0, 3) + '***' });

  return new Version3Client({
    host,
    authentication: {
      basic: {
        email,
        apiToken,
      },
    },
  });
}
