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

**Current Phase:** 38 - Containerization (NOT STARTED)
**Next Phase:** Plan Phase 38
**Status:** Ready to plan

**Progress:**
```
v2.0:     [####################] 31/31 plans (COMPLETE)
v2.1:     [####################] 14/14 plans (COMPLETE)
v2.2:     [....................] 0/14 plans (STARTING)
Phase 38: [....................] 0/3 plans
```

---

## Performance Metrics

**Velocity:**
- v2.0 plans completed: 31
- v2.1 plans completed: 14
- v2.2 plans completed: 0
- Total execution time: ~2.5 hours (v2.0+v2.1)

**v2.2 Phases:**

| Phase | Plans | Status |
|-------|-------|--------|
| 38 - Containerization | 3 | Not started |
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

### Known Blockers

None currently.

### Open Questions (from research)

1. What is the production domain?
2. Is the Coolify server already provisioned?
3. Are there existing production Stripe credentials?
4. What is the Supabase production project?

---

## Session Continuity

**Last session:** 2026-01-28
- v2.1 milestone completed (Phase 37)
- v2.2 roadmap created with 6 phases, 54 requirements
- Ready to begin Phase 38 planning

**Resume:** `/gsd:plan-phase 38`

---

*State initialized: 2026-01-22*
*Last updated: 2026-01-28 - v2.2 roadmap created*
