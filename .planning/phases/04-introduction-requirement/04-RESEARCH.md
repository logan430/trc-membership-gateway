# Phase 4: Introduction Requirement - Research

**Researched:** 2026-01-18
**Domain:** discord.js message events, Stripe subscription lifecycle webhooks, role management
**Confidence:** HIGH (official documentation verified, existing codebase patterns established)

## Summary

Phase 4 requires three distinct capabilities: detecting introduction messages in a specific channel, promoting users to full-access roles after valid introduction, and removing roles/kicking users when subscriptions end. The implementation uses discord.js v14.25.1 (already installed) with the `messageCreate` and `messageUpdate` events, existing role management utilities (src/bot/roles.ts), and Stripe webhook handling (src/webhooks/stripe.ts).

Key insight: The MessageContent privileged intent is REQUIRED to read message content. This must be enabled in both the Discord Developer Portal AND in the bot client intents. Without it, `message.content` will always be an empty string. The bot already has GuildMembers privileged intent enabled; MessageContent must be added.

For subscription cancellation, the `customer.subscription.deleted` webhook event fires when the subscription actually ends (at period end if `cancel_at_period_end` was set), not when the user initiates cancellation. This matches CONTEXT.md requirement: "Roles removed at subscription period end (not immediately on cancel)."

**Primary recommendation:** Add MessageContent intent and GuildMessages intent to the existing bot client, implement message handlers for both messageCreate and messageUpdate events, use the existing p-retry pattern for role operations, and handle customer.subscription.deleted webhook for end-of-subscription cleanup.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| discord.js | ^14.25.1 | Message events, reactions, DMs | Already installed, handles rate limiting |
| p-retry | ^7.1.1 | Exponential backoff retries | Already used in role-assignment.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Prisma | ^7.2.0 | Track intro status, rate-limit DM timestamps | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rate-limiter-flexible | Simple timestamp check | Overkill for once-per-user-per-day DM |
| discord.js-rate-limiter | Manual tracking | Adding dependency for simple use case |

**Installation:**
```bash
# No new dependencies - all already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  bot/
    client.ts             # Add MessageContent + GuildMessages intents
    roles.ts              # Add removeAllManagedRoles, existing add/remove work
    events/
      introduction.ts     # NEW: messageCreate/messageUpdate handlers
  webhooks/
    stripe.ts             # Add customer.subscription.deleted handler
  lib/
    role-assignment.ts    # Extend with async role swap pattern
```

### Pattern 1: Message Event Handler with Channel Filter
**What:** Listen for messages only in #introductions channel
**When to use:** Introduction detection (ONB-04)
**Example:**
```typescript
// Source: discord.js v14 documentation, discord.js guide
import { Events, Message, MessageType, GatewayIntentBits, ChannelType } from 'discord.js';

// Required intents (add to existing client.ts)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,      // Already have - privileged
    GatewayIntentBits.GuildMessages,     // NEW - for messageCreate
    GatewayIntentBits.MessageContent,    // NEW - privileged, for content access
  ],
});

// Event handler
client.on(Events.MessageCreate, async (message: Message) => {
  // Ignore bots
  if (message.author.bot) return;

  // Check if message is in #introductions channel
  if (message.channel.id !== env.DISCORD_INTRODUCTIONS_CHANNEL_ID) return;

  // Check if message is a reply (not a top-level intro)
  // Per CONTEXT.md: "Top-level messages only - replies to others don't count"
  if (message.type === MessageType.Reply) return;

  // Process introduction
  await handleIntroduction(message);
});

// Also listen for edits
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  // newMessage could be partial, need to fetch if needed
  if (!newMessage.content) {
    try {
      newMessage = await newMessage.fetch();
    } catch {
      return; // Message deleted or unavailable
    }
  }

  // Same checks as messageCreate
  if (newMessage.author?.bot) return;
  if (newMessage.channel.id !== env.DISCORD_INTRODUCTIONS_CHANNEL_ID) return;
  if (newMessage.type === MessageType.Reply) return;

  await handleIntroduction(newMessage);
});
```

