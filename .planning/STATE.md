# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-01-18)

**Core value:** Paid members can access the community, and we always know who everyone is.
**Current focus:** Phase 5 - Team Management (In Progress)

## Current Position

Phase: 5 of 8 (Team Management)
Plan: 3 of 6 in current phase
Status: In progress
Last activity: 2026-01-19 - Completed 05-03-PLAN.md

Progress: [████████░░] 74%

## Performance Metrics

**Velocity:**
- Total plans completed: 16
- Average duration: 5.1 min
- Total execution time: 85 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1-Foundation | 3/3 | 24 min | 8 min |
| 2-Discord | 4/4 | 18 min | 4.5 min |
| 3-Individual | 3/3 | 20 min | 6.7 min |
| 4-Introduction | 3/3 | 11 min | 3.7 min |
| 5-Team | 3/6 | 12 min | 4 min |

**Recent Trend:**
- Last 5 plans: 04-03 (5 min), 04-02 (3 min), 05-01 (4 min), 05-02 (3 min), 05-03 (5 min)
- Trend: Consistent execution, averaging 3-5 min per plan

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
| 03-02 | Async role assignment with p-retry | Fire-and-forget with exponential backoff |
| 03-02 | Separate claim cookies | Avoid conflicts with auth cookies |
| 03-02 | Channel-by-channel Discord permissions | Fine-grained control over Squire access |
| 04-01 | MessageContent privileged intent | Required for reading message content |
| 04-01 | Top-level messages only | Replies filtered out per CONTEXT.md |
| 04-01 | MIN_INTRO_LENGTH = 100 | Constant exported for reuse |
| 04-03 | customer.subscription.deleted triggers kick | Fires at period end, not on cancel initiation |
| 04-03 | Farewell DM before kick | Ensures user receives message |
| 04-03 | introCompleted reset on cancellation | Allows re-introduction on resubscribe |
| 04-02 | Text-only length validation | Images don't count per CONTEXT.md |
| 04-02 | 24-hour rate limit for guidance DMs | Prevents DM spam while allowing retry |
| 04-02 | Fire-and-forget role swap with p-retry | Consistent with assignRoleAsync pattern |
| 05-01 | Team created before checkout session | Prevents webhook race condition |
| 05-01 | subscription_data.metadata for routing | Clean individual/company checkout separation |
| 05-01 | isPrimaryOwner field on Member | Purchaser cannot be revoked by other org members |
| 05-02 | Owner-only dashboard access | Per CONTEXT.md - team members cannot view |
| 05-02 | Status derived from discordId | If discordId exists, claim is complete |
| 05-02 | Member sort: primary, tier, date | Logical grouping for dashboard display |
| 05-03 | crypto.randomBytes for tokens | Built-in CSPRNG, 256 bits entropy |
| 05-03 | base64url encoding | URL-safe without escaping |
| 05-03 | timingSafeEqual for validation | Prevents timing attacks |
| 05-03 | Seat check before invite creation | Fail fast with clear error |

### Pending Todos

None.

### Blockers/Concerns

- Stripe CLI not installed - webhook signature testing pending user setup
- Discord bot requires user setup (Developer Portal, bot token, guild invite)
- STRIPE_INDIVIDUAL_PRICE_ID must be set before testing checkout
- STRIPE_OWNER_SEAT_PRICE_ID must be set before testing company checkout
- STRIPE_TEAM_SEAT_PRICE_ID must be set before testing company checkout
- DISCORD_INTRODUCTIONS_CHANNEL_ID must be set before testing introduction detection
- Message Content Intent must be enabled in Discord Developer Portal
- Pre-existing TypeScript errors in discord-oauth.ts and claim.ts need attention
- public/team-dashboard.html from 05-02 is untracked (leftover)

## Phase 5 Progress

Team management progress:
- [x] 05-01: Schema updates and company checkout flow
- [x] 05-02: Team dashboard with seat view
- [x] 05-03: Invite token generation and management
- [ ] 05-04: Invite claim flow with Discord OAuth
- [ ] 05-05: Seat revocation with immediate kick
- [ ] 05-06: Mid-subscription seat additions

Delivered (05-01):
- isPrimaryOwner field on Member model (purchaser protection)
- PendingInvite model updated (no email/expiresAt, has createdBy)
- STRIPE_OWNER_SEAT_PRICE_ID and STRIPE_TEAM_SEAT_PRICE_ID env vars
- POST /company/checkout creates Team before Stripe session
- Multi-line_item checkout with owner and team seat prices
- Webhook detects company checkout via planType metadata
- Purchaser linked to team as isPrimaryOwner with OWNER seatTier

Delivered (05-02):
- GET /team/dashboard API endpoint (owner-only access)
- Seat summary: owner X/Y, team X/Y
- Member details: name, email, status, intro completion
- /team-dashboard.html with medieval theme
- Responsive design, error handling for 401/403/404

Delivered (05-03):
- generateInviteToken(): 32-byte crypto token, base64url encoded
- validateToken(): timing-safe comparison for claim flow
- POST /team/invites: create invite with seat check
- GET /team/invites: list all team invites
- DELETE /team/invites/:id: revoke invite

## Session Continuity

Last session: 2026-01-19
Stopped at: Completed 05-03-PLAN.md
Resume file: None
