# Roadmap: v2.0 Community Intelligence Platform

**Project:** The Revenue Council - Discord Membership Gateway
**Milestone:** v2.0 Community Intelligence Platform
**Created:** 2026-01-22
**Depth:** Standard (8 phases derived from requirements)

## Overview

Transform The Revenue Council from access gateway to intelligence platform by adding anonymous peer benchmarking, curated resource library, and gamification system. Admins gain actionable industry data while members benefit from peer insights and increased engagement. This roadmap covers 101 requirements across 8 phases, building on the production-ready v1.0 system (shipped Phase 1-25) with zero-downtime migrations and proven patterns.

**Core strategy:** Extend Express + Prisma + Discord.js v1.0 backend with React-based member dashboard. Backend APIs build first (Phases 26-30), then Next.js frontend (Phases 31-32), then admin analytics (Phase 33). Database schema extensions establish zero-downtime migration patterns all phases follow.

---

<details>
<summary>v2.0 Community Intelligence Platform (Phases 26-33) - COMPLETE</summary>

## Phase 26: Database Schema Extension

**Goal:** Extend production database with new tables for v2.0 features using zero-downtime migrations.

**Dependencies:** None (builds on v1.0 schema)

**Requirements:** DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, DB-09, DB-10

**Plans:** 3 plans

Plans:
- [x] 26-01-PLAN.md — Define v2.0 schema and initialize migrations
- [x] 26-02-PLAN.md — Edit migrations for zero-downtime patterns
- [x] 26-03-PLAN.md — Create trigger, run migrations, verify schema

**Success Criteria:**
1. BenchmarkSubmission table stores flexible JSONB data for 4 benchmark categories (compensation, infrastructure, business, operational)
2. Resource and ResourceDownload tables track file metadata and download events
3. PointTransaction table maintains immutable ledger with Member.totalPoints denormalized aggregate updated via database trigger
4. DiscordActivity table records MEE6 XP sync history
5. All migrations run on production-sized staging database without table locks or downtime (concurrent indexes, NOT VALID foreign keys)

---

## Phase 27: Points System Backend

**Goal:** Members can earn and track points for community engagement actions.

**Dependencies:** Phase 26 (PointTransaction, Member.totalPoints schema)

**Requirements:** GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08

**Plans:** 3 plans

Plans:
- [x] 27-01-PLAN.md — Create PointConfig schema, config service with caching, admin API
- [x] 27-02-PLAN.md — Create idempotent points service layer, integrate intro points
- [x] 27-03-PLAN.md — Create member and admin points API endpoints

**Success Criteria:**
1. Member earns +50 points for benchmark submission, +5 for resource download, +1 per 100 Discord XP, +25 for introduction completion
2. Member can view point history showing all transactions with timestamps and reasons
3. Points cannot be awarded twice for same action (idempotency via transaction deduplication)
4. Admin can manually adjust member points with audit log entry
5. API endpoints return point values transparently to members (/api/points/history, /api/points/values)

---

## Phase 28: Benchmarking System

**Goal:** Members can submit anonymous benchmarks and view peer comparisons.

**Dependencies:** Phase 27 (points system for +50 benchmark submission award)

**Requirements:** BENCH-01, BENCH-02, BENCH-03, BENCH-04, BENCH-05, BENCH-06, BENCH-07, BENCH-08, BENCH-09, BENCH-10, BENCH-11, BENCH-12, BENCH-13, BENCH-14, BENCH-15

**Plans:** 3 plans

Plans:
- [x] 28-01-PLAN.md — Create benchmark types and Zod validation schemas
- [x] 28-02-PLAN.md — Create benchmark service layer with aggregates and outlier detection
- [x] 28-03-PLAN.md — Create member and admin benchmark API endpoints

**Success Criteria:**
1. Member can submit benchmarks in 4 categories with JSONB validation schemas (compensation, infrastructure, business metrics, operational)
2. Benchmark results hidden until 5+ submissions received in category (k-anonymity threshold)
3. Member sees comparison charts showing their data vs peer aggregates (median, percentiles) with segment filters (company size, industry, role)
4. Outlier detection flags submissions >3σ from median for admin review
5. Admin can approve or reject flagged submissions with audit trail (rejected excluded from aggregates but preserved)

---

## Phase 29: Resource Library & File Storage

