---
phase: 30-mee6-discord-integration
plan: 03
subsystem: jobs
tags: [streaks, job-scheduler, graceful-shutdown, cron]

dependency-graph:
  requires:
    - 30-01 (MEE6 API client)
    - 30-02 (MEE6 sync function, job types)
  provides:
    - Streak calculation function (weekday-only logic)
    - Centralized job scheduler with lifecycle management
    - Graceful shutdown for all background jobs
  affects:
    - 30-04 (Scheduler already integrated, just needs verification)
    - Future phases (job patterns established for new background tasks)

tech-stack:
  added: []
  patterns:
    - Centralized job scheduler with tracked ScheduledTask array
    - Graceful shutdown stops jobs before HTTP server close
    - Weekday-only streak logic (Mon-Fri required, weekends grace)
    - Batch updates with prisma.$transaction for performance

file-tracking:
  created:
    - src/jobs/streak-calculator.ts
    - src/jobs/index.ts
  modified:
    - src/index.ts

decisions:
  - id: weekday-only-streaks
    choice: Streaks only count Monday-Friday, weekends are automatic grace days
    rationale: Per CONTEXT.md, professional community values work-life balance
  - id: batch-updates
    choice: Process streak updates in batches of 100 with transactions
    rationale: Prevents memory issues with large member counts
  - id: shutdown-order
    choice: Stop jobs first, then HTTP, then Discord, then database
    rationale: Jobs should stop accepting work before connections close

metrics:
  duration: ~4 minutes
  completed: 2026-01-23
---

# Phase 30 Plan 03: Streak Calculation Job Summary

**One-liner:** Daily streak calculator with weekday-only logic running at 00:05 UTC, centralized job scheduler managing MEE6 sync and streaks, graceful shutdown integration.

## What Was Built

Created the streak calculation job and centralized job scheduler, then integrated everything into the main application with proper graceful shutdown handling.

### Key Components

1. **Streak Calculator (`src/jobs/streak-calculator.ts`)**
   - `calculateStreaks()` - Daily streak calculation entry point
   - `isWeekday(date)` - Helper to check Mon-Fri (UTC day 1-5)
   - `getExpectedActiveDate(today)` - Find last weekday before today
   - `isStreakValid(lastActiveAt, expectedDate)` - Validate member streak
   - Batch processing in groups of 100 members
   - Returns `StreakStats` with processed/incremented/reset counts

2. **Job Scheduler (`src/jobs/index.ts`)**
   - `startJobScheduler()` - Register and start all background jobs
   - `stopJobScheduler()` - Gracefully stop all jobs
   - Tracks `ScheduledTask[]` for shutdown management
   - MEE6 sync: `*/15 * * * *` (every 15 minutes)
   - Streak calculation: `5 0 * * *` with timezone: `UTC` (00:05 UTC daily)

3. **Main App Integration (`src/index.ts`)**
   - Import `startJobScheduler` and `stopJobScheduler`
   - Start jobs after Discord bot ready
   - Stop jobs first in graceful shutdown sequence

## Commits

| Hash | Type | Description |
|------|------|-------------|
| acc18f1 | feat | Create streak calculation function |
| 4324429 | feat | Create job scheduler with graceful shutdown |
| eff8dc0 | feat | Integrate job scheduler with graceful shutdown |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

### Streak Logic

```
1. Get today at midnight UTC
2. Calculate expectedActiveDate (last weekday before today)
   - If today is Monday, expected = Friday
   - If today is Tuesday, expected = Monday
   - Weekend = find previous Friday
3. For each ACTIVE/TRIALING member:
   a. Check lastActiveAt >= expectedActiveDate
   b. If valid: queue for increment
   c. If invalid AND currentStreak > 0: queue for reset
4. Batch update in transactions of 100
```

### Graceful Shutdown Order

```
1. Stop background jobs (stopJobScheduler)
2. Stop HTTP server (server.close)
3. Disconnect Discord client (discordClient.destroy)
4. Close database connections (prisma.$disconnect)
```

This ensures jobs don't trigger new work while connections are closing.

### Cron Expressions

| Job | Cron | Runs |
|-----|------|------|
| MEE6 Sync | `*/15 * * * *` | Every 15 minutes (0, 15, 30, 45) |
| Streak Calc | `5 0 * * *` | Daily at 00:05 UTC |

Streak runs at 00:05 (not 00:00) to ensure all previous day's activity is recorded.

## Verification Checklist

- [x] All files compile (`npm run build`)
- [x] Server startup logs show "Job scheduler started"
- [x] Logs show "MEE6 sync job scheduled" with cron expression
- [x] Logs show "Streak calculation job scheduled" with timezone UTC
- [x] Job count shows 2 in startup logs
- [x] Streak logic skips weekends correctly (Mon-Fri only)
- [x] Batch processing in groups of 100
- [x] JOBS-01 satisfied (MEE6 sync every 15 minutes)
- [x] JOBS-02 satisfied (Streak calculation daily 00:05 UTC)
- [x] JOBS-04 satisfied (Errors logged to Sentry via logger.error)
- [x] JOBS-05 satisfied (Graceful shutdown stops jobs)

## Next Phase Readiness

**Ready for Plan 30-04:** Phase 30 complete
- MEE6 API client (30-01)
- MEE6 sync function (30-02)
- Streak calculator (30-03)
- Job scheduler with graceful shutdown (30-03)

**All background job infrastructure is operational.** Jobs will run automatically:
- MEE6 sync every 15 minutes (when MEE6_SYNC_ENABLED=true)
- Streak calculation daily at 00:05 UTC

**No blockers.** All success criteria met.
