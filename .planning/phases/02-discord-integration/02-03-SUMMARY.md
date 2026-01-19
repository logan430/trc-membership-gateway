---
phase: 02-discord-integration
plan: 03
subsystem: auth
tags: [oauth2, discord, csrf, state-parameter, authorization-code-grant]

# Dependency graph
requires:
  - phase: 02-01
    provides: JWT session utilities (createAccessToken, createRefreshToken)
provides:
  - Discord OAuth2 authorization code flow
  - generateAuthUrl, exchangeCode, fetchDiscordUser helpers
  - /auth/discord, /auth/callback, /auth/error routes
affects: [02-04, 03-subscription-flows]

# Tech tracking
tech-stack:
  added: []
  patterns: [oauth2-authorization-code-grant, csrf-state-cookie, discord-api-fetch]

key-files:
  created:
    - src/auth/discord-oauth.ts
  modified:
    - src/routes/auth.ts
    - src/config/env.ts

key-decisions:
  - "DISCORD_REDIRECT_URI as explicit env var for OAuth callback"
  - "State cookie with 10-minute expiry for CSRF protection"
  - "x-www-form-urlencoded for Discord token exchange (critical per RESEARCH.md)"
  - "Duplicate Discord linking blocked per CONTEXT.md"
  - "Stub member created if user links Discord before payment"

patterns-established:
  - "OAuth state cookie: oauth_state with httpOnly, secure, sameSite lax"
  - "Discord API fetch with error handling (throw on non-OK)"
  - "Dashboard redirect with token fragment: /dashboard#token={accessToken}"

# Metrics
duration: 6min
completed: 2026-01-18
---

# Phase 2 Plan 3: Discord OAuth Routes Summary

**Discord OAuth2 authorization code flow with CSRF protection and duplicate linking prevention**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-18T20:25:00Z
- **Completed:** 2026-01-18T20:31:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Discord OAuth helpers for authorization URL generation, code exchange, and user fetch
- /auth/discord route to initiate OAuth flow with cryptographic state
- /auth/callback route to validate state, exchange code, link Discord, and create session
- /auth/error route for OAuth error display
- CSRF protection via state cookie with 10-minute expiry
- Duplicate Discord linking prevention per CONTEXT.md

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Discord OAuth helpers** - `eb5025a` (feat)
2. **Task 2: Add OAuth routes to auth router** - `cba4c5d` (feat)

## Files Created/Modified

- `src/auth/discord-oauth.ts` - OAuth helpers: generateAuthUrl, exchangeCode, fetchDiscordUser
- `src/routes/auth.ts` - Added /auth/discord, /auth/callback, /auth/error routes
- `src/config/env.ts` - Added DISCORD_REDIRECT_URI (required for OAuth callback)

## Decisions Made

- **DISCORD_REDIRECT_URI as env var:** Explicit configuration allows different callback URLs per environment (dev, staging, prod). Must match OAuth app settings in Discord Developer Portal.
- **State cookie with lax sameSite:** Using 'lax' instead of 'strict' because OAuth redirect comes from Discord domain. Cookie still httpOnly and secure in production.
- **Stub member creation:** If a user links Discord without prior payment, a member record is created. Phase 3 will handle proper member creation at payment time.
- **x-www-form-urlencoded for token exchange:** Critical per RESEARCH.md pitfall - Discord rejects JSON content-type for token endpoint.

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

Add to `.env`:
```
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback
```

Also configure in Discord Developer Portal:
1. Go to https://discord.com/developers/applications
2. Select your application
3. Go to OAuth2 > General
4. Add redirect URI: `http://localhost:3000/auth/callback`

## Next Phase Readiness

- Discord OAuth flow complete and ready for testing
- Ready for magic link auth (Plan 02-04) - already partially implemented
- Session infrastructure (02-01) + OAuth (02-03) provide complete auth foundation
- Phase 3 (subscription flows) can now link Discord accounts to paid members

---
*Phase: 02-discord-integration*
*Plan: 03*
*Completed: 2026-01-18*
