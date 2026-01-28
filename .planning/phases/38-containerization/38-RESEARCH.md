# Phase 38: Containerization - Research

**Researched:** 2026-01-28
**Domain:** Docker containerization for Node.js/Express + Next.js applications
**Confidence:** HIGH

## Summary

This research covers production-ready Docker containerization for the TRC membership gateway, consisting of an Express backend (TypeScript, Prisma, Discord.js) and a Next.js 15 frontend. The stack will be containerized using multi-stage Alpine builds with non-root users, connecting to external Supabase (PostgreSQL) database.

Key findings:
- Node 20 Alpine is the standard base image for minimal production containers (~150MB vs ~1GB for full node image)
- Next.js standalone output mode creates self-contained deployments without full node_modules
- Express already has graceful shutdown handling (SIGTERM/SIGINT) - needs minor enhancement for health checks
- argon2 requires build dependencies (python3, make, g++) during the build stage on Alpine
- Service discovery in docker-compose uses service names as DNS hostnames automatically

**Primary recommendation:** Use three-stage Dockerfiles (deps, build, runner) with explicit non-root users, and a single docker-compose.yml with health checks on both services.

## Standard Stack

The established tools for this domain:

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| node:20-alpine | 20.x LTS | Base image for both services | LTS support, Alpine reduces image 85%+ |
| Docker multi-stage | - | Separate build/runtime environments | Security + size reduction |
| docker-compose | 3.8+ | Local orchestration | Service networking, health checks |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| .dockerignore | Exclude unnecessary files from context | Always - prevents node_modules copy |
| HEALTHCHECK | Container health verification | Both Dockerfiles and compose |
| Non-root user | Security hardening | Always in production images |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Alpine | Debian Slim | Larger image (~200MB vs ~150MB), but no glibc issues |
| node:20-alpine | node:22-alpine | Node 22 is newer but Prisma 7+ officially requires Node 22+, project uses Prisma 7.2.0 |
| docker-compose | Podman Compose | Compose is more widely documented and supported |

**Note on Node version:** The project uses Prisma 7.2.0 which officially requires Node.js >= 20.19.0 or >= 22.12.0. The backend uses argon2 which needs native compilation. Node 20 Alpine is the safer choice for compatibility.

**Installation:**
```bash
# Docker and Docker Compose are pre-installed on target environment (Coolify)
# No additional installation needed
```

## Architecture Patterns

### Recommended Project Structure
```
/                           # Project root
├── Dockerfile              # Express backend Dockerfile
├── dashboard/
│   └── Dockerfile          # Next.js frontend Dockerfile
├── docker-compose.yml      # Orchestration for local testing
├── .dockerignore           # Root excludes (for Express build)
└── dashboard/
    └── .dockerignore       # Dashboard excludes (for Next.js build)
```

### Pattern 1: Multi-Stage Build (Express Backend)

**What:** Three stages - dependencies, build, runner
**When to use:** Always for TypeScript Node.js applications

```dockerfile
# Stage 1: Dependencies (includes native build tools)
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Stage 2: Build TypeScript
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressuser
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=expressuser:nodejs /app/dist ./dist
COPY --from=builder --chown=expressuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=expressuser:nodejs /app/package.json ./
COPY --from=builder --chown=expressuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=expressuser:nodejs /app/public ./public
USER expressuser
EXPOSE 80
CMD ["node", "dist/index.js"]
```

### Pattern 2: Multi-Stage Build (Next.js Standalone)

**What:** Four stages - base, deps, build, runner with standalone output
**When to use:** Always for Next.js 15 with standalone output

```dockerfile
# Stage 1: Base
FROM node:20-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1

# Stage 2: Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 3: Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 4: Runner
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

### Pattern 3: docker-compose.yml with Health Checks

**What:** Service orchestration with internal networking and health verification
**When to use:** Local stack testing before Coolify deployment

```yaml
version: "3.8"

services:
  express:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "4000:80"
    environment:
      - NODE_ENV=production
      - PORT=80
      - NEXT_APP_URL=http://nextjs:3000
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:80/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      nextjs:
        condition: service_healthy

  nextjs:
    build:
      context: ./dashboard
      dockerfile: Dockerfile
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=production
      - HOSTNAME=0.0.0.0
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

