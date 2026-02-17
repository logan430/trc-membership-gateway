# Phase 40: Database Production Setup - Research

**Researched:** 2026-02-16
**Domain:** Prisma migrations, Supabase production database, Coolify container management, seed data
**Confidence:** HIGH

## Summary

Phase 40 connects the deployed Coolify application to a production Supabase database, runs Prisma migrations, and seeds essential operational data (admin account, point configs, feature flags, email templates).

The codebase already has comprehensive infrastructure for all of this:
- `prisma.config.ts` with dual connection URLs (pooler for runtime, direct for migrations)
- `prisma migrate deploy` as the production-safe migration command (27 migration files ready)
- `scripts/seed-test-data.ts` as a comprehensive seed script with admin, point configs, feature flags, and upsert-based idempotent operations
- Admin seed API endpoints at `/admin/templates/seed`, `/admin/config/feature-flags/seed`, and `/api/admin/points-config/seed`
- Auto-seeding of point configs on Express server startup in `src/index.ts`

The primary challenge is execution logistics: how to run `prisma migrate deploy` and seed scripts against the production database from within the Coolify environment.

**Primary recommendation:** SSH into the Coolify server, use `docker exec` to run migration and seed commands inside the running Express container, which already has Prisma CLI, the schema, migration files, and the DATABASE_URL env var.

## Standard Stack

The project already uses the established stack. No new libraries needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| prisma | ^7.2.0 | Migration runner & schema management | Already in devDependencies, generates client |
| @prisma/client | ^7.2.0 | Database queries | Runtime ORM |
| @prisma/adapter-pg | ^7.2.0 | PostgreSQL driver adapter | Supabase-compatible pg adapter |
| pg | ^8.17.1 | Node.js PostgreSQL client | Used by Prisma adapter and seed scripts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | ^4.21.0 | TypeScript execution | Running seed scripts (devDependency) |
| argon2 | ^0.44.0 | Password hashing | Admin account seeding |

### No New Libraries Needed

This phase uses entirely existing tools. No npm install required.

## Architecture Patterns

### Current Database Connection Architecture

The app uses a dual-URL pattern for Supabase:

```
prisma.config.ts:
  datasource.url       = DATABASE_URL    (pooler, port 6543, for runtime queries)
  datasource.directUrl = DIRECT_URL      (direct, port 5432, for migrations)
```

Runtime connections (`src/lib/prisma.ts`) use only `DATABASE_URL` via `pg.Pool`:

```typescript
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

### Connection String Formats (Supabase)

**Pooler connection (runtime queries) - DATABASE_URL:**
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Direct connection (migrations) - DIRECT_URL:**
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

Key differences:
- Port 6543 = transaction pooler (Supavisor), best for app runtime
- Port 5432 = session pooler, best for migrations (supports DDL, prepared statements)
- `?pgbouncer=true` hint for pooler mode only
- Both use the same `postgres.[project-ref]` username format

### Migration Approach: Three Options

**Option A: SSH + docker exec (RECOMMENDED)**

SSH into the Coolify server and exec into the running Express container:

```bash
# On Coolify server via SSH
docker exec -it <express-container-name> npx prisma migrate deploy
```

Advantages:
- Container already has Prisma CLI, schema, migration files
- Container already has DATABASE_URL and DIRECT_URL env vars
- No code changes needed
- Can also run seed scripts the same way

Disadvantages:
- Requires SSH access to server (user already has this)
- Need to find container name/ID

**Option B: Migration service in docker-compose.prod.yml**

Add a one-off migration service:

```yaml
services:
  migrate:
    build:
      context: .
      dockerfile: Dockerfile
    command: npx prisma migrate deploy
    environment:
      - NODE_ENV=production
    labels:
      - "coolify.managed=true"
      - "exclude_from_hc=true"  # Coolify-specific: don't health check this
    networks:
      - coolify
