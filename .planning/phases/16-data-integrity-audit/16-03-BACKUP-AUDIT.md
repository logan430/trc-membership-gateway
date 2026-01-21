# Phase 16: Backup Procedure Audit

**Document:** 16-03-BACKUP-AUDIT.md
**Purpose:** Close Phase 16 success criterion #6: "Backup procedures documented"
**Created:** 2026-01-21
**Last Updated:** 2026-01-21

---

## Executive Summary

This document audits and documents the backup procedures for The Revenue Council membership application. The application uses **Supabase** for its PostgreSQL database, which provides managed backup services requiring no user configuration.

**Key Findings:**
- Supabase provides automatic daily backups with 7-day retention (free tier)
- Point-in-time recovery (PITR) available on Pro plan and above
- Stripe subscription data is NOT in database backups (Stripe is source of truth per 16-02 audit)
- Discord role state is NOT in database backups (reconciliation job handles drift)
- Current backup coverage is adequate for project needs

---

## Supabase Managed Backup Features

### Automatic Daily Backups

Supabase automatically performs daily backups of all PostgreSQL databases. This is a **managed infrastructure feature** - no user configuration required.

**What is included in backups:**
- All database tables (Member, Team, StripeEvent, PendingInvite, Admin, etc.)
- All indexes and constraints
- Stored procedures and functions
- Supabase Auth users (authentication identities)
- Database roles and permissions

**What is NOT included in database backups:**
- Supabase Storage files (separate backup system, limited on free tier)
- Edge Functions code (stored in git/deployment)
- Project configuration (Settings, environment variables)

### Point-in-Time Recovery (PITR)

Available on Pro plan and above, PITR enables recovery to any specific point within the retention window.

**Use cases for PITR:**
- Accidental bulk data deletion
- Corrupted data from application bugs
- Rolling back to state before a problematic migration
- Forensic analysis of data changes

**PITR technical details:**
- Uses PostgreSQL WAL (Write-Ahead Log) streaming
- Sub-second granularity within retention window
- Can restore to a new database or replace existing

---

## Backup Schedule

| Plan Tier | Backup Type | Schedule | Retention |
|-----------|-------------|----------|-----------|
| Free | Automatic daily | Once per 24 hours | 7 days |
| Pro | Automatic daily + PITR | Continuous WAL + daily | 7 days (PITR: 7 days) |
| Team | Automatic daily + PITR | Continuous WAL + daily | 14 days (PITR: 14 days) |
| Enterprise | Automatic daily + PITR | Continuous WAL + daily | Custom (up to 30+ days) |

**Current project status:** Assumed Free tier during development. Recommend Pro tier for production for PITR capability.

---

## Retention Policy by Plan Tier

### Free Tier (Current Development)

- **Retention:** 7 daily backups rolling
- **Recovery window:** Can restore to any of the last 7 days (daily snapshots only)
- **Granularity:** Daily (24-hour increments)
- **Limitation:** Cannot recover to a specific time within a day

### Pro Tier (Recommended for Production)

- **Retention:** 7 days PITR + 7 daily backups
- **Recovery window:** Any point in last 7 days with second-level precision
- **Granularity:** Continuous (sub-second)
- **Cost:** $25/month base + compute

### Team/Enterprise Tier

- **Retention:** 14+ days PITR
- **Additional features:** Extended retention, dedicated support, custom recovery options

---

## Data Recovery Procedures

### Option 1: Recovery via Supabase Dashboard

**For daily backup restore:**

