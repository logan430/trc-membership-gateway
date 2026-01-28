---
phase: 38-containerization
plan: 01
subsystem: infrastructure
tags: [docker, containerization, express, health-check]

dependency-graph:
  requires: []
  provides: [express-dockerfile, dockerignore, enhanced-health-endpoint]
  affects: [38-02, 38-03, 39-01]

tech-stack:
  added: []
  patterns: [multi-stage-docker-build, non-root-container-user, degraded-health-mode]

key-files:
  created:
    - Dockerfile
    - .dockerignore
  modified:
    - src/index.ts

decisions:
  - Always return HTTP 200 from health endpoint (container stays healthy for orchestration)
  - Use degraded mode with service-by-service status instead of binary pass/fail
  - Three-stage Docker build (deps, builder, runner) for optimal image size
  - Non-root user (expressuser) for security

metrics:
  duration: 2m
  completed: 2026-01-28
---

# Phase 38 Plan 01: Express Backend Dockerfile Summary

Multi-stage Alpine Dockerfile and enhanced health endpoint for container deployment.

## One-Liner

Express backend Dockerfile with argon2 build support and /health endpoint returning degraded mode JSON with database/discord status.

## What Was Built

### 1. .dockerignore for Express Build
Created exclusion file to minimize Docker build context:
- node_modules (installed inside container)
- dashboard directory (has its own Dockerfile)
- .planning/.claude (development artifacts)
- dist (built fresh in container)
- Environment files (.env, .env.*)

### 2. Multi-Stage Express Dockerfile
Three-stage build optimized for production:

**Stage 1 (deps):** Install dependencies with native build tools
- Base: node:20-alpine
- Installs python3, make, g++ for argon2 native compilation
- Copies package.json and prisma directory
- Runs npm ci

**Stage 2 (builder):** Build TypeScript and generate Prisma client
- Copies node_modules from deps stage
- Runs npx prisma generate (generates Alpine-compatible client)
- Runs npm run build

**Stage 3 (runner):** Minimal production image
- Creates expressuser (uid 1001) with nodejs group (gid 1001)
- Copies dist/, node_modules/, package.json, prisma/, public/
- Runs as non-root user
- Exposes port 80 (Coolify handles SSL)
- Direct node execution for SIGTERM handling

### 3. Enhanced Health Endpoint
Updated `/health` to return service-by-service status:

```typescript
{
  status: "healthy" | "degraded",
  timestamp: "2026-01-28T21:26:42Z",
  environment: "production",
  checks: {
    database: true,
    discord: true
  }
}
```

Key design decisions:
- Always returns HTTP 200 (container stays healthy for orchestration)
- Status field indicates overall health: "healthy" or "degraded"
- Individual service checks allow debugging which dependency is down
- App stays available even if Discord bot is down

## Commits

| Hash | Type | Description |
|------|------|-------------|
| a8e4373 | chore | Create .dockerignore for Express build |
| 72d675e | feat | Create multi-stage Express Dockerfile |
| 11cdf71 | feat | Enhance health endpoint with degraded mode |

## Files Changed

| File | Change | Purpose |
|------|--------|---------|
| .dockerignore | Created | Exclude unnecessary files from Docker context |
| Dockerfile | Created | Multi-stage Alpine build for Express backend |
| src/index.ts | Modified | Enhanced /health with degraded mode |

## Verification Status

| Check | Status | Notes |
|-------|--------|-------|
| Dockerfile syntax | Pass | Valid multi-stage structure |
| TypeScript compiles | Pass | No type errors |
| Health endpoint format | Pass | Returns required fields |
| Docker build | Deferred | Docker not available in execution environment |
| Image size | Deferred | Requires Docker build |
| Non-root verification | Deferred | Requires Docker run |

**Note:** Docker is not installed in the execution environment. Full verification (build, image size, non-root user) should be performed when Docker is available.

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for 38-02:** Next.js Dockerfile
- Express Dockerfile provides pattern reference
- .dockerignore pattern established
- Health endpoint pattern can be adapted for Next.js /api/health route

**Ready for 38-03:** docker-compose.yml
- Express service configuration defined
- Health endpoint ready for container health checks
- Port 80 exposure matches compose service configuration

## Blockers

None.

---

*Plan: 38-01*
*Completed: 2026-01-28*
*Duration: 2 minutes*