**Goal:** Members can browse and download curated resources with secure file handling.

**Dependencies:** Phase 27 (points system for +5 download award)

**Requirements:** RES-01, RES-02, RES-03, RES-04, RES-05, RES-06, RES-07, RES-08, RES-09, RES-10, RES-11, RES-12, RES-13, RES-14, RES-15, SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07

**Plans:** 4 plans

Plans:
- [x] 29-01-PLAN.md — Schema migration and infrastructure setup (Supabase client, file validation)
- [x] 29-02-PLAN.md — Storage service layer (upload/download, rate limiting, types)
- [x] 29-03-PLAN.md — Resource service layer (CRUD, versioning, analytics, points integration)
- [x] 29-04-PLAN.md — API routes (admin management, member browse/download)

**Success Criteria:**
1. Admin can upload files (PDF, DOCX, XLSX, MP4, ZIP) with magic number validation and 100MB size limit
2. Files stored in Supabase Storage with signed URLs (1-hour expiration) and malware scanning before storage
3. Member can browse resources with faceted filtering (category, type, tags) and search
4. Member can preview resource details and download via signed URL (tracked in ResourceDownload table)
5. Admin sees resource analytics (total downloads, unique downloaders, trending) and can update metadata or replace files with version history

---

## Phase 30: MEE6 Discord Integration

**Goal:** Discord activity automatically earns points through MEE6 XP synchronization.

**Dependencies:** Phase 27 (points system for XP delta awards), Phase 26 (DiscordActivity table)

**Requirements:** DISCORD-01, DISCORD-02, DISCORD-03, DISCORD-04, DISCORD-05, DISCORD-06, JOBS-01, JOBS-02, JOBS-03, JOBS-04, JOBS-05

**Plans:** 3 plans

Plans:
- [x] 30-01-PLAN.md — Create MEE6 API client with types, Zod schemas, and env config
- [x] 30-02-PLAN.md — Create MEE6 sync job with XP delta calculation and points integration
- [x] 30-03-PLAN.md — Create streak calculator and job scheduler with graceful shutdown

**Success Criteria:**
1. Background job syncs MEE6 XP data every 15 minutes via node-cron
2. XP delta calculated (current XP - last recorded XP) and points awarded at 1 point per 100 XP
3. First sync creates baseline (no historical backfill points per CONTEXT.md decision)
4. Streak calculation runs daily at 00:05 UTC (consecutive weekdays with point-earning actions)
5. All background jobs log errors to Sentry and shut down gracefully on SIGTERM

---

## Phase 31: Next.js Frontend Setup

**Goal:** React-based member dashboard foundation with shared authentication.

**Dependencies:** Phase 26 (schema complete), Phases 27-30 (backend APIs ready)

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04

**Plans:** 5 plans

Plans:
- [x] 31-01-PLAN.md — Initialize Next.js 15 app with Tailwind v4 medieval theme
- [x] 31-02-PLAN.md — Add Express proxy middleware and update cookie configuration
- [x] 31-03-PLAN.md — Create Next.js auth middleware with JWT validation
- [x] 31-04-PLAN.md — Port and theme UI components (Button, Card, Input, GoldCoinsLoader)
- [x] 31-05-PLAN.md — Create dashboard shell layout with sidebar and overview page

