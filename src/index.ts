import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { env } from './config/env.js';
import { stripeWebhookRouter } from './webhooks/stripe.js';
import { authRouter } from './routes/auth.js';
import { checkoutRouter } from './routes/checkout.js';
import { dashboardRouter } from './routes/dashboard.js';
import { claimRouter } from './routes/claim.js';
import { publicRouter } from './routes/public.js';
import { startBot } from './bot/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Static file serving (CSS, images, etc.)
app.use(express.static(join(__dirname, '../public')));

// CRITICAL: Mount webhook route BEFORE express.json()
// Webhook needs raw body for signature verification
app.use('/webhooks/stripe', stripeWebhookRouter);

// JSON parsing for all other routes
app.use(express.json());

// Auth routes (session refresh, logout, signup, login)
app.use('/auth', authRouter);

// Checkout routes (Stripe Checkout session creation)
app.use('/checkout', checkoutRouter);

// Dashboard routes (subscription status, claim availability)
app.use('/dashboard', dashboardRouter);

// Claim routes (Discord OAuth claim flow for paid users)
app.use('/claim', claimRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// Public routes (landing page - mounted last so named routes take precedence)
app.use(publicRouter);

// Start server
app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started');

  // Start Discord bot after HTTP server is ready
  startBot().catch((error) => {
    logger.error({ error }, 'Failed to start Discord bot');
  });
});

export { app };
