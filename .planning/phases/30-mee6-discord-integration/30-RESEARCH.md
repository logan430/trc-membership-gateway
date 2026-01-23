# Phase 30: MEE6 Discord Integration - Research

**Researched:** 2026-01-23
**Domain:** Background job scheduling, MEE6 API integration, streak calculation
**Confidence:** MEDIUM (unofficial API with rate limiting concerns)

## Summary

This phase implements background synchronization of Discord activity via MEE6 XP into the existing points system. The MEE6 API is unofficial and undocumented, requiring defensive programming with rate limiting, retry logic, and comprehensive error handling. The project already uses `node-cron` for scheduled tasks and `p-retry` for exponential backoff, providing established patterns to follow.

The implementation requires three background jobs: MEE6 XP sync (every 15 minutes), streak calculation (daily at 00:05 UTC), and optionally leaderboard caching (every 5 minutes). The DiscordActivity table already exists from Phase 26 and will store sync events. Points are awarded via the existing `awardDiscordPoints()` function which handles idempotency via syncId.

**Primary recommendation:** Use native `fetch` with `p-retry` for MEE6 API calls (no npm wrapper needed), implement separate cron jobs following the existing `reconciliation/index.ts` pattern, and add graceful shutdown support to stop jobs cleanly on SIGTERM.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-cron | ^4.2.1 | Job scheduling | Already in use for reconciliation, supports timezone-aware scheduling |
| p-retry | ^7.1.1 | Retry with backoff | Already in use throughout codebase for API resilience |
| Native fetch | Built-in | HTTP requests | Project pattern (see discord-oauth.ts), no additional dependency |
| @sentry/node | ^10.36.0 | Error monitoring | Already integrated, logs errors to Sentry |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pino | ^10.2.0 | Structured logging | Already configured, use `logger` from index.ts |
| zod | ^4.3.5 | Runtime validation | Validate MEE6 API responses before processing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fetch | mee6-levels-api npm | Adds dependency for simple GET requests; wrapper is unofficial anyway |
| p-retry | Built-in retry | p-retry already in project with proven patterns |
| node-cron | node-schedule | node-cron already used, simpler API for cron expressions |

**Installation:**
```bash
# No new dependencies required - all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  jobs/
    index.ts              # Export startJobScheduler(), manages all cron jobs
    mee6-sync.ts          # MEE6 XP sync logic (15-minute job)
    streak-calculator.ts  # Streak calculation logic (daily job)
    types.ts              # Job-related types
  mee6/
    client.ts             # MEE6 API client (fetch + p-retry)
    types.ts              # MEE6 API response types
```

### Pattern 1: Job Scheduler with Graceful Shutdown
**What:** Centralized job management with shutdown support
**When to use:** When running multiple cron jobs that need coordinated startup/shutdown
**Example:**
```typescript
// Source: Derived from src/reconciliation/index.ts pattern
import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../index.js';

// Track all scheduled tasks for graceful shutdown
const scheduledTasks: ScheduledTask[] = [];

export function startJobScheduler(): void {
  // MEE6 sync - every 15 minutes
  const mee6Job = cron.schedule('*/15 * * * *', async () => {
    try {
      await syncMee6Xp();
    } catch (error) {
      logger.error({ error }, 'MEE6 sync job failed');
      // Sentry captures via existing integration
    }
  });
  scheduledTasks.push(mee6Job);

  // Streak calculation - daily at 00:05 UTC
  const streakJob = cron.schedule('5 0 * * *', async () => {
    try {
      await calculateStreaks();
    } catch (error) {
      logger.error({ error }, 'Streak calculation job failed');
    }
  }, { timezone: 'UTC' });
  scheduledTasks.push(streakJob);

  logger.info('Job scheduler started');
}

export function stopJobScheduler(): void {
  for (const task of scheduledTasks) {
    task.stop();
  }
  logger.info('Job scheduler stopped');
}
```