```

Advantages:
- Declarative, repeatable
- Runs automatically on deploy

Disadvantages:
- Runs on EVERY deploy (adds ~30s build time for no-op migrations)
- Need to handle exit properly (service stops after migration)
- Coolify's `exclude_from_hc: true` needed so stopped container doesn't fail health
- Adds complexity to compose file permanently

**Option C: Run locally with production DATABASE_URL**

Set DATABASE_URL and DIRECT_URL to production values locally and run:

```bash
DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy
```

Advantages:
- Simple, immediate
- Full control and visibility

Disadvantages:
- Requires exposing production credentials on local machine
- Network must reach Supabase (usually fine, but some VPN/firewall issues)
- Less repeatable

**Recommendation: Option A (SSH + docker exec) for initial setup, with Option B consideration for ongoing deployments**

For a one-time production setup, Option A is cleanest. The Express container at runtime has everything needed. For future deployments with schema changes, Option B (migration service) could be added later.

### Seed Data Strategy

The codebase has two approaches for seeding production data:

**Approach 1: Admin API endpoints (preferred for production)**

The app has built-in seed endpoints that are idempotent:
- `POST /admin/config/feature-flags/seed` - Seeds 8 default feature flags (uses `createMany` + `skipDuplicates`)
- `POST /api/admin/points-config/seed` - Seeds 4 point configs (uses `createMany` + `skipDuplicates`)
- `POST /admin/templates/seed` - Seeds 10 default email templates (uses `createMany` + `skipDuplicates`)

These require an authenticated admin (SUPER_ADMIN role), creating a chicken-and-egg problem for the admin account itself.

**Approach 2: Seed script via docker exec**

```bash
docker exec -it <express-container> npx tsx scripts/seed-test-data.ts
```

The `scripts/seed-test-data.ts` script uses upsert operations and seeds:
- Admin: `admin@admin.com` / `admin123` (SUPER_ADMIN)
- 5 member accounts with various subscription states
- 1 team with owner + member
- 5 point configs
- 5 feature flags

**However**, this creates TEST data with test credentials. For production, we need a PRODUCTION seed approach.

**Approach 3: Production-specific seed script (RECOMMENDED)**

Create a new `scripts/seed-production.ts` that:
1. Creates a real admin account (email/password from env vars ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD)
2. Seeds production point configs (same as test but without test member data)
3. Seeds production feature flags
4. Seeds email templates

The env vars `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` already exist in the Zod schema (`src/config/env.ts` lines 53-54) but are currently unused by any seed script.

### Auto-Seeding Already in Place

The Express server already auto-seeds point configs at startup:

```typescript
// src/index.ts line 335
seedDefaultPointConfigs()
  .then(() => logger.info('Default point configs seeded'))
  .catch((error) => logger.error({ error }, 'Failed to seed point configs'));
