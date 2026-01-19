---
phase: 06-billing-failure
verified: 2026-01-19T16:30:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 6: Billing Failure Verification Report

**Phase Goal:** Payment failures restrict access gracefully; recovery restores access
**Verified:** 2026-01-19T16:30:00Z
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | System detects payment failure via webhook | VERIFIED | src/webhooks/stripe.ts line 356-359: invoice.payment_failed case calls handlePaymentFailure(invoice) |
| 2 | Affected users are moved to Debtor role after 48-hour grace period | VERIFIED | src/billing/scheduler.ts lines 51-67 queries for gracePeriodEndsAt <= now AND isInDebtorState = false, calls moveToDebtorState. src/billing/debtor-state.ts lines 68-71 removes managed roles and adds Debtor |
| 3 | Debtor users can only access #billing-support channel | VERIFIED | src/bot/channels.ts lines 63-87 creates channel with permission overwrites: @everyone Deny ViewChannel, Debtor Allow ViewChannel+ReadMessageHistory but Deny SendMessages |
| 4 | System detects payment recovery via webhook | VERIFIED | src/webhooks/stripe.ts lines 362-365: invoice.paid case calls handlePaymentRecovery(invoice) |
| 5 | On recovery, user is restored to previous role (Knight or Lord) | VERIFIED | src/billing/recovery-handler.ts lines 18-38 restoreFromDebtorState() reads previousRole from DB, removes Debtor role, adds previous role. src/billing/debtor-state.ts lines 52-54 captures previous role BEFORE any changes |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| prisma/schema.prisma | Billing failure tracking fields | VERIFIED | Lines 76-81: paymentFailedAt, gracePeriodEndsAt, debtorStateEndsAt, previousRole, isInDebtorState, sentBillingNotifications on Member; Lines 109-111 same on Team |
| src/billing/failure-handler.ts | Payment failure detection | VERIFIED | 151 lines, exports handlePaymentFailure, handleTeamPaymentFailure. Checks billing_reason === subscription_cycle, starts grace period (48h), sends DM |
| src/billing/recovery-handler.ts | Payment recovery handling | VERIFIED | 253 lines, exports handlePaymentRecovery, handleTeamPaymentRecovery. Restores role from Debtor state, clears all failure fields |
| src/billing/debtor-state.ts | Debtor state transitions | VERIFIED | 265 lines, exports moveToDebtorState, moveTeamToDebtorState, kickAfterDebtorExpiry, kickTeamAfterDebtorExpiry |
| src/billing/scheduler.ts | Polling scheduler | VERIFIED | 244 lines, exports startBillingScheduler. 5-minute interval, processes grace period expirations, debtor expirations, notification cadence |
| src/billing/notifications.ts | DM notifications | VERIFIED | 311 lines, exports 10 notification functions covering full lifecycle |
| src/bot/channels.ts | Channel management | VERIFIED | 102 lines, exports ensureBillingSupportChannel. Creates channel with Debtor-only access |
| public/team-dashboard.html | Billing banner | VERIFIED | Contains billing-banner div with JS to show when paymentFailedAt exists or status is PAST_DUE |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| src/webhooks/stripe.ts | src/billing/failure-handler.ts | import + call | WIRED | Line 7 imports, line 358 calls handlePaymentFailure |
| src/webhooks/stripe.ts | src/billing/recovery-handler.ts | import + call | WIRED | Line 8 imports, line 364 calls handlePaymentRecovery |
| src/billing/scheduler.ts | src/billing/debtor-state.ts | import + call | WIRED | Lines 4-7 import, lines 62, 80, 98, 115 call state transition functions |
| src/index.ts | src/billing/scheduler.ts | import + call | WIRED | Line 19 imports, line 93 calls startBillingScheduler() |
| src/bot/client.ts | src/bot/channels.ts | import + call | WIRED | Line 6 imports, line 38 calls ensureBillingSupportChannel(guild) |
| src/billing/failure-handler.ts | src/billing/notifications.ts | import + call | WIRED | Line 4 imports, line 80 calls sendPaymentFailedDm |
| src/billing/debtor-state.ts | src/bot/roles.ts | import + call | WIRED | Line 3 imports, lines 68+71 call removeAllManagedRoles and addRoleToMember |
| src/billing/recovery-handler.ts | src/bot/roles.ts | import + call | WIRED | Line 4 imports, lines 27+30 call role functions |
| src/routes/team-dashboard.ts | API response | includes billing fields | WIRED | Line 97 returns paymentFailedAt in response |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| BILL-01: Payment failure detection | SATISFIED | handlePaymentFailure in webhook handler |
| BILL-02: Grace period (48h) | SATISFIED | GRACE_PERIOD_MS = 48 * 60 * 60 * 1000 in failure-handler |
| BILL-03: Debtor state transition | SATISFIED | moveToDebtorState called when grace period expires |
| BILL-04: Restricted access (#billing-support only) | SATISFIED | Channel permissions hide from @everyone, allow Debtor view-only |
| BILL-05: 30-day Debtor limit with kick | SATISFIED | kickAfterDebtorExpiry called when debtorStateEndsAt expires |
| ROLE-04: Previous role storage | SATISFIED | previousRole captured BEFORE role swap in moveToDebtorState |
| ROLE-05: Role restoration on recovery | SATISFIED | restoreFromDebtorState reads and applies previousRole |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | - | - | - | No TODO/FIXME/placeholder patterns detected in billing module |

### Human Verification Required

#### 1. End-to-End Billing Failure Flow

**Test:** Simulate invoice.payment_failed webhook via Stripe CLI or test mode
**Expected:** Grace period starts, immediate DM sent, status changes to PAST_DUE
**Why human:** Requires actual Stripe webhook delivery and Discord bot running

#### 2. Grace Period to Debtor Transition

**Test:** Manually adjust gracePeriodEndsAt in database to past, wait for scheduler poll
**Expected:** User roles change from Knight/Lord to Debtor, DM sent
**Why human:** Requires live Discord bot to verify role assignment

#### 3. Debtor Channel Access

**Test:** As user with Debtor role, verify can see #billing-support, cannot see other channels, cannot send messages
**Expected:** Channel visible in read-only, other channels hidden
**Why human:** Requires visual Discord verification

#### 4. Payment Recovery Flow

**Test:** Simulate invoice.paid webhook after user in Debtor state
**Expected:** Debtor role removed, previous role restored, celebratory DM sent
**Why human:** Requires Stripe webhook and Discord bot

#### 5. Dashboard Billing Banner

**Test:** For team with paymentFailedAt set, view team dashboard
**Expected:** Red billing banner visible at top of dashboard
**Why human:** Visual verification required

### Gaps Summary

No gaps found. All required artifacts exist, are substantive (not stubs), and are properly wired together.

**Phase 6 deliverables verified:**
- Schema has billing failure tracking fields (Member and Team models)
- Webhook handlers process invoice.payment_failed and invoice.paid
- Grace period (48h) tracked and enforced by scheduler
- Debtor role assigned after grace period, with channel-restricted access
- Previous role captured before swap and restored on recovery
- 30-day Debtor limit with kick enforcement
- Full notification cadence implemented (immediate, 24h, debtor, reminders, final warnings)
- Team dashboard shows billing status banner
- Scheduler runs on 5-minute polling interval

---

*Verified: 2026-01-19T16:30:00Z*
*Verifier: Claude (gsd-verifier)*
