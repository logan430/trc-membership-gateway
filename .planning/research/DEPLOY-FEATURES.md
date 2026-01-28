# Deployment Features for Coolify

**Project:** The Revenue Council - Discord Membership Gateway
**Milestone:** v2.2 Production Deployment & Launch
**Researched:** 2026-01-28
**Overall Confidence:** HIGH (Coolify documentation is comprehensive and current)

---

## Executive Summary

Coolify provides a comprehensive PaaS for deploying Node.js/Next.js applications with built-in SSL, environment management, health checks, and monitoring. For The Revenue Council's requirements (Stripe webhooks, Discord OAuth, background jobs, sensitive data), Coolify's feature set covers all table stakes needs out of the box with minimal configuration.

Key findings:
- **SSL/HTTPS**: Automatic via Let's Encrypt - just use `https://` in domain config
- **Environment Variables**: Encrypted storage with build vs runtime separation
- **Health Checks**: UI-configurable with Traefik integration
- **Background Jobs**: Application handles internally via node-cron (already implemented)
- **Multi-Container**: Docker Compose for Express backend + Next.js frontend

---

## Table Stakes (Must Have for Production)

### 1. SSL/HTTPS Certificate

**Requirement:** Stripe webhooks require HTTPS in production. Discord OAuth works with HTTP locally but HTTPS is expected for production.

**Coolify Solution:** Automatic SSL via Let's Encrypt
- Enter domain with `https://` prefix (e.g., `https://app.revenuecouncil.com`)
- Coolify automatically requests and installs certificate
- Auto-renewal before 90-day expiration
- No manual certificate management required

