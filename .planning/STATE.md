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

**Current Phase:** 28 - Benchmarking System
**Current Plan:** 2 of 3 complete
**Status:** In progress

**Phase Goal:**
Build benchmarking backend with types, validation, service layer, and API endpoints for anonymous peer comparison.

**Progress:**
```
Phase 26: [████████████████████] 3/3 plans (Complete!)
Phase 27: [████████████████████] 3/3 plans (Complete!)
Phase 28: [█████████████░░░░░░░] 2/3 plans (In progress)
v2.0:     [█████████░░░░░░░░░░░] 8/~16 plans
```

---

## Performance Metrics

**v2.0 Milestone:**
- Total phases: 8 (Phases 26-33)
- Total requirements: 101
- Completed: ~25 requirements (25%) - Phases 26-27 + 28-01/02 complete
- In progress: Phase 28
- Blocked: 0

**Recent velocity:**
- v1.0 shipped: 25 phases, 60 plans, 114 commits (Oct 2025 - Jan 2026)
- v2.0 started: 2026-01-22
- Phase 26 completed: 2026-01-23 (3 plans, ~20 minutes total)
- Phase 27 completed: 2026-01-23 (3 plans, ~18 minutes total)
- Plan 28-01 completed: 2026-01-23 (~3 minutes)
- Plan 28-02 completed: 2026-01-23 (~5 minutes)

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
| NOT VALID for all FKs | Instant addition, validation separate | 26-02 |
| Single-statement index migrations | Prisma skips transaction, enables CONCURRENTLY | 26-02 |
| AFTER INSERT trigger timing | Ensures PointTransaction committed before Member update | 26-03 |
| lastActiveAt only for positive points | Admin deductions shouldn't count as member activity | 26-03 |
| FeatureFlag caching pattern for PointConfig | Consistent with existing patterns, 60s TTL | 27-01 |
| admin_adjustment not configurable | Admin adjustments use arbitrary values, not config | 27-01 |
| Metadata-based idempotency | JSONB path queries for flexible duplicate detection | 27-02 |
| Fire-and-forget DM for admin adjustments | Consistent with existing patterns, DM failure non-blocking | 27-02 |
| Admin adjustments hidden from member history | Preserves the 'earned' feeling per CONTEXT.md | 27-03 |
| Points summary floors at zero for display | Negative total possible but shows as 0 to member | 27-03 |
| Zod schemas per category | API-layer validation before database write | 28-01 |
| K_ANONYMITY_THRESHOLD = 5 | Per BENCH-06 requirement, hide results until 5+ submissions | 28-01 |
| PostgreSQL percentile_cont() for aggregates | Native DB aggregate functions for accuracy and performance | 28-02 |
| Segment filtering via BUSINESS category | Cross-category filtering without Member schema changes | 28-02 |
| 3-sigma outlier detection | Flag values > 3 stddev from median as potential outliers | 28-02 |

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
- [x] Write zero-downtime migration scripts (Plan 02)
- [x] Create points trigger and verify schema (Plan 03)
- [x] Apply migrations to database
- [x] Create PointConfig model and admin API (Plan 27-01)
- [x] Build point transaction service (Plan 27-02)
- [x] Create public points API endpoints (Plan 27-03)
- [x] Create benchmark types and schemas (Plan 28-01)
- [x] Build benchmark service layer (Plan 28-02)
- [ ] Create benchmark API endpoints (Plan 28-03)

### Known Blockers

None - Plan 28-02 complete, ready for 28-03.

### Questions for User

1. Should all 4 benchmark categories (compensation, infrastructure, business, operational) launch in v2.0, or can MVP start with 2?
2. Is MEE6 integration essential for v2.0, or can it defer to v2.1?
3. Should resource library support member-contributed content in v2.0, or strictly admin-curated?

---

## Session Continuity

**Last session:** 2026-01-23
- Completed Plan 28-02: Benchmark Service Layer
- Created src/benchmarks/service.ts with 424 lines
- Implemented submitBenchmark, getMySubmissions, getAggregates, detectOutliers
- Added segment filtering with cross-category BUSINESS matching
- Commit: 43525fa

**Next session:** Plan 28-03 - Benchmark API
- Create Express routes for benchmark submission and retrieval
- Mount routes on /api/benchmarks with member auth

**Context preserved:**
- v1.0 patterns (webhook idempotency, audit logging, fire-and-forget Discord ops)
- Research findings (stack choices, architecture patterns, critical pitfalls)
- Phase dependencies (backend -> frontend, points system -> gamification)
- Migration files at: prisma/migrations/0_init/ through 20260123044437_add_point_config/
- Point system files at: src/points/types.ts, src/points/config.ts, src/points/service.ts
- Points API at: src/routes/points.ts, src/routes/admin/points.ts
- Admin config API at: src/routes/admin/points-config.ts
- Benchmark types at: src/benchmarks/types.ts, src/benchmarks/schemas.ts
- Benchmark service at: src/benchmarks/service.ts

---

*State initialized: 2026-01-22*
*Last updated: 2026-01-23 - Completed 28-02-PLAN.md*
