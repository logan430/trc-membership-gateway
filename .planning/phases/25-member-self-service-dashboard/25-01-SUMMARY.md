---
phase: 25-member-self-service-dashboard
plan: 01
subsystem: api
tags: [express, stripe, authentication, billing, dashboard]

# Dependency graph
requires:
  - phase: 03-individual-subscription
    provides: auth endpoints, member model, Stripe integration
  - phase: 05-team-subscription
    provides: team model, team member relationships
  - phase: 13-billing-portal
    provides: billing portal endpoint pattern
provides:
  - POST /auth/update-email endpoint with password verification and Stripe sync
  - POST /auth/update-password endpoint with current password verification
  - GET /billing/details endpoint with payment method, subscription, invoices
  - Extended GET /dashboard with activity timeline and team info
affects: [25-02-PLAN, 25-03-PLAN, frontend-dashboard, frontend-account, frontend-billing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Password verification before account changes"
    - "Stripe-first updates (update Stripe, then DB)"
    - "Team member vs owner billing access control"
    - "Activity timeline from member model fields"

key-files:
  created: []
  modified:
    - src/routes/auth.ts
    - src/routes/billing.ts
    - src/routes/dashboard.ts

key-decisions:
  - "Password required for email changes (magic-link users must set password first)"
  - "Update Stripe customer email before database (atomic failure handling)"
  - "Team members get 'managed by team' billing response, not full details"
  - "Activity timeline uses existing member fields (createdAt, updatedAt, introCompletedAt)"
  - "current_period_end accessed via SubscriptionItem per Stripe SDK v20+ pattern"

patterns-established:
  - "Account update endpoints require password verification"
  - "Billing endpoint returns different response based on seatTier"
  - "Timeline events derived from member model timestamps"

# Metrics
duration: 8min
completed: 2026-01-21
---

# Phase 25 Plan 01: Backend Account and Billing Endpoints Summary

**Account update endpoints (email/password) with password verification, billing details endpoint with Stripe payment method/invoice retrieval, and extended dashboard with activity timeline and team info**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-21T20:30:00Z
- **Completed:** 2026-01-21T20:38:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- POST /auth/update-email validates password, checks email uniqueness, syncs Stripe then database
- POST /auth/update-password validates current password, hashes new password with Argon2id
- GET /billing/details returns payment method (card brand/last4/expiry), subscription info, and invoice history
- Team members get "managed by team" billing response instead of full details
- GET /dashboard now includes team info and activity timeline (joined, subscribed, discord_claimed, introduced)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add account update endpoints to auth.ts** - `7e6ff43` (feat)
2. **Task 2: Add billing details endpoint to billing.ts** - `a1bfa7b` (feat)
3. **Task 3: Extend dashboard with activity timeline and team info** - `53b5a06` (feat)

## Files Created/Modified

- `src/routes/auth.ts` - Added POST /auth/update-email and /auth/update-password endpoints with Zod validation, password verification, and Stripe sync
- `src/routes/billing.ts` - Added GET /billing/details with Stripe customer, subscription, and invoice retrieval
- `src/routes/dashboard.ts` - Extended with team info and activity timeline built from member fields

## Decisions Made

- **Password required for email changes:** Magic-link-only users cannot change email without first setting a password. Returns 400 with helpful message.
- **Stripe-first updates:** Email changes update Stripe customer first, then database. If Stripe fails, database remains unchanged.
- **Team member billing access:** TEAM_MEMBER seatTier gets managedBy response with team name, not full billing details. Only OWNER and INDIVIDUAL get subscription/payment/invoice data.
- **Timeline from existing fields:** Activity timeline uses createdAt, updatedAt, introCompletedAt from Member model. No new database fields needed.
- **SubscriptionItem for current_period_end:** Following existing pattern from webhooks/stripe.ts per Stripe SDK v20+ API change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Stripe SDK v20+ current_period_end access**
- **Found during:** Task 2 (Billing details endpoint)
- **Issue:** Used subscription.current_period_end which doesn't exist in Stripe SDK v20+
- **Fix:** Changed to subscription.items.data[0].current_period_end per existing pattern in webhooks/stripe.ts
- **Files modified:** src/routes/billing.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** `de94ef4` (fix)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix necessary for TypeScript compilation. No scope creep.

## Issues Encountered

- Pre-existing TypeScript strict mode errors in discord-oauth.ts, claim.ts, team-dashboard.ts (documented in STATE.md blockers). These did not affect this plan's files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All backend endpoints complete and working
- Ready for Plan 02: Frontend pages (dashboard, account, billing)
- No blockers for frontend implementation

---
*Phase: 25-member-self-service-dashboard*
*Completed: 2026-01-21*
