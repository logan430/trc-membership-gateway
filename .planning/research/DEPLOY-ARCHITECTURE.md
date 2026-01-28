# Deployment Architecture: Express + Next.js on Coolify

**Project:** TRC Membership Gateway
**Researched:** 2026-01-28
**Milestone:** v2.2 Production Deployment & Launch
**Overall Confidence:** HIGH

---

## Executive Summary

This document analyzes container architecture options for deploying the TRC Membership Gateway (Express API/proxy + Next.js frontend) on Coolify. After evaluating three architectures against the project's constraints, **Option 2 (Two Containers with Docker Compose)** is recommended as the optimal approach.

The current architecture has Express on port 3000 handling API routes (`/api/*`, `/webhooks/*`, `/auth/*`) and proxying to Next.js on port 3001 for frontend routes (`/dashboard/*`, `/admin/*`, `/login`, etc.). This proxy pattern must be preserved in production.

---

## Architecture Options Evaluated

### Option 1: Single Container (Express + Next.js together)

**Approach:** Run both Express and Next.js in a single container using PM2 or supervisord.

**Pros:**
- Simplest deployment (one resource in Coolify)
- No inter-container networking complexity
- Shared environment variables by default
- Single domain configuration

**Cons:**
- Violates Docker best practice (one process per container)
- Cannot scale Express and Next.js independently
- Complex process management (requires PM2 or supervisord)
- Harder to debug issues (interleaved logs)
- Single point of failure
- More complex Dockerfile

**Implementation Complexity:** MEDIUM
**Operational Complexity:** HIGH

### Option 2: Two Containers with Docker Compose (RECOMMENDED)

**Approach:** Deploy Express and Next.js as separate services in a single Docker Compose stack. Express remains the public-facing service and proxies to Next.js internally.

**Pros:**
- Follows Docker best practices
- Services can be scaled independently
- Clear separation of concerns
- Easier debugging (separate logs)
- Coolify's native Docker Compose support
- Internal networking handled automatically by Coolify
- Single domain configuration (only Express exposed)
- Graceful handling of restarts

**Cons:**
- Slightly more complex initial setup
- Need to manage two container definitions
- Known Coolify issue: environment variables shared across all services (security consideration)

**Implementation Complexity:** LOW-MEDIUM
**Operational Complexity:** LOW

### Option 3: Two Separate Coolify Resources

**Approach:** Deploy Express and Next.js as completely separate Coolify applications.

**Pros:**
- Complete isolation
- Independent deployment pipelines
- Separate environment variable management

**Cons:**
- Complex networking (must use Coolify's predefined network)
- Service names include UUIDs (e.g., `nextjs-abc123`)
- Harder to coordinate deployments
- Two domain configurations needed OR complex Traefik routing
- Path-based routing in Traefik has known bugs with Coolify
- More configuration overhead

**Implementation Complexity:** HIGH
**Operational Complexity:** HIGH

---

## Recommendation: Option 2 (Docker Compose)

### Why Docker Compose is the Best Choice

1. **Preserved Architecture:** Express remains the single entry point, proxying to Next.js internally. This mirrors the current development setup and avoids CORS issues.

2. **Coolify Native Support:** Coolify's Docker Compose build pack treats the compose file as "the single source of truth" with automatic internal networking.

3. **Single Domain:** Only Express needs domain configuration. Next.js is purely internal.

4. **Operational Simplicity:** One deployment, coordinated restarts, unified rollbacks.

5. **Future Scalability:** Can add more services (Redis, workers) to the same stack.

---

## Recommended Container Architecture

### Service Topology

```
                    Internet
                        |
                        v
              [Coolify/Traefik Proxy]
                        |
                        v (https://app.revenuecouncil.com)
              +---------+---------+
              |    Express API    |
              |    (Port 3000)    |
              |                   |
              |  /api/*          |
              |  /webhooks/*     |
              |  /auth/*         |
              |  /checkout/*     |
              |  /billing/*      |
              |  /health         |
              |  static files    |
              |                   |
              |  Proxy to Next:   |
              |  /_next/*        |
              |  /dashboard/*    |
              |  /admin/*        |
              |  /login          |
              |  /signup         |
              +---------+---------+
                        |
                        v (http://nextjs:3000 internal)
              +---------+---------+
              |   Next.js App     |
              |   (Standalone)    |
              |   (Port 3000)     |
              |                   |
              |  React frontend   |
              |  Server-side      |
              |  rendering        |
              +---------+---------+
```

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Express API - Public facing (routed through Traefik)
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    environment:
      - NODE_ENV=production
      - PORT=3000
      - NEXT_APP_URL=http://nextjs:3000
      # Database, Stripe, Discord, etc. populated by Coolify
      - DATABASE_URL=${DATABASE_URL}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
      - DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}
      # ... other env vars
    depends_on:
      nextjs:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`app.revenuecouncil.com`)"
      - "traefik.http.routers.api.entrypoints=https"
      - "traefik.http.routers.api.tls=true"
      - "traefik.http.services.api.loadbalancer.server.port=3000"

  # Next.js Frontend - Internal only (no Traefik exposure)
  nextjs:
    build:
      context: ./dashboard
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOSTNAME=0.0.0.0
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    # No Traefik labels - internal only
```

**Key Points:**
- `nextjs` service has NO traefik labels (internal only)
- `api` service references `http://nextjs:3000` for proxy target
- Health checks ensure proper startup ordering
- `depends_on` with `service_healthy` prevents Express starting before Next.js

