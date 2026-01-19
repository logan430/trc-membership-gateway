---
phase: 07-email-notifications
plan: 02
subsystem: email-templates
tags: [email, templates, welcome, claim-reminder, scheduler]
dependency-graph:
  requires: [07-01]
  provides: [welcome-email, claim-reminder-email, scheduler-integration]
  affects: [07-03]
tech-stack:
  added: []
  patterns: [template-functions, fire-and-forget, polling-scheduler]
key-files:
  created:
    - src/email/templates.ts
  modified:
    - src/email/send.ts
    - src/webhooks/stripe.ts
    - src/billing/scheduler.ts
decisions:
  - key: cheeky-tone-threshold
    choice: "30+ days triggers cheeky/grateful tone in claim reminders"
    rationale: "Per CONTEXT.md - express gratitude and desire to have them participate"
  - key: claim-reminder-schedule
    choice: "48h, 7d, 30d, then monthly for 6 months (60d-180d)"
    rationale: "Per CONTEXT.md and RESEARCH.md - reasonable cadence without being annoying"
  - key: fire-and-forget-emails
    choice: "Use .catch() pattern, don't await welcome emails"
    rationale: "Email delivery shouldn't block webhook response or checkout flow"
  - key: race-condition-check
    choice: "Re-check discordId before sending claim reminder"
    rationale: "Prevents sending reminder to member who just claimed between query and send"
metrics:
  duration: 4 min
  completed: 2026-01-19
---

# Phase 7 Plan 02: Email Templates Summary

Welcome and claim reminder email templates with checkout webhook and scheduler integration.

## What Was Built

### Email Templates

`src/email/templates.ts` with medieval-themed plain text templates:

**welcomeEmailTemplate(claimUrl)**
- Subject: "Welcome to The Revenue Council"
- Medieval greeting confirming payment received
- Clear CTA with claim URL to connect Discord
- Signed by "The Gatekeeper"

**claimReminderEmailTemplate(claimUrl, daysSincePurchase)**
- Subject varies by timing:
  - <= 7d: "Thy Discord access awaits"
  - >= 30d: "We miss thee at The Revenue Council"
- Cheeky tone at 30+ days expressing gratitude and desire to have them
- Standard gentle nudge for earlier reminders

Additional templates (added by linter for Plan 03):
- paymentFailureEmailTemplate
- paymentRecoveredEmailTemplate
- seatInviteEmailTemplate

### Send Functions

Extended `src/email/send.ts`:
- `sendWelcomeEmail(email, claimUrl)` - uses welcomeEmailTemplate
- `sendClaimReminderEmail(email, claimUrl, daysSincePurchase)` - uses claimReminderEmailTemplate

Both log success/failure via pino logger.

### Checkout Webhook Integration

Modified `src/webhooks/stripe.ts` checkout.session.completed handler:

**Individual checkout:**
```typescript
const member = await prisma.member.findUnique({ where: { id: memberId } });
if (member?.email) {
  const claimUrl = `${env.APP_URL}/claim`;
  sendWelcomeEmail(member.email, claimUrl).catch(err => {
    logger.error({ memberId, err }, 'Failed to send welcome email');
  });
}
```

**Company checkout:**
```typescript
const purchaser = await prisma.member.findUnique({ where: { id: memberId } });
if (purchaser?.email) {
  const claimUrl = `${env.APP_URL}/claim`;
  sendWelcomeEmail(purchaser.email, claimUrl).catch(err => {
    logger.error({ memberId, err }, 'Failed to send company welcome email');
  });
}
```

Fire-and-forget pattern ensures emails don't block webhook processing.

### Claim Reminder Scheduler

Extended `src/billing/scheduler.ts`:

**CLAIM_REMINDER_SCHEDULE constant:**
```typescript
const CLAIM_REMINDER_SCHEDULE = [
  { offsetHours: 48, key: 'claim_48h' },
  { offsetHours: 7 * 24, key: 'claim_7d' },
  { offsetHours: 30 * 24, key: 'claim_30d' },
  { offsetHours: 60 * 24, key: 'claim_60d' },
  { offsetHours: 90 * 24, key: 'claim_90d' },
  { offsetHours: 120 * 24, key: 'claim_120d' },
  { offsetHours: 150 * 24, key: 'claim_150d' },
  { offsetHours: 180 * 24, key: 'claim_180d' },
] as const;
```

**processClaimReminders() function:**
- Queries members with: subscriptionStatus='ACTIVE', email not null, discordId IS null
- Calculates elapsed hours since createdAt
- Checks each reminder in schedule
- Re-checks discordId before sending (race condition prevention)
- Marks sent by pushing key to sentBillingNotifications
- Returns count for logging

Integrated into processBillingPoll() as step 6.

## Task Execution

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create email templates | e9ce2f9 | templates.ts |
| 2 | Add send functions and wire welcome email | 876635d | send.ts, templates.ts, stripe.ts |
| 3 | Extend scheduler with claim reminders | 9816dfc | scheduler.ts |

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Cheeky tone threshold | 30+ days | Per CONTEXT.md - gratitude and desire |
| Reminder schedule | 48h, 7d, 30d, monthly x6 | Reasonable cadence without spam |
| Fire-and-forget | .catch() pattern | Don't block checkout/webhook flow |
| Race condition check | Re-check discordId | Prevent reminder to just-claimed member |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Additional templates added**

- **Found during:** Task 2
- **Issue:** Linter/autocomplete added paymentFailure, paymentRecovered, seatInvite templates to templates.ts and send.ts
- **Fix:** Kept the additions as they're needed for Plan 03
- **Files modified:** src/email/templates.ts, src/email/send.ts
- **Impact:** Plan 03 will have less work to do

## Next Phase Readiness

**Prerequisites for Plan 03 (Email Sending Integration):**
- Email templates ready (welcome, claim reminder, plus billing templates)
- Send functions implemented
- Welcome email wired to checkout
- Claim reminder scheduler integrated

**Testing with EMAIL_PROVIDER=console:**
1. Trigger checkout webhook to see welcome email logged
2. Create member with ACTIVE status, no discordId, createdAt > 48h ago
3. Run scheduler to see claim_48h reminder logged

**User Setup for Production:**
- Set EMAIL_PROVIDER=resend
- Set RESEND_API_KEY with valid key
- Verify sending domain at resend.com
