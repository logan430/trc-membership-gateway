# Phase 2: Discord Integration - Research

**Researched:** 2026-01-18
**Domain:** Discord OAuth2, discord.js bot, JWT session management
**Confidence:** MEDIUM (multiple authoritative sources, some WebSearch-only findings)

## Summary

Phase 2 requires three distinct technical domains: Discord OAuth2 for user authentication, discord.js bot for role management, and JWT-based session management for persistent logins. The established approach uses discord.js v14 for the bot (current stable: 14.25.1), manual OAuth2 implementation with the authorization code grant flow (NOT implicit), and the jose library (already in package.json) for JWT handling.

Key insight: Discord OAuth2 is straightforward but requires careful state parameter handling for CSRF protection. The bot role management has hierarchy constraints that must be understood - the bot cannot modify roles higher than its own. Session management should use httpOnly cookies for refresh tokens and short-lived access tokens in memory/response.

**Primary recommendation:** Implement OAuth2 manually using fetch (no deprecated discord-oauth2 package), use discord.js v14.25.1 for bot operations, and leverage the existing jose library for JWT creation/verification with httpOnly cookie storage for refresh tokens.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| discord.js | ^14.25.1 | Discord bot client | Official Discord library, v14 supports API v10 |
| jose | ^6.1.3 | JWT signing/verification | Already installed, zero dependencies, modern ESM |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| undici/fetch | native | HTTP client for OAuth2 | Built into Node 18+, no axios needed |
| cookie | ^1.0.2 | Cookie parsing/serialization | Lightweight cookie handling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| discord-oauth2 npm | Manual fetch | discord-oauth2 is deprecated, manual is recommended |
| passport-discord | Manual OAuth2 | Passport adds complexity, manual OAuth2 is cleaner |
| express-session | jose JWTs | express-session requires Redis/store, JWTs are stateless |
| jsonwebtoken | jose | jose is more modern, already installed, ESM-native |

**Installation:**
```bash
npm install discord.js cookie
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  auth/
    discord-oauth.ts      # OAuth2 authorization URL, token exchange
    session.ts            # JWT creation, verification, cookie handling
    magic-link.ts         # Magic link generation and verification
  bot/
    client.ts             # Discord.js client initialization
    roles.ts              # Role management (create, assign, remove)
    events/
      ready.ts            # Bot startup, role sync
      guildMemberAdd.ts   # Optional: member join handling
  routes/
    auth.ts               # /auth/discord, /auth/callback, /auth/magic-link
  middleware/
    session.ts            # JWT verification middleware
  config/
    discord.ts            # Discord-specific config (guild ID, role names)
```

### Pattern 1: Discord OAuth2 Authorization Code Grant
**What:** Server-side OAuth2 flow where authorization code is exchanged for tokens on the backend
**When to use:** Always. Never use implicit grant (security vulnerability)
**Example:**
```typescript
// Source: Discord OAuth2 documentation, discordjs.guide/oauth2/
// Step 1: Generate authorization URL
const generateAuthUrl = (state: string): string => {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',  // No email - comes from Stripe per CONTEXT.md
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
};

// Step 2: Exchange code for tokens
const exchangeCode = async (code: string): Promise<TokenResponse> => {
  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.DISCORD_REDIRECT_URI,
    }),
  });
  return response.json();
};

// Step 3: Fetch user info
const fetchUser = async (accessToken: string): Promise<DiscordUser> => {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
};
```

### Pattern 2: JWT Session with Refresh Token Rotation
**What:** Short-lived access tokens + long-lived refresh tokens in httpOnly cookies
**When to use:** For persistent sessions across browser refresh (AUTH-02)
**Example:**
```typescript
// Source: 2025 session security best practices
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(env.JWT_SECRET);

// Create access token (15 min, returned in response body)
const createAccessToken = async (memberId: string): Promise<string> => {
  return new SignJWT({ sub: memberId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
};

// Create refresh token (30 days default, 7 days without "remember me")
const createRefreshToken = async (memberId: string, rememberMe: boolean): Promise<string> => {
  const expiry = rememberMe ? '30d' : '7d';
  return new SignJWT({ sub: memberId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(secret);
};

// Cookie config for refresh token
const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/auth/refresh',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};
```

