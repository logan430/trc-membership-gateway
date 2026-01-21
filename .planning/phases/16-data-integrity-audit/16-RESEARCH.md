# Phase 16: Data Integrity Audit - Research

**Researched:** 2026-01-20
**Domain:** Prisma data constraints, transaction safety, webhook idempotency, Stripe synchronization
**Confidence:** HIGH

## Summary

This audit phase verifies data integrity mechanisms across the membership system: Prisma schema constraints, cascade delete behavior, transaction atomicity, webhook idempotency, and Stripe source-of-truth alignment. The codebase already implements many best practices but requires systematic verification.

The codebase uses two `$transaction` implementations (seat claims, team payment failure), a StripeEvent-based idempotency mechanism, and implicit Prisma defaults for referential integrity. The audit will verify these work correctly and identify any gaps.

**Primary recommendation:** Systematic schema review + edge case verification queries, not data exploration. Trust constraints to prevent orphans; verify constraints are correctly defined.

## Standard Stack

The established patterns for data integrity auditing:

### Core Technologies Already in Use
| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Prisma | 7.x | ORM with schema constraints | In use |
| PostgreSQL | Via Supabase | ACID-compliant database | In use |
| Stripe | SDK v20+ | Payment source of truth | In use |
| StripeEvent model | N/A | Idempotency tracking | Implemented |

### Audit-Specific Verification Patterns
| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| Schema introspection | Verify constraints match intent | Constraint audit |
| Edge case queries | Test constraint enforcement | Unique constraint verification |
| Transaction tracing | Follow code paths through transactions | Transaction boundary audit |
| Event flow analysis | Verify idempotency chain | Webhook idempotency audit |

## Architecture Patterns

### Current Schema Constraint Analysis

Based on `prisma/schema.prisma`, here are the constraint findings to verify:

#### Unique Constraints
| Model | Field | Constraint | Verification Need |
|-------|-------|------------|-------------------|
| Member | discordId | @unique (optional) | Verify duplicate Discord linking blocked |
| Member | stripeCustomerId | @unique (optional) | Verify duplicate Stripe customers blocked |
| Member | email | @unique (optional) | Verify duplicate emails blocked |
| Team | stripeCustomerId | @unique (required) | Verify enforcement |
| Team | stripeSubscriptionId | @unique (optional) | Verify enforcement |
| StripeEvent | eventId | @unique (required) | Critical for idempotency |
| PendingInvite | token | @unique (required) | Verify token collision impossible |
| Admin | email | @unique (required) | Verify admin email uniqueness |
| FeatureFlag | key | @unique (required) | Verify flag key uniqueness |
| EmailTemplate | name | @unique (required) | Verify template name uniqueness |

#### Foreign Key Relations (Default Behavior)
| Relation | Field | Default onDelete | Implication |
|----------|-------|------------------|-------------|
| Member -> Team | teamId (optional) | SetNull | Deleting Team sets Member.teamId to NULL |
| PendingInvite -> Team | teamId (required) | Restrict | Cannot delete Team with pending invites |

**Key Finding:** No explicit `onDelete: Cascade` is defined. Prisma defaults apply:
- Optional relations: `onDelete: SetNull` (Member.teamId is optional)
- Required relations: `onDelete: Restrict` (PendingInvite.teamId is required)

Per Prisma documentation: "If you do not specify a referential action, Prisma ORM uses the following defaults" - SetNull for optional, Restrict for required.

### Transaction Usage Analysis

The codebase uses `$transaction` in two places:

#### 1. Seat Claim Transaction (team-claim.ts:194)
```typescript
const result = await prisma.$transaction(async (tx) => {
  // Re-fetch team with member count (prevents race condition)
  const teamMembers = await tx.member.findMany({...});
  const team = await tx.team.findUnique({...});

  // Check seat availability inside transaction
  if (teamMembers.length >= maxSeats) {
    throw new Error('NO_SEATS_AVAILABLE');
  }

  // Create or update member atomically
  const member = await tx.member.upsert({...});

  // Mark invite as used
  await tx.pendingInvite.update({...});

  return member;
});
```
**Assessment:** Correct read-modify-write pattern. Prevents race condition for seat claiming.

