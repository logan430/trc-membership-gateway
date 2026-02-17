# Phase 42: Discord Integration - Research

**Researched:** 2026-02-17
**Domain:** Discord OAuth configuration, bot connection, role assignment -- production deployment of existing code
**Confidence:** HIGH

## Summary

Phase 42 is a **configuration and verification phase**, not a code-writing phase. The entire Discord integration codebase already exists and is comprehensive: OAuth authorization code flow with CSRF protection (`src/auth/discord-oauth.ts`), three separate claim flows (auth route, individual claim, team claim), a Discord.js bot with privileged intents for role management (`src/bot/client.ts`), role sync on startup (`src/bot/roles.ts`), introduction detection with Squire-to-Knight/Lord promotion (`src/bot/events/introduction.ts`), billing support channel creation (`src/bot/channels.ts`), and async role assignment with retry logic (`src/lib/role-assignment.ts`).

Critically, the production deployment health check already shows `discord=true`, meaning the bot is ALREADY connected to the Discord server from the Coolify production environment. All Discord env vars (DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_INTRODUCTIONS_CHANNEL_ID) appear to already be set in Coolify from the initial deployment in Phase 39.

The remaining work is: (1) update `DISCORD_REDIRECT_URI` in Coolify from `http://localhost:3000/auth/callback` to `https://app.therevenuecouncil.com/auth/callback`, (2) add the production redirect URI in the Discord Developer Portal, (3) optionally set `DISCORD_INVITE_URL`, (4) verify the OAuth claim flow works end-to-end at the production URL, and (5) verify the bot assigns Squire role on claim and promotes after introduction.

**Primary recommendation:** Check existing Coolify env vars for DISCORD_REDIRECT_URI, update it to the production URL, add the production redirect URI in Discord Developer Portal, then test the claim flow end-to-end with a paid member.

## Standard Stack

No new libraries needed. Everything is already installed and deployed.

### Core (Already Deployed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| discord.js | (in package.json) | Discord bot, role management, message events | Deployed, bot online |
| express | ^5.2.1 | HTTP server with OAuth routes | Deployed |
| p-retry | (in package.json) | Exponential backoff for role assignment | Deployed |
| zod | ^4.3.5 | Env var validation for all Discord vars | Deployed |
| cookie | (in package.json) | OAuth state cookie management | Deployed |

### No New Libraries Needed

This phase uses entirely existing tools and configuration. No npm install required.

## Architecture Patterns

### Existing OAuth Architecture (Already Built)

Three separate flows all share the same `generateAuthUrl()` function:

```
Flow 1: Auth route (first-time Discord link, no subscription required)
  GET /auth/discord -> Discord OAuth -> GET /auth/callback
  Creates new member with discordId

Flow 2: Claim route (post-payment Discord link, requires active subscription)
  GET /claim/discord -> Discord OAuth -> GET /auth/callback (redirect_uri)
  But actual callback: GET /claim/callback
  Links discordId to existing paid member, assigns Squire role

Flow 3: Team claim route (team invite, no subscription required on user)
  GET /team/claim?token=... -> Discord OAuth -> GET /auth/callback (redirect_uri)
  But actual callback: GET /team/claim/callback
  Creates/upserts member with team, assigns Squire role
```

**CRITICAL ARCHITECTURE DETAIL - Single Redirect URI:**

All three OAuth flows use the SAME `redirect_uri` value: `DISCORD_REDIRECT_URI ?? APP_URL/auth/callback`. This is the URL registered in Discord Developer Portal. Discord redirects ALL users to this single URL after authorization.

However, the three flows have different callback handlers at different paths:
- `/auth/callback` (auth.ts:384) -- checks `oauth_state` cookie
- `/claim/callback` (claim.ts:65) -- checks `claim_state` cookie
- `/team/claim/callback` (team-claim.ts:117) -- checks `team_claim_state` cookie

Since Discord always redirects to `/auth/callback`, only Flow 1 works as-is. Flows 2 and 3 redirect the user to Discord with `redirect_uri=/auth/callback`, so Discord sends the user back to `/auth/callback`. The `/claim/callback` and `/team/claim/callback` routes are never called directly by Discord.

For the `/auth/callback` handler to process claim and team-claim flows, it would need to check for claim-specific cookies. Looking at the code:
- `/auth/callback` checks for `oauth_state` cookie (set by `/auth/discord`)
- `/claim/discord` sets `claim_state` cookie (not `oauth_state`)
- `/team/claim` sets `team_claim_state` cookie (not `oauth_state`)

