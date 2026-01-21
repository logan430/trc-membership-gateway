import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
import * as Sentry from '@sentry/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { env } from './config/env.js';
import { stripeWebhookRouter } from './webhooks/stripe.js';
import { authRouter } from './routes/auth.js';
import { checkoutRouter } from './routes/checkout.js';
import { billingRouter } from './routes/billing.js';
import { companyCheckoutRouter } from './routes/company-checkout.js';
import { dashboardRouter } from './routes/dashboard.js';
import { teamDashboardRouter } from './routes/team-dashboard.js';
import { teamInvitesRouter } from './routes/team-invites.js';
import { teamClaimRouter } from './routes/team-claim.js';
import { claimRouter } from './routes/claim.js';
import { publicRouter } from './routes/public.js';
import { adminAuthRouter } from './routes/admin/auth.js';
import { adminMembersRouter } from './routes/admin/members.js';
import { adminAccessRouter } from './routes/admin/access.js';
import { adminConfigRouter } from './routes/admin/config.js';
import { adminAuditRouter } from './routes/admin/audit.js';
import { adminTemplatesRouter } from './routes/admin/templates.js';
import { adminAdminsRouter } from './routes/admin/admins.js';
import { startBot, discordClient } from './bot/client.js';
import { prisma } from './lib/prisma.js';
import { startBillingScheduler } from './billing/scheduler.js';
import { startReconciliationScheduler } from './reconciliation/index.js';
import { authLimiter, signupLimiter, magicLinkLimiter, adminAuthLimiter } from './middleware/rate-limit.js';

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

// Security middleware with CSP for inline scripts and Google Fonts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'"],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow onclick handlers
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors({
  origin: env.NODE_ENV === 'production'
    ? env.APP_URL
    : true, // Allow all origins in development
  credentials: true, // Allow cookies to be sent
}));

// Static file serving (CSS, images, etc.)
app.use(express.static(join(__dirname, '../public')));

// CRITICAL: Mount webhook route BEFORE express.json()
// Webhook needs raw body for signature verification
app.use('/webhooks/stripe', stripeWebhookRouter);

// JSON parsing for all other routes
app.use(express.json());

// Rate limiting on auth endpoints (security - prevent brute force)
app.use('/auth/login', authLimiter);
app.use('/auth/signup', signupLimiter);
app.use('/auth/magic-link/request', magicLinkLimiter);
app.use('/admin/auth/login', adminAuthLimiter);

// =============================================================================
// ADMIN ROUTES
// =============================================================================
// HTML pages served first (browser navigation)
// API routes use /api/admin/* prefix to avoid conflicts
// =============================================================================

// Admin auth routes (login, logout, refresh - no auth required for these)
app.use('/admin/auth', adminAuthRouter);

// Admin API routes (JSON) - use /api/admin prefix
app.use('/api/admin/members', adminMembersRouter);
app.use('/api/admin/members', adminAccessRouter);
app.use('/api/admin/config', adminConfigRouter);
app.use('/api/admin/audit', adminAuditRouter);
app.use('/api/admin/templates', adminTemplatesRouter);
app.use('/api/admin/admins', adminAdminsRouter);

// Auth routes (session refresh, logout, signup, login)
app.use('/auth', authRouter);

// Checkout routes (Stripe Checkout session creation)
app.use('/checkout', checkoutRouter);

// Billing routes (Stripe billing portal)
app.use('/billing', billingRouter);

// Company checkout routes (team subscription purchase)
app.use('/company', companyCheckoutRouter);

// Dashboard routes (subscription status, claim availability)
app.use('/dashboard', dashboardRouter);

// Team dashboard routes (seat management for team owners)
app.use('/team', teamDashboardRouter);

// Team invite routes (invite token management for team owners)
app.use('/team', teamInvitesRouter);

// Team claim routes (invite claim flow for teammates)
app.use('/team', teamClaimRouter);

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

// Sentry error handler - captures Express errors for monitoring
// Must be after all routes but before 404 handler
Sentry.setupExpressErrorHandler(app);

// 404 catch-all - must be LAST route
app.use((_req, res) => {
  res.status(404).sendFile(join(__dirname, '../public/404.html'));
});

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================
// Handle SIGTERM (PM2/containers) and SIGINT (Ctrl+C) for clean shutdown
// =============================================================================

const SHUTDOWN_TIMEOUT = 10000; // 10 seconds

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  // Prevent multiple shutdown triggers
  if (isShuttingDown) {
    logger.info({ signal }, 'Shutdown already in progress, ignoring signal');
    return;
  }
  isShuttingDown = true;

  logger.info({ signal }, 'Shutdown signal received');

  // Set forced shutdown timeout
  const forceExitTimeout = setTimeout(() => {
    logger.error('Forced shutdown after timeout - cleanup did not complete in time');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    // 1. Stop accepting new HTTP connections
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // 2. Disconnect Discord bot
    discordClient.destroy();
    logger.info('Discord client disconnected');

    // 3. Close Prisma database connections
    await prisma.$disconnect();
    logger.info('Database connections closed');

    // Clear the forced exit timeout since cleanup completed
    clearTimeout(forceExitTimeout);

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error: error instanceof Error ? { message: error.message, stack: error.stack } : error }, 'Error during graceful shutdown');
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server started');

  // Start Discord bot after HTTP server is ready
  startBot()
    .then(() => {
      // Start billing scheduler after bot is ready
      startBillingScheduler();
      // Start reconciliation scheduler after bot is ready
      startReconciliationScheduler();
    })
    .catch((error) => {
      logger.error({ error: error instanceof Error ? { message: error.message, stack: error.stack } : error }, 'Failed to start Discord bot');
    });
});

export { app };
