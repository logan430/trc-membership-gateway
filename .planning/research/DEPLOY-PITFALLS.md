# Deployment Pitfalls: Coolify + Express + Next.js

**Project:** The Revenue Council Membership Gateway
**Target:** v2.2 Production Deployment & Launch
**Researched:** 2026-01-28
**Overall Confidence:** MEDIUM (verified via Coolify official docs + community experience)

---

## Critical Pitfalls

Mistakes that cause deployment failures, security breaches, or major outages.

---

### Pitfall 1: Stripe Webhook Signature Verification Fails in Production

**What goes wrong:** Stripe webhooks work locally (via CLI) but fail in production with "No signature found matching the expected signature" errors. All payment events are lost, members never get provisioned.

**Why it happens:**
1. **Wrong webhook signing secret** - Using test mode secret (`whsec_test_...`) with live mode events, or vice versa. Stripe signs test and live events with different secrets.
2. **Body parsing destroys raw payload** - Express `json()` middleware parses the request before the webhook handler, modifying whitespace/key order. Stripe signature verification requires the exact raw bytes.
3. **Middleware order mistake** - `app.use(express.json())` applied globally before the webhook route.

**Consequences:**
- Zero webhooks process successfully
- Members pay but never get Discord access
- Subscription changes (cancel, upgrade, payment failure) never sync to database
- Complete breakdown of the membership flow

**Warning signs:**
- Stripe Dashboard shows webhook failures with 400 status
- Logs show "Webhook signature verification failed"
- Members report payment success but no Discord invite

**Prevention:**
```javascript
// CORRECT: Raw body for webhook route BEFORE json parser
app.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  webhookHandler
);

// JSON parser for all other routes
app.use(express.json());
```

**Additional checklist:**
- [ ] Use separate webhook endpoints for test vs live mode in Stripe Dashboard
- [ ] Store `STRIPE_WEBHOOK_SECRET_LIVE` separately from `STRIPE_WEBHOOK_SECRET_TEST`
- [ ] Verify which Stripe mode you're in before deploying
- [ ] Test webhook delivery in Stripe Dashboard after deployment

**Phase to address:** Infrastructure setup phase (container configuration)

