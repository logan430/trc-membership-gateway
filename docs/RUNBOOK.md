# Incident Runbook

Production incident response procedures for The Revenue Council Membership Gateway.

**Last updated:** 2026-01-21

---

## Quick Reference

```bash
# Health check
curl https://yourdomain.com/health

# PM2 status
pm2 status
pm2 logs trc-gateway --lines 100

# Restart application
pm2 restart trc-gateway

# View recent logs
pm2 logs trc-gateway --lines 500 --nostream
```

### Key URLs

| Service | Dashboard |
|---------|-----------|
| Supabase | https://supabase.com/dashboard |
| Stripe | https://dashboard.stripe.com |
| Discord | https://discord.com/developers |
| Resend | https://resend.com/overview |
| Sentry | https://sentry.io |

---

## Critical Incidents

### 1. Application Won't Start

**Symptoms:**
- PM2 shows `errored` or `stopped` status
- `/health` endpoint returns 503 or times out
- No logs being written

**Diagnosis:**

1. Check PM2 logs for startup errors:
   ```bash
   pm2 logs trc-gateway --lines 100
   ```

2. Look for these common error patterns:
   - `DATABASE_URL is required` - Missing environment variable
   - `Invalid connection string` - Malformed Supabase URL
   - `Cannot find module` - Build artifacts missing
   - `EADDRINUSE` - Port already in use

3. Verify environment file exists:
   ```bash
   cat .env | grep -v PASSWORD | grep -v SECRET | grep -v KEY
   ```

**Common Causes & Fixes:**

| Cause | Solution |
|-------|----------|
| Missing DATABASE_URL | Set Supabase pooler connection string in .env |
| Invalid DISCORD_BOT_TOKEN | Regenerate in Discord Developer Portal > Bot > Reset Token |
| Port already in use | `lsof -i :3000` to find process, `kill <PID>` |
| TypeScript compilation failed | Run `npm run build` manually to see errors |
| Missing node_modules | Run `npm install` |
| Build directory missing | Run `npm run build` |

**Recovery:**

```bash
# 1. Identify the issue from logs
pm2 logs trc-gateway --lines 100

# 2. Fix the identified issue (env var, rebuild, etc.)

# 3. Rebuild if needed
npm run build

# 4. Restart
pm2 restart trc-gateway

# 5. Verify health
curl https://yourdomain.com/health
```

---

### 2. Discord Bot Offline

**Symptoms:**
- Bot shows offline (gray dot) in Discord server member list
- Role assignments failing silently
- Introduction detection not working
- Logs show "Discord client error" or no "Bot logged in" message

**Diagnosis:**

1. Check bot status in Discord server:
   - Server Settings > Members > Search for bot name
   - Gray dot = offline, Green dot = online

2. Check application logs:
   ```bash
   pm2 logs trc-gateway --lines 200 | grep -i discord
   ```

3. Look for these patterns:
   - `TOKEN_INVALID` - Bot token is wrong or revoked
   - `DISALLOWED_INTENTS` - Privileged intents not enabled
   - `429` or `rate limit` - Rate limited by Discord

4. Verify bot is in the guild:
   ```bash
   # Check if bot has any guild access (from logs at startup)
   pm2 logs trc-gateway | grep "guild"
   ```

**Common Causes & Fixes:**

| Cause | Solution |
|-------|----------|
| Bot token invalidated | Discord Developer Portal > Your App > Bot > Reset Token, update .env |
| Privileged intents disabled | Developer Portal > Bot > Enable SERVER MEMBERS INTENT and MESSAGE CONTENT INTENT |
| Bot kicked from server | Re-invite using OAuth URL from Developer Portal > OAuth2 > URL Generator |
| Rate limited | Wait for rate limit to reset (usually 1-5 minutes) |
| Bot role too low | Server Settings > Roles > Move bot role above managed roles |

**Recovery:**

```bash
# 1. Verify/fix bot token or intents

# 2. Restart application (bot reconnects on startup)
pm2 restart trc-gateway

# 3. Check logs for successful connection
pm2 logs trc-gateway | grep -i "bot"

# 4. Verify bot appears online in Discord server
```