```

This means point configs will be seeded automatically when the server starts against a fresh database. Feature flags and email templates are NOT auto-seeded.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Running migrations | Custom SQL scripts | `npx prisma migrate deploy` | Tracks migration state, idempotent, handles 27 existing migrations |
| Admin account creation | Raw SQL insert | Argon2 password hashing via `hashPassword()` from `src/lib/password.js` | Password hashing must use argon2 to match login verification |
| Feature flag seeding | Manual INSERT statements | `seedDefaultFlags()` from `src/lib/feature-flags.ts` | Uses `createMany` + `skipDuplicates`, matches app's flag definitions |
| Point config seeding | Manual INSERT statements | `seedDefaultPointConfigs()` from `src/points/config.ts` | Uses `createMany` + `skipDuplicates`, matches app's config definitions |
| Email template seeding | Manual INSERT statements | `POST /admin/templates/seed` endpoint or `DEFAULT_TEMPLATES` | 10 templates with complex body content, maintained in source |
| Connection string management | Hardcoded URLs | Environment variables via Coolify injection | Already configured in prisma.config.ts with dual URL support |

**Key insight:** Nearly all seed infrastructure already exists in the codebase. The gap is a production-specific seed script that uses real credentials instead of test data.

## Common Pitfalls

### Pitfall 1: Zod Validation Crash from Empty Env Vars
**What goes wrong:** Setting an env var to empty string `""` in Coolify causes Zod `.url().optional()` to crash. The `.optional()` only accepts `undefined`, not empty string.
**Why it happens:** Coolify's env var UI may set a variable to empty string rather than deleting it.
**How to avoid:** Only set env vars that have actual values. Leave optional vars completely unset in Coolify (do not set them to empty string). This was already resolved in Phase 39.
**Warning signs:** Server crashes on startup with Zod validation error mentioning `.url()`.

### Pitfall 2: Using Wrong Connection URL for Migrations
**What goes wrong:** Running `prisma migrate deploy` with the pooler URL (port 6543) instead of the direct URL (port 5432).
**Why it happens:** DATABASE_URL is set to pooler mode which doesn't support DDL statements properly.
**How to avoid:** The `prisma.config.ts` already handles this by using `directUrl` for migrations. When running `npx prisma migrate deploy`, Prisma uses the `DIRECT_URL` env var automatically via the config file.
**Warning signs:** Migration hangs or fails with "prepared statement already exists" errors.

### Pitfall 3: Running `prisma migrate dev` Instead of `prisma migrate deploy`
**What goes wrong:** `prisma migrate dev` can reset the database, detect drift, and create new migrations. Running it against production is destructive.
**Why it happens:** Muscle memory from development workflow.
**How to avoid:** Always use `prisma migrate deploy` in production. It only applies pending migrations, never resets or creates new ones.
**Warning signs:** Prompt asking "Are you sure you want to reset the database?"

### Pitfall 4: tsx Not Available in Production Container
**What goes wrong:** Trying to run `npx tsx scripts/seed-test-data.ts` in the production container fails because tsx is a devDependency.
**Why it happens:** The Dockerfile uses `npm ci` which installs all dependencies during build, but the production runner stage only copies `node_modules` from the builder. In the current Dockerfile, ALL node_modules are copied (including devDependencies), so tsx IS available.
**How to avoid:** Verify by checking: `docker exec <container> npx tsx --version`. The current Dockerfile copies the full node_modules from the builder stage, which includes devDependencies.
**Warning signs:** "Cannot find module tsx" error.

### Pitfall 5: Seed Script Creates Test Data in Production
**What goes wrong:** Running `scripts/seed-test-data.ts` or `prisma/seed.ts` creates test accounts with weak passwords (`admin123`, `TestPassword123!`) in the production database.
**Why it happens:** Existing seed scripts are designed for development testing.
**How to avoid:** Create a production-specific seed script that uses strong credentials from environment variables, or use the admin API endpoints after creating the initial admin manually.
**Warning signs:** `admin@admin.com` with password `admin123` exists in production.

### Pitfall 6: Supabase Project Not in Production Mode
**What goes wrong:** Using the development Supabase project (which has a 500MB limit and pauses after 1 week of inactivity) for production.
**Why it happens:** Development project was used during Phase 39 deployment.
**How to avoid:** User must either upgrade the existing Supabase project to a paid plan (Pro at $25/month) or create a new dedicated production project. The connection string will need to be updated in Coolify env vars.
**Warning signs:** Database pauses unexpectedly, hitting size limits, "project is paused" errors.

### Pitfall 7: Missing Prisma Migration State on Fresh Database
**What goes wrong:** On a completely fresh Supabase database, `prisma migrate deploy` needs to create the `_prisma_migrations` table and run all 27 migrations in order.
**Why it happens:** The production database has never had Prisma migrations applied.
**How to avoid:** This is expected behavior. `prisma migrate deploy` handles this automatically by creating the migrations table and running all pending migrations. Just ensure DIRECT_URL points to the fresh database.
**Warning signs:** None -- this is normal for first-time setup.

## Code Examples

### Finding the Container Name on Coolify Server

```bash
# SSH into Coolify server
ssh root@82.180.160.120

# List running containers to find Express container name
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep express
# Container name follows pattern: <app-uuid>-express-1 or similar
```

### Running Migrations via docker exec

```bash
# On Coolify server
docker exec -it <express-container-name> npx prisma migrate deploy