networks:
  default:
    name: trc-network
```

### Anti-Patterns to Avoid

- **Using npm start in CMD:** Don't use `npm start` or `yarn start` - they don't forward SIGTERM properly. Use `node` directly.
- **Running as root:** Never run production containers as root user.
- **Installing glibc on Alpine:** Prisma downloads musl-compatible engines automatically. Installing libc6-compat breaks Prisma.
- **Copying node_modules from host:** Always install dependencies inside the container to get platform-specific binaries.
- **Using COPY . . early:** Copy package.json first, install deps, then copy source - maximizes layer caching.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Health check HTTP client | Custom HTTP check script | Node fetch() in healthcheck | Built-in, no dependencies |
| Signal handling | Custom signal handlers | Express server.close() pattern | Already implemented in index.ts |
| Service discovery | IP address configuration | Docker DNS with service names | Automatic, container-name resolution |
| Non-root user | useradd/adduser manually | addgroup + adduser with --system | Consistent pattern, proper UIDs |
| Process management | PM2 in container | Direct node execution | PM2 is for multiple instances, Docker handles single process |

**Key insight:** The existing Express app already has graceful shutdown handling. The health endpoint exists but needs enhancement per CONTEXT.md decisions (degraded mode, service-by-service status).

## Common Pitfalls

### Pitfall 1: argon2 Build Failure on Alpine
**What goes wrong:** `npm ci` fails with node-gyp errors when installing argon2
**Why it happens:** argon2 has native dependencies requiring python3, make, g++
**How to avoid:** Install build tools in deps stage: `RUN apk add --no-cache python3 make g++`
**Warning signs:** Error messages mentioning `node-gyp`, `gyp ERR!`, or compilation failures

### Pitfall 2: Prisma Client Platform Mismatch
**What goes wrong:** Prisma queries fail with "Unable to find a matching engine"
**Why it happens:** Prisma client generated on Windows/Mac, running on Alpine Linux
**How to avoid:** Run `npx prisma generate` inside the Alpine build stage
**Warning signs:** Error mentioning binary targets or engine platforms

### Pitfall 3: Next.js Standalone Missing Static Assets
**What goes wrong:** 404 errors for static files, images not loading
**Why it happens:** Standalone output excludes public/ and .next/static by default
**How to avoid:** Explicitly copy both directories in Dockerfile runner stage
**Warning signs:** Missing CSS, images returning 404, broken favicon

### Pitfall 4: Container Ignores SIGTERM
**What goes wrong:** Container takes 30 seconds to stop (Kubernetes force-kills)
**Why it happens:** Using npm/yarn to start app - they don't forward signals
**How to avoid:** Use `CMD ["node", "dist/index.js"]` instead of `CMD ["npm", "start"]`
**Warning signs:** Slow container shutdown, log messages about forced termination

### Pitfall 5: Internal Network Connection Refused
**What goes wrong:** Express can't reach Next.js at http://nextjs:3000
**Why it happens:** Next.js only listens on localhost by default
**How to avoid:** Set `HOSTNAME=0.0.0.0` environment variable for Next.js
**Warning signs:** ECONNREFUSED errors, proxy failures, "connection refused"

### Pitfall 6: Health Check Fails During Startup
**What goes wrong:** Container marked unhealthy before app fully starts
**Why it happens:** Health check runs before database connection established
**How to avoid:** Use `start_period` in health check (40s for Express, 30s for Next.js)
**Warning signs:** Container restarts repeatedly, "unhealthy" status

## Code Examples

Verified patterns from official sources:

### Express Health Check with Degraded Mode (per CONTEXT.md)
```typescript
// Source: Custom based on Express.js health check docs and CONTEXT.md decisions
import { prisma } from './lib/prisma.js';
import { discordClient } from './bot/client.js';