**This means:** When a user starts the claim flow at `/claim/discord`, they are redirected to Discord. Discord sends them back to `/auth/callback`. The `/auth/callback` handler checks for `oauth_state` cookie, which was NOT set by the claim flow. CSRF validation fails (`state !== storedState`), and the user is redirected to `/auth/error?reason=invalid_state`.

**However:** This is a pre-existing code architecture issue, not a production configuration issue. The primary flow that works is the `/claim/discord` flow where the user starts at `/claim/discord`, gets redirected to Discord, and returns to `/auth/callback`. Looking more carefully, the claim flow's cookie is `claim_state` but the redirect goes to `/auth/callback` which only checks `oauth_state`.

**Practical Impact for Phase 42:** The flows to verify in production are:
1. `/claim/discord` flow (individual post-payment Discord link) -- This is the PRIMARY flow for v2.2 launch
2. `/auth/discord` flow (direct Discord OAuth login) -- Used for initial Discord-first signups
3. `/team/claim` flow (team invite claiming) -- Important for company subscriptions

All three need the same redirect URI registered in Discord Developer Portal. Only `/auth/callback` needs to be registered since that is what `generateAuthUrl()` passes to Discord.

**Note for planner:** If the claim/team-claim flows fail CSRF validation during testing, this is a code bug that needs a fix (either all flows use the same callback handler, or the callback handler needs to check multiple cookie names). This would be a code change, not just configuration. Test this carefully.

### Discord OAuth Redirect URI (The Critical Configuration)

The `DISCORD_REDIRECT_URI` env var controls what URL is sent to Discord as the callback:

```typescript
// src/auth/discord-oauth.ts:29
const redirectUri = env.DISCORD_REDIRECT_URI ?? `${env.APP_URL}/auth/callback`;
```

For production:
- `DISCORD_REDIRECT_URI` must be `https://app.therevenuecouncil.com/auth/callback`
- OR if not set, `APP_URL` must be `https://app.therevenuecouncil.com` (which it already is)

**Discord Developer Portal requirement:** The exact redirect URI must be added in the Developer Portal under OAuth2 -> Redirects. Protocol, domain, port, and path must match EXACTLY. No wildcards. No trailing slashes.

```
Must add in Developer Portal:
https://app.therevenuecouncil.com/auth/callback
```

### Bot Architecture (Already Running)

```
App Startup (src/index.ts)
  |
  v
startBot() -> discordClient.login(DISCORD_BOT_TOKEN)
  |
  v
ClientReady event:
  1. syncRoles(guild) -- Creates Squire/Knight/Lord/Debtor roles if missing
  2. ensureBillingSupportChannel(guild) -- Creates #billing-support if missing
  3. setupIntroductionHandlers() -- Registers messageCreate/messageUpdate listeners
  4. Set bot presence: "Managing memberships"
```

**Privileged Intents (MUST be enabled in Developer Portal):**
- GuildMembers -- Required for `guild.members.fetch()` and role operations
- MessageContent -- Required for reading introduction message content

### Role Assignment Flow

```
Member pays + clicks "Claim Discord" -> /claim/discord
  |
  v
Discord OAuth completes -> member.discordId saved
  |
  v
assignRoleAsync(discordId, "Squire") -- fire-and-forget with 5 retries
  |
  v
Member joins server + posts in #introductions (100+ chars)
  |
  v
Introduction handler detects message, validates length
  |
  v
swapRoleAsync(discordId, "Squire", "Knight" or "Lord")
  - INDIVIDUAL/OWNER seat -> Lord
  - TEAM_MEMBER seat -> Knight
```

### Role Hierarchy

