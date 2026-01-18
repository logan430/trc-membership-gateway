# Technology Stack

**Project:** The Revenue Council Membership Gateway
**Domain:** Stripe + Discord Membership System
**Researched:** 2026-01-18

## Stack Philosophy

This stack prioritizes:
1. **Durability over speed** - Membership data lives in Postgres, not just Stripe
2. **Type safety everywhere** - TypeScript + Zod + Prisma = caught bugs at compile time
3. **Proven over trendy** - Express over Hono because ecosystem maturity matters for payments
4. **Stripe as source of truth** - Sync from Stripe webhooks, don't fight the billing system

---

## Recommended Stack

### Runtime & Language

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | 20 LTS / 22 LTS | Runtime | LTS stability for payment handling; v20 supported until April 2026 | HIGH |
| TypeScript | ^5.9.3 | Type safety | Strict mode catches 90% of membership logic bugs before runtime | HIGH |

**Rationale:** Node 20 LTS is the safe choice for production payment systems. TypeScript strict mode is non-negotiable for Stripe integration - the SDK has excellent types that catch API misuse.

### Web Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Express | ^5.2.1 | HTTP server | Mature, Stripe examples use it, webhook signature verification is documented | HIGH |

**Why Express over alternatives:**

| Framework | RPS | Why NOT for this project |
|-----------|-----|--------------------------|
| Fastify | 30K+ | Faster, but Stripe docs/examples are Express-native. Raw body handling for webhooks is more documented in Express. |
| Hono | 25K+ | Edge-optimized; overkill for VM deployment. Less middleware ecosystem. |
| Express | 15K | "Slow" but this app handles <100 RPS. Webhook signature verification docs are Express-first. |

**Performance doesn't matter here.** A membership gateway handles checkout flows and webhook events - maybe 1000 events/day at peak. Express's ecosystem and Stripe documentation alignment are worth more than 2x raw throughput you'll never use.

### Database & ORM

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Supabase Postgres | - | Database | Free tier generous, connection pooling via Supavisor, managed backups | HIGH |
| Prisma | ^7.2.0 | ORM | Type-safe queries, migrations, excellent DX | HIGH |
| @prisma/client | ^7.2.0 | Query builder | Generated client with full TypeScript inference | HIGH |

**Critical Supabase + Prisma Setup:**

```
DATABASE_URL="postgresql://..."      # Supavisor pooled (port 6543)
DIRECT_URL="postgresql://..."        # Direct connection for migrations (port 5432)
```

From [Prisma + Supabase docs](https://www.prisma.io/docs/orm/overview/databases/supabase):
- Use pooled connection (`DATABASE_URL`) for runtime queries
- Use direct connection (`DIRECT_URL`) for `prisma migrate` commands
- Create a dedicated Prisma database user for security monitoring

### Payments

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| stripe | ^20.2.0 | Stripe SDK | Official Node SDK, excellent TypeScript types | HIGH |
| stripe-event-types | ^3.1.0 | Webhook types | Discriminated unions for webhook event handling | MEDIUM |

**Stripe Integration Pattern:**

```typescript
// Webhook signature verification - CRITICAL
app.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }), // Raw body required
  (req, res) => {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    // Process event...
  }
);
```

From [Stripe webhook docs](https://docs.stripe.com/webhooks):
- **Must use raw body** - parsed JSON breaks signature verification
- Return 200 quickly, process async - Stripe times out after 10 seconds
- Implement idempotency - Stripe retries on failure

### Discord Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| discord.js | ^14.25.1 | Discord bot | Official library, maintained, v14 is stable | HIGH |

**Required Bot Permissions:**
- `MANAGE_ROLES` - Add/remove member roles
- Gateway Intents: `Guilds`, `GuildMembers` (privileged - needs approval in portal)

**Role Management Pattern:**

```typescript
// From discord.js v14 docs
const member = await guild.members.fetch(discordUserId);
await member.roles.add(memberRoleId);  // Grant access
await member.roles.remove(memberRoleId); // Revoke on cancel
```

**Limitation:** Bot cannot manage roles higher than its own role in the hierarchy. Position your bot role high in Discord server settings.

### Authentication

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| jose | ^6.1.3 | JWT handling | Modern, maintained, supports all JWT algorithms | HIGH |

**Why jose over jsonwebtoken:**
- `jsonwebtoken` (9.0.3) works but `jose` is more actively maintained
- `jose` has better TypeScript types
- `jose` supports ESM natively

**Discord OAuth2 Flow:**
No Passport needed. Discord OAuth2 is simple enough to implement directly:

```typescript
// 1. Redirect to Discord
const authUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`;

// 2. Exchange code for token
const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
  method: 'POST',
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
  }),
});

