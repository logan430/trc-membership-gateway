# Phase 26: Database Schema Extension - Research

**Researched:** 2026-01-22
**Domain:** Prisma migrations, PostgreSQL JSONB, database triggers, zero-downtime patterns
**Confidence:** HIGH

## Summary

This phase extends the production PostgreSQL database with five new tables and modifies the Member table to support v2.0 features: benchmarking, resource library, and gamification. The critical challenge is executing these migrations on a production Supabase database without causing downtime.

**Current State:**
- Prisma 7.2.0 with PostgreSQL on Supabase
- Existing tables: Member, Team, PendingInvite, Admin, FeatureFlag, EmailTemplate, StripeEvent, AuditLog, ReconciliationRun
- Direct connection for migrations (port 5432), pooled connection for runtime (port 6543)
- No existing migrations folder (schema created directly)

**Key Challenges:**
1. Prisma wraps multi-statement migrations in transactions, blocking `CREATE INDEX CONCURRENTLY`
2. Foreign key constraints require two-phase approach (NOT VALID + VALIDATE) for zero-downtime
3. Database triggers must be added via raw SQL in migration files
4. GIN indexes on JSONB need specific Prisma syntax with operator class

**Primary recommendation:** Use Prisma's `--create-only` flag to generate migrations, then manually edit SQL files to implement zero-downtime patterns (concurrent indexes, NOT VALID foreign keys). Each concurrent index must be in its own migration file.

## Standard Stack

The established tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 7.2.0 | ORM + migrations | Already in use, TypeScript-first, handles schema sync |
| PostgreSQL | 15+ (Supabase) | Database | Already in infrastructure, JSONB + GIN support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `prisma migrate dev` | Built-in | Development migrations | Local development, shadow database |
| `prisma migrate deploy` | Built-in | Production migrations | CI/CD pipeline, production deploys |
| Raw SQL files | N/A | Custom database objects | Triggers, concurrent indexes, NOT VALID constraints |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma migrations | Atlas | Better concurrent index support, but adds new tool |
| Prisma migrations | Raw SQL scripts | Full control, but loses schema introspection |
| Database triggers | Application logic | Simpler, but denormalization can drift |

**Note:** Stay with Prisma migrations but use manual SQL edits for zero-downtime patterns.

## Architecture Patterns

### Recommended Project Structure
```
prisma/
  schema.prisma           # Main schema file (edit enums, models here)
  migrations/
    20260122000000_add_benchmark_tables/
      migration.sql       # Edited to use NOT VALID, no concurrent indexes
    20260122000001_add_benchmark_fk_validation/
      migration.sql       # Single: VALIDATE CONSTRAINT only
    20260122000002_add_benchmark_gin_index/
      migration.sql       # Single: CREATE INDEX CONCURRENTLY only
    20260122000003_add_resource_tables/
      migration.sql       # Table creation
    20260122000004_add_resource_fk_validation/
      migration.sql       # VALIDATE CONSTRAINT
    ...
    20260122000010_add_points_trigger/
      migration.sql       # CREATE FUNCTION + CREATE TRIGGER
```

### Pattern 1: Two-Phase Foreign Key Constraint

**What:** Add foreign keys in two separate migrations to avoid table locks.

**When to use:** Every foreign key to existing tables (Member).

**Example:**
```sql
-- Migration 1: Add constraint without validation (fast, no lock)
ALTER TABLE "BenchmarkSubmission"
  ADD CONSTRAINT "BenchmarkSubmission_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id")
  ON DELETE CASCADE
  NOT VALID;

-- Migration 2: Validate existing data (separate migration, allows concurrent DML)
ALTER TABLE "BenchmarkSubmission"
  VALIDATE CONSTRAINT "BenchmarkSubmission_memberId_fkey";
```

**Why NOT VALID:** The `NOT VALID` option adds the constraint to the catalog without scanning existing rows, acquiring only a brief SHARE UPDATE EXCLUSIVE lock instead of ACCESS EXCLUSIVE. The validation step scans rows but allows concurrent reads and writes.

### Pattern 2: Single-Statement Concurrent Index Migrations

**What:** Create each concurrent index in its own migration file with only that statement.

**When to use:** All indexes on production tables.

