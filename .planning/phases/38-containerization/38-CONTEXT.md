# Phase 38: Containerization - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Create production-ready Docker images for Express backend and Next.js frontend that run together locally before deploying to Coolify. Containers must work with external Supabase database and expose health endpoints.

</domain>

<decisions>
## Implementation Decisions

### Port Assignment
- Container listens on port 80 internally (Coolify handles SSL termination)
- Next.js also exposed externally for debugging access (not just internal)
- External debug access allows verifying Next.js directly without going through Express proxy

### Development Workflow
- Docker containers connect to same external Supabase database as local dev
- No containerized Postgres needed - keeps setup simple, matches production pattern

### Environment Handling
- Sensitive vars in .env.example with placeholder values (e.g., CHANGEME)
- Documents all required vars so setup is clear

### Health Check Depth
- Express health check verifies FULL readiness: database connectivity, Discord bot status, external services
- Degraded mode: Return HTTP 200 with JSON status showing which services are up/down
- App stays available even if non-critical dependencies are down

### Claude's Discretion
- Local port mapping (e.g., 4000:80 for Express, 3001 for Next.js debug)
- Docker role (production verification vs primary dev environment)
- Single docker-compose.yml vs separate dev/prod files
- Build steps (npm build only, migrations run separately)
- .env file reference vs inline environment variables
- Whether to use same .env or separate .env.docker
- Dockerfile defaults for non-sensitive values (NODE_ENV, PORT)
- Health endpoint structure (single /health vs separate /live and /ready)
- Next.js health check depth (simple 200 vs backend connectivity check)

</decisions>

<specifics>
## Specific Ideas

- Health check returns JSON with service-by-service status, not just pass/fail
- External Next.js debugging access is for development verification, not production routing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 38-containerization*
*Context gathered: 2026-01-28*