### Pattern 3: Discord.js Bot with Role Management
**What:** Bot that manages roles based on subscription status
**When to use:** For automated role assignment/removal
**Example:**
```typescript
// Source: discord.js.org/docs, discordjs.guide
import { Client, GatewayIntentBits, Events, PermissionFlagsBits } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,  // Privileged - enable in Developer Portal
  ],
});

// Role definitions per CONTEXT.md (medieval/council themed)
const ROLE_CONFIG = {
  SQUIRE: { name: 'Squire', color: 0x808080, reason: 'Paid but unintroduced' },
  KNIGHT: { name: 'Knight', color: 0x3498db, reason: 'Active member' },
  LORD: { name: 'Lord', color: 0xf1c40f, reason: 'Company owner' },
  DEBTOR: { name: 'Debtor', color: 0xe74c3c, reason: 'Billing issue' },
};

// Ensure roles exist on startup
client.on(Events.ClientReady, async () => {
  const guild = client.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) return;

  for (const [key, config] of Object.entries(ROLE_CONFIG)) {
    let role = guild.roles.cache.find(r => r.name === config.name);
    if (!role) {
      role = await guild.roles.create({
        name: config.name,
        color: config.color,
        reason: `Auto-created: ${config.reason}`,
      });
      logger.info({ role: role.name }, 'Created missing role');
    }
  }
});

// Add role to member
const addRoleToMember = async (discordId: string, roleName: string): Promise<boolean> => {
  const guild = client.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) return false;

  const member = await guild.members.fetch(discordId);
  const role = guild.roles.cache.find(r => r.name === roleName);
  if (!member || !role) return false;

  await member.roles.add(role);
  return true;
};
```

### Pattern 4: Magic Link Authentication
**What:** Passwordless login via time-limited email link
**When to use:** For AUTH-03/AUTH-04 - returning users or users without Discord
**Example:**
```typescript
// Source: Medium tutorials, Passport.js magic-link pattern
import { SignJWT, jwtVerify } from 'jose';

// Generate magic link token (5 minute expiry)
const createMagicLinkToken = async (email: string): Promise<string> => {
  return new SignJWT({ email, purpose: 'magic-link' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
};

// Verify and consume magic link
const verifyMagicLink = async (token: string): Promise<{ email: string } | null> => {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.purpose !== 'magic-link') return null;
    return { email: payload.email as string };
  } catch {
    return null;  // Expired or invalid
  }
};
```

### Anti-Patterns to Avoid
- **Storing access tokens in localStorage:** XSS vulnerability. Use httpOnly cookies for refresh tokens, memory for access tokens.
- **Using implicit grant flow:** Vulnerable to token leakage. Always use authorization code grant.
- **Hardcoding Discord bot token:** Use environment variables.
- **Not validating state parameter:** CSRF vulnerability. Generate and verify state per-request.
- **Using deprecated discord-oauth2 package:** Unmaintained, implement manually.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT creation/verification | Custom crypto | jose library | Edge cases, timing attacks, algorithm confusion |
| Discord API interaction | Raw fetch for bot | discord.js | Rate limiting, reconnection, event handling |
| Cookie parsing | String splitting | cookie package | Edge cases, encoding, security flags |
| OAuth2 state generation | Math.random() | crypto.randomUUID() | Cryptographically secure |
| Password hashing | N/A (no passwords) | N/A | Magic links eliminate passwords |

**Key insight:** Discord OAuth2 is simple enough to implement manually (just fetch calls), but the bot absolutely needs discord.js for proper gateway handling, rate limiting, and reconnection logic.

## Common Pitfalls

### Pitfall 1: Bot Role Hierarchy
**What goes wrong:** Bot cannot assign/remove roles higher than its own role
**Why it happens:** Discord enforces role hierarchy - bot's highest role determines what it can modify
**How to avoid:**
- When bot creates roles on startup, they're automatically below bot's role (good)
- If using existing roles, ensure bot's role is positioned higher in server settings
- Check role position before operations and log/alert if hierarchy prevents action
**Warning signs:** `DiscordAPIError: Missing Permissions` when bot has MANAGE_ROLES

