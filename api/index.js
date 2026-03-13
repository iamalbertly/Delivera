import { createJiraReportingExpressCoreApp } from '../lib/Jira-Reporting-App-Express-Core-App-Factory-Handler.js';

const app = createJiraReportingExpressCoreApp({
  port: process.env.PORT || 3000,
  enableBackgroundWorkers: false,
});

export default function handler(req, res) {
  return app(req, res);
}

