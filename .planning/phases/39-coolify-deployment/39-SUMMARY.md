---
phase: 39-coolify-deployment
plans: [39-01, 39-02]
subsystem: deployment
tags: [coolify, docker, deployment, ssl, dns, traefik, production]

# Dependency graph
requires:
  - phase: 38
    provides: Dockerfiles and docker-compose.yml for local development
provides:
  - Production deployment on Coolify with HTTPS
  - Custom domain with SSL certificate
  - Both containers (Express + Next.js) running and healthy
affects: []

# Tech tracking
tech-stack:
  added:
    - Coolify (self-hosted PaaS)
    - Traefik (reverse proxy, managed by Coolify)
    - Lets Encrypt (SSL certificates)
  patterns:
    - Docker Compose with Traefik labels for routing
    - External coolify network for service discovery
    - Env vars injected by Coolify env_file mechanism
    - HostRegexp-based Traefik routing (domain set by Coolify)

key-files:
  created:
    - docker-compose.prod.yml
    - dashboard/public/.gitkeep
  modified:
    - dashboard/next.config.ts
    - dashboard/src/hooks/useAuth.ts (committed from untracked)
    - prisma/migrations/20260124052015_add_leaderboard_visible/migration.sql

key-decisions:
  - "Simplified compose to use Coolify env_file injection rather than listing all env vars with dollar-sign syntax"
  - "Used HostRegexp for Traefik routing instead of hardcoded domain, letting Coolify manage domain labels"
  - "Removed outputFileTracingRoot from next.config.ts -- it caused standalone build to nest under wrong path in Docker"
  - "Express listens on port 80 internally (not 4000) to match standard HTTP conventions in production"
  - "Next.js container not exposed via Traefik -- only Express is publicly routed, proxying to Next.js internally"

patterns-established:
  - "Production compose uses expose (not ports) with Traefik labels for routing"
  - "Coolify external network for inter-container communication"
  - "Iterative deployment debugging via commit-push-rebuild cycle"
---

# Phase 39: Coolify Deployment Summary

## What Was Accomplished

The TRC Membership Gateway was deployed to a self-hosted Coolify instance and made publicly accessible at https://app.therevenuecouncil.com with valid SSL.

### 39-01: Docker Compose + Coolify Project Setup

1. Created `docker-compose.prod.yml` optimized for Coolify/Traefik deployment
2. Set up Coolify project via API (project UUID: tsco0oogck8g8cogo0wkwss4)
3. Created Docker Compose application in Coolify connected to GitHub repo `logan430/trc-membership-gateway`
4. Configured 20 environment variables via Coolify API
5. Iterated through 9 fix commits to resolve build issues until both containers built successfully

### 39-02: DNS + Domain + SSL

1. User created DNS A record: `app.therevenuecouncil.com` -> `82.180.160.120`
2. Configured production domain in Coolify via `docker_compose_domains` API
3. Lets Encrypt SSL certificate auto-provisioned by Coolify/Traefik
4. Verified HTTPS access, HTTP redirect, and health check responses

## Issues Encountered and Resolutions

The deployment required 9 iterative fix commits. Each issue was discovered during Coolify build/deploy cycles:

| Issue | Commit | Resolution |
|-------|--------|------------|
| `useAuth.ts` not in git (was untracked) | 80dbc94 | Committed the missing hook file |
| Missing Prisma migration for leaderboard_visible | c72cdfe | Added the migration file |
| Next.js Dockerfile COPY failed -- no public directory | 6de9789 | Created `dashboard/public/.gitkeep` |
| Standalone output path nested incorrectly in Docker | 46645cf | Corrected the COPY path in Dockerfile |
| `outputFileTracingRoot` caused wrong standalone path | 97a21f2 | Removed the setting from next.config.ts |
| No Traefik routing labels on express service | 9a57b31 | Added traefik labels and coolify network |
| Debugging port exposure for Traefik routing | 6fe7240 | Used HostRegexp and direct port for debugging |
| Optional empty env vars crashed Zod validation | e521b88 | Removed optional vars from compose; let Coolify inject only what is set |
| Debug port still exposed in compose | 5fc0e69 | Removed debug port exposure |

## Key Decisions

1. **Coolify env_file injection over explicit env vars in compose:** Rather than listing every environment variable with `${VAR}` syntax in docker-compose.prod.yml, simplified to only hardcode overrides (NODE_ENV, PORT, NEXT_APP_URL) and let Coolify inject all others via its env_file mechanism. This prevents Zod validation crashes from empty optional variables.

2. **HostRegexp-based Traefik routing:** Used `HostRegexp` catch-all pattern for the Traefik router rule instead of hardcoding a domain. Coolify manages the actual domain mapping through its own configuration layer.

3. **Express as sole public entry point:** Only the Express container has Traefik labels and receives external traffic. Next.js is internal-only (expose, not ports) and accessed by Express via `http://nextjs:3000`.

4. **Removed outputFileTracingRoot:** This Next.js config option was causing the standalone build to place files in a nested path that did not match the Dockerfile COPY expectations. Removing it let the default behavior work correctly in the Docker build context.

## Files Modified

**Created:**
- `docker-compose.prod.yml` -- Production Docker Compose with Traefik routing for Coolify
- `dashboard/public/.gitkeep` -- Ensures public directory exists for Dockerfile COPY

**Modified:**
- `dashboard/next.config.ts` -- Removed `outputFileTracingRoot` to fix standalone build path
- `dashboard/src/hooks/useAuth.ts` -- Committed previously untracked file required for build
- `prisma/migrations/20260124052015_add_leaderboard_visible/migration.sql` -- Added missing migration

## Production Endpoints

- **Application:** https://app.therevenuecouncil.com
- **Health Check:** https://app.therevenuecouncil.com/health
- **Coolify Server IP:** 82.180.160.120

## Deployment Verification Results

- HTTPS access: Working (200 OK)
- HTTP redirect: Working (302 to HTTPS)
- SSL certificate: Valid (Lets Encrypt)
- Health check: `{"status":"healthy","environment":"production","checks":{"database":true,"discord":true}}`
- Express container: Running and healthy
- Next.js container: Running and healthy

## Next Steps

Phase 40 (Database Production Setup): Configure Supabase database connectivity, run Prisma migrations against production, and seed admin accounts, point configs, feature flags, and email templates.
