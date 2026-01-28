---
phase: 38-containerization
plan: 02
subsystem: infra
tags: [docker, nextjs, alpine, health-check, standalone]

# Dependency graph
requires:
  - phase: 38-containerization
    provides: Phase context and research for Docker patterns
provides:
  - Next.js Dockerfile with multi-stage Alpine build
  - Health check API route at /api/health
  - .dockerignore for efficient build context
affects: [38-03-compose, 39-coolify-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Multi-stage Docker builds with node:20-alpine
    - Next.js standalone output mode for minimal images
    - Non-root container user (nextjs:nodejs)
    - HOSTNAME=0.0.0.0 for Docker networking

key-files:
  created:
    - dashboard/Dockerfile
    - dashboard/.dockerignore
    - dashboard/src/app/api/health/route.ts

key-decisions:
  - "Four-stage Dockerfile: base, deps, builder, runner for optimal caching"
  - "Non-root nextjs user with uid/gid 1001 for security"
  - "Simple health check (status + timestamp) since Next.js proxies through Express"

patterns-established:
  - "Container health pattern: GET /api/health returns JSON with status and timestamp"
  - "Next.js Docker pattern: standalone output + server.js CMD"

# Metrics
duration: 3min
completed: 2026-01-28
---

# Phase 38 Plan 02: Next.js Dockerfile Summary

**Multi-stage Alpine Dockerfile with standalone output mode, non-root user, and /api/health endpoint for container orchestration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-28T21:24:57Z
- **Completed:** 2026-01-28T21:28:00Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments
- Created .dockerignore excluding node_modules, .next, and local env files
- Added /api/health endpoint returning JSON status for container health checks
- Built four-stage Dockerfile (base, deps, builder, runner) using node:20-alpine
- Configured non-root nextjs user with proper ownership of build artifacts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create .dockerignore for Next.js build** - `f4b6f12` (chore)
2. **Task 2: Create health check API route** - `b5993f7` (feat)
3. **Task 3: Create multi-stage Next.js Dockerfile** - `9d827a0` (feat)

## Files Created

- `dashboard/.dockerignore` - Excludes node_modules, .next, .git, and local env files from build context
- `dashboard/src/app/api/health/route.ts` - Health check endpoint returning JSON with status and timestamp
- `dashboard/Dockerfile` - Four-stage Alpine build for Next.js standalone production image

## Decisions Made

- **Simple health check:** Returns only status and timestamp since Next.js frontend proxies database calls through Express - no need for direct DB connectivity check
- **HOSTNAME=0.0.0.0:** Required for Docker networking to allow other containers to reach Next.js
- **libc6-compat:** Added in deps stage for Alpine compatibility with native Node modules

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Docker not available:** Build verification could not be performed in this environment. Manual verification required:
  ```bash
  cd dashboard && docker build -t trc-dashboard .
  docker images trc-dashboard  # Should be under 200MB
  docker run --rm trc-dashboard whoami  # Should output "nextjs"
  docker run -p 3001:3000 trc-dashboard
  curl http://localhost:3001/api/health  # Should return JSON
  ```

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Next.js Dockerfile ready for docker-compose.yml integration
- Health endpoint available for Traefik/Coolify health checks
- Standalone mode already configured in next.config.ts (output: 'standalone')
- Ready for 38-03 to create Docker Compose orchestration

---
*Phase: 38-containerization*
*Completed: 2026-01-28*
