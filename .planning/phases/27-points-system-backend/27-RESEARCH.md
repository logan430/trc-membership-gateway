# Phase 27: Points System Backend - Research

**Researched:** 2026-01-22
**Domain:** Point earning logic, idempotency patterns, admin adjustments, history APIs
**Confidence:** HIGH

## Summary

This phase builds the backend APIs for the points gamification system. Members earn points for community engagement actions: +50 for benchmark submission, +5 for resource download, +1 per 100 Discord XP, and +25 for introduction completion. The database foundation (PointTransaction table, Member.totalPoints field, database trigger) was created in Phase 26.

The core challenge is implementing idempotent point awarding that prevents gaming (submit-delete-resubmit) while supporting admin adjustments that are audit-logged but hidden from member view. Point values must be admin-configurable via the existing FeatureFlag-style pattern.

**Key constraints from CONTEXT.md:**
- One point award per benchmark category ever (prevents gaming)
- First download only awards points per resource (re-downloads free)
- Points once earned stay - no reversals for legitimate deletions
- Admin adjustments hidden from member's point history
- Point values admin-configurable (not hardcoded), changes apply forward-only
- Point values hidden from members (discovery through earning)

**Primary recommendation:** Extend existing patterns (StripeEvent idempotency, AuditLog, FeatureFlag) to create a PointConfig model for admin-configurable values, a dedicated points service layer for awarding logic, and member-facing history APIs filtered to exclude admin adjustments.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | 5.x | API routing | Already in use for all routes |
| Prisma | 7.2.0 | Database ORM | Already in use, typed queries |
| Zod | 3.x | Request validation | Already used in all admin routes |
| pino | 8.x | Structured logging | Already configured in index.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Database trigger | N/A | Auto-update Member.totalPoints | Already created in Phase 26 |
| AuditLog model | N/A | Admin action tracking | Already in use |
| FeatureFlag model | N/A | Config pattern reference | Adapt pattern for PointConfig |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PointConfig model | FeatureFlag table | Would need boolean + value fields, cleaner to have dedicated model |
| Transaction metadata | Separate deduplication table | Metadata JSON is flexible enough, avoid extra table |

## Architecture Patterns

### Recommended Project Structure
```
src/
  points/
    config.ts          # Point value configuration with caching
    service.ts         # Core awarding logic with idempotency
    types.ts           # TypeScript types for point actions
  routes/
    points.ts          # Member-facing history API
    admin/
      points.ts        # Admin adjustment API
```

### Pattern 1: Point Awarding with Metadata-Based Idempotency

**What:** Use PointTransaction.metadata to store deduplication keys, check before awarding.

**When to use:** All point-earning actions (benchmark, download, intro, Discord XP).

**Example:**
```typescript
// Idempotency key patterns for each action type:
// benchmark_submission: { category: "COMPENSATION", memberId: "..." }
// resource_download:    { resourceId: "...", memberId: "..." }
// intro_completed:      { memberId: "..." }  // one-time ever
// discord_activity:     { syncId: "2026-01-22-batch-123", memberId: "..." }

async function awardPointsIdempotent(params: {
  memberId: string;
  action: string;
  points: number;
  idempotencyKey: Record<string, string>;
  metadata?: Record<string, unknown>;
}): Promise<{ awarded: boolean; reason?: string }> {
  // Check for existing transaction with matching idempotency key
  const existing = await prisma.pointTransaction.findFirst({
    where: {
      memberId: params.memberId,
      action: params.action,
      metadata: {
        path: [], // Root level check
        equals: params.idempotencyKey,
      },
    },
  });

  if (existing) {
    return { awarded: false, reason: 'Already awarded' };
  }

  // Award points (trigger handles totalPoints update)
  await prisma.pointTransaction.create({
    data: {
      memberId: params.memberId,
      action: params.action,
      points: params.points,
      metadata: {
        ...params.idempotencyKey,
        ...params.metadata,
        awardedAt: new Date().toISOString(),
      },
    },
  });

  return { awarded: true };
}
```

**Why metadata-based:**
- No separate deduplication table needed
- Flexible keys per action type
- Queryable via Prisma JSON filters

### Pattern 2: Admin Adjustments with Separate Action Type

**What:** Use distinct action type for admin adjustments, filter out in member-facing APIs.

