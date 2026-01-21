# Schema and Constraint Verification Audit

**Audit Date:** 2026-01-20
**Schema Version:** Prisma 7.x
**Database:** PostgreSQL (Supabase)

## Unique Constraints Audit

All `@unique` constraints in the Prisma schema verified against application requirements.

| Model | Field | Required | Constraint | Purpose | Status |
|-------|-------|----------|------------|---------|--------|
| Member | discordId | Optional | @unique | Prevents duplicate Discord account linking | VERIFIED |
| Member | stripeCustomerId | Optional | @unique | Prevents duplicate Stripe customer assignments | VERIFIED |
| Member | email | Optional | @unique | Prevents duplicate email addresses | VERIFIED |
| Team | stripeCustomerId | Required | @unique | Each team has unique Stripe customer | VERIFIED |
| Team | stripeSubscriptionId | Optional | @unique | One subscription per team | VERIFIED |
| StripeEvent | eventId | Required | @unique | Webhook idempotency - critical for preventing duplicate processing | VERIFIED |
| PendingInvite | token | Required | @unique | Prevents token collision in invite links | VERIFIED |
| Admin | email | Required | @unique | Admin email uniqueness for login | VERIFIED |
| FeatureFlag | key | Required | @unique | Feature flag key uniqueness | VERIFIED |
| EmailTemplate | name | Required | @unique | Template name uniqueness | VERIFIED |

### Unique Constraint Notes

**Member.discordId (Optional, Unique)**
- Allows NULL values (multiple members can have NULL discordId)
- Prevents linking same Discord account to multiple members
- Per PROJECT.md: "we always know who everyone is" - critical constraint

**Member.stripeCustomerId (Optional, Unique)**
- Allows NULL for team members (they use team's stripeCustomerId)
- Prevents same Stripe customer assigned to multiple members
- Individual subscribers must have unique Stripe customer

**Member.email (Optional, Unique)**
- Allows NULL values
- Prevents duplicate email addresses for registered members
- Required for magic link authentication to work correctly

**Team.stripeCustomerId (Required, Unique)**
- Every team must have a Stripe customer
- Prevents billing confusion between teams

**StripeEvent.eventId (Required, Unique)**
- Critical idempotency mechanism
- Stripe event IDs are globally unique
- "Record before process" pattern relies on this constraint
- If INSERT fails due to unique violation, duplicate webhook delivery is detected

**PendingInvite.token (Required, Unique)**
- Generated with crypto.randomBytes (256 bits entropy)
- Collision probability negligible, but constraint provides database guarantee

### Summary

| Count | Status |
|-------|--------|
| 10 | VERIFIED |
| 0 | MISSING |
| 0 | INCORRECT |

All expected unique constraints are present and correctly defined.
