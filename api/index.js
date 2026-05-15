import { createDeliveraExpressCoreApp } from '../lib/Delivera-Express-Core-App-Factory-Handler.js';
import { appEnvConfig } from '../lib/Delivera-Config-Env-Services-Core-SSOT.js';

const app = createDeliveraExpressCoreApp({
  port: appEnvConfig.port,
  enableBackgroundWorkers: false,
});

export default function handler(req, res) {
  return app(req, res);
}