**When to use:** Admin points endpoint.

**Example:**
```typescript
// Service layer
async function adminAdjustPoints(params: {
  memberId: string;
  points: number;  // Can be positive or negative
  reason?: string;
  notifyMember: boolean;
  adminId: string;
}): Promise<void> {
  // Create point transaction with admin_adjustment action
  await prisma.pointTransaction.create({
    data: {
      memberId: params.memberId,
      action: 'admin_adjustment',
      points: params.points,
      metadata: {
        reason: params.reason,
        adminId: params.adminId,
        notifyMember: params.notifyMember,
      },
    },
  });

  // Audit log entry (visible to admins)
  await logAuditEvent({
    action: 'POINTS_ADJUSTED',
    entityType: 'Member',
    entityId: params.memberId,
    details: {
      points: params.points,
      reason: params.reason,
      notifyMember: params.notifyMember,
    },
    performedBy: params.adminId,
  });

  // Optional: notify member via Discord DM
  if (params.notifyMember && params.points !== 0) {
    // Fire-and-forget notification
    notifyMemberPointsAdjusted(params.memberId, params.points).catch(() => {});
  }
}

// Member-facing history API - EXCLUDES admin_adjustment
async function getMemberPointHistory(memberId: string, options: {
  type?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ transactions: PointTransaction[]; nextCursor: string | null }> {
  const transactions = await prisma.pointTransaction.findMany({
    where: {
      memberId,
      action: { not: 'admin_adjustment' }, // Hidden from member view
      ...(options.type ? { action: options.type } : {}),
    },
    take: (options.limit ?? 50) + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { id: options.cursor } : undefined,
    orderBy: { createdAt: 'desc' },
  });

  const hasMore = transactions.length > (options.limit ?? 50);
  const results = hasMore ? transactions.slice(0, options.limit ?? 50) : transactions;

  return {
    transactions: results,
    nextCursor: hasMore ? results[results.length - 1].id : null,
  };
}
```

### Pattern 3: Point Configuration Model

**What:** Database-driven point values that admins can configure via admin panel.

**When to use:** Instead of hardcoded point values.

**Example schema addition:**
```prisma
// Extend schema.prisma
model PointConfig {
  id        String   @id @default(cuid())
  action    String   @unique  // "benchmark_submission", "resource_download", etc.
  points    Int                // Point value
  enabled   Boolean  @default(true)  // Toggle per action
  label     String             // Human-readable: "Benchmark Submission"
  updatedAt DateTime @updatedAt
  updatedBy String?            // Admin ID
}
```

**Example service with caching:**
```typescript
// src/points/config.ts
let configCache: Map<string, { points: number; enabled: boolean }> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000; // 1 minute (same as feature flags)

export async function getPointValue(action: string): Promise<number> {
  await ensureCacheValid();
  const config = configCache?.get(action);
  if (!config || !config.enabled) return 0;
  return config.points;
}

export async function isActionEnabled(action: string): Promise<boolean> {
  await ensureCacheValid();
  return configCache?.get(action)?.enabled ?? false;
}

async function ensureCacheValid(): Promise<void> {
  if (configCache && Date.now() < cacheExpiry) return;

  const configs = await prisma.pointConfig.findMany();
  configCache = new Map(configs.map(c => [c.action, { points: c.points, enabled: c.enabled }]));
  cacheExpiry = Date.now() + CACHE_TTL;
}

export function invalidateConfigCache(): void {
  configCache = null;
  cacheExpiry = 0;
}

// Default values for seeding
export const DEFAULT_POINT_CONFIG = [
  { action: 'benchmark_submission', points: 50, label: 'Benchmark Submission' },
  { action: 'resource_download', points: 5, label: 'Resource Download' },
  { action: 'discord_activity', points: 1, label: 'Discord XP (per 100)' },
  { action: 'intro_completed', points: 25, label: 'Introduction Completed' },
];
```

### Pattern 4: Total Points Floor at Zero

**What:** Prevent negative total points by flooring at zero in the member query, not the transaction.

**When to use:** When displaying member's total points.

**Claude's Discretion Resolution:** Floor at zero for display, allow negative in database.

