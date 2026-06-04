import dotenv from 'dotenv';
import { createDeliveraExpressCoreApp } from '../lib/Delivera-Express-Core-App-Factory-Handler.js';

// Vercel serverless entrypoint. Keep background workers off in serverless so
// scheduled snapshot work is not duplicated on short-lived function invocations.
dotenv.config();

const app = createDeliveraExpressCoreApp({ enableBackgroundWorkers: false });

export default app;
