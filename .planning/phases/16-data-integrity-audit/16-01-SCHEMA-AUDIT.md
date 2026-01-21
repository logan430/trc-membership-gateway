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

---

## Foreign Key Relationships Audit

All foreign key relationships and their cascade behavior verified.

### Prisma 7 Default Behavior

Per [Prisma Referential Actions documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions):
- **Optional relations:** Default `onDelete: SetNull`
- **Required relations:** Default `onDelete: Restrict`

No explicit `onDelete` or `onUpdate` is defined in the schema, so Prisma defaults apply.

### Foreign Key Relationships

| Relation | Field | Required | Expected onDelete | Actual | Status |
|----------|-------|----------|-------------------|--------|--------|
| Member -> Team | teamId | Optional | SetNull | SetNull (default) | VERIFIED |
| PendingInvite -> Team | teamId | Required | Restrict | Restrict (default) | VERIFIED |

### Relationship Details

**Member -> Team (teamId, Optional)**
```prisma
team    Team?   @relation(fields: [teamId], references: [id])
teamId  String?
```
- **Expected behavior:** When Team is deleted, Member.teamId is set to NULL
- **Why this is correct:** Members should not be deleted when their team is deleted; they should be unlinked
- **Use case:** If company cancels subscription, members remain as individual records (can be invited elsewhere)
- **Status:** VERIFIED - SetNull is the appropriate behavior

**PendingInvite -> Team (teamId, Required)**
```prisma
team    Team    @relation(fields: [teamId], references: [id])
teamId  String
```
- **Expected behavior:** Team deletion is blocked if PendingInvite records exist
- **Why this is correct:** Cannot delete a team that has pending invites outstanding
- **Use case:** Admin must clean up pending invites before team deletion is possible
- **Status:** VERIFIED - Restrict is the appropriate behavior

---

## Cascade Delete Analysis

### Scenario Analysis

| Scenario | Expected Behavior | Verification |
|----------|-------------------|--------------|
| Delete Team with members | Member.teamId set to NULL; Member records preserved | SetNull (default) |
| Delete Team with pending invites | Deletion blocked with foreign key error | Restrict (default) |
| Delete Member with no team | Clean deletion, no cascades needed | No foreign keys reference Member |
| Delete Member with team | Clean deletion; Team.members array updated | Member is child, not parent |

### Detailed Scenarios

**1. Team with members is deleted**
- Member.teamId is set to NULL (SetNull)
- Member records are preserved
- Members lose team association but keep all other data
- **Assessment:** CORRECT - Members should not be deleted with team

**2. Team with pending invites exists**
- Delete is blocked (Restrict)
- Foreign key error prevents team deletion
- Admin must delete/expire invites first
- **Assessment:** CORRECT - Prevents orphaned invite records

**3. Member with no team is deleted**
- Clean deletion, no cascade effects
- No other models reference Member by foreign key
- **Assessment:** CORRECT - Simple cleanup

**4. Member with team is deleted**
- Member record deleted
- Team.members relation updated automatically (Prisma manages array)
- **Assessment:** CORRECT - Team remains intact

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Orphaned PendingInvite records | None | N/A | Restrict prevents this |
| Team deletion leaving orphaned members | None | N/A | SetNull preserves members |
| Accidental Team deletion | Low | Medium | Application layer controls who can delete teams |
| Cascade delete removing wanted data | None | N/A | No Cascade configured |

### Current Behavior Assessment

**Is current behavior acceptable?** YES

The implicit Prisma defaults align with application requirements:
1. SetNull for Member.teamId - Preserves member data when team is removed
2. Restrict for PendingInvite.teamId - Prevents orphaned invites

**Risks identified:** None critical

The lack of explicit `onDelete` annotations makes the schema less self-documenting, but behavior is correct.

**Recommendations (for future consideration):**
1. Consider adding explicit `onDelete: SetNull` and `onDelete: Restrict` to make schema self-documenting
2. This is a documentation improvement, not a correctness issue
