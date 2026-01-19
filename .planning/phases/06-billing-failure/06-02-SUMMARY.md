---
phase: 06-billing-failure
plan: 02
subsystem: billing
tags: [webhooks, notifications, payment-failure, grace-period]

dependency_graph:
  requires:
    - 06-01 (billing failure schema fields, billing support channel)
  provides:
    - handlePaymentFailure webhook handler for invoice.payment_failed
    - handleTeamPaymentFailure for team subscription failures
    - sendPaymentFailedDm and sendTeamPaymentFailedDm notification functions
    - Grace period tracking (48 hours) on first payment failure
  affects:
    - 06-03 (notification scheduling will use sentBillingNotifications tracking)
    - 06-04 (payment recovery will clear billing failure state)

tech_stack:
  added: []
  patterns:
    - subscription_cycle filtering (ignore checkout failures)
    - prisma.$transaction for atomic team member updates
    - Notification tracking via sentBillingNotifications array push
    - Fire-and-forget DM sending with error logging (not throwing)

key_files:
  created:
    - src/billing/notifications.ts
    - src/billing/failure-handler.ts
  modified:
    - src/webhooks/stripe.ts

decisions:
  - decision: Check billing_reason === 'subscription_cycle'
    rationale: Only renewal failures should trigger grace period, not initial checkout failures
  - decision: Grace period not reset on retry failures
    rationale: Per RESEARCH.md pitfall - only set paymentFailedAt if null
  - decision: Owner detection via isPrimaryOwner OR isTeamAdmin
    rationale: Both roles get full billing details, team members get brief notice

metrics:
  duration: 4 min
  completed: 2026-01-19
---

# Phase 6 Plan 2: Payment Failure Detection Summary

Payment failure webhook handler with 48-hour grace period tracking and immediate DM notifications.

## What Was Built

### Billing Notifications Module (`src/billing/notifications.ts`)

Created DM notification functions with medieval-themed messages:

**sendPaymentFailedDm(memberId, type)**
- For individual subscription failures
- `immediate` type: Payment failed, 48 hours to resolve
- `24h_warning` type: 24 hours remaining before access restriction
- Uses try/catch - DMs can fail silently if user has DMs disabled

**sendTeamPaymentFailedDm(memberId, isOwner)**
- For team subscription failures
- Owner: Full billing details (same as individual)
- Team member: Brief notice to contact organization administrator

### Payment Failure Handler (`src/billing/failure-handler.ts`)

Created webhook handler functions:

**handlePaymentFailure(invoice)**
- Filters for `billing_reason === 'subscription_cycle'` only
- Finds member by stripeCustomerId
- Checks if member is in a team (delegates to handleTeamPaymentFailure)
- Only starts grace period on FIRST failure (checks if paymentFailedAt is null)
- Updates: paymentFailedAt, gracePeriodEndsAt (48h), subscriptionStatus to PAST_DUE
- Pushes 'immediate' to sentBillingNotifications array
- Sends immediate DM notification

**handleTeamPaymentFailure(team, invoice)**
- Checks if team grace period already started
- Uses prisma.$transaction to atomically update team and all members
- All team members get same grace period timestamps
- Notifies all members: owners get full details, others get brief notice

### Webhook Integration (`src/webhooks/stripe.ts`)

- Added import for handlePaymentFailure
- Replaced placeholder invoice.payment_failed case with actual handler call
- Handler extracts invoice from event and delegates to failure handler

## Commits

| Hash | Type | Description |
|------|------|-------------|
| e4c5cdb | feat | Create billing notifications module |
| 6c56cb1 | feat | Create payment failure handler |
| 3f233b4 | feat | Wire invoice.payment_failed to failure handler |

## Verification

- [x] TypeScript compiles for billing module files
- [x] sendPaymentFailedDm and sendTeamPaymentFailedDm exported from notifications.ts
- [x] handlePaymentFailure and handleTeamPaymentFailure exported from failure-handler.ts
- [x] invoice.payment_failed case calls handlePaymentFailure in webhook
- [x] Grace period is 48 hours (GRACE_PERIOD_MS = 48 * 60 * 60 * 1000)
- [x] First failure only - paymentFailedAt checked before setting

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for 06-03 (notification scheduling):
- Grace period tracking in place (paymentFailedAt, gracePeriodEndsAt)
- sentBillingNotifications array tracks which notifications sent
- Notification functions ready for cadence scheduling
- 24h_warning type already implemented for upcoming scheduler
