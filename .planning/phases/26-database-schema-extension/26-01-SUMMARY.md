---
phase: 26-database-schema-extension
plan: 01
subsystem: database
tags: [prisma, postgresql, schema, migrations, v2.0]

dependency-graph:
  requires: []
  provides: [prisma-schema-v2, migration-infrastructure]
  affects: [26-02-PLAN, all-v2-features]

tech-stack:
  added: []
  patterns: [prisma-migrations, baseline-migration, create-only-workflow]

key-files:
  created:
    - prisma/migrations/0_init/migration.sql
    - prisma/migrations/20260123015816_add_v2_tables/migration.sql
    - prisma/migrations/migration_lock.toml
  modified:
    - prisma/schema.prisma

decisions:
  - id: baseline-approach
    choice: "Use prisma migrate diff to generate baseline from production, mark as applied"
    rationale: "Production database existed without migration history; baseline establishes sync point"
  - id: create-only-workflow
    choice: "Generate migration with --create-only, do not apply"
    rationale: "Allows manual editing for zero-downtime patterns (NOT VALID FKs, concurrent indexes) in Plan 02"

metrics:
  duration: "6 minutes"
  completed: "2026-01-23"
---

# Phase 26 Plan 01: Prisma Schema Extension Summary

**One-liner:** Extended Prisma schema with 4 enums, 5 models, Member gamification fields; generated v2.0 migration ready for zero-downtime editing.

## What Was Built

### Schema Extensions

**New Enums (4):**
- `BenchmarkCategory`: COMPENSATION, INFRASTRUCTURE, BUSINESS, OPERATIONAL
- `ResourceCategory`: COLD_EMAIL, SALES_GTM, CUSTOMER_SERVICE, OPERATIONS, AGENCY_GROWTH
- `ResourceType`: TEMPLATE, SOP, PLAYBOOK, COURSE, VIDEO
- `DiscordActivityType`: MESSAGE, REACTION_GIVEN, REACTION_RECEIVED

**Member Model Extensions:**
- `totalPoints` (Int, default 0) - Gamification point total
- `currentStreak` (Int, default 0) - Consecutive activity days
- `lastActiveAt` (DateTime?) - Last activity timestamp
- Descending index on `totalPoints` for leaderboard queries
- Relations to all 5 new v2.0 models

**New Models (5):**
1. `BenchmarkSubmission` - Industry benchmark data with JSONB flexible schema and GIN index
2. `Resource` - Resource library items with category/type classification
3. `ResourceDownload` - Member download tracking
4. `PointTransaction` - Immutable points ledger
5. `DiscordActivity` - MEE6 XP sync tracking

### Migration Infrastructure

**Baseline Migration (0_init):**
- Generated from production database state using `prisma migrate diff --from-empty --to-config-datasource`
- Marked as applied using `prisma migrate resolve --applied 0_init`
- Contains all v1.0 tables: Member, Team, PendingInvite, Admin, FeatureFlag, EmailTemplate, StripeEvent, AuditLog, ReconciliationRun

**V2.0 Migration (20260123015816_add_v2_tables):**
- Generated with `prisma migrate dev --create-only`
- NOT applied to database
- Contains:
  - CREATE TYPE for 4 new enums
  - ALTER TABLE Member ADD COLUMN for 3 fields
  - CREATE TABLE for 5 new models
  - CREATE INDEX for all indexes including GIN on BenchmarkSubmission.data
  - ADD FOREIGN KEY constraints (to be edited for NOT VALID in Plan 02)

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Baseline approach | Generate from production, mark as applied | Production database existed without migration history |
| Migration workflow | --create-only | Allows manual zero-downtime edits before applying |
| Schema placement | V2.0 section after Admin models | Clear separation between v1.0 and v2.0 components |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

**Prisma Version:** 7.2.0 (update to 7.3.0 available but not taken during schema work)

**Migration File Ready For Editing:**
The generated migration at `prisma/migrations/20260123015816_add_v2_tables/migration.sql` needs the following edits in Plan 02:
1. Add `NOT VALID` to all foreign key constraints
2. Separate concurrent indexes into individual migration files
3. Add VALIDATE CONSTRAINT statements in separate migration
4. Add database trigger for points aggregation

**Zero-Downtime Pattern:**
The current migration has inline foreign keys. Plan 02 will:
- Split FK creation: `ADD CONSTRAINT ... NOT VALID` (fast, no lock)
- Add FK validation: `VALIDATE CONSTRAINT` (separate migration, allows DML)
- Convert indexes to `CREATE INDEX CONCURRENTLY` (separate single-statement migrations)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 5c5c193 | feat | Add v2.0 enums and models to Prisma schema |
| 731e355 | chore | Baseline existing database schema |
| 130c6ba | feat | Generate v2.0 migration with create-only |

## Next Phase Readiness

**Blockers:** None

**Ready for Plan 02:**
- Migration file exists and is ready for zero-downtime editing
- Schema is validated and correct
- Baseline establishes migration history sync with production

**Plan 02 Will:**
1. Edit migration for NOT VALID foreign keys
2. Create separate concurrent index migrations
3. Add FK validation migration
4. Add database trigger for points aggregation
5. Apply migrations to production
