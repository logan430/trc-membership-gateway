# Phase 5: Team Management - Research

**Researched:** 2026-01-18
**Domain:** Stripe multi-seat subscriptions, invite token flows, team dashboard
**Confidence:** HIGH

## Summary

Phase 5 implements company/team subscriptions where admins purchase plans with multiple seat types (owner and team), manage seat allocation via a dashboard, and invite teammates using secure tokens. The technical implementation leverages Stripe's quantity-based subscription items (two separate price IDs for different seat tiers), cryptographically secure invite tokens via Node.js `crypto.randomBytes()`, and extends the existing Prisma schema with Team and invite models.

The key architectural decision is to use **two subscription items on a single subscription**: one for owner seats and one for team seats, each with their own price ID and quantity. Mid-subscription seat additions use `stripe.subscriptionItems.update()` with `proration_behavior: 'always_invoice'` to immediately charge the prorated amount. The invite flow uses multi-use tokens (no expiry per CONTEXT.md) that decrement available seats when claimed.

**Primary recommendation:** Create two Stripe Price objects (owner seat, team seat) and handle company checkout with multiple `line_items`. Use the existing claim flow pattern but adapted for team invites with Discord OAuth only (no email/password).

## Standard Stack

The phase uses existing stack plus Stripe subscription items API for multi-seat billing.

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | 20.2.0 | Payment processing | Already in use, quantity-based billing built-in |
| crypto (Node.js) | built-in | Secure token generation | CSPRNG via randomBytes, no external deps |
| prisma | 7.2.0 | Database ORM | Already in use, Team model exists in schema |
| discord.js | 14.25.1 | Bot operations | Already in use for role assignment |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.3.5 | Request validation | Validate invite creation, seat purchase inputs |
| p-retry | 7.1.1 | Retry logic | Role assignment on claim (existing pattern) |
| cookie | 1.1.1 | Cookie handling | Invite claim flow state management |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| crypto.randomBytes | uuid/nanoid | Built-in is sufficient, no dependency needed |
| Custom invite tokens | JWT invite tokens | JWTs are overkill for simple invite links, tokens simpler |
| Separate subscription per seat | Multi-item subscription | Multi-item is cleaner, one subscription per company |

**Installation:**
No new dependencies required. All libraries already installed.

## Architecture Patterns

### Stripe Multi-Seat Subscription Model

**Pattern:** Two subscription items on one subscription

```
Subscription (one per company)
├── SubscriptionItem: owner_seat_price_id (quantity: N)
└── SubscriptionItem: team_seat_price_id (quantity: M)
```

This pattern allows:
- Different prices for different seat types
- Independent quantity updates for each seat type
- Single invoice with all seat charges
- Prorated mid-cycle additions

### Recommended Project Structure
```
src/
├── routes/
│   ├── company-checkout.ts     # Company plan checkout flow
│   ├── team-dashboard.ts       # Seat management dashboard
│   └── team-invite.ts          # Invite token claim flow
├── lib/
│   └── invite-tokens.ts        # Token generation/validation
└── webhooks/
    └── stripe.ts               # Extended for company checkout
```

### Pattern 1: Multi-Item Checkout Session
**What:** Create checkout with multiple line_items for different seat types
**When to use:** Company plan purchase with owner + team seats
**Example:**
```typescript
// Source: https://docs.stripe.com/api/checkout/sessions/create
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: stripeCustomerId,
  client_reference_id: teamId, // Reference team, not member
  custom_fields: [{
    key: 'company_name',
    label: { type: 'custom', custom: 'Company Name' },
    type: 'text',
  }],
  line_items: [
    {
      price: env.STRIPE_OWNER_SEAT_PRICE_ID,
      quantity: ownerSeatCount,
      adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
    },
    {
      price: env.STRIPE_TEAM_SEAT_PRICE_ID,
      quantity: teamSeatCount,
      adjustable_quantity: { enabled: true, minimum: 0, maximum: 50 },
    },
  ],
  subscription_data: {
    metadata: {
      teamId: teamId,
      planType: 'company',
    },
  },
  success_url: `${env.APP_URL}/team/dashboard?checkout=success`,
  cancel_url: `${env.APP_URL}/company?checkout=cancel`,
});
```

