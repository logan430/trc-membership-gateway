# Phase 22: Operational Readiness - Research

**Researched:** 2026-01-21
**Domain:** Production deployment, logging, monitoring, operational resilience
**Confidence:** HIGH

## Summary

This research investigates operational readiness requirements for deploying the TRC Membership Gateway to production. The codebase already has **significant operational infrastructure in place**: pino structured logging, a health check endpoint, environment separation via Zod validation, and comprehensive documentation. However, **three critical gaps exist**: graceful shutdown handling, error monitoring (Sentry), and incident runbooks.

The application uses Express 5.2.1 with pino for logging, which is the right foundation. PM2 is recommended for process management (already documented in DEPLOYMENT.md). The primary work for this phase is: (1) implementing graceful shutdown for the HTTP server, Discord bot, and Prisma connections; (2) integrating Sentry for error tracking; and (3) creating operational runbooks.

**Primary recommendation:** Focus on implementation of graceful shutdown and Sentry integration, then create comprehensive incident runbooks based on the specific failure modes of this application (Stripe webhooks, Discord bot, email delivery).

## Current State Analysis

### What EXISTS (already implemented)

| Item | Status | Location | Notes |
|------|--------|----------|-------|
| Logging (pino) | COMPLETE | `src/index.ts` | Structured JSON logging, level-based on NODE_ENV |
| Health check endpoint | COMPLETE | `src/index.ts` line 127-134 | Returns status, timestamp, environment |
| Environment separation | COMPLETE | `src/config/env.ts` | Zod validation, dev/prod/test modes |
| Rate limiting | COMPLETE | `src/middleware/rate-limit.ts` | Auth endpoints protected |
| CORS configuration | COMPLETE | `src/index.ts` | Production restricts to APP_URL |
| Documentation | COMPLETE | `docs/DEPLOYMENT.md` | PM2 setup, security checklist, rollback steps |
| Webhook idempotency | COMPLETE | `src/webhooks/stripe.ts` | StripeEvent table prevents duplicates |

### What is MISSING (needs implementation)

| Item | Severity | Gap Analysis |
|------|----------|--------------|
| Graceful shutdown | HIGH | No SIGTERM/SIGINT handlers; server, bot, Prisma connections not cleaned up |
| Error monitoring (Sentry) | HIGH | No Sentry integration; errors only logged to pino |
| Alerting configuration | MEDIUM | No external alerting; relies on log inspection |
| Incident runbook | MEDIUM | No runbook exists; operational knowledge in various docs |
| Rollback plan (documented) | MEDIUM | Basic steps in DEPLOYMENT.md but not comprehensive |

### Logging Coverage Assessment

Current logging is **comprehensive** for key events:

```
HIGH COVERAGE (30+ logger calls found):
- Webhook events: received, processed, errors, duplicates
- Discord bot: login, errors, role sync, introduction detection
- Billing: payment failures, grace periods, recovery
- Reconciliation: job start, completion, issues found
- Startup: server started, bot ready, scheduler started

GAPS:
- No request-level logging (access logs)
- No correlation IDs for request tracing
- Console.log statements: NONE found (good)
```

## Standard Stack

### Core (Already In Place)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| pino | 10.2.0 | Structured logging | Implemented |
| pino-pretty | 13.1.3 | Dev log formatting | Implemented (dev only) |
| Express | 5.2.1 | HTTP server | Implemented |
| helmet | 8.1.0 | Security headers | Implemented |

### To Add

| Library | Version | Purpose | Installation |
|---------|---------|---------|--------------|
| @sentry/node | ^9.x | Error monitoring | `npm install @sentry/node` |

**Note:** @sentry/profiling-node is optional; adds performance profiling but increases overhead.

### Process Management (External)

| Tool | Purpose | Notes |
|------|---------|-------|
| PM2 | Process management | Already documented in DEPLOYMENT.md |

**Installation:**
```bash
# Sentry only (profiling optional)
npm install @sentry/node
```

## Architecture Patterns

### Graceful Shutdown Pattern

The application must handle shutdown signals properly. Current state: **NO graceful shutdown implemented**.