**Example:**
```typescript
// When returning member points, floor at zero
function displayPoints(totalPoints: number): number {
  return Math.max(0, totalPoints);
}

// In API response
res.json({
  member: {
    totalPoints: displayPoints(member.totalPoints),
    // ...
  },
});
```

**Why allow negative in DB:**
- Preserves audit trail integrity
- Admin can see if member was over-deducted
- Positive points awarded later will restore correctly

### Anti-Patterns to Avoid

- **Recalculating totalPoints on every request:** Use the database trigger; Member.totalPoints is always current
- **Deleting PointTransactions to reverse points:** Add negative transaction instead; ledger is immutable
- **Exposing admin adjustments to members:** Filter out action='admin_adjustment' in member-facing APIs
- **Hardcoding point values:** Use PointConfig model; allows runtime changes
- **Checking idempotency after insert:** Check BEFORE to prevent race conditions

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Points total calculation | SUM() query on every request | Member.totalPoints (trigger-updated) | O(1) vs O(n) |
| Audit logging | Custom logging | Existing logAuditEvent() | Consistent format, already indexed |
| Cursor pagination | Offset pagination | Existing pattern from adminAuditRouter | Efficient for large datasets |
| Request validation | Manual if/else | Zod schemas | Type-safe, consistent error format |
| Config caching | No cache / rebuild on every request | 1-minute TTL cache (FeatureFlag pattern) | Balance freshness with performance |

**Key insight:** Phase 26's database trigger means awarding points is just `prisma.pointTransaction.create()` - the Member.totalPoints update is automatic and atomic.

## Common Pitfalls

### Pitfall 1: Race Condition in Idempotency Check

**What goes wrong:** Two concurrent requests both pass idempotency check, both award points.

**Why it happens:** Check-then-insert without transaction or unique constraint.

**How to avoid:**
1. Use unique constraint on metadata JSON path (PostgreSQL-specific)
2. OR use optimistic locking with findFirst + create in transaction
3. OR accept rare duplicates and dedupe in a reconciliation job

**Recommended approach for this codebase:**
```typescript
// Use transaction with isolation level
await prisma.$transaction(async (tx) => {
  const existing = await tx.pointTransaction.findFirst({
    where: { memberId, action, metadata: { equals: idempotencyKey } },
  });
  if (existing) throw new Error('Duplicate');
  await tx.pointTransaction.create({ data: { ... } });
}, { isolationLevel: 'Serializable' });
```

**Warning signs:** Duplicate point transactions for same action appearing in history.

### Pitfall 2: Discord XP Award Granularity

**What goes wrong:** Member has 350 XP, sync runs, gets 3 points. Later has 380 XP, sync runs, formula says 3 points but they already have 3.

**Why it happens:** Rounding/flooring without tracking awarded vs earned.

**How to avoid:** Track `lastAwardedXp` alongside `xpTotal`:
```typescript
// In DiscordActivity or separate tracking
// Award: floor(xpTotal / 100) - floor(lastAwardedXp / 100)
// This ensures granular awards without double-counting
```

**Warning signs:** Members with 150 XP have 1 point, members with 199 XP have 1 point (correct), but members crossing thresholds get nothing.

### Pitfall 3: Benchmark Category Duplication

**What goes wrong:** Member submits COMPENSATION benchmark, gets 50 points. Deletes it, submits again, gets another 50 points.

**Why it happens:** Idempotency only checked submission existence, not historical award.

**How to avoid:** Idempotency key includes category AND is checked regardless of current submission existence:
```typescript
// Check for ANY previous award for this category
const existing = await prisma.pointTransaction.findFirst({
  where: {
    memberId,
    action: 'benchmark_submission',
    metadata: { path: ['category'], equals: category },
  },
});
```

**Warning signs:** PointTransactions with same memberId, action='benchmark_submission', and category appearing multiple times.

### Pitfall 4: Admin Adjustment Leaking to Member

**What goes wrong:** Member sees "-10 points: Admin adjustment" in their history, feels demotivated.

**Why it happens:** Forgot to filter action='admin_adjustment' in member-facing query.

**How to avoid:**
1. Default filter in service layer (not route handler)
2. Unit test that member history excludes admin_adjustment
3. Admin-only route for full history including adjustments

**Warning signs:** Member complaints about unexplained point changes; QA sees admin_adjustment in member portal.

### Pitfall 5: Point Config Not Seeded