### Pattern 2: Mid-Subscription Seat Addition
**What:** Add seats to existing subscription with immediate proration
**When to use:** Admin adds owner or team seats mid-billing-cycle
**Example:**
```typescript
// Source: https://docs.stripe.com/api/subscription_items/update
// Find the subscription item ID for the seat type
const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
const ownerSeatItem = subscription.items.data.find(
  item => item.price.id === env.STRIPE_OWNER_SEAT_PRICE_ID
);

// Update quantity with immediate proration
await stripe.subscriptionItems.update(ownerSeatItem.id, {
  quantity: ownerSeatItem.quantity + additionalSeats,
  proration_behavior: 'always_invoice', // Charge immediately
});
```

### Pattern 3: Secure Invite Token Generation
**What:** Generate cryptographically secure, URL-safe invite tokens
**When to use:** Admin generates invite link for teammates
**Example:**
```typescript
// Source: https://nodejs.org/api/crypto.html
import { randomBytes } from 'crypto';

function generateInviteToken(): string {
  // 32 bytes = 256 bits of entropy, URL-safe base64
  return randomBytes(32)
    .toString('base64url'); // Built-in URL-safe encoding
}
// Result: "dGhpcyBpcyBhIHRlc3QgdG9rZW4..." (43 chars)
```

### Pattern 4: Team Dashboard Data Query
**What:** Query team seats with claimed member info
**When to use:** Dashboard showing seat allocation status
**Example:**
```typescript
// Prisma query for team dashboard
const teamWithMembers = await prisma.team.findUnique({
  where: { id: teamId },
  include: {
    members: {
      select: {
        id: true,
        discordUsername: true,
        email: true,
        seatTier: true,
        introCompleted: true,
      },
    },
  },
});

// Count claimed seats by tier
const claimedOwnerSeats = teamWithMembers.members.filter(
  m => m.seatTier === 'OWNER'
).length;
const claimedTeamSeats = teamWithMembers.members.filter(
  m => m.seatTier === 'TEAM_MEMBER'
).length;

// Available = purchased - claimed
const availableOwnerSeats = teamWithMembers.ownerSeatCount - claimedOwnerSeats;
const availableTeamSeats = teamWithMembers.teamSeatCount - claimedTeamSeats;
```

### Anti-Patterns to Avoid
- **Separate subscriptions per seat:** Use multi-item subscription instead - easier to manage, single invoice
- **Email-based invite validation:** Per CONTEXT.md, invitees only need Discord OAuth, no email required
- **Polling for seat availability:** Calculate from database counts, not real-time Stripe queries
- **Storing seat counts in Member:** Seat counts belong on Team model, Member just has teamId + seatTier
- **Hand-rolling token generation:** Use crypto.randomBytes, never Math.random for security tokens

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token generation | Custom random strings | crypto.randomBytes(32).toString('base64url') | CSPRNG is critical for security, Math.random is predictable |
| Proration calculation | Manual date math | Stripe proration_behavior: 'always_invoice' | Stripe handles timezone, billing cycle edge cases |
| OAuth state | Custom state generation | Existing claim flow pattern (randomUUID + cookie) | Already battle-tested in codebase |
| Role assignment | Sync role operations | Existing assignRoleAsync pattern | p-retry with exponential backoff already works |
| Subscription status | Custom status tracking | Mirror Stripe subscription.status | Source of truth is Stripe |

**Key insight:** Stripe handles all billing complexity (proration, invoice generation, payment). The codebase already has patterns for Discord operations (role assignment, OAuth). Focus on the new logic: team/invite data models and dashboard UI.

## Common Pitfalls

