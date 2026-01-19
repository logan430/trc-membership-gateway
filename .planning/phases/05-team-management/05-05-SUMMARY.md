---
phase: 05-team-management
plan: 05
subsystem: api, ui
tags: [discord, revocation, team-management, dashboard]

# Dependency graph
requires:
  - phase: 05-02
    provides: Team dashboard API and UI
  - phase: 05-04
    provides: Team claim flow with seat assignment
provides:
  - DELETE /team/members/:memberId endpoint for seat revocation
  - revokeAndKickAsync function for Discord removal
  - Dashboard UI with revoke buttons and confirmation
affects: [05-06, team-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Fire-and-forget async revocation with p-retry
    - Generic farewell DM (no blame assigned)
    - Primary owner protection from revocation

key-files:
  created: []
  modified:
    - src/lib/role-assignment.ts
    - src/routes/team-dashboard.ts
    - public/team-dashboard.html

key-decisions:
  - "Generic farewell DM on revocation (no blame)"
  - "Revoked member unlinked from team but record preserved"
  - "Primary owner cannot be revoked by other team members"
  - "Cannot revoke your own seat"

patterns-established:
  - "Revocation clears teamId, seatTier, subscriptionStatus, and intro status"
  - "Confirmation dialog required before revocation"
  - "You badge for current user identification"

# Metrics
duration: 3min
completed: 2026-01-19
---

# Phase 5 Plan 5: Seat Revocation Summary

**DELETE endpoint for seat revocation with Discord kick, generic farewell DM, and dashboard UI with confirmation dialogs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-19T15:15:48Z
- **Completed:** 2026-01-19T15:18:40Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- revokeAndKickAsync function sends generic farewell DM and kicks member
- DELETE /team/members/:memberId endpoint with owner-only access and protection rules
- Dashboard revoke buttons with confirmation dialog and success notification
- Primary owner and self-revocation protection

## Task Commits

Each task was committed atomically:

1. **Task 1: Revocation function in role-assignment** - `d200b82` (feat)
2. **Task 2: Revocation API endpoint** - `4e58c85` (feat)
3. **Task 3: Dashboard UI revoke buttons** - `f08cc49` (feat)

## Files Created/Modified

- `src/lib/role-assignment.ts` - Added revokeAndKickAsync and updateRevokedMember helper
- `src/routes/team-dashboard.ts` - Added DELETE /team/members/:memberId endpoint
- `public/team-dashboard.html` - Added revoke buttons, confirmation, notification toast

## Decisions Made

- **Generic farewell DM on revocation:** Per CONTEXT.md requirement - "access ended, no blame assigned"
- **Revoked member record preserved:** Member unlinked from team (teamId=null, seatTier=null) but record kept for potential future individual subscription
- **Primary owner protection:** isPrimaryOwner check prevents revocation by other team members
- **You badge in dashboard:** Visual indication of current user's card

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed plan specification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Seat revocation complete with immediate Discord removal
- Ready for 05-06: Mid-subscription seat additions
- All team management features (invite, claim, revoke) now functional

---
*Phase: 05-team-management*
*Completed: 2026-01-19*
