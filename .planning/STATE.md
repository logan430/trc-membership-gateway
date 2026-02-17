# Project State: The Revenue Council

**Updated:** 2026-02-17
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

**Current Phase:** 39 - Coolify Deployment (COMPLETE)
**Last Completed:** 39-02 DNS, Domain, and SSL
**Status:** Phase 39 complete, ready for Phase 40

**Progress:**
```
v2.0:     [####################] 31/31 plans (COMPLETE)
v2.1:     [####################] 14/14 plans (COMPLETE)
v2.2:     [#####...............] 5/14 plans (IN PROGRESS)
Phase 39: [####################] 2/2 plans (COMPLETE)
```

---

## Performance Metrics

**Velocity:**
- v2.0 plans completed: 31
- v2.1 plans completed: 14
- v2.2 plans completed: 5
- Total execution time: ~2.5 hours (v2.0+v2.1)

**v2.2 Phases:**

| Phase | Plans | Status |
|-------|-------|--------|
| 38 - Containerization | 3 | COMPLETE |
| 39 - Coolify Deployment | 2 | COMPLETE |
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
| API-driven Coolify setup | Automated project/app creation via Coolify REST API | 39 |
| Public GitHub repo | Deploy keys had SSH host key issues in Coolify build containers | 39 |
| Docker Compose application | Not service — apps support build: directives from source | 39 |
| Env vars via Coolify env_file | Compose only has hardcoded overrides; Coolify injects .env | 39 |
| Remove outputFileTracingRoot | Caused standalone build path nesting in Docker context | 39 |
| HostRegexp catch-all | Traefik v3 routing label for Coolify's Docker network | 39 |
| app.therevenuecouncil.com | Production subdomain for the membership gateway | 39 |

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

**Established patterns (Phase 39):**
- Coolify API: v1 REST API at http://82.180.160.120:8000/api/v1/
- Coolify app UUID: wcssogsgc00o8ocwcg4c0c00
- Server UUID: bw40kkoo8kwwc8sssg0sg4ko
- GitHub repo: logan430/trc-membership-gateway (public)
- Traefik v3.6.8 on coolify external network
- Let's Encrypt auto-provisioned via Coolify domain config
- Zod validation: empty string env vars crash .url().optional() — must delete, not set to ""
- docker_compose_domains API for compose app domain assignment

### Known Blockers

None currently. Docker build and Coolify deployment verified.

### Open Questions (from research)

1. ~~What is the production domain?~~ → app.therevenuecouncil.com
2. ~~Is the Coolify server already provisioned?~~ → Yes, 82.180.160.120:8000
3. Are there existing production Stripe credentials? (currently using test mode)
4. What is the Supabase production project? (currently using dev project)

---

## Session Continuity

**Last session:** 2026-02-17
- Completed Phase 39 Coolify Deployment
- App live at https://app.therevenuecouncil.com
- Both containers healthy: database=true, discord=true
- HTTPS with Let's Encrypt, HTTP→HTTPS redirect working
- Phase 39 COMPLETE

**Resume:** `/gsd:plan-phase 40` to plan Phase 40 Database Production Setup

---

*State initialized: 2026-01-22*
*Last updated: 2026-02-17 - Completed Phase 39 Coolify Deployment*
