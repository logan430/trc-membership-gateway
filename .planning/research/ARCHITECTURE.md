# Architecture Patterns

**Domain:** Discord Membership Gateway with Stripe + Seat-Based Billing
**Researched:** 2026-01-18
**Confidence:** HIGH (patterns verified across multiple open-source implementations and official documentation)

## System Overview

The Revenue Council membership gateway follows an **event-driven, webhook-centric architecture** with clear separation between:

1. **Web Application Layer** - Express API handling Stripe webhooks, Discord OAuth, admin dashboard
2. **Bot Layer** - Discord.js bot managing roles, intro monitoring, member interactions
3. **Data Layer** - Supabase Postgres with Prisma ORM for type-safe access
4. **External Services** - Stripe (billing), Discord API (roles/auth)

```
                                    +------------------+
                                    |     Stripe       |
                                    +--------+---------+
                                             |
                                    Webhooks | (subscription events)
                                             v
+------------------+            +------------+-------------+
|   Discord API    |<---------->|    Express Web App       |
| (OAuth, Gateway) |   REST     |  - Webhook Handler       |
+--------+---------+            |  - OAuth Endpoints       |
         ^                      |  - Admin Dashboard API   |
         |                      +------------+-------------+
         | Events                            |
         |                                   | Prisma ORM
+--------+---------+                         v
|  Discord.js Bot  |            +------------+-------------+
|  - Role Manager  |<---------->|   Supabase Postgres      |
|  - Intro Monitor |   Prisma   |  - Members               |
|  - Commands      |            |  - Subscriptions         |
+------------------+            |  - Teams                 |
                                |  - Event Log             |
                                +--------------------------+
```

## Component Architecture

### Component 1: Stripe Webhook Handler

**Responsibility:** Receive and process Stripe subscription events
**Communicates With:** Database (writes), Discord Bot (triggers role updates)

**Key Pattern:** Verify-Enqueue-ACK

```typescript
// Critical: Raw body required for signature verification
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    // 1. Verify signature immediately
    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 2. Return 200 FAST (before processing)
    res.json({ received: true });

    // 3. Process asynchronously (or queue for worker)
    await processStripeEvent(event);
  }
);
```

**Events to Handle:**

| Event | Action | Priority |
|-------|--------|----------|
| `checkout.session.completed` | Create subscription, grant roles | Critical |
| `customer.subscription.updated` | Update seat count, sync roles | Critical |
| `customer.subscription.deleted` | Revoke roles, downgrade | Critical |
| `invoice.payment_failed` | Set PAST_DUE status, notify | High |
| `invoice.payment_succeeded` | Clear PAST_DUE status | High |
| `customer.subscription.created` | Initialize subscription record | Medium |

**Idempotency Pattern:**

```typescript
async function processStripeEvent(event: Stripe.Event) {
  // Check if already processed
  const existing = await prisma.stripeEvent.findUnique({
    where: { eventId: event.id }
  });

  if (existing) {
    console.log(`Event ${event.id} already processed, skipping`);
    return;
  }

  // Process the event
  await handleEvent(event);

  // Mark as processed
  await prisma.stripeEvent.create({
    data: {
      eventId: event.id,
      type: event.type,
      processedAt: new Date()
    }
  });
}
```

### Component 2: Discord OAuth Handler

**Responsibility:** Link Discord accounts to Stripe customers
**Communicates With:** Discord API (auth flow), Database (stores linkage)

**OAuth Flow:**

```
1. User clicks "Link Discord" on checkout/portal
2. Redirect to Discord OAuth with scopes: identify, guilds.join
3. Discord redirects back with authorization code
4. Exchange code for access token
5. Fetch user info (id, username, avatar)
6. Store Discord ID linked to Stripe customer
7. Add user to guild and grant initial roles
```

**Required Scopes:**

| Scope | Purpose |
|-------|---------|
| `identify` | Get Discord user ID and username |
| `guilds.join` | Add user to server automatically |
| `guilds.members.read` | Check current role status |

**Account Linking Database Pattern:**

