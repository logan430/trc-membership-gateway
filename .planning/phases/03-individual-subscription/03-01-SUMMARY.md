---
phase: 03-individual-subscription
plan: 01
subsystem: auth, payments
tags: [argon2, stripe, jwt, express, zod]

# Dependency graph
requires:
  - phase: 02-discord-integration
    provides: JWT session utilities, auth middleware
  - phase: 01-foundation
    provides: Stripe webhook infrastructure, Prisma schema
provides:
  - Argon2id password hashing utilities
  - Email+password signup endpoint
  - Email+password login endpoint
  - Stripe Checkout session creation
  - checkout.session.completed webhook handler
affects: [03-02 (claim flow needs authenticated users), 05-company-subscription (similar checkout pattern)]

# Tech tracking
tech-stack:
  added: [argon2]
  patterns: [timing-safe password verification, anti-enumeration responses]

key-files:
  created:
    - src/lib/password.ts
    - src/routes/checkout.ts
  modified:
    - prisma/schema.prisma
    - src/config/env.ts
    - src/routes/auth.ts
    - src/webhooks/stripe.ts
    - src/index.ts

key-decisions:
  - "Argon2id with OWASP 2025 parameters for password hashing"
  - "Email unique constraint added to Member model"
  - "Timing-safe password verification with dummy hash for non-existent users"
  - "Anti-enumeration: signup returns same response for existing emails"
  - "currentPeriodEnd from SubscriptionItem (Stripe SDK v20+ API change)"

patterns-established:
  - "Zod validation for request body parsing"
  - "Generic error messages for auth failures (anti-enumeration)"

# Metrics
duration: 8min
completed: 2026-01-18
---

# Phase 3 Plan 1: Registration and Checkout Summary

**Email+password registration with Argon2id hashing, Stripe Checkout integration, and subscription activation webhook**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-18T21:05:00Z
- **Completed:** 2026-01-18T21:13:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Password hashing infrastructure with OWASP 2025 recommended Argon2id parameters
- User registration and login endpoints with timing-safe verification
- Stripe Checkout session creation for Individual Monthly subscriptions
- Webhook handler that activates subscription status on successful checkout

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema and Password Infrastructure** - `cbe5ea0` (feat)
2. **Task 2: Signup and Checkout Routes** - `3a15f98` (feat)
3. **Task 3: Checkout Completed Webhook Handler** - `fa3e9dd` (feat)

## Files Created/Modified

- `src/lib/password.ts` - Argon2id hashing with hashPassword() and verifyPassword()
- `src/routes/checkout.ts` - POST /checkout endpoint for Stripe Checkout sessions
- `prisma/schema.prisma` - Added passwordHash field and email unique constraint
- `src/config/env.ts` - Added STRIPE_INDIVIDUAL_PRICE_ID and DISCORD_INVITE_URL
- `src/routes/auth.ts` - Added POST /auth/signup and POST /auth/login endpoints
- `src/webhooks/stripe.ts` - Implemented checkout.session.completed handler
- `src/index.ts` - Mounted checkoutRouter

## Decisions Made

- **Argon2id parameters:** memoryCost: 19456 (19 MiB), timeCost: 2, parallelism: 1 - OWASP 2025 recommendation
- **Email unique constraint:** Added @unique to email field for proper lookup and preventing duplicates
- **Timing-safe verification:** Always verify password against dummy hash when user not found to prevent timing attacks
- **Anti-enumeration:** Signup returns same success response for existing emails (acts like login)
- **Stripe SDK v20 adaptation:** currentPeriodEnd now comes from SubscriptionItem, not Subscription object

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Stripe SDK v20 type incompatibility**
- **Found during:** Task 3 (Webhook handler implementation)
- **Issue:** `current_period_end` property removed from Subscription in Stripe SDK v20, moved to SubscriptionItem
- **Fix:** Read currentPeriodEnd from first subscription item instead of subscription object
- **Files modified:** src/webhooks/stripe.ts
- **Verification:** Build passes, type checking succeeds
- **Committed in:** fa3e9dd (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary adaptation for Stripe SDK v20 compatibility. No scope creep.

## Issues Encountered

- Zod error property changed from `.errors` to `.issues` (was auto-fixed in a prior commit by another process)

## User Setup Required

**External services require manual configuration.** The plan frontmatter specifies:

| Variable | Source |
|----------|--------|
| STRIPE_INDIVIDUAL_PRICE_ID | Stripe Dashboard -> Products -> Create Product -> Add Monthly Price -> Copy Price ID (starts with price_) |
| DISCORD_INVITE_URL | Discord Server Settings -> Invites -> Create Invite -> Copy URL |

## Next Phase Readiness

- Registration and checkout flow complete for Individual tier
- Ready for 03-02: Claim flow (Discord linking after payment)
- Stripe product and price must be created before testing checkout

---
*Phase: 03-individual-subscription*
*Plan: 01*
*Completed: 2026-01-18*
