# Phase 6: Billing Failure - Research

**Researched:** 2026-01-19
**Domain:** Stripe payment failure webhooks, Discord role management, scheduled notification system
**Confidence:** HIGH

## Summary

Phase 6 implements billing failure handling: detecting Stripe payment failures via webhooks, applying a 48-hour grace period, then restricting access via the existing "Debtor" role (per CONTEXT.md decision), sending a cadence of DM+email notifications, and restoring access when payment recovers. The phase handles both individual and team subscriptions, with team members affected together when the owner's payment fails.

The implementation leverages the existing webhook infrastructure (Phase 1), role management system (Phase 2), and the Debtor role already defined in `src/config/discord.ts`. The primary technical challenges are: (1) implementing the notification scheduling cadence, (2) creating the #billing-support channel with proper permissions, and (3) tracking grace period and debtor state timelines in the database.

**Primary recommendation:** Use database-backed polling (simple setInterval checking due timestamps) rather than cron libraries. Store `paymentFailedAt`, `gracePeriodEndsAt`, `debtorStateEndsAt`, and `previousRole` fields in the database. A periodic job (every 5 minutes) checks for state transitions (grace period expiry, notification due, kick deadline). This approach survives restarts by persisting state, works without external dependencies like MongoDB/Redis, and is simple enough for this use case.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | ^20.2.0 | Payment webhooks, portal sessions | Already installed, handles all Stripe API |
| discord.js | ^14.25.1 | Role management, channel creation, DMs | Already installed, handles all Discord API |
| prisma | ^7.2.0 | State persistence for billing tracking | Already installed, handles database |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| p-retry | ^7.1.1 | Retry failed Discord operations | Already installed, used for role ops |
| pino | ^10.2.0 | Structured logging | Already installed, consistent logging |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| setInterval polling | node-cron | node-cron doesn't persist; polling is simpler |
| setInterval polling | Agenda (MongoDB) | Would add MongoDB dependency; overkill |
| setInterval polling | BullMQ (Redis) | Would add Redis dependency; overkill |
| Database state tracking | In-memory state | Would lose state on restart; unacceptable |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
  billing/
    failure-handler.ts     # Webhook handler for invoice.payment_failed
    recovery-handler.ts    # Webhook handler for invoice.paid
    billing-scheduler.ts   # Polling scheduler for state transitions
    notifications.ts       # DM and email notification functions
  bot/
    channels.ts            # Channel creation/management (new file)
    roles.ts               # Existing role management (add Debtor support)
  lib/
    role-assignment.ts     # Add moveToDebtor, restoreFromDebtor functions
```

### Pattern 1: Database-Tracked Billing States
**What:** Store billing failure state and timestamps in database for persistence
**When to use:** Always - critical for surviving restarts and tracking notification cadence
**Example:**
```typescript
// Schema additions for billing failure tracking
model Member {
  // ... existing fields ...

  // Billing failure tracking
  paymentFailedAt     DateTime?  // When first payment failure detected
  gracePeriodEndsAt   DateTime?  // 48 hours after paymentFailedAt
  debtorStateEndsAt   DateTime?  // 30 days after entering debtor state
  previousRole        String?    // 'Knight' or 'Lord' for restoration
  lastBillingDmAt     DateTime?  // Rate limit notifications
  isInDebtorState     Boolean    @default(false)
}

model Team {
  // ... existing fields ...

  // Billing failure tracking (mirrors member for team owners)
  paymentFailedAt     DateTime?
  gracePeriodEndsAt   DateTime?
  debtorStateEndsAt   DateTime?
}
```

### Pattern 2: Polling-Based Scheduler
**What:** setInterval job that queries database for pending transitions
**When to use:** For scheduled tasks that need persistence without external dependencies
**Example:**
```typescript
// Source: Best practices for simple database-backed scheduling
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function startBillingScheduler() {
  setInterval(async () => {
    const now = new Date();

    // Check for grace period expirations
    const expiredGracePeriod = await prisma.member.findMany({
      where: {
        gracePeriodEndsAt: { lte: now },
        isInDebtorState: false,
        paymentFailedAt: { not: null },
      },
    });

    for (const member of expiredGracePeriod) {
      await moveToDebtorState(member.id);
    }

    // Check for debtor state expirations (30-day kick)
    const expiredDebtorState = await prisma.member.findMany({
      where: {
        debtorStateEndsAt: { lte: now },
        isInDebtorState: true,
      },
    });

    for (const member of expiredDebtorState) {
      await kickAfterDebtorExpiry(member.id);
    }

    // Check for notification schedule
    await processNotificationCadence(now);
  }, POLL_INTERVAL);
}
```

### Pattern 3: Stripe Webhook Event Chain
**What:** Handle the specific webhook events for payment failure/recovery
**When to use:** For detecting payment state changes
**Example:**
```typescript
// Key events for billing failure
// Source: https://docs.stripe.com/billing/subscriptions/webhooks

