# Phase 3: Individual Subscription - Research

**Researched:** 2026-01-18
**Domain:** Stripe Checkout subscriptions, user registration, Discord role claim flow
**Confidence:** HIGH

## Summary

Phase 3 implements the core individual subscription flow: account creation before payment, Stripe Checkout for subscription purchase, and Discord claiming with role assignment. The established approach uses Stripe Checkout in subscription mode with `client_reference_id` to link sessions to pre-existing users, webhook-based fulfillment via `checkout.session.completed`, and the existing Discord role infrastructure from Phase 2.

Key insight: The CONTEXT.md decision to require account creation BEFORE Stripe Checkout is the correct pattern. By creating the user and Stripe customer upfront, we can pass the `customer` ID to Checkout and the member ID as `client_reference_id`, making webhook reconciliation straightforward. Password hashing should use Argon2id (OWASP 2025 recommendation) with the `argon2` npm package.

**Primary recommendation:** Create user + Stripe customer at signup, pass both to Checkout session, handle `checkout.session.completed` to update subscription status, then allow Discord claiming which triggers the existing `addRoleToMember` function for "Squire" role assignment.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | ^20.2.0 | Checkout session creation, webhook handling | Already installed, current version |
| argon2 | ^0.41.1 | Password hashing (OWASP 2025 recommendation) | Memory-hard, GPU-resistant, PHC winner |
| discord.js | ^14.25.1 | Role assignment after claim | Already installed from Phase 2 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| p-retry | ^6.2.1 | Exponential backoff for role assignment | When role assignment fails, retry async |
| zod | ^4.3.5 | Request validation for signup/claim | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| argon2 | bcrypt | bcrypt is battle-tested but only 4KB memory, vulnerable to FPGA attacks |
| p-retry | Custom retry | p-retry is well-tested, handles edge cases, ESM-native |
| client_reference_id | metadata | client_reference_id is purpose-built for this, 200 char limit |

**Installation:**
```bash
npm install argon2 p-retry
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  routes/
    auth.ts              # Existing - add signup routes
    checkout.ts          # NEW - Stripe Checkout session creation
    claim.ts             # NEW - Discord claim flow
    dashboard.ts         # NEW - Protected dashboard endpoints
  webhooks/
    stripe.ts            # Existing - add checkout.session.completed handler
  lib/
    password.ts          # NEW - Argon2 hashing utilities
    stripe-customer.ts   # NEW - Stripe customer management
    role-assignment.ts   # NEW - Async role assignment with retry
```

### Pattern 1: Account Creation Before Checkout
**What:** User registers (email+password OR magic link), Stripe customer created immediately
**When to use:** Always - per CONTEXT.md decision
**Example:**
```typescript
// Source: Stripe docs, OWASP password guidelines
import argon2 from 'argon2';
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

async function registerUser(
  email: string,
  password: string | null
): Promise<Member> {
  // 1. Hash password if provided (null for magic link users)
  const passwordHash = password
    ? await argon2.hash(password, {
        type: argon2.argon2id,  // OWASP recommendation
        memoryCost: 19456,      // 19 MiB
        timeCost: 2,
        parallelism: 1,
      })
    : null;

  // 2. Create Stripe customer
  const stripeCustomer = await stripe.customers.create({
    email,
    metadata: { source: 'trc-membership' },
  });

  // 3. Create member in database
  const member = await prisma.member.create({
    data: {
      email,
      passwordHash,
      stripeCustomerId: stripeCustomer.id,
      subscriptionStatus: 'NONE',
      seatTier: 'INDIVIDUAL',
    },
  });

  return member;
}
```

### Pattern 2: Stripe Checkout Session for Subscription
**What:** Create Checkout session linked to existing user and customer
**When to use:** When authenticated user initiates payment
**Example:**
```typescript
// Source: Stripe Checkout API docs
async function createCheckoutSession(
  memberId: string,
  stripeCustomerId: string,
  priceId: string
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,  // Links to existing Stripe customer
    client_reference_id: memberId,  // Links back to our Member
    line_items: [{
      price: priceId,
      quantity: 1,
    }],
    success_url: `${env.APP_URL}/dashboard?checkout=success`,
    cancel_url: `${env.APP_URL}/dashboard?checkout=cancel`,
    subscription_data: {
      metadata: {
        memberId,  // Also stored on subscription for redundancy
      },
    },
  });

  return session.url!;
}
```