# Expected output:
# Prisma schema loaded from prisma/schema.prisma
# Datasource "db": PostgreSQL database "postgres"
# 27 migrations found in prisma/migrations
# Applying migration `0_init`
# Applying migration `20260123015816_add_v2_tables`
# ... (all 27 migrations)
# All migrations have been successfully applied.
```

### Running Production Seed (proposed script pattern)

```typescript
// scripts/seed-production.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { hashPassword } from '../src/lib/password.js';
import { seedDefaultFlags } from '../src/lib/feature-flags.js';
import { seedDefaultPointConfigs } from '../src/points/config.js';
import { DEFAULT_TEMPLATES } from '../src/email/template-fetcher.js';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Create admin account from env vars
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  if (!email || !password) {
    throw new Error('ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set');
  }

  const passwordHash = await hashPassword(password);
  await prisma.admin.upsert({
    where: { email },
    update: { passwordHash, role: 'SUPER_ADMIN' },
    create: { email, passwordHash, role: 'SUPER_ADMIN' },
  });
  console.log(`Admin created/updated: ${email}`);

  // 2. Seed feature flags (idempotent)
  await seedDefaultFlags();
  console.log('Feature flags seeded');

  // 3. Seed point configs (idempotent)
  await seedDefaultPointConfigs();
  console.log('Point configs seeded');

  // 4. Seed email templates (idempotent)
  await prisma.emailTemplate.createMany({
    data: DEFAULT_TEMPLATES,
    skipDuplicates: true,
  });
  console.log('Email templates seeded');

  console.log('\nProduction seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
```

### Verifying Migration Status

```bash
docker exec -it <express-container-name> npx prisma migrate status

# Expected output:
# Prisma schema loaded from prisma/schema.prisma
# Datasource "db": PostgreSQL database "postgres"
# 27 migrations found in prisma/migrations
# Database schema is up to date!
```

### Setting Coolify Env Vars via API

```bash
# Using Coolify API to update DATABASE_URL
curl -X PATCH http://82.180.160.120:8000/api/v1/applications/wcssogsgc00o8ocwcg4c0c00/envs \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "DATABASE_URL",
    "value": "postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true",
    "is_build_time": false,
    "is_preview": false
  }'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `prisma db push` | `prisma migrate deploy` | Phase 26 migration setup | Proper migration tracking, rollback capability |
| Single DATABASE_URL | Dual URL (DATABASE_URL + DIRECT_URL) | prisma.config.ts addition | Pooler for runtime, direct for migrations |
| Direct Supabase connection | Supavisor pooler (port 6543) | Supabase Supavisor launch | Connection pooling, better for containers |
| `prisma migrate save/up` | `prisma migrate dev/deploy` | Prisma 2.x+ | Modern migration workflow |

**Deprecated/outdated:**
- `prisma db push` for production: Still works but does not track migration state. Use `prisma migrate deploy` instead.
- Direct connection without pooler: Works but wastes connections. Use Supavisor pooler for runtime.

## Data to Seed (Exact Values)

### Admin Account
| Field | Value | Source |
|-------|-------|--------|
| email | From `ADMIN_SEED_EMAIL` env var | User provides |
| password | From `ADMIN_SEED_PASSWORD` env var | User provides |
| role | `SUPER_ADMIN` | Required for full access |

### Feature Flags (8 flags)
| Key | Default | Category | Description |
|-----|---------|----------|-------------|
| `require_introduction` | true | onboarding | Require intro message before full access |
| `send_claim_reminders` | true | email | Send reminder emails to unclaimed members |
| `send_billing_emails` | true | email | Send billing failure/recovery emails |
| `send_invite_emails` | true | email | Send team seat invitation emails |
| `auto_fix_reconciliation` | false | operations | Auto-fix drift in reconciliation |
| `enable_magic_links` | true | auth | Enable magic link login |
| `enable_team_signups` | true | billing | Allow company plan signups |
| `maintenance_mode` | false | general | Block all non-admin operations |

