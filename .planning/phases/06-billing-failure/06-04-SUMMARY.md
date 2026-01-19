---
phase: 06-billing-failure
plan: 04
subsystem: billing
tags: [stripe, webhook, recovery, discord, roles, dashboard]

# Dependency graph
requires:
  - phase: 06-01
    provides: Billing failure schema fields and #billing-support channel
  - phase: 06-02
    provides: Payment failure detection and grace period tracking
  - phase: 06-03
    provides: Debtor state transitions and notification cadence
provides:
  - Payment recovery detection via invoice.paid webhook
  - Role restoration from Debtor state to previous role
  - Recovery notification functions (grace period and Debtor)
  - Team dashboard billing status banner
affects: [07-dashboard, 08-admin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - invoice.paid webhook for payment recovery detection
    - restoreFromDebtorState helper for role restoration
    - Billing banner pattern for dashboard status display

key-files:
  created:
    - src/billing/recovery-handler.ts
  modified:
    - src/billing/notifications.ts
    - src/webhooks/stripe.ts
    - src/routes/team-dashboard.ts
    - public/team-dashboard.html

key-decisions:
  - "invoice.paid not invoice.payment_succeeded for recovery detection"
  - "Default to Knight role if previousRole is null"
  - "Team recovery processes all members together"
  - "Billing banner shown when paymentFailedAt exists or PAST_DUE status"

patterns-established:
  - "Recovery handler pattern: check billing_reason, verify failure state exists, restore access"
  - "Team recovery: iterate all members, restore each, clear team state last"

# Metrics
duration: 5min
completed: 2026-01-19
---

# Phase 06 Plan 04: Payment Recovery Summary

**Payment recovery via invoice.paid webhook with role restoration and dashboard billing banner**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-19T16:16:29Z
- **Completed:** 2026-01-19T16:21:30Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Recovery notification functions for grace period and Debtor state recovery
- Payment recovery handler detecting invoice.paid and restoring access
- Team dashboard shows billing status banner when in failure state
- Full billing failure state cleared on successful payment

## Task Commits

Each task was committed atomically:

1. **Task 1: Add recovery notification functions** - `2cfd4b4` (feat)
2. **Task 2: Create payment recovery handler** - `12a0bff` (feat)
3. **Task 3: Wire webhook and update dashboard** - `d7301e3` (feat)

## Files Created/Modified
- `src/billing/recovery-handler.ts` - handlePaymentRecovery and handleTeamPaymentRecovery
- `src/billing/notifications.ts` - sendGracePeriodRecoveryDm, sendDebtorRecoveryDm, sendTeamRecoveryDm
- `src/webhooks/stripe.ts` - invoice.paid case calling handlePaymentRecovery
- `src/routes/team-dashboard.ts` - Added paymentFailedAt to API response
- `public/team-dashboard.html` - Billing banner HTML/CSS/JS

## Decisions Made
- Used invoice.paid event (more common than invoice.payment_succeeded, equivalent)
- Default restored role is Knight if previousRole not stored (safety fallback)
- Team recovery notifies owners with full message, members with brief message
- Billing banner displays when paymentFailedAt or subscriptionStatus === 'PAST_DUE'

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 6 billing failure handling is complete
- Full lifecycle: failure detection -> grace period -> Debtor state -> recovery
- Ready for Phase 7 (dashboard enhancements) or Phase 8 (admin features)

---
*Phase: 06-billing-failure*
*Completed: 2026-01-19*
