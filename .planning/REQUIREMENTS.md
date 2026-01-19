# Requirements: The Revenue Council Membership Gateway

**Defined:** 2025-01-18
**Core Value:** Paid members can access the community, and we always know who everyone is.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can initiate Discord OAuth to link their Discord account
- [x] **AUTH-02**: User session persists across browser refresh (secure token storage)
- [x] **AUTH-03**: User can request magic link login via email
- [x] **AUTH-04**: User can complete login via magic link click

### Payments

- [x] **PAY-01**: User can purchase Individual Monthly subscription via Stripe Checkout
- [x] **PAY-02**: User can purchase Company plan with owner seat via Stripe Checkout
- [x] **PAY-03**: System receives and processes Stripe webhook events
- [x] **PAY-04**: Webhook processing is idempotent (duplicate events are safely ignored)
- [x] **PAY-05**: Webhook signature is verified before processing
- [x] **PAY-06**: Company admin can add more owner seats mid-subscription
- [x] **PAY-07**: Company admin can add more team seats mid-subscription

### Discord Roles

- [x] **ROLE-01**: Bot assigns "Paid (Unintroduced)" role when user claims access
- [x] **ROLE-02**: Bot promotes user to "Member" role after introduction post
- [x] **ROLE-03**: Bot promotes company owner to "Owner" role after introduction post
- [x] **ROLE-04**: Bot assigns "Billing Issue" role when payment fails
- [x] **ROLE-05**: Bot removes "Billing Issue" and restores correct role when payment recovers
- [x] **ROLE-06**: Bot removes all managed roles when subscription is canceled/expired

### Onboarding

- [x] **ONB-01**: Unpaid user sees The Gatekeeper (public lobby) with join instructions
- [x] **ONB-02**: Paid user can access Claim page to link Stripe subscription to Discord
- [x] **ONB-03**: After claiming, user receives join instructions or Discord invite
- [x] **ONB-04**: Bot detects first message in #introductions and triggers role promotion
- [x] **ONB-05**: Paid (Unintroduced) user can only access #introductions and onboarding channels
- [x] **ONB-06**: Member/Owner can access full server (except owners-only for Members)
- [x] **ONB-07**: Owner can access owners-only channels

### Company/Team Management

- [x] **TEAM-01**: Company admin can view all claimed seats in dashboard
- [x] **TEAM-02**: Company admin can generate invite tokens for teammates
- [x] **TEAM-03**: Company admin can specify owner or team tier when generating invite
- [x] **TEAM-04**: Teammate can claim seat via invite token link
- [x] **TEAM-05**: Teammate claiming owner seat gets Owner role after introduction
- [x] **TEAM-06**: Teammate claiming team seat gets Member role after introduction
- [x] **TEAM-07**: Company admin can revoke a seat (removes user's access)
- [x] **TEAM-08**: Revoked seat becomes available for reallocation

### Billing Failure

- [x] **BILL-01**: System detects payment failure via webhook
- [x] **BILL-02**: Affected users are moved to Billing Issue role
- [x] **BILL-03**: Billing Issue users can only access #billing-issue channel
- [x] **BILL-04**: System detects payment recovery via webhook
- [x] **BILL-05**: On recovery, user is restored to Member or Owner based on intro status

### Email Notifications

- [x] **EMAIL-01**: Email infrastructure is configured (transactional email provider)
- [x] **EMAIL-02**: Welcome email sent after successful payment
- [x] **EMAIL-03**: Claim reminder email sent if user paid but hasn't linked Discord (after 24h)
- [x] **EMAIL-04**: Payment failure email sent when subscription payment fails
- [x] **EMAIL-05**: Payment recovered email sent when payment succeeds after failure
- [x] **EMAIL-06**: Seat invite email sent to teammate with claim link

### Operations

- [x] **OPS-01**: All Stripe events are logged with event ID for deduplication
- [ ] **OPS-02**: Reconciliation job runs daily to detect drift between Stripe and Discord
- [ ] **OPS-03**: Reconciliation job fixes role mismatches automatically
- [x] **OPS-04**: Database schema supports future CRM export (all relevant fields captured)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Billing

- **BILL-V2-01**: Grace period before moving to Billing Issue role (configurable days)

### Admin Dashboard

- **ADMIN-V2-01**: Super admin can view all organizations and members
- **ADMIN-V2-02**: Super admin can manually adjust roles
- **ADMIN-V2-03**: Super admin can view audit log of all actions

### Advanced Subscriptions

- **SUB-V2-01**: Annual billing option for individuals
- **SUB-V2-02**: Annual billing option for company plans
- **SUB-V2-03**: Discount codes and coupons

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full production VM deployment | MVP is local proof; deployment is post-MVP |
| Mobile app | Web-first approach; Discord mobile handles community access |
| Real-time chat features | Discord handles chat natively |
| CRM sync (HubSpot/Clay) | Export-ready only; actual sync is post-MVP |
| Multiple admins per company | Business partners pay for separate owner seats |
| OAuth providers beyond Discord | Discord is the only identity needed for this community |
| Trial periods | Pay-first model; no free trials |
| Refund automation | Manual refunds via Stripe dashboard |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| PAY-01 | Phase 3 | Pending |
| PAY-02 | Phase 5 | Complete |
| PAY-03 | Phase 1 | Complete |
| PAY-04 | Phase 1 | Complete |
| PAY-05 | Phase 1 | Complete |
| PAY-06 | Phase 5 | Complete |
| PAY-07 | Phase 5 | Complete |
| ROLE-01 | Phase 3 | Pending |
| ROLE-02 | Phase 4 | Complete |
| ROLE-03 | Phase 4 | Complete |
| ROLE-04 | Phase 6 | Complete |
| ROLE-05 | Phase 6 | Complete |
| ROLE-06 | Phase 4 | Complete |
| ONB-01 | Phase 3 | Pending |
| ONB-02 | Phase 3 | Pending |
| ONB-03 | Phase 3 | Pending |
| ONB-04 | Phase 4 | Complete |
| ONB-05 | Phase 3 | Pending |
| ONB-06 | Phase 4 | Complete |
| ONB-07 | Phase 4 | Complete |
| TEAM-01 | Phase 5 | Complete |
| TEAM-02 | Phase 5 | Complete |
| TEAM-03 | Phase 5 | Complete |
| TEAM-04 | Phase 5 | Complete |
| TEAM-05 | Phase 5 | Complete |
| TEAM-06 | Phase 5 | Complete |
| TEAM-07 | Phase 5 | Complete |
| TEAM-08 | Phase 5 | Complete |
| BILL-01 | Phase 6 | Complete |
| BILL-02 | Phase 6 | Complete |
| BILL-03 | Phase 6 | Complete |
| BILL-04 | Phase 6 | Complete |
| BILL-05 | Phase 6 | Complete |
| EMAIL-01 | Phase 7 | Complete |
| EMAIL-02 | Phase 7 | Complete |
| EMAIL-03 | Phase 7 | Complete |
| EMAIL-04 | Phase 7 | Complete |
| EMAIL-05 | Phase 7 | Complete |
| EMAIL-06 | Phase 7 | Complete |
| OPS-01 | Phase 1 | Complete |
| OPS-02 | Phase 8 | Pending |
| OPS-03 | Phase 8 | Pending |
| OPS-04 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0

---
*Requirements defined: 2025-01-18*
*Last updated: 2026-01-19 after Phase 7 completion*
