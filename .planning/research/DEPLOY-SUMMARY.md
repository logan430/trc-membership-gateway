# Deployment Research Summary

**Project:** The Revenue Council Membership Gateway
**Domain:** Production Deployment (Coolify PaaS)
**Researched:** 2026-01-28
**Confidence:** HIGH

## Executive Summary

Deploying this Express + Next.js application to Coolify is straightforward using **Docker Compose with two services on a shared network**. Express handles all external traffic (API routes, webhooks, Discord OAuth) and proxies frontend routes to Next.js internally. This preserves the existing proxy architecture while leveraging Coolify's automatic SSL and domain management. The approach requires no architectural changes from development.

The recommended deployment stack is: Node 20 Alpine Docker images, Docker Compose for service orchestration, Traefik (Coolify's built-in reverse proxy) for SSL termination and routing, and Supabase for external database/storage. Critical environment variables include Stripe keys, Discord credentials, and database connection strings. All sensitive values should be marked as "locked" in Coolify to prevent log exposure.

The primary risks are: (1) Stripe webhook signature verification failing due to body parsing order, (2) Discord OAuth redirect URI mismatches, and (3) Discord bot gateway connections dying without container restarts. All three are preventable with proper configuration documented in this research. The estimated initial setup time is 2-4 hours for creating Dockerfiles and configuring Coolify.

## Key Findings

### Recommended Stack

Docker Compose is the clear winner for this deployment, outperforming both single-container (process management complexity) and separate-application (networking complexity) approaches. The existing Express-to-Next.js proxy architecture transfers directly to Docker Compose with service name resolution (`http://nextjs:3001`).

**Core technologies:**
- **Docker Compose:** Service orchestration -- single deployment unit, automatic internal networking
- **Node 20 Alpine:** Base image -- minimal attack surface, fast builds, production-ready
- **Traefik (Coolify built-in):** Reverse proxy -- automatic SSL, domain routing, health-aware load balancing
- **Multi-stage Dockerfiles:** Build optimization -- smaller images, security (non-root users)

**Critical version requirements:**
- Node.js 20.x (project dependencies require it)
- Prisma client generated at build time (needs DATABASE_URL as build variable)

### Expected Features

**Must have (table stakes):**
- SSL/HTTPS via Let's Encrypt -- required for Stripe webhooks and Discord OAuth
- Environment variable encryption -- secrets must not leak to logs
- Health checks -- Traefik routing depends on container health
- Single domain with proxy routing -- Express as public entry point

**Should have (operational quality):**
- Rolling updates with health checks -- zero-downtime deployments
- Container log access via Coolify UI -- debugging without SSH
- Sentry integration -- error tracking (already implemented)
- Graceful shutdown handling -- proper cleanup on container stop

**Defer (v2+):**
- Preview deployments per PR -- not needed for initial launch
- Multi-server deployment -- single server sufficient for expected load
- Resource limits configuration -- monitor first, optimize later
- External CI/CD (GitHub Actions builds) -- manual deploy acceptable for v2.2

### Architecture Approach

Two-container Docker Compose stack with Express as the public-facing service and Next.js as an internal-only service. Express handles API routes (`/api/*`, `/webhooks/*`, `/auth/*`) directly and proxies frontend routes (`/dashboard/*`, `/admin/*`, `/login`, `/signup`, `/_next/*`) to Next.js via `http-proxy-middleware`. Only Express exposes Traefik labels; Next.js has no external network access.

**Major components:**
1. **Express backend (port 3000)** -- API, webhooks, Discord bot, proxy to Next.js
2. **Next.js frontend (port 3001)** -- Dashboard pages, standalone output mode
3. **Traefik proxy (Coolify)** -- SSL termination, domain routing, health-aware traffic management
4. **Supabase (external)** -- PostgreSQL database, file storage (no local persistence needed)

**Service topology:**
```
Internet -> Traefik (SSL) -> Express:3000 -> Next.js:3001 (internal)
                                          -> Supabase (external)
                                          -> Stripe API (external)
                                          -> Discord API (external)
```

### Critical Pitfalls

1. **Stripe webhook signature verification fails** -- Body parsing destroys raw payload. Use `express.raw()` middleware on webhook route BEFORE `express.json()` global middleware. Use production `whsec_` secret, not test secret.

2. **Discord OAuth redirect URI mismatch** -- Protocol (`https://`), domain, and path must exactly match between Discord Developer Portal, environment variable, and code. Add both www and non-www variants if applicable.

3. **Discord bot loses gateway connection permanently** -- Container health check passes but WebSocket is dead. Add Discord-aware health check (`client.isReady() && client.ws.status === 0`). Set restart policy in Docker Compose.

4. **Let's Encrypt SSL fails to provision** -- Port 80 blocked, DNS not propagated, or Cloudflare proxy conflicts. Pre-verify DNS resolution and firewall rules before deployment.

5. **Cron jobs run in multiple containers** -- Never scale Express+bot beyond 1 replica. If scaling needed later, extract cron jobs to dedicated worker. Consider feature flag `ENABLE_CRON_JOBS=true`.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Containerization

**Rationale:** Dockerfiles and docker-compose.yml are prerequisites for all Coolify deployment. Must work locally before deploying.

**Delivers:** Production-ready Docker images, tested compose stack

**Tasks:**
- Create `Dockerfile.backend` (Express, multi-stage, non-root user)
- Create `dashboard/Dockerfile` (Next.js standalone, non-root user)
- Create `docker-compose.yml` with health checks and depends_on
- Add `/health` endpoint to Next.js (optional but recommended)
- Test local build and run with `docker compose up`

**Avoids:** Port misconfiguration (Pitfall 7), Node version mismatch (Pitfall 13)

### Phase 2: Coolify Infrastructure Setup

**Rationale:** Coolify configuration must be in place before any application deployment can occur.

**Delivers:** Configured Coolify project with environment variables and domain

**Tasks:**
- Create Coolify project and Docker Compose resource
- Configure all environment variables (mark secrets as locked)
- Set domain with `https://` prefix
- Verify DNS A record points to server IP
- Verify firewall allows ports 80 and 443

**Avoids:** Environment variable exposure (Pitfall 14), SSL provisioning failure (Pitfall 5)

### Phase 3: Initial Deployment

**Rationale:** First deployment establishes the production environment and validates all configurations.

**Delivers:** Running production application with SSL

**Tasks:**
- Deploy to Coolify
- Verify SSL certificate issued
- Test `/health` endpoint from public internet
- Verify container logs accessible in Coolify UI

**Avoids:** Port binding issues (Pitfall 7), Build crashes (Pitfall 11)

### Phase 4: Integration Verification

**Rationale:** External integrations (Stripe, Discord) require production URLs and must be verified independently.

**Delivers:** Fully functional payment and authentication flows

**Tasks:**
- Update Discord Developer Portal with production OAuth redirect URI
- Create Stripe webhook endpoint for production domain
- Copy production webhook secret to Coolify environment
- Send test webhook from Stripe Dashboard
- Complete OAuth flow end-to-end
- Verify Discord bot connects and shows online

**Avoids:** Stripe webhook signature failure (Pitfall 1), Discord OAuth mismatch (Pitfall 2), Discord bot disconnection (Pitfall 3)

### Phase 5: Database and Data Setup

**Rationale:** Production database must have schema and seed data before member-facing launch.

**Delivers:** Production-ready database with initial data

**Tasks:**
- Run Prisma migrations against production Supabase
- Seed admin user
- Seed point configurations and Discord role mappings
- Verify database connectivity from container

**Avoids:** Connection pool exhaustion (Pitfall 8)

### Phase 6: Operational Readiness

**Rationale:** Monitoring and procedures ensure issues can be detected and resolved quickly post-launch.

**Delivers:** Production monitoring and documented procedures

**Tasks:**
- Verify Sentry receives errors
- Document rollback procedure
- Test graceful shutdown (container restart)
- Verify cron jobs running (check logs for scheduled task output)

**Avoids:** Cron duplicate execution (Pitfall 4), Downtime during updates (Pitfall 9)

### Phase Ordering Rationale

- **Containerization first:** All subsequent phases depend on working Docker images
- **Infrastructure before deployment:** Environment variables and domain must exist before first deploy
- **Deployment before integrations:** Production URL required to configure Stripe/Discord
- **Integrations before data:** Payment flow must work before members can sign up
- **Data before operations:** Database must be ready before operational verification makes sense

This order minimizes rework and ensures each phase has its dependencies met.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 4 (Integration Verification):** May need specific Discord bot permission troubleshooting if roles don't assign
- **Phase 6 (Operational Readiness):** May need Sentry configuration review if errors not appearing

**Phases with standard patterns (skip research):**
- **Phase 1 (Containerization):** Well-documented Docker/Next.js patterns
- **Phase 2 (Coolify Setup):** Standard Coolify workflow, official docs comprehensive
- **Phase 3 (Initial Deployment):** Straightforward Docker Compose deployment
- **Phase 5 (Database Setup):** Standard Prisma migration workflow

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Coolify docs, Docker best practices, verified locally |
| Features | HIGH | Coolify documentation comprehensive and current |
| Architecture | HIGH | Docker Compose pattern well-documented, matches existing dev setup |
| Pitfalls | MEDIUM | Mix of official docs and community reports, some 2025-specific Traefik bugs noted |

**Overall confidence:** HIGH

### Gaps to Address

- **Stripe IP whitelisting:** Unclear if Stripe requires static IPs for webhooks. Verify during Phase 4 -- likely not required for standard endpoints.

- **Rolling updates with Docker Compose:** Coolify docs note rolling updates may not work for Compose deployments. Accept brief downtime for v2.2 or investigate single-service deployment if zero-downtime required.

- **Discord bot scaling:** Current architecture couples bot with API. If horizontal scaling needed later, must extract bot to dedicated service. Not a gap for v2.2 (single replica).

- **Database migration strategy:** Decision needed on migration timing (pre-deploy vs init container). Recommend pre-deploy script for v2.2 simplicity.

## Open Questions

1. **What is the production domain?** Needed for Discord/Stripe configuration.
2. **Is the Coolify server already provisioned?** Determines if server setup phase needed.
3. **Are there existing production Stripe credentials?** Test vs live mode affects webhook secret setup.
4. **What is the Supabase production project?** Needed for DATABASE_URL configuration.

## Sources

### Primary (HIGH confidence)
- [Coolify Docker Compose Build Pack](https://coolify.io/docs/applications/build-packs/docker-compose)
- [Coolify Environment Variables](https://coolify.io/docs/knowledge-base/environment-variables)
- [Coolify Health Checks](https://coolify.io/docs/knowledge-base/health-checks)
- [Coolify Domains](https://coolify.io/docs/knowledge-base/domains)
- [Stripe Webhook Signature Verification](https://docs.stripe.com/webhooks/signature)
- [Discord OAuth2 Documentation](https://discordjs.guide/oauth2/)
- [Official Next.js Dockerfile](https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile)

### Secondary (MEDIUM confidence)
- [Snyk Node.js Docker Best Practices](https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/)
- [Coolify Rolling Updates](https://coolify.io/docs/knowledge-base/rolling-updates)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres)

### Tertiary (needs validation)
- [Coolify Shared Environment Variables Issue](https://github.com/coollabsio/coolify/issues/7655) -- behavior may have changed
- [Coolify Node Version Detection Issues](https://github.com/coollabsio/coolify/issues/6601) -- workaround via Dockerfile

---
*Research completed: 2026-01-28*
*Ready for roadmap: yes*
