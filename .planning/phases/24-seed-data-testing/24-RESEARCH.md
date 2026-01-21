# Phase 24: Seed Data Testing - Research

**Researched:** 2026-01-21
**Domain:** Prisma seeding, test data generation
**Confidence:** HIGH

## Summary

This phase creates comprehensive seed data for testing all application flows. The codebase already has a simple seed script (`prisma/seed.ts`) that creates a single admin account, and several utility scripts in `/scripts` that create individual test members. The existing patterns provide a solid foundation.

The research identified all database models, enums, and required fields. The seed script will need to create Members (individuals and team members), Teams, PendingInvites, and test Admin accounts. Per CONTEXT.md decisions, all test data uses `@test.example.com` domain for easy cleanup, follows wipe-and-recreate pattern, and leaves Stripe IDs null.

**Primary recommendation:** Replace the existing `prisma/seed.ts` with a comprehensive seed script that covers all subscription states, team configurations, and edge cases while preserving non-test admin accounts.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @prisma/client | 7.2.0 | Database operations | Already in use |
| @prisma/adapter-pg | 7.2.0 | PostgreSQL adapter | Required for Prisma 7 WASM |
| tsx | 4.21.0 | TypeScript execution | Already configured for seed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| argon2 | 0.44.0 | Password hashing | Test admin accounts |
| crypto (built-in) | n/a | Token generation | Invite tokens |

**No additional dependencies needed - everything required is already installed.**

## Architecture Patterns

### Existing Seed Command Configuration

The seed script is already configured in `package.json`:
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

And in `prisma.config.ts`:
```typescript
migrations: {
  seed: "npx tsx prisma/seed.ts",
}
```

To run: `npx prisma db seed`

### Recommended Seed Script Structure
```
prisma/seed.ts
├── Database connection (same pattern as existing)
├── Configuration constants
│   ├── TEST_EMAIL_DOMAIN = '@test.example.com'
│   ├── User counts per state
│   └── Team configurations
├── Cleanup function
│   └── Delete WHERE email LIKE '%@test.example.com'
├── Seed functions
│   ├── seedTestAdmins()
│   ├── seedIndividualMembers()
│   ├── seedTeamsWithMembers()
│   └── seedPendingInvites()
└── Main orchestrator
```

### Pattern 1: Prisma Connection (Existing Pattern)
**What:** Use PrismaPg adapter with pg.Pool
**When to use:** All database operations in seed script
**Example:**
```typescript
// Source: prisma/seed.ts (existing)
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

### Pattern 2: Cleanup Pattern (Delete Test Data)
**What:** Delete all records with @test.example.com email domain
**When to use:** Before seeding to ensure clean slate
**Example:**
```typescript
async function cleanupTestData() {
  // Delete in dependency order (invites reference teams, members reference teams)
  await prisma.pendingInvite.deleteMany({
    where: { inviteeEmail: { contains: '@test.example.com' } }
  });

  // Delete team members first (references team)
  await prisma.member.deleteMany({
    where: { email: { contains: '@test.example.com' } }
  });

  // Then delete teams (by stripeCustomerId pattern for test teams)
  await prisma.team.deleteMany({
    where: { stripeCustomerId: { startsWith: 'test_' } }
  });

  // Delete test admins but preserve real admins
  await prisma.admin.deleteMany({
    where: { email: { contains: '@test.example.com' } }
  });
}
```

### Pattern 3: Idempotent Seeding (Wipe and Recreate)
**What:** Delete all test data, then create fresh - no upsert logic needed
**When to use:** Per CONTEXT.md decision for simple, fast seeding
**Example:**
```typescript
async function main() {
  console.log('Cleaning up test data...');
  await cleanupTestData();

  console.log('Seeding test data...');
  await seedTestAdmins();
  await seedIndividualMembers();
  await seedTeamsWithMembers();

  console.log('Seed complete!');
}
```

### Anti-Patterns to Avoid
- **Upsert complexity:** Don't use upsert - wipe and recreate is simpler
- **Real Stripe IDs:** Never use real Stripe customer/subscription IDs in test data
- **Hardcoded non-test emails:** All test emails MUST use @test.example.com domain
- **Confirmation prompts:** This is a dev tool - no interactive prompts

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash | `hashPassword()` from src/lib/password.ts | OWASP-compliant argon2id |
| Token generation | Math.random | `generateInviteToken()` from src/lib/invite-tokens.ts | Cryptographically secure |
| UUID/CUID generation | Custom ID gen | Prisma `@default(cuid())` | Let Prisma handle IDs |

## Database Schema Reference

### Enums

```typescript
// SubscriptionStatus
enum SubscriptionStatus {
  NONE       // No active subscription
  TRIALING   // In trial period
  ACTIVE     // Active paid subscription
  PAST_DUE   // Payment failed, in grace period
  CANCELLED  // Subscription ended
}