---

### 3. Stripe Webhooks Failing

**Symptoms:**
- Payments succeed in Stripe Dashboard but members not created in database
- Subscription changes not reflected in Discord roles
- Stripe Dashboard > Webhooks shows failed event delivery
- Logs show webhook signature verification failures

**Diagnosis:**

1. Check Stripe Dashboard:
   - Developers > Webhooks > Select your endpoint
   - Look at "Events" tab for failures
   - Note the error type: signature, 500, timeout

2. Check application logs:
   ```bash
   pm2 logs trc-gateway | grep -i webhook
   ```

3. Common error patterns:
   - `Webhook signature verification failed` - Wrong signing secret
   - `500 Internal Server Error` - Application error processing event
   - `ECONNREFUSED` - App not running when Stripe sent event

**Common Causes & Fixes:**

| Cause | Solution |
|-------|----------|
| Signature verification failed | Verify STRIPE_WEBHOOK_SECRET matches endpoint in Stripe Dashboard |
| App not running | Start app; Stripe auto-retries for up to 72 hours |
| Database error during processing | Check database connection, review error logs |
| Wrong endpoint URL | Update endpoint URL in Stripe Dashboard to match production |

**Recovery:**

```bash
# 1. Fix the underlying issue (secret, app running, etc.)

# 2. Restart application
pm2 restart trc-gateway

# 3. Replay failed events from Stripe Dashboard:
#    - Developers > Webhooks > Select endpoint
#    - Go to "Events" tab
#    - Click "Resend" for each failed event (within 30 days)

# 4. Verify new events are processing
pm2 logs trc-gateway | grep -i webhook
```

**Replaying Events:**

Stripe stores events for 30 days. To replay:

1. Go to Stripe Dashboard > Developers > Webhooks
2. Select your production endpoint
3. Click "Events" tab
4. Filter by date range of the outage
5. For each failed event, click the event then "Resend"
6. Verify in app logs that event processed successfully

---

### 4. Email Delivery Failing

**Symptoms:**
- Welcome emails not arriving after checkout
- Claim reminder emails not being sent
- Payment failure notification emails missing
- Resend Dashboard shows errors or bounces

**Diagnosis:**

1. Check Resend Dashboard:
   - Overview > Recent activity for delivery status
   - Logs for specific error messages

2. Check application logs:
   ```bash
   pm2 logs trc-gateway | grep -i email
   ```

3. Common patterns:
   - `401 Unauthorized` - API key invalid
   - `Domain not verified` - DNS records not set
   - `Rate limit exceeded` - Quota exhausted

**Common Causes & Fixes:**

| Cause | Solution |
|-------|----------|
| Invalid API key | Regenerate in Resend Dashboard > API Keys, update .env |
| Domain not verified | Add DNS records shown in Resend > Domains |
| Rate limited | Check Resend quota; upgrade plan if needed |
| Emails going to spam | Verify SPF/DKIM records correct; check email content |
| EMAIL_PROVIDER=console | Set EMAIL_PROVIDER=resend for production |

**Recovery:**

```bash
# 1. Fix the identified issue (API key, domain, quota)

# 2. Restart application (not strictly required but ensures env reloaded)
pm2 restart trc-gateway

# 3. Verify delivery
# - Resend Dashboard shows successful sends
# - Check inbox (and spam folder) for test email
```

**Note:** Welcome emails are fire-and-forget; claim reminders run on scheduler. No manual replay mechanism exists - unclaimed members will get reminders on next scheduled run.

---

### 5. Database Connection Issues

**Symptoms:**
- All API requests fail with 500 errors
- Logs show Prisma connection errors
- `/health` returns 200 but database operations fail

**Diagnosis:**

1. Check application logs:
   ```bash
   pm2 logs trc-gateway | grep -i "prisma\|database\|connection"
   ```

2. Common patterns:
   - `Can't reach database server` - Connection string wrong or DB down
   - `Connection pool exhausted` - Too many connections, need restart
   - `FATAL: too many connections` - Connection limit hit
   - `Project paused` - Supabase free tier auto-paused

