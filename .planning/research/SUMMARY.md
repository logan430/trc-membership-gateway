# Project Research Summary

**Project:** The Revenue Council Membership Gateway
**Domain:** Stripe + Discord Membership System (Paid Community Access)
**Researched:** 2026-01-18
**Confidence:** HIGH

## Executive Summary

The Revenue Council membership gateway is a Stripe + Discord integration that follows a pay-first access model: users must purchase a subscription before gaining Discord access. This inverts the typical invite-first pattern used by most membership platforms. Research reveals this is a well-documented domain with established patterns from both Stripe and Discord, but the B2B team/seat management requirement is a significant differentiator that existing solutions (LaunchPass, Whop, PayBot) do not address.

The recommended approach is an event-driven architecture where Stripe webhooks are the single source of truth for billing state. All subscription changes flow through Stripe webhooks, which update a local Postgres database via Prisma, which in turn triggers Discord role synchronization. The Express web layer handles webhooks and OAuth, while a separate Discord.js bot process manages roles and monitors introductions. This separation allows independent scaling and cleaner process boundaries.

The highest-risk areas are webhook security (signature verification is non-negotiable) and webhook reliability (idempotency and out-of-order event handling). Both must be architectural decisions from day one. The most likely source of customer complaints will be billing failure handling - aggressive access revocation causes involuntary churn, which represents 50% of subscription losses industry-wide.

## Key Findings

### Recommended Stack

The stack prioritizes durability over speed and type safety over convenience. Express was chosen over faster alternatives (Fastify, Hono) because Stripe's documentation is Express-native and the performance difference is irrelevant at membership gateway scale (<100 RPS).

**Core technologies:**
- **Node.js 20 LTS + TypeScript 5.9**: Runtime stability for payment handling; strict mode catches Stripe API misuse at compile time
- **Express 5.2**: Mature webhook signature verification, excellent Stripe documentation alignment
- **Prisma 7.2 + Supabase Postgres**: Type-safe ORM with managed database; requires separate pooled/direct connection URLs
- **Stripe SDK 20.2**: Official Node SDK with excellent TypeScript types
- **discord.js 14.25**: Stable v14 release line, handles role management and Gateway events
- **jose 6.1**: Modern JWT handling for session management; preferred over jsonwebtoken
- **Zod 4.3**: Runtime schema validation with TypeScript inference

**What NOT to use:**
- `passport-discord` (abandoned)
- `@supabase/supabase-js` (conflicts with Prisma client)
- Local session storage (use JWT, stateless is simpler)

### Expected Features

**Must have (table stakes):**
- Stripe payment integration (direct API, no platform fees)
- Automatic role assignment on payment success
- Automatic role removal on cancellation
- Discord OAuth account linking
- Webhook-driven subscription status sync
- Multiple subscription tiers (Individual Monthly/Annual at minimum)
- Payment failure notifications

**Should have (competitive/differentiators):**
- Company/team seat management (rare in Discord space)
- Seat owner dashboard (add/remove team members)
- Billing failure grace period (restrict access, do not kick)
- Introduction requirement before full access
- Invite-less onboarding (pay-first model)
- Self-service seat transfer

**Defer (v2+):**
- White-label checkout (branding customization)
- Advanced billing (proration UI, custom cycles)
- Introduction validation AI (content quality checking)

### Architecture Approach

The system follows an event-driven, webhook-centric architecture with clear separation between web application (Express), bot process (Discord.js), and data layer (Prisma/Supabase). The "thin bot, fat backend" pattern keeps business logic in the Express API while the bot acts as a frontend client for Discord operations.

**Major components:**
1. **Stripe Webhook Handler** - Receive events, verify signatures, process idempotently, update database
2. **Discord OAuth Handler** - Link Discord accounts to Stripe customers, handle authorization flow
3. **Discord Bot (Role Manager)** - Assign/revoke roles based on subscription status
4. **Discord Bot (Intro Monitor)** - Track new member introductions, manage verification flow
5. **Seat Management Dashboard** - Company admins manage team seats (add/remove/transfer)
6. **Reconciliation Worker** - Daily job to catch webhook delivery failures

**Key data entities:**
- Member (Discord + Stripe identity, subscription status)
- Team (company subscription, seat count, members)
- PendingInvite (token-based team invitations)
- StripeEvent (idempotency tracking)

### Critical Pitfalls

1. **Missing Webhook Signature Verification** - Attackers can forge payloads to grant unauthorized access. Use `stripe.webhooks.constructEvent()` with timing-safe comparison. Address in Phase 1.

2. **Non-Idempotent Webhook Processing** - Stripe delivers at-least-once. Without idempotency, duplicate role assignments and database entries occur. Store event IDs before processing. Address in Phase 1.

3. **Webhook Event Order Assumption** - Stripe does NOT guarantee delivery order. `subscription.updated` may arrive before `subscription.created`. Use event timestamps, fetch current state from Stripe API when in doubt. Address in Phase 1.

4. **Discord Bot Token Exposure** - 600+ tokens leaked on CodeSandbox in 2025 alone. Store in `.env`, add to `.gitignore`, enable GitHub secret scanning. Address in Phase 1.

