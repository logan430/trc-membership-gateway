# Roadmap: The Revenue Council Membership Gateway

## Overview

This roadmap delivers a Stripe-backed membership gateway for The Revenue Council Discord community. The journey progresses from secure infrastructure (webhooks, database) through Discord integration, individual subscription flow, introduction enforcement, and finally the B2B differentiator: company seat management. Billing failure handling and operational hardening complete the system. Each phase delivers a coherent, verifiable capability that enables the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Database schema, Stripe webhook infrastructure, project skeleton
- [ ] **Phase 2: Discord Integration** - OAuth linking, bot setup, role management core
- [ ] **Phase 3: Individual Subscription** - Stripe Checkout, claim flow, basic role assignment
- [ ] **Phase 4: Introduction Requirement** - Introduction monitoring, role promotion to Member/Owner
- [ ] **Phase 5: Team Management** - Company plans, seat dashboard, invite system
- [ ] **Phase 6: Billing Failure** - Billing Issue role, access restriction, recovery
- [ ] **Phase 7: Email Notifications** - Transactional emails for all lifecycle events
- [ ] **Phase 8: Operations** - Reconciliation, audit logging, CRM-ready schema

## Phase Details

### Phase 1: Foundation
**Goal**: Secure, reliable infrastructure is in place to receive Stripe events and persist membership data
**Depends on**: Nothing (first phase)
**Requirements**: PAY-03, PAY-04, PAY-05, OPS-01, OPS-04
**Success Criteria** (what must be TRUE):
  1. Stripe webhook endpoint receives events and returns 200 OK
  2. Duplicate webhook events are safely ignored (idempotent processing)
  3. Invalid webhook signatures are rejected with 400
  4. All Stripe events are logged with event ID for deduplication
  5. Database schema captures all fields needed for future CRM export
**Plans**: 3 plans in 2 waves

Plans:
- [x] 01-01-PLAN.md - Project skeleton and environment configuration (Wave 1)
- [x] 01-02-PLAN.md - Database schema and Prisma setup (Wave 1)
- [x] 01-03-PLAN.md - Stripe webhook handler with signature verification and idempotency (Wave 2)

### Phase 2: Discord Integration
**Goal**: Users can link their Discord account and the bot can manage roles
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. User can initiate Discord OAuth and link their Discord account
  2. User session persists across browser refresh
  3. User can request and complete magic link login via email
  4. Bot is online and can assign/remove roles from members
**Plans**: TBD

Plans:
- [ ] 02-01: Discord OAuth flow implementation
- [ ] 02-02: Session management (JWT tokens)
- [ ] 02-03: Magic link authentication
- [ ] 02-04: Discord bot setup with role management capability

### Phase 3: Individual Subscription
**Goal**: Individual users can pay, claim access, and receive their initial Discord role
**Depends on**: Phase 2
**Requirements**: PAY-01, ONB-01, ONB-02, ONB-03, ONB-05, ROLE-01
**Success Criteria** (what must be TRUE):
  1. Unpaid user sees The Gatekeeper with join instructions
  2. User can purchase Individual Monthly subscription via Stripe Checkout
  3. Paid user can access Claim page to link subscription to Discord
  4. After claiming, user receives Discord invite and is assigned "Paid (Unintroduced)" role
  5. Paid (Unintroduced) user can only access #introductions and onboarding channels
**Plans**: TBD

Plans:
- [ ] 03-01: Stripe Checkout for Individual Monthly
- [ ] 03-02: Claim page and Discord linking flow
- [ ] 03-03: Initial role assignment and channel restrictions

### Phase 4: Introduction Requirement
**Goal**: Users must introduce themselves before gaining full community access
**Depends on**: Phase 3
**Requirements**: ONB-04, ONB-06, ONB-07, ROLE-02, ROLE-03, ROLE-06
**Success Criteria** (what must be TRUE):
  1. Bot detects first message in #introductions and triggers role promotion
  2. Individual user is promoted from "Paid (Unintroduced)" to "Member" after intro
  3. Company owner is promoted to "Owner" role after intro
  4. Member can access full server (except owners-only channels)
  5. Owner can access owners-only channels
  6. Bot removes all managed roles when subscription is canceled/expired
