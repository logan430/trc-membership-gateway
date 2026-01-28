# Project State: The Revenue Council

**Updated:** 2026-01-28
**Milestone:** v2.2 Production Deployment & Launch
**Mode:** YOLO

---

## Project Reference

**Core Value:**
Paid members can access the community, and we always know who everyone is. Production deployment enables real members to join.

**v2.2 Goal:**
Deploy the complete membership gateway to Coolify, configure all external integrations with production URLs, validate end-to-end flows with real services, and prepare for public launch.

**Prior Milestones:**
- v1.0 Complete (Phases 1-25): Membership gateway shipped
- v2.0 Complete (Phases 26-33): Intelligence platform features
- v2.1 Complete (Phases 34-37): Frontend consolidation

---

## Current Position

**Current Phase:** 38 - Containerization (COMPLETE)
**Last Completed:** 38-03 Docker Compose
**Status:** Phase 38 complete, ready for Phase 39

**Progress:**
```
v2.0:     [####################] 31/31 plans (COMPLETE)
v2.1:     [####################] 14/14 plans (COMPLETE)
v2.2:     [###.................] 3/14 plans (IN PROGRESS)
Phase 38: [####################] 3/3 plans (COMPLETE)
```

---

## Performance Metrics

**Velocity:**
- v2.0 plans completed: 31
- v2.1 plans completed: 14
- v2.2 plans completed: 3
- Total execution time: ~2.5 hours (v2.0+v2.1)

**v2.2 Phases:**

| Phase | Plans | Status |
|-------|-------|--------|
| 38 - Containerization | 3 | COMPLETE |
| 39 - Coolify Deployment | 2 | Not started |
| 40 - Database Setup | 2 | Not started |
| 41 - Stripe Integration | 2 | Not started |
| 42 - Discord Integration | 2 | Not started |
| 43 - E2E & Go-Live | 3 | Not started |

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Phase |
|----------|-----------|-------|
| 6 phases for v2.2 | Derived from 54 requirements with standard depth | Roadmap |
| Docker Compose two-service | Express public, Next.js internal per research | Roadmap |
| Containerization first | Dockerfiles prerequisite for all Coolify work | Roadmap |
| Database after deploy | Need running app to verify connectivity | Roadmap |
| E2E + Go-Live combined | Natural delivery boundary for launch | Roadmap |
| Four-stage Dockerfile | base, deps, builder, runner for optimal caching | 38-02 |
| Non-root nextjs user | uid/gid 1001 for container security | 38-02 |
| Simple health check | Status + timestamp since Next.js proxies through Express | 38-02 |
| Three-stage Dockerfile | deps, builder, runner for Express with argon2 support | 38-01 |
| Degraded health mode | Always 200, JSON with service-by-service status | 38-01 |
| Non-root expressuser | uid/gid 1001 for container security | 38-01 |
| Express port 4000:80 | External:internal for production pattern | 38-03 |
| Next.js port 3001:3000 | Debug access externally, standard internally | 38-03 |
| service_healthy condition | Express waits for Next.js before starting | 38-03 |
| Node fetch health checks | No curl/wget needed in minimal Alpine images | 38-03 |

### Research Insights

**Critical from deployment research:**
- Stripe webhook: Use `express.raw()` before `express.json()` on webhook route
- Discord OAuth: Protocol, domain, path must exactly match Developer Portal
- Discord bot: Add health check for WebSocket status, not just HTTP
- SSL: Verify DNS propagation and firewall before deployment

**Suggested patterns:**
- Node 20 Alpine for minimal images
- Multi-stage builds with non-root users
- Signed environment variables in Coolify
- Manual migration timing (pre-deploy for v2.2)

**Established patterns (Phase 38):**
- Container health: GET /api/health returns JSON with status and timestamp
- Next.js Docker: standalone output + server.js CMD
- HOSTNAME=0.0.0.0 for Docker networking
- Service discovery: NEXT_APP_URL=http://nextjs:3000
- Health check pattern: Node fetch with process.exit(0/1)

### Known Blockers

**Docker not available in execution environment:**
- Build verification deferred for plans 38-01, 38-02, 38-03
- Manual verification commands documented in each SUMMARY.md
- Coolify will build and verify during Phase 39 deployment

### Open Questions (from research)

1. What is the production domain?
2. Is the Coolify server already provisioned?
3. Are there existing production Stripe credentials?
4. What is the Supabase production project?

---

## Session Continuity

**Last session:** 2026-01-28
- Completed 38-03 Docker Compose plan
- Created docker-compose.yml with service orchestration
- Updated .env.example with container configuration
- Phase 38 Containerization COMPLETE

**Resume:** `/gsd:execute-phase` to begin Phase 39 Coolify Deployment

---

*State initialized: 2026-01-22*
*Last updated: 2026-01-28 - Completed Phase 38 Containerization*
