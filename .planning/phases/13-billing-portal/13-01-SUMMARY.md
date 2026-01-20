---
phase: 13-billing-portal
plan: 01
subsystem: payments
tags: [stripe, billing-portal, express]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Express app, Stripe SDK, requireAuth middleware
  - phase: 09-frontend-pages
    provides: Dashboard frontend calling /billing/portal
provides:
  - POST /billing/portal endpoint returning Stripe portal URL
  - Individual and team member customer ID resolution
affects: [none - gap closure, completes existing frontend integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [customer-id-resolution-pattern]

key-files:
  created: [src/routes/billing.ts]
  modified: [src/index.ts]

key-decisions:
  - "Team members use team.stripeCustomerId for billing portal"
  - "Return URL uses /app/dashboard (Phase 12 route structure)"

patterns-established:
  - "Customer ID resolution: check teamId first, use team's customer ID for team members"

# Metrics
duration: 4min
completed: 2026-01-20
---

# Phase 13 Plan 01: Billing Portal Endpoint Summary

**POST /billing/portal endpoint enabling Stripe Customer Portal access for both individual and team members**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-20T14:06:00Z
- **Completed:** 2026-01-20T14:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- POST /billing/portal endpoint with requireAuth middleware
- Customer ID resolution supporting both individual and team members
- Proper error handling for missing billing account
- Route registered in Express app at /billing path

## Task Commits

Each task was committed atomically:

1. **Task 1: Create billing route with portal endpoint** - `46d675a` (feat)
2. **Task 2: Register billing route in Express app** - `6ff19e6` (feat)

## Files Created/Modified
- `src/routes/billing.ts` - Billing portal endpoint with customer ID resolution
- `src/index.ts` - billingRouter import and registration at /billing

## Decisions Made
- Team members use team.stripeCustomerId - team owns the subscription
- Return URL is `/app/dashboard` - matches Phase 12 route restructure
- Member lookup includes team relation for customer ID resolution

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in other files (discord-oauth.ts, claim.ts, team-dashboard.ts) unrelated to this plan. The billing.ts file compiles without errors.

## User Setup Required

None - no external service configuration required. Note: Stripe Customer Portal must be configured in Stripe Dashboard before testing (per 13-RESEARCH.md).

## Next Phase Readiness
- Billing portal endpoint complete and registered
- Dashboard "Manage Billing" button will now work (no more 404)
- Ready for Phase 14 (Admin filter parameter mismatch)

---
*Phase: 13-billing-portal*
*Completed: 2026-01-20*
