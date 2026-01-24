# Project State: The Revenue Council

**Updated:** 2026-01-24
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

**Current Phase:** 33 - Admin Analytics Dashboard
**Current Plan:** 1 of 3 complete
**Status:** In progress

**Phase Goal:**
Admin analytics dashboard with member overview, engagement metrics, benchmark insights, and churn prediction.

**Progress:**
```
Phase 26: [####################] 3/3 plans (Complete!)
Phase 27: [####################] 3/3 plans (Complete!)
Phase 28: [####################] 3/3 plans (Complete!)
Phase 29: [####################] 4/4 plans (Complete!)
Phase 30: [####################] 3/3 plans (Complete!)
Phase 31: [####################] 5/5 plans (Complete!)
Phase 32: [####################] 7/7 plans (Complete!)
Phase 33: [######              ] 1/3 plans (In progress)
v2.0:     [###################-] 29/31 plans
```

---

## Performance Metrics

**v2.0 Milestone:**
- Total phases: 8 (Phases 26-33)
- Total requirements: 101
- Completed: ~92 requirements (~91%) - Phases 26-32 + 33-01 complete
- In progress: Phase 33 (Admin Analytics)
- Blocked: 0

**Recent velocity:**
- v1.0 shipped: 25 phases, 60 plans, 114 commits (Oct 2025 - Jan 2026)
- v2.0 started: 2026-01-22
- Phase 26 completed: 2026-01-23 (3 plans, ~20 minutes total)
- Phase 27 completed: 2026-01-23 (3 plans, ~18 minutes total)
- Phase 28 completed: 2026-01-23 (3 plans, ~14 minutes total)
- Phase 29 completed: 2026-01-23 (4 plans, ~23 minutes total)
- Phase 30 completed: 2026-01-23 (3 plans, ~15 minutes total)
- Phase 31 completed: 2026-01-24 (5 plans, ~13 minutes total)
- Phase 32 completed: 2026-01-24 (7 plans, ~25 minutes total)

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
| MAX_VERSIONS_TO_KEEP = 5 | Version retention limit, auto-prune older versions | 29-03 |
| Featured-first sorting | Member listings sort featured DESC before createdAt DESC | 29-03 |
| Top 3 tags from last 10 downloads | Recommendations engine tag frequency calculation | 29-03 |
| Static routes before :id routes | Express route ordering for /analytics, /tags, /recommended | 29-04 |
| Metadata in JSON form field | Atomic upload with file + metadata in single multipart request | 29-04 |
| Download returns URL not stream | POST /download returns signed URL; client handles redirect | 29-04 |
| MEE6 401 as AbortError | Leaderboard not public is config issue, not transient | 30-01 |
| 2-second delay between page fetches | Conservative rate limiting for unofficial API | 30-01 |
| MEE6_SYNC_ENABLED default false | Master toggle off by default until explicitly enabled | 30-01 |
| First sync xpDelta = null | Distinguishes baseline from zero-change sync | 30-02 |
| Negative XP = proportional deduction | Admin XP removal deducts member points | 30-02 |
| lastActiveAt on positive points only | Deductions shouldn't count as member activity | 30-02 |
| Weekday-only streaks | Mon-Fri required, weekends automatic grace days | 30-03 |
| Jobs stop before HTTP in shutdown | Ensure jobs don't trigger work during connection teardown | 30-03 |
| Batch streak updates (100/tx) | Prevent memory issues with large member counts | 30-03 |
| Manual setup over create-next-app | Avoid unnecessary files and boilerplate | 31-01 |
| outputFileTracingRoot for monorepo | Resolves lockfile detection warning | 31-01 |
| @theme inline for Tailwind v4 | CSS-first theme variable registration | 31-01 |
| Hard-edge pixel shadows | No blur per CONTEXT.md medieval aesthetic | 31-01 |
| sameSite 'lax' for cross-app auth | Allows cookie on same-site navigation, prevents CSRF on POST | 31-02 |
| Cookie path '/' for cross-app access | Next.js middleware can read refresh token | 31-02 |
| Proxy enabled conditionally | Only when NEXT_APP_URL set or in development mode | 31-02 |
| verifyToken returns null on error | Consistent with Express, simplifies caller logic | 31-03 |
| x-member-id header injection | Server components access member ID without re-parsing token | 31-03 |
| credentials: include for API fetch | Cookie forwarding for all Express backend calls | 31-03 |
| Pixel shadows via arbitrary Tailwind | Consistent 3px offset, no blur, per CONTEXT.md | 31-04 |
| Barrel export pattern for UI | Clean imports via @/components/ui | 31-04 |
| Gold count hardcoded placeholder | Data from API integration in Phase 32 | 31-05 |
| Static activity items | Placeholders until Phase 32 API integration | 31-05 |
| QueryClient via useState | SSR safety - prevents server state leakage to client | 32-01 |
| currentStreak in points summary | Dashboard needs streak data; avoids separate API call | 32-01 |
| Cursor-based pagination for history | Matches backend API pattern for consistent UX | 32-01 |
| @tanstack/react-query for data fetching | Caching, mutation support, consistent patterns | 32-02 |
| Modal overlay for resource preview | Keeps browsing flow uninterrupted per CONTEXT.md | 32-02 |
| Debounced search (300ms) | Reduces API calls while user types | 32-02 |
| Question sets match backend schemas | Ensures submitted data validates against Zod schemas | 32-03 |
| zod@3 for forms over zod@4 | Better compatibility with react-hook-form resolvers | 32-03 |
| Conversational wizard flow | One question per screen per CONTEXT.md - feel like conversation | 32-03 |
| Horizontal bar chart for comparisons | Easy visual comparison, compact on mobile | 32-04 |
| Suspense for searchParams | Required to avoid hydration errors with client-side params in Next.js 15 | 32-04 |
| Monthly points via raw SQL | Prisma doesn't support conditional sums in groupBy | 32-05 |
| Privacy filter in both queries | Consistent leaderboardVisible enforcement for top 25 and rank | 32-05 |
| Profile uses dashboard API | Dashboard already returns member info - no extra call needed | 32-06 |
| Invoice amount already in dollars | Backend billing.ts divides by 100 before sending | 32-07 |
| View Results shows after submission | No point showing results link before submitting data | 32-07 |
| MRR placeholder $50/month | Placeholder until Stripe webhook caching implemented | 33-01 |
| Cohort retention limit 12 months | Reasonable historical view without excessive data | 33-01 |
| Multi-factor churn scoring | Inactivity (0-40) + engagement (0-30) + payment (0-30) | 33-01 |
| At-risk batch size 500 | Prevent memory issues with large member counts | 33-01 |

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
- node-cron for background job scheduling