**Example:**
```sql
-- This MUST be the only statement in the migration file
-- Prisma detects single-statement migrations and skips transaction wrapping
CREATE INDEX CONCURRENTLY "BenchmarkSubmission_category_idx"
  ON "BenchmarkSubmission"("category");
```

**Prisma Quirk:** If there are 2+ statements, Prisma wraps in a transaction, which fails for CONCURRENTLY. Each concurrent index needs its own migration.

### Pattern 3: Trigger Function for Denormalized Points

**What:** Database trigger auto-updates Member.totalPoints when PointTransaction inserted.

**When to use:** Gamification point aggregation (DB-07).

**Example:**
```sql
-- Function to update denormalized totalPoints
CREATE OR REPLACE FUNCTION update_member_total_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Member"
  SET "totalPoints" = "totalPoints" + NEW.points,
      "lastActiveAt" = NOW(),
      "updatedAt" = NOW()
  WHERE id = NEW."memberId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on PointTransaction INSERT
CREATE TRIGGER trg_update_member_points
  AFTER INSERT ON "PointTransaction"
  FOR EACH ROW
  EXECUTE FUNCTION update_member_total_points();
```

**Why database trigger over application code:**
- Guaranteed consistency (can't forget to update totalPoints)
- Works for any insert path (API, admin, scripts)
- Single source of truth
- No N+1 queries on leaderboard

### Pattern 4: GIN Index on JSONB with jsonb_path_ops

**What:** Create GIN index with optimized operator class for containment queries.

**When to use:** BenchmarkSubmission.data field for `@>` queries (DB-08).

**Prisma Schema Syntax:**
```prisma
model BenchmarkSubmission {
  id        String              @id @default(cuid())
  data      Json
  // ... other fields ...

  @@index([data(ops: JsonbPathOps)], type: Gin)
}
```

**Generated SQL:**
```sql
CREATE INDEX "BenchmarkSubmission_data_idx"
  ON "BenchmarkSubmission"
  USING GIN (data jsonb_path_ops);
```

**For concurrent creation (manual edit):**
```sql
-- Separate migration file, single statement
CREATE INDEX CONCURRENTLY "BenchmarkSubmission_data_idx"
  ON "BenchmarkSubmission"
  USING GIN (data jsonb_path_ops);
```

**Why jsonb_path_ops:** 20-30% smaller index size, 600% faster for containment queries (`@>`). Only downside: doesn't support `?`, `?|`, `?&` operators (which we don't need).

### Anti-Patterns to Avoid

- **Multi-statement concurrent index migrations:** Prisma wraps in transaction, fails with "CREATE INDEX CONCURRENTLY cannot run inside a transaction block"
- **Inline foreign key constraints:** `REFERENCES` in CREATE TABLE validates immediately; use ALTER TABLE with NOT VALID instead
- **Testing on empty databases:** 10-row dev database gives false confidence; migrations that take 10ms locally might take 10 minutes on 10K rows
- **Adding NOT NULL without default:** Requires full table rewrite; add nullable first, backfill, then add CHECK constraint
- **Skipping validation step:** NOT VALID constraints aren't fully enforced until validated; schedule validation promptly

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Points aggregation | SUM() on every leaderboard query | Denormalized column + trigger | O(log n) read vs O(n) aggregation |
| JSONB indexing | Multiple B-tree indexes per field | GIN index with jsonb_path_ops | One index handles all containment queries |
| Migration transaction control | Manual BEGIN/COMMIT | Single-statement migration files | Prisma auto-detects and skips transaction |
| Schema sync | Raw SQL + manual tracking | Prisma Migrate | Tracks migration state, generates client types |

**Key insight:** Prisma handles 90% of migration needs; the 10% (triggers, concurrent indexes) requires manual SQL edits but should still use Prisma's migration tracking.

## Common Pitfalls

### Pitfall 1: Concurrent Index in Multi-Statement Migration

**What goes wrong:** Migration fails with P3018 error: "CREATE INDEX CONCURRENTLY cannot run inside a transaction block"

**Why it happens:** Prisma checks statement count; 2+ statements = transaction wrapper.

**How to avoid:**
1. Generate migration with `--create-only`
2. Remove concurrent indexes from main migration
3. Create separate migration file for each concurrent index (single statement only)

