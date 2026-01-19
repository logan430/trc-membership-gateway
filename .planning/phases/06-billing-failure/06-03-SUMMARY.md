---
phase: 06-billing-failure
plan: 03
subsystem: billing
tags: [debtor-state, scheduler, notifications, billing-failure]

dependency_graph:
  requires:
    - 06-01 (billing failure schema fields)
    - 06-02 (payment failure handler, immediate notifications)
  provides:
    - moveToDebtorState function for grace period expiry
    - kickAfterDebtorExpiry function for 30-day limit
    - Full notification cadence (reminders, final warnings)
    - startBillingScheduler with 5-minute polling
  affects:
    - 06-04 (payment recovery will restore from Debtor state)

tech_stack:
  added: []
  patterns:
    - Database-backed polling scheduler (setInterval + Prisma queries)
    - Notification tracking via sentBillingNotifications array
    - Debtor state with previous role preservation
    - Fire-and-forget DM sending with graceful error handling

key_files:
  created:
    - src/billing/debtor-state.ts
    - src/billing/scheduler.ts
  modified:
    - src/billing/notifications.ts
    - src/index.ts

decisions:
  - decision: Previous role stored BEFORE role changes
    rationale: Per RESEARCH.md pitfall - cannot restore correct role if not captured first
  - decision: 5-minute polling interval
    rationale: Per RESEARCH.md - simple, database-backed, survives restarts
  - decision: Notification marked sent even if DM fails
    rationale: User may have DMs disabled; prevents spam on retry

metrics:
  duration: 3 min
  completed: 2026-01-19
---

# Phase 6 Plan 3: Notification System and Scheduling Summary

Debtor state transitions, billing scheduler, and full notification cadence for payment failure lifecycle.

## What Was Built

### Debtor State Management (`src/billing/debtor-state.ts`)

Created state transition functions:

**moveToDebtorState(memberId)**
- Fetches member and Discord guild member
- CRITICAL: Captures previous role (Lord/Knight) BEFORE any changes
- Updates database first: previousRole, isInDebtorState, debtorStateEndsAt (30 days)
- Removes all managed roles, adds Debtor role
- Sends debtor transition DM

**moveTeamToDebtorState(teamId)**
- Updates team debtorStateEndsAt
- Calls moveToDebtorState for each team member with discordId

**kickAfterDebtorExpiry(memberId)**
- Sends farewell DM with medieval message
- Removes all roles and kicks from server with p-retry
- Clears all billing failure fields, sets status to CANCELLED

**kickTeamAfterDebtorExpiry(teamId)**
- Kicks all team members
- Deletes unclaimed pending invites for the team
- Updates team status to CANCELLED

### Extended Notifications (`src/billing/notifications.ts`)

Added new notification functions:

**sendBillingReminderDm(memberId, daysRemaining)**
- For 7, 10, 15, 20, 25 day reminders
- "Thou hast {daysRemaining} days remaining..."

**sendFinalWarningDm(memberId, hoursRemaining)**
- For 48h, 24h, 12h final warnings
- "URGENT: Final Warning from The Treasury..."

**sendKickNotificationDm(memberId)**
- Farewell message when access ends
- Includes APP_URL for potential return

### Billing Scheduler (`src/billing/scheduler.ts`)

Created polling-based scheduler:

**NOTIFICATION_SCHEDULE constant**
- Full cadence per CONTEXT.md: immediate, 24h, debtor transition, 7/10/15/20/25 day reminders, 48h/24h/12h final warnings

**processBillingPoll()**
- Processes grace period expirations (individual + team)
- Processes debtor state expirations (individual + team)
- Processes notification cadence for all members in failure state
- Tracks sent notifications via sentBillingNotifications array

**startBillingScheduler()**
- Initial poll on startup
- 5-minute interval for recurring polls
- Graceful error handling - scheduler continues on individual failures

### Index Integration (`src/index.ts`)

- Imported startBillingScheduler
- Called after bot is ready (in startBot().then())

## Commits

| Hash | Type | Description |
|------|------|-------------|
| eaae984 | feat | Create Debtor state transition functions |
| b177715 | feat | Extend notifications for full billing cadence |
| 21a2f39 | feat | Create billing scheduler with 5-minute polling |

## Verification

- [x] TypeScript compiles for billing module files (no errors in billing/)
- [x] moveToDebtorState stores previous role before role swap
- [x] kickAfterDebtorExpiry clears all billing fields
- [x] NOTIFICATION_SCHEDULE covers full cadence per CONTEXT.md
- [x] startBillingScheduler exported and called in index.ts
- [x] Notifications tracked via sentBillingNotifications array

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for 06-04 (payment recovery):
- Debtor state transition functions in place
- Previous role stored for restoration
- All billing failure fields defined and managed
- Scheduler handles state transitions and notifications
