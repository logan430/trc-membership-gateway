---
phase: 27
plan: 03
subsystem: points
tags: [points, api, member-endpoints, admin-endpoints, pagination]

dependency_graph:
  requires: [27-01, 27-02]
  provides: [member-points-api, admin-points-api]
  affects: [28, 29, 30, 31]

tech_stack:
  added: []
  patterns: [cursor-pagination, zod-validation, action-label-mapping]

key_files:
  created:
    - src/routes/points.ts
    - src/routes/admin/points.ts
  modified:
    - src/index.ts

decisions:
  - id: 27-03-01
    decision: "Admin adjustments hidden from member history endpoint"
    rationale: "Preserves the 'earned' feeling per CONTEXT.md"
  - id: 27-03-02
    decision: "Points summary floors at zero for display"
    rationale: "Negative total possible via admin adjustments but shows as 0 to member"
  - id: 27-03-03
    decision: "Values endpoint sorted by points descending"
    rationale: "Highest value actions shown first for clarity"

metrics:
  duration: "5 minutes"
  completed: "2026-01-23"
---

# Phase 27 Plan 03: Public Points API Endpoints Summary

**One-liner:** Member and admin API endpoints for point history, values, summary, and admin adjustments with cursor pagination.

## What Was Built

### 1. Member Points API (src/routes/points.ts)

Three authenticated endpoints for members to view their points:

**GET /api/points/history**
- Paginated transaction history with cursor pagination
- Filters out `admin_adjustment` transactions (hidden from member view)
- Optional `type` filter for specific action types
- Returns transactions with human-readable `actionLabel`

**GET /api/points/values**
- Returns enabled point action values for transparency
- Filters out disabled actions and `admin_adjustment`
- Sorted by points descending (highest value first)
- Supports "How to earn points" UI display

**GET /api/points/summary**
- Total points (floored at 0 for display)
- Breakdown by action type with sum of points
- Excludes `admin_adjustment` from breakdown

### 2. Admin Points API (src/routes/admin/points.ts)

Two admin endpoints for points management:

**POST /api/admin/members/:id/points/adjust**
- Adjust member points (positive or negative)
- Optional reason for audit trail
- Optional `notifyMember` to send Discord DM
- Creates PointTransaction and AuditLog entries
- Returns new total points

**GET /api/admin/members/:id/points/history**
- Full point history INCLUDING admin adjustments
- Same pagination pattern as member endpoint
- Shows complete transaction metadata

### 3. Route Mounting (src/index.ts)

Added imports and route mounts:
- `pointsRouter` at `/api/points` for member endpoints
- `adminPointsRouter` at `/api/admin/members` for admin endpoints

## Key Code Patterns

### Cursor Pagination (matching audit.ts pattern)

```typescript
const transactions = await prisma.pointTransaction.findMany({
  take: query.limit + 1, // Fetch one extra to detect hasMore
  skip: query.cursor ? 1 : 0,
  cursor: query.cursor ? { id: query.cursor } : undefined,
  where,
  orderBy: { createdAt: 'desc' },
});

const hasMore = transactions.length > query.limit;
const results = hasMore ? transactions.slice(0, query.limit) : transactions;
const nextCursor = hasMore ? results[results.length - 1].id : null;
```

### Admin Adjustment Filter

```typescript
// Member history - HIDE admin adjustments
where: {
  memberId,
  action: { not: PointAction.ADMIN_ADJUSTMENT },
}

// Admin history - SHOW all including adjustments
where: { memberId: id }
```

### Action Label Mapping

```typescript
const mappedTransactions = results.map((t) => ({
  id: t.id,
  action: t.action,
  actionLabel: PointActionLabels[t.action as PointActionType] || t.action,
  points: t.points,
  metadata: t.metadata as Record<string, unknown>,
  createdAt: t.createdAt,
}));
```

## Verification Results

1. **TypeScript:** Compiles without errors specific to new files
2. **Exports:** Both routers properly exported
3. **Imports:** Correctly imported in index.ts
4. **Route mounts:** Verified at correct paths

## API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/points/history` | GET | Member | Paginated earned points history |
| `/api/points/values` | GET | Member | Enabled action point values |
| `/api/points/summary` | GET | Member | Total points and breakdown |
| `/api/admin/members/:id/points/adjust` | POST | Admin | Adjust member points |
| `/api/admin/members/:id/points/history` | GET | Admin | Full history with adjustments |

## Commits

| Commit | Description |
|--------|-------------|
| `ced57fe` | Create member points API routes |
| `127eb2f` | Create admin points management API |
| `87e4571` | Mount points API routes in Express app |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Phase 27 (Points System Backend) is now complete:
- Plan 27-01: Point configuration model and admin API
- Plan 27-02: Point transaction service with idempotent awarding
- Plan 27-03: Public points API endpoints

Ready for:
- **Phase 28:** Benchmark system (will call `awardBenchmarkPoints`)
- **Phase 29:** Resource library (will call `awardDownloadPoints`)
- **Phase 30:** MEE6 integration (will call `awardDiscordPoints`)
- **Phase 31:** Dashboard frontend (will consume points API endpoints)

## Files Changed

```
src/routes/points.ts                  (+150 lines, new)
src/routes/admin/points.ts            (+145 lines, new)
src/index.ts                          (+6 lines)
```
