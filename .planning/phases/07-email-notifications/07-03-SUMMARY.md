---
phase: 07-email-notifications
plan: 03
subsystem: billing-email-integration
tags: [email, billing, payment-failure, payment-recovery, transactional]
dependency-graph:
  requires: [07-01, 06-billing-failure]
  provides: [payment-failure-email, payment-recovered-email]
  affects: []
tech-stack:
  added: []
  patterns: [fire-and-forget-email, billing-portal-url-generation]
key-files:
  created: []
  modified:
    - src/email/templates.ts
    - src/email/send.ts
    - src/billing/failure-handler.ts
    - src/billing/recovery-handler.ts
decisions:
  - key: fire-and-forget-email
    choice: "Email sending uses .catch() pattern, doesn't block webhook processing"
    rationale: "Email delivery shouldn't fail webhook handling"
  - key: owners-only-team-email
    choice: "Team payment emails sent to owners only (isPrimaryOwner or isTeamAdmin)"
    rationale: "Consistent with DM notification pattern; regular members don't need billing details"
  - key: billing-portal-url-generation
    choice: "Generate fresh Stripe billing portal URL for each failure email"
    rationale: "Portal sessions have limited validity; ensures link works when user opens email"
metrics:
  duration: 4 min
  completed: 2026-01-19
---

# Phase 7 Plan 03: Email Sending Integration Summary

Payment failure and recovery emails wired to existing webhook handlers, complementing Discord DM notifications.

## What Was Built

### Billing Email Templates

Extended `src/email/templates.ts` with two new templates:

**paymentFailureEmailTemplate:**
- Subject: "Action needed: Payment issue with The Revenue Council"
- Body includes: Medieval Treasury greeting, timeline consequences (48h grace, then restricted, then kicked at 30d), billing portal URL, common failure causes
- Urgency messaging per CONTEXT.md requirements

**paymentRecoveredEmailTemplate:**
- Subject: "Payment received - Welcome back!"
- Body varies by `wasInDebtorState`:
  - true: Celebrates full access restoration from Debtor state
  - false: Thanks for swift resolution during grace period
- Medieval tone consistent with DM notifications

### Email Send Functions

Extended `src/email/send.ts` with:
- `sendPaymentFailureEmail(email, portalUrl, gracePeriodHours)` - Uses failure template
- `sendPaymentRecoveredEmail(email, wasInDebtorState)` - Uses recovered template

Both functions log email send status for debugging with EMAIL_PROVIDER=console.

### Failure Handler Integration

Modified `src/billing/failure-handler.ts`:

**Individual subscription failure:**
1. After sending DM notification
2. If member has email and stripeCustomerId:
   - Generate Stripe billing portal session (return URL: dashboard)
   - Fire-and-forget sendPaymentFailureEmail with portal URL
   - Log errors but don't block webhook

**Team subscription failure:**
1. After sending DM to all team members
2. If team has stripeCustomerId:
   - Generate one billing portal session for team
   - Fire-and-forget sendPaymentFailureEmail to each owner (isPrimaryOwner or isTeamAdmin)
   - Log errors but don't block webhook

### Recovery Handler Integration

Modified `src/billing/recovery-handler.ts`:

**Individual subscription recovery:**
1. After sending DM notification
2. If member has email:
   - Fire-and-forget sendPaymentRecoveredEmail with wasInDebtorState flag
   - Log errors but don't block webhook

**Team subscription recovery:**
1. For each team member with Discord
2. If member is owner and has email:
   - Fire-and-forget sendPaymentRecoveredEmail with member's debtor state
   - Log errors but don't block webhook

## Task Execution

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create billing email templates | 02211aa | templates.ts |
| 2 | Add send functions and wire to handlers | 631555b | send.ts, failure-handler.ts, recovery-handler.ts |

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Fire-and-forget pattern | .catch() on email sends | Don't block webhook processing on email failures |
| Owners only for team emails | isPrimaryOwner or isTeamAdmin | Regular team members don't need billing details |
| Fresh portal URL per email | Generate on each failure | Portal sessions expire; ensures link works |
| Email after DM | Send email after Discord DM | DM is faster; email is backup/formal record |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**EMAIL-04 (Payment failure email):** COMPLETE
- Fires on invoice.payment_failed for renewal failures
- Includes billing portal URL and grace period timeline
- Medieval Treasury theme

**EMAIL-05 (Payment recovered email):** COMPLETE
- Fires on invoice.paid after prior failure
- Appropriate celebration message based on debtor state
- Medieval Treasury theme

**Testing with EMAIL_PROVIDER=console:**
1. Set `EMAIL_PROVIDER=console` in .env
2. Trigger invoice.payment_failed webhook
3. Check logs for "Payment failure email sent" with email details
4. Trigger invoice.paid webhook after failure state
5. Check logs for "Payment recovered email sent" with wasInDebtorState

**For production:**
1. Set `EMAIL_PROVIDER=resend`
2. Ensure `RESEND_API_KEY` is configured
3. Verify domain is verified in Resend dashboard