**What goes wrong:** getPointValue('benchmark_submission') returns 0 in production; no points awarded.

**Why it happens:** PointConfig table empty; seed not run after migration.

**How to avoid:**
1. Migration includes seed data for defaults
2. getPointValue throws if config missing (fail loud)
3. Admin panel shows warning if any action has no config

**Warning signs:** Members earning actions but point history is empty.

## Code Examples

Verified patterns adapted from existing codebase.

### Point Action Types Enum
```typescript
// src/points/types.ts
export const PointAction = {
  BENCHMARK_SUBMISSION: 'benchmark_submission',
  RESOURCE_DOWNLOAD: 'resource_download',
  DISCORD_ACTIVITY: 'discord_activity',
  INTRO_COMPLETED: 'intro_completed',
  ADMIN_ADJUSTMENT: 'admin_adjustment',
} as const;

export type PointActionType = (typeof PointAction)[keyof typeof PointAction];

// Human-readable labels for UI
export const PointActionLabels: Record<PointActionType, string> = {
  benchmark_submission: 'Benchmark Submission',
  resource_download: 'Resource Download',
  discord_activity: 'Discord Activity',
  intro_completed: 'Introduction Completed',
  admin_adjustment: 'Admin Adjustment',
};
```

### Points Service Core
```typescript
// src/points/service.ts
import { prisma } from '../lib/prisma.js';
import { getPointValue, isActionEnabled } from './config.js';
import { PointAction } from './types.js';
import { logger } from '../index.js';

interface AwardResult {
  awarded: boolean;
  points: number;
  reason?: string;
}

/**
 * Award points for benchmark submission
 * Idempotent: one award per category per member, ever
 */
export async function awardBenchmarkPoints(
  memberId: string,
  category: string
): Promise<AwardResult> {
  if (!await isActionEnabled(PointAction.BENCHMARK_SUBMISSION)) {
    return { awarded: false, points: 0, reason: 'Action disabled' };
  }

  // Check if already awarded for this category (ever)
  const existing = await prisma.pointTransaction.findFirst({
    where: {
      memberId,
      action: PointAction.BENCHMARK_SUBMISSION,
      metadata: { path: ['category'], equals: category },
    },
  });

  if (existing) {
    return { awarded: false, points: 0, reason: 'Already awarded for this category' };
  }

  const points = await getPointValue(PointAction.BENCHMARK_SUBMISSION);

  await prisma.pointTransaction.create({
    data: {
      memberId,
      action: PointAction.BENCHMARK_SUBMISSION,
      points,
      metadata: {
        category,
        awardedAt: new Date().toISOString(),
      },
    },
  });

  logger.info({ memberId, category, points }, 'Benchmark points awarded');
  return { awarded: true, points };
}

/**
 * Award points for resource download
 * Idempotent: one award per resource per member
 */
export async function awardDownloadPoints(
  memberId: string,
  resourceId: string,
  resourceTitle: string
): Promise<AwardResult> {
  if (!await isActionEnabled(PointAction.RESOURCE_DOWNLOAD)) {
    return { awarded: false, points: 0, reason: 'Action disabled' };
  }

  const existing = await prisma.pointTransaction.findFirst({
    where: {
      memberId,
      action: PointAction.RESOURCE_DOWNLOAD,
      metadata: { path: ['resourceId'], equals: resourceId },
    },
  });

  if (existing) {
    return { awarded: false, points: 0, reason: 'Already awarded for this resource' };
  }

  const points = await getPointValue(PointAction.RESOURCE_DOWNLOAD);

  await prisma.pointTransaction.create({
    data: {
      memberId,
      action: PointAction.RESOURCE_DOWNLOAD,
      points,
      metadata: {
        resourceId,
        resourceTitle,
        awardedAt: new Date().toISOString(),
      },
    },
  });

  logger.info({ memberId, resourceId, points }, 'Download points awarded');
  return { awarded: true, points };
}

/**
 * Award points for introduction completion
 * Idempotent: once per member, ever
 */
export async function awardIntroPoints(memberId: string): Promise<AwardResult> {
  if (!await isActionEnabled(PointAction.INTRO_COMPLETED)) {
    return { awarded: false, points: 0, reason: 'Action disabled' };
  }

  const existing = await prisma.pointTransaction.findFirst({
    where: {
      memberId,
      action: PointAction.INTRO_COMPLETED,
    },
  });

  if (existing) {
    return { awarded: false, points: 0, reason: 'Already awarded' };
  }

  const points = await getPointValue(PointAction.INTRO_COMPLETED);

  await prisma.pointTransaction.create({
    data: {
      memberId,
      action: PointAction.INTRO_COMPLETED,
      points,
      metadata: {
        awardedAt: new Date().toISOString(),
      },
    },
  });

  logger.info({ memberId, points }, 'Intro points awarded');
  return { awarded: true, points };
}
```

