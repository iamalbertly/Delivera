import dotenv from 'dotenv';
import { logger } from './lib/Jira-Reporting-App-Server-Logging-Utility.js';
import { authEnabled, superTokensEnabled } from './lib/middleware.js';
import { createJiraReportingExpressCoreApp } from './lib/Jira-Reporting-App-Express-Core-App-Factory-Handler.js';
import { appEnvConfig } from './lib/Jira-Reporting-App-Config-Env-Services-Core-SSOT.js';

dotenv.config();

const PORT = appEnvConfig.port;
const app = createJiraReportingExpressCoreApp({ port: PORT, enableBackgroundWorkers: true });

// Start server
const server = app.listen(PORT, () => {
  console.log(`VodaAgileBoard running on http://localhost:${PORT}`);
  const accessMode = superTokensEnabled
    ? `auth at http://localhost:${PORT}/auth${legacyAuthEnabled ? ' (hybrid legacy + SuperTokens enabled)' : ''}`
    : (authEnabled ? 'login at / then /report' : `report at http://localhost:${PORT}/report`);
  console.log(`Access: ${accessMode}`);

  logger.info('Server started', { port: PORT });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error('Port already in use. Stop the other process or set PORT=...', { port: PORT, code: err.code });
    process.exit(1);
  }
  throw err;
});