```typescript
model Member {
  id              String   @id @default(cuid())
  discordId       String   @unique
  discordUsername String
  stripeCustomerId String? @unique
  email           String?

  // Relationship to team (for company seats)
  team            Team?    @relation(fields: [teamId], references: [id])
  teamId          String?

  // Subscription status cached locally
  subscriptionStatus SubscriptionStatus @default(NONE)
  subscriptionTier   SubscriptionTier?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Component 3: Discord.js Bot (Role Manager)

**Responsibility:** Assign/revoke Discord roles based on subscription status
**Communicates With:** Discord Gateway, Database (reads member status)

**Architecture Pattern:** Treat bot as frontend client

The bot should be a thin client that:
- Receives commands from users
- Makes API calls to the Express backend for business logic
- Reads subscription status from database
- Executes role changes based on status

**Role Management Pattern:**

```typescript
async function syncMemberRoles(discordId: string) {
  const member = await prisma.member.findUnique({
    where: { discordId },
    include: { team: true }
  });

  if (!member) return;

  const guild = await client.guilds.fetch(GUILD_ID);
  const discordMember = await guild.members.fetch(discordId);

  // Determine correct roles based on subscription
  const targetRoles = determineRoles(member);

  // Remove roles not in target set
  const rolesToRemove = discordMember.roles.cache.filter(
    role => MANAGED_ROLES.includes(role.id) && !targetRoles.includes(role.id)
  );

  // Add missing roles
  const rolesToAdd = targetRoles.filter(
    roleId => !discordMember.roles.cache.has(roleId)
  );

  // Execute changes (sequentially to avoid race conditions)
  for (const role of rolesToRemove.values()) {
    await discordMember.roles.remove(role);
  }
  for (const roleId of rolesToAdd) {
    await discordMember.roles.add(roleId);
  }
}
```

**Role Hierarchy:**

```
@Founder (individual subscription - highest tier)
@Company Member (seat on company subscription)
@Member (basic paid subscription)
@Trial (intro period before payment)
@Unverified (just joined, awaiting intro)
```

### Component 4: Discord.js Bot (Intro Monitor)

**Responsibility:** Track new member introductions, manage verification flow
**Communicates With:** Discord Gateway (message events), Database (intro status)

**Intro Flow:**

```
1. New member joins -> Bot assigns @Unverified role
2. Member can only see #rules and #introduce-yourself
3. Member posts introduction in #introduce-yourself
4. Bot detects message, validates (length, content rules)
5. If valid: Remove @Unverified, add @Trial
6. Member now sees full server, starts trial period
7. Trial expires -> Prompt to subscribe
```

**Message Monitoring Pattern:**

```typescript
client.on('messageCreate', async (message) => {
  // Only monitor intro channel
  if (message.channel.id !== INTRO_CHANNEL_ID) return;
  if (message.author.bot) return;

  // Check if user needs to introduce
  const member = await prisma.member.findUnique({
    where: { discordId: message.author.id }
  });

  if (member?.introCompleted) return;

  // Validate introduction
  const isValid = validateIntro(message.content);

  if (isValid) {
    await prisma.member.update({
      where: { id: member.id },
      data: {
        introCompleted: true,
        introCompletedAt: new Date()
      }
    });

    // Update roles
    await syncMemberRoles(message.author.id);

    // Send welcome DM or channel message
    await message.reply('Welcome to The Revenue Council!');
  }
});
```

### Component 5: Seat Management Dashboard

**Responsibility:** Allow company admins to manage team seats
**Communicates With:** Express API, Stripe (subscription quantity), Database

**Dashboard Capabilities:**

| Feature | Implementation |
|---------|---------------|
| View team members | Query `Member` by `teamId` |
| Invite new member | Create pending invite, send Discord DM |
| Remove member | Revoke seat, trigger role removal |
| Add seats | Update Stripe subscription quantity |
| Remove seats | Validate minimum, update Stripe |
| View billing | Stripe Customer Portal redirect |

**Seat Management Flow:**

```
Admin adds seat:
1. Frontend calls POST /api/teams/{id}/seats
2. Backend validates admin permission
3. Backend updates Stripe subscription quantity
4. Stripe webhook confirms change
5. Database updated with new seat count
6. Admin can now invite new member