1. Navigate to Supabase Dashboard (https://supabase.com/dashboard)
2. Select the project
3. Go to **Settings** > **Database** > **Backups**
4. View available backup snapshots (last 7 days)
5. Click **Restore** on the desired backup
6. Choose restore type:
   - **New project:** Creates a new database with restored data (safer, allows comparison)
   - **Replace current:** Overwrites current database (destructive)
7. Confirm and wait for restoration (time varies by database size)

**For PITR (Pro plan only):**

1. Navigate to **Settings** > **Database** > **Point in Time Recovery**
2. Select exact date and time to restore to
3. Preview affected data changes (if available)
4. Execute restoration
5. Verify data integrity after restore

### Option 2: Manual Backup via pg_dump

For additional backup control, you can create manual backups using `pg_dump`:

```bash
# Connection string format (from Supabase Settings > Database)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Or compressed
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

**Recommended manual backup schedule:**
- Before any production migration
- Before bulk data operations
- Weekly exports for offsite storage

### Option 3: Schema-Only Backup via Prisma

The Prisma schema and migrations serve as a schema backup:

```bash
# Schema is version controlled in:
prisma/schema.prisma      # Current schema definition
prisma/migrations/        # Migration history

# Generate schema from existing database
npx prisma db pull
```

**Seed data reference:**
```bash
# Reference data is in:
prisma/seed.ts           # Seed script for admin user and test data
```

---

## Disaster Recovery Scenario Steps

### Scenario: Database Corruption or Loss

**Step 1: Assess Impact**
- Identify what data is affected
- Determine time of corruption/loss
- Check if PITR can target a specific recovery point

**Step 2: Choose Recovery Method**

| Scenario | Recommended Method |
|----------|-------------------|
| Full database loss | Supabase dashboard restore from daily backup |
| Specific data corruption | PITR to time before corruption (Pro plan) |
| Accidental delete (recent) | PITR to minutes before delete (Pro plan) |
| Schema mismatch after migration | Rollback migration + restore if needed |

**Step 3: Execute Recovery**

1. **Notify team** of impending downtime
2. **Stop application services** to prevent further writes
3. **Execute restore** via chosen method
4. **Wait for completion** (monitor Supabase dashboard)
5. **Verify restoration** (check record counts, sample queries)

**Step 4: Post-Recovery Verification**

1. **Database connectivity:**
   ```bash
   npx prisma db pull  # Verify schema matches
   ```

2. **Run application health checks:**
   ```bash
   npm run dev  # Start application
   # Test key endpoints
   ```

3. **Verify Stripe synchronization:**
   - Active subscriptions may have events that occurred during downtime
   - Run manual reconciliation or wait for next scheduled sync

4. **Verify Discord roles:**
   - Run Discord reconciliation job
   - Check that member roles match subscription status

---

## Post-Recovery Checklist

After any database restoration, complete the following verification steps:

- [ ] Application connects to database successfully
- [ ] Prisma migrations match restored schema (`npx prisma migrate status`)
- [ ] Admin can log in to admin dashboard
- [ ] Member authentication works (login flow)
- [ ] Active subscriptions in database align with Stripe (spot check 3-5 members)
- [ ] Discord bot connects and can read roles
- [ ] Discord reconciliation job runs without errors
- [ ] Webhook endpoint receives and processes test event
- [ ] Key user flows work: signup, claim, dashboard access

---

## External Service Data

### Stripe (Source of Truth)

Per the 16-02 Transaction and Idempotency Audit, **Stripe is the source of truth** for subscription data:

- Subscription status
- Payment history
- Customer billing details
- Seat counts

**Recovery implication:** If database is restored to an earlier state, subscription data can be re-synchronized from Stripe. The webhook handler will re-process any missed events (idempotency via StripeEvent table prevents duplicates).

**Stripe data recovery:**
1. Database restoration may cause `StripeEvent` table to lose recent event records
2. Re-play events from Stripe webhook logs (Stripe Dashboard > Developers > Webhooks > Logs)
3. Or rely on next recurring webhook events to re-sync status

### Discord

Discord role assignments live in Discord, not in the database. The database stores:
- `discordId` - member's Discord user ID
- `previousRole` - for billing recovery role restoration

**Recovery implication:** Discord roles are not affected by database restoration. However, database state determines what roles SHOULD be assigned.

**Discord reconciliation:**
After database restore, run the reconciliation job to ensure Discord roles match database state:
```bash
# Reconciliation runs automatically via scheduled job
# Or trigger manually through application
```

---

## Recommendations

### For Development/Free Tier

1. **Rely on Supabase daily backups** - adequate for development
2. **Run manual pg_dump before schema migrations** - extra safety
3. **Keep prisma/seed.ts updated** - reference data for fresh starts

### For Production (Recommended)

1. **Upgrade to Supabase Pro tier** - PITR is essential for production recovery options
2. **Establish backup verification routine** - monthly test restores to verify backup integrity
3. **Document RTO/RPO:**
   - Recovery Time Objective (RTO): 1-2 hours (Supabase restore + verification)
   - Recovery Point Objective (RPO):
     - Free tier: up to 24 hours data loss
     - Pro tier: seconds to minutes data loss (PITR)

4. **Offsite backup** - weekly pg_dump exports to separate storage (S3, Google Cloud, etc.)

5. **Alert on backup failures** - Supabase Pro provides backup status notifications

---

## Audit Findings Summary

| Criterion | Status | Notes |
|-----------|--------|-------|
| Backup schedule documented | VERIFIED | Daily automatic backups by Supabase |
| Retention policy documented | VERIFIED | 7 days (free), extended with higher tiers |
| Recovery procedures documented | VERIFIED | Dashboard restore, PITR, manual pg_dump |
| External service data documented | VERIFIED | Stripe is source of truth, Discord reconciled |
| Disaster recovery steps documented | VERIFIED | Step-by-step scenario recovery guide |

**Conclusion:** Supabase's managed backup infrastructure provides adequate data protection for this application. The database mirrors Stripe (source of truth), meaning subscription data is recoverable from Stripe even without database backups. Discord state is reconciled via scheduled job, independent of database backups.

**Phase 16 Success Criterion #6:** SATISFIED - Backup procedures are now documented.

---

*Audited: 2026-01-21*
*Auditor: Claude (gsd-plan-executor)*
