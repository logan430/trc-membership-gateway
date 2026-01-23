# Project Research Summary

**Project:** The Revenue Council - v2.0 Community Intelligence Platform
**Domain:** Professional membership community with peer benchmarking, resource library, and gamification
**Researched:** 2026-01-22
**Confidence:** HIGH

## Executive Summary

The v2.0 milestone transforms The Revenue Council from a Discord membership gateway into a community intelligence platform. Research reveals a clear path forward: extend the production-hardened Express + Prisma + Discord.js v1.0 infrastructure with React-based member features while preserving existing admin systems. The recommended architecture uses Next.js 15.1 standalone (port 3000) proxied through Express (port 4000), enabling modern member UX without disrupting proven backend patterns.

The technology foundation is solid: React 19.2 + Next.js 15.1 for the member dashboard, Recharts 3.7 for benchmark visualizations (already implemented in Chris's reference app), PostgreSQL JSONB for flexible benchmark schemas, Supabase Storage for file management (already in infrastructure), and MEE6 API integration for Discord activity tracking ($11.95/mo). This stack leverages $10K-15K of existing React components from Chris's app while maintaining the stability of the v1.0 production system.

The critical risk is production database migration downtime. With paying customers actively using v1.0, schema extensions must use zero-downtime patterns: additive-only migrations, concurrent index creation, and expand-contract deployment. Feature-specific risks include k-anonymity enforcement (5-response minimum for benchmark privacy), MEE6 API rate limits (unofficial API), and file upload security (magic number validation required). These risks are manageable with proper phase sequencing and implementation patterns documented in research.

## Key Findings

### Recommended Stack

The v2.0 stack builds on v1.0's Express 5.2 + Prisma 7 + Supabase foundation with strategic additions for community intelligence features. React 19.2 and Next.js 15.1 provide a modern member dashboard while preserving the existing HTML/vanilla JS admin panel. This hybrid approach reuses production-tested backend infrastructure while delivering component-based UX where it matters most.

**Core technologies:**
- **React 19.2 + Next.js 15.1**: Member dashboard UI with server components and Actions API — already implemented in Chris's reference app, ready to port vs. rebuild
- **Recharts 3.7**: Data visualization for benchmarks — Chris's app has ComparisonBar, PerformanceRadar, and ScoreRing components built and tested
- **Tailwind CSS v4**: Styling with 5x faster builds — released Jan 22, 2025, first-party Vite plugin, zero config
- **PostgreSQL JSONB + GIN indexes**: Flexible benchmark schemas — each category has different fields, JSONB avoids rigid schema while maintaining query performance
- **Supabase Storage**: File upload/download with signed URLs — already in infrastructure, integrates with existing Supabase database
- **MEE6 API**: Discord XP tracking at $11.95/mo — cheaper than building custom activity tracking, Chris has sync code implemented
- **node-cron**: Background jobs for XP sync (15 min), leaderboard refresh (5 min), streak checks (daily) — already in v1.0, sufficient for current scale

**Total incremental cost:** $11.95/mo for MEE6 Premium (everything else is open source or existing infrastructure)

### Expected Features

Research identified four feature clusters with clear table stakes, differentiators, and boundaries. Privacy-first benchmarking (k-anonymity with 5-response minimum) is now table stakes in 2026, not a differentiator. The differentiator is tying benchmarks to verified Discord identity and surfacing community-driven insights.

**Must have (table stakes):**
- **Anonymous benchmark submission** with k-anonymity threshold (5 responses minimum before showing aggregates)
- **Comparison visualizations** showing "you vs. peers" with percentile positioning
- **Resource library** with hierarchical taxonomy, faceted filtering, and download tracking
- **Points system** with transparent values (+50 benchmark, +5 download, +1 per 100 Discord XP)
- **Leaderboard** showing top 25 + current user rank with opt-out privacy
- **Admin analytics** for member overview, engagement metrics, and content performance

**Should have (competitive):**
- **Discord-linked benchmarks** creating trust layer ("these are real entrepreneurs, not bots")
- **Benchmark submission streaks** rewarding quarterly updates to keep data fresh
- **Industry pattern insights** where admin curates findings like "70% of $1M+ companies use this tool"
- **Segmented leaderboards** with monthly resets (newcomers compete) + all-time hall of fame
- **Contextual resource recommendations** based on member benchmark data and profile
- **Engagement scoring** combining benchmark submissions + downloads + Discord activity for churn prediction

**Defer (v2+):**
- **Member-contributed resources** (high moderation burden, requires approval workflow)
- **Learning paths** (requires mature content library first)
- **Team challenges** (small percentage have team subscriptions)
- **Benchmark discussion threads** (complex moderation, privacy concerns)

**Feature dependencies:** Benchmarking, resources, and basic gamification can build in parallel (Tier 1). Visualizations, integrations, and leaderboards depend on Tier 1 data (Tier 2). Admin analytics and predictive insights require historical data from Tier 1+2 (Tier 3).

### Architecture Approach

The recommended architecture extends the existing Express + Prisma + Discord.js v1.0 system with a Next.js standalone frontend, maintaining a single domain and shared authentication while isolating member UI from admin operations. Express (port 4000) proxies /dashboard/* routes to Next.js (port 3000), enabling independent frontend deployment without disrupting production backend.

**Major components:**
1. **Express API Server** — Continues handling authentication (JWT tokens), business logic, Stripe webhooks, Discord bot coordination, and admin operations. New routes for /api/benchmarks/*, /api/resources/*, /api/points/* consume existing middleware (requireAuth, requireAdmin) and Prisma client. Fire-and-forget Discord operations with p-retry preserve existing patterns.

2. **Next.js Frontend** — New standalone app at /frontend rendering member-facing UI (/dashboard, /benchmarks, /resources, /leaderboard, /profile, /account, /billing). Uses React Server Components for data fetching, Client Components for forms, and Recharts for visualization. Authenticates via shared httpOnly cookies forwarded through Express proxy. Tailwind CSS with custom theme (less minimalist than Chris's app: 8px border-radius, shadows, colors).

3. **Prisma ORM Extensions** — Additive schema changes add 5 new models (BenchmarkSubmission with JSONB data column, Resource, ResourceDownload, PointTransaction immutable ledger, DiscordActivity). Member model extends with totalPoints (denormalized for fast leaderboard queries), currentStreak, lastActiveAt. Database triggers auto-update totalPoints on PointTransaction INSERT for real-time leaderboard without N+1 queries.

4. **Supabase Storage** — File upload/download with signed URLs (1-hour expiration). Client-side direct upload bypasses Express body limits. Server-side magic number validation (file-type library) prevents extension spoofing. RLS policies control access. Tracks downloads in ResourceDownload table and awards points (+5 per download).

5. **Background Jobs (node-cron)** — New cron jobs: MEE6 XP sync every 15 min (polls MEE6 API, calculates XP delta, awards points at 1 per 100 XP), leaderboard refresh every 5 min (denormalized cache), daily streak check at 00:05 UTC (consecutive activity tracking). Shared Prisma client with Express, Sentry error tracking, graceful shutdown on SIGTERM.

6. **Discord Bot Extensions** — Existing discord.js bot adds point awards for intro completion (+25 points), role updates based on point milestones (e.g., "Top Contributor" at 500+ points). Fire-and-forget pattern with p-retry (3 attempts) preserves existing reliability patterns.

**Key patterns:** Denormalized points with immutable ledger (fast reads, audit trail), signed URLs for file access (bypass Express, leverage Supabase CDN), Express proxy to Next.js (single domain, shared auth), JSONB for flexible benchmark schemas (GIN index with jsonb_path_ops for 600% faster queries).

### Critical Pitfalls

Research identified one fully-documented critical pitfall, with gaps indicating incomplete pitfall coverage. This gap should be addressed during phase-specific planning.

1. **Production database migration downtime** — Running ALTER TABLE or CREATE INDEX on production tables can cause hours of downtime. Avoid with: additive-only migrations (never drop columns), CREATE INDEX CONCURRENTLY in production, foreign keys added with NOT VALID then VALIDATE separately, expand-contract pattern (add new, migrate data, remove old), test on production-sized staging data, prepare rollback scripts. Warning signs: migration runs >10 seconds in dev, tables >100K rows, adding non-nullable columns without defaults. Address in Phase 1 (Database Schema Extension) to establish patterns all phases follow.

**Gap:** PITFALLS.md only documented 1 of expected 5-7 critical pitfalls. Additional pitfalls likely exist around:
- MEE6 API integration (unofficial API, rate limits, auth)
- K-anonymity enforcement (privacy violations if < 5 responses exposed)
- File upload security (malware, XSS via file execution, DOS via large files)
- Points system gaming (duplicate submissions, script abuse)
- Leaderboard performance (slow queries on large member base)
- Discord rate limiting (bulk operations hitting 50 req/sec limit)

These gaps should be researched during relevant phase planning (e.g., Phase 3: Benchmarking System, Phase 4: Resource Library, Phase 5: Gamification).

## Implications for Roadmap

Based on research, the recommended phase structure follows feature dependencies (Tier 1 → Tier 2 → Tier 3), avoids production system risks, and frontloads integration complexity. The architecture research suggests an 8-phase approach over 16-18 weeks (conservative estimate for solo developer).

### Phase 1: Database Schema Extension
**Rationale:** Foundation for all features. Must establish zero-downtime migration patterns that subsequent phases follow. Additive-only, no destructive changes.

**Delivers:** 5 new Prisma models (BenchmarkSubmission, Resource, ResourceDownload, PointTransaction, DiscordActivity), extended Member model with gamification fields (totalPoints, currentStreak, lastActiveAt), indexes on foreign keys and query columns, database triggers for denormalized points, seed scripts with test data.

**Addresses:** Production migration downtime pitfall (establish concurrent index creation, NOT VALID foreign keys, expand-contract patterns).

**Avoids:** Table locks, production downtime, rollback disasters.

**Research flag:** Standard Prisma patterns, well-documented. Skip phase-specific research unless exotic queries discovered.

---

### Phase 2: Points System Backend
**Rationale:** Points system is dependency for gamification features (leaderboard, streaks, badges). Build business logic before frontend consuming it.

**Delivers:** awardPoints() function with transaction support, Express routes (/api/points/award internal, /api/points/history, /api/points/leaderboard), leaderboard query with ranking (ORDER BY totalPoints DESC with index), point award triggers (intro completion, benchmark submission placeholders), audit logging for admin point adjustments.

**Uses:** PointTransaction model with immutable ledger pattern, denormalized Member.totalPoints updated via transaction, database trigger auto-calculates totals.

**Implements:** Pattern 1 from ARCHITECTURE.md (denormalized points with immutable ledger).

**Research flag:** Standard pattern, skip research. Performance testing with 100 mock users needed during implementation.

---

### Phase 3: Benchmarking System
**Rationale:** Core value proposition of v2.0. Delivers "submit benchmarks, get insights" immediately. Generates data that feeds admin analytics (Phase 7).

**Delivers:** Express routes (/api/benchmarks/submit, /api/benchmarks/results), JSONB validation schemas for 4 categories (compensation, infrastructure, business, operational), aggregation queries (median, average, percentiles using PostgreSQL JSON functions), 5-response minimum enforcement for k-anonymity, outlier detection (3σ flagging), admin review queue in HTML, point awards on submission (+50).

**Addresses:** Anonymous benchmark submission, k-anonymity threshold, real-time updates (table stakes from FEATURES.md).

**Avoids:** Privacy violations (< 5 responses never shown), garbage data (outlier flagging + admin review), rigid schema (JSONB flexibility).

**Research flag:** NEEDS RESEARCH — K-anonymity edge cases (filter combinations with < 5 results), outlier detection thresholds (3σ sufficient?), JSONB query performance at scale (10K+ submissions), aggregation algorithm selection (median vs. percentile calculation trade-offs).

---

### Phase 4: Resource Library & File Storage
**Rationale:** Second core feature, independent of benchmarking. Builds on Supabase Storage already in infrastructure. Generates download events for gamification.

**Delivers:** Supabase Storage bucket configuration (resources), Express routes (/api/resources/upload-url, /api/resources CRUD, /api/resources/:id/download), signed URL generation (1-hour expiration for upload and download), file type validation (magic number checking with file-type library for PDF, DOCX, XLSX, MP4, ZIP), ResourceDownload tracking, point awards on download (+5), admin resource management UI (HTML extension).

**Uses:** Supabase Storage with signed URLs (Pattern 2 from ARCHITECTURE.md), server-side validation for security.

**Addresses:** File upload & storage, access control by role, download tracking, preview before download (table stakes from FEATURES.md).

**Avoids:** Proxying files through Express (performance), extension spoofing (magic number validation), unauthorized access (signed URLs).

**Research flag:** NEEDS RESEARCH — File virus scanning options (ClamAV self-hosted vs. cloud service cost/performance), file size limits (100MB sufficient?), RLS policy design for role-based access, thumbnail generation for videos/PDFs.

---

### Phase 5: Background Jobs (MEE6 Sync)
**Rationale:** Depends on Points System (Phase 2). Enables Discord activity integration. Must test with production Discord server (100+ members).

**Delivers:** MEE6 XP sync job (15-min cron), MEE6 API client wrapper, Discord activity tracking (DiscordActivity records), XP delta calculation (compare to Member.lastMEE6XP), point awards (1 per 100 XP), streak calculation (daily cron at 00:05 UTC checks consecutive days), leaderboard refresh job (5-min cron, optional cache optimization), integration with existing billing scheduler.

**Uses:** node-cron (already in v1.0), shared Prisma client, p-retry for resilience.

**Addresses:** Discord XP integration (differentiator from FEATURES.md).

**Avoids:** MEE6 API rate limits (15-min polling vs. real-time), point gaming (XP delta prevents duplicate awards), Discord bot complexity (MEE6 handles activity logic).

**Research flag:** NEEDS RESEARCH — MEE6 API rate limits (unofficial API, unclear documentation), MEE6 API authentication flow (Premium required?), error handling strategies (API downtime, guild inaccessible), backfill strategy (members with historical XP).

---

### Phase 6: Next.js Frontend Setup
**Rationale:** Backend APIs ready (Phases 2-5). Establishes frontend foundation all pages build on. Port Chris's component library before building pages.

**Delivers:** Next.js 15.1 app in /frontend directory, Express proxy for /dashboard/* (http-proxy-middleware with WebSocket support for HMR), shared authentication (cookie forwarding, JWT validation in Next.js middleware), dependencies installed (Recharts, Tailwind CSS v4, shadcn/ui if needed), Chris's component library ported (Button, Card, Input, Form, ComparisonBar, PerformanceRadar, ScoreRing), CSS theme customization (less minimalist: 8px border-radius, shadows, color palette), layout with navigation.

**Uses:** React 19.2 + Next.js 15.1 (stable releases), Tailwind CSS v4 (released Jan 22, 2025), Recharts 3.7.

**Implements:** Pattern 3 from ARCHITECTURE.md (Express proxy to Next.js).

**Avoids:** CORS complexity (single domain), authentication duplication (shared cookies), full v1.0 migration (incremental approach).

**Research flag:** Standard Next.js patterns, skip research. Component porting may reveal CSS adjustments needed.

---

### Phase 7: Frontend Pages (Member Dashboard)
**Rationale:** Depends on Phase 6 (Next.js setup) and Phases 2-5 (backend APIs). Largest frontend effort, includes all member-facing UI.

**Delivers:** 9 Next.js pages (app/dashboard overview, app/benchmarks submit, app/benchmarks/results charts, app/resources list, app/resources/[id] detail, app/leaderboard rankings, app/profile history, app/account email/password, app/billing subscription/invoices), form validation with Zod schemas, data fetching with React Server Components, Recharts visualizations (ComparisonBar for benchmark comparisons, PerformanceRadar for multi-axis metrics), responsive mobile layouts, loading states, error handling.

**Addresses:** Comparison visualization, filter by segment, resource browser, leaderboard, profile display (table stakes + differentiators from FEATURES.md).

**Uses:** Recharts components from Chris's app, React Server Components for data, Client Components for interactivity.

**Avoids:** Vanilla JS for complex forms (React shines here), client-side only rendering (SEO, performance).

**Research flag:** Standard React patterns, skip research. Design iteration may extend timeline if UX testing reveals issues.

---

### Phase 8: Admin Analytics Dashboard
**Rationale:** Depends on Phases 3-5 (data generation). Delivers admin value from community intelligence. Can iterate post-launch based on admin feedback.

**Delivers:** Admin analytics pages (HTML extensions to /admin), member overview dashboard (total members, active, churn, MRR), engagement metrics (time-series charts for benchmarks, downloads, Discord activity), content performance (most downloaded resources, most viewed benchmarks), outlier review queue (benchmark submissions flagged by 3σ detection), cohort analysis (retention tracking by join month), engagement scoring (per-member composite score for churn prediction).

**Addresses:** Admin analytics, industry pattern insights, outlier review queue (table stakes + differentiators from FEATURES.md).

**Uses:** Existing admin HTML/vanilla JS pattern (consistency with v1.0), aggregation queries on time-series tables.

**Avoids:** 50+ metrics dashboard (cognitive overload), vanity metrics (total messages vs. actionable engagement score).

**Research flag:** NEEDS RESEARCH — Cohort analysis query patterns (PostgreSQL window functions?), predictive churn modeling (ML vs. rule-based thresholds), dashboard query performance (caching strategy, materialized views).

---

### Phase Ordering Rationale

**Dependency-driven sequencing:** Database schema (Phase 1) must come first as foundation. Points system (Phase 2) precedes gamification consumers (Phases 5, 7). Backend APIs (Phases 2-5) complete before frontend (Phases 6-7). Admin analytics (Phase 8) last as it consumes data from earlier phases.

**Risk frontloading:** Production migration patterns established in Phase 1 prevent downtime in subsequent phases. MEE6 integration (Phase 5) tested mid-roadmap, leaving time to build fallback if API proves unreliable. Admin analytics deferred to Phase 8 as it's non-critical for member experience (can iterate post-launch).

**Parallel work opportunities:** Phases 3 (Benchmarking) and 4 (Resources) are independent, can develop in parallel if team grows. Frontend (Phases 6-7) can start while backend (Phases 2-5) in testing if strict API contracts defined.

**Pitfall avoidance:** Zero-downtime migrations (Phase 1) prevent production outages. Backend-first approach (Phases 2-5 before 6-7) avoids frontend building against unstable APIs. Additive-only schema prevents rollback complexity.

### Research Flags

Phases needing deeper research during planning:

- **Phase 3 (Benchmarking System):** K-anonymity edge cases, JSONB query performance, aggregation algorithms, outlier detection thresholds, privacy enforcement across filter combinations
- **Phase 4 (Resource Library):** File virus scanning options, RLS policy design, thumbnail generation, file size limit testing
- **Phase 5 (Background Jobs - MEE6):** MEE6 API rate limits, authentication flow, error handling, backfill strategy for historical XP
- **Phase 8 (Admin Analytics):** Cohort analysis query patterns, predictive churn modeling approach, dashboard caching strategy

Phases with standard patterns (skip research-phase):

- **Phase 1 (Database Schema):** Standard Prisma migrations, PostgreSQL patterns well-documented
- **Phase 2 (Points System):** Standard denormalized aggregate pattern, established in architecture research
- **Phase 6 (Next.js Setup):** Standard Next.js + Express proxy, documented in STACK.md and ARCHITECTURE.md
- **Phase 7 (Frontend Pages):** Standard React patterns, Recharts documented, form validation with Zod established

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official React 19.2 and Next.js 15.1 releases verified (Dec 2024/Jan 2025), Tailwind CSS v4 released Jan 22, 2025. All technologies have current 2026 documentation. Chris's reference app provides proven implementation patterns. |
| Features | MEDIUM | WebSearch verification with multiple sources for benchmarking (BenchSights, ChartMogul), gamification (BuddyBoss, Discord agencies), and resource libraries. K-anonymity threshold (5 responses) is industry standard. Some feature prioritization assumptions based on pattern synthesis vs. direct TRC member research. |
| Architecture | HIGH | Express + Prisma + Discord.js v1.0 codebase provides proven patterns (webhook idempotency, audit logging, fire-and-forget Discord ops). Next.js proxy pattern industry-standard BFF approach. Denormalized points pattern verified superior to materialized views for this read/write pattern. Supabase Storage integration well-documented. |
| Pitfalls | LOW | Only 1 critical pitfall fully documented (production migration downtime) out of expected 5-7. MEE6 integration risks, k-anonymity violations, file security, and points gaming not researched. Gap analysis needed during phase planning. |

**Overall confidence:** MEDIUM-HIGH

The technology stack and architecture approach are well-researched with verified 2026 sources. Feature landscape synthesis is solid but makes assumptions about TRC member priorities. Critical weakness is incomplete pitfall coverage — only database migration risks documented, leaving security, integration, and performance pitfalls for phase-specific research.

### Gaps to Address

**Pitfall research incomplete:** PITFALLS.md documented 1 of ~7 expected critical pitfalls. Address during phase planning:
- **Phase 3:** K-anonymity violations (< 5 response edge cases), benchmark data privacy, JSONB performance cliffs
- **Phase 4:** File upload security (malware, XSS, DOS), virus scanning strategy, signed URL security
- **Phase 5:** MEE6 API reliability, rate limiting, unofficial API deprecation risk, point gaming prevention
- **Phase 7:** Frontend performance (large datasets, chart rendering), mobile UX validation
- **Phase 8:** Dashboard query performance, admin data privacy, SQL injection in dynamic queries

**Stack version verification needed:** MEE6 pricing ($11.95/mo) based on early 2025 sources. Verify current pricing before Phase 5. MEE6 API documentation is unofficial — verify endpoints still functional during Phase 5 research.

**Feature prioritization assumptions:** Research synthesized features from general benchmarking/gamification patterns. Validate with TRC stakeholder (Chris or community feedback) during roadmap review:
- Are all 4 benchmark categories (compensation, infrastructure, business, operational) required for MVP, or can MVP launch with 2?
- Is Discord XP integration (MEE6) essential for v2.0, or can it defer to v2.1?
- Should resource library support member-contributed content in v2.0, or strictly admin-curated?

**Chris's reference app unknown state:** STACK.md and ARCHITECTURE.md assume Chris's React components are production-ready for porting. Verify during Phase 6: Are components TypeScript (vs. JavaScript)? Do they use React 19 features (vs. 18 with compatibility shim)? Is Tailwind config portable? Budget 1-2 weeks for component refactoring if assumptions incorrect.

**Admin analytics scope creep risk:** Phase 8 (Admin Analytics) has broad scope (member overview, engagement metrics, content performance, cohort analysis, churn prediction). Risk of timeline overrun. Consider splitting into Phase 8a (basic dashboards) and Phase 8b (advanced analytics) during roadmap finalization.

## Sources

### Primary (HIGH confidence)

**Stack Research:**
- [React v19 Release](https://react.dev/blog/2024/12/05/react-19) — Official release notes, stable features
- [React 19.2 Release](https://react.dev/blog/2025/10/01/react-19-2) — Latest version verification
- [Next.js 15 Release](https://nextjs.org/blog/next-15) — Server components, standalone mode
- [Next.js 15.1 Release](https://nextjs.org/blog/next-15-1) — Latest version verification
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) — Released Jan 22, 2025, performance improvements
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage/uploads/standard-uploads) — Signed URLs, RLS policies
- [PostgreSQL JSONB Performance](https://www.metisdata.io/blog/how-to-avoid-performance-bottlenecks-when-using-jsonb-in-postgresql) — GIN index optimization
- [Recharts npm](https://www.npmjs.com/package/recharts) — Version 3.7.0, usage stats

**Architecture Research:**
- [Zero-Downtime Postgres Migrations](https://gocardless.com/blog/zero-downtime-postgres-migrations-the-hard-parts/) — GoCardless production patterns
- [Materialized Views vs. Denormalization](https://www.databricks.com/glossary/materialized-views) — Performance trade-offs
- [Next.js Proxy Architecture](https://vishal-vishal-gupta48.medium.com/building-a-secure-scalable-bff-backend-for-frontend-architecture-with-next-js-api-routes-cbc8c101bff0) — BFF pattern verification

### Secondary (MEDIUM confidence)

**Features Research:**
- [BenchSights SaaS Metrics](https://benchsights.com/saasmetrics/) — Benchmarking platform example
- [K-Anonymity Research (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2528029/) — 5-response threshold standard
- [Gamification Best Practices (BuddyBoss)](https://buddyboss.com/blog/gamification-for-learning-to-boost-engagement-with-points-badges-rewards/) — Points/badges/leaderboard patterns
- [Discord Gamification](https://www.discordstatistics.com/blog/using-levels-and-rewards-in-discord-to-boost-engagement) — XP integration strategies
- [Library Management Best Practices](https://research.com/software/best-library-management-software) — Resource taxonomy patterns
- [SaaS Dashboard Examples (Klipfolio)](https://www.klipfolio.com/resources/dashboard-examples/saas) — Admin analytics patterns

**Integration Research:**
- [MEE6 Premium Pricing](https://wiki.mee6.xyz/premium) — $11.95/mo (early 2025 source, verify current)
- [MEE6 Bot Features](https://botpenguin.com/blogs/top-features-of-mee6-discord-bot) — XP tracking capabilities

### Tertiary (LOW confidence)

**Pitfalls Research:**
- PITFALLS.md incomplete (1 of ~7 pitfalls documented) — Production migration downtime documented, other risks need research during phase planning

---
*Research completed: 2026-01-22*
*Ready for roadmap: yes*
