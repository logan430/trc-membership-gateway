---
phase: 30-mee6-discord-integration
plan: 02
subsystem: jobs
tags: [mee6, sync-job, points, discord-activity]

dependency-graph:
  requires:
    - 30-01 (MEE6 API client)
    - 27-02 (Points service awardDiscordPoints)
  provides:
    - MEE6 XP sync function
    - Job types for sync statistics
    - Negative XP delta handling in points service
  affects:
    - 30-03 (Streak calculation uses same job patterns)
    - 30-04 (Scheduler will invoke syncMee6Xp)

tech-stack:
  added: []
  patterns:
    - Module-level failure tracking for consecutive errors
    - Sentry alerting after threshold failures
    - Idempotency via syncId in metadata

file-tracking:
  created:
    - src/jobs/types.ts
    - src/jobs/mee6-sync.ts
  modified:
    - src/points/service.ts

decisions:
  - id: first-sync-null-delta
    choice: First sync creates DiscordActivity with xpDelta=null
    rationale: Distinguishes baseline from zero-change sync
  - id: negative-delta-deduction
    choice: Points deducted proportionally when XP decreases
    rationale: Per CONTEXT.md, admin XP removal should affect points
  - id: lastActiveAt-positive-only
    choice: Only update lastActiveAt on positive point awards
    rationale: Per existing pattern, deductions shouldn't count as activity

metrics:
  duration: ~3 minutes
  completed: 2026-01-23
---

# Phase 30 Plan 02: MEE6 Sync Job Summary

**One-liner:** XP-to-points sync function with delta tracking, first-sync baselines, negative delta deductions, and admin alerting after 3+ consecutive failures.

## What Was Built

Created the MEE6 XP synchronization job (`src/jobs/mee6-sync.ts`) that converts Discord activity into TRC points. Extended the points service to handle negative XP deltas.

### Key Components

1. **Job Types (`src/jobs/types.ts`)**
   - `SyncResult` - Individual member sync outcome (xpBefore, xpAfter, delta, points)
   - `SyncStats` - Complete sync run metrics (counts, totals, syncId)
   - `StreakStats` - Prepared for Plan 30-03 streak calculation

2. **Negative Delta Support (`src/points/service.ts`)**
   - `awardDiscordPoints()` now handles negative XP deltas
   - Deduction formula: `floor(|delta|/100) * pointsPerUnit * -1`
   - Separate logging for awards vs deductions

3. **Sync Function (`src/jobs/mee6-sync.ts`)**
   - `syncMee6Xp()` - Main entry point for scheduled execution
   - Early exit if `MEE6_SYNC_ENABLED !== 'true'`
   - Fetches all TRC members with linked Discord accounts
   - Uses `fetchAllMemberXp()` from MEE6 client
   - Processes each member: delta calculation, points award, DiscordActivity record
   - First sync = baseline (xpDelta null, no points)
   - Members not in MEE6 get zero-XP records
   - Tracks consecutive failures, Sentry alert after 3+

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 49e5bc0 | feat | Create job types for sync statistics |
| d814dca | feat | Extend points service for negative XP deltas |
| ffbec99 | feat | Create MEE6 XP sync function |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

### Sync Flow
```
1. Check MEE6_SYNC_ENABLED (early exit if false)
2. Fetch TRC members with discordId
3. Fetch MEE6 XP data via fetchAllMemberXp()
4. For each member:
   a. Get latest DiscordActivity (xpTotal)
   b. Get current XP from MEE6 (0 if not found)
   c. Calculate delta (0 if first sync)
   d. Create DiscordActivity record
   e. Award/deduct points if delta != 0
   f. Update lastActiveAt if positive points
5. Return SyncStats
```

### First Sync Handling
- `isFirstSync = (lastActivity === null)`
- First sync creates baseline: `xpDelta: null` in DiscordActivity
- No points awarded on first sync (delta = 0)
- This ensures members start fresh without XP backfill

### Consecutive Failure Tracking
- Module-level `consecutiveFailures` counter
- Resets to 0 on successful API fetch
- After 3+ failures: log error + Sentry alert
- Allows transient failures without noise

## Verification Checklist

- [x] All files compile (`npm run build`)
- [x] src/jobs/types.ts exports SyncResult, SyncStats, StreakStats
- [x] src/points/service.ts handles negative xpDelta
- [x] src/jobs/mee6-sync.ts exports syncMee6Xp function
- [x] Sync creates DiscordActivity records for all TRC members
- [x] First sync = baseline (xpDelta null, no points)
- [x] Subsequent syncs = delta calculation and point awards
- [x] Failure count tracks consecutive API failures for admin alert

## Next Phase Readiness

**Ready for Plan 30-03:** Streak calculation job can now use:
- Same job structure and types pattern
- Member lastActiveAt is updated by sync
- DiscordActivity records exist for activity tracking

**Ready for Plan 30-04:** Scheduler can now invoke:
- `syncMee6Xp()` every 15 minutes
- Returns `SyncStats` for logging

**No blockers.** All success criteria met.