**Success Criteria:**
1. Next.js 15.1 app runs at port 3000 with Express proxy forwarding /dashboard/* requests from port 4000
2. JWT tokens validate consistently in both Express middleware and Next.js middleware
3. httpOnly cookies forwarded correctly through proxy (member stays logged in across apps)
4. Member can access new React dashboard pages after logging in via existing v1.0 auth flow
5. Component library ported from Chris's Next.js app (Button, Card, Input, Form, ComparisonBar, PerformanceRadar, ScoreRing) with custom theme (8px border-radius, shadows, colors)

---

## Phase 32: Member Dashboard Pages

**Goal:** Members can access all v2.0 features through modern React UI.

**Dependencies:** Phase 31 (Next.js setup), Phases 27-30 (backend APIs)

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11, UI-12, UI-13, UI-14, GAME-09, GAME-10, GAME-11, GAME-12, GAME-13, GAME-14, GAME-15, BENCH-08, JOBS-03

**Plans:** 7 plans

Plans:
- [x] 32-01-PLAN.md — Overview API integration with React Query setup
- [x] 32-02-PLAN.md — Resources page with grid/list toggle and download modal
- [x] 32-03-PLAN.md — Benchmarks submission page with conversational wizard
- [x] 32-04-PLAN.md — Benchmarks results page with Recharts visualizations
- [x] 32-05-PLAN.md — Leaderboard page with pinned member row
- [x] 32-06-PLAN.md — Profile and account settings pages
- [x] 32-07-PLAN.md — Billing page and final navigation polish

**Success Criteria:**
1. Member dashboard overview shows points, streak, recent activity at /dashboard
2. Benchmark submission forms (/benchmarks) and results visualizations (/benchmarks/results) use Recharts for comparison charts
3. Resource library browser (/resources) with filtering, search, and detail pages with download tracking
4. Leaderboard (/leaderboard) shows top 25 members and current member's rank with opt-out privacy setting and monthly reset
5. Profile, account, and billing pages (/profile, /account, /billing) work on mobile with loading states, form validation, and helpful error messages

---

## Phase 33: Admin Analytics Dashboard

**Goal:** Admins can analyze member behavior and industry patterns for community decisions.

**Dependencies:** Phases 28-30 (data generation from benchmarks, downloads, Discord activity)

**Requirements:** ANALYTICS-01, ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, ANALYTICS-05, ANALYTICS-06, ANALYTICS-07, ANALYTICS-08, ANALYTICS-09, ANALYTICS-10

**Plans:** 3 plans

Plans:
- [x] 33-01-PLAN.md — Create analytics service layer with aggregation queries
- [x] 33-02-PLAN.md — Create admin analytics API and export functionality
- [x] 33-03-PLAN.md — Create admin analytics dashboard with React components

**Success Criteria:**
1. Admin sees member overview dashboard (total members, active, inactive counts, MRR)
2. Admin sees engagement metrics with time-series charts (benchmark submissions, resource downloads, Discord activity)
3. Admin sees benchmark submission rate by category and resource download analytics (most popular, trending)
4. Admin sees industry insights dashboard showing aggregate benchmark patterns by segment
5. Admin can export data for CRM sync (CSV or JSON), view cohort retention analysis, and see churn prediction alerts based on engagement scoring

</details>

---

<details>
<summary>v2.1 Frontend Consolidation (Phases 34-37) - COMPLETE</summary>

### Phase 34: Admin Pages Migration

**Goal:** Migrate admin pages from static HTML to unified Next.js dashboard with React components.

**Dependencies:** Phase 31 (Next.js setup), Phase 33 (admin analytics already in Next.js)

**Plans:** 4 plans

Plans:
- [x] 34-01-PLAN.md — Admin infrastructure (proxy, auth, layout)
- [x] 34-02-PLAN.md — Core admin pages (login, dashboard, members)
- [x] 34-03-PLAN.md — Config pages (flags, templates, audit, admins)
- [x] 34-04-PLAN.md — New feature UIs (resources, benchmarks, points config)

**Success Criteria:**
1. Express proxies /_next/* and /admin/* to Next.js
2. Admin auth via localStorage token with AdminAuthGuard
3. All admin pages migrated: login, dashboard, members, config, templates, audit, admins, resources, benchmarks, points-config
4. Template edit bug fixed (nested response handling)
5. Unified medieval pixel theme across admin UI

---

### Phase 35: Auth Pages Migration

**Goal:** Migrate auth pages (login, signup) to Next.js.

**Dependencies:** Phase 31 (Next.js setup)

**Plans:** 1 plan

Plans:
- [x] 35-01-PLAN.md — Auth pages migration to Next.js

---

### Phase 36: UI/UX Polish and Legal Compliance

**Goal:** Address critical UI/UX issues and legal requirements identified through comprehensive testing. Fix session persistence, consolidate routing, add legally-required pages, and improve auth form UX.

**Dependencies:** Phase 35 (Auth Pages), Phase 31 (Next.js setup)

**Plans:** 5 plans

Plans:
- [x] 36-01-PLAN.md — Legal Pages (Terms, Privacy)
- [x] 36-02-PLAN.md — Forgot Password Flow
- [x] 36-03-PLAN.md — Password UX Improvements
- [x] 36-04-PLAN.md — Visual Polish (Favicon, Branding)
- [x] 36-05-PLAN.md — Session & Routing Fixes

**Success Criteria:**
1. Login -> Dashboard flow works reliably without ERR_ABORTED
2. Session persists correctly across page navigation
3. Single, consistent login path (no confusion between multiple pages)
4. Terms and Privacy pages exist and are linked correctly
5. Users can recover forgotten passwords via email
6. Password fields have visibility toggles and strength indicators
7. No 404 console errors for standard assets (favicon)
8. Auth forms have consistent, polished appearance

---

### Phase 37: Admin Feature Pages

**Goal:** Enhance the 4 existing admin dashboard pages to match UX decisions from user discussion.

**Dependencies:** Phase 36 (UI/UX Polish)

**Plans:** 4 plans

Plans:
- [x] 37-01-PLAN.md — Points Config: Table layout with inline editing
- [x] 37-02-PLAN.md — Benchmarks Moderation: Table layout with bulk actions
- [x] 37-03-PLAN.md — Analytics Dashboard: Remove comparison display
- [x] 37-04-PLAN.md — Resources: Drag-drop upload and featured management

**Success Criteria:**
1. Points config page displays as table with click-to-edit and save indicator
2. Benchmarks page has checkbox selection and bulk approve/reject actions
3. Analytics page shows current period data without comparison percentages
4. Resources page has drag-drop upload and featured badges in list

</details>

---

## v2.2 Production Deployment & Launch

**Milestone Goal:** Deploy the complete membership gateway to Coolify, configure all external integrations with production URLs, validate end-to-end flows with real services, and prepare for public launch.

### Phase 38: Containerization

**Goal:** Create production-ready Docker images that work locally before deploying to Coolify.

**Dependencies:** Phase 37 (v2.1 complete)

**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-07

**Success Criteria:**
1. Express backend builds as multi-stage Alpine Docker image with non-root user
2. Next.js frontend builds with standalone output mode for minimal image size
3. docker-compose.yml defines both services on shared network with health checks
4. Both services respond to /health endpoint with 200 status
5. Express can reach Next.js via internal network (http://nextjs:3000) and proxy works

**Plans:** 3 plans

Plans:
- [x] 38-01-PLAN.md — Create backend Dockerfile and health endpoint
- [x] 38-02-PLAN.md — Create frontend Dockerfile with standalone output
- [x] 38-03-PLAN.md — Create docker-compose.yml and verify local stack

---

### Phase 39: Coolify Deployment

**Goal:** Application deployed to Coolify with SSL and custom domain.

**Dependencies:** Phase 38 (containers ready)

**Requirements:** INFRA-06, DOMAIN-01, DOMAIN-02, DOMAIN-03, DOMAIN-04, DOMAIN-05

**Success Criteria:**
1. Both containers build successfully on Coolify
2. DNS A record points domain to Coolify server IP
3. SSL certificate issued via Let's Encrypt (HTTPS works)
4. HTTP redirects to HTTPS automatically
5. Application accessible via https://[domain] with working health checks

**Plans:** TBD

Plans:
- [ ] 39-01: Create Coolify project and configure environment
- [ ] 39-02: Deploy and verify SSL/domain configuration

---

### Phase 40: Database Production Setup

**Goal:** Production database ready with schema and seed data.

**Dependencies:** Phase 39 (deployed to Coolify)

**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06

**Success Criteria:**
1. Supabase database accessible from Coolify containers
2. Prisma migrations run successfully against production database
3. Admin account seeded for dashboard access
4. Point configs seeded with correct values
5. Feature flags and email templates seeded and enabled

**Plans:** TBD

Plans:
- [ ] 40-01: Configure database connectivity and run migrations
- [ ] 40-02: Seed admin, configs, flags, and templates

---

### Phase 41: Stripe Integration

**Goal:** Stripe webhooks and checkout flows work with production URLs.

**Dependencies:** Phase 40 (database ready)

**Requirements:** STRIPE-01, STRIPE-02, STRIPE-03, STRIPE-04, STRIPE-05, STRIPE-06, STRIPE-07, STRIPE-08

**Success Criteria:**
1. Webhook endpoint URL configured in Stripe Dashboard with production domain
2. Webhook signature verification passes with production secret
3. checkout.session.completed webhook fires and creates member correctly
4. invoice.payment_succeeded and invoice.payment_failed webhooks update member status
5. Test mode checkout completes full flow (signup -> payment -> active member)

**Plans:** TBD

Plans:
- [ ] 41-01: Configure Stripe webhooks and verify signature handling
- [ ] 41-02: Test checkout and billing portal flows

---

### Phase 42: Discord Integration

**Goal:** Discord OAuth and bot role assignment work in production.

**Dependencies:** Phase 40 (database ready)

**Requirements:** DISCORD-01, DISCORD-02, DISCORD-03, DISCORD-04, DISCORD-05, DISCORD-06, DISCORD-07, DISCORD-08

**Success Criteria:**
1. Discord OAuth redirect URI updated in Developer Portal for production domain
2. OAuth flow completes successfully (member can link Discord account)
3. Discord bot connects and shows online in test server
4. Bot assigns Squire role when member links Discord
5. Introduction detection works and promotes member to Knight/Lord

**Plans:** TBD

Plans:
- [ ] 42-01: Configure Discord OAuth and test linking flow
- [ ] 42-02: Verify bot connection and role assignment

---

### Phase 43: End-to-End Verification & Go-Live

**Goal:** Full member lifecycle verified, production environment ready for real members.

**Dependencies:** Phase 41 (Stripe), Phase 42 (Discord)

**Requirements:** E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06, E2E-07, E2E-08, E2E-09, E2E-10, E2E-11, GOLIVE-01, GOLIVE-02, GOLIVE-03, GOLIVE-04, GOLIVE-05, GOLIVE-06, GOLIVE-07, GOLIVE-08, GOLIVE-09

**Success Criteria:**
1. Complete member journey works: signup -> checkout -> Discord link -> intro -> dashboard access
2. All dashboard features work: points, resources, benchmarks, leaderboard, billing
3. Admin dashboard works: login, member management, points adjustment, feature toggles
4. Database reset script clears test data while preserving admin and configs
5. Go-live checklist completed: production Discord, live Stripe mode, final verification

**Plans:** TBD

Plans:
- [ ] 43-01: Execute full member lifecycle test
- [ ] 43-02: Verify admin dashboard functionality
- [ ] 43-03: Create reset script and execute go-live checklist

---

## Progress

| Phase | Milestone | Status | Plans | Complete |
|-------|-----------|--------|-------|----------|
| 26 - Database Schema Extension | v2.0 | Complete | 3 | 10/10 requirements |
| 27 - Points System Backend | v2.0 | Complete | 3 | 8/8 requirements |
| 28 - Benchmarking System | v2.0 | Complete | 3 | 14/14 requirements |
| 29 - Resource Library & File Storage | v2.0 | Complete | 4 | 22/22 requirements |
| 30 - MEE6 Discord Integration | v2.0 | Complete | 3 | 10/11 requirements |
| 31 - Next.js Frontend Setup | v2.0 | Complete | 5 | 4/4 requirements |
| 32 - Member Dashboard Pages | v2.0 | Complete | 7 | 21/21 requirements |
| 33 - Admin Analytics Dashboard | v2.0 | Complete | 3 | 10/10 requirements |
| **v2.0 Total** | | **Complete** | **31** | **100%** |
| 34 - Admin Pages Migration | v2.1 | Complete | 4 | All admin pages |
| 35 - Auth Pages Migration | v2.1 | Complete | 1 | Auth pages migrated |
| 36 - UI/UX Polish & Legal | v2.1 | Complete | 5 | 8/8 success criteria |
| 37 - Admin Feature Pages | v2.1 | Complete | 4 | 4/4 success criteria |
| **v2.1 Total** | | **Complete** | **14** | **100%** |
| 38 - Containerization | v2.2 | Complete | 3 | 6/6 requirements |
| 39 - Coolify Deployment | v2.2 | Not started | 2 | 0/6 requirements |
| 40 - Database Production Setup | v2.2 | Not started | 2 | 0/6 requirements |
| 41 - Stripe Integration | v2.2 | Not started | 2 | 0/8 requirements |
| 42 - Discord Integration | v2.2 | Not started | 2 | 0/8 requirements |
| 43 - E2E Verification & Go-Live | v2.2 | Not started | 3 | 0/20 requirements |
| **v2.2 Total** | | **In Progress** | **14** | **21%** |

---

*Roadmap created: 2026-01-22*
*Last updated: 2026-01-28 (Phase 38 complete)*