### Pitfall 1: Race Condition on Seat Claim
**What goes wrong:** Two users claim the last seat simultaneously, both succeed
**Why it happens:** Check seat availability, then claim - not atomic
**How to avoid:** Use database transaction with conditional update:
```typescript
// Atomic check-and-claim
const result = await prisma.$transaction(async (tx) => {
  const team = await tx.team.findUnique({
    where: { id: teamId },
    include: { members: { where: { seatTier: 'OWNER' } } },
  });

  const availableOwner = team.ownerSeatCount - team.members.length;
  if (availableOwner <= 0) {
    throw new Error('No seats available');
  }

  // Create/update member within same transaction
  return tx.member.create({ ... });
});
```
**Warning signs:** Claimed seats exceed purchased seats

### Pitfall 2: Webhook Processing Order
**What goes wrong:** checkout.session.completed arrives before team record created
**Why it happens:** Team created during checkout redirect, webhook fires first
**How to avoid:** Create Team record BEFORE creating Stripe checkout session. Use teamId in client_reference_id and subscription_data.metadata.
**Warning signs:** "Team not found" errors in webhook logs

### Pitfall 3: Invite Token in URL Path
**What goes wrong:** Token logged in server access logs, cached by proxies
**Why it happens:** Token in path like /invite/abc123
**How to avoid:** Use query parameter: /invite?token=abc123 - still logged but standard practice. Or use POST with token in body for extra security.
**Warning signs:** Token exposure in monitoring dashboards

### Pitfall 4: Blocking Individual Subscribers Incorrectly
**What goes wrong:** Individual subscriber tries to claim team seat, confusing error
**Why it happens:** Check for existing subscription but message unclear
**How to avoid:** Per CONTEXT.md, show clear message: "You already have owner access through your individual subscription"
**Warning signs:** Support tickets about confusing claim errors

### Pitfall 5: Stale Seat Counts After Stripe Sync Failure
**What goes wrong:** Stripe subscription updated but database out of sync
**Why it happens:** Network error during webhook processing
**How to avoid:** Re-sync seat counts on dashboard load from Stripe subscription items. Cache is database, source of truth is Stripe.
```typescript
// On dashboard load, verify counts match
const subscription = await stripe.subscriptions.retrieve(team.stripeSubscriptionId);
const stripeOwnerQty = subscription.items.data.find(i => i.price.id === OWNER_PRICE).quantity;
if (stripeOwnerQty !== team.ownerSeatCount) {
  await prisma.team.update({
    where: { id: teamId },
    data: { ownerSeatCount: stripeOwnerQty },
  });
}
```
**Warning signs:** Dashboard shows different count than Stripe dashboard

### Pitfall 6: Primary Owner Revocation
**What goes wrong:** Admin revokes the purchaser (primary owner), breaking billing
**Why it happens:** No special protection for primary owner
**How to avoid:** Per CONTEXT.md, primary owner cannot be revoked by other org members. Add isPrimaryOwner field or check against Stripe customer email.
**Warning signs:** Subscription orphaned without billing contact

## Code Examples

Verified patterns from official sources and existing codebase:

### Stripe Checkout with Multiple Line Items
```typescript
// Source: https://docs.stripe.com/api/checkout/sessions/create
// Based on existing src/routes/checkout.ts pattern

import Stripe from 'stripe';
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

// Company checkout with owner + team seats
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: stripeCustomerId,
  client_reference_id: teamId,
  custom_fields: [{
    key: 'company_name',
    label: { type: 'custom', custom: 'Company Name' },
    type: 'text',
  }],
  line_items: [
    {
      price: env.STRIPE_OWNER_SEAT_PRICE_ID,
      quantity: ownerSeats,
    },
    {
      price: env.STRIPE_TEAM_SEAT_PRICE_ID,
      quantity: teamSeats,
    },
  ],
  subscription_data: {
    metadata: { teamId, planType: 'company' },
  },
  success_url: `${env.APP_URL}/team/dashboard?checkout=success`,
  cancel_url: `${env.APP_URL}/company?checkout=cancel`,
});
```

