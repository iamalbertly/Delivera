import { createJiraReportingExpressCoreApp } from '../lib/Jira-Reporting-App-Express-Core-App-Factory-Handler.js';
import { appEnvConfig } from '../lib/Jira-Reporting-App-Config-Env-Services-Core-SSOT.js';

const app = createJiraReportingExpressCoreApp({
  port: appEnvConfig.port,
  enableBackgroundWorkers: false,
});

export default function handler(req, res) {
  return app(req, res);
}