**Architecture approach:**
- Express (port 4000) proxies /dashboard/* to Next.js (port 3000)
- Denormalized points with immutable ledger (fast reads, audit trail)
- Signed URLs for file access (bypass Express, leverage Supabase CDN)
- Zero-downtime migration patterns (concurrent indexes, NOT VALID FKs)
- Magic number validation prevents extension spoofing
- Optional malware scanning via ClamAV daemon
- Centralized job scheduler with graceful shutdown

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
- [x] Create resource service layer (Plan 29-03)
- [x] Create resource API endpoints (Plan 29-04)
- [x] Create MEE6 API client module (Plan 30-01)
- [x] Create job types for sync statistics (Plan 30-02)
- [x] Extend points service for negative XP deltas (Plan 30-02)
- [x] Create MEE6 XP sync function (Plan 30-02)
- [x] Create streak calculation function (Plan 30-03)
- [x] Create job scheduler with graceful shutdown (Plan 30-03)
- [x] Integrate jobs into main app (Plan 30-03)
- [x] Install React Query and create provider setup (Plan 32-01)
- [x] Create points hooks and connect overview page (Plan 32-01)
- [x] Create resources page with browser UI (Plan 32-02)
- [x] Create benchmarks page with submission forms (Plan 32-03)
- [x] Create benchmark results page with charts (Plan 32-04)
- [x] Create leaderboard page (Plan 32-05)
- [x] Create profile page (Plan 32-06)
- [x] Create account settings page (Plan 32-06)
- [x] Create billing page with subscription and invoices (Plan 32-07)
- [x] Update layout with real data from hooks (Plan 32-07)
- [x] Add View Results navigation on benchmarks page (Plan 32-07)
- [x] Create analytics type definitions (Plan 33-01)
- [x] Create member and engagement analytics services (Plan 33-01)
- [x] Create benchmark, resource, and churn analytics services (Plan 33-01)
- [ ] Create analytics API endpoints (Plan 33-02)
- [ ] Create admin analytics dashboard UI (Plan 33-03)

### Known Blockers

None - Phase 33 in progress.

### Questions for User

1. Should all 4 benchmark categories (compensation, infrastructure, business, operational) launch in v2.0, or can MVP start with 2?
2. Is MEE6 integration essential for v2.0, or can it defer to v2.1?
3. Should resource library support member-contributed content in v2.0, or strictly admin-curated?

---

## Session Continuity

**Last session:** 2026-01-24
- Completed Plan 33-01: Analytics Service Layer
- Created src/analytics/ with 6 service files
- Member overview, engagement trends, benchmark stats
- Resource analytics, cohort retention, churn prediction

**Next session:** Plan 33-02 (Analytics API Endpoints)
- Create admin routes at /api/admin/analytics/*
- Wire up service functions to HTTP endpoints
- Add date range parsing and export functionality

**Context preserved:**
- v1.0 patterns (webhook idempotency, audit logging, fire-and-forget Discord ops)
- Research findings (stack choices, architecture patterns, critical pitfalls)
- Phase dependencies (backend -> frontend, points system -> gamification)
- Migration files at: prisma/migrations/0_init/ through 20260124051950_add_leaderboard_visible/
- Point system files at: src/points/types.ts, src/points/config.ts, src/points/service.ts
- Points API at: src/routes/points.ts, src/routes/admin/points.ts
- Admin config API at: src/routes/admin/points-config.ts
- Benchmark types at: src/benchmarks/types.ts, src/benchmarks/schemas.ts
- Benchmark service at: src/benchmarks/service.ts
- Benchmark API at: src/routes/benchmarks.ts, src/routes/admin/benchmarks.ts
- Resource library infra at: src/lib/supabase.ts, src/lib/file-validation.ts
- Storage services at: src/storage/upload.ts, src/storage/download.ts, src/storage/malware-scan.ts
- Resource types at: src/resources/types.ts
- Resource service at: src/resources/service.ts
- Resource API at: src/routes/resources.ts, src/routes/admin/resources.ts
- MEE6 client at: src/mee6/types.ts, src/mee6/client.ts
- Job types at: src/jobs/types.ts
- MEE6 sync job at: src/jobs/mee6-sync.ts
- Streak calculator at: src/jobs/streak-calculator.ts
- Job scheduler at: src/jobs/index.ts
- Leaderboard API at: src/routes/leaderboard.ts
- Member settings API at: src/routes/member.ts
- Next.js app at: dashboard/package.json, dashboard/src/app/
- Tailwind theme at: dashboard/src/app/globals.css
- Auth lib at: dashboard/src/lib/auth.ts
- Auth middleware at: dashboard/src/middleware.ts
- API client at: dashboard/src/lib/api.ts
- Query configuration at: dashboard/src/lib/queries.ts
- Providers at: dashboard/src/app/providers.tsx
- Points hooks at: dashboard/src/hooks/usePoints.ts
- Benchmark hooks at: dashboard/src/hooks/useBenchmarks.ts
- Resource hooks at: dashboard/src/hooks/useResources.ts
- Leaderboard hooks at: dashboard/src/hooks/useLeaderboard.ts
- Profile hooks at: dashboard/src/hooks/useProfile.ts
- UI components at: dashboard/src/components/ui/ (Button, Card, Input, GoldCoinsLoader)
- Layout components at: dashboard/src/components/layout/ (Sidebar, Header)
- Benchmark components at: dashboard/src/components/benchmarks/ (CategoryCard, ConversationalWizard, ComparisonBar, MetricComparisonCard, KAnonymityGate)
- Resource components at: dashboard/src/components/resources/ (ResourceCard, ResourceListItem, ResourceFilters, ResourcePreviewModal)
- Leaderboard components at: dashboard/src/components/leaderboard/ (LeaderboardTable, RankBadge, PeriodTabs, ResetCountdown)
- Dashboard shell at: dashboard/src/app/dashboard/ (layout.tsx, page.tsx)
- Benchmarks page at: dashboard/src/app/dashboard/benchmarks/page.tsx
- Benchmark results at: dashboard/src/app/dashboard/benchmarks/results/page.tsx
- Resources page at: dashboard/src/app/dashboard/resources/page.tsx
- Leaderboard page at: dashboard/src/app/dashboard/leaderboard/page.tsx
- Profile page at: dashboard/src/app/dashboard/profile/page.tsx
- Account page at: dashboard/src/app/dashboard/account/page.tsx
- Billing hooks at: dashboard/src/hooks/useBilling.ts
- Billing page at: dashboard/src/app/dashboard/billing/page.tsx
- Analytics types at: src/analytics/types.ts
- Member analytics at: src/analytics/member-analytics.ts
- Engagement analytics at: src/analytics/engagement-analytics.ts
- Benchmark analytics at: src/analytics/benchmark-analytics.ts
- Resource analytics at: src/analytics/resource-analytics.ts
- Churn prediction at: src/analytics/churn-prediction.ts

---

*State initialized: 2026-01-22*
*Last updated: 2026-01-24 - Completed 33-01-PLAN.md (Analytics Service Layer)*