### Pattern 2: Introduction Validation with DM Feedback
**What:** Check intro length, react/DM based on validity
**When to use:** After receiving message in #introductions
**Example:**
```typescript
// Source: discord.js documentation, CONTEXT.md requirements
const MIN_INTRO_LENGTH = 100;

async function handleIntroduction(message: Message): Promise<void> {
  // Get text content only (images don't count per CONTEXT.md discretion)
  const textLength = message.content.length;

  // Lookup member in database
  const member = await prisma.member.findUnique({
    where: { discordId: message.author.id },
  });

  // User not in our system or already introduced
  if (!member || member.introCompleted) return;

  // Check if user has Squire role (paid but unintroduced)
  const guildMember = message.member;
  if (!guildMember) return;

  const hasSquireRole = guildMember.roles.cache.some(
    r => r.name === ROLE_CONFIG.SQUIRE.name
  );
  if (!hasSquireRole) return;

  // Validate length
  if (textLength < MIN_INTRO_LENGTH) {
    await sendTooShortGuidance(member, message.author);
    return;
  }

  // Valid intro - react and promote
  await message.react('tada'); // Per CONTEXT.md
  await promoteAfterIntro(member, guildMember);
}
```

### Pattern 3: Role Swap with Retry
**What:** Remove Squire, add Member/Owner atomically with retry
**When to use:** After valid introduction
**Example:**
```typescript
// Source: Existing role-assignment.ts pattern
import pRetry from 'p-retry';

async function promoteAfterIntro(
  member: Member,
  guildMember: GuildMember
): Promise<void> {
  // Determine target role based on seat tier
  const targetRole = member.seatTier === 'OWNER'
    ? ROLE_CONFIG.LORD.name
    : ROLE_CONFIG.KNIGHT.name;

  // Use p-retry for reliability
  await pRetry(
    async () => {
      // Remove Squire role
      const squireRole = guildMember.guild.roles.cache.find(
        r => r.name === ROLE_CONFIG.SQUIRE.name
      );
      if (squireRole) {
        await guildMember.roles.remove(squireRole, 'Introduction completed');
      }

      // Add target role
      const newRole = guildMember.guild.roles.cache.find(
        r => r.name === targetRole
      );
      if (newRole) {
        await guildMember.roles.add(newRole, 'Introduction completed');
      }
    },
    {
      retries: 5,
      minTimeout: 1000,
      maxTimeout: 30000,
      onFailedAttempt: (error) => {
        logger.warn(
          { discordId: guildMember.id, attempt: error.attemptNumber },
          'Role swap retry'
        );
      },
    }
  );

  // Update database
  await prisma.member.update({
    where: { id: member.id },
    data: {
      introCompleted: true,
      introCompletedAt: new Date(),
      introMessageId: message.id,
    },
  });

  // Send welcome DM
  await sendWelcomeDM(guildMember.user, targetRole);
}
```

### Pattern 4: Rate-Limited DM for "Too Short" Guidance
**What:** DM user about intro requirements, max once per day
**When to use:** When intro message doesn't meet length requirement
**Example:**
```typescript
// Source: Best practices, CONTEXT.md suggestion
async function sendTooShortGuidance(
  member: Member,
  user: User
): Promise<void> {
  // Rate limit: once per user per day
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Check last guidance DM time (store in Member model)
  if (member.lastGuidanceDmAt && member.lastGuidanceDmAt > oneDayAgo) {
    logger.debug({ discordId: user.id }, 'Skipping guidance DM - rate limited');
    return;
  }

  try {
    await user.send({
      content: `Greetings, traveler! The Council requires a full introduction before you may enter.\n\n` +
        `We wish to know what draws you to our guild - your background, interests, and what you hope to find here.\n\n` +
        `Your introduction must be at least ${MIN_INTRO_LENGTH} characters. Take your time to craft something meaningful!`,
    });

    // Update rate limit timestamp
    await prisma.member.update({
      where: { id: member.id },
      data: { lastGuidanceDmAt: new Date() },
    });
  } catch (error) {
    // User may have DMs disabled - best effort, don't throw
    logger.debug({ discordId: user.id, error }, 'Failed to send guidance DM');
  }
}
```

