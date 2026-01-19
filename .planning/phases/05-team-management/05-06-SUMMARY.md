---
phase: 05
plan: 06
subsystem: billing
tags: [stripe, seats, proration, webhook, dashboard]

dependency-graph:
  requires: [05-04]
  provides: [mid-subscription-seat-additions, subscription-update-webhook]
  affects: [billing-operations]

tech-stack:
  added: []
  patterns:
    - "Stripe subscription item quantity updates"
    - "always_invoice proration for immediate charges"
    - "Webhook-driven database sync"

key-files:
  created: []
  modified:
    - src/routes/team-dashboard.ts
    - src/webhooks/stripe.ts
    - public/team-dashboard.html

decisions:
  - id: stripe-proration-behavior
    choice: "always_invoice for immediate charge"
    reason: "User expects immediate access to new seats"
  - id: webhook-driven-sync
    choice: "Database updated via webhook, not API response"
    reason: "Stripe is source of truth for seat counts"
  - id: status-mapping-helper
    choice: "mapStripeStatus helper function"
    reason: "Consistent status mapping across webhook handlers"

metrics:
  duration: 4 min
  completed: 2026-01-19
---

# Phase 5 Plan 6: Mid-Subscription Seat Additions Summary

**One-liner:** Stripe subscription item quantity updates with always_invoice proration and webhook-driven database sync.

## What Was Built

### POST /team/seats Endpoint
- Accepts seatType (owner/team) and quantity (1-50)
- Validates OWNER seatTier authorization
- Retrieves Stripe subscription and finds matching subscription item by price ID
- Updates quantity with `proration_behavior: 'always_invoice'` for immediate charge
- Returns previous/new quantity to client
- Database sync delegated to webhook (Stripe as source of truth)

### customer.subscription.updated Webhook Handler
- Finds team by stripeSubscriptionId
- Falls back to individual subscription handling if no team found
- Syncs ownerSeatCount and teamSeatCount from Stripe subscription items
- Updates subscriptionStatus using mapStripeStatus helper
- Handles individual subscription period end and status sync

### mapStripeStatus Helper Function
- Maps Stripe status strings to our SubscriptionStatus enum
- Handles: active, trialing, past_due, canceled, unpaid, incomplete_expired

### Team Subscription Deletion Handling
- Updated customer.subscription.deleted to check for team first
- Iterates all team members and kicks each with Discord ID
- Members without Discord get status updated to CANCELLED
- Updates team subscriptionStatus to CANCELLED
- Logs team deletion with member count

### Dashboard Add Seats UI
- Add Seats section with quantity controls for owner and team seats
- +/- buttons with incrementQuantity/decrementQuantity functions
- Purchase button calls POST /team/seats API
- Confirmation dialog warns about immediate prorated charge
- 2-second delay before refresh to allow webhook processing
- Styled with medieval theme (gold borders, Cinzel font)

## Key Technical Details

### Stripe Proration
```typescript
const updatedItem = await stripe.subscriptionItems.update(item.id, {
  quantity: (item.quantity ?? 0) + quantity,
  proration_behavior: 'always_invoice',
});
```
- `always_invoice` creates and pays invoice immediately
- User is charged prorated amount for remainder of billing period
- No waiting for next billing cycle

### Webhook Sync Flow
1. User purchases seats via dashboard
2. Stripe updates subscription item quantity
3. Stripe fires `customer.subscription.updated` webhook
4. Webhook handler finds team by subscriptionId
5. Database updated with new seat counts from Stripe
6. Dashboard refresh shows new totals

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

| File | Changes |
|------|---------|
| src/routes/team-dashboard.ts | +104 lines - POST /team/seats endpoint |
| src/webhooks/stripe.ts | +118 lines - subscription.updated handler, mapStripeStatus, team deletion |
| public/team-dashboard.html | +194 lines - Add Seats section with CSS and JS |

## Commits

| Hash | Message |
|------|---------|
| a8d40ed | feat(05-06): add seat addition API endpoint |
| fc31d53 | feat(05-06): add subscription update webhook handler |
| eafa65c | feat(05-06): add seat purchase UI to team dashboard |

## Verification Results

- TypeScript compiles without errors
- POST /team/seats endpoint exists and validates input
- customer.subscription.updated webhook handler implemented
- mapStripeStatus helper function added
- Team subscription deletion kicks all members
- Dashboard shows Add Seats section with quantity controls
- Confirmation dialog warns about immediate charge

## Next Phase Readiness

Phase 5 Team Management is now complete:
- [x] 05-01: Schema updates and company checkout flow
- [x] 05-02: Team dashboard with seat view
- [x] 05-03: Invite token generation and management
- [x] 05-04: Invite claim flow with Discord OAuth
- [x] 05-05: Seat revocation with immediate kick
- [x] 05-06: Mid-subscription seat additions

Ready to proceed to Phase 6 (Admin Tools) or Phase 7 (Renewal/Lapse) based on priority.

## Questions for Future Phases

None.
