# Deployment Stack: Coolify for Express + Next.js

**Project:** The Revenue Council Membership Gateway
**Researched:** 2026-01-28
**Overall Confidence:** HIGH

## Executive Summary

Deploying this Express + Next.js application to Coolify is straightforward using **Docker Compose** with two services on the same network. The Express backend handles all external traffic and proxies dashboard routes to Next.js internally. This preserves the existing proxy architecture while leveraging Coolify's automatic SSL and domain management.

**Recommended approach:** Single Docker Compose file with two services, Express exposed via Traefik, Next.js internal-only.

---

## Recommended Deployment Architecture

### Why Docker Compose (Not Separate Applications)

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Docker Compose (RECOMMENDED)** | Single deployment, shared network, internal service communication | Compose file is source of truth | **USE THIS** |
| Separate Applications | Independent scaling | Complex routing, extra Traefik config, CORS issues | Avoid |
| Nixpacks | Zero config | No control over Express proxy setup, multi-app complexity | Avoid |

**Rationale:** The existing Express-to-Next.js proxy architecture works perfectly with Docker Compose. Express is the public entry point; Next.js runs on an internal network. This mirrors the development setup and requires no architectural changes.

### Service Topology

```
Internet
    |
    v
[Coolify Traefik] --- HTTPS termination + domain routing
    |
    v (port 3000)
[Express Backend] --- API routes, webhooks, proxy
    |
    v (internal network, port 3001)
[Next.js Frontend] --- Dashboard pages only
```

**Key insight:** Express proxies `/_next/*`, `/login`, `/signup`, `/admin/*`, `/dashboard/*` to Next.js using `http-proxy-middleware`. In Docker Compose, Next.js is reachable at `http://nextjs:3001` (service name as hostname).

---

## Docker Compose Configuration

### Complete docker-compose.yml

```yaml
services:
  # Express backend - public entry point
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    environment:
      - NODE_ENV=production
      - PORT=3000
      - NEXT_APP_URL=http://nextjs:3001
      # All other env vars configured in Coolify UI
      - DATABASE_URL=${DATABASE_URL:?}
      - JWT_SECRET=${JWT_SECRET:?}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:?}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:?}
      - DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID:?}
      - DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET:?}
      - DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN:?}
      - DISCORD_GUILD_ID=${DISCORD_GUILD_ID:?}
      - DISCORD_INTRODUCTIONS_CHANNEL_ID=${DISCORD_INTRODUCTIONS_CHANNEL_ID:?}
      - APP_URL=${APP_URL:?}
      # Optional variables
      - STRIPE_INDIVIDUAL_PRICE_ID=${STRIPE_INDIVIDUAL_PRICE_ID:-}
      - STRIPE_OWNER_SEAT_PRICE_ID=${STRIPE_OWNER_SEAT_PRICE_ID:-}
      - STRIPE_TEAM_SEAT_PRICE_ID=${STRIPE_TEAM_SEAT_PRICE_ID:-}
      - EMAIL_PROVIDER=${EMAIL_PROVIDER:-console}
      - RESEND_API_KEY=${RESEND_API_KEY:-}
      - SENTRY_DSN=${SENTRY_DSN:-}
      - SUPABASE_URL=${SUPABASE_URL:-}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-}
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      nextjs:
        condition: service_healthy
    labels:
      - traefik.enable=true

  # Next.js frontend - internal only
  nextjs:
    build:
      context: ./dashboard
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - PORT=3001
      - HOSTNAME=0.0.0.0
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    # NO traefik labels - internal only, accessed via backend proxy
```

### Critical Configuration Notes

1. **NEXT_APP_URL** - Set to `http://nextjs:3001` (Docker Compose service name)
2. **No ports mapping for nextjs** - Keeps it private to the Docker network
3. **healthcheck uses wget** - Alpine images have wget, not curl
4. **depends_on with condition** - Ensures Next.js is healthy before Express starts proxying

---

## Dockerfiles

### Dockerfile.backend (Express)

```dockerfile
# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install build dependencies for native modules (argon2, sharp)
RUN apk add --no-cache python3 make g++ gcc libc-dev

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install ALL dependencies (need dev deps for building)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY . .

# Build TypeScript
RUN npm run build

# =============================================================================
# Stage 3: Production
# =============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

# Security: run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Install only production dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN apk add --no-cache python3 make g++ gcc libc-dev && \
    npm ci --only=production && \
    npx prisma generate && \
    apk del python3 make g++ gcc libc-dev

# Copy built application
COPY --from=builder --chown=expressjs:nodejs /app/dist ./dist
COPY --from=builder --chown=expressjs:nodejs /app/public ./public

# Health check tool
RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV PORT=3000

USER expressjs
EXPOSE 3000

# Direct execution (not npm start) for proper signal handling
CMD ["node", "dist/index.js"]
```