### Pattern 5: Subscription End Handler with Kick
**What:** Remove roles and kick user when subscription ends
**When to use:** customer.subscription.deleted webhook
**Example:**
```typescript
// Source: Stripe documentation, existing stripe.ts pattern
// In src/webhooks/stripe.ts processStripeEvent()

case 'customer.subscription.deleted': {
  const subscription = event.data.object as Stripe.Subscription;

  // Find member by Stripe customer ID
  const member = await prisma.member.findFirst({
    where: { stripeCustomerId: subscription.customer as string },
  });

  if (!member || !member.discordId) {
    logger.warn({ customerId: subscription.customer }, 'No member found for deleted subscription');
    break;
  }

  // Remove roles and kick (async with retry)
  removeAndKickAsync(member.discordId, member.id);

  // Update database
  await prisma.member.update({
    where: { id: member.id },
    data: {
      subscriptionStatus: 'CANCELLED',
      introCompleted: false,  // Reset for potential future resub
    },
  });

  logger.info({ memberId: member.id }, 'Subscription ended, user will be kicked');
  break;
}
```

### Pattern 6: Farewell DM + Kick with Best-Effort
**What:** Send farewell DM then kick, don't fail if DM blocked
**When to use:** After subscription deletion webhook
**Example:**
```typescript
// Source: CONTEXT.md requirements, discord.js documentation
import pRetry from 'p-retry';

async function removeAndKickAsync(discordId: string, memberId: string): Promise<void> {
  const guild = discordClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) return;

  try {
    const member = await guild.members.fetch(discordId);

    // Send farewell DM first (best effort)
    try {
      await member.user.send({
        content: `Hail, valued member of The Revenue Council!\n\n` +
          `Your time with our guild has come to an end, but you shall always be remembered.\n\n` +
          `Should you wish to return to our halls, The Gatekeeper awaits: ${env.APP_URL}\n\n` +
          `Fare thee well on your journey!`,
      });
    } catch {
      logger.debug({ discordId }, 'Could not send farewell DM');
    }

    // Remove all managed roles
    const managedRoles = member.roles.cache.filter(
      r => MANAGED_ROLES.includes(r.name)
    );
    await member.roles.remove(managedRoles, 'Subscription ended');

    // Kick from server
    await pRetry(
      () => member.kick('Subscription ended'),
      {
        retries: 3,
        minTimeout: 1000,
        onFailedAttempt: (error) => {
          logger.warn({ discordId, attempt: error.attemptNumber }, 'Kick retry');
        },
      }
    );

    logger.info({ discordId }, 'Member removed from server');
  } catch (error) {
    logger.error({ discordId, error }, 'Failed to remove and kick member');
    await alertAdmin(`Failed to remove member ${discordId}: ${error}`);
  }
}
```

### Anti-Patterns to Avoid
- **Not checking message.type for replies:** Replies to other messages would count as intros
- **Processing bot messages:** Can cause infinite loops
- **Sending DMs on every short message:** Rate-limit DMs to prevent spam
- **Immediate role removal on cancel:** Wait for subscription period to actually end
- **Throwing on DM failure:** User may have DMs disabled, always catch

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message event handling | Raw gateway | discord.js Events | Reconnection, rate limiting, caching |
| Retry logic | setTimeout loops | p-retry | Exponential backoff, error handling |
| Role operations | Raw API calls | Existing roles.ts | Unified error handling, admin alerts |
| Unicode emoji reactions | Raw codepoint | String literal | Discord handles encoding |

**Key insight:** The existing codebase already has the role management and retry patterns. This phase adds message event handling and Stripe webhook extension, not new infrastructure.

## Common Pitfalls