### Point Configs (4 configs)
| Action | Points | Label | Enabled |
|--------|--------|-------|---------|
| `benchmark_submission` | 50 | Benchmark Submission | true |
| `resource_download` | 5 | Resource Download | true |
| `discord_activity` | 1 | Discord Activity | true |
| `intro_completed` | 25 | Introduction Completed | true |

### Email Templates (10 templates)
| Name | Subject |
|------|---------|
| `welcome` | Welcome to The Revenue Council |
| `claim_reminder` | Thy Discord access awaits |
| `claim_reminder_cheeky` | We miss thee at The Revenue Council |
| `payment_failure` | Action needed: Payment issue with The Revenue Council |
| `payment_recovered` | Payment received - Welcome back! |
| `payment_recovered_debtor` | Payment received - Welcome back! |
| `seat_invite` | You're invited to join {{teamName}} at The Revenue Council |
| `reconciliation_report` | [TRC Reconciliation] {{issuesFound}} drift issue(s) detected |
| `password_reset` | Reset Thy Password - The Revenue Council |
| `password_reset_confirmation` | Thy Password Hath Been Changed - The Revenue Council |

## Open Questions

1. **Production Supabase project**
   - What we know: Currently using dev Supabase project. Need production database.
   - What's unclear: Does the user have a separate production Supabase project, or should the existing one be upgraded?
   - Recommendation: Ask user during planning. Either create new Supabase project or upgrade existing. Connection strings will need updating in Coolify env vars.

2. **Admin credentials for production**
   - What we know: `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` env vars exist in Zod schema but are unused.
   - What's unclear: What email/password the user wants for the production admin.
   - Recommendation: User provides these during execution. Must be strong password (8+ chars per Zod schema).

3. **tsx availability in production container**
   - What we know: tsx is a devDependency. The Dockerfile copies all node_modules from builder stage (not pruned).
   - What's unclear: Whether the full node_modules (including devDeps) survives into the production runner stage.
   - Recommendation: Verify with `docker exec <container> npx tsx --version` before relying on it. If unavailable, use compiled JS or Node directly.

4. **Coolify execute command API disabled**
   - What we know: The `/api/v1/applications/{uuid}/execute` endpoint is disabled (commented out in Coolify source) due to security concerns. Cannot programmatically exec into containers via API.
   - What's unclear: Whether it will be re-enabled.
   - Recommendation: Use SSH + `docker exec` directly on the server. User already has SSH access from Phase 39.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - `prisma.config.ts`, `src/config/env.ts`, `src/lib/prisma.ts`, all seed scripts, all admin API routes
- **Prisma schema** - `prisma/schema.prisma` with 27 migration files
- **Docker configuration** - `Dockerfile`, `docker-compose.prod.yml`

### Secondary (MEDIUM confidence)
- [Prisma: Development and Production](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production) - `migrate deploy` vs `migrate dev`
- [Supabase: Prisma Integration](https://supabase.com/docs/guides/database/prisma) - Connection string formats
- [Supabase: Connection Management](https://supabase.com/docs/guides/database/connection-management) - Pooler vs direct
- [Coolify: Docker Compose](https://coolify.io/docs/knowledge-base/docker/compose) - `exclude_from_hc`, deployment features
- [Coolify: Terminal](https://coolify.io/docs/knowledge-base/internal/terminal) - Web terminal for container access

### Tertiary (LOW confidence)
- [Coolify Execute Command Issue #5387](https://github.com/coollabsio/coolify/issues/5387) - API endpoint disabled, confirmed as of April 2025
- [Prisma Docker Guide](https://www.prisma.io/docs/guides/docker) - General Docker patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already in codebase, no new dependencies
- Architecture: HIGH - Connection patterns, migration approach well-documented in codebase and official docs
- Seed data: HIGH - Every seed function and default value directly inspected in source code
- Pitfalls: HIGH - Zod crash already encountered in Phase 39; migration pitfalls from official Prisma docs
- Coolify exec: MEDIUM - SSH + docker exec is standard Docker; Coolify API limitation confirmed via GitHub issue

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, no fast-moving dependencies)
