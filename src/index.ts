import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
import { env } from './config/env.js';

// Initialize logger
const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

// Initialize Express
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// NOTE: Do NOT add express.json() globally - webhook needs raw body
// JSON parsing will be added to specific routes that need it

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// Start server
app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started');
});

export { app, logger };