### Subscription Item Quantity Update
```typescript
// Source: https://docs.stripe.com/api/subscription_items/update
// For mid-subscription seat additions

async function addSeats(
  subscriptionId: string,
  seatType: 'owner' | 'team',
  additionalSeats: number
): Promise<void> {
  const priceId = seatType === 'owner'
    ? env.STRIPE_OWNER_SEAT_PRICE_ID
    : env.STRIPE_TEAM_SEAT_PRICE_ID;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data.find(i => i.price.id === priceId);

  if (!item) {
    throw new Error(`No ${seatType} seat item found on subscription`);
  }

  await stripe.subscriptionItems.update(item.id, {
    quantity: item.quantity + additionalSeats,
    proration_behavior: 'always_invoice',
  });
}
```

### Secure Token Generation
```typescript
// Source: https://nodejs.org/api/crypto.html
import { randomBytes, timingSafeEqual } from 'crypto';

export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

// Timing-safe comparison for token validation
export function validateToken(provided: string, stored: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

### Invite Claim Flow (Discord OAuth Only)
```typescript
// Based on existing src/routes/claim.ts pattern
// Modified for team invite flow

claimRouter.get('/team/claim', async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    return res.redirect('/?error=invalid_token');
  }

  // Find invite and validate
  const invite = await prisma.pendingInvite.findUnique({
    where: { token },
    include: { team: true },
  });

  if (!invite) {
    return res.redirect('/?error=invalid_token');
  }

  // Check seat availability
  const claimedCount = await prisma.member.count({
    where: { teamId: invite.teamId, seatTier: invite.seatTier },
  });

  const maxSeats = invite.seatTier === 'OWNER'
    ? invite.team.ownerSeatCount
    : invite.team.teamSeatCount;

  if (claimedCount >= maxSeats) {
    return res.redirect('/?error=no_seats_available');
  }

  // Store token in session, redirect to Discord OAuth
  const state = randomUUID();
  res.setHeader('Set-Cookie', [
    serializeCookie('invite_state', state, COOKIE_OPTIONS),
    serializeCookie('invite_token', token, COOKIE_OPTIONS),
  ]);

  const authUrl = generateAuthUrl(state);
  res.redirect(authUrl);
});
```

### Team Dashboard Query
```typescript
// Dashboard data structure

interface DashboardData {
  team: {
    id: string;
    name: string;
    ownerSeatCount: number;
    teamSeatCount: number;
  };
  seats: {
    owners: {
      claimed: number;
      available: number;
      members: Array<{
        id: string;
        discordUsername: string;
        email: string | null;
        introCompleted: boolean;
        isPrimaryOwner: boolean;
      }>;
    };
    team: {
      claimed: number;
      available: number;
      members: Array<{
        id: string;
        discordUsername: string;
        email: string | null;
        introCompleted: boolean;
      }>;
    };
  };
}