app.get('/health', async (req, res) => {
  const checks = {
    database: false,
    discord: false,
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check Discord bot
  checks.discord = discordClient.isReady();

  // Degraded mode: Return 200 with status JSON
  // App stays available even if non-critical dependencies are down
  const allHealthy = Object.values(checks).every(Boolean);

  res.status(200).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks,
  });
});
```

### Next.js Health Check Route (App Router)
```typescript
// dashboard/src/app/api/health/route.ts
// Source: Next.js Route Handlers docs
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}
```

### .dockerignore for Express Backend
```
# Source: Docker best practices documentation
node_modules
npm-debug.log
.git
.gitignore
.env
.env.*
*.md
dist
dashboard
.planning
.claude
```

### .dockerignore for Next.js Dashboard
```
# Source: Next.js Docker documentation
node_modules
.next
.git
.gitignore
*.md
.env*.local
```

### Docker Health Check with Node.js (no curl/wget)
```dockerfile
# Source: Docker healthcheck documentation + Node.js patterns
# Alpine images may not have curl - use Node's built-in fetch
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:80/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full node image (~1GB) | node:alpine (~150MB) | 2020+ | 85% size reduction |
| npm start in CMD | Direct node execution | Docker signal handling awareness | Proper SIGTERM handling |
| Single-stage builds | Multi-stage builds | Docker 17.05+ | Smaller images, no build tools in production |
| curl/wget for health checks | Node fetch() | Node 18+ (native fetch) | No additional dependencies |
| PM2 in container | Docker restart policy | Kubernetes/container orchestration era | Simpler, better orchestration integration |

**Deprecated/outdated:**
- `serverless` output mode in Next.js (replaced by `standalone`)
- Installing build tools in production image (multi-stage eliminates this)
- Using `libc6-compat` with Prisma on Alpine (breaks musl engine downloads)

## Open Questions

Things that could not be fully resolved:

1. **Sharp library for Next.js image optimization**
   - What we know: Sharp is recommended when self-hosting Next.js with next/image
   - What's unclear: Dashboard package.json doesn't currently include sharp, may not use next/image
   - Recommendation: Add sharp to dashboard dependencies only if next/image is used

2. **Exact Node version pinning**
   - What we know: Node 20 LTS is compatible, Node 22 is newer but less tested
   - What's unclear: Whether to pin exact version (node:20.19.0-alpine) vs major (node:20-alpine)
   - Recommendation: Use `node:20-alpine` for automatic patch updates, Coolify rebuild will pick up security fixes

3. **Database migration timing**
   - What we know: CONTEXT.md states migrations run separately (pre-deploy for v2.2)
   - What's unclear: Whether container startup should verify schema matches
   - Recommendation: Health check verifies DB connectivity only, not schema state

## Sources

### Primary (HIGH confidence)
- [Next.js Output Configuration](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output) - Standalone mode documentation
- [Prisma Docker Guide](https://www.prisma.io/docs/guides/docker) - Alpine compatibility, client generation
- [Express.js Health Checks](https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html) - Official health check patterns
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/) - Official documentation
- [Docker Compose Networking](https://docs.docker.com/compose/how-tos/networking/) - Service discovery

### Secondary (MEDIUM confidence)
- [Node.js Docker Best Practices GitHub](https://github.com/AlbertHernandez/nodejs-docker-best-practices) - Community patterns verified with official docs
- [Next.js 15 Standalone Docker Guide](https://ketan-chavan.medium.com/next-js-15-self-hosting-with-docker-complete-guide-0826e15236da) - Practical implementation verified with Next.js docs
- [Docker Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html) - OWASP guidelines

### Tertiary (LOW confidence)
- WebSearch results for argon2 Alpine build issues - verified with npm documentation
- Community patterns for health checks in distroless images

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation for all components
- Architecture: HIGH - Multi-stage builds are well-documented standard practice
- Pitfalls: HIGH - Common issues documented in official guides and verified with project dependencies
- Health check patterns: MEDIUM - Custom implementation based on CONTEXT.md decisions

**Research date:** 2026-01-28
**Valid until:** 60 days (Docker patterns are stable, Next.js standalone is mature)

---

*Phase: 38-containerization*
*Research completed: 2026-01-28*
