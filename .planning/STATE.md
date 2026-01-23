# Project State: The Revenue Council

**Updated:** 2026-01-23
**Milestone:** v2.0 Community Intelligence Platform
**Mode:** YOLO

---

## Project Reference

**Core Value:**
Paid members can access the community, and we always know who everyone is. Intelligence platform provides admins actionable data while members get peer insights.

**v2.0 Goal:**
Transform from access gateway to intelligence platform by adding benchmarking, resource library, and gamification - giving admins actionable industry data while increasing member engagement and retention.

**v1.0 Complete (Phases 1-25):**
- Individual and company subscriptions with seat management
- Discord OAuth linking with role-based access control
- Introduction enforcement and billing failure handling
- Admin system with member management, audit logs, feature flags
- Email notifications for all lifecycle events
- Member self-service portal with account and billing management
- **Shipped:** 8,947 lines of TypeScript, 295 files, 114 feature commits

---

## Current Position

**Current Phase:** 26 - Database Schema Extension
**Current Plan:** 01 of 2 complete
**Status:** In progress

**Phase Goal:**
Extend production database with new tables for v2.0 features using zero-downtime migrations.

**Progress:**
```
Phase 26: [██████████░░░░░░░░░░] 1/2 plans (Plan 01 complete)
v2.0:     [█░░░░░░░░░░░░░░░░░░░] 1/~16 plans
```

---

## Performance Metrics

**v2.0 Milestone:**
- Total phases: 8 (Phases 26-33)
- Total requirements: 101
- Completed: 1 plan (Phase 26 Plan 01)
- In progress: Phase 26 Plan 02
- Blocked: 0

**Recent velocity:**
- v1.0 shipped: 25 phases, 60 plans, 114 commits (Oct 2025 - Jan 2026)
- v2.0 started: 2026-01-22
- v2.0 first plan: 2026-01-23 (26-01 completed in 6 minutes)

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Phase |
|----------|-----------|-------|
| Start v2.0 at Phase 26 | v1.0 ended at Phase 25 | Roadmap |
| 8 phases for v2.0 | Derived from 101 requirements with standard depth | Roadmap |
| Backend-first approach | Build APIs (Phases 26-30) before frontend (31-32) | Roadmap |
| Zero-downtime migrations | Production system in use, can't afford downtime | Phase 26 |
| Next.js proxied through Express | Preserve single domain, shared auth | Phase 31 |
| Points system before gamification | Foundation must exist before consumers | Phase 27 |
| Baseline migration from production | Production database existed without migration history | 26-01 |
| Create-only migration workflow | Allows manual zero-downtime edits before applying | 26-01 |

### Research Insights

**Stack validated:**
- React 19.2 + Next.js 15.1 (released Dec 2024/Jan 2025)
- Tailwind CSS v4 (released Jan 22, 2025 - 5x faster builds)
- Recharts 3.7 for benchmark visualizations (Chris's app has components)
- PostgreSQL JSONB + GIN indexes for flexible benchmark schemas
- Supabase Storage for file management (already in infrastructure)
- MEE6 API integration for Discord activity ($11.95/mo)

**Architecture approach:**
- Express (port 4000) proxies /dashboard/* to Next.js (port 3000)
- Denormalized points with immutable ledger (fast reads, audit trail)
- Signed URLs for file access (bypass Express, leverage Supabase CDN)
- Zero-downtime migration patterns (concurrent indexes, NOT VALID FKs)

**Critical pitfalls identified:**
- Production database migration downtime (Phase 26 establishes patterns)
- K-anonymity violations (< 5 benchmark responses never shown)
- MEE6 API reliability (unofficial API, need error handling)
- File upload security (magic number validation, malware scanning)

### Active Todos

- [x] Plan Phase 26: Database Schema Extension
- [x] Define Prisma schema changes for 5 new models
- [ ] Write zero-downtime migration scripts (Plan 02)
- [ ] Apply migrations to production (Plan 02)
- [ ] Create seed data for v2.0 tables (Plan 02)

### Known Blockers

None - ready for Plan 02.

### Questions for User

1. Should all 4 benchmark categories (compensation, infrastructure, business, operational) launch in v2.0, or can MVP start with 2?
2. Is MEE6 integration essential for v2.0, or can it defer to v2.1?
3. Should resource library support member-contributed content in v2.0, or strictly admin-curated?

---

## Session Continuity

**Last session:** 2026-01-23
- Completed Plan 26-01: Prisma schema extension
- Added 4 enums, 5 models, 3 Member fields to schema
- Generated baseline migration and v2.0 migration (not yet applied)
- Commits: 5c5c193, 731e355, 130c6ba

**Next session:** Plan 26-02
- Edit migration for NOT VALID foreign keys
- Create separate concurrent index migrations
- Add FK validation migration
- Add database trigger for points aggregation
- Apply migrations to production

**Context preserved:**
- v1.0 patterns (webhook idempotency, audit logging, fire-and-forget Discord ops)
- Research findings (stack choices, architecture patterns, critical pitfalls)
- Phase dependencies (backend -> frontend, points system -> gamification)
- Migration file at: prisma/migrations/20260123015816_add_v2_tables/migration.sql

---

*State initialized: 2026-01-22*
*Last updated: 2026-01-23 - Completed 26-01-PLAN.md*
