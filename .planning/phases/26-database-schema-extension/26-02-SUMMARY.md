---
phase: 26-database-schema-extension
plan: 02
subsystem: database
tags: [prisma, postgresql, zero-downtime, migrations, indexes, foreign-keys]

dependency-graph:
  requires: [26-01]
  provides: [zero-downtime-migrations, concurrent-indexes, fk-validation]
  affects: [all-v2-features]

tech-stack:
  added: []
  patterns: [not-valid-fk, validate-constraint, create-index-concurrently, single-statement-migrations]

key-files:
  created:
    - prisma/migrations/20260123015817_validate_v2_fks/migration.sql
    - prisma/migrations/20260123015818_idx_benchmark_category/migration.sql
    - prisma/migrations/20260123015819_idx_benchmark_member/migration.sql
    - prisma/migrations/20260123015820_idx_benchmark_data_gin/migration.sql
    - prisma/migrations/20260123015821_idx_resource_category/migration.sql
    - prisma/migrations/20260123015822_idx_resource_type/migration.sql
    - prisma/migrations/20260123015823_idx_resource_featured/migration.sql
    - prisma/migrations/20260123015824_idx_download_member/migration.sql
    - prisma/migrations/20260123015825_idx_download_resource/migration.sql
    - prisma/migrations/20260123015826_idx_download_date/migration.sql
    - prisma/migrations/20260123015827_idx_points_member/migration.sql
    - prisma/migrations/20260123015828_idx_points_action/migration.sql
    - prisma/migrations/20260123015829_idx_points_created/migration.sql
    - prisma/migrations/20260123015830_idx_discord_member/migration.sql
    - prisma/migrations/20260123015831_idx_discord_id/migration.sql
    - prisma/migrations/20260123015832_idx_discord_synced/migration.sql
    - prisma/migrations/20260123015833_idx_member_points/migration.sql
  modified:
    - prisma/migrations/20260123015816_add_v2_tables/migration.sql

decisions:
  - id: not-valid-fks
    choice: "Add all 5 foreign keys with NOT VALID modifier"
    rationale: "Instant addition without table scan; validation happens in separate migration"
  - id: single-statement-indexes
    choice: "Each of 16 concurrent indexes in its own migration file"
    rationale: "Prisma detects single-statement migrations and skips transaction wrapping, enabling CONCURRENTLY"
  - id: validation-separate
    choice: "FK validation in dedicated migration after FKs added"
    rationale: "VALIDATE CONSTRAINT allows concurrent DML while scanning for violations"

metrics:
  duration: "4 minutes"
  completed: "2026-01-23"
---

# Phase 26 Plan 02: Zero-Downtime Migration Editing Summary

**One-liner:** Edited v2.0 migration for NOT VALID FKs, created 16 single-statement concurrent index migrations, established pattern for safe production deployment.

## What Was Built

### Migration Structure (19 total folders)

```
prisma/migrations/
  0_init/                              # Baseline (from 26-01)
  20260123015816_add_v2_tables/        # Tables + NOT VALID FKs (edited)
  20260123015817_validate_v2_fks/      # FK validation (new)
  20260123015818_idx_benchmark_category/ # Concurrent index (new)
  20260123015819_idx_benchmark_member/   # Concurrent index (new)
  20260123015820_idx_benchmark_data_gin/ # GIN index (new)
  ... (13 more concurrent indexes) ...
  20260123015833_idx_member_points/     # Leaderboard index (new)
```

### Main Migration Edits

**Foreign Keys (5 total, all with NOT VALID):**
- `BenchmarkSubmission_memberId_fkey` - Member reference
- `ResourceDownload_memberId_fkey` - Member reference
- `ResourceDownload_resourceId_fkey` - Resource reference
- `PointTransaction_memberId_fkey` - Member reference
- `DiscordActivity_memberId_fkey` - Member reference

**Removed from main migration:**
- 16 `CREATE INDEX` statements (moved to concurrent migrations)
- Kept unique constraint (fast, no need for concurrent)

### FK Validation Migration

