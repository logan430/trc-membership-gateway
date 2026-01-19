---
phase: 02
plan: 02
subsystem: discord-bot
tags: [discord.js, role-management, bot]

dependency-graph:
  requires: [01-01, 01-02, 01-03]
  provides: [discord-bot, role-management, admin-alerts]
  affects: [02-03, 03-01, 04-01]

tech-stack:
  added: [discord.js@14.25.1]
  patterns: [event-driven-bot, privileged-intents, role-hierarchy]

key-files:
  created:
    - src/bot/client.ts
    - src/bot/roles.ts
    - src/config/discord.ts
  modified:
    - src/config/env.ts
    - src/index.ts
    - package.json

decisions:
  - id: discord-bot-intents
    choice: "GatewayIntentBits.Guilds + GatewayIntentBits.GuildMembers"
    rationale: "GuildMembers is privileged but required for member.fetch() and role operations"
  - id: role-theme
    choice: "Medieval/Council theme: Squire, Knight, Lord, Debtor"
    rationale: "Per CONTEXT.md - matches 'The Revenue Council' branding"
  - id: admin-alerts
    choice: "Alert via admin channel (if configured) or guild owner DM"
    rationale: "Best-effort alerting - never throw on alert failure"
  - id: bot-presence
    choice: "Custom activity: 'Managing memberships'"
    rationale: "Per RESEARCH.md - indicates bot is online and functional"

metrics:
  duration: 5 min
  completed: 2026-01-18
---

# Phase 2 Plan 2: Discord Bot with Role Management Summary

**One-liner:** discord.js v14 bot with medieval-themed roles (Squire/Knight/Lord/Debtor) that auto-syncs on startup and provides add/remove role functions with admin alerting.

## What Was Built

### 1. Discord Configuration (src/config/discord.ts)
- Medieval/Council-themed role definitions per CONTEXT.md
- Squire (gray) - Paid but unintroduced
- Knight (blue) - Active introduced member
- Lord (gold) - Company owner
- Debtor (red) - Billing issue
- MANAGED_ROLES array for iteration
- RoleKey type for type-safe role references

### 2. Discord Bot Client (src/bot/client.ts)
- discord.js Client with Guilds and GuildMembers intents
- GuildMembers is a privileged intent (requires Developer Portal config)
- ClientReady event handler:
  - Logs bot tag on successful login
  - Verifies bot is in configured guild
  - Calls syncRoles() to create missing roles
  - Sets presence: "Managing memberships"
- Error event handler for client errors
- startBot() exported for server startup integration

### 3. Role Management (src/bot/roles.ts)
- alertAdmin(message): Best-effort admin notification
  - Tries DISCORD_ADMIN_CHANNEL_ID first
  - Falls back to guild owner DM
  - Never throws (best-effort)
- syncRoles(guild): Creates missing managed roles on startup
  - Skips existing roles
  - Uses ROLE_CONFIG colors and descriptions
  - Alerts admin on creation failures
- addRoleToMember(discordId, roleName): Assigns role to member
  - Fetches member by Discord ID
  - Finds role by name
  - Returns boolean success
  - Alerts admin on failure
- removeRoleFromMember(discordId, roleName): Removes role from member
  - Same pattern as addRoleToMember

### 4. Server Integration (src/index.ts)
- Import startBot from bot/client.js
- Call startBot() in app.listen callback
- Error handling with logger

### 5. Environment Configuration (src/config/env.ts)
- DISCORD_CLIENT_ID: Now required (was optional)
- DISCORD_CLIENT_SECRET: Now required (was optional)
- DISCORD_BOT_TOKEN: Now required (was optional)
- DISCORD_GUILD_ID: Now required (was optional)
- DISCORD_ADMIN_CHANNEL_ID: New optional config for admin alerts

## Deviations from Plan

None - plan executed exactly as written.

## What Works Now

1. **Bot starts on server startup** - HTTP server starts, then bot connects
2. **Role sync on ready** - Missing roles auto-created with correct colors
3. **Role operations** - addRoleToMember and removeRoleFromMember ready for Phase 3+
4. **Admin alerting** - Role failures notify admin via channel or DM
5. **Type safety** - RoleKey type, proper discord.js types throughout

## What Does NOT Work Yet

1. **Bot won't connect without valid credentials** - Expected, requires user setup
2. **Role operations not integrated with subscription flow** - Phase 3+ work
3. **No slash commands** - Not in scope for this plan

## User Setup Required

Before running the bot, users must:

1. **Create Discord Application** (Discord Developer Portal)
2. **Create Bot** and get DISCORD_BOT_TOKEN
3. **Get Application ID** for DISCORD_CLIENT_ID
4. **Get Client Secret** for DISCORD_CLIENT_SECRET
5. **Enable Server Members Intent** (Privileged Gateway Intents)
6. **Invite bot to server** with Manage Roles permission
7. **Get Guild ID** for DISCORD_GUILD_ID
8. **(Optional)** Create admin channel and set DISCORD_ADMIN_CHANNEL_ID

## Testing Checklist

- [ ] Configure Discord env vars in .env
- [ ] Enable Server Members Intent in Developer Portal
- [ ] Invite bot to test server
- [ ] Run `npm run dev`
- [ ] Verify bot shows online with "Managing memberships" status
- [ ] Verify roles are created (Squire, Knight, Lord, Debtor)
- [ ] Test addRoleToMember via REPL or test endpoint

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 138db50 | feat | Install discord.js and create Discord config |
| 2665425 | feat | Create Discord bot client and role management |

## Next Phase Readiness

Ready for:
- **02-03** (OAuth routes) - Bot is running, role functions available
- **03-01** (Subscription flow) - Can assign roles on claim completion
- **04-01** (Billing webhooks) - Can update roles on payment status changes

No blockers for subsequent plans.