**Required cleanup order:**
1. Stop accepting new HTTP connections
2. Wait for in-flight requests to complete (with timeout)
3. Disconnect Discord bot
4. Close Prisma database pool
5. Exit process

**Implementation pattern:**

```typescript
// Source: Express.js official docs + PM2 best practices
// https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html
// https://pm2.io/docs/runtime/best-practices/graceful-shutdown/

const SHUTDOWN_TIMEOUT = 10000; // 10 seconds

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received');

  // 1. Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // 2. Disconnect Discord bot
  discordClient.destroy();
  logger.info('Discord client disconnected');

  // 3. Close Prisma connections
  await prisma.$disconnect();
  logger.info('Database connections closed');

  // 4. Exit
  process.exit(0);
}

// Force exit after timeout
setTimeout(() => {
  logger.error('Forced shutdown after timeout');
  process.exit(1);
}, SHUTDOWN_TIMEOUT);

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### Sentry Integration Pattern (ESM/TypeScript)

**Initialization must happen BEFORE other imports.** For ESM, use the `--import` flag.

**File structure:**
```
src/
  instrument.ts     # Sentry init - imported first via --import
  index.ts          # Main app - no changes needed
```

**instrument.ts:**
```typescript
// Source: Sentry Express docs
// https://docs.sentry.io/platforms/javascript/guides/express/

import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production', // Only in production
  tracesSampleRate: 0.1, // 10% of transactions for performance
  beforeSend(event) {
    // Scrub sensitive data if needed
    return event;
  },
});
```

**index.ts additions:**
```typescript
import * as Sentry from '@sentry/node';

// After all routes, before 404 handler:
Sentry.setupExpressErrorHandler(app);
```

**Start command:**
```bash
# Development (Sentry disabled)
tsx watch src/index.ts