// SeatTier
enum SeatTier {
  INDIVIDUAL    // Individual subscription (no team)
  OWNER         // Company owner seat
  TEAM_MEMBER   // Company team member seat
}

// AdminRole
enum AdminRole {
  ADMIN        // Member management only
  SUPER_ADMIN  // Full access
}
```

### Member Model (Required and Key Fields)

```typescript
model Member {
  // Auto-generated
  id: String                     // cuid() - auto

  // Discord (null for unclaimed)
  discordId: String?             // Set when claimed
  discordUsername: String?       // Set when claimed

  // Identity
  email: String?                 // Required for seed - unique
  passwordHash: String?          // Optional for test accounts

  // CRM fields (optional)
  firstName: String?
  lastName: String?
  company: String?
  jobTitle: String?

  // Subscription state
  subscriptionStatus: SubscriptionStatus  // Default NONE
  seatTier: SeatTier?                     // INDIVIDUAL | OWNER | TEAM_MEMBER
  currentPeriodEnd: DateTime?             // For active subscriptions

  // Onboarding
  introCompleted: Boolean                 // Default false
  introCompletedAt: DateTime?             // When intro completed

  // Team (for company seats)
  teamId: String?
  isTeamAdmin: Boolean                    // Default false
  isPrimaryOwner: Boolean                 // Default false

  // Billing failure tracking
  paymentFailedAt: DateTime?
  gracePeriodEndsAt: DateTime?
  debtorStateEndsAt: DateTime?
  previousRole: String?                   // 'Knight' or 'Lord'
  isInDebtorState: Boolean                // Default false
  sentBillingNotifications: String[]      // Default []

  // Timestamps
  createdAt: DateTime                     // auto
  updatedAt: DateTime                     // auto
}
```

### Team Model (Required Fields)

```typescript
model Team {
  // Auto-generated
  id: String                              // cuid() - auto

  // Required
  name: String                            // Team/company name
  stripeCustomerId: String                // UNIQUE - use 'test_team_xxx' pattern

  // Optional
  stripeSubscriptionId: String?           // null for test data
  subscriptionStatus: SubscriptionStatus  // Default NONE

  // Seat counts
  ownerSeatCount: Int                     // Default 0
  teamSeatCount: Int                      // Default 0

  // Billing failure (for testing)
  paymentFailedAt: DateTime?
  gracePeriodEndsAt: DateTime?
  debtorStateEndsAt: DateTime?

  // Timestamps
  createdAt: DateTime                     // auto
  updatedAt: DateTime                     // auto
}
```

### PendingInvite Model (Required Fields)

```typescript
model PendingInvite {
  // Auto-generated
  id: String                              // cuid() - auto

  // Required
  teamId: String                          // FK to Team
  seatTier: SeatTier                      // OWNER or TEAM_MEMBER
  token: String                           // UNIQUE - use generateInviteToken()
  createdBy: String                       // Member ID who created

  // Optional
  inviteeEmail: String?                   // Email to send invite
  acceptedAt: DateTime?                   // When claimed
  acceptedBy: String?                     // Member ID who accepted

  // Timestamps
  createdAt: DateTime                     // auto
}
```

### Admin Model (Required Fields)

```typescript
model Admin {
  // Auto-generated
  id: String                              // cuid() - auto

  // Required
  email: String                           // UNIQUE - use @test.example.com
  passwordHash: String                    // Use hashPassword()
  role: AdminRole                         // Default ADMIN

  // Optional
  lastLoginAt: DateTime?
  createdBy: String?                      // null for seed admin

  // Timestamps
  createdAt: DateTime                     // auto
  updatedAt: DateTime                     // auto
}
```

## Role Mapping Reference

Per STATE.md decisions:

| Subscription State | Intro Status | Discord Role | Notes |
|-------------------|--------------|--------------|-------|
| ACTIVE + INDIVIDUAL | Not introduced | Squire | Gray, limited access |
| ACTIVE + INDIVIDUAL | Introduced | Lord | Gold, full access |
| ACTIVE + OWNER | Not introduced | Squire | Gray, limited access |
| ACTIVE + OWNER | Introduced | Lord | Gold, owners-only access |
| ACTIVE + TEAM_MEMBER | Not introduced | Squire | Gray, limited access |
| ACTIVE + TEAM_MEMBER | Introduced | Knight | Blue, standard member |
| PAST_DUE (grace) | Any | Keep existing | During 48h grace period |
| PAST_DUE (debtor) | Any | Debtor | Red, billing-support only |
| CANCELLED | n/a | Removed | Kicked from server |

## Common Pitfalls

### Pitfall 1: Foreign Key Ordering
**What goes wrong:** Creating members before teams they reference
**Why it happens:** teamId foreign key constraint
**How to avoid:** Create teams first, then members with teamId
**Warning signs:** Foreign key constraint violation errors

### Pitfall 2: Unique Constraint Violations
**What goes wrong:** Running seed twice without cleanup
**Why it happens:** email, stripeCustomerId are unique
**How to avoid:** Always run cleanup first (wipe-and-recreate pattern)
**Warning signs:** Unique constraint violation errors

### Pitfall 3: Invite Token Uniqueness
**What goes wrong:** Using duplicate or predictable tokens
**Why it happens:** Not using generateInviteToken()
**How to avoid:** Always use `generateInviteToken()` from src/lib/invite-tokens.ts
**Warning signs:** Unique constraint violation on token field

### Pitfall 4: Missing Pool Cleanup
**What goes wrong:** Script hangs on exit
**Why it happens:** pg.Pool connections not closed
**How to avoid:** Call `await pool.end()` in finally block
**Warning signs:** Script doesn't exit, connection timeout errors

### Pitfall 5: Test Data Cleanup Misses Non-Email Fields
**What goes wrong:** Teams don't have email field, can't use email pattern
**Why it happens:** Teams identified by stripeCustomerId, not email
**How to avoid:** Use `stripeCustomerId: { startsWith: 'test_' }` pattern for teams
**Warning signs:** Orphaned team records after cleanup

## Code Examples

### Complete Cleanup Function
```typescript
// Source: Custom for this phase, follows existing patterns
async function cleanupTestData(): Promise<void> {
  console.log('Deleting pending invites...');
  const inviteResult = await prisma.pendingInvite.deleteMany({
    where: {
      OR: [
        { inviteeEmail: { contains: '@test.example.com' } },
        { team: { stripeCustomerId: { startsWith: 'test_' } } }
      ]
    }
  });
  console.log(`  Deleted ${inviteResult.count} pending invites`);

  console.log('Deleting test members...');
  const memberResult = await prisma.member.deleteMany({
    where: { email: { contains: '@test.example.com' } }
  });
  console.log(`  Deleted ${memberResult.count} members`);

  console.log('Deleting test teams...');
  const teamResult = await prisma.team.deleteMany({
    where: { stripeCustomerId: { startsWith: 'test_' } }
  });
  console.log(`  Deleted ${teamResult.count} teams`);

  console.log('Deleting test admins...');
  const adminResult = await prisma.admin.deleteMany({
    where: { email: { contains: '@test.example.com' } }
  });
  console.log(`  Deleted ${adminResult.count} admins`);
}
```

### Individual Member Creation
```typescript
// Source: Custom, combines patterns from scripts/make-subscriber.ts
async function createIndividualMember(
  emailPrefix: string,
  status: SubscriptionStatus,
  introduced: boolean,
  extraData?: Partial<{
    paymentFailedAt: Date;
    gracePeriodEndsAt: Date;
    debtorStateEndsAt: Date;
    isInDebtorState: boolean;
    previousRole: string;
  }>
): Promise<void> {
  const email = `${emailPrefix}@test.example.com`;
  const currentPeriodEnd = status === 'ACTIVE' || status === 'PAST_DUE'
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    : null;

  await prisma.member.create({
    data: {
      email,
      subscriptionStatus: status,
      seatTier: 'INDIVIDUAL',
      currentPeriodEnd,
      introCompleted: introduced,
      introCompletedAt: introduced ? new Date() : null,
      firstName: introduced ? 'Test' : null,
      lastName: introduced ? emailPrefix.replace(/-/g, ' ') : null,
      ...extraData,
    },
  });
}
```

### Team with Members Creation
```typescript
// Source: Custom, follows schema patterns
async function createTeamWithMembers(
  teamName: string,
  teamId: string,
  ownerSeats: number,
  memberSeats: number,
  status: SubscriptionStatus,
  members: Array<{
    emailPrefix: string;
    tier: 'OWNER' | 'TEAM_MEMBER';
    introduced: boolean;
    isPrimaryOwner?: boolean;
    isTeamAdmin?: boolean;
  }>
): Promise<string> {
  // Create team first
  const team = await prisma.team.create({
    data: {
      name: teamName,
      stripeCustomerId: `test_${teamId}`,
      subscriptionStatus: status,
      ownerSeatCount: ownerSeats,
      teamSeatCount: memberSeats,
    },
  });

  // Create team members
  for (const m of members) {
    await prisma.member.create({
      data: {
        email: `${m.emailPrefix}@test.example.com`,
        subscriptionStatus: status,
        seatTier: m.tier,
        teamId: team.id,
        currentPeriodEnd: status === 'ACTIVE' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
        introCompleted: m.introduced,
        introCompletedAt: m.introduced ? new Date() : null,
        isPrimaryOwner: m.isPrimaryOwner ?? false,
        isTeamAdmin: m.isTeamAdmin ?? false,
      },
    });
  }

  return team.id;
}
```

## Test Scenarios to Cover

Based on CONTEXT.md decisions:

### Individual Subscription States
| State | Count | Email Pattern | Notes |
|-------|-------|---------------|-------|
| Active + Introduced | 5 | test-active-ind-1 through 5 | Full access (Lord) |
| Active + Unintroduced | 2 | test-unclaimed-1, 2 | Squire role |
| Past Due (grace period) | 2 | test-grace-1, 2 | 48h window |
| Past Due (debtor) | 2 | test-debtor-1, 2 | Debtor role |
| Cancelled | 2 | test-cancelled-1, 2 | No Discord access |
| Claim reminder timing | 3 | test-remind-48h, test-remind-7d, test-remind-30d | Varied createdAt |

### Team Configurations
| Team | Seats | Member States | Notes |
|------|-------|---------------|-------|
| Acme Corp (healthy) | 2 owner, 3 team | Mix of claimed/pending | Normal flow |
| Beta Inc (billing fail) | 1 owner, 2 team | All claimed | PAST_DUE status |
| Gamma LLC (new) | 1 owner, 1 team | 1 claimed, 1 pending | Testing invites |

### Admin Accounts
| Email | Role | Notes |
|-------|------|-------|
| admin@test.example.com | SUPER_ADMIN | Full access testing |
| support@test.example.com | ADMIN | Limited access testing |

## Open Questions

None - all requirements are clear from CONTEXT.md decisions and codebase analysis.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` - Complete model definitions and enums
- `prisma/seed.ts` - Existing seed pattern and database connection
- `scripts/*.ts` - Existing utility scripts showing data creation patterns
- `src/lib/password.ts` - Password hashing function
- `src/lib/invite-tokens.ts` - Token generation function
- `src/config/discord.ts` - Role definitions
- `.planning/phases/24-seed-data-testing/24-CONTEXT.md` - User decisions

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` - Role mapping decisions

## Metadata

**Confidence breakdown:**
- Schema/Models: HIGH - directly read from schema.prisma
- Existing patterns: HIGH - verified in codebase
- Role mappings: HIGH - documented in STATE.md and discord.ts

**Research date:** 2026-01-21
**Valid until:** Indefinite - codebase-specific research
