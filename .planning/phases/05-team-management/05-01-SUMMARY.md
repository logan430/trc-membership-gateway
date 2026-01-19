---
phase: 05-team-management
plan: 01
subsystem: checkout
tags: [stripe, checkout, team, prisma, webhook]

dependency-graph:
  requires:
    - 04-introduction-requirement
  provides:
    - company-checkout-flow
    - team-record-creation
    - primary-owner-assignment
  affects:
    - 05-02 (team dashboard needs Team records)
    - 05-03 (invite tokens for team seats)
    - 05-04 (invite claim uses team/seat data)

tech-stack:
  added: []
  patterns:
    - multi-line-item-stripe-checkout
    - subscription-metadata-routing
    - pre-webhook-record-creation

file-tracking:
  key-files:
    created:
      - src/routes/company-checkout.ts
    modified:
      - prisma/schema.prisma
      - src/config/env.ts
      - src/webhooks/stripe.ts
      - src/index.ts

decisions:
  - id: team-before-checkout
    choice: Create Team record before Stripe checkout session
    why: Prevents webhook race condition - Team exists when webhook fires
  - id: subscription-metadata-routing
    choice: Use subscription_data.metadata.planType to distinguish checkout types
    why: Clean separation between individual and company flows in webhook handler
  - id: primary-owner-protection
    choice: Add isPrimaryOwner field to Member model
    why: Purchaser cannot be revoked by other org members per CONTEXT.md

metrics:
  duration: 4 min
  completed: 2026-01-19
---

# Phase 5 Plan 1: Schema and Company Checkout Summary

**One-liner:** Multi-seat company checkout with Team pre-creation and subscription metadata routing

## What Was Built

### Schema Updates
- Added `isPrimaryOwner` field to Member model (Boolean, default false) - protects purchaser from being revoked by other org members
- Updated PendingInvite model per CONTEXT.md requirements:
  - Removed `email` field (invitees only need Discord OAuth)
  - Removed `expiresAt` field (tokens never expire)
  - Added `createdBy` field (Member ID who created the invite)
  - Removed `@@index([email])` index

### Environment Configuration
- Added `STRIPE_OWNER_SEAT_PRICE_ID` (optional, startsWith 'price_')
- Added `STRIPE_TEAM_SEAT_PRICE_ID` (optional, startsWith 'price_')

### Company Checkout Route
`POST /company/checkout` endpoint:
- Validates request body: ownerSeats (min 1), teamSeats (min 0), companyName (3-100 chars)
- Checks user doesn't have active subscription or existing team
- Creates Team record BEFORE Stripe checkout session (prevents webhook race)
- Creates multi-line_item Stripe checkout with owner and team seat prices
- Passes metadata: `{ teamId, planType: 'company', memberId }` in subscription_data

### Webhook Handler Extension
Extended `checkout.session.completed` handler:
- Detects company checkout via `subscription.metadata.planType === 'company'`
- Finds owner/team seat items by price ID matching
- Updates Team: stripeSubscriptionId, subscriptionStatus ACTIVE, syncs seat counts
- Updates purchaser Member: links to team, isPrimaryOwner, isTeamAdmin, seatTier OWNER

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Team creation timing | Before checkout | Prevents "Team not found" race condition in webhook |
| Checkout type detection | subscription_data.metadata.planType | Clean routing in webhook, no client_reference_id ambiguity |
| Primary owner field | Dedicated isPrimaryOwner field | Explicit protection, separate from isTeamAdmin role |
| Invite token model | No email, no expiry | Per CONTEXT.md - multi-use tokens, Discord OAuth only |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| a41295c | chore | Schema and environment updates for company checkout |
| 368eae1 | feat | Company checkout route with multi-seat Stripe session |
| 5a6470a | feat | Webhook handler for company checkout completion |

## Next Phase Readiness

**Ready for 05-02 (Team Dashboard):**
- Team model has all needed fields (name, seat counts, subscription status)
- Member.isPrimaryOwner available for dashboard access control
- Team-Member relationship established

**Blockers for testing:**
- STRIPE_OWNER_SEAT_PRICE_ID must be set (create price in Stripe Dashboard)
- STRIPE_TEAM_SEAT_PRICE_ID must be set (create price in Stripe Dashboard)
- Pre-existing TypeScript errors in discord-oauth.ts and claim.ts remain

## Files Changed

```
prisma/schema.prisma         | +isPrimaryOwner on Member, updated PendingInvite
src/config/env.ts            | +STRIPE_OWNER_SEAT_PRICE_ID, +STRIPE_TEAM_SEAT_PRICE_ID
src/routes/company-checkout.ts | NEW - Company checkout endpoint
src/webhooks/stripe.ts       | Extended for company checkout handling
src/index.ts                 | Register companyCheckoutRouter
```