# Production with Sentry
node --import ./dist/instrument.js dist/index.js
```

### Health Check Enhancement Pattern

Current health check is basic. For production, consider enhanced version:

```typescript
// Current (sufficient for MVP)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// Enhanced (optional - for Kubernetes readiness probes)
app.get('/health/ready', async (req, res) => {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    // Check Discord bot status
    const botReady = discordClient.isReady();

    if (!botReady) {
      return res.status(503).json({ status: 'degraded', discord: false });
    }

    res.json({ status: 'ready', database: true, discord: true });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: 'Database unavailable' });
  }
});
```

**Recommendation:** Current `/health` is sufficient for initial deployment. Enhanced checks can be added later.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error tracking/alerting | Custom error aggregation | Sentry | Deduplication, stack traces, release tracking, alerting |
| Process management | Node cluster wrapper | PM2 | Restart on crash, log rotation, metrics, cluster mode |
| Log aggregation | File parsing scripts | pino transports | Async, structured, integrates with observability tools |
| Uptime monitoring | Custom ping scripts | External services | Uptime Robot, Better Uptime (free tiers available) |

## Common Pitfalls

### Pitfall 1: Synchronous Shutdown Handlers

**What goes wrong:** Using `process.exit()` immediately in signal handlers, killing in-flight requests and corrupting database operations.

**Why it happens:** Developers treat SIGTERM like an immediate kill signal.

**How to avoid:**
- Use `server.close()` to stop accepting new connections
- Wait for in-flight requests with timeout
- Clean up resources in sequence
- Only call `process.exit()` after cleanup

**Warning signs:** "Connection reset" errors during deployments, incomplete webhook processing.

### Pitfall 2: Sentry Initialization Too Late

**What goes wrong:** Auto-instrumentation doesn't capture errors from modules imported before Sentry.init().

**Why it happens:** Sentry patches modules at import time; late init misses them.

**How to avoid:**
- Create separate `instrument.ts` file
- Use `--import` flag for ESM (Node 18.19+)
- Verify Sentry captures test error on startup

**Warning signs:** Express errors not appearing in Sentry dashboard.

### Pitfall 3: No Shutdown Timeout

**What goes wrong:** Application hangs forever waiting for connections that will never close (e.g., WebSocket, long-polling).

**Why it happens:** `server.close()` waits indefinitely for all connections.

**How to avoid:**
- Set hard timeout (10-30 seconds) with `setTimeout` + `process.exit(1)`
- Configure PM2 `kill_timeout` to match (default 1600ms is too short)

**Warning signs:** PM2 shows "stopping" for extended period before SIGKILL.

### Pitfall 4: Missing PM2 Configuration for ESM

**What goes wrong:** PM2 doesn't pass `--import` flag, Sentry doesn't initialize.

**Why it happens:** `npm start` or `node dist/index.js` doesn't include instrumentation.

**How to avoid:**
- Use ecosystem.config.cjs with `node_args: ['--import', './dist/instrument.js']`
- Or update npm start script to include flag

**Warning signs:** Errors not appearing in Sentry despite production deployment.

### Pitfall 5: Overly Verbose Production Logging

**What goes wrong:** Debug-level logs flood production, increasing costs and noise.

**Why it happens:** Forgetting to set appropriate log level for production.

**How to avoid:**
- Already handled: `level: env.NODE_ENV === 'production' ? 'info' : 'debug'`
- Verify pino-pretty transport is NOT used in production (already correct)

**Warning signs:** Massive log volumes, slow log queries.

## Incident Runbook Structure

Based on the application's architecture, the runbook should cover these scenarios:

### Critical Scenarios (Service Down)

1. **Application Won't Start**
   - Check: Environment variables, database connectivity, Stripe keys
   - Recovery: Review PM2 logs, verify env, restart

2. **Discord Bot Offline**
   - Impact: No role assignments, no intro detection
   - Check: Bot token, intents, guild membership
   - Recovery: Restart application, verify bot permissions

3. **Stripe Webhooks Failing**
   - Impact: Subscriptions not activated, payments not recorded
   - Check: Webhook secret, signature verification, Stripe Dashboard
   - Recovery: Verify webhook URL, check Stripe event logs, replay events

### Degraded Service Scenarios

4. **Email Delivery Failing**
   - Impact: Welcome emails, payment failure notifications not sent
   - Check: Resend API key, domain verification
   - Recovery: Verify Resend dashboard, check API limits

5. **Database Connection Issues**
   - Impact: All operations fail
   - Check: Supabase status, connection string, pooler vs direct
   - Recovery: Verify Supabase project not paused, check connection limits

6. **Reconciliation Job Failing**
   - Impact: Drift between Stripe/Discord/Database not detected
   - Check: RECONCILIATION_PAUSED, cron schedule, error logs
   - Recovery: Run manual reconciliation, review error logs

### Recovery Procedures

7. **Rollback Deployment**
   - Steps: Stop PM2, checkout previous tag, rebuild, restart
   - Database: Use Supabase PITR if schema changed

8. **Stripe Event Replay**
   - When: Missed webhooks during outage
   - How: Use Stripe Dashboard to resend specific events

## Alerting Configuration

### Recommended Alerts (via Sentry or external monitoring)

| Alert | Trigger | Severity | Action |
|-------|---------|----------|--------|
| Application down | Health check fails 3x | Critical | Page on-call |
| Webhook errors spike | >5 errors in 5 min | High | Investigate immediately |
| Discord bot offline | Bot disconnected >5 min | High | Check logs, restart |
| Payment failures | >3 failures in 1 hour | Medium | Review Stripe dashboard |
| Email delivery errors | Any delivery failure | Low | Check Resend, verify domain |

### External Monitoring (Recommended)

For health check monitoring, use external service (Sentry doesn't do uptime):

- **Uptime Robot** (free): Monitor `/health` endpoint
- **Better Uptime** (free tier): More features, status pages
- **Pingdom** (paid): Enterprise option

## Environment Separation

### Current State (COMPLETE)

Environment separation is already well-implemented:

```typescript
// src/config/env.ts
NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
```

**Behavior by environment:**

| Feature | Development | Production |
|---------|-------------|------------|
| Log level | debug | info |
| Log format | pino-pretty | JSON |
| CORS | All origins | APP_URL only |
| Email provider | console | resend |
| Prisma logging | query, error, warn | error only |

### Staging Environment

No staging environment is configured. For future:

```env
# .env.staging
NODE_ENV=production  # Use production behaviors
APP_URL=https://staging.yourdomain.com
EMAIL_PROVIDER=console  # Don't send real emails
STRIPE_SECRET_KEY=sk_test_...  # Use test mode
```

## Rollback Plan (Enhanced)

The existing DEPLOYMENT.md has basic rollback steps. Enhanced version:

### Pre-Deployment Checklist

- [ ] Tag current release: `git tag v1.0.X`
- [ ] Backup dist folder: `cp -r dist dist.backup`
- [ ] Note current Supabase backup timestamp
- [ ] Verify Stripe webhook events are current

### Rollback Procedure

**1. Immediate Rollback (No Schema Changes)**

```bash
# Stop current deployment
pm2 stop trc-gateway