### dashboard/Dockerfile (Next.js)

```dockerfile
# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# =============================================================================
# Stage 3: Production
# =============================================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Health check tool
RUN apk add --no-cache wget

USER nextjs

ENV PORT=3001
ENV HOSTNAME=0.0.0.0
EXPOSE 3001

CMD ["node", "server.js"]
```

---

## Environment Variables

### Required Variables (Deployment Will Fail Without)

| Variable | Source | Notes |
|----------|--------|-------|
| `DATABASE_URL` | Supabase | Use pooler connection (port 6543) |
| `JWT_SECRET` | Generate | `openssl rand -hex 32` |
| `STRIPE_SECRET_KEY` | Stripe Dashboard | Use `sk_live_*` for production |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI/Dashboard | `whsec_*` for production webhook endpoint |
| `DISCORD_CLIENT_ID` | Discord Dev Portal | OAuth2 application |
| `DISCORD_CLIENT_SECRET` | Discord Dev Portal | OAuth2 secret |
| `DISCORD_BOT_TOKEN` | Discord Dev Portal | Bot token |
| `DISCORD_GUILD_ID` | Discord | Server/Guild ID |
| `DISCORD_INTRODUCTIONS_CHANNEL_ID` | Discord | Channel for intro detection |
| `APP_URL` | Your domain | `https://yourdomain.com` |

### Auto-Configured Variables (Set in docker-compose.yml)

| Variable | Value | Why |
|----------|-------|-----|
| `NODE_ENV` | `production` | Enables production optimizations |
| `PORT` | `3000` (backend), `3001` (frontend) | Container ports |
| `NEXT_APP_URL` | `http://nextjs:3001` | Docker service discovery |

### Optional Variables

| Variable | Default | Production Setting |
|----------|---------|-------------------|
| `EMAIL_PROVIDER` | `console` | `resend` |
| `RESEND_API_KEY` | - | Required if EMAIL_PROVIDER=resend |
| `SENTRY_DSN` | - | Set for error monitoring |
| `SUPABASE_URL` | - | Required for resource uploads |
| `SUPABASE_SERVICE_ROLE_KEY` | - | Required for resource uploads |

### Coolify Environment Variable Setup

In Coolify UI, use the "Shared Variables" feature for secrets shared across deployments:

1. Go to **Environment Variables** on your Docker Compose application
2. Add each required variable
3. Mark sensitive values as "Secret" (hidden in UI, not logged)

Coolify validates required variables (those with `:?` syntax) before deployment starts.

---

## Health Checks

### Why Health Checks Matter

Coolify uses Traefik for routing. Traefik will return **"No Available Server"** or **404** if:
- Container health check is failing
- Container is still starting up
- Health check endpoint returns non-200

### Express Health Check

Already implemented at `/health`:

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});
```

**Docker health check command:**
```dockerfile
HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

### Next.js Health Check

Next.js serves pages at `/` which returns 200 for authenticated users. For a dedicated health endpoint, add `app/health/route.ts`:

```typescript
export function GET() {
  return Response.json({ status: 'ok' });
}
```

Then update health check:
```dockerfile
HEALTHCHECK CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1
```

### Health Check Timing

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `start_period` | 40s (backend), 30s (frontend) | Allow for cold start, Prisma connection, bot startup |
| `interval` | 30s | Frequent enough to detect issues |
| `timeout` | 10s | Generous for slow responses |
| `retries` | 3 | Avoid false positives from transient issues |

---

## Coolify-Specific Configuration

### Domain Setup

1. In Coolify application settings, set **Domain** to your domain (e.g., `revenuecouncil.com`)
2. Coolify automatically:
   - Generates Let's Encrypt SSL certificate
   - Configures Traefik routing
   - Handles HTTPS redirects

### Service Exposure

| Service | Exposed? | Domain | Why |
|---------|----------|--------|-----|
| backend | YES | yourdomain.com | Public entry point |
| nextjs | NO | - | Internal only, accessed via proxy |

In docker-compose.yml, only the `backend` service has `traefik.enable=true`.

### Persistent Storage

This application uses **external services** for persistence:
- **Database:** Supabase Postgres (hosted)
- **File Storage:** Supabase Storage (hosted)
- **Session:** JWT tokens (stateless)

**No Docker volumes needed.** This simplifies deployment and enables horizontal scaling.

### Build Settings

In Coolify application settings:
- **Build Pack:** Docker Compose
- **Docker Compose Location:** `./docker-compose.yml`
- **Build Command:** (leave empty, Dockerfiles handle it)

---

## What NOT to Do

### Do NOT Use Nixpacks

