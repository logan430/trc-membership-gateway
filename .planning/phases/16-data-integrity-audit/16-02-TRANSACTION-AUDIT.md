# Transaction and Idempotency Verification Audit

**Audit Date:** 2026-01-21
**Auditor:** Claude Opus 4.5
**Scope:** Transaction boundaries, webhook idempotency, Stripe source-of-truth patterns

---

## Transaction Boundary Audit

### Transaction 1: Seat Claim (src/routes/team-claim.ts:194-246)

**Location:** `src/routes/team-claim.ts` lines 194-246

**Pattern:** Interactive transaction with read-modify-write

**Purpose:** Atomic seat claiming to prevent race conditions when multiple users attempt to claim team seats simultaneously.

**Operations inside transaction:**

1. **Re-fetch team members** (READ for consistency)
   ```typescript
   const teamMembers = await tx.member.findMany({
     where: { teamId: invite.teamId, seatTier: invite.seatTier },
   });
   ```

2. **Re-fetch team** (READ for current seat counts)
   ```typescript
   const team = await tx.team.findUnique({
     where: { id: invite.teamId },
   });
   ```

3. **Check seat availability** (VALIDATE)
   ```typescript
   const maxSeats = invite.seatTier === 'OWNER'
     ? team.ownerSeatCount
     : team.teamSeatCount;
   if (teamMembers.length >= maxSeats) {
     throw new Error('NO_SEATS_AVAILABLE');
   }
   ```

4. **Upsert member** (WRITE)
   ```typescript
   const member = await tx.member.upsert({
     where: { discordId: discordUser.id },
     create: { /* member data */ },
     update: { /* member data */ },
   });
   ```

5. **Mark invite as used** (WRITE)
   ```typescript
   await tx.pendingInvite.update({
     where: { id: invite.id },
     data: {
       acceptedAt: new Date(),
       acceptedBy: member.id,
     },
   });
   ```

**Assessment:** CORRECT

**Notes:**
- Transaction correctly uses interactive pattern with `tx` client for all operations
- Re-fetching inside transaction ensures consistent reads (prevents TOCTOU race condition)
- If two users submit claim simultaneously, only one succeeds - the other gets `NO_SEATS_AVAILABLE`
- Upsert handles edge case where member record may already exist (prevents duplicate creation)
- Invite marking is inside transaction, ensuring atomicity with member creation

---

### Transaction 2: Team Payment Failure (src/billing/failure-handler.ts:142-165)

**Location:** `src/billing/failure-handler.ts` lines 142-165

**Pattern:** Batch update transaction

**Purpose:** Atomic update of team and all team members when payment fails, ensuring consistent billing failure state across all entities.

**Operations inside transaction:**

1. **Update team billing state** (WRITE)
   ```typescript
   await tx.team.update({
     where: { id: team.id },
     data: {
       paymentFailedAt: now,
       gracePeriodEndsAt,
       subscriptionStatus: 'PAST_DUE',
     },
   });
   ```

2. **Update all team members** (WRITE batch)
   ```typescript
   for (const member of team.members) {
     await tx.member.update({
       where: { id: member.id },
       data: {
         paymentFailedAt: now,
         gracePeriodEndsAt,
         subscriptionStatus: 'PAST_DUE',
         sentBillingNotifications: { push: 'immediate' },
       },
     });
   }
   ```

**Assessment:** CORRECT

**Notes:**
- Transaction ensures team and all members are updated atomically
- If any member update fails, entire transaction rolls back - prevents inconsistent state
- All members enter grace period simultaneously (correct per business requirement)
- Notification DMs are sent OUTSIDE transaction (after commit) - this is correct pattern
- Fire-and-forget for Discord/email operations intentionally excluded from transaction

---

### Fire-and-Forget Discord Pattern

Per CONTEXT.md, fire-and-forget Discord operations are intentional design decisions. These are documented but NOT flagged as issues.

**Instances:**

1. **Seat Claim Role Assignment** (team-claim.ts:249)
   ```typescript
   assignRoleAsync(discordUser.id, ROLE_CONFIG.SQUIRE.name);
   ```
   - Called AFTER transaction commits
   - Fire-and-forget with retry via p-retry

2. **Subscription Deleted Role Removal** (stripe.ts:313, 366)
   ```typescript
   removeAndKickAsync(member.discordId, member.id);
   ```
   - Called AFTER database updates
   - Fire-and-forget with retry

3. **Introduction Promotion** (introduction.ts:176)
   ```typescript
   swapRoleAsync(guildMember.id, ROLE_CONFIG.SQUIRE.name, targetRole);
   ```
   - Called AFTER introduction validation
   - Database update happens separately

**Why acceptable:**
- Reconciliation system (Phase 8) detects and fixes role drift
- Discord operations can fail independently without corrupting data
- Business priority: Database consistency over Discord consistency
- Recovery path exists: Scheduled reconciliation or manual admin fix

---

### Transaction Coverage Assessment

| Operation | Has Transaction | Assessment |
|-----------|-----------------|------------|
| Seat claim (race condition) | YES | CORRECT |
| Team payment failure | YES | CORRECT |
| Individual payment failure | NO | ACCEPTABLE (single entity) |
| Payment recovery | NO | ACCEPTABLE (idempotent updates) |
| Checkout webhook | NO | ACCEPTABLE (single entity per handler) |

**Summary:** Both critical multi-entity operations are properly wrapped in transactions.

---

## Webhook Idempotency Audit

### Stripe Webhook Handler (src/webhooks/stripe.ts)

**Location:** `src/webhooks/stripe.ts` lines 64-81

