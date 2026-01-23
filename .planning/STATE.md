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

**Current Phase:** 29 - Resource Library
**Current Plan:** 2 of 3 complete
**Status:** In progress

**Phase Goal:**
Build admin-curated file library with secure storage, file validation, and member download tracking.

**Progress:**
```
Phase 26: [####################] 3/3 plans (Complete!)
Phase 27: [####################] 3/3 plans (Complete!)
Phase 28: [####################] 3/3 plans (Complete!)
Phase 29: [##############......] 2/3 plans (In Progress)
v2.0:     [############........] 11/~16 plans
```

---

## Performance Metrics

**v2.0 Milestone:**
- Total phases: 8 (Phases 26-33)
- Total requirements: 101
- Completed: 40 requirements (~40%) - Phases 26-28 complete, 29-01, 29-02 complete
- In progress: Phase 29 (Resource Library)
- Blocked: 0

**Recent velocity:**
- v1.0 shipped: 25 phases, 60 plans, 114 commits (Oct 2025 - Jan 2026)
- v2.0 started: 2026-01-22
- Phase 26 completed: 2026-01-23 (3 plans, ~20 minutes total)
- Phase 27 completed: 2026-01-23 (3 plans, ~18 minutes total)
- Phase 28 completed: 2026-01-23 (3 plans, ~14 minutes total)
- Plan 29-01 completed: 2026-01-23 (7 minutes)
- Plan 29-02 completed: 2026-01-23 (8 minutes)

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
| Zod v4 record() requires two args | Use z.record(z.string(), z.unknown()) for flexible object | 28-03 |
| BENCH-08 moved to Phase 32 | Frontend visualization requires React components | 28 |
| Flat tags over categories | Removed ResourceCategory enum, using String[] tags with GIN index | 29-01 |
| storagePath replaces fileUrl | Storage path pattern for Supabase Storage integration | 29-01 |
| DOCX/XLSX detected as ZIP is valid | Office Open XML files are ZIP archives internally | 29-01 |
| Dynamic import for clamscan | Optional dependency via import() with type declaration | 29-02 |
| Fail-open on malware scan errors | Uploads proceed if scanner fails, can be changed to fail-closed | 29-02 |
| Admin ID rate limit keying | Rate limiter uses res.locals.admin.id after authentication | 29-02 |
| Storage path organization | uploads/{adminId}/{timestamp}-{sanitized-filename} pattern | 29-02 |

### Research Insights

**Stack validated:**
- React 19.2 + Next.js 15.1 (released Dec 2024/Jan 2025)
- Tailwind CSS v4 (released Jan 22, 2025 - 5x faster builds)
- Recharts 3.7 for benchmark visualizations (Chris's app has components)
- PostgreSQL JSONB + GIN indexes for flexible benchmark schemas
- Supabase Storage for file management (already in infrastructure)
- MEE6 API integration for Discord activity ($11.95/mo)
- @supabase/supabase-js for Storage client
- file-type library for magic number validation
- multer for multipart file uploads

**Architecture approach:**
- Express (port 4000) proxies /dashboard/* to Next.js (port 3000)
- Denormalized points with immutable ledger (fast reads, audit trail)
- Signed URLs for file access (bypass Express, leverage Supabase CDN)
- Zero-downtime migration patterns (concurrent indexes, NOT VALID FKs)
- Magic number validation prevents extension spoofing
- Optional malware scanning via ClamAV daemon

**Critical pitfalls identified:**
- Production database migration downtime (Phase 26 establishes patterns)
- K-anonymity violations (< 5 benchmark responses never shown)
- MEE6 API reliability (unofficial API, need error handling)
- File upload security (magic number validation, malware scanning)
- DOCX/XLSX detected as ZIP (handled in validation logic)

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
- [x] Create benchmark API endpoints (Plan 28-03)
- [x] Create resource library schema migration (Plan 29-01)
- [x] Add Supabase Storage client (Plan 29-01)
- [x] Create file validation service (Plan 29-01)
- [x] Build storage service layer (Plan 29-02)
- [ ] Create resource API endpoints (Plan 29-03)

### Known Blockers

None - Plan 29-02 complete, ready for Plan 29-03 (Resource API Endpoints).

### Questions for User

1. Should all 4 benchmark categories (compensation, infrastructure, business, operational) launch in v2.0, or can MVP start with 2?
2. Is MEE6 integration essential for v2.0, or can it defer to v2.1?
3. Should resource library support member-contributed content in v2.0, or strictly admin-curated?

---

## Session Continuity

**Last session:** 2026-01-23
- Completed Plan 29-02: Storage Service Layer
- Created src/storage/types.ts (MAX_FILE_SIZE, SIGNED_URL_EXPIRY, UploadResult, etc.)
- Created src/storage/upload.ts (uploadMiddleware, uploadToStorage)
- Created src/storage/download.ts (generateSignedUrl)
- Created src/storage/malware-scan.ts (scanForMalware, isMalwareScanEnabled)
- Created src/resources/types.ts (ResourceWithDetails, CreateResourceInput, filters)
- Added uploadLimiter to src/middleware/rate-limit.ts
- Installed multer and @types/multer
- Commits: 52953c1, a7adcf5, 8d52b45

**Next session:** Plan 29-03 - Resource API Endpoints
- Create admin CRUD routes for resources
- Create member browse/download routes
- Implement download tracking
- Wire up storage services to API layer

**Context preserved:**
- v1.0 patterns (webhook idempotency, audit logging, fire-and-forget Discord ops)
- Research findings (stack choices, architecture patterns, critical pitfalls)
- Phase dependencies (backend -> frontend, points system -> gamification)
- Migration files at: prisma/migrations/0_init/ through 20260123183355_resource_library_schema/
- Point system files at: src/points/types.ts, src/points/config.ts, src/points/service.ts
- Points API at: src/routes/points.ts, src/routes/admin/points.ts
- Admin config API at: src/routes/admin/points-config.ts
- Benchmark types at: src/benchmarks/types.ts, src/benchmarks/schemas.ts
- Benchmark service at: src/benchmarks/service.ts
- Benchmark API at: src/routes/benchmarks.ts, src/routes/admin/benchmarks.ts
- Resource library infra at: src/lib/supabase.ts, src/lib/file-validation.ts
- Storage services at: src/storage/upload.ts, src/storage/download.ts, src/storage/malware-scan.ts
- Resource types at: src/resources/types.ts

---

*State initialized: 2026-01-22*
*Last updated: 2026-01-23 - Completed 29-02-PLAN.md*