---

## Service Communication Pattern

### Internal Networking

Coolify automatically creates a dedicated Docker network for each compose stack. Services communicate using service names as hostnames:

```
Express -> http://nextjs:3000 (internal Docker network)
```

This works because:
1. Coolify creates network: `<resource-uuid>_default`
2. All services in the stack join this network
3. Docker DNS resolves `nextjs` to the container IP

### Proxy Configuration Update

The Express server's proxy middleware needs a single environment variable change:

```typescript
// src/index.ts - Production configuration
const nextAppUrl = process.env.NEXT_APP_URL || 'http://localhost:3000';

const nextProxyMiddleware = createProxyMiddleware({
  target: nextAppUrl,  // In production: http://nextjs:3000
  changeOrigin: true,
  ws: true,
  // ... existing pathFilter and handlers
});
```

**Environment variable:** `NEXT_APP_URL=http://nextjs:3000`

---

## Domain and SSL Configuration

### Single Domain Setup

| Component | Domain | SSL | Notes |
|-----------|--------|-----|-------|
| Express API | `https://app.revenuecouncil.com` | Auto (Let's Encrypt) | Public-facing |
| Next.js | None (internal) | Not needed | Only accessed via Express proxy |

### Coolify Domain Configuration

In Coolify UI, configure the domain on the Docker Compose resource:
- Domain: `https://app.revenuecouncil.com`
- Coolify automatically provisions Let's Encrypt certificate
- Traefik routes all traffic to the `api` service (via labels)

### SSL Termination

```
Client <--HTTPS--> Traefik <--HTTP--> Express <--HTTP--> Next.js
```

SSL terminates at Traefik. Internal container communication uses HTTP (secure within Docker network).

---

## Environment Variable Strategy

### Variable Categories

| Category | Examples | Scope |
|----------|----------|-------|
| Shared | `NODE_ENV`, `APP_URL` | Both services |
| API Only | `DATABASE_URL`, `STRIPE_*`, `DISCORD_*`, `JWT_SECRET` | Express only |
| Frontend Only | `NEXT_PUBLIC_*` | Next.js build time |

### Coolify Configuration

**WARNING:** Coolify injects ALL environment variables into ALL containers in a Docker Compose stack. This is a [known security issue](https://github.com/coollabsio/coolify/issues/7655).

**Mitigation strategies:**

1. **Accept the behavior** - For this project, both services are trusted and share the same security boundary. The API secrets being visible to Next.js container is acceptable.

2. **Use Docker secrets** (for highly sensitive values):
   ```yaml
   secrets:
     stripe_key:
       external: true
   ```

3. **Build-time vs runtime separation:**
   - `NEXT_PUBLIC_*` variables are baked into the Next.js build
   - API secrets are only used at runtime by Express

### Recommended Environment Variables

```bash
# Shared
NODE_ENV=production
APP_URL=https://app.revenuecouncil.com

# Express API
PORT=3000
NEXT_APP_URL=http://nextjs:3000
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=<32+ character secret>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_INTRODUCTIONS_CHANNEL_ID=...
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
SENTRY_DSN=https://...

# Next.js (build-time)
# Note: Next.js doesn't need runtime secrets - it proxies to Express API
```

---

## Dockerfile Specifications

### Dockerfile.api (Express)

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Copy built application
COPY --from=builder --chown=expressjs:nodejs /app/dist ./dist
COPY --from=builder --chown=expressjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app/package.json ./
COPY --from=builder --chown=expressjs:nodejs /app/public ./public
COPY --from=builder --chown=expressjs:nodejs /app/prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

USER expressjs

EXPOSE 3000

# Use node directly for proper signal handling
CMD ["node", "dist/index.js"]
```

### Dockerfile (Next.js in dashboard/)

```dockerfile
# Based on official Next.js Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build with standalone output
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

---

## Health Checks and Startup Ordering

### Health Check Configuration

```yaml
services:
  api:
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s  # Allow time for Prisma, Discord bot
    depends_on:
      nextjs:
        condition: service_healthy

  nextjs:
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
```

### Startup Sequence

1. Next.js container starts
2. Next.js health check passes
3. Express container starts (depends_on satisfied)
4. Express connects to database, Discord, initializes
5. Express health check passes
6. Traefik routes traffic to Express

### Graceful Shutdown

The existing `gracefulShutdown` function in `src/index.ts` handles SIGTERM properly:
- Stops background jobs
- Closes HTTP server
- Disconnects Discord bot
- Closes database connections

Docker sends SIGTERM on container stop, triggering this cleanup.

---

## Database Connectivity

### Connection from Express Container

```
Express Container -> DATABASE_URL -> Supabase (external)
```

The database is hosted on Supabase (external to Coolify). Express connects via:
- `DATABASE_URL` for Prisma pooled connections
- `DIRECT_URL` for migrations (optional)

### Prisma Considerations

1. **Migration strategy:** Run migrations as a separate step before deployment:
   ```bash
   npx prisma migrate deploy
   ```

2. **Connection pooling:** Supabase provides pgBouncer for connection pooling. Use `?pgbouncer=true` in the connection string if needed.

3. **SSL:** Ensure `?sslmode=require` in the DATABASE_URL for Supabase connections.

---

## Coolify-Specific Configuration

### Build Pack Selection

In Coolify UI:
- **Build Pack:** Docker Compose
- **Docker Compose Location:** `./docker-compose.yml` (root of repository)

### Resource Settings

| Setting | Value |
|---------|-------|
| Auto Deploy | Enabled (on push to main) |
| Preview Deployments | Disabled (production resource) |
| Health Check | Enabled |

### Domain Configuration

1. Add domain in Coolify UI: `https://app.revenuecouncil.com`
2. Coolify generates Traefik configuration automatically
3. Let's Encrypt provisions SSL certificate

### Environment Variables in Coolify

Configure in Coolify UI -> Environment Variables:
- All `STRIPE_*`, `DISCORD_*`, `DATABASE_*` variables
- Mark sensitive ones as "Secret" (hidden in logs)

---

## Deployment Workflow

### Initial Deployment

1. Create Docker Compose resource in Coolify
2. Configure environment variables
3. Configure domain
4. Deploy

### Subsequent Deployments

1. Push to main branch
2. Coolify auto-deploys (if enabled)
3. Both containers rebuilt and restarted
4. Health checks ensure healthy state before traffic routing

### Rollback

Coolify maintains deployment history. Use UI to rollback to previous deployment if issues arise.

---

## Monitoring and Logging

### Container Logs

Access via Coolify UI or:
```bash
docker logs <api-container-name>
docker logs <nextjs-container-name>
```

### Health Endpoint

Express exposes `/health` endpoint:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-28T12:00:00.000Z",
  "environment": "production"
}
```

### Sentry Integration

Express already configured with Sentry (`SENTRY_DSN`). Errors captured and reported automatically.

---

## Security Considerations

### Network Isolation

- Only Express exposed via Traefik
- Next.js container has NO external network access
- Internal communication via isolated Docker network

### Secret Management

| Secret | Storage | Notes |
|--------|---------|-------|
| `JWT_SECRET` | Coolify env var | Mark as secret |
| `STRIPE_*` | Coolify env var | Mark as secret |
| `DISCORD_BOT_TOKEN` | Coolify env var | Mark as secret |
| `DATABASE_URL` | Coolify env var | Contains credentials |

### Container Security

- Non-root users in both containers
- Alpine base images (minimal attack surface)
- No unnecessary packages installed

---

## Phase Implementation Roadmap

Based on this architecture research, the deployment milestone should include:

### Phase 1: Containerization

- [ ] Create `Dockerfile.api` for Express
- [ ] Create/update `dashboard/Dockerfile` for Next.js
- [ ] Create `docker-compose.yml`
- [ ] Test locally with `docker-compose up`

### Phase 2: Coolify Setup

- [ ] Create Coolify project
- [ ] Create Docker Compose resource
- [ ] Configure environment variables
- [ ] Configure domain and SSL

### Phase 3: Database Migration

- [ ] Verify Supabase production database
- [ ] Run Prisma migrations
- [ ] Seed initial data (admin user, point configs)

### Phase 4: Deployment

- [ ] Deploy to Coolify
- [ ] Verify health checks
- [ ] Test all routes
- [ ] Configure DNS

### Phase 5: Verification

- [ ] Test authentication flow
- [ ] Test Stripe webhooks
- [ ] Test Discord bot connectivity
- [ ] Test admin dashboard
- [ ] Load testing (optional)

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Container Architecture | HIGH | Standard Docker Compose pattern, well-documented in Coolify |
| Internal Networking | HIGH | Verified in [Coolify Docker Compose docs](https://coolify.io/docs/knowledge-base/docker/compose) |
| Domain/SSL | HIGH | Automatic Let's Encrypt, standard Traefik setup |
| Environment Variables | MEDIUM | Known Coolify issue with shared env vars, but acceptable |
| Proxy Configuration | HIGH | Current http-proxy-middleware setup transfers directly |
| Health Checks | HIGH | Standard Docker health check patterns |

---

## Open Questions

1. **Webhook IP Whitelisting:** Does Stripe require specific IPs? If so, need static IP from Coolify host.

2. **Database Migrations:** Decide on migration strategy - pre-deployment script or init container?

3. **Preview Deployments:** Should we enable for staging/testing?

4. **Scaling:** Current design is single-instance. If needed, horizontal scaling adds complexity (session affinity, etc.).

---

## Sources

### Official Documentation
- [Coolify Docker Compose Build Pack](https://coolify.io/docs/applications/build-packs/docker-compose)
- [Coolify Docker Compose Knowledge Base](https://coolify.io/docs/knowledge-base/docker/compose)
- [Coolify Next.js Deployment](https://coolify.io/docs/applications/nextjs)
- [Coolify Environment Variables](https://coolify.io/docs/knowledge-base/environment-variables)
- [Coolify Domains](https://coolify.io/docs/knowledge-base/domains)
- [Coolify Traefik Overview](https://coolify.io/docs/knowledge-base/proxy/traefik/overview)
- [Next.js Self-Hosting Guide](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js Deployment Docs](https://nextjs.org/docs/app/getting-started/deploying)

### Community Resources
- [Coolify Shared Environment Variables Issue](https://github.com/coollabsio/coolify/issues/7655)
- [PM2 Docker Integration](https://pm2.keymetrics.io/docs/usage/docker-pm2-nodejs/)
- [http-proxy-middleware GitHub](https://github.com/chimurai/http-proxy-middleware)

### Architecture Patterns
- [Docker Next.js with PM2 and NGINX](https://github.com/steveholgado/nextjs-docker-pm2-nginx)
- [Traefik Path-Based Routing](https://community.traefik.io/t/multiple-services-under-the-same-domain-name/22104)