### Member History API Route
```typescript
// src/routes/points.ts
import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';
import { PointAction, PointActionLabels } from '../points/types.js';

export const pointsRouter = Router();

const historyQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  type: z.string().optional(),
});

/**
 * GET /api/points/history
 * Member's point transaction history (excludes admin adjustments)
 */
pointsRouter.get('/history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const query = historyQuerySchema.parse(req.query);

  const transactions = await prisma.pointTransaction.findMany({
    where: {
      memberId: req.memberId,
      action: { not: PointAction.ADMIN_ADJUSTMENT }, // Hidden from member
      ...(query.type ? { action: query.type } : {}),
    },
    take: query.limit + 1,
    skip: query.cursor ? 1 : 0,
    cursor: query.cursor ? { id: query.cursor } : undefined,
    orderBy: { createdAt: 'desc' },
  });

  const hasMore = transactions.length > query.limit;
  const results = hasMore ? transactions.slice(0, query.limit) : transactions;

  res.json({
    transactions: results.map(t => ({
      id: t.id,
      action: t.action,
      actionLabel: PointActionLabels[t.action as keyof typeof PointActionLabels] || t.action,
      points: t.points,
      metadata: t.metadata,
      createdAt: t.createdAt,
    })),
    nextCursor: hasMore ? results[results.length - 1].id : null,
    hasMore,
  });
});

/**
 * GET /api/points/summary
 * Member's point summary (total, breakdown by type)
 */
pointsRouter.get('/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
    select: { totalPoints: true },
  });

  // Group by action type (exclude admin_adjustment from display breakdown)
  const breakdown = await prisma.pointTransaction.groupBy({
    by: ['action'],
    where: {
      memberId: req.memberId,
      action: { not: PointAction.ADMIN_ADJUSTMENT },
    },
    _sum: { points: true },
  });

  res.json({
    totalPoints: Math.max(0, member?.totalPoints ?? 0), // Floor at zero for display
    breakdown: breakdown.map(b => ({
      action: b.action,
      actionLabel: PointActionLabels[b.action as keyof typeof PointActionLabels] || b.action,
      points: b._sum.points ?? 0,
    })),
  });
});
```

### Admin Points Adjustment Route
```typescript
// src/routes/admin/points.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../admin/middleware.js';
import { prisma } from '../../lib/prisma.js';
import { logAuditEvent } from '../../lib/audit.js';
import { PointAction } from '../../points/types.js';
import { logger } from '../../index.js';

export const adminPointsRouter = Router();

const adjustPointsSchema = z.object({
  points: z.number().int(), // Can be negative
  reason: z.string().optional(),
  notifyMember: z.boolean().default(false),
});

/**
 * POST /api/admin/members/:id/points/adjust
 * Admin adjusts member's points
 */
adminPointsRouter.post('/:id/points/adjust', requireAdmin, async (req, res) => {
  const memberId = req.params.id;
  const admin = res.locals.admin!;

  try {
    const { points, reason, notifyMember } = adjustPointsSchema.parse(req.body);

    // Verify member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // Create adjustment transaction (trigger updates totalPoints)
    await prisma.pointTransaction.create({
      data: {
        memberId,
        action: PointAction.ADMIN_ADJUSTMENT,
        points,
        metadata: {
          reason,
          adminId: admin.id,
          notifyMember,
          adjustedAt: new Date().toISOString(),
        },
      },
    });

    // Audit log
    await logAuditEvent({
      action: 'POINTS_ADJUSTED',
      entityType: 'Member',
      entityId: memberId,
      details: {
        points,
        reason,
        notifyMember,
        previousTotal: member.totalPoints,
        newTotal: member.totalPoints + points,
      },
      performedBy: admin.id,
    });

    logger.info(
      { memberId, adminId: admin.id, points, reason },
      'Admin adjusted member points'
    );

    // Fetch updated member
    const updated = await prisma.member.findUnique({
      where: { id: memberId },
      select: { totalPoints: true },
    });

    res.json({
      success: true,
      newTotal: updated?.totalPoints ?? 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.issues });
      return;
    }
    throw error;
  }
});

/**
 * GET /api/admin/members/:id/points/history
 * Full point history including admin adjustments (admin only)
 */
adminPointsRouter.get('/:id/points/history', requireAdmin, async (req, res) => {
  const memberId = req.params.id;

  const transactions = await prisma.pointTransaction.findMany({
    where: { memberId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  res.json({
    transactions,
  });
});
```

