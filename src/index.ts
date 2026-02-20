import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
import * as Sentry from '@sentry/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
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
import { adminPointsConfigRouter } from './routes/admin/points-config.js';
import { adminPointsRouter } from './routes/admin/points.js';
import { adminBenchmarksRouter } from './routes/admin/benchmarks.js';
import { adminResourcesRouter } from './routes/admin/resources.js';
import { adminAnalyticsRouter } from './routes/admin/analytics.js';
import { pointsRouter } from './routes/points.js';
import { benchmarksRouter } from './routes/benchmarks.js';
import { resourcesRouter } from './routes/resources.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { memberRouter } from './routes/member.js';
import { startBot, discordClient } from './bot/client.js';
import { prisma } from './lib/prisma.js';
import { seedDefaultPointConfigs } from './points/config.js';
import { startBillingScheduler } from './billing/scheduler.js';
import { startReconciliationScheduler } from './reconciliation/index.js';
import { startJobScheduler, stopJobScheduler } from './jobs/index.js';
import { authLimiter, signupLimiter, magicLinkLimiter, adminAuthLimiter, passwordResetLimiter } from './middleware/rate-limit.js';

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

// Trust first proxy (Nginx/Coolify) so req.ip uses X-Forwarded-For
// Without this, all clients share the same rate limit behind a reverse proxy
app.set('trust proxy', 1);

// Security middleware with CSP for inline scripts and Google Fonts
// Development mode needs 'unsafe-eval' for Next.js hot module reloading
const scriptSrc = env.NODE_ENV === 'development'
  ? ["'self'", "'unsafe-inline'", "'unsafe-hashes'", "'unsafe-eval'"]
  : ["'self'", "'unsafe-inline'", "'unsafe-hashes'"];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc,
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
app.use('/auth/forgot-password', passwordResetLimiter);
app.use('/auth/reset-password', passwordResetLimiter);

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
app.use('/api/admin/points-config', adminPointsConfigRouter);
app.use('/api/admin/members', adminPointsRouter);
app.use('/api/admin/benchmarks', adminBenchmarksRouter);
app.use('/api/admin/resources', adminResourcesRouter);
app.use('/api/admin/analytics', adminAnalyticsRouter);

// Points routes (member-facing)
app.use('/api/points', pointsRouter);

// Benchmark routes (member-facing)
app.use('/api/benchmarks', benchmarksRouter);

// Resource routes (member-facing)
app.use('/api/resources', resourcesRouter);

// Leaderboard routes (member-facing)
app.use('/api/leaderboard', leaderboardRouter);

// Member settings routes (privacy, etc.)
app.use('/api/member', memberRouter);

// Auth routes (session refresh, logout, signup, login)
app.use('/auth', authRouter);

// Checkout routes (Stripe Checkout session creation)
app.use('/checkout', checkoutRouter);

// Billing routes (Stripe billing portal)
app.use('/billing', billingRouter);

// Company checkout routes (team subscription purchase)
app.use('/company', companyCheckoutRouter);

// =============================================================================
// NEXT.JS DASHBOARD PROXY
// =============================================================================
// Proxy /dashboard/* requests to Next.js app running on port 3000
// Must be mounted BEFORE other /dashboard routes
// =============================================================================

// Only enable proxy in development or when NEXT_APP_URL is set
if (env.NODE_ENV === 'development' || process.env.NEXT_APP_URL) {
  const nextAppUrl = process.env.NEXT_APP_URL || 'http://localhost:3000';

  // Single proxy middleware for all Next.js routes
  // Uses pathFilter instead of app.use('/path') to preserve full URL path
  // When using app.use('/path'), Express strips the mount path from req.url,
  // causing the proxy to send '/' instead of the full path to Next.js
  const nextProxyMiddleware = createProxyMiddleware({
    target: nextAppUrl,
    changeOrigin: true,
    ws: true, // WebSocket support for HMR in dev
    pathFilter: (path) => {
      // Proxy these paths to Next.js
      return path === '/' ||
             path.startsWith('/_next') ||
             path.startsWith('/login') ||
             path.startsWith('/signup') ||
             path.startsWith('/forgot-password') ||
             path.startsWith('/reset-password') ||
             path.startsWith('/checkout') ||
             path.startsWith('/admin') ||
             path.startsWith('/dashboard');
    },
    on: {
      proxyReq: (proxyReq, req) => {
        // Forward all cookies to Next.js for authentication
        const cookies = req.headers.cookie;
        if (cookies) {
          proxyReq.setHeader('Cookie', cookies);
        }
        // Log proxy requests in development
        if (env.NODE_ENV === 'development') {
          logger.debug({
            path: req.url,
            hasCookie: !!cookies,
          }, 'Proxying to Next.js');
        }
      },
      proxyRes: (proxyRes, req) => {
        // Log proxy responses in development
        if (env.NODE_ENV === 'development') {
          logger.debug({
            path: req.url,
            status: proxyRes.statusCode
          }, 'Next.js proxy response');
        }
      },
    },
  });
  app.use(nextProxyMiddleware);

  logger.info({ target: nextAppUrl }, 'Next.js proxy enabled for /, /_next, /login, /signup, /admin, /dashboard');
}

// Dashboard API routes (subscription status, claim availability)
// Mounted at /api/dashboard to avoid conflict with Next.js proxy at /dashboard
app.use('/api/dashboard', dashboardRouter);

// Team dashboard routes (seat management for team owners)
app.use('/team', teamDashboardRouter);

// Team invite routes (invite token management for team owners)
app.use('/team', teamInvitesRouter);

// Team claim routes (invite claim flow for teammates)
app.use('/team', teamClaimRouter);

// Claim routes (Discord OAuth claim flow for paid users)
app.use('/claim', claimRouter);

// Health check endpoint with service-by-service status
app.get('/health', async (req, res) => {
  const checks: Record<string, boolean> = {
    database: false,
    discord: false,
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check Discord bot status
  checks.discord = discordClient.isReady();

  // Degraded mode: Return 200 with status JSON
  // App stays available even if non-critical dependencies are down
  const allHealthy = Object.values(checks).every(Boolean);

  res.status(200).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    checks,
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
    // 1. Stop background jobs
    stopJobScheduler();
    logger.info('Background jobs stopped');

    // 2. Stop accepting new HTTP connections
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // 3. Disconnect Discord bot
    discordClient.destroy();
    logger.info('Discord client disconnected');

    // 4. Close Prisma database connections
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

  // Seed default point configs (idempotent - uses skipDuplicates)
  seedDefaultPointConfigs()
    .then(() => logger.info('Default point configs seeded'))
    .catch((error) => logger.error({ error }, 'Failed to seed point configs'));

  // Start Discord bot after HTTP server is ready
  startBot()
    .then(() => {
      // Start billing scheduler after bot is ready
      startBillingScheduler();
      // Start reconciliation scheduler after bot is ready
      startReconciliationScheduler();
      // Start job scheduler (MEE6 sync, streak calculation)
      startJobScheduler();
    })
    .catch((error) => {
      logger.error({ error: error instanceof Error ? { message: error.message, stack: error.stack } : error }, 'Failed to start Discord bot');
    });
});

export { app };
