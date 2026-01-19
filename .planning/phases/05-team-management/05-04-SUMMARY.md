---
phase: 05-team-management
plan: 04
subsystem: team-claim
tags: [oauth, discord, team, seats, claim, routing]

dependency-graph:
  requires:
    - 05-01 (team schema, Member.teamId, seatTier)
    - 05-03 (PendingInvite model, invite tokens)
  provides:
    - team-invite-claim-flow
    - discord-oauth-team-identity
    - atomic-seat-allocation
  affects:
    - 05-05 (seat revocation flows)
    - 05-06 (mid-subscription additions use same claim flow)

tech-stack:
  added: []
  patterns:
    - prisma-transaction-race-prevention
    - cookie-based-oauth-state
    - discord-oauth-identity-verification

file-tracking:
  key-files:
    created:
      - src/routes/team-claim.ts
      - public/team-claim.html
    modified:
      - src/index.ts
      - src/bot/events/introduction.ts

decisions:
  - id: discord-oauth-only
    choice: Team claim uses Discord OAuth only (no email/password)
    why: Per CONTEXT.md - invitees only need Discord OAuth for identity
  - id: atomic-transaction
    choice: Prisma $transaction for seat claim
    why: Prevents race condition when multiple users claim simultaneously
  - id: cookie-state-pattern
    choice: Store token and state in cookies for callback
    why: Matches existing claim.ts pattern, enables stateless server
  - id: individual-blocking
    choice: Block individual subscribers from claiming team seats
    why: They already have owner access, prevents duplicate memberships
  - id: individual-lord-fix
    choice: INDIVIDUAL seatTier maps to Lord role
    why: Per CONTEXT.md - Individual = Owner hierarchy, both get Lord

metrics:
  duration: 7 min
  completed: 2026-01-19
---

# Phase 5 Plan 4: Invite Claim Flow Summary

**One-liner:** Discord OAuth claim flow for team invites with atomic seat allocation and proper seat tier role promotion

## What Was Built

### Team Claim Routes
`src/routes/team-claim.ts`:

**GET /team/claim/info** - Fetch invite details for landing page:
- Validates token exists in PendingInvite
- Returns team name, seat tier, seat availability
- Used by landing page to display invite info before OAuth

**GET /team/claim** - Initiate claim flow:
- Validates invite token against database
- Preliminary seat availability check
- Stores token and OAuth state in cookies
- Redirects to Discord OAuth authorization

**GET /team/claim/callback** - Handle OAuth callback:
- Validates state (CSRF protection)
- Exchanges OAuth code for Discord access token
- Fetches Discord user identity
- **Blocks individual subscribers** with clear error message
- **Blocks users already in different team**
- **Atomic seat claim** via Prisma transaction
- Creates/updates member with team linkage
- Assigns Squire role on success
- Redirects to Discord server invite

### Introduction Handler Fix
`src/bot/events/introduction.ts`:

Fixed seatTier to role mapping:
- INDIVIDUAL -> Lord (owner-level access)
- OWNER -> Lord (full access)
- TEAM_MEMBER -> Knight (member access)

Added debug logging for promotion decisions.

### Team Claim Landing Page
`public/team-claim.html`:

Medieval-themed page displaying:
- Team name from invite
- Seat type badge (Owner Seat / Team Seat)
- "Claim with Discord" button

States handled:
- Loading: Shows spinner while fetching invite info
- Valid: Shows invite details and claim button
- Invalid Token: Clear error with link to Gatekeeper
- No Seats: Explains all seats claimed, contact admin

## API Response Examples

**Claim Info (200):**
```json
{
  "teamName": "Acme Corp",
  "seatTier": "TEAM_MEMBER",
  "seatsAvailable": true
}
```

**Individual Subscriber Block (redirect):**
```
/?error=already_subscribed&message=You already have owner access through your individual subscription
```

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| OAuth identity | Discord-only | Per CONTEXT.md - no email/password required |
| Seat claim | Prisma $transaction | Atomic operation prevents race conditions |
| State storage | Cookies | Matches existing claim.ts pattern |
| Individual blocking | Redirect with message | Clear communication, no silent failure |
| INDIVIDUAL role fix | Maps to Lord | Per CONTEXT.md hierarchy: Individual = Owner |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed INDIVIDUAL seatTier mapping in introduction.ts**
- **Found during:** Task 2 review
- **Issue:** INDIVIDUAL seatTier incorrectly mapped to Knight instead of Lord
- **Fix:** Updated promoteAfterIntro to check `seatTier === 'OWNER' || seatTier === 'INDIVIDUAL'` for Lord
- **Files modified:** src/bot/events/introduction.ts
- **Commit:** 3a9ce91

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 61f41b0 | feat | Team invite claim flow with Discord OAuth |
| 3a9ce91 | fix | Correct seatTier to role mapping for INDIVIDUAL |
| 5df1703 | feat | Team claim landing page with medieval theme |

## Next Phase Readiness

**Ready for 05-05 (Seat Revocation):**
- Members can now claim team seats
- teamId and seatTier properly set on members
- Revocation can target specific team members

**Ready for 05-06 (Mid-subscription Additions):**
- Claim flow handles new invites automatically
- Same /team/claim endpoint works for additional seats

**Pre-existing issues (documented in STATE.md):**
- TypeScript errors in discord-oauth.ts and claim.ts remain unaddressed
- DISCORD_REDIRECT_URI optional in env schema (causes TS errors)

## Files Changed

```
src/routes/team-claim.ts       | NEW - Team invite claim flow routes
src/index.ts                   | MODIFIED - Mount teamClaimRouter at /team
src/bot/events/introduction.ts | MODIFIED - Fix INDIVIDUAL seatTier mapping
public/team-claim.html         | NEW - Claim landing page
```