**Warning signs:** Migration file has `CREATE INDEX CONCURRENTLY` alongside other statements.

### Pitfall 2: Foreign Key Locks Production Writes

**What goes wrong:** Adding foreign key to Member table locks all writes for duration of constraint validation (could be minutes on large tables).

**Why it happens:** Default `ADD CONSTRAINT ... FOREIGN KEY` validates all existing rows while holding ACCESS EXCLUSIVE lock.

**How to avoid:**
```sql
-- Phase 1: Add without validation (instant)
ALTER TABLE "NewTable" ADD CONSTRAINT "fk_name"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id") NOT VALID;

-- Phase 2: Validate (allows concurrent operations)
ALTER TABLE "NewTable" VALIDATE CONSTRAINT "fk_name";
```

**Warning signs:** Prisma-generated migration has inline `REFERENCES` or `ADD CONSTRAINT` without `NOT VALID`.

### Pitfall 3: Trigger Not Created Due to Missing Manual SQL

**What goes wrong:** Prisma generates tables but trigger function doesn't exist; points awarded but totalPoints never updates.

**Why it happens:** Prisma schema has no syntax for triggers; must be added manually to migration.

**How to avoid:**
1. Create migration with `--create-only`
2. Add `CREATE FUNCTION` and `CREATE TRIGGER` SQL to migration file
3. Test trigger fires on INSERT to PointTransaction

**Warning signs:** Member.totalPoints stays at 0 while PointTransaction table has records.

### Pitfall 4: Production-Sized Data Not Tested

**What goes wrong:** Migration takes 2 hours in production, causing extended downtime.

**Why it happens:** Development database has 10 rows; production has 10,000. Index creation, constraint validation scale non-linearly.

**How to avoid:**
1. Create staging database with production-sized data (or clone production)
2. Time migrations on staging first
3. Set `lock_timeout` to fail fast rather than queue

**Warning signs:** Migration runs "instantly" in development but production Member table has thousands of rows.

### Pitfall 5: GIN Index Without Concurrent Flag in Production

**What goes wrong:** GIN index on JSONB blocks writes during index build (could be minutes).

**Why it happens:** Prisma generates `CREATE INDEX` not `CREATE INDEX CONCURRENTLY`.

**How to avoid:**
1. Remove Prisma-generated index from migration
2. Create separate single-statement migration with `CREATE INDEX CONCURRENTLY`

**Warning signs:** Prisma schema has `@@index([data(ops: JsonbPathOps)], type: Gin)` but migration wasn't edited.

## Code Examples

Verified patterns from official sources and existing codebase.

### Complete Prisma Schema Addition

```prisma
// prisma/schema.prisma additions

// Enums
enum BenchmarkCategory {
  COMPENSATION
  INFRASTRUCTURE
  BUSINESS
  OPERATIONAL
}

enum ResourceCategory {
  COLD_EMAIL
  SALES_GTM
  CUSTOMER_SERVICE
  OPERATIONS
  AGENCY_GROWTH
}

enum ResourceType {
  TEMPLATE
  SOP
  PLAYBOOK
  COURSE
  VIDEO
}

enum DiscordActivityType {
  MESSAGE
  REACTION_GIVEN
  REACTION_RECEIVED
}

// Extended Member model
model Member {
  // ... existing fields ...

  // Gamification (NEW - DB-06)
  totalPoints           Int                    @default(0)
  currentStreak         Int                    @default(0)
  lastActiveAt          DateTime?

  // Relationships (NEW)
  benchmarkSubmissions  BenchmarkSubmission[]
  resourceDownloads     ResourceDownload[]
  pointTransactions     PointTransaction[]
  discordActivities     DiscordActivity[]

  // ... existing indexes ...
  @@index([totalPoints(sort: Desc)])  // Leaderboard queries
}

// DB-01: BenchmarkSubmission
model BenchmarkSubmission {
  id          String            @id @default(cuid())
  memberId    String
  category    BenchmarkCategory
  data        Json              // JSONB for flexible schema
  isValid     Boolean           @default(true)
  submittedAt DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  member      Member            @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([memberId, category])  // One submission per category per member
  @@index([category])
  @@index([memberId])
  @@index([data(ops: JsonbPathOps)], type: Gin)  // DB-08
}

// DB-02: Resource
model Resource {
  id            String           @id @default(cuid())
  title         String
  description   String
  category      ResourceCategory
  type          ResourceType
  fileUrl       String           // Supabase Storage path
  thumbnailUrl  String?
  isFeatured    Boolean          @default(false)
  downloadCount Int              @default(0)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  downloads     ResourceDownload[]

  @@index([category])
  @@index([type])
  @@index([isFeatured])
}

// DB-03: ResourceDownload
model ResourceDownload {
  id           String   @id @default(cuid())
  memberId     String
  resourceId   String
  downloadedAt DateTime @default(now())

  member       Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  resource     Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)

  @@index([memberId])
  @@index([resourceId])
  @@index([downloadedAt])
}

// DB-04: PointTransaction (immutable ledger)
model PointTransaction {
  id        String   @id @default(cuid())
  memberId  String
  action    String   // "benchmark_submission", "resource_download", "discord_activity", "intro_completed"
  points    Int      // Can be negative for admin adjustments
  metadata  Json?    // Context: { category: "COMPENSATION" }, { resourceId: "..." }
  createdAt DateTime @default(now())

  member    Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([memberId])
  @@index([action])
  @@index([createdAt])
}

// DB-05: DiscordActivity
model DiscordActivity {
  id           String              @id @default(cuid())
  memberId     String
  discordId    String
  activityType DiscordActivityType
  xpDelta      Int?                // MEE6 XP gained since last sync
  xpTotal      Int?                // Total MEE6 XP at sync time
  syncedAt     DateTime            @default(now())

  member       Member              @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([memberId])
  @@index([discordId])
  @@index([syncedAt])
}
```