// invoice.payment_failed - Fires when payment attempt fails
// - Check subscription.status changes to 'past_due'
// - Start grace period countdown

// invoice.paid - Fires when payment succeeds
// - Can occur after failed payment (recovery)
// - Restore access immediately

// customer.subscription.updated - Fires when status changes
// - status: 'past_due' = payment failed, retrying
// - status: 'active' = recovered
// - status: 'unpaid' = all retries exhausted

switch (event.type) {
  case 'invoice.payment_failed': {
    const invoice = event.data.object as Stripe.Invoice;
    // billing_reason: 'subscription_cycle' indicates recurring payment
    if (invoice.billing_reason === 'subscription_cycle') {
      await handlePaymentFailure(invoice);
    }
    break;
  }

  case 'invoice.paid': {
    const invoice = event.data.object as Stripe.Invoice;
    if (invoice.billing_reason === 'subscription_cycle') {
      await handlePaymentRecovery(invoice);
    }
    break;
  }
}
```

### Pattern 4: Channel Creation with Permission Overwrites
**What:** Create #billing-support channel if it doesn't exist, with read-only for Debtor
**When to use:** On bot startup or when first needed
**Example:**
```typescript
// Source: discord.js documentation
import { ChannelType, PermissionFlagsBits, Guild } from 'discord.js';

export async function ensureBillingSupportChannel(guild: Guild): Promise<void> {
  const channelName = 'billing-support';

  // Check if channel exists
  const existing = guild.channels.cache.find(
    ch => ch.name === channelName && ch.type === ChannelType.GuildText
  );

  if (existing) return;

  // Get Debtor role
  const debtorRole = guild.roles.cache.find(r => r.name === 'Debtor');
  if (!debtorRole) {
    logger.error('Debtor role not found');
    return;
  }

  // Create channel with restricted permissions
  await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      // Deny everyone by default
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      // Allow Debtor to view and read, but not send
      {
        id: debtorRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
        ],
        deny: [PermissionFlagsBits.SendMessages],
      },
      // Allow bot to send
      {
        id: guild.client.user!.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
        ],
      },
    ],
    reason: 'TRC Bot: Billing support channel for debtors',
  });

  logger.info('Created #billing-support channel');
}
```

### Pattern 5: Stripe Customer Portal for Payment Update
**What:** Generate portal URL for customers to update payment method
**When to use:** Include in DMs/emails to help customers resolve billing
**Example:**
```typescript
// Source: https://docs.stripe.com/api/customer_portal/sessions/create
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    // Deep link directly to payment method update
    flow_data: {
      type: 'payment_method_update',
    },
  });

  return session.url;
}
```

### Anti-Patterns to Avoid
- **Using setTimeout for scheduled notifications:** Loses state on restart. Use database timestamps.
- **Checking subscription status in isolation:** Always check invoice events, not just subscription.updated.
- **Removing roles before storing previous role:** Store previous role BEFORE any role changes.
- **Sending notifications without rate limiting:** Track lastBillingDmAt to prevent spam.
- **Hard-coding notification intervals:** Store notification timestamps in database for flexibility.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stripe portal links | Custom payment forms | stripe.billingPortal.sessions.create | PCI compliance, security |
| Channel permissions | Manual permission bits | Discord.js PermissionFlagsBits | Correct flag values |
| Retry logic | Custom retry loops | p-retry (already installed) | Exponential backoff, error handling |
| Job persistence | In-memory timers | Database timestamp queries | Survives restarts |
| Webhook signatures | Manual HMAC | stripe.webhooks.constructEvent | Already using it |

**Key insight:** The notification cadence looks complex but is just database queries against timestamps. Don't build a complex scheduler - just poll every 5 minutes and check "is X timestamp in the past?"

## Common Pitfalls

### Pitfall 1: Not Storing Previous Role Before Debtor Transition
**What goes wrong:** Cannot restore correct role (Knight vs Lord) after recovery
**Why it happens:** Role removed before capturing what it was
**How to avoid:**
```typescript
// CORRECT order:
// 1. Query current roles
// 2. Store previous role in database
// 3. Remove old role
// 4. Add Debtor role
const member = await guild.members.fetch(discordId);
const previousRole = member.roles.cache.find(
  r => ['Knight', 'Lord'].includes(r.name)
)?.name;

