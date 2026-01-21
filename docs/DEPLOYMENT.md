# Deployment Guide

Production deployment guide for The Revenue Council Membership Gateway.

**Prerequisites:**
- Node.js 20+ runtime
- PostgreSQL database (Supabase recommended)
- Stripe account (live mode)
- Discord application with bot
- Resend account (for email)
- Domain with SSL certificate

---

## Production Checklist

Before deploying, verify:

- [ ] All environment variables set (see Section 3)
- [ ] Database migrated (`npx prisma db push`)
- [ ] Admin user seeded (`npx prisma db seed`)
- [ ] Stripe webhook endpoint configured (see Section 5)
- [ ] Discord bot invited to production guild
- [ ] Email domain verified in Resend
- [ ] CORS configured for production domain
- [ ] Rate limiting tested

---

## 1. Environment Variables

### Required for Production

```env
# ===================
# APPLICATION
# ===================
NODE_ENV=production
PORT=3000
APP_URL=https://yourdomain.com

# ===================
# AUTHENTICATION
# ===================
# Generate a cryptographically secure secret (64+ characters):
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-64-byte-hex-secret

# ===================
# DATABASE (Supabase)
# ===================
# Use the Pooler connection string from Supabase
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

# ===================
# STRIPE (LIVE MODE)
# ===================
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_INDIVIDUAL_PRICE_ID=price_...
STRIPE_OWNER_SEAT_PRICE_ID=price_...
STRIPE_TEAM_SEAT_PRICE_ID=price_...

# ===================
# DISCORD
# ===================
DISCORD_CLIENT_ID=your_application_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_production_server_id
DISCORD_REDIRECT_URI=https://yourdomain.com/auth/callback
DISCORD_INTRODUCTIONS_CHANNEL_ID=your_channel_id
DISCORD_ADMIN_CHANNEL_ID=your_channel_id
DISCORD_BILLING_SUPPORT_CHANNEL_ID=your_channel_id
DISCORD_INVITE_URL=https://discord.gg/your-invite

# ===================
# EMAIL (Resend)
# ===================
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM_ADDRESS=The Revenue Council <noreply@yourdomain.com>
EMAIL_REPLY_TO=support@yourdomain.com

# ===================
# RECONCILIATION
# ===================
RECONCILIATION_AUTO_FIX=false
RECONCILIATION_PAUSED=false
RECONCILIATION_TIMEZONE=America/New_York
RECONCILIATION_HOUR=3
ADMIN_EMAIL=admin@yourdomain.com

# ===================
# ADMIN SEED
# ===================
ADMIN_SEED_EMAIL=admin@yourdomain.com
ADMIN_SEED_PASSWORD=secure-password-here
```

### JWT_SECRET Requirements

For production, the JWT_SECRET must be:
- At least 64 characters long
- Cryptographically random (not a passphrase)
- Unique per environment

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 2. Database Configuration

### Supabase Project Setup

1. **Create Supabase Project**
   - Go to https://supabase.com/dashboard
   - Click "New Project"
   - Choose a region close to your users
   - Set a strong database password

2. **Get Connection String**
   - Navigate to Settings > Database
   - Copy the **Pooler** connection string (NOT direct)
   - The pooler handles connection management for serverless/edge

3. **Configure Connection Pooling**
   - Supabase uses pgbouncer for connection pooling
   - Pooler mode: Transaction (default)
   - Max connections per tenant: 15 (free tier)

### Pro Tier Recommendation

For production, upgrade to Supabase Pro tier:
- **Point-in-Time Recovery (PITR)**: Critical for data recovery
- **Daily backups**: Automatic 7-day retention
- **More connections**: 60 pooled connections
- **No project pausing**: Free tier pauses after inactivity

### Running Migrations

```bash
# Push schema to production database
npx prisma db push

# Seed the admin user
npx prisma db seed

# Verify tables created
npx prisma studio  # Optional: opens database viewer
```

---

## 3. Stripe Production Configuration

### Switching from Test to Live

1. **Enable Live Mode**
   - Toggle from Test to Live in Stripe Dashboard
   - Note: Test and Live data are completely separate

2. **Update API Keys**
   - Dashboard > Developers > API Keys
   - Replace `sk_test_...` with `sk_live_...`
   - Store securely (never commit to git)

3. **Create Production Products**
   - Recreate products in Live mode (not copied from Test)
   - Individual Membership: Monthly recurring
   - Owner Seat: Monthly recurring
   - Team Seat: Monthly recurring

### Webhook Configuration

1. **Create Webhook Endpoint**
   - Stripe Dashboard > Developers > Webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://yourdomain.com/webhooks/stripe`

2. **Select Events**
   Subscribe to these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