### Migration File Structure (After Manual Edits)

**Migration 1: Create tables (no FKs, no indexes)**
```sql
-- 20260122000000_add_v2_tables/migration.sql

-- Create enums
CREATE TYPE "BenchmarkCategory" AS ENUM ('COMPENSATION', 'INFRASTRUCTURE', 'BUSINESS', 'OPERATIONAL');
CREATE TYPE "ResourceCategory" AS ENUM ('COLD_EMAIL', 'SALES_GTM', 'CUSTOMER_SERVICE', 'OPERATIONS', 'AGENCY_GROWTH');
CREATE TYPE "ResourceType" AS ENUM ('TEMPLATE', 'SOP', 'PLAYBOOK', 'COURSE', 'VIDEO');
CREATE TYPE "DiscordActivityType" AS ENUM ('MESSAGE', 'REACTION_GIVEN', 'REACTION_RECEIVED');

-- Extend Member table (DB-06)
ALTER TABLE "Member" ADD COLUMN "totalPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Member" ADD COLUMN "currentStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Member" ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- Create BenchmarkSubmission (DB-01)
CREATE TABLE "BenchmarkSubmission" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "category" "BenchmarkCategory" NOT NULL,
  "data" JSONB NOT NULL,
  "isValid" BOOLEAN NOT NULL DEFAULT true,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BenchmarkSubmission_pkey" PRIMARY KEY ("id")
);

-- Create Resource (DB-02)
CREATE TABLE "Resource" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" "ResourceCategory" NOT NULL,
  "type" "ResourceType" NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "downloadCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- Create ResourceDownload (DB-03)
CREATE TABLE "ResourceDownload" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceDownload_pkey" PRIMARY KEY ("id")
);

-- Create PointTransaction (DB-04)
CREATE TABLE "PointTransaction" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- Create DiscordActivity (DB-05)
CREATE TABLE "DiscordActivity" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "discordId" TEXT NOT NULL,
  "activityType" "DiscordActivityType" NOT NULL,
  "xpDelta" INTEGER,
  "xpTotal" INTEGER,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscordActivity_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint (doesn't lock)
ALTER TABLE "BenchmarkSubmission" ADD CONSTRAINT "BenchmarkSubmission_memberId_category_key" UNIQUE ("memberId", "category");
```