await prisma.member.update({
  where: { discordId },
  data: { previousRole },
});

// Then swap roles
```
**Warning signs:** Users restored to wrong role tier after payment recovery

### Pitfall 2: invoice.payment_failed vs Subscription Status
**What goes wrong:** Acting on failed payment when it's actually a first-time checkout failure
**Why it happens:** invoice.payment_failed fires for checkout.session failures too
**How to avoid:** Check `invoice.billing_reason === 'subscription_cycle'` to ensure it's a renewal failure, not initial payment
**Warning signs:** New customers being put into billing failure flow

### Pitfall 3: Race Condition Between Webhook and Scheduler
**What goes wrong:** Webhook marks recovery while scheduler is moving to debtor
**Why it happens:** Async operations on same member without coordination
**How to avoid:** Use database transactions, check current state before transitions
**Warning signs:** User briefly gains access then loses it, or vice versa

### Pitfall 4: Team Member Notification Overload
**What goes wrong:** All 10 team members receive 12+ notifications each
**Why it happens:** Each team member processed independently
**How to avoid:**
- Owner receives full billing details
- Team members receive ONE notification: "Contact thy organization admin"
- Track team notification separately from individual
**Warning signs:** Team members complaining about notification spam

### Pitfall 5: Not Invalidating Pending Invites on Kick
**What goes wrong:** Kicked team's pending invites remain valid
**Why it happens:** PendingInvite records not cleaned up
**How to avoid:** When team is kicked after 30-day debtor state, invalidate all PendingInvite records for that team
**Warning signs:** New users can claim seats on kicked/disbanded team

### Pitfall 6: Debtor Role Hoist Setting
**What goes wrong:** Debtors appear prominently in member sidebar
**Why it happens:** Role created with hoist: true
**How to avoid:** Explicitly set `hoist: false` when creating/updating Debtor role
**Warning signs:** "Debtor" category visible in member list

### Pitfall 7: Grace Period Reset on Multiple Failures
**What goes wrong:** Grace period keeps restarting on each retry
**Why it happens:** Setting paymentFailedAt on every invoice.payment_failed event
**How to avoid:** Only set paymentFailedAt if null (first failure)
```typescript
if (!member.paymentFailedAt) {
  await prisma.member.update({
    where: { id: member.id },
    data: {
      paymentFailedAt: new Date(),
      gracePeriodEndsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });
}
```
**Warning signs:** Grace period never expires despite no recovery

## Code Examples

Verified patterns from official sources:

### Invoice Payment Failed Handler
```typescript
// Source: Existing webhook structure, Stripe docs
async function handlePaymentFailure(invoice: Stripe.Invoice): Promise<void> {
  // Only handle subscription renewal failures
  if (invoice.billing_reason !== 'subscription_cycle') return;

  const subscriptionId = invoice.subscription as string;

  // Check if this is a team subscription
  const team = await prisma.team.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: { members: true },
  });

  if (team) {
    // Team subscription failure
    await handleTeamPaymentFailure(team, invoice);
    return;
  }

  // Individual subscription - find by customer ID
  const member = await prisma.member.findUnique({
    where: { stripeCustomerId: invoice.customer as string },
  });

  if (!member) {
    logger.warn({ customerId: invoice.customer }, 'No member for failed payment');
    return;
  }

  // Start grace period if not already started
  if (!member.paymentFailedAt) {
    const now = new Date();
    await prisma.member.update({
      where: { id: member.id },
      data: {
        paymentFailedAt: now,
        gracePeriodEndsAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        subscriptionStatus: 'PAST_DUE',
      },
    });

    // Send immediate notification (DM)
    await sendPaymentFailedNotification(member, 'immediate');

    logger.info({ memberId: member.id }, 'Payment failure recorded, grace period started');
  }
}
```

### Move to Debtor State Function
```typescript
// Source: Existing role-assignment.ts patterns
export async function moveToDebtorState(memberId: string): Promise<void> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member?.discordId) return;

  const guild = discordClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) return;

  try {
    const discordMember = await guild.members.fetch(member.discordId);

    // Determine previous role
    const previousRole = discordMember.roles.cache.find(
      r => r.name === 'Lord' || r.name === 'Knight'
    )?.name ?? 'Knight';

    // Update database FIRST
    const now = new Date();
    await prisma.member.update({
      where: { id: memberId },
      data: {
        previousRole,
        isInDebtorState: true,
        debtorStateEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Remove all managed roles
    await removeAllManagedRoles(member.discordId);

    // Add Debtor role
    await addRoleToMember(member.discordId, 'Debtor');

    // Send debtor state notification
    await sendDebtorStateNotification(member);

    logger.info({ memberId, previousRole }, 'Member moved to Debtor state');
  } catch (error) {
    logger.error({ memberId, error }, 'Failed to move member to Debtor state');
  }
}
```

### Payment Recovery Handler
```typescript
// Source: Stripe docs, existing webhook patterns
async function handlePaymentRecovery(invoice: Stripe.Invoice): Promise<void> {
  if (invoice.billing_reason !== 'subscription_cycle') return;

  const subscriptionId = invoice.subscription as string;

  // Check for team subscription first
  const team = await prisma.team.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: { members: true },
  });

  if (team) {
    await handleTeamPaymentRecovery(team, invoice);
    return;
  }

  // Individual member recovery
  const member = await prisma.member.findUnique({
    where: { stripeCustomerId: invoice.customer as string },
  });

  if (!member) return;

  // Restore based on state
  if (member.isInDebtorState) {
    await restoreFromDebtorState(member);
    await sendRecoveryNotification(member, 'debtor_recovery');
  } else if (member.paymentFailedAt) {
    // Was in grace period - just clear failure state
    await prisma.member.update({
      where: { id: member.id },
      data: {
        paymentFailedAt: null,
        gracePeriodEndsAt: null,
        subscriptionStatus: 'ACTIVE',
      },
    });
    await sendRecoveryNotification(member, 'grace_period_recovery');
  }

  logger.info({ memberId: member.id }, 'Payment recovered');
}

