# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-01-18)

**Core value:** Paid members can access the community, and we always know who everyone is.
**Current focus:** Phase 4 - Introduction Requirement (Complete)

## Current Position

Phase: 4 of 8 (Introduction Requirement)
Plan: 3 of 3 in current phase
Status: Phase complete
Last activity: 2026-01-19 - Completed 04-02-PLAN.md

Progress: [████████░░] 65%

## Performance Metrics

**Velocity:**
- Total plans completed: 13
- Average duration: 5.6 min
- Total execution time: 73 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1-Foundation | 3/3 | 24 min | 8 min |
| 2-Discord | 4/4 | 18 min | 4.5 min |
| 3-Individual | 3/3 | 20 min | 6.7 min |
| 4-Introduction | 3/3 | 11 min | 3.7 min |

**Recent Trend:**
- Last 5 plans: 03-01 (8 min), 03-02 (8 min), 04-01 (3 min), 04-03 (5 min), 04-02 (3 min)
- Trend: Consistent execution, averaging 3-8 min per plan

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

### Pending Todos

None.

### Blockers/Concerns

- Stripe CLI not installed - webhook signature testing pending user setup
- Discord bot requires user setup (Developer Portal, bot token, guild invite)
- STRIPE_INDIVIDUAL_PRICE_ID must be set before testing checkout
- DISCORD_INTRODUCTIONS_CHANNEL_ID must be set before testing introduction detection
- Message Content Intent must be enabled in Discord Developer Portal
- Pre-existing TypeScript errors in discord-oauth.ts and claim.ts need attention

## Phase 4 Progress

Introduction requirement progress:
- [x] 04-01: Message event infrastructure
- [x] 04-02: Role promotion logic
- [x] 04-03: Subscription end handling

Delivered (04-01):
- Discord client with MessageContent and GuildMessages intents
- DISCORD_INTRODUCTIONS_CHANNEL_ID env configuration
- lastGuidanceDmAt field for rate-limiting guidance DMs
- Introduction message event handlers (messageCreate, messageUpdate)
- Channel filtering (only #introductions), bot filtering, reply filtering

Delivered (04-02):
- swapRoleAsync function for atomic role swap with p-retry
- processIntroduction validates 100+ char text length
- sendGuidanceDM with 24-hour rate limit
- promoteAfterIntro swaps Squire to Knight/Lord based on seatTier
- sendWelcomeDM with medieval-themed welcome
- Party emoji reaction on valid introduction
- Database tracks introCompleted, introCompletedAt, introMessageId

Delivered (04-03):
- customer.subscription.deleted webhook handler
- removeAllManagedRoles removes Squire/Knight/Lord/Debtor roles
- removeAndKickAsync sends farewell DM then kicks with retry
- Database subscription status set to CANCELLED
- introCompleted reset to false for potential resubscription

## Session Continuity

Last session: 2026-01-19
Stopped at: Completed 04-02-PLAN.md (Phase 4 complete)
Resume file: None