### Pattern 3: Webhook Fulfillment with Expanded Data
**What:** Handle checkout.session.completed, fetch expanded session, update member
**When to use:** In webhook handler
**Example:**
```typescript
// Source: Stripe webhook docs, fulfillment guide
async function handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  // Retrieve session with expanded data (webhooks don't auto-expand)
  const expandedSession = await stripe.checkout.sessions.retrieve(
    session.id,
    { expand: ['subscription', 'customer'] }
  );

  const memberId = expandedSession.client_reference_id;
  if (!memberId) {
    logger.error({ sessionId: session.id }, 'No client_reference_id on session');
    return;
  }

  const subscription = expandedSession.subscription as Stripe.Subscription;

  // Update member subscription status
  await prisma.member.update({
    where: { id: memberId },
    data: {
      subscriptionStatus: 'ACTIVE',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  logger.info({ memberId, subscriptionId: subscription.id }, 'Subscription activated');
}
```

### Pattern 4: Discord Claim with Async Role Assignment
**What:** User connects Discord, role assigned asynchronously with retry
**When to use:** When user clicks "Connect Discord" on dashboard
**Example:**
```typescript
// Source: Phase 2 research, CONTEXT.md (silent retry + admin alert)
import pRetry from 'p-retry';
import { addRoleToMember } from '../bot/roles.js';
import { ROLE_CONFIG } from '../config/discord.js';

async function claimDiscordAccess(
  memberId: string,
  discordId: string
): Promise<{ success: boolean; inviteUrl: string }> {
  // 1. Verify member has active subscription
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member || member.subscriptionStatus !== 'ACTIVE') {
    throw new Error('No active subscription');
  }

  // 2. Check Discord not already linked elsewhere
  const existing = await prisma.member.findFirst({
    where: { discordId, id: { not: memberId } },
  });
  if (existing) {
    throw new Error('Discord already linked to another account');
  }

  // 3. Link Discord to member
  await prisma.member.update({
    where: { id: memberId },
    data: { discordId, discordUsername: '...' },
  });

  // 4. Assign role asynchronously (don't block response)
  assignRoleAsync(discordId, ROLE_CONFIG.SQUIRE.name);

  // 5. Return success with invite URL
  return {
    success: true,
    inviteUrl: env.DISCORD_INVITE_URL,
  };
}

// Fire-and-forget role assignment with retry
function assignRoleAsync(discordId: string, roleName: string): void {
  pRetry(
    () => addRoleToMember(discordId, roleName),
    {
      retries: 5,
      minTimeout: 1000,
      maxTimeout: 30000,
      onFailedAttempt: (error) => {
        logger.warn(
          { discordId, roleName, attempt: error.attemptNumber },
          'Role assignment retry'
        );
      },
    }
  ).catch((error) => {
    // After all retries exhausted, alert admin (already handled in addRoleToMember)
    logger.error({ discordId, roleName, error }, 'Role assignment failed after retries');
  });
}
```

### Pattern 5: Discord Invite Link (Not guilds.join)
**What:** Provide invite link URL instead of auto-joining via OAuth
**When to use:** Always - guilds.join scope has abuse potential
**Example:**
```typescript
// Source: Discord Developer discussions, security best practices
// Store invite URL in environment, NOT guilds.join OAuth

// .env
// DISCORD_INVITE_URL=https://discord.gg/yourserver

// After claim, redirect user to invite
res.redirect(env.DISCORD_INVITE_URL);
// OR return it for client to handle
res.json({ inviteUrl: env.DISCORD_INVITE_URL });
```

### Anti-Patterns to Avoid
- **Creating Stripe customer at checkout time:** Makes webhook reconciliation harder
- **Using guilds.join OAuth scope:** Abuse-prone, requires bot in guild, less transparent
- **Blocking on role assignment:** Role ops can fail; assign async, return success to user
- **Storing plain text passwords:** Always use Argon2id with OWASP-recommended parameters
- **Skipping client_reference_id:** Essential for linking Checkout to your user

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | bcrypt with low cost | argon2 with argon2id | OWASP 2025 recommends argon2id for new apps |
| Retry logic | setTimeout loops | p-retry | Handles edge cases, jitter, max retries |
| Checkout sessions | Custom payment form | Stripe Checkout | PCI compliance, conversion optimization |
| User ID in webhook | Parse from metadata | client_reference_id | Purpose-built field, survives API changes |
| Role assignment | Sync blocking call | Async with retry | Discord API can fail, don't block UX |

**Key insight:** Stripe Checkout handles PCI compliance, card validation, 3D Secure, and international payments. Custom payment forms require PCI SAQ A-EP at minimum.

## Common Pitfalls

