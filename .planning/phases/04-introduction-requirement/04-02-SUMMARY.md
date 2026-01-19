---
phase: 04-introduction-requirement
plan: 02
subsystem: discord-bot
tags: [discord, roles, introduction, promotion, dm]

dependency-graph:
  requires: ["04-01"]
  provides: ["introduction-validation", "role-promotion", "welcome-dm"]
  affects: ["05-team-subscription"]

tech-stack:
  added: []
  patterns: ["fire-and-forget-retry", "rate-limiting", "role-swap"]

key-files:
  created: []
  modified:
    - src/bot/events/introduction.ts
    - src/lib/role-assignment.ts

decisions:
  - id: "04-02-001"
    decision: "Text-only length validation"
    rationale: "Images don't count per CONTEXT.md - only message.content.length"
  - id: "04-02-002"
    decision: "24-hour rate limit for guidance DMs"
    rationale: "Prevents DM spam while allowing retry after cooldown"
  - id: "04-02-003"
    decision: "Fire-and-forget role swap with p-retry"
    rationale: "Consistent with assignRoleAsync pattern, non-blocking"

metrics:
  duration: "3 min"
  completed: "2026-01-19"
---

# Phase 4 Plan 02: Role Promotion Logic Summary

**One-liner:** Introduction validation with 100-char minimum promoting Squire to Knight/Lord via atomic role swap

## What Was Built

### Role Swap Function (src/lib/role-assignment.ts)

Added `swapRoleAsync(discordId, removeRole, addRole)` function:
- Atomically removes old role and adds new role
- Uses p-retry with 5 retries, 1-30s exponential backoff
- Fire-and-forget pattern matching existing `assignRoleAsync`
- Logs success/failure for observability

### Introduction Processing (src/bot/events/introduction.ts)

Implemented complete `processIntroduction(message)`:

1. **Validation Flow:**
   - Gets text length (images don't count)
   - Looks up member by Discord ID
   - Checks if member exists and hasn't completed intro
   - Verifies user has Squire role

2. **Short Intro Handling:**
   - If < 100 characters, sends guidance DM
   - Rate-limited to once per 24 hours per user
   - Medieval-themed guidance message

3. **Valid Intro Handling:**
   - Reacts with party emoji
   - Determines target role (Lord for OWNER, Knight for others)
   - Calls swapRoleAsync to remove Squire and add Knight/Lord
   - Updates database with intro completion state
   - Sends medieval-themed welcome DM

### Helper Functions

- `sendGuidanceDM(member, user)`: Rate-limited guidance for short intros
- `promoteAfterIntro(member, guildMember, messageId)`: Role swap + DB update + welcome
- `sendWelcomeDM(user, roleName)`: Medieval welcome with guidelines link

## Key Implementation Details

```typescript
// Role determination based on seat tier
const targetRole = member.seatTier === 'OWNER'
  ? ROLE_CONFIG.LORD.name
  : ROLE_CONFIG.KNIGHT.name;

// Atomic role swap
swapRoleAsync(guildMember.id, ROLE_CONFIG.SQUIRE.name, targetRole);

// Database state tracking
await prisma.member.update({
  where: { id: member.id },
  data: {
    introCompleted: true,
    introCompletedAt: new Date(),
    introMessageId: messageId,
  },
});
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma client needed regeneration**
- **Found during:** Task 2 verification
- **Issue:** TypeScript errors on `lastGuidanceDmAt` field - Prisma client out of sync with schema
- **Fix:** Ran `npx prisma generate` to regenerate client
- **Files modified:** node_modules/@prisma/client (generated)
- **Commit:** N/A (generated files not committed)

## Verification Results

- [x] TypeScript compiles (introduction.ts and role-assignment.ts changes)
- [x] swapRoleAsync exported from role-assignment.ts
- [x] promoteAfterIntro function in introduction.ts
- [x] prisma.member.findUnique for member lookup
- [x] prisma.member.update for intro completion and guidance DM rate limit
- [x] Party emoji reaction on valid intro
- [x] Medieval-themed welcome DM
- [x] 24-hour rate limit on guidance DMs

Note: Pre-existing TypeScript errors in discord-oauth.ts and claim.ts remain (documented in STATE.md blockers).

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 4600c4e | Add swapRoleAsync function for role promotion |
| 2 | 54b860a | Implement introduction validation and role promotion |

## Next Phase Readiness

Phase 4 is now complete with all three plans executed:
- 04-01: Message event infrastructure
- 04-02: Role promotion logic (this plan)
- 04-03: Subscription end handling

Ready to proceed to Phase 5 (Team Subscription).

---

*Completed: 2026-01-19*
*Duration: 3 min*
*Plan: 04-02-PLAN.md*