**Plans**: TBD

Plans:
- [ ] 04-01: Introduction detection in #introductions
- [ ] 04-02: Role promotion logic (Member vs Owner)
- [ ] 04-03: Cancellation/expiration role removal

### Phase 5: Team Management
**Goal**: Companies can purchase plans and manage team seats
**Depends on**: Phase 4
**Requirements**: PAY-02, PAY-06, PAY-07, TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05, TEAM-06, TEAM-07, TEAM-08
**Success Criteria** (what must be TRUE):
  1. User can purchase Company plan with owner seat via Stripe Checkout
  2. Company admin can view all claimed seats in dashboard
  3. Company admin can generate invite tokens specifying owner or team tier
  4. Teammate can claim seat via invite token link
  5. Teammate claiming owner seat gets Owner role after introduction
  6. Teammate claiming team seat gets Member role after introduction
  7. Company admin can revoke a seat and that seat becomes available for reallocation
  8. Company admin can add more owner or team seats mid-subscription
**Plans**: TBD

Plans:
- [ ] 05-01: Company subscription and seat model
- [ ] 05-02: Seat management dashboard
- [ ] 05-03: Invite token generation and claiming
- [ ] 05-04: Seat revocation and reallocation
- [ ] 05-05: Mid-subscription seat additions

### Phase 6: Billing Failure
**Goal**: Payment failures restrict access gracefully; recovery restores access
**Depends on**: Phase 4
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, ROLE-04, ROLE-05
**Success Criteria** (what must be TRUE):
  1. System detects payment failure via webhook
  2. Affected users are moved to "Billing Issue" role
  3. Billing Issue users can only access #billing-issue channel
  4. System detects payment recovery via webhook
  5. On recovery, user is restored to Member or Owner role based on intro status
**Plans**: TBD

Plans:
- [ ] 06-01: Payment failure detection and Billing Issue role assignment
- [ ] 06-02: Billing Issue channel restrictions
- [ ] 06-03: Payment recovery detection and role restoration

### Phase 7: Email Notifications
**Goal**: Users receive transactional emails for all key lifecycle events
**Depends on**: Phase 5, Phase 6
**Requirements**: EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05, EMAIL-06
**Success Criteria** (what must be TRUE):
  1. Email infrastructure is configured and can send transactional emails
  2. Welcome email is sent after successful payment
  3. Claim reminder email is sent if user paid but hasn't linked Discord (after 24h)
  4. Payment failure email is sent when subscription payment fails
  5. Payment recovered email is sent when payment succeeds after failure
  6. Seat invite email is sent to teammate with claim link
**Plans**: TBD

Plans:
- [ ] 07-01: Email infrastructure setup
- [ ] 07-02: Payment and onboarding emails (welcome, claim reminder)
- [ ] 07-03: Billing failure and recovery emails
- [ ] 07-04: Team invite emails

### Phase 8: Operations
**Goal**: System detects and corrects drift between Stripe and Discord state
**Depends on**: Phase 6
**Requirements**: OPS-02, OPS-03
**Success Criteria** (what must be TRUE):
  1. Reconciliation job runs daily
  2. Reconciliation detects drift between Stripe subscription status and Discord roles
  3. Reconciliation automatically fixes role mismatches
**Plans**: TBD

Plans:
- [ ] 08-01: Reconciliation job implementation
- [ ] 08-02: Drift detection and auto-fix logic

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-01-18 |
| 2. Discord Integration | 0/4 | Not started | - |
| 3. Individual Subscription | 0/3 | Not started | - |
| 4. Introduction Requirement | 0/3 | Not started | - |
| 5. Team Management | 0/5 | Not started | - |
| 6. Billing Failure | 0/3 | Not started | - |
| 7. Email Notifications | 0/4 | Not started | - |
| 8. Operations | 0/2 | Not started | - |

---
*Roadmap created: 2025-01-18*
*Phase 1 planned: 2025-01-18*
*Total requirements: 41 | Total phases: 8 | Total plans: 27*