Admin invites member:
1. Admin enters Discord username or email
2. Backend creates PendingInvite record
3. Bot sends DM with invite link
4. Member clicks link, goes through OAuth
5. Member linked to team, granted @Company Member role
```

### Component 6: Reconciliation Worker

**Responsibility:** Verify subscription status matches Discord roles
**Communicates With:** Stripe API (source of truth), Database, Discord (role sync)

**Pattern:** Scheduled job that cross-checks data sources

```typescript
// Run daily via cron or scheduled function
async function reconcileSubscriptions() {
  // Get all members with active subscriptions in DB
  const members = await prisma.member.findMany({
    where: {
      subscriptionStatus: { in: ['ACTIVE', 'PAST_DUE'] }
    }
  });

  for (const member of members) {
    if (!member.stripeCustomerId) continue;

    // Fetch current status from Stripe (source of truth)
    const subscriptions = await stripe.subscriptions.list({
      customer: member.stripeCustomerId,
      status: 'all'
    });

    const activeSubscription = subscriptions.data.find(
      sub => ['active', 'past_due', 'trialing'].includes(sub.status)
    );

    // Detect drift
    if (!activeSubscription && member.subscriptionStatus !== 'NONE') {
      // DB thinks active but Stripe says no - revoke access
      await prisma.member.update({
        where: { id: member.id },
        data: { subscriptionStatus: 'NONE' }
      });
      await syncMemberRoles(member.discordId);

      // Log for audit
      await prisma.reconciliationLog.create({
        data: {
          memberId: member.id,
          issue: 'SUBSCRIPTION_DRIFT',
          action: 'ACCESS_REVOKED'
        }
      });
    }
  }
}
```

## Data Flow Diagrams

### New Member Purchase Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NEW MEMBER PURCHASE FLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘

User                    Website              Stripe           Webhook Handler        Database           Discord Bot
 │                         │                   │                    │                  │                    │
 │  Click "Subscribe"      │                   │                    │                  │                    │
 │────────────────────────>│                   │                    │                  │                    │
 │                         │                   │                    │                  │                    │
 │                         │ Create Checkout   │                    │                  │                    │
 │                         │ Session           │                    │                  │                    │
 │                         │──────────────────>│                    │                  │                    │
 │                         │                   │                    │                  │                    │
 │  <─────────────────────>│ Redirect to       │                    │                  │                    │
 │  Complete payment       │ Checkout          │                    │                  │                    │
 │                         │                   │                    │                  │                    │
 │                         │                   │ checkout.session   │                  │                    │
 │                         │                   │ .completed         │                  │                    │
 │                         │                   │───────────────────>│                  │                    │
 │                         │                   │                    │                  │                    │
 │                         │                   │                    │ Create Member    │                    │
 │                         │                   │                    │ & Subscription   │                    │
 │                         │                   │                    │─────────────────>│                    │
 │                         │                   │                    │                  │                    │
 │                         │                   │                    │ Trigger role     │                    │
 │                         │                   │                    │ sync             │                    │
 │                         │                   │                    │─────────────────────────────────────>│
 │                         │                   │                    │                  │                    │
 │                         │                   │                    │                  │   Assign @Member   │
 │                         │                   │                    │                  │<───────────────────│
 │                         │                   │                    │                  │                    │
 │  Discord OAuth          │                   │                    │                  │                    │
 │  (if not linked)        │                   │                    │                  │                    │
 │<────────────────────────│                   │                    │                  │                    │
 │                         │                   │                    │                  │                    │
```

### Company Seat Purchase Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPANY SEAT PURCHASE FLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘

