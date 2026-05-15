import dotenv from 'dotenv';
import { logger } from './lib/Delivera-Server-Logging-Utility.js';
import { authEnabled, legacyAuthEnabled, superTokensEnabled } from './lib/middleware.js';
import { createDeliveraExpressCoreApp } from './lib/Delivera-Express-Core-App-Factory-Handler.js';
import { appEnvConfig } from './lib/Delivera-Config-Env-Services-Core-SSOT.js';

dotenv.config();
// Note: Delivera-Config-Env-Services-Core-SSOT already loads `<repo>/.env` from disk before reading vars.

const PORT = appEnvConfig.port;
const app = createDeliveraExpressCoreApp({ port: PORT, enableBackgroundWorkers: true });

// Start server
const server = app.listen(PORT, () => {
  console.log(`Delivera running on http://localhost:${PORT}`);
  const accessMode = superTokensEnabled
    ? `auth at http://localhost:${PORT}/auth${legacyAuthEnabled ? ' (hybrid legacy + SuperTokens enabled)' : ''}`
    : (authEnabled ? 'login at / then /report' : `report at http://localhost:${PORT}/report`);
  console.log(`Access: ${accessMode}`);
  console.log('API: POST /api/issues/:issueKey/comment (Current Sprint Jira nudge)');

  logger.info('Server started', { port: PORT });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error('Port already in use. Stop the other process or set PORT=...', { port: PORT, code: err.code });
    process.exit(1);
  }
  throw err;
});