3. **Copy Signing Secret**
   - After creating endpoint, reveal signing secret
   - Set as `STRIPE_WEBHOOK_SECRET` environment variable

### Testing Webhook with Stripe CLI

```bash
# Test a specific event
stripe trigger checkout.session.completed --live

# Or forward live webhooks to local for debugging
stripe listen --forward-to localhost:3000/webhooks/stripe --live
```

---

## 4. Discord Production Configuration

### OAuth Redirect URI

1. **Update Discord Application**
   - Discord Developer Portal > Your App > OAuth2
   - Add production redirect: `https://yourdomain.com/auth/callback`
   - Remove localhost redirect in production app

2. **Environment Variable**
   ```env
   DISCORD_REDIRECT_URI=https://yourdomain.com/auth/callback
   ```

### Production Guild Setup

1. **Create/Select Production Server**
   - Use a separate server for production (not your test server)
   - Note the Guild ID

2. **Invite Bot**
   - OAuth2 > URL Generator
   - Scopes: `bot`, `applications.commands`
   - Permissions: Manage Roles, Send Messages, Add Reactions, Kick Members, Read Message History
   - Use generated URL to invite to production server

3. **Create Required Channels**
   - `#introductions` - Members post introductions (required)
   - `#admin-alerts` - Bot notifications (optional)
   - `#billing-support` - Billing issues (optional)

### Bot Permissions Review

Ensure bot role is positioned correctly:
1. Server Settings > Roles
2. Bot role must be **above** managed roles (Squire, Knight, Lord, Debtor)
3. Below admin/moderator roles

### Privileged Intents Verification

Discord Developer Portal > Bot:
- [x] SERVER MEMBERS INTENT - Required for role management
- [x] MESSAGE CONTENT INTENT - Required for introduction detection

---

## 5. Email Configuration

### Resend Account Setup

1. **Create Account**
   - Sign up at https://resend.com
   - Free tier: 3,000 emails/month

2. **Get API Key**
   - Dashboard > API Keys
   - Create new key with "Full access"
   - Set as `RESEND_API_KEY`

### Domain Verification

1. **Add Domain**
   - Resend Dashboard > Domains
   - Add your sending domain

2. **Configure DNS Records**
   Add these DNS records to your domain:

   | Type | Name | Value |
   |------|------|-------|
   | TXT | @ or resend._domainkey | (provided by Resend) |
   | MX | @ | (provided by Resend) |

3. **Verify Domain**
   - Click "Verify" in Resend dashboard
   - May take up to 24 hours for DNS propagation

### Sender Address Configuration

```env
EMAIL_FROM_ADDRESS=The Revenue Council <noreply@yourdomain.com>
EMAIL_REPLY_TO=support@yourdomain.com
```

### Testing Email Delivery

1. Trigger a claim reminder email via admin or webhook
2. Check Resend dashboard for delivery status
3. Verify email arrives in inbox (check spam)

---

## 6. Application Deployment

### Build Process

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Output: dist/ directory
```

### Start Commands

```bash
# Development (with watch mode)
npm run dev

# Production
npm start
# Equivalent to: node dist/index.js
```

### Health Check Endpoint

The application exposes a health check endpoint:

```
GET /health
Response: { "status": "ok", "timestamp": "2026-01-21T12:00:00.000Z" }
```

Use this for:
- Load balancer health checks
- Container orchestration readiness probes
- Monitoring uptime

### Process Management (PM2)

Recommended for production: PM2 process manager

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start dist/index.js --name trc-gateway

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

**PM2 Ecosystem File (ecosystem.config.cjs):**

```javascript
module.exports = {
  apps: [{
    name: 'trc-gateway',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '500M'
  }]
};
```

```bash
# Start with ecosystem file
pm2 start ecosystem.config.cjs --env production
```

### Process Management (systemd)

Alternative for Linux servers:

**/etc/systemd/system/trc-gateway.service:**

```ini
[Unit]
Description=TRC Membership Gateway
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/trc-gateway
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable trc-gateway
sudo systemctl start trc-gateway