# Restore previous version
git checkout v1.0.X
npm install
npm run build

# Restart
pm2 start trc-gateway
curl https://yourdomain.com/health
```

**2. Full Rollback (With Schema Changes)**

```bash
# Stop application
pm2 stop trc-gateway

# Restore code
git checkout v1.0.X
npm install
npm run build

# Restore database (Supabase PITR)
# Dashboard > Database > Backups > Point in Time Recovery
# Select timestamp BEFORE deployment

# Push previous schema
npx prisma db push

# Restart
pm2 start trc-gateway
```

**3. Stripe Webhook Recovery**

After rollback, replay any missed events:
1. Go to Stripe Dashboard > Developers > Webhooks
2. Select your endpoint
3. View "Events" tab
4. Find events during outage window
5. Click "Resend" for each failed event

## Open Questions

1. **Sentry DSN Source**
   - What we know: Sentry requires a DSN from project settings
   - What's unclear: Will a Sentry account be created, or use existing?
   - Recommendation: Create free Sentry account, add SENTRY_DSN to env

2. **External Monitoring Service**
   - What we know: Sentry doesn't provide uptime monitoring
   - What's unclear: Which service to use for health check monitoring?
   - Recommendation: Use Uptime Robot (free) or Better Uptime

3. **Log Aggregation**
   - What we know: pino outputs JSON to stdout
   - What's unclear: Will logs be aggregated externally or just PM2 logs?
   - Recommendation: Start with PM2 log files, add aggregation later if needed

## PM2 Configuration (Recommended)

Update ecosystem.config.cjs for proper ESM and graceful shutdown:

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'trc-gateway',
    script: 'dist/index.js',
    node_args: ['--import', './dist/instrument.js'], // Sentry instrumentation
    instances: 1,
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Graceful shutdown settings
    kill_timeout: 15000,        // Wait 15s before SIGKILL (match app timeout)
    wait_ready: false,          // Don't wait for process.send('ready')
    listen_timeout: 10000,      // Timeout waiting for listen
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Resource limits
    max_memory_restart: '500M',
  }]
};
```

## Sources

### Primary (HIGH confidence)

- [Sentry Express Documentation](https://docs.sentry.io/platforms/javascript/guides/express/) - Official setup guide
- [Express.js Health Checks and Graceful Shutdown](https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html) - Official Express docs
- [PM2 Graceful Shutdown Best Practices](https://pm2.io/docs/runtime/best-practices/graceful-shutdown/) - Official PM2 docs

### Secondary (MEDIUM confidence)

- [Better Stack Pino Guide](https://betterstack.com/community/guides/logging/how-to-install-setup-and-use-pino-to-log-node-js-applications/) - Comprehensive pino best practices
- [Rootly Incident Runbook Guide 2025](https://rootly.com/blog/incident-response-runbook-template-2025-step-by-step-guide-real-world-examples) - Modern runbook templates
- [IsDown Runbook Best Practices](https://isdown.app/blog/how-to-create-a-runbook-template-that-actually-gets-used) - Practical runbook advice

### Tertiary (LOW confidence - general patterns)

- Various Medium articles on graceful shutdown patterns
- Community discussions on Node.js deployment

## Metadata

**Confidence breakdown:**
- Current state analysis: HIGH - Direct codebase inspection
- Graceful shutdown pattern: HIGH - Official Express/PM2 docs
- Sentry integration: HIGH - Official Sentry docs
- Runbook structure: MEDIUM - Industry patterns, app-specific needs
- Alerting recommendations: MEDIUM - Based on app architecture

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable domain)
