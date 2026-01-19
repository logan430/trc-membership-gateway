# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-01-18)

**Core value:** Paid members can access the community, and we always know who everyone is.
**Current focus:** Milestone complete - all phases executed

## Current Position

Phase: 8 of 8 (Operations)
Plan: 2 of 2 in current phase
Status: Milestone complete, all phases verified ✓
Last activity: 2026-01-19 - Completed Phase 8 execution and verification

Progress: [██████████] 100% (29/29 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 29
- Average duration: 4.6 min
- Total execution time: 134 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1-Foundation | 3/3 | 24 min | 8 min |
| 2-Discord | 4/4 | 18 min | 4.5 min |
| 3-Individual | 3/3 | 20 min | 6.7 min |
| 4-Introduction | 3/3 | 11 min | 3.7 min |
| 5-Team | 6/6 | 26 min | 4.3 min |
| 6-Billing Failure | 4/4 | 16 min | 4 min |
| 7-Email Notifications | 4/4 | 17 min | 4.3 min |
| 8-Operations | 2/2 | 7 min | 3.5 min |

**Recent Trend:**
- Last 5 plans: 07-03 (4 min), 07-04 (5 min), 08-01 (3 min), 08-02 (4 min)
- Trend: Consistent execution, averaging 4 min per plan

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
| 05-04 | Discord OAuth only for team claim | Per CONTEXT.md - no email/password required |
| 05-04 | Prisma $transaction for seat claim | Atomic operation prevents race conditions |
| 05-04 | Individual subscriber blocking | Clear message, prevents duplicate membership |
| 05-04 | INDIVIDUAL seatTier maps to Lord | Per CONTEXT.md hierarchy: Individual = Owner |
| 05-05 | Generic farewell DM on revocation | No blame assigned per CONTEXT.md |
| 05-05 | Revoked member record preserved | Unlinked from team but record kept |
| 05-05 | Primary owner cannot be revoked | isPrimaryOwner check enforced |
| 05-05 | Cannot revoke your own seat | Self-revocation blocked |
| 05-06 | always_invoice proration | Immediate charge for new seats |
| 05-06 | Webhook-driven database sync | Stripe is source of truth for seat counts |
| 05-06 | mapStripeStatus helper | Consistent status mapping across handlers |
| 06-01 | String array for notification tracking | sentBillingNotifications tracks notification keys to prevent duplicates |
| 06-02 | Check billing_reason === 'subscription_cycle' | Only renewal failures trigger grace period, not checkout failures |
| 06-02 | Grace period not reset on retry failures | Only set paymentFailedAt if null |
| 06-02 | Owner detection via isPrimaryOwner OR isTeamAdmin | Both roles get full billing details |
| 06-03 | Previous role stored BEFORE role changes | Per RESEARCH.md pitfall - cannot restore if not captured first |
| 06-03 | 5-minute polling interval | Database-backed, survives restarts, no external dependencies |
| 06-03 | Notification marked sent even if DM fails | User may have DMs disabled; prevents spam on retry |
| 06-04 | invoice.paid for recovery detection | More common than invoice.payment_succeeded, equivalent |
| 06-04 | Default to Knight if previousRole is null | Safety fallback if role wasn't captured |
| 06-04 | Billing banner on paymentFailedAt OR PAST_DUE | Both conditions indicate billing issue |
| 07-01 | EMAIL_PROVIDER env var switch | Development without API keys, production with Resend |
| 07-01 | Provider pattern for email | Clean abstraction for testing and swappable delivery |
| 07-01 | Zod .refine() for conditional API key | App can start with console provider without Resend credentials |
| 07-02 | Cheeky tone at 30+ days | Per CONTEXT.md - express gratitude and desire to have them |
| 07-02 | Claim reminder schedule 48h-180d | 48h, 7d, 30d, then monthly for 6 months |
| 07-02 | Fire-and-forget email pattern | Use .catch() to not block checkout/webhook flow |
| 07-02 | Re-check discordId before send | Prevents race condition with claim |
| 07-03 | Fire-and-forget billing emails | Use .catch() pattern for billing emails, don't block webhooks |
| 07-03 | Owners only for team emails | isPrimaryOwner or isTeamAdmin get billing emails |
| 07-03 | Fresh portal URL per email | Generate Stripe billing portal session for each failure email |
| 07-04 | Optional email field on invites | Admin can still share link manually per CONTEXT.md |
| 07-04 | Fire-and-forget invite email | Don't fail invite creation if email fails |
| 07-04 | Full TRC context in invite | Recipients may not know The Revenue Council |
| 08-01 | node-cron for reconciliation | Lightweight, timezone-aware, consistent with billing scheduler pattern |
| 08-02 | Three-way comparison | Stripe vs Database vs Discord for complete drift detection |
| 08-02 | Batch 5 fixes with 2s delays | Discord rate limits 10 role ops per 10s |
| 08-02 | Verification re-run after fixes | One-shot cron 1 hour later confirms fixes applied |

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

## Phase 8 Progress

Operations reconciliation progress:
- [x] 08-01: Reconciliation infrastructure
- [x] 08-02: Drift detection logic (COMPLETE)

Delivered (08-01):
- ReconciliationRun model in prisma schema
- RECONCILIATION_AUTO_FIX, RECONCILIATION_PAUSED, RECONCILIATION_TIMEZONE, RECONCILIATION_HOUR env vars
- ADMIN_EMAIL env var for reports
- node-cron@4.2.1 for scheduling
- DriftType, DriftSeverity, DriftIssue types
- ReconciliationResult, ReconciliationOptions interfaces
- startReconciliationScheduler() function
- Re-exported types from src/reconciliation/index.ts

Delivered (08-02):
- detectMemberDrift() and detectTeamDrift() functions
- applyFixes() with rate limiting (batch 5, delay 2s)
- notifyAdmins() for Discord channel + email alerts
- runReconciliation() orchestration function
- Stripe subscription map builder (auto-pagination)
- Discord member map builder (fresh fetch)
- Verification re-run scheduling (1 hour after fixes)
- reconciliationReportEmailTemplate for admin emails
- sendReconciliationReportEmail function
- Scheduler wired to app startup

## Session Continuity

Last session: 2026-01-19
Stopped at: Milestone complete - all 8 phases executed and verified
Resume file: None
Next: /gsd:audit-milestone for requirement verification and cross-phase integration checks