// 3. Get user info
const userResponse = await fetch('https://discord.com/api/users/@me', {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

Scopes needed: `identify` (get user ID), `guilds` (verify server membership)

### Validation & Configuration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| zod | ^4.3.5 | Schema validation | Runtime type checking, great TypeScript inference | HIGH |
| dotenv | ^17.2.3 | Environment vars | Simple, works | HIGH |

**Validation Pattern:**

```typescript
import { z } from 'zod';

const EnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  DISCORD_CLIENT_ID: z.string(),
  DISCORD_CLIENT_SECRET: z.string(),
  DISCORD_BOT_TOKEN: z.string(),
  DATABASE_URL: z.string().url(),
});

export const env = EnvSchema.parse(process.env);
```

### Security

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| helmet | ^8.1.0 | Security headers | Standard Express security middleware | HIGH |
| cors | ^2.8.5 | CORS handling | Control cross-origin requests | HIGH |

### Logging

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| pino | ^10.2.0 | Structured logging | Fast, JSON output, good for production | HIGH |
| pino-pretty | ^13.1.3 | Dev formatting | Human-readable logs in development | HIGH |

**Why pino:** Stripe webhook debugging requires good logs. Pino's structured JSON is grep-able and integrates with log aggregators.

### Development Tools

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tsx | ^4.21.0 | Dev runner | Fast TypeScript execution, watch mode | HIGH |
| vitest | ^4.0.17 | Testing | Fast, Jest-compatible, native ESM | HIGH |
| @types/express | ^5.0.6 | Type definitions | Express TypeScript types | HIGH |
| @types/cors | latest | Type definitions | CORS TypeScript types | HIGH |

---

## What NOT to Use

| Technology | Why Avoid |
|------------|-----------|
| `passport-discord` | Abandoned, original author recommends alternatives |
| `jsonwebtoken` | Works but `jose` is more modern and maintained |
| `bcrypt` / `bcryptjs` | Not needed - Discord OAuth handles auth, Stripe handles payment identity |
| `@supabase/supabase-js` | Not needed if using Prisma - would create two database clients |
| Fastify | Overkill for this use case, less Stripe documentation |
| NestJS | Heavy framework overhead for a focused gateway service |
| `express-validator` | Use Zod instead - better TypeScript integration |
| Local session storage | Use JWT with short expiry - stateless is simpler |

---

## Installation Commands

```bash
# Core dependencies
npm install express stripe discord.js @prisma/client zod dotenv helmet cors pino jose

# Dev dependencies
npm install -D typescript tsx vitest prisma @types/express @types/cors @types/node pino-pretty stripe-event-types

# Initialize Prisma
npx prisma init

# Initialize TypeScript
npx tsc --init
```

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "dev:bot": "tsx watch src/bot/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "stripe:listen": "stripe listen --forward-to localhost:3000/webhooks/stripe",
    "test": "vitest"
  }
}
```

---

## Architecture Notes

### Process Separation

Run as two processes:
1. **API Server** (Express) - Handles Stripe webhooks, OAuth flows, API endpoints
2. **Discord Bot** (discord.js) - Handles role management, responds to commands

**Why separate:** Discord.js maintains a WebSocket connection. Express handles HTTP. Mixing them creates unnecessary coupling. In production, scale independently.

### Data Flow

```
Stripe Webhook → API Server → Prisma → Supabase Postgres
                     ↓
              Discord Bot (via queue/direct call)
                     ↓
              Discord API (role add/remove)
```

### Local Development

```bash
# Terminal 1: API server
npm run dev

# Terminal 2: Discord bot
npm run dev:bot

# Terminal 3: Stripe webhook forwarding
npm run stripe:listen
```

Use Stripe CLI (`stripe listen`) to forward webhook events to localhost during development.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Node.js + TypeScript | HIGH | Verified current LTS and latest TypeScript versions |
| Express | HIGH | Stripe documentation is Express-native |
| Stripe SDK | HIGH | Version 20.2.0 verified via npm, excellent TypeScript support |
| discord.js | HIGH | Version 14.25.1 verified, v14 is stable release line |
| Prisma + Supabase | HIGH | Official documentation covers this exact pattern |
| Zod | HIGH | De facto standard for TypeScript validation |
| jose | MEDIUM | Preferred over jsonwebtoken but either works |
| stripe-event-types | MEDIUM | Helpful but optional - native Stripe types work |

---

## Sources

### Official Documentation (HIGH confidence)
- [Stripe Webhooks Documentation](https://docs.stripe.com/webhooks)
- [Stripe Webhook Quickstart (Node)](https://docs.stripe.com/webhooks/quickstart?lang=node)
- [Discord.js Role Management](https://discord.js.org/docs/packages/discord.js/14.18.0/RoleManager:Class)
- [Prisma + Supabase Setup](https://www.prisma.io/docs/orm/overview/databases/supabase)
- [Supabase Prisma Guide](https://supabase.com/docs/guides/database/prisma)

### Framework Comparisons (MEDIUM confidence)
- [Hono vs Express vs Fastify 2025 Guide](https://levelup.gitconnected.com/hono-vs-express-vs-fastify-the-2025-architecture-guide-for-next-js-5a13f6e12766)
- [Beyond Express: Fastify vs Hono](https://dev.to/alex_aslam/beyond-express-fastify-vs-hono-which-wins-for-high-throughput-apis-373i)

### Version Information (HIGH confidence)
- All package versions verified via `npm view [package] version` on 2026-01-18
