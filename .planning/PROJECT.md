# The Revenue Council - Discord Membership Gateway

## What This Is

A Stripe-backed membership gateway that controls access to The Revenue Council Discord community. Members must pay first (via Stripe subscription), then link their Discord account, join the server, and introduce themselves before gaining full access. Supports both individual memberships and company plans with tiered seat allocation (owner vs team).

## Core Value

**Paid members can access the community, and we always know who everyone is.** If payment works and introductions are enforced, everything else is details.

## Requirements

### Validated

- ✓ Individual subscription flow (pay → claim → join → intro → Member) — v1.0
- ✓ Company subscription with owner and team seat tiers — v1.0
- ✓ Seat management dashboard for company admins — v1.0
- ✓ Discord OAuth linking (no email matching) — v1.0
- ✓ Role-based access control (Squire, Knight, Lord, Debtor roles) — v1.0
- ✓ Introduction enforcement in #introductions — v1.0
- ✓ Billing failure handling (restrict access with grace period, don't kick) — v1.0
- ✓ Webhook-driven sync between Stripe and Discord roles — v1.0
- ✓ Durable membership database in Supabase Postgres — v1.0
- ✓ Admin system with member management, audit logs, feature flags — v1.0
- ✓ Email notifications for all lifecycle events — v1.0
- ✓ Member self-service portal with account and billing management — v1.0

### Active

(None - milestone complete, define new requirements for next milestone)

### Out of Scope

- Full production deployment (VM deployment is post-MVP)
- Multi-product billing, discounts, annual plans, coupons
- Advanced admin dashboard UX (basic dashboard only for MVP)
- Full CRM sync (HubSpot/Clay) — only export-ready data structures
- Real-time chat features beyond Discord's native capabilities
- Mobile app

## Context

**The Revenue Council** is a professional community of successful entrepreneurs. Members join for networking, referrals, and collaboration opportunities. The Discord server has:

- **The Gatekeeper** - Public-facing minimal experience explaining what the community is and how to join
- **#introductions** - Where new paid members post their name, company, role, and what they're looking for
- **Owners-only channels** - Exclusive areas for company owners/admins
- **General member channels** - Full community access for all introduced members
- **#billing-support** - Restricted channel for members with payment problems (Debtor role)

Members are typically referred or driven via ads/social media. The Discord doesn't need to sell itself - it just facilitates the transaction and onboarding.

**Technical environment:**
- Node.js + TypeScript + Express (API/Web)
- Discord.js bot with medieval role theme (Squire, Knight, Lord, Debtor)
- Supabase Postgres with Prisma ORM
- Stripe for payments (webhooks are source of truth)
- Resend for transactional emails
- Sentry for error monitoring
- Local development with Stripe CLI webhook forwarding

**Shipped v1.0 with:**
- 8,947 lines of TypeScript across 295 files
- 25 phases, 60 plans, 114 feature commits
- Production-ready with security audit, data integrity verification, operational runbook
- Comprehensive admin dashboard and member self-service portal
- Email notification system for all lifecycle events

## Constraints

- **Database**: Supabase Postgres — chosen for team project, portability, and future CRM sync readiness
- **ORM**: Prisma — stability, strong migrations, type safety
- **Stripe as SoR**: Stripe is the source of truth for subscription status; DB mirrors for portability
- **Local proof first**: MVP runs locally with test Discord server and Stripe test mode
- **Idempotent webhooks**: All Stripe webhook handlers must be idempotent (dedupe by event ID)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pay-first model (no free tier) | Community is premium, paid access only | ✓ Good - Clean subscription flow |
| Two seat tiers (owner/team) | Owner seats cost more, grant exclusive channel access | ✓ Good - Lord vs Knight roles work well |
| Seat management dashboard in MVP | Admins need self-service seat revocation/reassignment | ✓ Good - Full CRUD complete |
| Introduction required for full access | Professional community needs members to identify themselves for networking value | ✓ Good - Squire → Knight/Lord promotion |
| Restrict on billing failure, don't kick | Preserves relationship, gives time to fix payment | ✓ Good - Debtor role with #billing-support |
| The Gatekeeper public lobby | Minimal public area for unpaid visitors explaining how to join | ✓ Good - Medieval theme resonates |
| Medieval role theme (Squire, Knight, Lord, Debtor) | Aligns with "Revenue Council" branding | ✓ Good - Consistent aesthetic |
| Stripe as source of truth | Database mirrors Stripe, webhook-driven sync | ✓ Good - Clean separation of concerns |
| Express 5.x over Fastify/Hono | Stripe documentation alignment | ✓ Good - No friction with examples |
| Argon2id for password hashing | OWASP 2025 recommendation | ✓ Good - Industry standard security |
| Fire-and-forget Discord operations with p-retry | Async role assignment with exponential backoff | ✓ Good - Handles rate limits gracefully |
| 15min access / 7-30d refresh tokens | Balance security with UX | ✓ Good - Token auto-refresh prevents logout |
| Admin system in v1 | Essential for production management | ✓ Good - Full audit trail and control |
| Email template editing in database | Dynamic content without deploys | ✓ Good - Admin self-service |
| Seed data for testing | Comprehensive test scenarios | ✓ Good - Fast development iteration |

---
*Last updated: 2026-01-22 after v1.0 milestone completion*