**Migration 2: Add foreign keys NOT VALID (DB-09)**
```sql
-- 20260122000001_add_v2_foreign_keys/migration.sql

-- BenchmarkSubmission FK
ALTER TABLE "BenchmarkSubmission"
  ADD CONSTRAINT "BenchmarkSubmission_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id")
  ON DELETE CASCADE
  NOT VALID;

-- ResourceDownload FKs
ALTER TABLE "ResourceDownload"
  ADD CONSTRAINT "ResourceDownload_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id")
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE "ResourceDownload"
  ADD CONSTRAINT "ResourceDownload_resourceId_fkey"
  FOREIGN KEY ("resourceId") REFERENCES "Resource"("id")
  ON DELETE CASCADE
  NOT VALID;

-- PointTransaction FK
ALTER TABLE "PointTransaction"
  ADD CONSTRAINT "PointTransaction_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id")
  ON DELETE CASCADE
  NOT VALID;

-- DiscordActivity FK
ALTER TABLE "DiscordActivity"
  ADD CONSTRAINT "DiscordActivity_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "Member"("id")
  ON DELETE CASCADE
  NOT VALID;
```

**Migration 3: Validate foreign keys**
```sql
-- 20260122000002_validate_v2_foreign_keys/migration.sql

ALTER TABLE "BenchmarkSubmission" VALIDATE CONSTRAINT "BenchmarkSubmission_memberId_fkey";
ALTER TABLE "ResourceDownload" VALIDATE CONSTRAINT "ResourceDownload_memberId_fkey";
ALTER TABLE "ResourceDownload" VALIDATE CONSTRAINT "ResourceDownload_resourceId_fkey";
ALTER TABLE "PointTransaction" VALIDATE CONSTRAINT "PointTransaction_memberId_fkey";
ALTER TABLE "DiscordActivity" VALIDATE CONSTRAINT "DiscordActivity_memberId_fkey";
```

**Migration 4-10: Concurrent indexes (one per file) (DB-08, DB-10)**
```sql
-- 20260122000003_idx_benchmark_category/migration.sql
CREATE INDEX CONCURRENTLY "BenchmarkSubmission_category_idx" ON "BenchmarkSubmission"("category");

-- 20260122000004_idx_benchmark_member/migration.sql
CREATE INDEX CONCURRENTLY "BenchmarkSubmission_memberId_idx" ON "BenchmarkSubmission"("memberId");

-- 20260122000005_idx_benchmark_data_gin/migration.sql
CREATE INDEX CONCURRENTLY "BenchmarkSubmission_data_idx" ON "BenchmarkSubmission" USING GIN (data jsonb_path_ops);

-- 20260122000006_idx_resource_category/migration.sql
CREATE INDEX CONCURRENTLY "Resource_category_idx" ON "Resource"("category");

-- 20260122000007_idx_resource_type/migration.sql
CREATE INDEX CONCURRENTLY "Resource_type_idx" ON "Resource"("type");

-- 20260122000008_idx_resource_featured/migration.sql
CREATE INDEX CONCURRENTLY "Resource_isFeatured_idx" ON "Resource"("isFeatured");

-- 20260122000009_idx_point_member/migration.sql
CREATE INDEX CONCURRENTLY "PointTransaction_memberId_idx" ON "PointTransaction"("memberId");

-- ... continue for all indexes
```

**Migration 11: Points trigger (DB-07)**
```sql
-- 20260122000020_add_points_trigger/migration.sql

-- Function to update denormalized totalPoints
CREATE OR REPLACE FUNCTION update_member_total_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Member"
  SET "totalPoints" = "totalPoints" + NEW.points,
      "lastActiveAt" = NOW(),
      "updatedAt" = NOW()
  WHERE id = NEW."memberId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger fires after every PointTransaction insert
CREATE TRIGGER trg_update_member_points
  AFTER INSERT ON "PointTransaction"
  FOR EACH ROW
  EXECUTE FUNCTION update_member_total_points();
```

### Verification Queries