### Pitfall 2: OAuth2 State Parameter Omission
**What goes wrong:** CSRF attack allows attacker to link their Discord to victim's account
**Why it happens:** Developers skip state parameter for simplicity
**How to avoid:**
- Generate cryptographic state with crypto.randomUUID()
- Store state in session/cookie before redirect
- Verify state in callback matches stored value
- Reject if state is missing or mismatched
**Warning signs:** Callback endpoint has no state verification

### Pitfall 3: Token Endpoint Content-Type
**What goes wrong:** Discord returns error instead of tokens
**Why it happens:** Using JSON content-type instead of x-www-form-urlencoded
**How to avoid:** Always use `Content-Type: application/x-www-form-urlencoded` for token exchange
**Warning signs:** `{error: "invalid_request"}` from Discord

### Pitfall 4: Privileged Intents Not Enabled
**What goes wrong:** guild.members.fetch() times out, events don't fire
**Why it happens:** GUILD_MEMBERS intent required in Developer Portal AND code
**How to avoid:**
1. Enable "Server Members Intent" in Discord Developer Portal > Bot > Privileged Gateway Intents
2. Include GatewayIntentBits.GuildMembers in client intents array
**Warning signs:** Members cache is empty, guildMemberAdd events never fire

### Pitfall 5: Refresh Token Not Rotated
**What goes wrong:** Stolen refresh token remains valid indefinitely
**Why it happens:** Same refresh token reused until expiry
**How to avoid:** Issue new refresh token on each refresh, invalidate old one
**Warning signs:** Same refresh token value across multiple /auth/refresh calls

### Pitfall 6: Discord User Data Staleness
**What goes wrong:** Stored username/avatar becomes outdated
**Why it happens:** Discord user data cached at OAuth time, never refreshed
**How to avoid:** Re-fetch user data on session refresh or periodically
**Warning signs:** Dashboard shows outdated usernames/avatars

### Pitfall 7: One Discord Account Per Membership Not Enforced
**What goes wrong:** User links same Discord to multiple memberships
**Why it happens:** Unique constraint not checked before link
**How to avoid:**
- Prisma schema already has `@unique` on discordId
- Check for existing link before saving, return clear error
**Warning signs:** Database constraint violation errors

## Code Examples

Verified patterns from official sources:

### Express Route for OAuth2 Callback
```typescript
// Source: Discord OAuth2 best practices, multiple tutorials
import { Router } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

// Step 1: Initiate OAuth
router.get('/discord', (req, res) => {
  const state = randomUUID();
  // Store state - could use signed cookie or session
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000  // 10 minutes
  });

  const authUrl = generateAuthUrl(state);
  res.redirect(authUrl);
});

// Step 2: Handle callback
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const storedState = req.cookies?.oauth_state;

  // Verify state
  if (!state || state !== storedState) {
    return res.redirect('/auth/error?reason=invalid_state');
  }
  res.clearCookie('oauth_state');

  if (!code) {
    return res.redirect('/auth/error?reason=no_code');
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code as string);

    // Fetch Discord user
    const discordUser = await fetchUser(tokens.access_token);

    // Check if Discord already linked to another member
    const existingMember = await prisma.member.findUnique({
      where: { discordId: discordUser.id }
    });
    if (existingMember) {
      return res.redirect('/auth/error?reason=discord_already_linked');
    }

    // Create or update member (implementation depends on flow)
    // ...

    // Create session tokens
    const accessToken = await createAccessToken(member.id);
    const refreshToken = await createRefreshToken(member.id, true);

    res.cookie('refresh_token', refreshToken, refreshCookieOptions);

    // Redirect to dashboard with access token in URL fragment
    // (or use other secure delivery method)
    res.redirect(`/dashboard#token=${accessToken}`);
  } catch (error) {
    logger.error({ error }, 'OAuth callback failed');
    res.redirect('/auth/error?reason=oauth_failed');
  }
});
```

### Session Verification Middleware
```typescript
// Source: JWT best practices, jose documentation
import { jwtVerify } from 'jose';
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  memberId?: string;
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, secret);
    req.memberId = payload.sub as string;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