#### 2. Team Payment Failure Transaction (failure-handler.ts:142)
```typescript
await prisma.$transaction(async (tx) => {
  // Update team billing state
  await tx.team.update({...});

  // Update all team members
  for (const member of team.members) {
    await tx.member.update({...});
  }
});
```
**Assessment:** Correct batch update pattern. Ensures team and members update atomically.

### Webhook Idempotency Pattern

Located in `src/webhooks/stripe.ts`:

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

**Assessment:** Implements "record before process" pattern correctly. The StripeEvent.eventId @unique constraint ensures database-level deduplication.

### Stripe Source of Truth Pattern

The codebase follows "Stripe as source of truth" correctly:

1. **Seat counts:** Webhook syncs `ownerSeatCount`/`teamSeatCount` from Stripe subscription items
2. **Subscription status:** `mapStripeStatus()` converts Stripe status to database enum
3. **Period end:** Fetched from subscription items, not calculated
4. **Add seats operation:** Updates Stripe first, then relies on webhook for DB sync

Comment in team-dashboard.ts:264:
```typescript
// Note: Database update happens via webhook (customer.subscription.updated)
// This ensures Stripe is source of truth
```

## Don't Hand-Roll

Problems already solved - verify implementations, don't rebuild:

| Problem | Existing Solution | Verify |
|---------|------------------|--------|
| Webhook deduplication | StripeEvent table with @unique eventId | Constraint enforced |
| Race condition in seat claims | $transaction with re-fetch | Transaction isolation correct |
| Atomic team state updates | $transaction for team + members | All updates in transaction |
| Subscription status sync | mapStripeStatus helper | Mapping covers all Stripe statuses |

## Common Pitfalls

### Pitfall 1: Missing Cascade Configuration
**What goes wrong:** Team deletion behavior is implicit (Prisma defaults)
**Why it happens:** No explicit `onDelete` in schema relies on defaults
**How to verify:**
- Confirm Team deletion with Members works as expected (SetNull)
- Confirm Team deletion with PendingInvites is blocked (Restrict)
**Warning signs:** Unexpected foreign key errors or orphaned records

### Pitfall 2: Transaction Boundary Too Narrow
**What goes wrong:** Related operations outside transaction can fail independently
**Why it happens:** Transactions have performance cost, so developers minimize scope
**How to verify:** Trace code paths to ensure all dependent writes are inside transaction
**Warning signs:** Partial state updates when Discord API fails mid-operation

### Pitfall 3: Idempotency Race Window
**What goes wrong:** Two concurrent webhook deliveries can both pass the check
**Why it happens:** Check-then-create without transaction or unique constraint
**How to verify:** The @unique constraint on eventId handles this at DB level
**Warning signs:** Duplicate events in StripeEvent table (should be impossible)

### Pitfall 4: Stripe/DB State Divergence
**What goes wrong:** Database has different subscription state than Stripe
**Why it happens:** Webhook failures, missed events, manual Stripe changes
**How to verify:** Reconciliation system compares Stripe vs DB vs Discord
**Warning signs:** Drift issues in ReconciliationRun records

### Pitfall 5: Partial Failure - DB + Discord
**What goes wrong:** Database updates but Discord operation fails
**Why it happens:** Discord is external service, can timeout/fail
**Expected behavior:** Per CONTEXT.md, fire-and-forget Discord pattern is intentional. Document but don't flag as issue.
**Warning signs:** Reconciliation detecting role mismatches

## Code Examples

Verified patterns from the codebase:

### Idempotency Check Pattern
```typescript
// Source: src/webhooks/stripe.ts:65-72
const existingEvent = await prisma.stripeEvent.findUnique({
  where: { eventId: event.id },
});

if (existingEvent) {
  logger.info({ eventId: event.id, type: event.type }, 'Duplicate event ignored');
  return res.status(200).json({ received: true, duplicate: true });
}
```

### Atomic Read-Modify-Write Pattern
```typescript
// Source: src/routes/team-claim.ts:194-246
const result = await prisma.$transaction(async (tx) => {
  // Re-fetch inside transaction for consistency
  const teamMembers = await tx.member.findMany({
    where: { teamId: invite.teamId, seatTier: invite.seatTier },
  });

  // Check constraint
  if (teamMembers.length >= maxSeats) {
    throw new Error('NO_SEATS_AVAILABLE');
  }

  // Atomic upsert
  const member = await tx.member.upsert({...});
  return member;
});
```