### Pattern 2: MEE6 API Client with Defensive Fetch
**What:** API client that handles rate limits, errors, and retries
**When to use:** All MEE6 API interactions
**Example:**
```typescript
// Source: Pattern from src/auth/discord-oauth.ts + p-retry from src/lib/role-assignment.ts
import pRetry, { AbortError } from 'p-retry';
import { logger } from '../index.js';

const MEE6_API_BASE = 'https://mee6.xyz/api/plugins/levels/leaderboard';

interface Mee6Player {
  id: string;           // Discord user ID
  username: string;
  xp: number;           // Total XP
  level: number;
  message_count: number;
  detailed_xp: [number, number, number]; // [currentLevelXp, levelXpRequired, totalXp]
}

interface Mee6LeaderboardResponse {
  players: Mee6Player[];
  page: number;
  guild: { id: string; name: string };
}

export async function fetchLeaderboardPage(
  guildId: string,
  page: number = 0,
  limit: number = 100
): Promise<Mee6LeaderboardResponse> {
  return pRetry(
    async () => {
      const url = `${MEE6_API_BASE}/${guildId}?page=${page}&limit=${limit}`;
      const response = await fetch(url);

      // 401 = leaderboard not public - abort, don't retry
      if (response.status === 401) {
        throw new AbortError('MEE6 leaderboard not public. Enable in MEE6 dashboard.');
      }

      // 429 = rate limited - retry after delay
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(`Rate limited. Retry after: ${retryAfter ?? 'unknown'}`);
      }

      if (!response.ok) {
        throw new Error(`MEE6 API error: ${response.status}`);
      }

      return response.json() as Promise<Mee6LeaderboardResponse>;
    },
    {
      retries: 3,
      minTimeout: 5000,  // 5 seconds base
      maxTimeout: 60000, // 1 minute max
      onFailedAttempt: (error) => {
        logger.warn(
          { attempt: error.attemptNumber, retriesLeft: error.retriesLeft },
          `MEE6 API retry: ${error.message}`
        );
      },
    }
  );
}
```

### Pattern 3: XP Delta Calculation with Leftover Tracking
**What:** Track XP deltas and carry over leftover XP between syncs
**When to use:** Converting XP to points with floor rounding
**Example:**
```typescript
// Per CONTEXT.md: Floor rounding (150 XP = 1 point, leftover 50 XP carries to next delta)
interface SyncResult {
  memberId: string;
  xpDelta: number;
  points: number;
  leftoverXp: number;
}

function calculatePointsFromXpDelta(
  xpDelta: number,
  previousLeftover: number = 0
): { points: number; newLeftover: number } {
  const totalXp = xpDelta + previousLeftover;
  const points = Math.floor(totalXp / 100);
  const newLeftover = totalXp % 100;
  return { points, newLeftover };
}
```

### Pattern 4: Weekday-Only Streak Calculation
**What:** Calculate streaks counting only weekdays (Mon-Fri), weekends are grace days
**When to use:** Daily streak calculation job at 00:05 UTC
**Example:**
```typescript
// Per CONTEXT.md: Weekday streaks only - Saturday/Sunday are automatic grace days
function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

function calculateStreak(lastActiveAt: Date | null, today: Date): number {
  if (!lastActiveAt) return 0;

  // Get the last weekday (skip back over weekends if today is Mon)
  let expectedActiveDate = new Date(today);
  expectedActiveDate.setUTCDate(expectedActiveDate.getUTCDate() - 1);

  // Skip weekends backwards
  while (!isWeekday(expectedActiveDate)) {
    expectedActiveDate.setUTCDate(expectedActiveDate.getUTCDate() - 1);
  }

  // Check if member was active on expected weekday
  const lastActiveDate = new Date(lastActiveAt);
  lastActiveDate.setUTCHours(0, 0, 0, 0);
  expectedActiveDate.setUTCHours(0, 0, 0, 0);

  if (lastActiveDate.getTime() >= expectedActiveDate.getTime()) {
    return 1; // Continue streak (actual increment handled by accumulated logic)
  }

  return 0; // Streak broken
}
```

### Anti-Patterns to Avoid
- **Blocking the main thread:** Never await long-running MEE6 sync in request handlers
- **Ignoring rate limits:** Always check for 429 responses and respect Retry-After headers
- **Sync without idempotency:** Always generate unique syncId and use existing `awardDiscordPoints()`
- **Stopping cron from inside callback:** node-cron's `stop()` doesn't work from within the triggered function
- **Retrying 401 errors:** These indicate misconfiguration (leaderboard not public), not transient failures

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry with backoff | Custom setTimeout loops | p-retry library | Handles edge cases, already in codebase |
| Cron scheduling | setInterval + date math | node-cron library | Handles timezone, DST, expression parsing |
| Point awarding | Direct DB inserts | `awardDiscordPoints()` | Already handles idempotency via syncId |
| Error tracking | Custom logging | Sentry integration | Already integrated, captures context |
| Job coordination | Flags and shared state | Separate cron jobs | Simpler, no race conditions |