### Bot Role Sync on Startup
```typescript
// Source: discord.js documentation, AnIdiotsGuide
import { Client, GatewayIntentBits, Events } from 'discord.js';

const MANAGED_ROLES = ['Squire', 'Knight', 'Lord', 'Debtor'];

client.on(Events.ClientReady, async (readyClient) => {
  logger.info({ tag: readyClient.user.tag }, 'Bot logged in');

  const guild = readyClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) {
    logger.error('Bot is not in configured guild');
    return;
  }

  // Ensure all managed roles exist
  for (const roleName of MANAGED_ROLES) {
    let role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
      try {
        role = await guild.roles.create({
          name: roleName,
          reason: 'TRC membership role - auto-created on bot startup',
        });
        logger.info({ role: roleName }, 'Created missing role');
      } catch (error) {
        logger.error({ error, role: roleName }, 'Failed to create role');
        // Alert admin per CONTEXT.md requirement
        await alertAdmin(`Failed to create role: ${roleName}`);
      }
    }
  }

  logger.info('Role sync complete');
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| discord-oauth2 npm package | Manual fetch implementation | 2024 (deprecated) | Package unmaintained, manual is recommended |
| Implicit grant flow | Authorization code grant | Ongoing | Security requirement, never use implicit |
| Discriminator (User#1234) | New username system | 2023 | discriminator may be "0", use global_name |
| localStorage for tokens | httpOnly cookies + memory | 2025 best practices | XSS protection |
| express-session with stores | Stateless JWTs | Ongoing | Simpler deployment, no Redis needed |
| discord.js v13 | discord.js v14 | 2022 | API v10, GatewayIntentBits enum |

**Deprecated/outdated:**
- discord-oauth2 npm package: Deprecated, "better, more secure solutions available"
- Storing JWTs in localStorage: Security risk, use httpOnly cookies
- Long-lived access tokens: Use short access (15m) + longer refresh (7-30d)
- Implicit OAuth2 grant: Security vulnerability, always use auth code grant

## Open Questions

Things that couldn't be fully resolved:

1. **Admin Alert Mechanism**
   - What we know: CONTEXT.md says "Log failure AND alert admin (via channel or DM)"
   - What's unclear: Specific channel ID, admin user ID, or DM vs channel preference
   - Recommendation: Create config option for DISCORD_ADMIN_CHANNEL_ID, fall back to DM to guild owner

2. **Bot Visibility**
   - What we know: CONTEXT.md says "Claude's discretion"
   - What's unclear: Whether bot should have a status/activity displayed
   - Recommendation: Set minimal presence ("Managing memberships") to indicate bot is online

3. **Server Join Method**
   - What we know: CONTEXT.md defers to Claude's discretion
   - What's unclear: Whether to auto-join via guilds.join scope or provide invite link
   - Recommendation: Use invite link (simpler, doesn't require guilds.join scope which needs bot to already be in guild)

4. **Role Colors**
   - What we know: Medieval themed names (Squire, Knight, Lord, Debtor)
   - What's unclear: Specific hex colors for each role
   - Recommendation: Suggest muted medieval palette, make configurable

## Sources

### Primary (HIGH confidence)
- [discord.js official documentation](https://discord.js.org/docs) - v14.25.1 API, GuildMemberRoleManager, RoleManager
- [discord.js guide](https://discordjs.guide/) - Getting started, intents, OAuth2 patterns
- [jose npm package](https://github.com/panva/jose) - v6.1.3, JWT signing/verification

### Secondary (MEDIUM confidence)
- [Discord Developer Portal OAuth2 docs](https://discord.com/developers/docs/topics/oauth2) - Scopes, token endpoint, PKCE
- [2025 session security best practices](https://www.techosquare.com/blog/session-security-in-2025-what-works-for-cookies-tokens-and-rotation) - Token rotation, cookie config
- [OWASP OAuth2 Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html) - Security best practices

### Tertiary (LOW confidence - needs validation)
- Medium tutorials on magic link implementation - Pattern verified but specifics may vary
- AnIdiotsGuide discord.js - Community guide, patterns may be outdated for v14

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - discord.js and jose are well-documented, versions verified
- Architecture: MEDIUM - Patterns derived from multiple sources, common practice
- Pitfalls: HIGH - Well-documented issues across multiple authoritative sources
- OAuth2 flow: HIGH - Official Discord documentation, OWASP guidelines
- Session management: MEDIUM - 2025 best practices from multiple security sources

**Research date:** 2026-01-18
**Valid until:** 2026-02-18 (30 days - stable domain, slow-moving)