### Pitfall 1: MessageContent Intent Not Enabled
**What goes wrong:** `message.content` is always empty string
**Why it happens:** MessageContent is a privileged intent requiring explicit enable
**How to avoid:**
1. Enable "Message Content Intent" in Discord Developer Portal > Bot > Privileged Gateway Intents
2. Add `GatewayIntentBits.MessageContent` to client intents array
**Warning signs:** Introduction detection never triggers despite valid messages

### Pitfall 2: Not Filtering Bot Messages
**What goes wrong:** Bot reacts to its own messages or other bots, infinite loops
**Why it happens:** messageCreate fires for ALL messages
**How to avoid:** Always check `message.author.bot` first
**Warning signs:** Bot spamming reactions, high API usage

### Pitfall 3: Reply Messages Counting as Introductions
**What goes wrong:** Someone replies to another intro and gets promoted
**Why it happens:** Not checking message type
**How to avoid:** Check `message.type !== MessageType.Reply`
**Warning signs:** Users promoted without actual intro

### Pitfall 4: DM Spam on Short Messages
**What goes wrong:** User gets bombarded with DMs every time they type
**Why it happens:** No rate limiting on guidance DMs
**How to avoid:** Track lastGuidanceDmAt, only send once per 24h
**Warning signs:** User complaints, possible Discord ToS violation

### Pitfall 5: Kicking Before Farewell DM
**What goes wrong:** User never receives farewell message
**Why it happens:** Kick removes access to receive DM from guild members
**How to avoid:** Send DM first, then kick (with try/catch for DM)
**Warning signs:** No farewell DMs received by kicked users

### Pitfall 6: Using customer.subscription.updated Instead of deleted
**What goes wrong:** User kicked immediately on cancel instead of period end
**Why it happens:** Confusion between cancel_at_period_end setting and actual end
**How to avoid:**
- `customer.subscription.updated` fires when cancel_at_period_end is SET
- `customer.subscription.deleted` fires when subscription ACTUALLY ENDS
- Use deleted for kicking per CONTEXT.md
**Warning signs:** Paid users losing access before their period ends

### Pitfall 7: Not Handling messageUpdate for Edits
**What goes wrong:** User edits short intro to valid length, never promoted
**Why it happens:** Only listening to messageCreate
**How to avoid:** Also listen to messageUpdate and process the same way
**Warning signs:** User reports editing their intro but not getting promoted

### Pitfall 8: Partial Messages in messageUpdate
**What goes wrong:** Crash or undefined access when handling edit
**Why it happens:** Old message or new message might be partial (not cached)
**How to avoid:** Check for content, fetch() if needed, catch errors
**Warning signs:** Unhandled promise rejections in messageUpdate handler

## Code Examples

Verified patterns from official sources:

### Complete Introduction Handler Setup
```typescript
// Source: discord.js documentation, verified patterns
// src/bot/events/introduction.ts

import { Events, Message, MessageType, GuildMember, User } from 'discord.js';
import { discordClient } from '../client.js';
import { ROLE_CONFIG, MANAGED_ROLES } from '../../config/discord.js';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../index.js';
import pRetry from 'p-retry';

const MIN_INTRO_LENGTH = 100;

export function setupIntroductionHandlers(): void {
  discordClient.on(Events.MessageCreate, handleMessage);
  discordClient.on(Events.MessageUpdate, handleMessageUpdate);
  logger.info('Introduction handlers registered');
}

async function handleMessage(message: Message): Promise<void> {
  if (!shouldProcess(message)) return;
  await processIntroduction(message);
}

async function handleMessageUpdate(
  _oldMessage: Message,
  newMessage: Message
): Promise<void> {
  // Fetch full message if partial
  if (newMessage.partial) {
    try {
      newMessage = await newMessage.fetch();
    } catch {
      return;
    }
  }
  if (!shouldProcess(newMessage)) return;
  await processIntroduction(newMessage);
}

function shouldProcess(message: Message): boolean {
  if (message.author.bot) return false;
  if (message.channel.id !== env.DISCORD_INTRODUCTIONS_CHANNEL_ID) return false;
  if (message.type === MessageType.Reply) return false;
  return true;
}
```