5. **Discord Role Hierarchy Misconfiguration** - Bot role must be ABOVE managed roles. Silent 403 failures cause paid members to not receive access. Add startup hierarchy validation. Address in Phase 2.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Webhook Infrastructure
**Rationale:** Everything depends on database schema and Stripe webhook handling. Security patterns (signature verification, idempotency) must be architectural decisions from day one.
**Delivers:** Database schema, Stripe webhook handler, environment configuration, project skeleton
**Addresses:** Core infrastructure, webhook security, idempotency pattern
**Avoids:** Pitfalls 1-4 (signature verification, idempotency, event order, token exposure)

### Phase 2: Discord Integration and OAuth
**Rationale:** Requires webhook handler from Phase 1. Role management is the core value proposition.
**Delivers:** Discord OAuth flow, bot registration, role manager, startup validation
**Addresses:** Account linking, automatic role assignment/removal
**Avoids:** Pitfall 5 (role hierarchy), Pitfall 8 (rate limiting)

### Phase 3: Individual Subscription Flow
**Rationale:** End-to-end individual user flow before tackling team complexity. Proves core patterns work.
**Delivers:** Stripe Checkout integration, subscription lifecycle, cancellation handling, payment failure notifications
**Addresses:** Table stakes features for individual users
**Uses:** Webhook handler, OAuth, role manager from Phases 1-2

### Phase 4: Introduction Requirement
**Rationale:** Adds onboarding friction; should validate individual flow is solid first.
**Delivers:** Intro channel monitoring, @Unverified/@Trial roles, intro completion tracking
**Addresses:** Community quality control feature

### Phase 5: Team/Seat Management
**Rationale:** Most complex feature. Builds on proven individual patterns. B2B differentiator.
**Delivers:** Team model, seat allocation, admin dashboard, invite system
**Addresses:** Company plans, seat owner dashboard, seat transfer
**Avoids:** Pitfall 6 (seat desync), Pitfall 10 (invite token security)

### Phase 6: Billing Failure Handling
**Rationale:** Polish phase. Requires subscription flow to be working. Reduces involuntary churn.
**Delivers:** Grace period logic, restricted access state, dunning notifications
**Addresses:** Billing failure grace period, payment failure notifications
**Avoids:** Pitfall 7 (grace period mishandling)

### Phase 7: Operational Hardening
**Rationale:** Safety net features. Not on critical path but prevent state drift over time.
**Delivers:** Reconciliation worker, monitoring, audit logging
**Addresses:** Catching missed webhooks, state drift detection
**Avoids:** Pitfall 14 (no reconciliation)

### Phase Ordering Rationale

- **Dependency chain:** Database schema > webhooks > OAuth > roles > subscriptions > teams
- **Risk mitigation:** Security patterns (Phases 1-2) established before any production traffic
- **Prove patterns early:** Individual flow (Phase 3) validates architecture before team complexity
- **B2B deferral justified:** Team features are differentiator but not launch blocker for individual subscribers

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 5 (Team/Seat Management):** Complex seat quantity synchronization with Stripe, proration edge cases
- **Phase 6 (Billing Failure Handling):** Stripe Smart Retries configuration, optimal grace period length

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Well-documented Stripe webhook patterns
- **Phase 2 (Discord Integration):** discord.js v14 role management is mature
- **Phase 3 (Individual Subscription):** Stripe Checkout is battle-tested

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via npm 2026-01-18; official docs referenced |
| Features | HIGH | Cross-referenced with multiple commercial solutions (LaunchPass, Whop, PayBot, Upgrade.chat) |
| Architecture | HIGH | Patterns verified across open-source implementations (stripe-discord-bot, StripeCord) and Stripe official examples |
| Pitfalls | HIGH | Sources include official docs, security advisories, and well-documented community issues |

**Overall confidence:** HIGH

### Gaps to Address

- **Team seat proration UX:** Stripe handles proration automatically but unclear how to present confusing invoices to customers. Address in Phase 5 planning.
- **Invite-less onboarding flow:** Pay-first model requires programmatic guild join via `guilds.join` OAuth scope. Verify Discord approval requirements during Phase 2.
- **Introduction validation criteria:** What makes a "valid" introduction? Defer policy decision to Phase 4 planning.
- **Grace period duration:** Research suggests 7-14 days optimal. Validate with business requirements in Phase 6.

## Sources

### Primary (HIGH confidence)
- [Stripe Webhooks Documentation](https://docs.stripe.com/webhooks) - signature verification, event handling
- [Stripe Subscription Billing](https://docs.stripe.com/billing/subscriptions/overview) - subscription states, webhooks
- [Discord OAuth2 Documentation](https://discord.com/developers/docs/topics/oauth2) - authorization flow, scopes
- [Discord Rate Limits](https://discord.com/developers/docs/topics/rate-limits) - role modification limits
- [Prisma + Supabase Setup](https://www.prisma.io/docs/orm/overview/databases/supabase) - connection configuration
- [discord.js v14 Documentation](https://discord.js.org/docs) - role management

### Secondary (MEDIUM confidence)
- [stripe-discord-bot (GitHub)](https://github.com/Androz2091/stripe-discord-bot) - reference implementation
- [StripeCord (GitHub)](https://github.com/Rodaviva29/StripeCord) - alternative implementation
- [Stigg - Stripe Webhook Best Practices](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) - production lessons
- [MakerKit - Per-Seat Subscriptions](https://makerkit.dev/recipes/per-seat-stripe-subscriptions) - seat management patterns

### Tertiary (LOW confidence)
- Framework performance comparisons (Express vs Fastify vs Hono) - benchmarks vary, used for context only

---
*Research completed: 2026-01-18*
*Ready for roadmap: yes*