3. Check Supabase status:
   - Visit https://status.supabase.com
   - Dashboard > Project > Check if paused

**Common Causes & Fixes:**

| Cause | Solution |
|-------|----------|
| Supabase project paused | Dashboard > Project > "Restore" button (free tier only) |
| Wrong connection string | Use Pooler URL, not Direct URL |
| Connection pool exhausted | Restart application to reset pool |
| Supabase outage | Check status.supabase.com; wait for resolution |
| SSL/TLS issues | Ensure `?sslmode=require` in connection string |

**Recovery:**

```bash
# 1. Fix underlying issue (unpause project, fix connection string)

# 2. Restart application to reset connection pool
pm2 restart trc-gateway

# 3. Verify with health check
curl https://yourdomain.com/health

# 4. Test a database operation (e.g., admin login)
```

---

## Degraded Service Scenarios

### 6. Reconciliation Job Not Running

**Symptoms:**
- Role mismatches not being auto-fixed
- No "Starting reconciliation" messages in logs at expected time
- Drift between Stripe subscriptions and Discord roles accumulating

**Diagnosis:**

1. Check scheduler configuration:
   ```bash
   # Verify env vars
   echo $RECONCILIATION_PAUSED   # Should be false
   echo $RECONCILIATION_HOUR     # Default: 3 (3 AM)
   echo $RECONCILIATION_TIMEZONE # Default: America/New_York
   ```

2. Check recent logs for reconciliation activity:
   ```bash
   pm2 logs trc-gateway | grep -i reconciliation
   ```

3. Verify scheduler started (should see on app startup):
   ```bash
   pm2 logs trc-gateway | grep -i "scheduler"
   ```

**Common Causes & Fixes:**

| Cause | Solution |
|-------|----------|
| RECONCILIATION_PAUSED=true | Set to false, restart app |
| Wrong timezone configured | Verify RECONCILIATION_TIMEZONE matches your expectations |
| App restarted after scheduled time | Wait for next scheduled run |
| Scheduler crashed silently | Restart app; check for errors in logs |

**Recovery:**

```bash
# 1. Ensure RECONCILIATION_PAUSED=false in .env

# 2. Restart app to restart scheduler
pm2 restart trc-gateway

# 3. Wait for next scheduled run, or manually trigger if urgent:
#    (No CLI exposed - would require code change or direct API call)

# 4. Verify next scheduled run completes
pm2 logs trc-gateway | grep -i reconciliation
```

---

### 7. High Memory Usage

**Symptoms:**
- PM2 shows high memory usage (`pm2 monit`)
- Application becomes slow or unresponsive
- Frequent automatic restarts (if max_memory_restart set)

**Diagnosis:**

1. Check current memory:
   ```bash
   pm2 monit
   # Or
   pm2 status
   ```

2. Look for memory trends:
   ```bash
   pm2 describe trc-gateway | grep -i memory
   ```

3. Check for restart loops:
   ```bash
   pm2 status
   # Look at "restart" column - high numbers indicate issues
   ```

**Common Causes & Fixes:**

| Cause | Solution |
|-------|----------|
| Memory leak in recent code | Revert to previous version, investigate |
| Large payload processing | Review recent requests, add payload limits |
| Connection pool not releasing | Restart app to reset |
| Normal growth over time | Restart periodically or let PM2 auto-restart |

**Recovery:**

```bash
# 1. Immediate fix: restart application
pm2 restart trc-gateway

# 2. If recurring:
#    - Review recent code changes
#    - Check for large data processing
#    - Enable PM2 max_memory_restart (500M) in ecosystem.config.cjs

# 3. Monitor after restart
pm2 monit
```

---

## Recovery Procedures

### Rollback Deployment

For detailed rollback procedures, see **docs/DEPLOYMENT.md Section 9**.

**Quick rollback (no schema changes):**

```bash
# 1. Stop current deployment
pm2 stop trc-gateway

# 2. Checkout previous known-good tag
git checkout v1.0.X  # Replace with actual tag

# 3. Rebuild
npm install && npm run build

# 4. Restart
pm2 start trc-gateway

# 5. Verify
curl https://yourdomain.com/health
```

