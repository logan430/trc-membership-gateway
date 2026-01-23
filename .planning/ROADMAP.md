# Roadmap: v2.0 Community Intelligence Platform

**Project:** The Revenue Council - Discord Membership Gateway
**Milestone:** v2.0 Community Intelligence Platform
**Created:** 2026-01-22
**Depth:** Standard (8 phases derived from requirements)

## Overview

Transform The Revenue Council from access gateway to intelligence platform by adding anonymous peer benchmarking, curated resource library, and gamification system. Admins gain actionable industry data while members benefit from peer insights and increased engagement. This roadmap covers 101 requirements across 8 phases, building on the production-ready v1.0 system (shipped Phase 1-25) with zero-downtime migrations and proven patterns.

**Core strategy:** Extend Express + Prisma + Discord.js v1.0 backend with React-based member dashboard. Backend APIs build first (Phases 26-30), then Next.js frontend (Phases 31-32), then admin analytics (Phase 33). Database schema extensions establish zero-downtime migration patterns all phases follow.

---

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

**Success Criteria:**
1. Background job syncs MEE6 XP data every 15 minutes via node-cron
2. XP delta calculated (current XP - last recorded XP) and points awarded at 1 point per 100 XP
3. Historical XP backfilled for existing members on first sync (prevents losing past activity)
4. Streak calculation runs daily at 00:05 UTC (consecutive days with point-earning actions)
5. All background jobs log errors to Sentry and shut down gracefully on SIGTERM

---

## Phase 31: Next.js Frontend Setup

**Goal:** React-based member dashboard foundation with shared authentication.

**Dependencies:** Phase 26 (schema complete), Phases 27-30 (backend APIs ready)

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04

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

**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11, UI-12, UI-13, UI-14, GAME-09, GAME-10, GAME-11, GAME-12, GAME-13, GAME-14, GAME-15

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

**Success Criteria:**
1. Admin sees member overview dashboard (total members, active, inactive counts, MRR)
2. Admin sees engagement metrics with time-series charts (benchmark submissions, resource downloads, Discord activity)
3. Admin sees benchmark submission rate by category and resource download analytics (most popular, trending)
4. Admin sees industry insights dashboard showing aggregate benchmark patterns by segment
5. Admin can export data for CRM sync (CSV or JSON), view cohort retention analysis, and see churn prediction alerts based on engagement scoring

---

## Progress

| Phase | Status | Plans | Complete |
|-------|--------|-------|----------|
| 26 - Database Schema Extension | Complete | 3 | 10/10 requirements |
| 27 - Points System Backend | Complete | 3 | 8/8 requirements |
| 28 - Benchmarking System | Pending | 0 | 0/15 requirements |
| 29 - Resource Library & File Storage | Pending | 0 | 0/22 requirements |
| 30 - MEE6 Discord Integration | Pending | 0 | 0/11 requirements |
| 31 - Next.js Frontend Setup | Pending | 0 | 0/4 requirements |
| 32 - Member Dashboard Pages | Pending | 0 | 0/21 requirements |
| 33 - Admin Analytics Dashboard | Pending | 0 | 0/10 requirements |

**Overall Progress:** 18/101 requirements (18%)

---

*Roadmap created: 2026-01-22*
*Last updated: 2026-01-23 (Phase 27 complete)*
