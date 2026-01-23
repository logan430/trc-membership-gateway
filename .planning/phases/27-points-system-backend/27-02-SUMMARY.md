---
phase: 27
plan: 02
subsystem: points
tags: [points, transactions, idempotency, service-layer]

dependency_graph:
  requires: [27-01]
  provides: [point-transaction-service, intro-points-integration]
  affects: [27-03, 28-01, 29-01, 30-01]

tech_stack:
  added: []
  patterns: [idempotent-awarding, metadata-based-deduplication, fire-and-forget-dm]

key_files:
  created:
    - src/points/service.ts
  modified:
    - src/lib/audit.ts
    - src/bot/events/introduction.ts

decisions:
  - id: 27-02-01
    decision: "Metadata-based idempotency for all award functions"
    rationale: "Uses JSONB path queries for flexible duplicate detection"
  - id: 27-02-02
    decision: "Fire-and-forget DM for admin point adjustments"
    rationale: "Consistent with existing patterns, DM failure shouldn't block operation"
  - id: 27-02-03
    decision: "Intro points awarded after DB update, before welcome DM"
    rationale: "Member must be marked introCompleted before points matter"

metrics:
  duration: "7 minutes"
  completed: "2026-01-23"
---

# Phase 27 Plan 02: Point Transaction Service Summary

**One-liner:** Idempotent points service with 5 award functions and intro completion integration using metadata-based duplicate prevention.

## What Was Built

### 1. Points Service Module

Created `src/points/service.ts` with comprehensive point awarding system:

**AwardResult Interface:**
```typescript
interface AwardResult {
  awarded: boolean;
  points: number;
  reason?: string;  // Why not awarded
}
```

**Award Functions:**

| Function | Idempotency Key | Description |
|----------|-----------------|-------------|
| `awardBenchmarkPoints(memberId, category)` | metadata.category | One award per category ever |
| `awardDownloadPoints(memberId, resourceId, title)` | metadata.resourceId | First download only |
| `awardIntroPoints(memberId)` | action type only | One-time per member |
| `awardDiscordPoints(memberId, xpDelta, syncId)` | metadata.syncId | Prevents duplicate syncs |
| `adminAdjustPoints({...})` | None (always executes) | Manual admin adjustments |

All configurable actions:
- Check `isActionEnabled()` before awarding
- Use `getPointValue()` for configured amounts
- Create PointTransaction with metadata
- Database trigger updates Member.totalPoints automatically

### 2. POINTS_ADJUSTED Audit Action

Added to `src/lib/audit.ts`:
```typescript
POINTS_ADJUSTED: 'POINTS_ADJUSTED',
```

Used by `adminAdjustPoints` with details:
- points (adjustment amount, can be negative)
- reason (optional)
- notifyMember (boolean)
- previousTotal / newTotal

### 3. Introduction Points Integration

Updated `src/bot/events/introduction.ts` to award points on promotion:

```typescript
// After database update, before welcome DM
const pointsResult = await awardIntroPoints(member.id);
if (pointsResult.awarded) {
  logger.debug(
    { memberId: member.id, points: pointsResult.points },
    'Intro points awarded'
  );
}
```

Placement reasoning:
1. Member must be marked introCompleted before points matter
2. Points trigger updates Member.totalPoints automatically
3. If role swap fails but intro is saved, points still awarded (acceptable)

## Key Code Patterns

### Metadata-Based Idempotency

```typescript
// Check for existing award with specific metadata value
const existing = await prisma.pointTransaction.findFirst({
  where: {
    memberId,
    action: PointAction.BENCHMARK_SUBMISSION,
    metadata: {
      path: ['category'],
      equals: category,
    },
  },
});
```

### Fire-and-Forget DM Notification

```typescript
if (notifyMember && member?.discordId) {
  sendPointsNotification(member.discordId, points, reason).catch((err) => {
    logger.debug(
      { error: err, discordId: member.discordId },
      'Failed to send points notification DM'
    );
  });
}
```

### Consistent Logging Pattern

```typescript
// Info level for actual awards
logger.info({ memberId, category, points }, 'Benchmark points awarded');

// Debug level for skipped/already-awarded
logger.debug({ memberId, category }, 'Benchmark points already awarded for category');
```

## Verification Results

1. **TypeScript:** Compiles without errors in plan files
2. **Server startup:** Starts successfully, no runtime errors
3. **Exports:** All 5 functions exported from service module
4. **Integration:** Introduction handler imports and calls awardIntroPoints

## Commits

| Commit | Description |
|--------|-------------|
| `138155f` | Points service with idempotent awarding |
| `7edd331` | POINTS_ADJUSTED audit action |
| `5146aea` | Intro points integration |

## Deviations from Plan

None - plan executed exactly as written.

## Next Steps

- **27-03:** Public points API endpoints (/api/points/values, /api/points/transactions, /api/points/leaderboard)
- **28-01:** Benchmark submission will call awardBenchmarkPoints
- **29-01:** Resource download will call awardDownloadPoints
- **30-01:** Discord activity sync will call awardDiscordPoints

## Files Changed

```
src/points/service.ts                  (+381 lines, new)
src/lib/audit.ts                       (+3 lines)
src/bot/events/introduction.ts         (+10 lines)
```
