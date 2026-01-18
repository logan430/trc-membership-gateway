# The Revenue Council - Discord Membership Gateway

## What This Is

A Stripe-backed membership gateway that controls access to The Revenue Council Discord community. Members must pay first (via Stripe subscription), then link their Discord account, join the server, and introduce themselves before gaining full access. Supports both individual memberships and company plans with tiered seat allocation (owner vs team).

## Core Value

**Paid members can access the community, and we always know who everyone is.** If payment works and introductions are enforced, everything else is details.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Individual subscription flow (pay → claim → join → intro → Member)
- [ ] Company subscription with owner and team seat tiers
- [ ] Seat management dashboard for company admins
- [ ] Discord OAuth linking (no email matching)
- [ ] Role-based access control (Paid Unintroduced, Member, Owner, Billing Issue)
- [ ] Introduction enforcement in #introductions
- [ ] Billing failure handling (restrict access, don't kick)
- [ ] Webhook-driven sync between Stripe and Discord roles
- [ ] Durable membership database in Supabase Postgres

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
- **#billing-issue** - Restricted channel for members with payment problems

Members are typically referred or driven via ads/social media. The Discord doesn't need to sell itself - it just facilitates the transaction and onboarding.

**Technical environment:**
- Node.js + TypeScript + Express (API/Web)
- Discord.js bot
- Supabase Postgres with Prisma ORM
- Stripe for payments (test mode for MVP)
- Local development with Stripe CLI webhook forwarding

## Constraints

- **Database**: Supabase Postgres — chosen for team project, portability, and future CRM sync readiness
- **ORM**: Prisma — stability, strong migrations, type safety
- **Stripe as SoR**: Stripe is the source of truth for subscription status; DB mirrors for portability
- **Local proof first**: MVP runs locally with test Discord server and Stripe test mode
- **Idempotent webhooks**: All Stripe webhook handlers must be idempotent (dedupe by event ID)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pay-first model (no free tier) | Community is premium, paid access only | — Pending |
| Two seat tiers (owner/team) | Owner seats cost more, grant exclusive channel access | — Pending |
| Seat management dashboard in MVP | Admins need self-service seat revocation/reassignment | — Pending |
| Introduction required for full access | Professional community needs members to identify themselves for networking value | — Pending |
| Restrict on billing failure, don't kick | Preserves relationship, gives time to fix payment | — Pending |
| The Gatekeeper public lobby | Minimal public area for unpaid visitors explaining how to join | — Pending |

---
*Last updated: 2025-01-18 after initialization*