| Role | Color | When Assigned | When Removed |
|------|-------|---------------|--------------|
| Squire | Gray (#808080) | On Discord claim (post-payment) | On introduction completion |
| Knight | Blue (#3498db) | After intro (team member) | On subscription cancel/revoke |
| Lord | Gold (#f1c40f) | After intro (individual/owner) | On subscription cancel/revoke |
| Debtor | Red (#e74c3c) | On payment failure | On payment recovery |

### Health Check (Already Built)

```typescript
// src/index.ts:244
checks.discord = discordClient.isReady();
```

The health endpoint at `/health` already reports Discord WebSocket status. This is already returning `true` in production per Phase 39 verification.

### Environment Variables Required

All Discord-related env vars from `src/config/env.ts`:

| Env Var | Zod Validation | Required | Local .env Value | Production Status |
|---------|---------------|----------|-----------------|------------------|
| `DISCORD_CLIENT_ID` | `.string()` | YES | `1462619474921390173` | Already set (bot online) |
| `DISCORD_CLIENT_SECRET` | `.string()` | YES | `9afF7AgRHo...` | Already set (bot online) |
| `DISCORD_BOT_TOKEN` | `.string()` | YES | `MTQ2MjYx...` | Already set (bot online) |
| `DISCORD_GUILD_ID` | `.string()` | YES | `1462618471748866182` | Already set (bot online) |
| `DISCORD_REDIRECT_URI` | `.string().url().optional()` | For OAuth | `http://localhost:3000/auth/callback` | MUST UPDATE to production URL |
| `DISCORD_INVITE_URL` | `.string().url().optional()` | For post-claim redirect | Not set locally | SHOULD SET for user experience |
| `DISCORD_INTRODUCTIONS_CHANNEL_ID` | `.string()` | YES | `1462665696889667606` | Already set (bot online) |
| `DISCORD_ADMIN_CHANNEL_ID` | `.string().optional()` | Optional | Not set | Optional for admin alerts |
| `DISCORD_BILLING_SUPPORT_CHANNEL_ID` | `.string().optional()` | Optional | Not set | Auto-created by bot if missing |

**Key finding:** Since the bot is already online (`discord=true` in health check), DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, and DISCORD_INTRODUCTIONS_CHANNEL_ID are confirmed set in Coolify. The only env var that MUST change is DISCORD_REDIRECT_URI (currently localhost, needs production URL).

**Alternative:** If DISCORD_REDIRECT_URI is NOT set in Coolify (it is optional), the code falls back to `APP_URL/auth/callback`. Since APP_URL is already `https://app.therevenuecouncil.com`, the fallback would produce the correct redirect URI. So it MAY work without explicitly setting DISCORD_REDIRECT_URI -- but it MUST be checked.

### Discord Developer Portal Configuration Needed

Two things must be configured in Discord Developer Portal (https://discord.com/developers/applications):

1. **OAuth2 -> Redirects**: Add `https://app.therevenuecouncil.com/auth/callback`
   - The existing `http://localhost:3000/auth/callback` can stay for development
   - Add the production URL as a second redirect URI
   - Protocol, domain, port, path must match EXACTLY

2. **Bot -> Privileged Gateway Intents**: Verify these are enabled:
   - Server Members Intent (GuildMembers)
   - Message Content Intent (MessageContent)
   - These are likely ALREADY enabled since the bot is running in production

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth state management | Custom session storage | Cookie-based state with `randomUUID()` | Already implemented; CSRF protection per OAuth spec |
| Role assignment retry | Custom retry loops | `p-retry` with exponential backoff | Already implemented; handles Discord API rate limits |
| Role existence check | Manual role creation | `syncRoles()` on bot startup | Already implemented; creates missing roles automatically |
| Introduction validation | Custom message parsing | `messageCreate` + `messageUpdate` events | Already implemented; handles edits, rate-limits DMs |
| Bot presence/health | Custom heartbeat | `discordClient.isReady()` | Already implemented in health endpoint |

**Key insight:** ALL of this is already built. This phase is purely configuration and verification.

## Common Pitfalls

### Pitfall 1: Discord Redirect URI Must EXACTLY Match Developer Portal

**What goes wrong:** OAuth flow fails with "Invalid redirect URI" error from Discord. The token exchange returns 400.
**Why it happens:** Discord compares the `redirect_uri` parameter in the authorization request and the token exchange against the list registered in the Developer Portal. Protocol, domain, port, and path must match EXACTLY. Even a trailing slash difference causes failure.
**How to avoid:** In Discord Developer Portal -> OAuth2 -> Redirects, add EXACTLY: `https://app.therevenuecouncil.com/auth/callback` (no trailing slash). Verify `DISCORD_REDIRECT_URI` env var (or `APP_URL` fallback) produces this exact URL.
**Warning signs:** Users see "Invalid OAuth2 redirect_uri" page from Discord, or token exchange returns `{"error": "invalid_request"}`.

### Pitfall 2: DISCORD_REDIRECT_URI Still Set to localhost in Coolify

**What goes wrong:** OAuth flow redirects user to `http://localhost:3000/auth/callback` after Discord authorization, which fails because the user's browser cannot reach localhost on the server.
**Why it happens:** The local `.env` has `DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback`. If this value was copied to Coolify during initial setup, it needs to be updated.
**How to avoid:** Check Coolify env vars first. If DISCORD_REDIRECT_URI is set to localhost, update it. If it is NOT set at all, the fallback `APP_URL/auth/callback` will work correctly since APP_URL is already `https://app.therevenuecouncil.com`.
**Warning signs:** After Discord authorization, browser shows "This site can't be reached" for localhost.
**Best option:** DELETE the DISCORD_REDIRECT_URI env var from Coolify entirely and let the `APP_URL/auth/callback` fallback handle it. This avoids maintaining a separate variable.

### Pitfall 3: Privileged Intents Not Enabled in Developer Portal

**What goes wrong:** Bot connects but cannot fetch guild members or read message content. Role assignment fails silently, introduction detection does not trigger.
**Why it happens:** Discord requires explicit opt-in for GuildMembers and MessageContent intents in the Developer Portal.
**How to avoid:** In Discord Developer Portal -> Bot -> Privileged Gateway Intents, enable both "Server Members Intent" and "Message Content Intent". Since the bot is already online and functioning, these are likely already enabled.
**Warning signs:** Bot shows online but role operations fail with "Missing Access" or similar. Introduction messages are not detected. Health check shows `discord: true` but operations fail.

### Pitfall 4: Bot Role Hierarchy Position

**What goes wrong:** Bot cannot assign roles to members because the managed roles (Squire, Knight, Lord, Debtor) are positioned ABOVE the bot's role in the server role hierarchy.
**Why it happens:** Discord enforces that bots can only manage roles below their own role in the hierarchy.
**How to avoid:** In Discord server settings -> Roles, ensure the bot's role (created when the bot was added to the server) is positioned ABOVE the Squire, Knight, Lord, and Debtor roles. The bot role can be dragged higher in the role list.
**Warning signs:** Role assignment fails with "Missing Permissions" error. `addRoleToMember` returns false. Admin alerts fire.

### Pitfall 5: OAuth Claim Flow CSRF Failure

**What goes wrong:** User completes Discord OAuth during `/claim/discord` flow but is redirected to `/auth/error?reason=invalid_state`.
**Why it happens:** The `/claim/discord` route sets a `claim_state` cookie, but Discord redirects to `/auth/callback` which checks for `oauth_state` cookie. These are different cookie names.
**How to avoid:** Test the claim flow specifically. If it fails, the `/auth/callback` handler needs to be updated to also check the `claim_state` and `team_claim_state` cookies. This would be a code fix, not just configuration.
**Warning signs:** OAuth authorization succeeds on Discord side but callback always shows "invalid_state" error.
**Note:** This may actually work if both flows use the same underlying OAuth state mechanism. MUST be tested.

### Pitfall 6: Zod Crash on Empty DISCORD_REDIRECT_URI

**What goes wrong:** Setting `DISCORD_REDIRECT_URI=""` in Coolify causes Zod validation to fail against `.string().url().optional()`, crashing the app on startup.
**Why it happens:** An empty string is NOT the same as undefined for Zod's `.optional()`. An empty string fails `.url()` validation.
**How to avoid:** Either set `DISCORD_REDIRECT_URI` to a valid URL (`https://app.therevenuecouncil.com/auth/callback`) or DELETE it entirely from Coolify. Never set it to an empty string.
**Warning signs:** App crashes immediately on startup with Zod validation error mentioning DISCORD_REDIRECT_URI.

### Pitfall 7: DISCORD_INVITE_URL Not Set

**What goes wrong:** After successful Discord claim, user is redirected to `/dashboard` instead of the Discord server invite. They have to manually find and join the server.
**Why it happens:** `env.DISCORD_INVITE_URL ?? '/dashboard'` fallback in claim.ts:141.
**How to avoid:** Set `DISCORD_INVITE_URL` in Coolify to the Discord server invite link (e.g., `https://discord.gg/...`). Create a permanent invite link in Discord server settings.
**Warning signs:** Users complete claim but never join the Discord server because they are not redirected there.

## Code Examples

### Checking Existing Coolify Discord Env Vars

```bash
# Check which Discord env vars are already set in Coolify
curl -s http://82.180.160.120:8000/api/v1/applications/wcssogsgc00o8ocwcg4c0c00/envs \
  -H "Authorization: Bearer $COOLIFY_TOKEN" | jq '.[] | select(.key | startswith("DISCORD"))'
```

### Updating DISCORD_REDIRECT_URI in Coolify (if needed)

```bash
# Option A: Update to production URL
curl -X PATCH http://82.180.160.120:8000/api/v1/applications/wcssogsgc00o8ocwcg4c0c00/envs \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "DISCORD_REDIRECT_URI",
    "value": "https://app.therevenuecouncil.com/auth/callback",
    "is_build_time": false,
    "is_preview": false
  }'

# Option B (preferred): DELETE the env var entirely so APP_URL fallback is used
# This avoids maintaining a separate variable
# Check Coolify API docs for DELETE /envs endpoint with env UUID
```

### Setting DISCORD_INVITE_URL in Coolify

```bash
curl -X PATCH http://82.180.160.120:8000/api/v1/applications/wcssogsgc00o8ocwcg4c0c00/envs \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "DISCORD_INVITE_URL",
    "value": "https://discord.gg/YOUR_INVITE_CODE",
    "is_build_time": false,
    "is_preview": false
  }'
```

### Discord Developer Portal Configuration Steps

1. Go to https://discord.com/developers/applications
2. Select the application (Client ID: `1462619474921390173`)
3. Go to "OAuth2" in left sidebar
4. Under "Redirects", click "Add Redirect"
5. Enter: `https://app.therevenuecouncil.com/auth/callback`
6. Click "Save Changes"
7. Verify "Bot" -> "Privileged Gateway Intents" has both enabled:
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT

### Testing the OAuth Claim Flow

```
1. Have a member with active subscription and no discordId linked
   (Can use the test member created during Phase 41 checkout testing)

2. Navigate to: https://app.therevenuecouncil.com/claim/discord
   - Should redirect to Discord authorization page
   - Authorize the application

3. After authorization:
   - Discord redirects to /auth/callback?code=...&state=...
   - If Flow 1 (/auth route) handles it: user gets session + redirect to /dashboard
   - If claim flow breaks due to cookie mismatch: user sees invalid_state error

4. Verify in database:
   - Member now has discordId and discordUsername set
   - Check via Coolify logs or direct database query

5. Verify bot role:
   - Check if Squire role was assigned to the user in Discord
   - Bot logs should show "Added role to member"
```

### Testing Introduction Detection

```
1. After successful claim, user should have Squire role in Discord
2. User posts a 100+ character message in #introductions channel
3. Bot detects message:
   - Validates length (>= 100 chars)
   - Looks up member by Discord ID
   - Checks introCompleted is false
   - Checks user has Squire role
4. Bot promotes:
   - Removes Squire role
   - Adds Knight or Lord role (based on seatTier)
   - Updates member.introCompleted = true
   - Awards intro points
   - Sends welcome DM
5. Verify: User has Knight/Lord role, introCompleted in database
```

### Verifying Bot Is Online and Connected

```bash
# Check health endpoint (already working)
curl -s https://app.therevenuecouncil.com/health | jq .
# Expected: {"status":"healthy","checks":{"database":true,"discord":true}}

# Check production logs for bot activity
ssh root@82.180.160.120 "docker logs \$(docker ps --format '{{.Names}}' | grep express | head -1) --tail 50 2>&1" | grep -i "discord\|bot\|role"
```

## Deployment Sequence

### Plan 42-01: Configure Discord OAuth and Test Linking Flow

1. **Check existing Coolify Discord env vars** -- Query what's already set
2. **Check DISCORD_REDIRECT_URI** -- Is it localhost, production, or unset?
3. **Update/delete DISCORD_REDIRECT_URI** if needed (production URL or rely on APP_URL fallback)
4. **Set DISCORD_INVITE_URL** in Coolify (user must provide Discord server invite link)
5. **Add production redirect URI in Discord Developer Portal** (user action)
6. **Verify privileged intents enabled** in Developer Portal (user action)
7. **Restart app** if env vars changed
8. **Test OAuth claim flow** -- Navigate to `/claim/discord`, complete OAuth, verify member linked
9. **Test bot role assignment** -- Verify Squire role assigned after claim
10. **Verify health check** -- `/health` still shows `discord: true`

### Plan 42-02: Verify Bot Connection and Role Assignment

1. **Verify bot is online** in Discord server (shows green status)
2. **Verify roles exist** -- Squire, Knight, Lord, Debtor created in server
3. **Verify bot role hierarchy** -- Bot role above managed roles
4. **Test introduction detection** -- Post 100+ char message in #introductions
5. **Verify promotion** -- Squire swapped to Knight/Lord
6. **Verify database updated** -- introCompleted = true
7. **Test too-short intro** -- Post <100 char message, verify guidance DM
8. **Verify Debtor role** -- optional, depends on having a member in payment failure state

## Open Questions

1. **Is DISCORD_REDIRECT_URI set in Coolify, and to what value?**
   - What we know: The bot is online, so DISCORD_CLIENT_ID/SECRET/TOKEN/GUILD_ID are set. But DISCORD_REDIRECT_URI is optional and may or may not be set.
   - What's unclear: Whether it was set to `http://localhost:3000/auth/callback` (from local .env) or left unset.
   - Recommendation: Check via Coolify API. If set to localhost, either update to production URL or delete it. If unset, the APP_URL fallback will work.

2. **Does the claim flow work, or does the cookie mismatch cause CSRF failure?**
   - What we know: All three OAuth flows share `generateAuthUrl()` which uses the same redirect_uri. The `/auth/callback` handler checks for `oauth_state` cookie. The `/claim/discord` route sets `claim_state` cookie instead.
   - What's unclear: Whether the callback handler correctly processes claim-flow users or rejects them.
   - Recommendation: Test the `/claim/discord` flow first. If it fails with invalid_state, a code fix is needed to the callback handler.

3. **Is the bot's role positioned correctly in the server hierarchy?**
   - What we know: Discord requires bots to have a role higher than any role they manage. The bot creates roles programmatically.
   - What's unclear: Where the bot's role sits relative to Squire/Knight/Lord/Debtor in the hierarchy.
   - Recommendation: User should verify in Discord server settings that the bot role is above all managed roles.

4. **Does the Discord server have a permanent invite link?**
   - What we know: DISCORD_INVITE_URL is not set in local .env. The claim flow falls back to `/dashboard` if not set.
   - What's unclear: Whether the server has an existing permanent invite link.
   - Recommendation: User should create a permanent (non-expiring) invite link in Discord and provide it for DISCORD_INVITE_URL.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Full reading of:
  - `src/auth/discord-oauth.ts` (85 lines) -- OAuth URL generation and token exchange
  - `src/bot/client.ts` (68 lines) -- Bot startup, intents, event handlers
  - `src/bot/roles.ts` (213 lines) -- Role sync, add/remove/removeAll
  - `src/bot/events/introduction.ts` (227 lines) -- Introduction detection and promotion
  - `src/bot/channels.ts` (101 lines) -- Billing support channel creation
  - `src/lib/role-assignment.ts` (226 lines) -- Async role operations with retry
  - `src/config/discord.ts` (27 lines) -- Role config (Squire/Knight/Lord/Debtor)
  - `src/config/env.ts` (77 lines) -- All Discord env var definitions with Zod
  - `src/routes/auth.ts` (716 lines) -- Auth route with Discord OAuth callback
  - `src/routes/claim.ts` (147 lines) -- Individual claim flow
  - `src/routes/team-claim.ts` (274 lines) -- Team claim flow
  - `src/index.ts` (354 lines) -- Bot startup, health check, route mounting
  - `scripts/verify-integrations.ts` (546 lines) -- Integration verification script
  - `.env` -- Local Discord credentials and channel IDs
  - `.env.example` -- Documented env var structure

### Secondary (MEDIUM confidence)
- **Phase 39 verification** -- Confirms `discord: true` in production health check (bot already connected)
- **Phase 41 research and summaries** -- Established Coolify env var PATCH pattern and redeployment workflow
- **STATE.md** -- Confirms deployment details, Coolify API patterns, prior decisions
- **REQUIREMENTS-v2.2.md** -- Defines DISCORD-01 through DISCORD-08 requirements

### Discord Developer Portal (HIGH confidence - official documentation)
- OAuth2 redirect URI must exactly match: protocol, domain, port, path
- Privileged intents (GuildMembers, MessageContent) must be enabled in Developer Portal
- Bot role must be above managed roles in server hierarchy

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All code exists and bot is already running in production
- Architecture: HIGH -- Complete code audit of all Discord-related files performed
- OAuth configuration: HIGH -- Redirect URI logic traced through code, env var validated
- Bot operations: HIGH -- Role sync, introduction detection, role assignment all audited
- Pitfalls: HIGH -- Based on source code analysis of cookie flow, Zod validation, Discord API requirements
- Deployment sequence: HIGH -- Follows established Coolify patterns from Phase 41

**Critical risk identified:** The OAuth claim flow (`/claim/discord`) may have a cookie-based CSRF mismatch that prevents it from working. This needs to be tested before declaring the phase complete. If it fails, a code fix is required.

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable domain -- Discord API and existing codebase are not changing)