**Confidence:** HIGH (verified via [Stripe official docs](https://docs.stripe.com/webhooks/signature) and [community debugging guide](https://dev.to/nerdincode/debugging-stripe-webhook-signature-verification-errors-in-production-1h7c))

---

### Pitfall 2: Discord OAuth Redirect URI Mismatch

**What goes wrong:** Users click "Connect Discord" and get "Invalid OAuth2 redirect_uri" error from Discord. Nobody can link their Discord account.

**Why it happens:**
1. **Protocol mismatch** - Code uses `http://` but production is `https://`
2. **Domain mismatch** - Using IP address in code but domain in Discord settings, or missing `www.` prefix
3. **Path mismatch** - Typo in callback path (`/api/auth/callback/discord` vs `/auth/discord/callback`)
4. **Forgot to add production URL** - Only development URL registered in Discord Developer Portal

**Consequences:**
- Complete OAuth flow broken
- No members can claim their subscriptions
- Paid members stranded without Discord access

**Warning signs:**
- "Invalid OAuth2 redirect_uri" error in browser
- OAuth works locally but not in production
- Discord OAuth redirect shows different domain than expected

**Prevention:**
1. In Discord Developer Portal (https://discord.com/developers/applications):
   - Add exact production redirect URI: `https://yourdomain.com/auth/discord/callback`
   - Add with `www.` if applicable: `https://www.yourdomain.com/auth/discord/callback`
   - Keep development URI for testing: `http://localhost:3000/auth/discord/callback`

2. In environment variables:
   ```
   DISCORD_REDIRECT_URI=https://yourdomain.com/auth/discord/callback
   ```

3. Verify exact match between:
   - Discord Developer Portal
   - Environment variable
   - Code constructing OAuth URL

**Phase to address:** Integration configuration phase

**Confidence:** HIGH (verified via [Discord OAuth docs](https://discordjs.guide/oauth2/) and [community reports](https://support.glitch.com/t/discord-oauth2-redirect-uri-always-says-invalid-oauth2-redirect-uri/22865))

---

### Pitfall 3: Discord Bot Loses Gateway Connection Permanently

**What goes wrong:** Discord bot connects initially but goes offline after hours/days. Role assignments stop working. Bot appears as "offline" in Discord but container still shows "healthy."

**Why it happens:**
1. **Zombie WebSocket connections** - Gateway connection dies but process doesn't recognize it
2. **No reconnection handling** - Bot doesn't implement Discord's resume protocol
3. **Container health check doesn't verify bot connection** - HTTP health check passes even when Discord WebSocket is dead
4. **Memory leaks over time** - Node.js process eventually becomes unresponsive

**Consequences:**
- New members don't get roles assigned
- Billing failures don't trigger Debtor role
- Introduction detection stops working
- Manual intervention required to restart bot

**Warning signs:**
- Bot shows as "offline" in Discord server
- Role assignment tasks succeed in logs but Discord roles don't change
- Container "healthy" but Discord operations fail
- Logs show "zombie connection" or "WebSocket did not close properly"

**Prevention:**
1. **Implement proper reconnection logic:**
   ```javascript
   client.on('shardDisconnect', (event, shardId) => {
     logger.warn(`Shard ${shardId} disconnected`, event);
   });

   client.on('shardReconnecting', (shardId) => {
     logger.info(`Shard ${shardId} reconnecting`);
   });

   client.on('shardResume', (shardId, replayedEvents) => {
     logger.info(`Shard ${shardId} resumed, replayed ${replayedEvents} events`);
   });
   ```

2. **Add Discord-aware health check:**
   ```javascript
   app.get('/health', (req, res) => {
     const discordConnected = client.isReady() && client.ws.status === 0;
     if (!discordConnected) {
       return res.status(503).json({ status: 'unhealthy', discord: 'disconnected' });
     }
     res.json({ status: 'healthy', discord: 'connected' });
   });
   ```

3. **Configure container restart policy:**
   - Set `restart: unless-stopped` in Docker Compose
   - Configure Coolify health check to hit `/health` endpoint
   - Allow container to restart when Discord connection fails

4. **Run Discord bot in single container:**
   - Never scale the Express+bot container to multiple replicas
   - Only one bot instance should hold the Discord gateway connection

**Phase to address:** Container configuration and health check setup

**Confidence:** MEDIUM (based on [Discord.js issues](https://github.com/discordjs/discord.js/issues/8486) and general Discord bot deployment patterns)

---

### Pitfall 4: Cron Jobs Run in Multiple Containers

**What goes wrong:** Background jobs (streak updates, stale subscription cleanup, points calculation) run in every container instance, causing duplicate processing, race conditions, or data corruption.

**Why it happens:**
1. **Naive scaling** - Scaling Express app to 2+ replicas means node-cron runs in every replica
2. **Kubernetes-style scheduling** - Even `replicas: 1` isn't guaranteed to have only one pod running at all times (during deploys, node failures, etc.)
3. **No distributed locking** - Cron jobs don't check if another instance is already running

**Consequences:**
- Points awarded multiple times
- Duplicate emails sent to members
- Streak calculations corrupted
- Database constraint violations from concurrent updates
- Race conditions causing unpredictable state

**Warning signs:**
- Members report receiving duplicate emails
- Points values seem inflated
- Database errors about duplicate keys
- Audit logs show same action at same timestamp from "different" sources

**Prevention:**
1. **Keep single container for backend:**
   - Don't scale Express+bot container beyond 1 replica in Coolify
   - If horizontal scaling needed later, extract cron jobs to dedicated worker container

2. **Add job locking (defense in depth):**
   ```javascript
   // In database: job_locks table
   const acquireLock = async (jobName: string): Promise<boolean> => {
     const result = await prisma.jobLock.upsert({
       where: { jobName },
       update: {
         lockedAt: new Date(),
         lockedBy: process.env.HOSTNAME
       },
       create: {
         jobName,
         lockedAt: new Date(),
         lockedBy: process.env.HOSTNAME
       }
     });
     // Check if we got the lock (lockedBy matches our hostname)
     return result.lockedBy === process.env.HOSTNAME;
   };
   ```

3. **Use feature flag for cron in environment:**
   ```
   ENABLE_CRON_JOBS=true  # Only set in one container
   ```

**Phase to address:** Container scaling strategy in infrastructure phase

**Confidence:** HIGH (verified via [Kubernetes patterns](https://medium.com/l3montree-techblog/kubernetes-perform-a-task-only-in-one-instance-of-a-multi-instance-microservice-deployment-96261469b57d) and [container cron best practices](https://www.devgraph.com/resource/running-cron-jobs-in-container-environments/))

---

### Pitfall 5: SSL Certificate Not Generated (Let's Encrypt Fails)

**What goes wrong:** Application deploys but HTTPS doesn't work. Browser shows "connection not secure" or Stripe/Discord reject requests to non-HTTPS URLs.

**Why it happens:**
1. **Port 80 blocked** - Let's Encrypt HTTP-01 challenge can't reach the server
2. **DNS not propagated** - Domain doesn't resolve to server IP yet
3. **Firewall rules** - Coolify server firewall blocks port 80 or 443
4. **Cloudflare proxy** - SSL settings conflict between Cloudflare and Let's Encrypt

**Consequences:**
- Stripe webhooks fail (Stripe requires HTTPS endpoints)
- Discord OAuth redirects fail
- Members see security warnings
- Browser may block mixed content

**Warning signs:**
- Coolify shows "Certificate pending" indefinitely
- Browser shows certificate error
- `curl https://yourdomain.com` returns SSL error
- Stripe webhook test shows connection refused

**Prevention:**
1. **Before deploying, verify:**
   - [ ] DNS A record points to Coolify server IP
   - [ ] DNS propagation complete (use dnschecker.org)
   - [ ] Ports 80 and 443 open in server firewall
   - [ ] No conflicting Cloudflare SSL settings

2. **Cloudflare configuration (if using):**
   - Set SSL/TLS mode to "Full (Strict)"
   - Or disable Cloudflare proxy (DNS only) for initial Let's Encrypt setup

3. **Verify in Coolify:**
   - Check server firewall settings: Servers > [Server] > Firewall
   - Ensure Traefik proxy is running: Servers > [Server] > Proxy
   - Check certificate status in application settings

**Phase to address:** Domain and SSL configuration phase

**Confidence:** HIGH (verified via [Coolify docs](https://coolify.io/docs/troubleshoot/dns-and-domains/lets-encrypt-not-working) and [firewall docs](https://coolify.io/docs/knowledge-base/server/firewall))

---

## Moderate Pitfalls

Mistakes that cause significant issues but are recoverable.

---

### Pitfall 6: Environment Variables Not Marked as Build Variables

**What goes wrong:** Application builds but crashes on start with "DATABASE_URL is not defined" or Prisma errors about unreachable database.

**Why it happens:**
- Prisma generates client at build time, needs `DATABASE_URL`
- Coolify separates runtime environment variables from build-time variables
- Variables not marked as "Build Variable" aren't available during `npm run build`

**Consequences:**
- Build fails or succeeds but app crashes immediately
- Deployment appears successful but container keeps restarting
- Confusing errors about missing variables that are clearly set

**Warning signs:**
- Container starts then immediately exits
- Logs show "Cannot read environment variable"
- Prisma errors during build step
- Works locally but not in Coolify

**Prevention:**
1. **Mark these as Build Variables in Coolify:**
   - `DATABASE_URL` (required by Prisma generate)
   - Any variable used in `next.config.js` or build scripts

2. **Keep as runtime-only:**
   - `STRIPE_SECRET_KEY`
   - `DISCORD_BOT_TOKEN`
   - `JWT_SECRET`
   - All other secrets (don't expose in build logs)

3. **Use Dockerfile multi-stage build:**
   - Build stage gets build variables
   - Runtime stage gets only runtime variables

**Phase to address:** Environment configuration phase

**Confidence:** HIGH (verified via [Coolify docs](https://coolify.io/docs/knowledge-base/environment-variables))

---

### Pitfall 7: Port Misconfiguration Causes Bad Gateway

**What goes wrong:** Coolify shows "502 Bad Gateway" for all requests. Application is running inside container but unreachable.

**Why it happens:**
1. **Port mismatch** - App listens on port 3001, Coolify configured for port 3000
2. **Listening on localhost** - App binds to `127.0.0.1` instead of `0.0.0.0`
3. **Docker Compose port mapping conflicts** - Manual port mapping interferes with Coolify's Traefik routing

**Consequences:**
- Entire application inaccessible
- All endpoints return 502
- Container shows healthy but app unreachable

**Warning signs:**
- Coolify dashboard shows "502 Bad Gateway"
- Container logs show app started successfully
- Direct container access works, proxied access doesn't

**Prevention:**
1. **Bind to 0.0.0.0:**
   ```javascript
   app.listen(PORT, '0.0.0.0', () => {
     console.log(`Server running on port ${PORT}`);
   });
   ```

2. **Match Coolify port configuration:**
   - Set "Ports Exposes" in Coolify to match `PORT` environment variable
   - Don't hardcode ports in Docker Compose if using Coolify routing

3. **Remove port mappings from compose file:**
   - Let Coolify handle routing via Traefik
   - Remove `ports:` section from docker-compose.yml

**Phase to address:** Container configuration phase

**Confidence:** HIGH (verified via [Coolify docs](https://coolify.io/docs/troubleshoot/applications/bad-gateway))

---

### Pitfall 8: Supabase Connection Pool Exhaustion

**What goes wrong:** After running for hours/days, database queries start failing with "too many connections" or timeouts. App becomes unresponsive.

**Why it happens:**
1. **Not using Supavisor pooler URL** - Direct connection string instead of pooler connection string
2. **High pool size** - Setting `max: 10+` connections per container
3. **Connection leaks** - Not releasing connections properly
4. **Multiple instances** - Each container opens its own pool

**Consequences:**
- Database operations fail
- App returns 500 errors
- Members can't log in, view dashboard, or complete actions
- Requires manual restart to recover

**Warning signs:**
- Sporadic database timeouts
- "Cannot acquire connection" errors
- Supabase dashboard shows high connection count
- Performance degrades over time

**Prevention:**
1. **Use Supavisor (transaction mode) connection string:**
   ```
   DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
   ```

2. **Set conservative pool size:**
   ```javascript
   // In Prisma schema or connection config
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: 3  // Low for single container
   });
   ```

3. **Disable prepared statements for transaction mode:**
   - Add `?pgbouncer=true` to connection string
   - Or configure Prisma: `datasource db { provider = "postgresql" url = env("DATABASE_URL") }`

**Phase to address:** Database connection configuration phase

**Confidence:** HIGH (verified via [Supabase docs](https://supabase.com/docs/guides/database/connecting-to-postgres))

---

### Pitfall 9: Rolling Updates Not Working (Downtime on Deploy)

**What goes wrong:** Every deployment causes brief downtime. Users see errors during deploys. Not acceptable for a membership site.

**Why it happens:**
1. **No health check configured** - Coolify can't verify new container is ready
2. **Using Docker Compose** - Rolling updates not supported for Compose deployments
3. **Custom container name** - Prevents Coolify from managing multiple instances
4. **Host port mapping** - New container can't bind to same port as old one

**Consequences:**
- 10-60 seconds of downtime per deploy
- Users see 502 errors during deployment
- Webhook deliveries fail during deploy window

**Warning signs:**
- Monitoring shows brief outages after each deploy
- Users report intermittent errors
- Coolify logs show old container stopped before new one ready

**Prevention:**
1. **Add health check endpoint:**
   ```javascript
   app.get('/health', (req, res) => {
     // Check all critical dependencies
     const dbOk = await checkDatabase();
     const discordOk = client.isReady();

     if (dbOk && discordOk) {
       res.status(200).json({ status: 'healthy' });
     } else {
       res.status(503).json({ status: 'unhealthy' });
     }
   });
   ```

2. **Configure health check in Coolify:**
   - Enable health checks in application settings
   - Set path to `/health`
   - Configure appropriate intervals and thresholds

3. **Use Nixpacks or Dockerfile, not Docker Compose:**
   - Docker Compose deployments don't support rolling updates in Coolify
   - Single-service apps should use Nixpacks or custom Dockerfile

4. **Don't set custom container names:**
   - Let Coolify manage container naming
   - Avoid `container_name:` in compose files

**Phase to address:** Deployment strategy phase

**Confidence:** HIGH (verified via [Coolify rolling updates docs](https://coolify.io/docs/knowledge-base/rolling-updates))

---

### Pitfall 10: CORS Headers Stripped by Proxy

**What goes wrong:** Frontend can't make API requests. Browser shows CORS errors even though backend is configured correctly.

**Why it happens:**
1. **Traefik strips headers** - Proxy doesn't forward CORS headers from application
2. **Double CORS configuration** - Both Traefik and Express set headers, causing conflicts
3. **Preflight requests blocked** - OPTIONS requests don't reach application

**Consequences:**
- Dashboard can't fetch data from API
- All cross-origin requests fail
- Browser console full of CORS errors
- App appears broken despite backend working

**Warning signs:**
- "Access-Control-Allow-Origin" missing in responses
- Works via curl but not in browser
- Preflight OPTIONS requests return errors

**Prevention:**
1. **Option A - Let Express handle CORS (recommended):**
   - Configure CORS in Express with correct origins
   - Ensure Traefik doesn't add conflicting headers

2. **Option B - Configure CORS in Traefik:**
   Add custom labels in Coolify:
   ```
   traefik.http.middlewares.cors.headers.accesscontrolallowmethods=*
   traefik.http.middlewares.cors.headers.accesscontrolallowheaders=*
   traefik.http.middlewares.cors.headers.accesscontrolalloworiginlist=https://yourdomain.com
   ```

3. **Test CORS before deploying frontend:**
   ```bash
   curl -X OPTIONS https://api.yourdomain.com/health \
     -H "Origin: https://yourdomain.com" \
     -H "Access-Control-Request-Method: GET" -v
   ```

**Phase to address:** Proxy and routing configuration phase

**Confidence:** MEDIUM (based on [Coolify discussions](https://github.com/coollabsio/coolify/discussions/4607) and [Traefik docs](https://doc.traefik.io/traefik/middlewares/http/headers/))

---

## Minor Pitfalls

Mistakes that cause annoyance but are easily fixed.

---

### Pitfall 11: Build Crashes Server (Low Memory)

**What goes wrong:** Server becomes unresponsive during deployment. Coolify dashboard inaccessible. Build eventually fails or times out.

**Why it happens:**
- Docker builds are memory-intensive
- npm install can spike memory usage
- Small VPS (2GB RAM) struggles with concurrent builds
- TypeScript compilation is memory-hungry

**Prevention:**
1. **Pre-build images externally:**
   - Build Docker images via GitHub Actions
   - Push to GitHub Container Registry
   - Configure Coolify to deploy pre-built images

2. **Or increase server resources:**
   - Minimum 4GB RAM for building Node.js/Next.js apps
   - Consider separate build server

3. **Stagger deployments:**
   - Don't deploy frontend and backend simultaneously
   - Build one at a time

**Phase to address:** Build infrastructure phase

**Confidence:** HIGH (verified via [Coolify docs](https://coolify.io/docs/troubleshoot/server/crash-during-build))

---

### Pitfall 12: Preview Deployments Accumulate

**What goes wrong:** Server runs out of disk space. Old preview deployments never cleaned up.

**Why it happens:**
- Coolify doesn't auto-delete preview deployments when PRs are merged/closed
- Each preview is a full deployment with its own container and build artifacts
- Manual cleanup required

**Prevention:**
1. **Regularly clean up via Coolify UI**
2. **Disable preview deployments if not needed**
3. **Set up disk space monitoring/alerts**

**Phase to address:** Operational procedures phase

**Confidence:** HIGH (verified via [Coolify docs](https://deepwiki.com/coollabsio/coolify/5.6-preview-deployments))

---

### Pitfall 13: Node Version Mismatch

**What goes wrong:** Build uses Node 18 when app requires Node 20. Dependencies fail to install or app crashes with version-specific errors.

**Why it happens:**
- Coolify/Nixpacks auto-detects Node version but may choose wrong one
- `engines` field in package.json ignored or overridden
- Different Node version between build and runtime

**Prevention:**
1. **Specify in package.json:**
   ```json
   "engines": {
     "node": ">=20.0.0"
   }
   ```

2. **Use Dockerfile for explicit control:**
   ```dockerfile
   FROM node:20-alpine
   ```

3. **Verify in Coolify build logs:**
   - Check which Node version Nixpacks selected
   - Override in Coolify configuration if needed

**Phase to address:** Container configuration phase

**Confidence:** MEDIUM (based on [Coolify issues](https://github.com/coollabsio/coolify/issues/6601))

---

### Pitfall 14: Secrets Exposed in Build Logs

**What goes wrong:** Sensitive values visible in Coolify deployment logs. API keys, tokens, passwords exposed.

**Why it happens:**
- Environment variables printed during build
- Debug mode enabled accidentally
- Variables not marked as "locked" in Coolify
- Build scripts echo secrets

**Prevention:**
1. **Lock secrets in Coolify:**
   - Click "lock" icon on sensitive variables
   - Locked variables show as `<REDACTED>` in logs

2. **Don't echo secrets in build scripts:**
   ```bash
   # Bad
   echo "Using API key: $API_KEY"

   # Good
   echo "Using API key: [REDACTED]"
   ```

3. **Review build logs after first deployment**

**Phase to address:** Environment configuration phase

**Confidence:** HIGH (verified via [Coolify docs](https://coolify.io/docs/knowledge-base/environment-variables))

---

### Pitfall 15: Database Backups Not Configured

**What goes wrong:** Data loss during migration, accidental deletion, or server failure. No way to recover.

**Why it happens:**
- Coolify backup only backs up Coolify itself, not application databases
- Assumption that Supabase handles backups (it does, but verify)
- No off-site backup configured

**Prevention:**
1. **For Supabase:**
   - Verify Point-in-Time Recovery is enabled (Pro plan)
   - Understand retention period
   - Test restore procedure

2. **For self-managed databases:**
   - Configure Coolify database backups
   - Set up S3-compatible storage for off-site backups
   - Test restore procedure before go-live

3. **Document recovery procedure:**
   - How to restore from backup
   - Who has access to backups
   - RTO/RPO expectations

**Phase to address:** Operations and backup phase

**Confidence:** HIGH (verified via [Coolify backup docs](https://coolify.io/docs/databases/backups) and [Supabase FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI))

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Container Setup | Port binding, health checks | Use 0.0.0.0, configure /health endpoint |
| Domain/SSL | Let's Encrypt fails | Pre-verify DNS, firewall rules |
| Stripe Integration | Webhook signature fails | Raw body parser, correct secret |
| Discord Integration | OAuth redirect mismatch | Exact URL match in all places |
| Database Config | Connection pool exhaustion | Use Supavisor URL, low pool size |
| Background Jobs | Cron runs multiple times | Single replica, feature flag |
| Go-Live | Downtime during first deploy | Test rollback, health checks |

---

## Pre-Deployment Checklist

Run through before each deployment:

### Infrastructure
- [ ] Server has 4GB+ RAM (or using pre-built images)
- [ ] Ports 80 and 443 open
- [ ] DNS propagated to server IP
- [ ] Coolify updated to latest stable version

### Configuration
- [ ] All environment variables set in Coolify
- [ ] Build variables marked appropriately
- [ ] Secrets locked in Coolify UI
- [ ] Port configuration matches app

### Stripe
- [ ] Correct webhook endpoint URL configured
- [ ] Correct signing secret (test vs live)
- [ ] Webhook route uses raw body parser
- [ ] Webhook test passes in Stripe Dashboard

### Discord
- [ ] OAuth redirect URI exact match
- [ ] Bot token correct for target server
- [ ] Bot has required permissions
- [ ] Health check verifies Discord connection

### Database
- [ ] Using Supavisor pooler URL
- [ ] Connection pool size appropriate
- [ ] Migrations applied
- [ ] Backup verified/configured

### Operations
- [ ] Health check endpoint working
- [ ] Rolling updates configured (if supported)
- [ ] Monitoring/alerting set up
- [ ] Rollback procedure documented

---

## Sources

### Coolify Official Documentation
- [Applications](https://coolify.io/docs/applications/)
- [Environment Variables](https://coolify.io/docs/knowledge-base/environment-variables)
- [Rolling Updates](https://coolify.io/docs/knowledge-base/rolling-updates)
- [Let's Encrypt Troubleshooting](https://coolify.io/docs/troubleshoot/dns-and-domains/lets-encrypt-not-working)
- [Bad Gateway Errors](https://coolify.io/docs/troubleshoot/applications/bad-gateway)
- [Server Crash During Build](https://coolify.io/docs/troubleshoot/server/crash-during-build)
- [Database Backups](https://coolify.io/docs/databases/backups)
- [Next.js Deployment](https://coolify.io/docs/applications/nextjs)

### Stripe Documentation
- [Webhook Signature Verification](https://docs.stripe.com/webhooks/signature)
- [Webhook Quickstart](https://docs.stripe.com/webhooks/quickstart)

### Discord Documentation
- [OAuth2 Guide](https://discordjs.guide/oauth2/)
- [Gateway Documentation](https://discord.mintlify.app/developers/docs/events/gateway)

### Supabase Documentation
- [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI)

### Community Resources
- [Debugging Stripe Webhook Signature Errors](https://dev.to/nerdincode/debugging-stripe-webhook-signature-verification-errors-in-production-1h7c)
- [Coolify Zero-Downtime Discussion](https://github.com/coollabsio/coolify/discussions/3767)
- [Kubernetes Singleton Patterns](https://medium.com/l3montree-techblog/kubernetes-perform-a-task-only-in-one-instance-of-a-multi-instance-microservice-deployment-96261469b57d)
- [Running Cron Jobs in Containers](https://www.devgraph.com/resource/running-cron-jobs-in-container-environments/)