**Port Requirements:**
- Port 80 must be open (HTTP challenge for Let's Encrypt)
- Port 443 must be open (HTTPS traffic)

**Configuration Steps:**
1. Point DNS A record to Coolify server IP
2. Enter `https://yourdomain.com` in Coolify domain field
3. Wait for certificate issuance (usually < 2 minutes)

**Confidence:** HIGH - [Official Coolify Domains Documentation](https://coolify.io/docs/knowledge-base/domains)

---

### 2. Environment Variables & Secrets

**Requirement:** Secure storage for:
- Stripe API keys (secret key, webhook secret)
- Discord credentials (client ID, client secret, bot token)
- Database connection strings
- JWT secret
- Resend API key

**Coolify Solution:** Encrypted environment variables
- Variables stored encrypted in Coolify's database
- Build-time vs runtime variable separation
- Lock variables to redact from deployment logs
- Project/team/environment-level sharing

**Variable Types:**
| Type | Use Case | Example |
|------|----------|---------|
| Runtime | API keys, secrets | `STRIPE_SECRET_KEY` |
| Build | Build configuration | `NODE_ENV=production` |
| Locked | Sensitive (redacted in logs) | All secrets |

**Predefined Variables Available:**
- `COOLIFY_FQDN` - Full domain name
- `COOLIFY_URL` - Application URL
- `SOURCE_COMMIT` - Git commit hash
- `PORT` / `HOST` - Networking defaults

**Security Note:** Lock all sensitive variables to prevent exposure in build logs.

**Confidence:** HIGH - [Official Environment Variables Docs](https://coolify.io/docs/knowledge-base/environment-variables)

---

### 3. Health Checks

**Requirement:** Ensure Traefik only routes traffic to healthy containers. Critical for:
- Rolling updates (zero-downtime deployment)
- Automatic recovery from container failures
- Stripe webhook reliability

**Coolify Solution:** UI-configurable health checks with Traefik integration

**Configuration Options:**
| Setting | Recommendation | Notes |
|---------|---------------|-------|
| Path | `/health` | Create simple endpoint returning 200 |
| Expected Code | `200` | Standard success response |
| Interval | `30s` | Balance between detection and overhead |
| Timeout | `10s` | Match Stripe webhook timeout expectations |

**Implementation Required:**
```typescript
// Add to Express app
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

**Traefik Behavior:**
- Healthy: Traffic routed normally
- Unhealthy: Returns 404, no traffic routed
- Rolling updates only complete when new container passes health check

**Note:** Container must have `curl` or `wget` for UI-based health checks. Node.js containers typically have neither by default - either install in Dockerfile or use Dockerfile HEALTHCHECK instruction.

**Confidence:** HIGH - [Official Health Checks Docs](https://coolify.io/docs/knowledge-base/health-checks)

---

### 4. Custom Domain Configuration

**Requirement:**
- Persistent domain for Discord OAuth redirect URI
- Stripe webhook endpoint URL
- Member-facing application URL

**Coolify Solution:** Domain assignment per service with automatic proxy configuration

**DNS Setup:**
1. Create A record: `app.revenuecouncil.com` -> Coolify server IP
2. (Optional) Create CNAME: `www.app.revenuecouncil.com` -> `app.revenuecouncil.com`

**Coolify Configuration:**
- Primary domain: `https://app.revenuecouncil.com`
- Coolify automatically configures Traefik reverse proxy
- SSL certificate auto-requested

**External Integration Updates:**
| Service | Setting | Value |
|---------|---------|-------|
| Discord Developer Portal | OAuth2 Redirect URI | `https://app.revenuecouncil.com/auth/callback` |
| Stripe Dashboard | Webhook Endpoint | `https://app.revenuecouncil.com/webhooks/stripe` |
| Environment Variable | `APP_URL` | `https://app.revenuecouncil.com` |

**Confidence:** HIGH - Standard Coolify domain workflow

---

### 5. Container Deployment Strategy

**Requirement:** Deploy Express backend + Next.js frontend

**Recommended Approach:** Docker Compose (single stack)

**Architecture:**
```
coolify-server
  └── trc-membership-gateway (Docker Compose stack)
      ├── backend (Express API, port 3000 internal)
      │   └── Exposed via Traefik: https://app.revenuecouncil.com
      └── dashboard (Next.js, port 3001 internal)
          └── Proxied by backend OR separate subdomain
```

**Option A: Backend Proxies Frontend (Current Architecture)**
- Express serves API routes directly
- Express proxies `/` to Next.js dashboard
- Single domain, simpler configuration
- Already implemented via `http-proxy-middleware`

**Option B: Separate Subdomains**
- Backend: `https://api.revenuecouncil.com`
- Frontend: `https://app.revenuecouncil.com`
- Requires CORS configuration
- More complex but cleaner separation

**Recommendation:** Option A (backend proxies frontend) - simpler, already working locally.

**Confidence:** HIGH - Docker Compose is well-supported in Coolify

---

### 6. Build Configuration

**Requirement:** Build Node.js backend and Next.js frontend

**Options:**

| Approach | Pros | Cons |
|----------|------|------|
| Nixpacks | Zero config, auto-detection | Less control, occasional breaking changes |
| Dockerfile | Full control, reproducible | More initial setup |

**Recommendation:** Use Dockerfiles for production stability

**Rationale:**
- Nixpacks has had breaking changes requiring quick fixes
- Dockerfile provides reproducible builds
- Better control over Node.js version (project uses specific dependencies)
- Argon2 requires native compilation - explicit control important

**Dockerfile Considerations for this Project:**
- Multi-stage build to reduce image size
- Install production dependencies only
- Copy Prisma schema and generate client
- Set `NODE_ENV=production`

**Confidence:** MEDIUM - Nixpacks works but Dockerfile is more reliable for production

---

### 7. Persistent Storage

**Requirement:**
- Supabase handles database (external)
- Supabase Storage handles file uploads (external)
- No persistent storage needed on Coolify server

**Coolify Solution:** Not required for this project

**Note:** If local file storage were needed:
- Configure volume mounts in Docker Compose
- Base path inside container is `/app`
- Example: `/app/uploads` -> persistent volume

**Confidence:** HIGH - External storage strategy eliminates need

---

### 8. Database Connectivity

**Requirement:** Connect to Supabase Postgres from Coolify containers

**Configuration:**
- `DATABASE_URL` set as runtime environment variable
- Use pooler connection (port 6543) for main application
- `DIRECT_URL` for Prisma migrations (port 5432)

**Network Considerations:**
- Supabase is external (internet-accessible)
- No internal Docker networking required
- Ensure Coolify server can reach `*.pooler.supabase.com`

**Security:**
- Connection string contains password - mark as locked/sensitive
- Supabase provides SSL by default

**Confidence:** HIGH - Standard external database pattern

---

## Nice-to-Have (Improve Operations)

### 9. Logging & Monitoring

**Requirement:** Production visibility into application behavior

**Built-in Options:**
- Container logs viewable in Coolify UI
- Basic container status monitoring
- Disk usage tracking

**Enhanced Options:**
| Tool | Purpose | Deployment |
|------|---------|------------|
| Dozzle | Real-time log viewer | One-click in Coolify |
| Sentry | Error tracking | Already integrated via `SENTRY_DSN` |
| Grafana + Loki | Centralized logging | Manual setup via Coolify |

**Recommendation:**
- Use Sentry (already configured) for error tracking
- Coolify UI for basic log viewing
- Consider Dozzle for real-time debugging

**Log Drain Options:**
- Axiom
- New Relic
- Custom FluentBit destination

**Confidence:** HIGH - [Official Monitoring Docs](https://coolify.io/docs/knowledge-base/monitoring)

---

### 10. Automated Backups

**Requirement:** Disaster recovery for Coolify configuration

**Coolify Solution:** Built-in backup to S3

**Configuration:**
1. Add S3-compatible storage destination
2. Schedule automated backups (cron syntax)
3. Configure retention policy

**What Gets Backed Up:**
- Coolify database (configuration, secrets)
- Not application data (handled by Supabase)

**Recommendation:** Configure weekly Coolify backups to S3

**Note:** Application database (Supabase) has its own backup mechanisms - this is for Coolify instance recovery only.

**Confidence:** HIGH - [Official Backup Docs](https://coolify.io/docs/knowledge-base/how-to/backup-restore-coolify)

---

### 11. Deployment Webhooks

**Requirement:** Trigger deployments from GitHub

**Options:**

| Method | Complexity | Reliability |
|--------|------------|-------------|
| GitHub App (native) | Low | High |
| Manual webhook | Medium | High |
| Manual deploy | None | Manual |

**Recommendation for v2.2:** Manual deployment via Coolify UI

**Rationale:**
- v2.2 scope explicitly excludes automated CI/CD
- Manual deployment provides control during launch
- Can add GitHub webhooks post-launch

**Future Enhancement:** Connect GitHub repo for push-triggered deployments

**Confidence:** HIGH - Manual deployment is straightforward

---

### 12. Preview Deployments

**Requirement:** Test changes before production (not for v2.2)

**Coolify Solution:**
- Separate preview environment variables
- Automatic PR-based deployments (with GitHub integration)
- Isolated from production

**Recommendation:** Defer to post-launch

**Confidence:** HIGH - Feature exists but not needed for v2.2

---

### 13. Rolling Updates

**Requirement:** Zero-downtime deployments

**Coolify Solution:** Built-in rolling update support

**Requirements for Rolling Updates:**
- Health check must be configured and passing
- New container must become healthy before old is terminated
- Traefik routes traffic only to healthy containers

**Configuration:**
- Enable health checks (see Table Stakes #3)
- Coolify handles rolling update orchestration automatically

**Confidence:** HIGH - [Official Rolling Updates Docs](https://coolify.io/docs/knowledge-base/rolling-updates)

---

## Defer (Not Needed for v2.2)

### 14. Resource Limits (CPU/Memory)

**Status:** Feature requested but not fully available in Coolify UI

**Workaround:** Define limits in Docker Compose file
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
```

**Recommendation:** Defer - not critical for initial launch. Monitor resource usage first.

**Confidence:** LOW - [Community Discussion](https://github.com/coollabsio/coolify/discussions/4661)

---

### 15. Wildcard SSL Certificates

**Requirement:** Not needed - single domain deployment

**Coolify Capability:** Supports wildcard via DNS challenge

**Defer Reason:** Single application, single domain sufficient for v2.2

**Confidence:** HIGH - Feature exists but not needed

---

### 16. Multi-Server Deployment

**Requirement:** Not needed - single server sufficient for expected load

**Coolify Capability:** Add servers via SSH for distributed deployment

**Defer Reason:** Scale when needed, not before

**Confidence:** HIGH - Feature exists but not needed for v2.2

---

### 17. Infisical Integration (Advanced Secrets)

**Requirement:** Not needed - Coolify built-in secrets sufficient

**Coolify Capability:** Deploy Infisical for centralized secret management

**Defer Reason:** Built-in encrypted environment variables are adequate for this project size

**Confidence:** HIGH - [Official Infisical Docs](https://coolify.io/docs/services/infisical)

---

## Background Jobs Strategy

**Current Implementation:** Application uses `node-cron` for internal job scheduling

| Job | Schedule | Purpose |
|-----|----------|---------|
| MEE6 XP Sync | Every 15 min | Sync Discord activity points |
| Streak Calculation | Daily 00:05 UTC | Calculate member engagement streaks |
| Churn Digest | Weekly Monday 09:00 UTC | Send at-risk member digest |
| Billing Poll | Every 5 min | Grace period/debtor state transitions |
| Reconciliation | Daily (configurable) | Stripe/Discord state verification |

**Coolify Integration:** No special configuration needed

**Rationale:**
- Jobs run inside the application container
- Graceful shutdown handlers already implemented
- Container restart preserves job scheduling

**Alternative (if needed):** Coolify Scheduled Tasks
- Configure via Coolify UI with cron syntax
- Runs commands inside containers
- Useful for one-off maintenance tasks

**Recommendation:** Keep existing node-cron approach - proven, tested, no migration needed.

**Confidence:** HIGH - Current approach works, no changes needed

---

## Configuration Checklist

### Pre-Deployment

- [ ] DNS A record points to Coolify server
- [ ] Server ports 80, 443 open
- [ ] Dockerfiles created for backend and frontend
- [ ] docker-compose.yml created for Coolify
- [ ] Health check endpoint implemented (`/health`)

### Coolify Setup

- [ ] Project created in Coolify
- [ ] Docker Compose source configured
- [ ] Domain assigned with `https://` prefix
- [ ] SSL certificate issued (automatic)
- [ ] All environment variables configured
- [ ] Sensitive variables marked as locked

### External Integrations

- [ ] Discord OAuth redirect URI updated
- [ ] Stripe webhook endpoint URL updated
- [ ] Stripe webhook secret for production endpoint
- [ ] Sentry DSN configured (production project)
- [ ] Resend verified domain / API key

### Post-Deployment Verification

- [ ] HTTPS accessible
- [ ] Health check passing
- [ ] Application logs visible in Coolify
- [ ] Stripe test webhook received
- [ ] Discord OAuth flow completes
- [ ] Database queries working

---

## Sources

### Official Coolify Documentation
- [Domains](https://coolify.io/docs/knowledge-base/domains)
- [Environment Variables](https://coolify.io/docs/knowledge-base/environment-variables)
- [Health Checks](https://coolify.io/docs/knowledge-base/health-checks)
- [Monitoring](https://coolify.io/docs/knowledge-base/monitoring)
- [Rolling Updates](https://coolify.io/docs/knowledge-base/rolling-updates)
- [Persistent Storage](https://coolify.io/docs/knowledge-base/persistent-storage)
- [Docker Compose](https://coolify.io/docs/knowledge-base/docker/compose)
- [Backup and Restore](https://coolify.io/docs/knowledge-base/how-to/backup-restore-coolify)
- [Database Backups](https://coolify.io/docs/databases/backups)
- [Next.js Deployment](https://coolify.io/docs/applications/nextjs)
- [Build Packs](https://coolify.io/docs/applications/build-packs/overview)
- [SSL Certificates](https://coolify.io/docs/knowledge-base/proxy/traefik/custom-ssl-certs)
- [Let's Encrypt Troubleshooting](https://coolify.io/docs/troubleshoot/dns-and-domains/lets-encrypt-not-working)

### External Documentation
- [Stripe Webhooks](https://docs.stripe.com/webhooks)
- [Discord OAuth2](https://discord.com/developers/docs/topics/oauth2)

### Community Resources
- [Coolify Automated DB Backups with S3](https://hamy.xyz/blog/2025-03_coolify-automated-db-backups)
- [Grafana/Loki Logging Setup](https://github.com/coollabsio/coolify/discussions/5317)
- [Resource Limits Discussion](https://github.com/coollabsio/coolify/discussions/4661)

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Table Stakes | 8 | Must configure |
| Nice-to-Have | 5 | Configure as time allows |
| Defer | 4 | Post-launch consideration |

**Priority Order for v2.2:**
1. SSL/HTTPS (Stripe requirement)
2. Environment variables (secrets management)
3. Custom domain (OAuth/webhook URLs)
4. Health checks (reliability)
5. Build configuration (Dockerfiles)
6. Logging (Sentry already configured)

**Total estimated configuration time:** 2-4 hours for initial setup, assuming Dockerfiles need to be written.
