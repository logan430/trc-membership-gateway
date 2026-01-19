---
phase: 04-introduction-requirement
plan: 03
subsystem: payments
tags: [stripe, webhooks, discord, roles, kick]

# Dependency graph
requires:
  - phase: 02-discord
    provides: Discord bot with role management (addRoleToMember, MANAGED_ROLES)
  - phase: 03-individual
    provides: Stripe webhook infrastructure, member model with discordId
provides:
  - customer.subscription.deleted webhook handler
  - removeAndKickAsync fire-and-forget function
  - removeAllManagedRoles function
  - Farewell DM before kick
affects: [05-billing-issues, future-subscription-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget async removal with p-retry"
    - "Farewell DM before kick (best effort)"
    - "Database status update after Discord action"

key-files:
  created: []
  modified:
    - src/webhooks/stripe.ts
    - src/lib/role-assignment.ts
    - src/bot/roles.ts

key-decisions:
  - "customer.subscription.deleted triggers kick (not subscription.updated)"
  - "Farewell DM sent before kick to ensure delivery"
  - "introCompleted reset to false for potential resubscription"

patterns-established:
  - "removeAndKickAsync: fire-and-forget pattern with internal error handling"
  - "removeAllManagedRoles: batch role removal for all TRC roles"

# Metrics
duration: 5min
completed: 2026-01-18
---

# Phase 04 Plan 03: Subscription Cancellation Summary

**Subscription deletion triggers farewell DM, role removal, and server kick with retry logic**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-18T00:00:00Z
- **Completed:** 2026-01-18T00:05:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- customer.subscription.deleted webhook handler implemented
- removeAllManagedRoles removes Squire/Knight/Lord/Debtor roles
- removeAndKickAsync sends farewell DM then kicks with p-retry
- Database subscription status set to CANCELLED after kick
- introCompleted reset to false for potential resubscription

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Role Removal Functions** - `72f94e3` (feat)
2. **Task 2: Implement Subscription Deleted Webhook Handler** - `17ee01f` (feat)

## Files Created/Modified
- `src/webhooks/stripe.ts` - Added customer.subscription.deleted handler with member lookup
- `src/lib/role-assignment.ts` - Added removeAndKickAsync for fire-and-forget removal
- `src/bot/roles.ts` - Added removeAllManagedRoles to batch-remove managed roles

## Decisions Made
- customer.subscription.deleted used (fires at period end, not on cancel initiation)
- Farewell DM sent before kick to ensure user receives message
- introCompleted reset to false so resubscribing users can re-introduce

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Subscription cancellation flow complete
- Ready for Phase 04 Plan 01/02 (introduction detection and promotion)
- Pre-existing TypeScript errors in discord-oauth.ts and claim.ts should be addressed

---
*Phase: 04-introduction-requirement*
*Completed: 2026-01-18*
