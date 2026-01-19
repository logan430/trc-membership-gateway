---
phase: 06-billing-failure
plan: 01
subsystem: billing
tags: [schema, discord, channels, billing-failure]

dependency_graph:
  requires:
    - 01-foundation (Prisma schema, Express app)
    - 02-discord (Discord bot client, role config)
  provides:
    - billing failure tracking fields in Member and Team models
    - ensureBillingSupportChannel utility function
    - #billing-support channel created on bot startup
  affects:
    - 06-02 (webhook handlers will use billing failure fields)
    - 06-03 (notification system will use sentBillingNotifications field)

tech_stack:
  added: []
  patterns:
    - database-backed billing state tracking
    - channel permission overwrites for role-based access
    - defensive bot startup (try/catch around channel creation)

key_files:
  created:
    - src/bot/channels.ts
  modified:
    - prisma/schema.prisma
    - src/config/env.ts
    - src/bot/client.ts

decisions:
  - decision: String array for notification tracking
    rationale: sentBillingNotifications String[] tracks notification keys like "immediate_sent" to prevent duplicate notifications

metrics:
  duration: 4 min
  completed: 2026-01-19
---

# Phase 6 Plan 1: Schema and Channel Foundation Summary

Database schema fields for billing failure tracking and #billing-support channel with Debtor-only read access.

## What Was Built

### Database Schema Updates

Added billing failure tracking fields to the Member model:
- `paymentFailedAt`: When first payment failure detected
- `gracePeriodEndsAt`: 48 hours after paymentFailedAt
- `debtorStateEndsAt`: 30 days after entering debtor state
- `previousRole`: Stores 'Knight' or 'Lord' for restoration after recovery
- `isInDebtorState`: Boolean flag for debtor state
- `sentBillingNotifications`: String array tracking which notifications have been sent

Added billing failure tracking fields to the Team model:
- `paymentFailedAt`
- `gracePeriodEndsAt`
- `debtorStateEndsAt`

### Channel Management Utility

Created `src/bot/channels.ts` with `ensureBillingSupportChannel` function:
- Checks if channel already exists (by name 'billing-support')
- Creates channel with correct permission overwrites:
  - @everyone: Deny ViewChannel (hidden from everyone)
  - Debtor role: Allow ViewChannel, ReadMessageHistory; Deny SendMessages
  - Bot: Allow ViewChannel, SendMessages, ManageMessages (for pinning)
- Sends and pins medieval-themed instructions message

### Bot Startup Integration

Updated `src/bot/client.ts` to call `ensureBillingSupportChannel` on bot ready:
- Called after role sync
- Wrapped in try/catch to prevent startup failure
- Logs success or error

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 40fbca8 | feat | Add billing failure tracking fields to schema |
| cb61d1f | feat | Create billing support channel management utility |
| 605d955 | feat | Call billing support channel setup on bot ready |

## Verification

- [x] `npx prisma db push` succeeds with new fields
- [x] `npx prisma generate` regenerates client successfully
- [x] TypeScript compiles for channels.ts and client.ts (pre-existing errors in other files documented in STATE.md)
- [x] ensureBillingSupportChannel exported from src/bot/channels.ts

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for 06-02 (webhook handlers):
- Billing failure fields available in Member and Team models
- #billing-support channel will exist on bot startup
- Channel utility function available for reference in notification code