Nixpacks auto-detects project type but:
- Cannot handle multi-service proxying
- No control over Express proxy configuration
- Will deploy as separate apps requiring complex Traefik rules

### Do NOT Expose Next.js Publicly

If you expose Next.js directly:
- Bypass Express authentication middleware
- CORS issues between services
- Duplicate SSL certificates
- Complex subdomain routing

### Do NOT Use npm start in CMD

```dockerfile
# BAD - npm swallows signals
CMD ["npm", "start"]

# GOOD - direct node execution
CMD ["node", "dist/index.js"]
```

npm as PID 1 doesn't forward SIGTERM, causing:
- 10+ second shutdown delays
- Dropped in-flight requests
- Orphaned Discord bot connections

### Do NOT Skip Health Checks

Without health checks:
- Traefik routes to unhealthy containers
- Users see 502 Bad Gateway during deployments
- Rolling updates don't work properly

### Do NOT Use node:latest or node:20

```dockerfile
# BAD - unpredictable builds
FROM node:latest
FROM node:20

# GOOD - deterministic
FROM node:20.18-alpine
```

Use specific versions for reproducible builds.

---

## Deployment Checklist

### Pre-Deployment

- [ ] Create Dockerfiles (backend and dashboard)
- [ ] Create docker-compose.yml
- [ ] Add `/health` endpoint to Next.js (optional but recommended)
- [ ] Test local Docker build: `docker compose build`
- [ ] Test local Docker run: `docker compose up`

### Coolify Setup

- [ ] Create new project in Coolify
- [ ] Add "Docker Compose" application from Git repo
- [ ] Configure environment variables (all required vars)
- [ ] Set domain in application settings
- [ ] Deploy

### Post-Deployment

- [ ] Verify SSL certificate issued
- [ ] Test `/health` endpoint
- [ ] Test public pages load
- [ ] Test login/signup flow
- [ ] Test dashboard access
- [ ] Test admin access
- [ ] Configure Stripe webhook endpoint in Stripe Dashboard
- [ ] Test Stripe webhook receives events

### Stripe Webhook Configuration

After deployment, update Stripe webhook endpoint:
1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://yourdomain.com/webhooks/stripe`
3. Select events: `checkout.session.completed`, `customer.subscription.*`, etc.
4. Copy webhook secret to Coolify env vars as `STRIPE_WEBHOOK_SECRET`

---

## Monitoring and Logs

### Coolify Built-in

- **Logs:** Real-time container logs in Coolify UI
- **Metrics:** CPU, RAM, disk usage per container
- **Alerts:** Failed deployment notifications

### Application-Level

- **Sentry:** Set `SENTRY_DSN` for error tracking
- **Pino Logs:** JSON structured logs in production

### Log Access

```bash
# Via Coolify UI
Application > Logs > Select container

# Via SSH to server
docker logs <container_id> -f
```

---

## Scaling Considerations

### Horizontal Scaling

Coolify supports running multiple container instances. However:

| Component | Scalable? | Notes |
|-----------|-----------|-------|
| Express API | YES | Stateless, use multiple replicas |
| Discord Bot | NO | Single bot connection required |
| Next.js | YES | Stateless SSR |

**Recommendation:** For scaling, separate the Discord bot into its own service and scale Express/Next.js independently.

### Vertical Scaling

Coolify allows resource limits per service:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

Start conservative, increase based on metrics.

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Docker Compose approach | HIGH | Official Coolify documentation, multiple sources confirm |
| Dockerfile patterns | HIGH | Official Next.js Dockerfile, Snyk best practices |
| Environment variables | HIGH | Verified against codebase env.ts schema |
| Health checks | HIGH | Official Coolify docs, Traefik requirements |
| Multi-service networking | HIGH | Docker Compose standard behavior |
| Traefik routing | MEDIUM | Some 2025 bugs reported, monitor for issues |

---

## Sources

- [Coolify Docker Compose Build Pack](https://coolify.io/docs/applications/build-packs/docker-compose)
- [Coolify Knowledge Base: Docker Compose](https://coolify.io/docs/knowledge-base/docker/compose)
- [Coolify Next.js Deployment](https://coolify.io/docs/applications/nextjs)
- [Coolify Health Checks](https://coolify.io/docs/knowledge-base/health-checks)
- [Coolify Traefik Overview](https://coolify.io/docs/knowledge-base/proxy/traefik/overview)
- [Official Next.js Dockerfile](https://github.com/vercel/next.js/blob/canary/examples/with-docker/Dockerfile)
- [Snyk: 10 Best Practices for Node.js Docker](https://snyk.io/blog/10-best-practices-to-containerize-nodejs-web-applications-with-docker/)
- [argon2 npm - Alpine compatibility](https://www.npmjs.com/package/argon2)