async function restoreFromDebtorState(member: Member): Promise<void> {
  if (!member.discordId) return;

  const roleToRestore = member.previousRole ?? 'Knight';

  // Remove Debtor, add previous role
  await removeRoleFromMember(member.discordId, 'Debtor');
  await addRoleToMember(member.discordId, roleToRestore);

  // Clear all billing failure state
  await prisma.member.update({
    where: { id: member.id },
    data: {
      paymentFailedAt: null,
      gracePeriodEndsAt: null,
      debtorStateEndsAt: null,
      previousRole: null,
      isInDebtorState: false,
      subscriptionStatus: 'ACTIVE',
    },
  });

  logger.info({ memberId: member.id, role: roleToRestore }, 'Member restored from Debtor state');
}
```

### Notification Cadence Processor
```typescript
// Source: CONTEXT.md notification schedule
interface NotificationSchedule {
  offsetHours: number;
  type: 'warning' | 'debtor' | 'reminder' | 'final_warning';
  message: string;
}

const NOTIFICATION_SCHEDULE: NotificationSchedule[] = [
  { offsetHours: 0, type: 'warning', message: 'immediate' },
  { offsetHours: 24, type: 'warning', message: '24h_warning' },
  { offsetHours: 48, type: 'debtor', message: 'debtor_transition' },
  { offsetHours: 48 + 7 * 24, type: 'reminder', message: '7_day_reminder' },
  { offsetHours: 48 + 10 * 24, type: 'reminder', message: '10_day_reminder' },
  { offsetHours: 48 + 15 * 24, type: 'reminder', message: '15_day_reminder' },
  { offsetHours: 48 + 20 * 24, type: 'reminder', message: '20_day_reminder' },
  { offsetHours: 48 + 25 * 24, type: 'reminder', message: '25_day_reminder' },
  // Final warnings (relative to 30-day kick)
  { offsetHours: 48 + 28 * 24, type: 'final_warning', message: '48h_before_kick' },
  { offsetHours: 48 + 29 * 24, type: 'final_warning', message: '24h_before_kick' },
  { offsetHours: 48 + 29.5 * 24, type: 'final_warning', message: '12h_before_kick' },
];

