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
- ✓ Anonymous peer benchmarking (4 categories, k-anonymity, outlier detection) — v2.0
- ✓ Curated resource library with Supabase Storage and download tracking — v2.0
- ✓ Gamification system (points, leaderboard, streaks) — v2.0
- ✓ Admin analytics dashboard with engagement metrics and churn prediction — v2.0
- ✓ React/Next.js member dashboard with Recharts visualizations — v2.0
- ✓ Unified Next.js frontend (admin pages, auth pages migrated) — v2.1
- ✓ Legal pages (Terms, Privacy) and password reset flow — v2.1
- ✓ UI/UX polish (favicon, branding, session fixes) — v2.1

### Active

**Current Milestone: v2.2 Production Deployment & Launch**

**Goal:** Deploy the complete membership gateway to Coolify, configure all external integrations with production URLs, validate end-to-end flows with real services, and prepare for public launch.

**Target features:**
- Coolify deployment (Express backend + Next.js frontend containers)
- Domain configuration with SSL via Coolify
- Stripe integration with production webhook URLs (test mode → live mode transition)
- Discord integration with test server (bot, OAuth, role assignment)
- Supabase connectivity from production environment
- End-to-end testing with seed data and real payment verification
- Production reset script (clean slate while preserving admin/config access)
- Go-live transition to production Discord server

**Success criteria:**
- Application accessible via custom domain with SSL
- Stripe webhooks fire and process correctly in production
- Discord OAuth completes successfully with role assignment
- Member can complete full flow: signup → payment → Discord link → intro → access
- Admin can login and manage members/configs in production
- Database can be reset while preserving admin/config data
- Successful transition from test to live Stripe mode

### Out of Scope

- Multi-product billing, discounts, annual plans, coupons
- Full CRM sync (HubSpot/Clay) — only export-ready data structures
- Real-time chat features beyond Discord's native capabilities
- Mobile app
- Automated CI/CD pipelines (manual deployment for v2.2)
- Blue-green deployments or zero-downtime updates

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
*Last updated: 2026-01-28 after v2.2 milestone initialization*