Admin                   Dashboard            Backend              Stripe            Database         Discord
 │                         │                   │                    │                  │                │
 │  Add 5 seats            │                   │                    │                  │                │
 │────────────────────────>│                   │                    │                  │                │
 │                         │ POST /seats       │                    │                  │                │
 │                         │──────────────────>│                    │                  │                │
 │                         │                   │                    │                  │                │
 │                         │                   │ Update quantity    │                  │                │
 │                         │                   │───────────────────>│                  │                │
 │                         │                   │                    │                  │                │
 │                         │                   │                    │ subscription     │                │
 │                         │                   │                    │ .updated webhook │                │
 │                         │                   │<───────────────────│                  │                │
 │                         │                   │                    │                  │                │
 │                         │                   │ Update seat count  │                  │                │
 │                         │                   │─────────────────────────────────────>│                │
 │                         │                   │                    │                  │                │
 │  <──────────────────────│ Success           │                    │                  │                │
 │                         │                   │                    │                  │                │
 │  Invite team@company.com│                   │                    │                  │                │
 │────────────────────────>│                   │                    │                  │                │
 │                         │ POST /invites     │                    │                  │                │
 │                         │──────────────────>│                    │                  │                │
 │                         │                   │                    │                  │                │
 │                         │                   │ Create invite      │                  │                │
 │                         │                   │─────────────────────────────────────>│                │
 │                         │                   │                    │                  │                │
 │                         │                   │ Send invite DM     │                  │                │
 │                         │                   │────────────────────────────────────────────────────────>│
 │                         │                   │                    │                  │                │
```

### Subscription Cancellation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SUBSCRIPTION CANCELLATION FLOW                        │
└─────────────────────────────────────────────────────────────────────────────┘

Stripe                 Webhook Handler        Database           Discord Bot         Member
 │                           │                   │                    │                │
 │ subscription.deleted      │                   │                    │                │
 │──────────────────────────>│                   │                    │                │
 │                           │                   │                    │                │
 │                           │ Update status     │                    │                │
 │                           │ to CANCELLED      │                    │                │
 │                           │──────────────────>│                    │                │
 │                           │                   │                    │                │
 │                           │ Trigger role      │                    │                │
 │                           │ sync              │                    │                │
 │                           │──────────────────────────────────────>│                │
 │                           │                   │                    │                │
 │                           │                   │                    │ Remove @Member │
 │                           │                   │                    │ Add @Former    │
 │                           │                   │                    │───────────────>│
 │                           │                   │                    │                │
 │                           │ Send cancellation │                    │                │
 │                           │ notification      │                    │                │
 │                           │──────────────────────────────────────────────────────>│
 │                           │                   │                    │                │
```

## Database Schema Pattern

```prisma
// Core entities for membership gateway

model Member {
  id                  String             @id @default(cuid())

  // Discord identity
  discordId           String             @unique
  discordUsername     String
  discordAvatar       String?

  // Stripe identity
  stripeCustomerId    String?            @unique
  email               String?

  // Subscription state (cached from Stripe)
  subscriptionStatus  SubscriptionStatus @default(NONE)
  subscriptionTier    SubscriptionTier?
  currentPeriodEnd    DateTime?

  // Onboarding state
  introCompleted      Boolean            @default(false)
  introCompletedAt    DateTime?
  introMessage        String?

  // Team membership (for company seats)
  team                Team?              @relation(fields: [teamId], references: [id])
  teamId              String?
  isTeamAdmin         Boolean            @default(false)

  // Audit
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  @@index([teamId])
  @@index([subscriptionStatus])
}

model Team {
  id                    String             @id @default(cuid())
  name                  String

  // Stripe subscription for team
  stripeCustomerId      String             @unique
  stripeSubscriptionId  String?            @unique
  subscriptionStatus    SubscriptionStatus @default(NONE)
  subscriptionTier      SubscriptionTier?

  // Seat management
  paidSeatCount         Int                @default(0)

  // Members
  members               Member[]
  pendingInvites        PendingInvite[]

  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt
}

model PendingInvite {
  id          String   @id @default(cuid())
  team        Team     @relation(fields: [teamId], references: [id])
  teamId      String
  email       String
  token       String   @unique
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime @default(now())

  @@index([teamId])
  @@index([token])
}

model StripeEvent {
  id          String   @id @default(cuid())
  eventId     String   @unique  // Stripe event ID for idempotency
  type        String
  processedAt DateTime @default(now())
  payload     Json?    // Optional: store full payload for debugging

  @@index([eventId])
}

model ReconciliationLog {
  id        String   @id @default(cuid())
  memberId  String
  issue     String
  action    String
  details   Json?
  createdAt DateTime @default(now())

  @@index([memberId])
  @@index([createdAt])
}

enum SubscriptionStatus {
  NONE
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELLED
}

enum SubscriptionTier {
  INDIVIDUAL
  COMPANY_SEAT
  FOUNDER
}
```

## Patterns to Follow