### Stripe Status Mapping
```typescript
// Source: src/webhooks/stripe.ts:17-32
function mapStripeStatus(stripeStatus: string): 'NONE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' {
  switch (stripeStatus) {
    case 'active': return 'ACTIVE';
    case 'trialing': return 'TRIALING';
    case 'past_due': return 'PAST_DUE';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'CANCELLED';
    default: return 'NONE';
  }
}
```

## State of the Art

| Aspect | Current Implementation | Standard Practice | Assessment |
|--------|----------------------|-------------------|------------|
| Idempotency | StripeEvent table + @unique | Record-before-process | CORRECT |
| Transactions | Interactive $transaction | Prisma best practice | CORRECT |
| Cascade deletes | Prisma defaults | Explicit is better | VERIFY |
| Stripe sync | Webhook-driven | Industry standard | CORRECT |
| Reconciliation | Three-way comparison | Best practice | IMPLEMENTED |

## Verification Approach

### 1. Constraint Verification (Schema Review)
- Review all @unique constraints are present where needed
- Confirm foreign key relations have appropriate behavior
- Verify no missing constraints for data integrity

### 2. Cascade Delete Verification (Code Tracing)
- Trace what happens when Team is deleted
- Confirm PendingInvite.teamId Restrict behavior
- Confirm Member.teamId SetNull behavior

### 3. Transaction Boundary Verification
- Confirm seat claim transaction is atomic
- Confirm team payment failure transaction is atomic
- Document fire-and-forget Discord operations (expected per CONTEXT.md)

### 4. Idempotency Verification
- Verify StripeEvent.eventId constraint enforced
- Verify record-before-process pattern in stripe.ts
- Trace all webhook handlers for idempotent behavior

### 5. Stripe Source of Truth Verification
- Verify data flows FROM Stripe TO database (never reverse)
- Verify schema fields match Stripe data types
- Confirm webhook handlers update correct fields

## Open Questions

Things that may need clarification during audit:

1. **Scheduled job idempotency**
   - What we know: Billing scheduler polls every 5 minutes
   - What's unclear: Are notification sends idempotent if scheduler restarts mid-cycle?
   - Recommendation: Verify sentBillingNotifications tracking prevents duplicate sends

2. **Discord event idempotency**
   - What we know: Introduction handler processes message events
   - What's unclear: If Discord retries message events, is processing idempotent?
   - Recommendation: Verify introCompleted flag prevents duplicate promotions

3. **Team deletion edge case**
   - What we know: Default behavior is SetNull for Member.teamId
   - What's unclear: Is Team deletion ever intentionally triggered?
   - Recommendation: Document expected Team lifecycle

## Sources

### Primary (HIGH confidence)
- [Prisma Referential Actions](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions) - Default behavior, cascade configuration
- [Prisma Transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) - Interactive transaction patterns
- Codebase analysis: prisma/schema.prisma, src/webhooks/stripe.ts, src/routes/team-claim.ts

### Secondary (MEDIUM confidence)
- [Stripe Webhooks Guide](https://www.magicbell.com/blog/stripe-webhooks-guide) - Idempotency patterns
- [Hookdeck Deduplication Guide](https://hookdeck.com/docs/guides/deduplication-guide) - Event deduplication best practices

### Tertiary (LOW confidence)
- WebSearch results for general patterns (verified against official docs)

## Metadata

**Confidence breakdown:**
- Schema constraints: HIGH - Direct schema analysis
- Transaction boundaries: HIGH - Direct code analysis
- Idempotency: HIGH - Code implements documented pattern
- Stripe sync: HIGH - Clear source-of-truth pattern in code

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (30 days - stable patterns)

---

## Audit Checklist Preview

Based on research, the audit should verify:

- [ ] Prisma schema unique constraints are correctly placed
- [ ] Foreign key default behavior (SetNull/Restrict) is acceptable
- [ ] Seat claim transaction prevents race conditions
- [ ] Team payment failure transaction updates atomically
- [ ] StripeEvent idempotency prevents duplicate processing
- [ ] Webhook handlers are idempotent (check each event type)
- [ ] Stripe is source of truth (DB only mirrors, never leads)
- [ ] Scheduled jobs have idempotent notification tracking
- [ ] Discord events handled idempotently (introCompleted flag)
- [ ] Reconciliation system can detect/fix drift