async function processNotificationCadence(now: Date): Promise<void> {
  // Get all members in billing failure state
  const membersInFailure = await prisma.member.findMany({
    where: {
      paymentFailedAt: { not: null },
    },
  });

  for (const member of membersInFailure) {
    const failureTime = member.paymentFailedAt!.getTime();
    const elapsedHours = (now.getTime() - failureTime) / (1000 * 60 * 60);

    // Find which notifications should have been sent
    for (const notification of NOTIFICATION_SCHEDULE) {
      if (elapsedHours >= notification.offsetHours) {
        const notificationKey = `${notification.message}_sent`;
        // Check if already sent (tracked in separate table or JSON field)
        if (!member.sentNotifications?.includes(notificationKey)) {
          await sendBillingNotification(member, notification);
          await markNotificationSent(member.id, notificationKey);
        }
      }
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual retry scheduling | Stripe Smart Retries | 2023+ | Let Stripe handle retry timing optimization |
| Single webhook event | Event chain tracking | Ongoing | invoice.payment_failed + invoice.paid = full picture |
| In-memory schedulers | Database-backed polling | Best practice | Critical for persistence across restarts |
| All-or-nothing access | Grace period pattern | Industry standard | Better user experience, higher recovery rates |

**Deprecated/outdated:**
- Using `customer.subscription.updated` alone for payment status - invoice events are more reliable
- Complex cron libraries for simple scheduling - database polling is sufficient
- Immediate access removal on first failure - grace periods recover 70-80% of failed payments

## Open Questions

Things that couldn't be fully resolved:

1. **Email Integration**
   - What we know: Phase 7 implements email infrastructure
   - What's unclear: Email provider not yet selected
   - Recommendation: Stub email functions in Phase 6, implement actual sending in Phase 7. DMs can work standalone.

2. **Stripe Portal Configuration**
   - What we know: Portal must be configured in Stripe Dashboard before API use
   - What's unclear: Whether test mode portal is already configured
   - Recommendation: Add setup verification, document Dashboard configuration requirement

3. **Exact Medieval Phrasing**
   - What we know: CONTEXT.md says "Claude's discretion"
   - What's unclear: Specific wording for each notification
   - Recommendation: Create notification templates during implementation, maintain consistent tone

4. **Pinned Message Content**
   - What we know: #billing-support should have pinned instructions
   - What's unclear: Exact content and formatting
   - Recommendation: Pin message with Stripe portal link and brief instructions on resolution

## Sources

### Primary (HIGH confidence)
- [Stripe Billing Webhooks Documentation](https://docs.stripe.com/billing/subscriptions/webhooks) - Event types, subscription status transitions
- [Stripe Customer Portal API](https://docs.stripe.com/api/customer_portal/sessions/create) - Portal session creation
- [Discord.js Role Documentation](https://discord.js.org/docs/packages/discord.js/14.25.1/Role:Class) - Hoist property, role management
- Existing codebase patterns (`src/webhooks/stripe.ts`, `src/bot/roles.ts`, `src/lib/role-assignment.ts`)

### Secondary (MEDIUM confidence)
- [Node.js Scheduler Comparison](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) - Polling vs cron patterns
- [Stripe Payment Status Guide](https://mrcoles.com/stripe-api-subscription-status/) - past_due vs unpaid clarification
- [Discord.js Permissions Guide](https://discordjs.guide/legacy/popular-topics/permissions) - Channel permission overwrites

### Tertiary (LOW confidence)
- WebSearch results on dunning best practices - General guidance, verify with Stripe docs
- Medium articles on scheduling patterns - Implementation details vary

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and proven in codebase
- Architecture: HIGH - Patterns derived from existing codebase and official docs
- Pitfalls: HIGH - Based on actual implementation patterns in codebase
- Webhook events: HIGH - Official Stripe documentation
- Scheduling: MEDIUM - Multiple approaches valid, database polling chosen for simplicity

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (30 days - Stripe webhooks stable, Discord.js stable)