**Idempotency Pattern Implementation:**

```typescript
// Step 2: Check idempotency - has this event been processed?
const existingEvent = await prisma.stripeEvent.findUnique({
  where: { eventId: event.id },
});

if (existingEvent) {
  logger.info({ eventId: event.id, type: event.type }, 'Duplicate event ignored');
  return res.status(200).json({ received: true, duplicate: true });
}

// Step 3: Record event BEFORE processing (prevents race conditions)
await prisma.stripeEvent.create({
  data: {
    eventId: event.id,
    type: event.type,
    payload: event as unknown as Prisma.JsonObject,
  },
});
```

**Verification Table:**

| Step | Implementation | Status |
|------|----------------|--------|
| Duplicate check | `findUnique` on `eventId` | VERIFIED |
| Early return | Return 200 on duplicate | VERIFIED |
| Record first | Create before process | VERIFIED |
| DB constraint | `@unique` on `eventId` in schema | VERIFIED |

**Assessment:** CORRECT

**Race Condition Protection:**

The `@unique` constraint on `StripeEvent.eventId` (schema line 153) provides database-level deduplication:

1. **Scenario:** Two concurrent webhook deliveries of same event
2. **Both pass findUnique check:** Both see no existing record
3. **First create succeeds:** Event recorded
4. **Second create fails:** Unique constraint violation
5. **Result:** Second delivery gets database error, handler catches and logs

The pattern correctly handles race conditions because:
- Prisma surfaces unique constraint violations as errors
- Handler catches errors at line 92-95 and logs without failing
- Event is NOT processed twice even if duplicate check was passed

---

### Individual Event Handler Idempotency

Each webhook event type handler is analyzed for safe replay behavior:

| Event Type | Handler Behavior | Idempotent? | Notes |
|------------|------------------|-------------|-------|
| `checkout.session.completed` | Updates member/team to ACTIVE | Yes | Update to same status is no-op |
| `customer.subscription.created` | Logs only (handler TBD) | Yes | No state mutation |
| `customer.subscription.updated` | Syncs status/seats from Stripe | Yes | Overwrites with same Stripe data |
| `customer.subscription.deleted` | Sets CANCELLED, triggers kick | Yes | Status update idempotent, kick re-runs safely |
| `invoice.payment_failed` | Sets paymentFailedAt (if null) | Yes | Only sets if null, preventing reset |
| `invoice.paid` | Clears payment failure state | Yes | Clearing already-clear state is no-op |

**Detailed Analysis:**

**checkout.session.completed (lines 104-230):**
- Individual: Updates member `subscriptionStatus` to ACTIVE
- Company: Updates team and member to ACTIVE
- **Idempotent:** Updating to same status value is a no-op

**customer.subscription.updated (lines 237-297):**
- Syncs `subscriptionStatus`, `ownerSeatCount`, `teamSeatCount` from Stripe
- Uses `mapStripeStatus()` to convert Stripe status to enum
- **Idempotent:** Values come from Stripe, same event produces same update

**customer.subscription.deleted (lines 300-372):**
- Sets status to CANCELLED
- Calls `removeAndKickAsync()` for Discord kick
- **Idempotent:** Status update is idempotent; kick operation handles already-kicked gracefully

**invoice.payment_failed (lines 375-378):**
- Delegates to `handlePaymentFailure()`
- Handler checks `if (member.paymentFailedAt)` - only sets if null
- **Idempotent:** Won't reset grace period on retry failures

**invoice.paid (lines 381-384):**
- Delegates to `handlePaymentRecovery()`
- Handler checks `if (!member.paymentFailedAt)` - only processes if in failure state
- Clears all billing failure fields
- **Idempotent:** Clearing already-cleared state is no-op

---

### Discord Event Idempotency

**Introduction Handler (src/bot/events/introduction.ts)**

**Location:** Lines 74-109

**Idempotency Check:**

```typescript
// Lookup member by Discord ID
const member = await prisma.member.findUnique({
  where: { discordId: message.author.id },
});

// Not in our system or already introduced - ignore
if (!member || member.introCompleted) return;
```

**Verification:**
- `introCompleted` flag checked BEFORE any processing
- If already completed, handler returns immediately
- Database update sets `introCompleted: true` at promotion

**Assessment:** CORRECT

**Double-Processing Prevention:**
1. Message event received
2. Lookup member by Discord ID
3. Check `introCompleted === true` -> return early
4. Check has Squire role -> if not, return
5. Validate length
6. If valid: promote and set `introCompleted = true`

If Discord retries a message event:
- First delivery: `introCompleted = false` -> processes, sets to true
- Retry delivery: `introCompleted = true` -> returns early, no duplicate promotion

---

### Scheduled Job Notification Idempotency

**Billing Scheduler (src/billing/scheduler.ts)**

**Location:** Lines 149-213

**Idempotency Pattern:**

```typescript
// Check if already sent
if (!member.sentBillingNotifications.includes(notification.key)) {
  // Send notification...

  // Mark notification as sent
  await prisma.member.update({
    where: { id: member.id },
    data: {
      sentBillingNotifications: { push: notification.key },
    },
  });
}
```

**Verification:**
- `sentBillingNotifications` is a `String[]` field tracking sent notification keys
- Check performed BEFORE sending
- Key added AFTER send (or even if DM fails - prevents spam)

**Assessment:** CORRECT

**Scheduler Restart Safety:**
- If scheduler restarts mid-cycle, next poll re-evaluates all members
- Already-sent notifications have keys in array -> skipped
- Only unsent notifications at current time offset are sent