### Pattern 1: Event-Driven State Management

**What:** Never directly modify subscription state from user actions. Always flow through Stripe webhooks.

**Why:** Stripe is the source of truth for billing. Direct modifications create drift between Stripe and local state.

**Example:**

```typescript
// WRONG: Directly updating subscription status
app.post('/api/cancel', async (req, res) => {
  await prisma.member.update({
    where: { id: req.user.id },
    data: { subscriptionStatus: 'CANCELLED' } // DON'T DO THIS
  });
});

// RIGHT: Let Stripe webhook handle state change
app.post('/api/cancel', async (req, res) => {
  const member = await prisma.member.findUnique({ where: { id: req.user.id }});

  // Cancel in Stripe - webhook will update our state
  await stripe.subscriptions.cancel(member.stripeSubscriptionId);

  res.json({ message: 'Cancellation initiated' });
});
```

### Pattern 2: Idempotent Webhook Processing

**What:** Every webhook handler must be safe to run multiple times with the same event.

**Why:** Stripe may deliver the same event multiple times. Processing twice could grant double access or send duplicate emails.

**Implementation:**

```typescript
// Store processed event IDs
await prisma.stripeEvent.create({ data: { eventId: event.id, type: event.type } });

// Check before processing
const exists = await prisma.stripeEvent.findUnique({ where: { eventId: event.id }});
if (exists) return; // Already processed
```

### Pattern 3: Thin Bot, Fat Backend

**What:** Discord bot should be a thin client. Business logic lives in the Express API.

**Why:**
- Bots can't be easily tested
- Business logic is harder to debug in bot code
- Same backend serves dashboard and bot
- Bot restarts shouldn't lose state

**Implementation:**

```typescript
// Bot command handler - thin
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'status') {
    // Call backend API, don't query DB directly
    const response = await fetch(`${API_URL}/members/${interaction.user.id}/status`);
    const data = await response.json();

    await interaction.reply(formatStatus(data));
  }
});
```

### Pattern 4: Graceful Degradation for Payment Failures

**What:** "Pause, don't punish" - set PAST_DUE status rather than immediately revoking access.

**Why:** Payment failures are often temporary (card expired, insufficient funds). Immediate revocation creates poor UX and support burden.

**Implementation:**

```typescript
// On payment failure
case 'invoice.payment_failed':
  await prisma.member.update({
    where: { stripeCustomerId: event.data.object.customer },
    data: { subscriptionStatus: 'PAST_DUE' }
  });

  // Send notification but don't revoke roles yet
  await sendPaymentFailureNotification(member);

  // Roles stay - give them time to update payment
  // Only revoke after subscription is actually cancelled by Stripe
  break;
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Synchronous Webhook Processing

**What:** Performing all business logic before returning 200 to Stripe.

**Why Bad:** Stripe has a 20-second timeout. Complex operations may exceed this, causing retries and duplicate processing.

**Instead:**

```typescript
// Return 200 immediately, process async
app.post('/webhooks/stripe', async (req, res) => {
  // Verify signature
  const event = stripe.webhooks.constructEvent(...);

  // Return immediately
  res.json({ received: true });

  // Process asynchronously
  processEvent(event).catch(err => {
    console.error('Event processing failed:', err);
    // Queue for retry or alert
  });
});
```

### Anti-Pattern 2: Polling Stripe Instead of Using Webhooks

**What:** Regularly calling Stripe API to check subscription status.

**Why Bad:** Rate limits, increased latency, missing real-time updates, unnecessary API costs.

**Instead:** Use webhooks for real-time updates, reconciliation job only as backup.

### Anti-Pattern 3: Bot Handles Business Logic Directly

**What:** Discord bot directly queries Stripe API or makes business decisions.

**Why Bad:**
- Can't test business logic without Discord
- Multiple sources of truth
- Bot crashes lose in-flight operations

**Instead:** Bot calls Express API endpoints which handle all business logic.

### Anti-Pattern 4: Trusting Client-Provided Subscription Data

**What:** Using subscription data sent from frontend without verification.

**Why Bad:** Users could manipulate requests to grant themselves access.

**Instead:** Always verify with Stripe API or use webhook-populated database as source of truth.

## Component Dependencies and Build Order

### Dependency Graph

```
Level 0 (No dependencies):
├── Database Schema (Prisma)
├── Stripe Product/Price Setup
└── Discord Bot Registration