### Welcome DM with Medieval Theme
```typescript
// Source: CONTEXT.md requirements
async function sendWelcomeDM(user: User, roleName: string): Promise<void> {
  const guildTitle = roleName === ROLE_CONFIG.LORD.name ? 'Lord' : 'Knight';

  try {
    await user.send({
      content:
        `Hail, ${guildTitle} ${user.displayName}!\n\n` +
        `You have been formally admitted to The Revenue Council guild. ` +
        `The halls of knowledge and fellowship now open before you.\n\n` +
        `Please review our community guidelines: ${env.APP_URL}/guidelines\n\n` +
        `Welcome to the Council!`,
    });
  } catch {
    logger.debug({ discordId: user.id }, 'Could not send welcome DM');
  }
}
```

### Updated Client Intents
```typescript
// Source: discord.js documentation
// Updated src/bot/client.ts

import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,      // Privileged - already enabled
    GatewayIntentBits.GuildMessages,     // NEW - for messageCreate
    GatewayIntentBits.MessageContent,    // NEW - privileged, for content
  ],
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| message event | Events.MessageCreate | discord.js v14 | Use enum constant, not string |
| channel.type === 'text' | ChannelType.GuildText enum | discord.js v14 | Type-safe channel checks |
| member.hasPermission() | member.permissions.has() | discord.js v14 | Method renamed |
| SCREAMING_CASE intents | PascalCase GatewayIntentBits | discord.js v14 | Enum naming convention |

**Deprecated/outdated:**
- String-based events like `'message'` - use Events enum
- Legacy intent flags - use GatewayIntentBits enum
- customer.subscription.updated for end-of-subscription - use deleted event

## Open Questions

Things that couldn't be fully resolved:

1. **Channel ID Configuration**
   - What we know: Need #introductions channel ID
   - What's unclear: Where to configure (env var vs database)
   - Recommendation: Add DISCORD_INTRODUCTIONS_CHANNEL_ID to env.ts schema

2. **Community Guidelines URL**
   - What we know: Welcome DM should include guidelines link
   - What's unclear: Whether this page exists yet
   - Recommendation: Use placeholder ${APP_URL}/guidelines, implement page later

3. **Image-Only Messages**
   - What we know: CONTEXT.md suggests "images don't count" for length
   - What's unclear: Should image-only messages trigger guidance DM?
   - Recommendation: Yes, treat as zero-length text, send guidance if no text

## Sources

### Primary (HIGH confidence)
- [discord.js v14 documentation](https://discord.js.org/docs/packages/discord.js/14.25.1) - Events, Message class, GuildMember class
- [discord.js guide - Message Content Intent](https://discordjs.guide/) - Privileged intents, messageCreate setup
- [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) - customer.subscription.deleted event
- [Stripe cancel subscriptions](https://docs.stripe.com/billing/subscriptions/cancel) - cancel_at_period_end behavior

### Secondary (MEDIUM confidence)
- [Discord Developer FAQ - Message Content Intent](https://support-dev.discord.com/hc/en-us/articles/4404772028055) - Verification requirements
- [GuildMember.kick() API](https://discord.js.org/docs/packages/discord.js/14.25.0/GuildMember:Class) - Kick method signature

### Tertiary (LOW confidence)
- WebSearch patterns for DM rate limiting - common practice, not official

## Metadata

**Confidence breakdown:**
- Message event handling: HIGH - official discord.js documentation
- Introduction validation: HIGH - simple text length check, CONTEXT.md specs
- Role promotion: HIGH - extends existing patterns in codebase
- Stripe webhook: HIGH - official Stripe documentation verified
- DM rate limiting: MEDIUM - best practice, implementation is standard

**Research date:** 2026-01-18
**Valid until:** 2026-02-18 (30 days - stable domain)
