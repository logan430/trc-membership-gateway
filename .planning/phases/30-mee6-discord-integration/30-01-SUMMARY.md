---
phase: 30-mee6-discord-integration
plan: 01
subsystem: mee6
tags: [mee6, api-client, zod, p-retry, discord]

dependency-graph:
  requires: []
  provides:
    - MEE6 API client module
    - Zod schemas for MEE6 leaderboard responses
    - MEE6 environment configuration
  affects:
    - 30-02 (MEE6 sync job will use client)
    - 30-03 (Streak calculation uses same env config)

tech-stack:
  added: []
  patterns:
    - Zod schema validation for external API responses
    - p-retry with AbortError for non-retryable failures
    - Native fetch for API requests

file-tracking:
  created:
    - src/mee6/types.ts
    - src/mee6/client.ts
  modified:
    - src/config/env.ts

decisions:
  - id: mee6-401-abort
    choice: Treat 401 as AbortError (no retry)
    rationale: Leaderboard not public is a config issue, not transient
  - id: mee6-rate-limit-delay
    choice: 2-second delay between page fetches
    rationale: Conservative rate limiting for unofficial API
  - id: mee6-page-limit
    choice: Default limit=500 per page
    rationale: Per RESEARCH.md, balances throughput vs rate limits

metrics:
  duration: ~8 minutes
  completed: 2026-01-23
---

# Phase 30 Plan 01: MEE6 API Client Summary

**One-liner:** Defensive MEE6 API client with p-retry, Zod validation, and 401/429 error handling for unofficial leaderboard API.

## What Was Built

Created the MEE6 API client module (`src/mee6/`) that fetches Discord activity data from the unofficial MEE6 leaderboard API. The client is designed for reliability with defensive error handling.

### Key Components

1. **Types and Schemas (`src/mee6/types.ts`)**
   - `Mee6Player` - Individual player data (id, username, xp, level, message_count)
   - `Mee6LeaderboardResponse` - Full API response with players array
   - `mee6LeaderboardSchema` - Zod schema for runtime validation
   - `MemberXpMap` - Helper type for batch XP lookups

2. **API Client (`src/mee6/client.ts`)**
   - `fetchLeaderboardPage(guildId?, page, limit)` - Single page fetch with retry
   - `fetchAllMemberXp(discordIds, guildId?)` - Batch lookup for specific members
   - p-retry: 3 retries, 5-60s exponential backoff
   - 401 handling: AbortError (leaderboard not public - don't retry)
   - 429 handling: Standard retry with backoff
   - Zod validation with Sentry error reporting

3. **Environment Config (`src/config/env.ts`)**
   - `MEE6_SYNC_ENABLED` - Master toggle (default: 'false')
   - `MEE6_GUILD_ID` - Optional guild override

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 3c37bad | feat | Create MEE6 types and Zod schemas |
| 0f27110 | feat | Create MEE6 API client with p-retry |
| dfe44a9 | feat | Add MEE6 environment configuration |
| 297724e | fix | Correct Zod v4 error property and p-retry callback |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 uses `.issues` not `.errors`**
- **Found during:** Final verification
- **Issue:** TypeScript error - `parseResult.error.errors` doesn't exist in Zod v4
- **Fix:** Changed to `parseResult.error.issues` (Zod v4 API)
- **Files modified:** src/mee6/client.ts
- **Commit:** 297724e

**2. [Rule 1 - Bug] p-retry FailedAttemptError type**
- **Found during:** Final verification
- **Issue:** TypeScript error - `error.message` not in FailedAttemptError type
- **Fix:** Removed error.message from log object (matches existing codebase pattern)
- **Files modified:** src/mee6/client.ts
- **Commit:** 297724e

## Technical Notes

### API Rate Limiting Strategy
The MEE6 API is unofficial with undocumented rate limits. Conservative approach:
- 2-second delay between page fetches
- p-retry handles 429 with exponential backoff
- limit=500 per page (not max 1000) to reduce load

### Error Classification
- **401 Unauthorized**: Configuration issue (leaderboard not public). Use AbortError to prevent retries. Admin must enable public leaderboard in MEE6 dashboard.
- **429 Rate Limited**: Transient issue. Retry with backoff.
- **Validation errors**: Log to Sentry for monitoring API changes.

### Guild ID Resolution
Functions accept optional `guildId` parameter that defaults to `env.DISCORD_GUILD_ID`. This allows `MEE6_GUILD_ID` override for servers where MEE6 tracks a different guild.

## Verification Checklist

- [x] All files compile (`npm run build`)
- [x] types.ts exports Mee6Player, Mee6LeaderboardResponse, schemas
- [x] client.ts exports fetchLeaderboardPage, fetchAllMemberXp
- [x] Client uses p-retry with proper error handling
- [x] Response validation via Zod schema
- [x] env.ts includes MEE6_SYNC_ENABLED with 'false' default

## Next Phase Readiness

**Ready for Plan 30-02:** MEE6 sync job can now use:
- `fetchAllMemberXp()` to get XP data for TRC members
- `MEE6_SYNC_ENABLED` to gate sync activation
- Error handling already in place for API failures

**No blockers.** All success criteria met.
