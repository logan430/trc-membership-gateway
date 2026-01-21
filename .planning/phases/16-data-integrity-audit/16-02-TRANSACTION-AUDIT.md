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