### Pitfall 1: Webhook Event Order Not Guaranteed
**What goes wrong:** Code assumes checkout.session.completed arrives before customer.subscription.created
**Why it happens:** Stripe doesn't guarantee event delivery order
**How to avoid:**
- Each webhook handler should be self-contained
- Retrieve full objects from API, don't rely solely on event data
- Use database state to determine what's already processed
**Warning signs:** Race conditions, missing data in handlers

### Pitfall 2: Not Expanding Webhook Data
**What goes wrong:** Handler expects full subscription object, gets only ID
**Why it happens:** "Objects sent in events are always in their minimal form"
**How to avoid:** Always call `stripe.checkout.sessions.retrieve()` with `expand` parameter
**Warning signs:** `subscription.current_period_end` is undefined

### Pitfall 3: Argon2 Memory Configuration
**What goes wrong:** Server crashes or timeouts during password hashing
**Why it happens:** Default memory settings too high for server resources
**How to avoid:**
- Start with OWASP minimums: 19 MiB memory, 2 iterations
- Benchmark on production hardware
- Target 200-500ms hash time
**Warning signs:** Password operations timeout, high memory usage

### Pitfall 4: Discord Already Linked Check Timing
**What goes wrong:** Two users claim same Discord simultaneously, constraint violation
**Why it happens:** Check-then-update race condition
**How to avoid:**
- Rely on database unique constraint as final guard
- Catch Prisma unique constraint error and return user-friendly message
- Consider optimistic locking or database transaction
**Warning signs:** Prisma P2002 errors in logs

### Pitfall 5: Missing Subscription Status on Claim Attempt
**What goes wrong:** User tries to claim before webhook processes checkout
**Why it happens:** User redirects faster than webhook delivery
**How to avoid:**
- Check subscription status before allowing claim
- Show "Payment processing" state with retry
- Consider polling or real-time updates
**Warning signs:** Users click "Claim" immediately after redirect, see "no subscription" error

### Pitfall 6: Stripe Customer Email Sync
**What goes wrong:** User changes email, Stripe customer has old email
**Why it happens:** Customer created at signup, never updated
**How to avoid:** Update Stripe customer when member email changes
**Warning signs:** Stripe receipts go to wrong email

## Code Examples

Verified patterns from official sources:

### Signup Route with Password
```typescript
// Source: OWASP password storage, Express best practices
import { Router } from 'express';
import { z } from 'zod';
import argon2 from 'argon2';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

router.post('/signup', async (req, res) => {
  const result = signupSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { email, password } = result.data;

  // Check if email already exists
  const existing = await prisma.member.findFirst({ where: { email } });
  if (existing) {
    // Same response as success to prevent enumeration
    return res.json({ success: true, message: 'Check your email' });
  }

  // Hash password with Argon2id (OWASP 2025)
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,  // 19 MiB
    timeCost: 2,
    parallelism: 1,
  });

  // Create Stripe customer
  const customer = await stripe.customers.create({ email });

  // Create member
  const member = await prisma.member.create({
    data: {
      email,
      passwordHash,
      stripeCustomerId: customer.id,
      seatTier: 'INDIVIDUAL',
    },
  });

  // Create session tokens
  const accessToken = await createAccessToken(member.id);
  const refreshToken = await createRefreshToken(member.id, true);

  res.setHeader('Set-Cookie', serializeCookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS));
  res.json({ accessToken });
});
```

### Login Route with Password Verification
```typescript
// Source: OWASP auth best practices
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const member = await prisma.member.findFirst({ where: { email } });

  // Timing-safe: always verify even if no member (prevent enumeration)
  const passwordHash = member?.passwordHash ?? '$argon2id$v=19$m=19456,t=2,p=1$fake';
  const valid = await argon2.verify(passwordHash, password);

  if (!member || !valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const accessToken = await createAccessToken(member.id);
  const refreshToken = await createRefreshToken(member.id, true);

  res.setHeader('Set-Cookie', serializeCookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS));
  res.json({ accessToken });
});
```

### Checkout Session Creation Endpoint
```typescript
// Source: Stripe Checkout docs
router.post('/checkout', requireAuth, async (req, res) => {
  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
  });

  if (!member?.stripeCustomerId) {
    return res.status(400).json({ error: 'Account not configured for payment' });
  }

  if (member.subscriptionStatus === 'ACTIVE') {
    return res.status(400).json({ error: 'Already subscribed' });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: member.stripeCustomerId,
    client_reference_id: member.id,
    line_items: [{
      price: env.STRIPE_INDIVIDUAL_PRICE_ID,
      quantity: 1,
    }],
    success_url: `${env.APP_URL}/dashboard?checkout=success`,
    cancel_url: `${env.APP_URL}/dashboard?checkout=cancel`,
  });

  res.json({ checkoutUrl: session.url });
});
```

