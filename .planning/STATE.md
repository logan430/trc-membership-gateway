# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-01-18)

**Core value:** Paid members can access the community, and we always know who everyone is.
**Current focus:** Phase 3 - Individual Subscription (In Progress)

## Current Position

Phase: 3 of 8 (Individual Subscription)
Plan: 1 of 5 in current phase
Status: In progress
Last activity: 2026-01-18 - Completed 03-01-PLAN.md

Progress: [████████░░] 42%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 6 min
- Total execution time: 54 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1-Foundation | 3/3 | 24 min | 8 min |
| 2-Discord | 4/4 | 18 min | 4.5 min |
| 3-Individual | 2/5 | 12 min | 6 min |

**Recent Trend:**
- Last 5 plans: 02-02 (5 min), 02-03 (6 min), 02-04 (5 min), 03-03 (4 min), 03-01 (8 min)
- Trend: Consistent execution, averaging 5-8 min per plan

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
| 03-03 | Medieval theme: Cinzel + Crimson Text | Consistent with "Revenue Council" branding |
| 03-03 | Dark (#1a1a2e) + gold (#d4af37) palette | Medieval guild aesthetic |
| 03-03 | Static files before routes | Named routes take precedence |
| 03-01 | Argon2id with OWASP 2025 params | Industry standard for password hashing |
| 03-01 | Email unique constraint on Member | Proper lookup and prevent duplicates |
| 03-01 | Timing-safe password verification | Prevent timing attacks on login |
| 03-01 | Anti-enumeration on signup | Same response for existing/new emails |
| 03-01 | currentPeriodEnd from SubscriptionItem | Stripe SDK v20 API change |

### Pending Todos

None.

### Blockers/Concerns

- Stripe CLI not installed - webhook signature testing pending user setup
- Discord bot requires user setup (Developer Portal, bot token, guild invite)
- STRIPE_INDIVIDUAL_PRICE_ID must be set before testing checkout

## Phase 3 Progress

Individual subscription progress:
- [x] 03-01: Account creation and checkout endpoints
- [ ] 03-02: Claim Discord flow
- [x] 03-03: The Gatekeeper landing page
- [ ] 03-04: User dashboard
- [ ] 03-05: Post-claim redirect

Delivered (03-01):
- Argon2id password hashing (OWASP 2025 parameters)
- POST /auth/signup endpoint (email+password registration)
- POST /auth/login endpoint (timing-safe verification)
- POST /checkout endpoint (Stripe Checkout session creation)
- checkout.session.completed webhook handler (subscription activation)
- passwordHash field added to Member model
- Email unique constraint on Member model

Delivered (03-03):
- GET / serves The Gatekeeper landing page
- Medieval/guild visual theme with Cinzel/Crimson fonts
- Side-by-side pricing cards ($99 Individual, $299 Company)
- Static file serving via express.static()
- Responsive design (cards stack on mobile)

## Session Continuity

Last session: 2026-01-18
Stopped at: Completed 03-01-PLAN.md
Resume file: None