async function getTeamDashboard(teamId: string, requesterId: string): Promise<DashboardData> {
  // Verify requester is team owner
  const requester = await prisma.member.findFirst({
    where: { id: requesterId, teamId, seatTier: 'OWNER' },
  });
  if (!requester) throw new Error('Unauthorized');

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        select: {
          id: true,
          discordUsername: true,
          email: true,
          seatTier: true,
          introCompleted: true,
          isTeamAdmin: true, // isPrimaryOwner indicator
        },
      },
    },
  });

  const owners = team.members.filter(m => m.seatTier === 'OWNER');
  const teamMembers = team.members.filter(m => m.seatTier === 'TEAM_MEMBER');

  return {
    team: {
      id: team.id,
      name: team.name,
      ownerSeatCount: team.ownerSeatCount,
      teamSeatCount: team.teamSeatCount,
    },
    seats: {
      owners: {
        claimed: owners.length,
        available: team.ownerSeatCount - owners.length,
        members: owners.map(m => ({
          id: m.id,
          discordUsername: m.discordUsername,
          email: m.email,
          introCompleted: m.introCompleted,
          isPrimaryOwner: m.isTeamAdmin,
        })),
      },
      team: {
        claimed: teamMembers.length,
        available: team.teamSeatCount - teamMembers.length,
        members: teamMembers.map(m => ({
          id: m.id,
          discordUsername: m.discordUsername,
          email: m.email,
          introCompleted: m.introCompleted,
        })),
      },
    },
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate subscriptions per user | Multi-item subscriptions | Stripe has always supported | Single invoice, easier management |
| Math.random tokens | crypto.randomBytes | Always recommended | Critical security improvement |
| Sync role operations | Fire-and-forget with p-retry | Implemented in Phase 3 | Faster response, resilient |
| Basic checkout | Checkout custom_fields | 2023+ | Capture company name in Stripe |

**Deprecated/outdated:**
- `crypto.randomBytes` callback API: Use promise-based or sync version
- Stripe API version pre-2025-06-30: Missing flexible billing mode features (not needed for this phase)

## Schema Updates Required

The existing schema already has Team and PendingInvite models. Updates needed:

```prisma
// Add to existing Member model
model Member {
  // ... existing fields ...
  isPrimaryOwner  Boolean  @default(false)  // Cannot be revoked by other owners
}

// Update PendingInvite for multi-use tokens (no email, no expiry)
model PendingInvite {
  id          String    @id @default(cuid())
  team        Team      @relation(fields: [teamId], references: [id])
  teamId      String
  seatTier    SeatTier  // OWNER or TEAM_MEMBER
  token       String    @unique
  // Remove: email, expiresAt (per CONTEXT.md: multi-use, never expire)
  createdBy   String    // Member ID who created the invite
  createdAt   DateTime  @default(now())

  @@index([teamId])
  @@index([token])
}
```

## Environment Variables Required

```env
# Add to existing env.ts schema
STRIPE_OWNER_SEAT_PRICE_ID=price_xxx    # Monthly owner seat price
STRIPE_TEAM_SEAT_PRICE_ID=price_yyy     # Monthly team seat price
```

## Open Questions

Things that couldn't be fully resolved:

1. **Invite Token Display Format**
   - What we know: Base64url is URL-safe (43 chars for 32 bytes)
   - What's unclear: Should we shorten for user-friendliness?
   - Recommendation: Use full token, provide "copy link" button in dashboard

2. **Dashboard Location**
   - What we know: Need new routes for team management
   - What's unclear: Per Claude's Discretion in CONTEXT.md
   - Recommendation: Add `/team/dashboard` route, accessible from main dashboard for team owners

3. **Individual to Company Upgrade Path**
   - What we know: CONTEXT.md says "preserving account and intro status"
   - What's unclear: Exact Stripe subscription transition mechanics
   - Recommendation: Cancel individual subscription at period end, create new company subscription, preserve Member record

## Sources

### Primary (HIGH confidence)
- [Stripe Checkout Sessions Create](https://docs.stripe.com/api/checkout/sessions/create) - Multi-line_item checkout
- [Stripe Subscription Items Update](https://docs.stripe.com/api/subscription_items/update) - Mid-subscription quantity changes
- [Stripe Subscription Items Create](https://docs.stripe.com/api/subscription_items/create) - Adding new items
- [Stripe Prorations](https://docs.stripe.com/billing/subscriptions/prorations) - Proration behavior options
- [Stripe Set Quantities](https://docs.stripe.com/billing/subscriptions/quantities) - Per-seat billing setup
- [Stripe Custom Fields](https://docs.stripe.com/payments/checkout/custom-fields) - Company name capture
- [Node.js Crypto](https://nodejs.org/api/crypto.html) - randomBytes for token generation

### Secondary (MEDIUM confidence)
- [Stripe Metadata](https://docs.stripe.com/metadata) - subscription_data.metadata usage
- [Stripe Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) - Subscription event handling
- Existing codebase patterns (claim.ts, checkout.ts, role-assignment.ts)

### Tertiary (LOW confidence)
- Multi-tenant SaaS patterns from web search (general guidance, not Stripe-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, verified with existing package.json
- Architecture: HIGH - Stripe multi-item subscriptions well-documented, existing patterns in codebase
- Pitfalls: MEDIUM - Based on general SaaS experience and Stripe docs, not project-specific testing

**Research date:** 2026-01-18
**Valid until:** 2026-02-18 (30 days - stable Stripe APIs)