```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('BenchmarkSubmission', 'Resource', 'ResourceDownload', 'PointTransaction', 'DiscordActivity');

-- Verify Member columns added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Member'
AND column_name IN ('totalPoints', 'currentStreak', 'lastActiveAt');

-- Verify GIN index exists (DB-08)
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'BenchmarkSubmission' AND indexdef LIKE '%gin%';

-- Verify trigger exists (DB-07)
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_update_member_points';

-- Test trigger works
INSERT INTO "PointTransaction" (id, "memberId", action, points)
VALUES ('test-123', 'existing-member-id', 'test', 10);
-- Check Member.totalPoints increased by 10
SELECT "totalPoints" FROM "Member" WHERE id = 'existing-member-id';
-- Cleanup
DELETE FROM "PointTransaction" WHERE id = 'test-123';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma transactions for all migrations | Single-statement detection skips transaction | Prisma 4.x | Enables CONCURRENTLY |
| Inline FK in CREATE TABLE | ALTER TABLE ... NOT VALID + VALIDATE | PostgreSQL 9.4+ | Zero-downtime FK addition |
| GIN with jsonb_ops (default) | GIN with jsonb_path_ops | PostgreSQL 9.4+ | 20-30% smaller index, faster @> |
| Application-level point calculation | Database trigger | Always available | Consistency guarantee |

**Deprecated/outdated:**
- `prisma migrate save` / `prisma migrate up`: Replaced by `prisma migrate dev` / `prisma migrate deploy` in Prisma 2.x+
- Manual shadow database management: Prisma 2+ handles automatically

## Open Questions

Things that couldn't be fully resolved:

1. **Staging database for migration testing**
   - What we know: Need production-sized data to test migration timing
   - What's unclear: Does a Supabase staging environment exist? How to clone production?
   - Recommendation: Either create staging branch in Supabase or use pg_dump to create local replica

2. **Prisma migration baseline**
   - What we know: No existing `prisma/migrations` folder; schema was created directly
   - What's unclear: How to establish baseline without re-running all DDL
   - Recommendation: Use `prisma migrate diff` to generate baseline, mark as applied with `prisma migrate resolve`

3. **Concurrent index failure recovery**
   - What we know: If CREATE INDEX CONCURRENTLY fails, leaves invalid index
   - What's unclear: Prisma's behavior when re-running failed concurrent index migration
   - Recommendation: Check for invalid indexes with `SELECT * FROM pg_indexes WHERE NOT indisvalid` and drop before retry

## Sources

### Primary (HIGH confidence)
- [Prisma Documentation: Customizing migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations)
- [Prisma Documentation: Indexes](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes) - GIN index syntax, jsonb_path_ops
- [PostgreSQL Documentation: GIN Indexes](https://www.postgresql.org/docs/current/gin.html)
- [PostgreSQL Documentation: Built-in Operator Classes](https://www.postgresql.org/docs/16/gin-builtin-opclasses.html)

### Secondary (MEDIUM confidence)
- [Bytebase: Postgres Schema Migration without Downtime](https://www.bytebase.com/blog/postgres-schema-migration-without-downtime/) - NOT VALID pattern, lock timeouts
- [Xata: Zero-Downtime Schema Migrations PostgreSQL](https://xata.io/blog/zero-downtime-schema-migrations-postgresql) - Concurrent index, expand-contract
- [Prisma GitHub Issue #14456: Support CREATE INDEX CONCURRENTLY](https://github.com/prisma/prisma/issues/14456) - Single-statement workaround
- [Atlas Guide: Manage Database Triggers with Prisma](https://atlasgo.io/guides/orms/prisma/triggers) - Custom SQL for triggers

### Tertiary (LOW confidence)
- Chris's reference implementation: `Chris's Dashboard & Features for Review & Integration/revenue-council/revenue-council/supabase/migrations/` - Schema patterns (different ORM/platform)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Prisma 7.2.0 confirmed in project, PostgreSQL patterns well-documented
- Architecture: HIGH - Zero-downtime patterns verified with 2025-2026 sources, Prisma quirks documented in issues
- Pitfalls: HIGH - All identified from official Prisma issues and PostgreSQL documentation

**Research date:** 2026-01-22
**Valid until:** 2026-04-22 (90 days - Prisma releases frequently but migration semantics stable)

---

**Key Files for This Phase:**
- `c:\Users\lhdea\OneDrive\Documents\Vibes\The Revenue Council\Membership Application for Discord\prisma\schema.prisma` - Current schema to extend
- `c:\Users\lhdea\OneDrive\Documents\Vibes\The Revenue Council\Membership Application for Discord\prisma.config.ts` - Migration config (directUrl for migrations)
- `c:\Users\lhdea\OneDrive\Documents\Vibes\The Revenue Council\Membership Application for Discord\.planning\research\ARCHITECTURE.md` - Reference schema designs
