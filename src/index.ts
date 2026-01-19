import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
import { env } from './config/env.js';
import { stripeWebhookRouter } from './webhooks/stripe.js';
import { startBot } from './bot/client.js';

// Initialize logger (exported for use in other modules)
export const logger = pino({
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

// CRITICAL: Mount webhook route BEFORE express.json()
// Webhook needs raw body for signature verification
app.use('/webhooks/stripe', stripeWebhookRouter);

// JSON parsing for all other routes
app.use(express.json());

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

  // Start Discord bot after HTTP server is ready
  startBot().catch((error) => {
    logger.error({ error }, 'Failed to start Discord bot');
  });
});

export { app };
