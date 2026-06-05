import dotenv from 'dotenv';
import { logger } from './lib/Delivera-Server-Logging-Utility.js';
import { authEnabled, legacyAuthEnabled, superTokensEnabled } from './lib/middleware.js';
import {
  createDeliveraExpressCoreApp,
  startBackgroundWorkers,
  stopBackgroundWorkers,
} from './lib/Delivera-Express-Core-App-Factory-Handler.js';
import { appEnvConfig } from './lib/Delivera-Config-Env-Services-Core-SSOT.js';
import {
  listenWithRetry,
  registerGracefulShutdown,
  registerFatalHandlers,
} from './lib/Delivera-Server-Lifecycle-01Graceful.js';

dotenv.config();
// Note: Delivera-Config-Env-Services-Core-SSOT already loads `<repo>/.env` from disk before reading vars.

const PORT = appEnvConfig.port;
const app = createDeliveraExpressCoreApp({ port: PORT });

let server;
let gracefulShutdown = () => {};

async function boot() {
  try {
    server = await listenWithRetry(app, PORT);

    gracefulShutdown = registerGracefulShutdown(server, {
      onShutdown: async () => {
        stopBackgroundWorkers();
      },
    });
    registerFatalHandlers(server, gracefulShutdown);

    console.log(`Delivera running on http://localhost:${PORT}`);
    const accessMode = superTokensEnabled
      ? `auth at http://localhost:${PORT}/auth${legacyAuthEnabled ? ' (hybrid legacy + SuperTokens enabled)' : ''}`
      : (authEnabled ? 'login at / then /report' : `report at http://localhost:${PORT}/report`);
    console.log(`Access: ${accessMode}`);
    console.log('API: POST /api/issues/:issueKey/comment (Current Sprint Jira nudge)');

    logger.info('Server started', { port: PORT });

    await startBackgroundWorkers({ port: PORT });
  } catch (err) {
    if (err?.code === 'EADDRINUSE') {
      process.exit(1);
    }
    logger.error('Server failed to start', { error: err?.message });
    process.exit(1);
  }
}

boot();