### Integration with Existing Introduction Handler
```typescript
// In src/bot/events/introduction.ts, add to promoteAfterIntro():
import { awardIntroPoints } from '../../points/service.js';

async function promoteAfterIntro(
  member: Member,
  guildMember: GuildMember,
  messageId: string
): Promise<void> {
  // ... existing role swap logic ...

  // Award intro points (idempotent - safe to call multiple times)
  const result = await awardIntroPoints(member.id);
  if (result.awarded) {
    logger.debug({ memberId: member.id, points: result.points }, 'Intro points awarded');
  }

  // ... existing database update and DM logic ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded point values | Database-configurable | Always available | Runtime changes without redeploy |
| SUM() on every leaderboard | Denormalized + trigger | Phase 26 | O(1) reads |
| Delete transactions to reverse | Add negative transaction | Ledger pattern | Audit trail preserved |

**Deprecated/outdated:**
- None for this domain (new v2.0 feature)

## Open Questions

Things that couldn't be fully resolved:

1. **Discord XP Sync Frequency**
   - What we know: MEE6 API provides XP data, need to convert to points
   - What's unclear: How often should sync run? Is MEE6 API rate-limited?
   - Recommendation: Start with daily batch sync (Phase 30 covers MEE6 integration)

2. **Notification Mechanism for Admin Adjustments**
   - What we know: Admin can choose to notify member
   - What's unclear: Via Discord DM? Via email? Both?
   - Recommendation: Discord DM only (consistent with existing patterns like guidance DM)

3. **PointConfig Migration Timing**
   - What we know: Need PointConfig table for configurable values
   - What's unclear: Add in Phase 27 or was it supposed to be Phase 26?
   - Recommendation: Add as first plan in Phase 27 (minimal migration, single table)

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/webhooks/stripe.ts` - Idempotency pattern via StripeEvent
- Existing codebase: `src/lib/audit.ts` - Audit logging pattern
- Existing codebase: `src/lib/feature-flags.ts` - Config caching pattern
- Existing codebase: `src/routes/admin/members.ts` - Cursor pagination pattern
- Existing codebase: `src/routes/admin/access.ts` - Admin action with reason pattern
- Phase 26 Research: `26-RESEARCH.md` - Database trigger implementation
- Migration: `prisma/migrations/20260123015834_add_points_trigger/migration.sql` - Actual trigger SQL

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions: Point earning edge cases, history API design, admin adjustment flow
- STATE.md: Prior decisions on trigger timing, lastActiveAt behavior

### Tertiary (LOW confidence)
- None - all patterns derived from existing verified codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use in codebase
- Architecture: HIGH - All patterns adapted from existing production code
- Pitfalls: HIGH - Derived from codebase patterns and CONTEXT.md constraints

**Research date:** 2026-01-22
**Valid until:** 2026-04-22 (90 days - internal patterns, unlikely to change)

---

**Key Files for This Phase:**
- `src/lib/audit.ts` - Audit logging pattern to extend
- `src/lib/feature-flags.ts` - Config caching pattern to adapt
- `src/webhooks/stripe.ts` - Idempotency pattern reference
- `src/routes/admin/access.ts` - Admin action pattern (reason, audit, response)
- `src/routes/admin/audit.ts` - Cursor pagination pattern
- `src/bot/events/introduction.ts` - Integration point for intro points
- `prisma/migrations/20260123015834_add_points_trigger/migration.sql` - Trigger implementation