# Check status
sudo systemctl status trc-gateway
```

---

## 7. Security Checklist

Before going live, verify:

- [ ] **JWT_SECRET is 64+ characters** - Not a simple passphrase
- [ ] **NODE_ENV=production** - Enables production optimizations
- [ ] **HTTPS enabled** - SSL certificate configured
- [ ] **CORS restricts to APP_URL** - In production, only allows your domain
- [ ] **Rate limiting active** - 5 attempts / 15 min on auth endpoints
- [ ] **No console.log in production** - Use pino logger instead
- [ ] **Stripe webhook signature verification** - Enabled by default
- [ ] **httpOnly cookies for refresh tokens** - Prevents XSS token theft
- [ ] **Secrets not in code** - All secrets via environment variables
- [ ] **Database URL is pooler** - Not direct connection

### CORS Configuration

In production, CORS is automatically restricted:
- `NODE_ENV=development`: All origins allowed
- `NODE_ENV=production`: Only `APP_URL` allowed

### Rate Limiting

Rate limiting is enabled on sensitive endpoints:
- `/auth/login` - 5 attempts / 15 minutes
- `/auth/signup` - 5 attempts / 15 minutes
- `/auth/magic-link/request` - 5 attempts / 15 minutes
- `/admin/auth/login` - 5 attempts / 15 minutes

---

## 8. Monitoring and Logging

### Health Check Usage

Monitor the `/health` endpoint:
- Response time > 5s indicates issues
- Non-200 response triggers alerts

Example monitoring services:
- Uptime Robot (free tier available)
- Better Uptime
- Pingdom

### Error Tracking (Recommended)

Consider adding Sentry for error tracking:

```bash
npm install @sentry/node
```

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'https://your-sentry-dsn',
  environment: process.env.NODE_ENV,
});
```

### Log Aggregation

The application uses pino for structured logging. In production:

```bash
# Pipe to pino-pretty for development
npm run dev | npx pino-pretty

# In production, pipe to a log aggregator
node dist/index.js | your-log-aggregator
```

Recommended log aggregation services:
- Papertrail
- Logtail
- Datadog

### Key Events to Monitor

Set up alerts for:
- Webhook failures (Stripe webhook errors)
- Auth failures (excessive login attempts)
- Discord bot disconnections (bot goes offline)
- Email delivery failures (Resend errors)
- Database connection errors

---

## 9. Rollback Plan

### Before Deployment

1. **Create Database Backup**
   - Supabase: Dashboard > Database > Backups > Create backup
   - Or use pg_dump for manual backup

2. **Keep Previous Build**
   - Tag releases: `git tag v1.0.0`
   - Keep `dist/` backup: `cp -r dist dist.backup`

### Rollback Steps

If deployment fails:

1. **Stop New Deployment**
   ```bash
   pm2 stop trc-gateway
   # or
   sudo systemctl stop trc-gateway
   ```

2. **Restore Previous Build**
   ```bash
   git checkout v1.0.0  # Previous tag
   npm install
   npm run build
   ```

3. **Verify Health Check**
   ```bash
   pm2 start trc-gateway
   curl https://yourdomain.com/health
   ```

4. **If Schema Changed: Restore Database**
   - Supabase: Dashboard > Database > Backups > Restore
   - Critical: Only do this if migration caused issues

### Zero-Downtime Deployment

For zero-downtime updates:

1. Build new version
2. Start on different port (e.g., 3001)
3. Verify health check passes
4. Update load balancer/proxy to new port
5. Stop old instance

---

## 10. Post-Deployment Verification

After deploying, verify all integrations:

### Database
- [ ] Application starts without database errors
- [ ] Admin user can log in
- [ ] Prisma Studio accessible (if needed)

### Discord
- [ ] Bot appears online in server
- [ ] Managed roles exist (Squire, Knight, Lord, Debtor)
- [ ] Bot can assign roles (test with existing member)

### Stripe
- [ ] Webhook endpoint shows "Active" in Stripe Dashboard
- [ ] Test checkout flow completes successfully
- [ ] Webhook events appear in Stripe event logs

### Email
- [ ] Domain verified in Resend
- [ ] Test email sends successfully
- [ ] Emails not going to spam

### Authentication
- [ ] Login flow works
- [ ] Discord OAuth redirects correctly
- [ ] Session persists across requests

---

## Quick Reference

### Deployment Commands

```bash
# Build
npm run build

# Start (production)
npm start

# Database
npx prisma db push
npx prisma db seed

# Process management
pm2 start dist/index.js --name trc-gateway
pm2 logs trc-gateway
pm2 restart trc-gateway
```

### Environment Checklist

| Variable | Required | Example |
|----------|----------|---------|
| NODE_ENV | Yes | production |
| APP_URL | Yes | https://yourdomain.com |
| JWT_SECRET | Yes | (64+ char hex) |
| DATABASE_URL | Yes | postgresql://... |
| STRIPE_SECRET_KEY | Yes | sk_live_... |
| STRIPE_WEBHOOK_SECRET | Yes | whsec_... |
| DISCORD_BOT_TOKEN | Yes | (bot token) |
| DISCORD_GUILD_ID | Yes | (server id) |
| EMAIL_PROVIDER | Yes | resend |
| RESEND_API_KEY | Yes | re_... |

---

*Last updated: 2026-01-21*