Single migration validates all 5 constraints:
```sql
ALTER TABLE "BenchmarkSubmission" VALIDATE CONSTRAINT "BenchmarkSubmission_memberId_fkey";
ALTER TABLE "ResourceDownload" VALIDATE CONSTRAINT "ResourceDownload_memberId_fkey";
ALTER TABLE "ResourceDownload" VALIDATE CONSTRAINT "ResourceDownload_resourceId_fkey";
ALTER TABLE "PointTransaction" VALIDATE CONSTRAINT "PointTransaction_memberId_fkey";
ALTER TABLE "DiscordActivity" VALIDATE CONSTRAINT "DiscordActivity_memberId_fkey";
```

### Concurrent Index Migrations (16 files)

Each file contains exactly one statement:

| Migration | Index | Table | Notes |
|-----------|-------|-------|-------|
| 015818 | category | BenchmarkSubmission | Filter by category |
| 015819 | memberId | BenchmarkSubmission | Member lookup |
| 015820 | data GIN | BenchmarkSubmission | JSONB containment (DB-08) |
| 015821 | category | Resource | Filter by category |
| 015822 | type | Resource | Filter by type |
| 015823 | isFeatured | Resource | Featured resources |
| 015824 | memberId | ResourceDownload | Member history |
| 015825 | resourceId | ResourceDownload | Resource downloads |
| 015826 | downloadedAt | ResourceDownload | Time-based queries |
| 015827 | memberId | PointTransaction | Member transactions |
| 015828 | action | PointTransaction | Action filtering |
| 015829 | createdAt | PointTransaction | Time-based queries |
| 015830 | memberId | DiscordActivity | Member activity |
| 015831 | discordId | DiscordActivity | Discord user lookup |
| 015832 | syncedAt | DiscordActivity | Sync tracking |
| 015833 | totalPoints DESC | Member | Leaderboard queries |

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| NOT VALID for all FKs | Add constraint instantly, validate later | Avoids ACCESS EXCLUSIVE lock on Member table |
| Separate validation migration | VALIDATE CONSTRAINT in own migration | Allows concurrent reads/writes during validation |
| Single-statement index migrations | 16 separate files | Prisma skips transaction wrapping for single statements |
| GIN with jsonb_path_ops | Use operator class in index | 20-30% smaller, 600% faster for `@>` queries |
| Descending totalPoints index | `ON "Member"("totalPoints" DESC)` | Optimizes leaderboard ORDER BY queries |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

**Zero-Downtime Pattern Summary:**

1. **Table creation** - New tables have no data, instant
2. **FK creation with NOT VALID** - Instant catalog update, no table scan
3. **FK validation** - Scans rows but allows concurrent DML
4. **Concurrent indexes** - Background build, no table locks

**Migration Execution Order:**

```bash
# 1. Tables + NOT VALID FKs (instant)
prisma migrate deploy  # Runs 20260123015816_add_v2_tables

# 2. FK validation (concurrent-safe)
prisma migrate deploy  # Runs 20260123015817_validate_v2_fks

# 3-18. Concurrent indexes (one at a time, concurrent-safe)
prisma migrate deploy  # Runs 20260123015818 through 20260123015833
```

**GIN Index Syntax:**
```sql
CREATE INDEX CONCURRENTLY "BenchmarkSubmission_data_idx"
  ON "BenchmarkSubmission" USING GIN ("data" jsonb_path_ops);
```

## Commits

| Hash | Type | Description |
|------|------|-------------|
| d576b8a | refactor | Edit migration for NOT VALID foreign keys |
| a15e6e5 | feat | Create FK validation migration |
| a85ca40 | feat | Create 16 concurrent index migrations |

## Next Phase Readiness

**Blockers:** None

**Ready for Phase 27 (Benchmarking APIs):**
- Database schema fully specified
- Migrations ready for zero-downtime deployment
- GIN index enables efficient JSONB queries for benchmarks
- Leaderboard index optimizes gamification queries

**Migration Deployment:**
The migrations can be deployed to production using:
```bash
npx prisma migrate deploy
```

This will apply all 18 pending migrations (main + validate + 16 indexes) in order.

**Note:** The database trigger for points aggregation (DB-07) is deferred to Phase 27 as it's more closely related to the points API implementation.
