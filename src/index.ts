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
import { startBot } from './bot/client.js';
import { startBillingScheduler } from './billing/scheduler.js';
import { startReconciliationScheduler } from './reconciliation/index.js';

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
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors());

// Static file serving (CSS, images, etc.)
app.use(express.static(join(__dirname, '../public')));

// CRITICAL: Mount webhook route BEFORE express.json()
// Webhook needs raw body for signature verification
app.use('/webhooks/stripe', stripeWebhookRouter);

// JSON parsing for all other routes
app.use(express.json());

// =============================================================================
// ADMIN ROUTES
// =============================================================================
// /admin/auth/*      - Auth routes (login, logout, refresh - no auth required)
// /admin/members/*   - Member management (requireAdmin)
// /admin/config/*    - Feature flags (requireAdmin, some requireSuperAdmin)
// /admin/audit/*     - Audit logs (requireAdmin)
// /admin/templates/* - Email templates (requireAdmin, PUT requireSuperAdmin)
// /admin/admins/*    - Admin management (requireSuperAdmin)
// =============================================================================

// Admin auth routes (login, logout, refresh - no auth required for these)
app.use('/admin/auth', adminAuthRouter);

// Admin member management routes (requires admin auth)
app.use('/admin/members', adminMembersRouter);

// Admin access control routes (revoke, reset claim, grant role - same base path)
app.use('/admin/members', adminAccessRouter);

// Admin config routes (feature flags, discord channels)
app.use('/admin/config', adminConfigRouter);

// Admin audit log routes
app.use('/admin/audit', adminAuditRouter);

// Admin email template routes
app.use('/admin/templates', adminTemplatesRouter);

// Admin account management routes (super admin only)
app.use('/admin/admins', adminAdminsRouter);

// Auth routes (session refresh, logout, signup, login)
app.use('/auth', authRouter);

// Checkout routes (Stripe Checkout session creation)
app.use('/checkout', checkoutRouter);

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

// Start server
app.listen(env.PORT, () => {
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
      logger.error({ error }, 'Failed to start Discord bot');
    });
});

export { app };
