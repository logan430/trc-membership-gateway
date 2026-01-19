---
phase: 04-introduction-requirement
plan: 01
subsystem: bot
tags: [discord.js, message-events, intents, introduction-detection]

# Dependency graph
requires:
  - phase: 02-discord
    provides: Discord bot client, role management, GuildMembers intent
provides:
  - Discord client with MessageContent and GuildMessages intents
  - DISCORD_INTRODUCTIONS_CHANNEL_ID env configuration
  - lastGuidanceDmAt field for rate-limiting guidance DMs
  - Introduction message event handlers (messageCreate, messageUpdate)
affects: [04-02, 04-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Message event handler pattern with channel filtering"
    - "Partial message fetch for messageUpdate handling"

key-files:
  created:
    - src/bot/events/introduction.ts
  modified:
    - src/bot/client.ts
    - src/config/env.ts
    - prisma/schema.prisma

key-decisions:
  - "MessageContent privileged intent required for reading message content"
  - "Top-level messages only - replies filtered out per CONTEXT.md"
  - "100 character minimum intro length constant exported for reuse"

patterns-established:
  - "Event handler setup function called from ClientReady event"
  - "shouldProcess guard function for message filtering"

# Metrics
duration: 3min
completed: 2026-01-19
---

# Phase 04 Plan 01: Message Event Infrastructure Summary

**Discord message event handlers for introduction detection with MessageContent intent and channel-filtered processing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-19T05:29:43Z
- **Completed:** 2026-01-19T05:32:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Discord client configured with GuildMessages and MessageContent intents
- Environment schema extended with required DISCORD_INTRODUCTIONS_CHANNEL_ID
- Member model extended with lastGuidanceDmAt for rate-limiting guidance DMs
- Message handlers detect introductions in #introductions channel

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Message Intents and Channel Config** - `46a943c` (feat)
2. **Task 2: Add Database Field and Create Event Handler** - `e347839` (feat)

## Files Created/Modified
- `src/bot/client.ts` - Added MessageContent and GuildMessages intents, import and call setupIntroductionHandlers
- `src/config/env.ts` - Added DISCORD_INTRODUCTIONS_CHANNEL_ID (required string)
- `prisma/schema.prisma` - Added lastGuidanceDmAt DateTime field to Member model
- `src/bot/events/introduction.ts` - Message event handlers with filtering logic

## Decisions Made
- MessageContent is a privileged intent requiring Developer Portal enablement
- Top-level messages only - replies (MessageType.Reply) filtered out per CONTEXT.md
- MIN_INTRO_LENGTH = 100 exported as constant for reuse in Plan 04-02
- processIntroduction is a stub - full role promotion logic deferred to Plan 04-02

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in discord-oauth.ts, roles.ts, and claim.ts appeared during `tsc --noEmit` verification. These are unrelated to this plan's changes (confirmed by filtering tsc output). The project uses tsx at runtime which handles these correctly. No blocking issues for this plan.

## User Setup Required

**External services require manual configuration:**

1. **Discord Developer Portal:**
   - Navigate to: https://discord.com/developers/applications
   - Select your application > Bot > Privileged Gateway Intents
   - Enable "Message Content Intent" checkbox
   - (GuildMembers should already be enabled from Phase 2)

2. **Environment variable:**
   - Add `DISCORD_INTRODUCTIONS_CHANNEL_ID` to `.env`
   - Value: Right-click #introductions channel in Discord > Copy Channel ID

3. **Verification:**
   - Start bot: `npx tsx src/index.ts`
   - Post a message in #introductions
   - Check logs for "Introduction message detected"

## Next Phase Readiness
- Message event infrastructure ready for Plan 04-02 (role promotion logic)
- shouldProcess filtering ensures only valid intro candidates reach processIntroduction
- lastGuidanceDmAt field ready for rate-limiting in Plan 04-02

---
*Phase: 04-introduction-requirement*
*Completed: 2026-01-19*