**Full rollback (with schema changes):**

```bash
# 1. Stop application
pm2 stop trc-gateway

# 2. Restore code
git checkout v1.0.X
npm install && npm run build

# 3. Restore database (Supabase PITR)
#    Dashboard > Database > Backups > Point-in-Time Recovery
#    Select timestamp BEFORE the problematic deployment
#    Wait for restore to complete

# 4. If PITR not available, push previous schema:
npx prisma db push

# 5. Restart and verify
pm2 start trc-gateway
curl https://yourdomain.com/health
```

---

### Replay Stripe Events

**When:** Webhooks were missed during application outage.

**Procedure:**

1. Go to Stripe Dashboard > Developers > Webhooks
2. Select your production endpoint
3. Click the "Events" tab
4. Filter by date range of the outage
5. Look for events with failed delivery status
6. For each failed event:
   - Click the event row to view details
   - Click "Resend" button
   - Verify in application logs that event was processed
7. After replaying all events, verify data consistency:
   - Check that members were created for completed checkouts
   - Verify subscriptions match Stripe in database
   - Confirm Discord roles are correct

**Note:** Events older than 30 days cannot be replayed from Stripe Dashboard.

---

### Database Restore (Emergency)

**When:** Data corruption occurred or migration caused irreversible damage.

**WARNING:** This is a destructive operation. Only use when data corruption is confirmed.

**Procedure:**

```bash
# 1. Stop application immediately to prevent further writes
pm2 stop trc-gateway

# 2. Assess the damage
#    - What data is corrupted?
#    - When did corruption start?
#    - Can we fix with SQL instead of restore?

# 3. If restore is necessary:
#    Supabase Dashboard > Database > Backups

# 4. Point-in-Time Recovery (Pro tier only):
#    - Click "Point in Time Recovery"
#    - Select timestamp BEFORE the corruption
#    - This creates a new project or restores existing

# 5. If new project created:
#    - Update DATABASE_URL in .env with new connection string
#    - Update Supabase URL in any other configs

# 6. Restart application
pm2 start trc-gateway

# 7. Verify data integrity
curl https://yourdomain.com/health
# Test admin login, check member counts, etc.

# 8. Replay any Stripe events that occurred after restore point
#    (See "Replay Stripe Events" above)
```

---

## Contacts and Escalation

### External Service Status Pages

Check these when suspecting external issues:

| Service | Status Page |
|---------|-------------|
| Supabase | https://status.supabase.com |
| Stripe | https://status.stripe.com |
| Discord | https://discordstatus.com |
| Resend | https://status.resend.com |

### When to Escalate

**Escalate immediately if:**

- **Data corruption suspected**
  - STOP all writes immediately
  - Do not attempt automated fixes
  - Assess damage before acting

- **Security breach suspected**
  - Rotate all secrets (JWT_SECRET, API keys, tokens)
  - Review audit logs for unauthorized access
  - Check for unauthorized members/admins

- **Extended outage (>30 minutes)**
  - Consider posting status update for users
  - Notify stakeholders

### Escalation Contacts

*(Update with your organization's contacts)*

| Role | Contact | When to Contact |
|------|---------|-----------------|
| Primary On-Call | [Name/Email] | Any P1 incident |
| Backup On-Call | [Name/Email] | Primary unavailable |
| Management | [Name/Email] | Extended outage, security breach |

---

## Incident Response Checklist

Use this checklist for any incident:

- [ ] **Identify:** What is the symptom? Which service is affected?
- [ ] **Classify:** Critical (service down) or Degraded (partial functionality)?
- [ ] **Diagnose:** Check logs, dashboards, status pages
- [ ] **Communicate:** Notify stakeholders if extended outage expected
- [ ] **Fix:** Apply recovery procedure from relevant section above
- [ ] **Verify:** Confirm fix worked (health check, test operation)
- [ ] **Document:** Log incident details, timeline, root cause
- [ ] **Follow-up:** Create ticket for permanent fix if temporary workaround used

---

*Last updated: 2026-01-21*
