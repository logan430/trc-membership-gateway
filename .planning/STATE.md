# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-01-18)

**Core value:** Paid members can access the community, and we always know who everyone is.
**Current focus:** Phase 2 - Discord Integration (Complete)

## Current Position

Phase: 2 of 8 (Discord Integration)
Plan: 4 of 4 in current phase
Status: Phase complete
Last activity: 2026-01-18 - Completed 02-04-PLAN.md

Progress: [███████░░░] 37%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 6 min
- Total execution time: 42 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1-Foundation | 3/3 | 24 min | 8 min |
| 2-Discord | 4/4 | 18 min | 4.5 min |

**Recent Trend:**
- Last 5 plans: 01-03 (12 min), 02-01 (8 min), 02-02 (5 min), 02-03 (6 min), 02-04 (5 min)
- Trend: Fast execution, averaging under 5 min per plan in Phase 2

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 01-01 | Express 5.2.1 over Fastify/Hono | Stripe documentation alignment |
| 01-01 | No global express.json() | Webhook needs raw body for signature |
| 01-02 | Supabase pooler connection | Direct connection had IPv6 issues |
| 01-03 | Prisma 7 adapter pattern | WASM engine requires adapter for postgres |
| 01-03 | express.raw() on webhook only | Preserve raw body for signature verification |
| 01-03 | Record before process | Prevent race condition duplicates |
| 02-02 | GuildMembers privileged intent | Required for member.fetch() and role ops |
| 02-02 | Medieval role theme | Matches "The Revenue Council" branding |
| 02-02 | Admin alerts via channel/DM | Best-effort alerting, never throws |
| 02-01 | 15min access / 7d or 30d refresh tokens | Balance security with UX |
| 02-01 | httpOnly cookie for refresh token | Prevent XSS token theft |
| 02-01 | Token rotation on every refresh | Security best practice |
| 02-03 | DISCORD_REDIRECT_URI as explicit env | Configurable per environment |
| 02-03 | State cookie with 10-min expiry | CSRF protection for OAuth |
| 02-03 | Duplicate Discord linking blocked | Per CONTEXT.md requirements |
| 02-04 | 5-minute magic link expiry | Short-lived for security |
| 02-04 | Same response for email exists/not | Anti-enumeration protection |
| 02-04 | Token in URL fragment | Client-only access, not sent to server |

### Pending Todos

None.

### Blockers/Concerns

- Stripe CLI not installed - webhook signature testing pending user setup
- Discord bot requires user setup (Developer Portal, bot token, guild invite)

## Phase 2 Progress

Discord integration progress:
- [x] 02-01: Session Infrastructure (JWT tokens, auth middleware)
- [x] 02-02: Discord bot with role management
- [x] 02-03: Discord OAuth routes (/auth/discord, /auth/callback, /auth/error)
- [x] 02-04: Magic link authentication

Delivered:
- JWT session utilities (jose library)
- Auth middleware for protected routes
- Token refresh endpoint with rotation
- discord.js v14.25.1 bot with privileged intents
- Medieval-themed roles (Squire, Knight, Lord, Debtor)
- Role sync on startup (auto-create missing roles)
- addRoleToMember / removeRoleFromMember functions
- Admin alerting on role operation failures
- Discord OAuth helpers (generateAuthUrl, exchangeCode, fetchDiscordUser)
- GET /auth/discord (initiates OAuth with CSRF state)
- GET /auth/callback (validates state, exchanges code, links Discord)
- GET /auth/error (displays OAuth error info)
- Magic link token generation and verification
- POST /auth/magic-link/request endpoint
- GET /auth/magic-link/verify endpoint

## Session Continuity

Last session: 2026-01-18
Stopped at: Completed 02-03-PLAN.md (Discord OAuth Routes)
Resume file: None