**Key insight:** The codebase already has battle-tested patterns for all the hard problems (retry, scheduling, idempotency, error tracking). The MEE6 integration should compose these existing primitives.

## Common Pitfalls

### Pitfall 1: MEE6 Leaderboard Not Public
**What goes wrong:** API returns 401 Unauthorized consistently
**Why it happens:** MEE6 requires explicit opt-in to make leaderboard public
**How to avoid:**
- Document requirement: Server admin must enable "Make my server's leaderboard public" in MEE6 dashboard
- Treat 401 as AbortError (don't retry)
- Alert admin after 3 consecutive failures (per CONTEXT.md decision)
**Warning signs:** All syncs failing with 401

### Pitfall 2: Rate Limiting Causing Temporary Bans
**What goes wrong:** MEE6 API returns 429, then blocks for 30 minutes
**Why it happens:** Too many requests in short period, especially during batch operations
**How to avoid:**
- Use conservative rate limiting (wait between page fetches)
- Fetch only what's needed (limit parameter)
- Implement exponential backoff with p-retry
- Cache results if needed for leaderboard display
**Warning signs:** Intermittent 429 errors, gaps in sync data

### Pitfall 3: XP Decrease Handling
**What goes wrong:** Points not deducted when admin removes XP in MEE6
**Why it happens:** Only checking for positive deltas
**How to avoid:**
- Calculate XP delta as (currentXP - lastRecordedXP), can be negative
- Award negative points proportionally (per CONTEXT.md decision)
- Log negative deltas for audit purposes
**Warning signs:** Member XP drops but points stay same

### Pitfall 4: First-Sync Backfill Logic
**What goes wrong:** Massive point awards on first sync from historical XP
**Why it happens:** Treating first sync as delta from 0
**How to avoid:**
- Per CONTEXT.md: Start fresh, no historical points
- First sync records xpTotal but sets xpDelta = 0
- Create DiscordActivity record with xpDelta: null or 0 for first sync
**Warning signs:** New member gets hundreds of points immediately

### Pitfall 5: Missing Members in MEE6
**What goes wrong:** TRC members with Discord linked but no MEE6 data
**Why it happens:** Member never posted in Discord, or joined after MEE6 was added
**How to avoid:**
- Per CONTEXT.md: Create zero-XP DiscordActivity record for members not found in MEE6
- Track all TRC members, not just those in MEE6 leaderboard
**Warning signs:** Some members never appear in sync logs

### Pitfall 6: Timezone Confusion in Streak Calculation
**What goes wrong:** Streaks break/continue incorrectly at day boundaries
**Why it happens:** Mixing local and UTC times, DST transitions
**How to avoid:**
- Per CONTEXT.md: UTC timezone for all streak calculations
- Run job at 00:05 UTC (not local time)
- Store lastActiveAt as UTC timestamp
- Compare dates after normalizing to UTC midnight
**Warning signs:** Streaks reset unexpectedly around midnight

### Pitfall 7: Graceful Shutdown Not Stopping Jobs
**What goes wrong:** Jobs keep running during shutdown, causing data corruption
**Why it happens:** node-cron tasks not stopped on SIGTERM
**How to avoid:**
- Track all ScheduledTask references
- Call `task.stop()` for each in gracefulShutdown handler
- Add stopJobScheduler() call to existing shutdown sequence
**Warning signs:** Errors during deployment restarts, partial sync data

## Code Examples

Verified patterns from official sources:

### MEE6 API Response Structure
```typescript
// Source: https://github.com/hyperevo/mee6-py-api, verified via multiple sources
interface Mee6LeaderboardResponse {
  admin: boolean;
  banner_url: string | null;
  guild: {
    icon: string;
    id: string;
    name: string;
    premium: boolean;
  };
  page: number;
  player: object | null;
  players: Mee6Player[];
  role_rewards: RoleReward[];
  user_guild_settings: object | null;
  xp_per_message: [number, number]; // e.g., [15, 25]
  xp_rate: number; // e.g., 1.0
}

interface Mee6Player {
  avatar: string;
  detailed_xp: [number, number, number]; // [xpInCurrentLevel, xpToNextLevel, totalXp]
  discriminator: string;
  guild_id: string;
  id: string;           // Discord user ID - use for matching with Member.discordId
  level: number;
  message_count: number;
  username: string;
  xp: number;           // Total XP (same as detailed_xp[2])
}
```

### DiscordActivity Table Schema (Already Exists)
```typescript
// Source: prisma/schema.prisma - Phase 26
model DiscordActivity {
  id           String              @id @default(cuid())
  memberId     String
  discordId    String
  activityType DiscordActivityType // MESSAGE, REACTION_GIVEN, REACTION_RECEIVED
  xpDelta      Int?                // MEE6 XP gained since last sync
  xpTotal      Int?                // Total MEE6 XP at sync time
  syncedAt     DateTime            @default(now())

  member Member @relation(...)
}
```

### Existing Points Service Integration
```typescript
// Source: src/points/service.ts - Already handles Discord points
export async function awardDiscordPoints(
  memberId: string,
  xpDelta: number,
  syncId: string  // For idempotency
): Promise<AwardResult>
```

### Environment Variable Pattern
```typescript
// Add to src/config/env.ts
// MEE6 Integration
MEE6_SYNC_ENABLED: z.enum(['true', 'false']).default('true'),
MEE6_GUILD_ID: z.string().optional(), // Defaults to DISCORD_GUILD_ID if not set
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| mee6-levels-api npm | Native fetch | 2024+ | Package unmaintained, native fetch simpler |
| setInterval for jobs | node-cron expressions | Current | Better timezone support, cron familiarity |
| Custom retry logic | p-retry library | Current | Battle-tested, configurable backoff |

**Deprecated/outdated:**
- mee6-levels-api npm package: Not officially supported, adds unnecessary dependency
- Simple polling without backoff: Leads to rate limit bans

## Open Questions

Things that couldn't be fully resolved:

1. **Exact MEE6 rate limits**
   - What we know: 429 returns result in ~30 minute temporary ban
   - What's unclear: Exact request-per-minute threshold, whether headers provide limit info
   - Recommendation: Start conservative (1 request per 2 seconds), monitor and adjust

2. **MEE6 API stability**
   - What we know: API is unofficial, undocumented, subject to change
   - What's unclear: How often API changes, what happens if MEE6 subscription lapses
   - Recommendation: Validate response schema with Zod, alert on parsing failures

3. **Leaderboard pagination limits**
   - What we know: Can request up to 1000 users per page
   - What's unclear: Server-side limits if community grows large
   - Recommendation: Start with limit=500, paginate if >500 TRC members with Discord linked

4. **XP leftover persistence**
   - What we know: CONTEXT.md says "leftover 50 XP carries to next delta"
   - What's unclear: Where to store leftover XP between syncs
   - Recommendation: Add `leftoverXp` field to DiscordActivity or Member table

## Sources

### Primary (HIGH confidence)
- prisma/schema.prisma - DiscordActivity table schema (Phase 26)
- src/points/service.ts - awardDiscordPoints() implementation
- src/reconciliation/index.ts - node-cron usage pattern
- src/lib/role-assignment.ts - p-retry usage pattern
- src/auth/discord-oauth.ts - fetch API pattern

### Secondary (MEDIUM confidence)
- [GitHub: mee6-py-api](https://github.com/hyperevo/mee6-py-api) - MEE6 API response structure
- [GitHub: mee6-levels-api](https://github.com/rjt-rockx/mee6-levels-api) - API endpoint format confirmation
- [MEE6 Wiki: Leaderboard](https://wiki.mee6.xyz/en/features/leaderboard) - Public leaderboard requirements

### Tertiary (LOW confidence)
- WebSearch: MEE6 rate limits (no official documentation found)
- WebSearch: MEE6 API stability (community reports vary)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, patterns established
- Architecture: HIGH - Following existing patterns from reconciliation and billing schedulers
- MEE6 API specifics: MEDIUM - Unofficial API, validated through multiple wrapper implementations
- Rate limiting behavior: LOW - No official documentation, based on community reports
- Pitfalls: MEDIUM - Derived from common patterns and CONTEXT.md decisions

**Research date:** 2026-01-23
**Valid until:** 2026-02-23 (30 days - stable patterns, but MEE6 API may change)