Level 1 (Depends on Level 0):
├── Stripe Webhook Handler (needs schema)
├── Discord OAuth Handler (needs schema)
└── Discord Bot Core (needs registration)

Level 2 (Depends on Level 1):
├── Role Manager (needs webhook handler + bot core)
├── Member Management API (needs webhook handler + OAuth)
└── Intro Monitor (needs bot core + schema)

Level 3 (Depends on Level 2):
├── Seat Management Dashboard (needs member API + role manager)
└── Reconciliation Worker (needs all of above)
```

### Recommended Build Order

| Phase | Components | Rationale |
|-------|------------|-----------|
| 1 | Database schema, Stripe setup | Foundation - everything depends on these |
| 2 | Stripe webhook handler, Discord OAuth | Core integration points |
| 3 | Bot core, role manager | Can test role assignment manually |
| 4 | Individual subscription flow | End-to-end for single users |
| 5 | Intro monitoring | Onboarding flow complete |
| 6 | Team/seat management | More complex, builds on individual flow |
| 7 | Admin dashboard | UI over working backend |
| 8 | Reconciliation worker | Safety net, not critical path |

### Interface Contracts Between Components

**Webhook Handler -> Role Manager:**
```typescript
interface RoleSyncRequest {
  discordId: string;
  subscriptionStatus: SubscriptionStatus;
  tier: SubscriptionTier | null;
  teamId: string | null;
}
```

**OAuth Handler -> Database:**
```typescript
interface MemberLink {
  discordId: string;
  discordUsername: string;
  stripeCustomerId: string;
  email: string;
}
```

**Dashboard API -> Stripe:**
```typescript
interface SeatUpdateRequest {
  subscriptionId: string;
  newQuantity: number;
}
```

## Scalability Considerations

| Concern | At 100 members | At 1K members | At 10K members |
|---------|----------------|---------------|----------------|
| Webhook processing | Synchronous OK | Add queue (Bull/BullMQ) | Dedicated worker processes |
| Role sync | Direct Discord API | Batch operations | Rate limit handling, queuing |
| Reconciliation | Single run | Paginated queries | Distributed workers |
| Database | Single Supabase | Connection pooling | Read replicas |
| Bot sharding | Single instance | Not needed | Consider sharding |

## Security Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL BOUNDARY                          │
│  - Stripe webhook signature verification                        │
│  - Discord OAuth token validation                               │
│  - HTTPS everywhere                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API BOUNDARY                               │
│  - JWT/session authentication for dashboard                     │
│  - Rate limiting                                                │
│  - Input validation (Zod schemas)                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AUTHORIZATION BOUNDARY                      │
│  - Team admin can only manage their team                        │
│  - Members can only view their own data                         │
│  - Bot actions scoped to managed roles only                     │
└─────────────────────────────────────────────────────────────────┘
```

## Sources

### Official Documentation (HIGH confidence)
- [Stripe Webhooks Documentation](https://docs.stripe.com/webhooks)
- [Stripe Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)
- [Discord OAuth2 Documentation](https://discord.com/developers/docs/topics/oauth2)
- [Prisma with Supabase](https://supabase.com/docs/guides/database/prisma)

### Open Source Implementations (HIGH confidence)
- [stripe-discord-bot](https://github.com/Androz2091/stripe-discord-bot) - PostgreSQL + Discord role management
- [StripeCord](https://github.com/Rodaviva29/StripeCord) - MongoDB variant with periodic validation
- [Stripe Express webhook example](https://github.com/stripe/stripe-node/blob/master/examples/webhook-signing/express/main.ts)

### Architecture Patterns (MEDIUM confidence)
- [Stripe Webhook Best Practices](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks)
- [Per-Seat Team Billing with Stripe](https://dev.to/anand_rathnas_d5b608cc3de/implementing-per-seat-team-billing-with-stripe-5fp5)
- [Architecting Discord Bot the Right Way](https://dev.to/itsnikhil/architecting-discord-bot-the-right-way-383e)
- [Discord.js Role Management](https://anidiots.guide/understanding/roles/)