### Webhook Handler Enhancement
```typescript
// Source: Stripe webhook best practices
// Add to existing processStripeEvent function in src/webhooks/stripe.ts

case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session;

  // Only handle subscription mode
  if (session.mode !== 'subscription') break;

  // Retrieve with expanded data
  const expandedSession = await stripe.checkout.sessions.retrieve(
    session.id,
    { expand: ['subscription'] }
  );

  const memberId = expandedSession.client_reference_id;
  if (!memberId) {
    logger.error({ sessionId: session.id }, 'Missing client_reference_id');
    break;
  }

  const subscription = expandedSession.subscription as Stripe.Subscription;

  await prisma.member.update({
    where: { id: memberId },
    data: {
      subscriptionStatus: 'ACTIVE',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  logger.info({ memberId, subscriptionId: subscription.id }, 'Checkout completed, subscription active');
  break;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| bcrypt for passwords | Argon2id | 2023+ (OWASP update) | Better GPU/ASIC resistance |
| Custom payment forms | Stripe Checkout | Ongoing | PCI compliance simplified |
| Sync role assignment | Async with retry | Best practice | Better UX, resilience |
| guilds.join OAuth | Invite link | Discord guidance | Less abuse potential |
| Email in session only | client_reference_id | Stripe recommendation | Reliable user linking |

**Deprecated/outdated:**
- bcrypt with cost < 12: Too fast for modern GPUs
- Stripe Checkout v1/legacy: Use Sessions API
- Synchronous webhook processing: Return 200 fast, process async

## Open Questions

Things that couldn't be fully resolved:

1. **Stripe Price ID Configuration**
   - What we know: Need a recurring Price for Individual Monthly subscription
   - What's unclear: Whether to hardcode Price ID or use lookup_key
   - Recommendation: Use environment variable `STRIPE_INDIVIDUAL_PRICE_ID` for flexibility

2. **The Gatekeeper Page Content**
   - What we know: Information-focused landing with pricing cards, medieval theme
   - What's unclear: Exact copy, images, specific tier pricing amounts
   - Recommendation: Structure routes/templates to support content, defer copy to implementation

3. **Dashboard Component Structure**
   - What we know: Must show subscription status, claim CTA, Discord invite
   - What's unclear: Exact layout, whether SPA or server-rendered
   - Recommendation: Start with JSON API endpoints, frontend structure is Claude's discretion

4. **Checkout Session Expiry**
   - What we know: Default 24h, can set 30min to 24h
   - What's unclear: Optimal expiry for this use case
   - Recommendation: Use default (24h), users can restart checkout easily

## Sources

### Primary (HIGH confidence)
- [Stripe Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions/create) - Session creation parameters
- [Stripe Checkout Build Subscriptions](https://docs.stripe.com/payments/checkout/build-subscriptions) - Subscription mode integration
- [Stripe Checkout Fulfillment](https://docs.stripe.com/checkout/fulfillment) - Webhook handling best practices
- [Stripe Webhooks with Subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) - Event handling guidance
- Phase 2 RESEARCH.md - Discord OAuth, role management patterns (already implemented)

### Secondary (MEDIUM confidence)
- [OWASP Password Hashing Guide](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) - Argon2id recommendation
- [p-retry npm](https://www.npmjs.com/package/p-retry) - Retry library documentation
- [Discord Developer Discussions](https://github.com/discord/discord-api-docs/discussions/5654) - guilds.join scope concerns

### Tertiary (LOW confidence)
- Medium tutorials on Stripe/Express integration - Pattern verification
- Dev.to exponential backoff guides - Implementation examples

## Metadata

**Confidence breakdown:**
- Stripe Checkout: HIGH - Official documentation, current API version
- Password hashing: HIGH - OWASP 2025 guidelines explicit
- Webhook handling: HIGH - Stripe docs, existing Phase 1 pattern
- Role assignment: HIGH - Phase 2 implementation exists
- Frontend structure: MEDIUM - Claude's discretion per CONTEXT.md

**Research date:** 2026-01-18
**Valid until:** 2026-02-18 (30 days - stable domain)

## Schema Updates Required

Based on CONTEXT.md decisions, the Member model needs a password field:

```prisma
model Member {
  // Existing fields...

  // NEW: Password authentication
  passwordHash String?  // Null for magic-link-only users
}
```

## Environment Variables Required

```bash
# NEW for Phase 3
STRIPE_INDIVIDUAL_PRICE_ID=price_xxx  # Monthly Individual subscription price
DISCORD_INVITE_URL=https://discord.gg/xxx  # Server invite link
```
