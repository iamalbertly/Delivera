import dotenv from 'dotenv';
import express from 'express';
import { createDeliveraExpressCoreApp } from './lib/Delivera-Express-Core-App-Factory-Handler.js';

// Vercel zero-config Express entrypoint (must import "express" in this file).
// Local dev/production process host: npm start → server.js
dotenv.config();

const app = createDeliveraExpressCoreApp({ enableBackgroundWorkers: false });

export default app;
