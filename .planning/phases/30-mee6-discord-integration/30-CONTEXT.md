# Phase 30: MEE6 Discord Integration - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Background synchronization of Discord activity (via MEE6 XP) into the points system, plus streak tracking for engagement consistency. Syncs every 15 minutes, calculates XP deltas, awards/deducts points, and runs daily streak calculations.

</domain>

<decisions>
## Implementation Decisions

### Sync Behavior
- Alert admin after 3+ consecutive MEE6 API failures (track failure count)
- When member leaves Discord: keep last XP value, stop syncing (no deletion)
- Implement rate limiting and response caching for MEE6 API defensively (unofficial API may throttle)
- Fixed 15-minute sync interval (not configurable)

### XP-to-Points Rules
- Conversion rate: 1 point per 100 XP
- Floor rounding (150 XP = 1 point, leftover 50 XP carries to next delta)
- No caps on Discord-earned points
- No minimum XP threshold
- Deduct points proportionally when XP decreases (admin removes XP = member loses points)

### Streak Mechanics
- Active day = any point-earning action (Discord, benchmarks, downloads — not just Discord)
- Day boundary: UTC timezone (streak job runs 00:05 UTC per requirements)
- Weekday streaks only: Monday through Friday required, Saturday/Sunday are automatic grace days
- Streak resets if member misses any weekday
- Display only for v2.0 (no bonus points), but design for future milestone bonuses

### Backfill Approach
- Start fresh — no historical XP points awarded at launch
- No notification on first sync (silent start)
- Create zero-XP DiscordActivity record for members not found in MEE6 (so everyone is tracked)
- Only sync TRC members (users with linked Member record), ignore other Discord members

### Claude's Discretion
- MEE6 API request batching strategy
- Rate limiter implementation details (in-memory, Redis, etc.)
- Error logging verbosity and Sentry integration specifics
- Graceful shutdown mechanics for background jobs

</decisions>

<specifics>
## Specific Ideas

- Weekend grace period is intentional for work-life balance — professional community, not a grind
- Points deduction on XP decrease maintains integrity (admin XP removal should affect points)
- Zero-XP records ensure all members appear in tracking from day one

</specifics>

<deferred>
## Deferred Ideas

- Milestone streak bonuses — design for it, implement in future phase
- Member timezone support for day boundary — keep simple with UTC for now
- Configurable sync interval — fixed for v2.0

</deferred>

---

*Phase: 30-mee6-discord-integration*
*Context gathered: 2026-01-23*
