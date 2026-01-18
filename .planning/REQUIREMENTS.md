# Requirements: The Revenue Council Membership Gateway

**Defined:** 2025-01-18
**Core Value:** Paid members can access the community, and we always know who everyone is.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can initiate Discord OAuth to link their Discord account
- [ ] **AUTH-02**: User session persists across browser refresh (secure token storage)
- [ ] **AUTH-03**: User can request magic link login via email
- [ ] **AUTH-04**: User can complete login via magic link click

### Payments

- [ ] **PAY-01**: User can purchase Individual Monthly subscription via Stripe Checkout
- [ ] **PAY-02**: User can purchase Company plan with owner seat via Stripe Checkout
- [ ] **PAY-03**: System receives and processes Stripe webhook events
- [ ] **PAY-04**: Webhook processing is idempotent (duplicate events are safely ignored)
- [ ] **PAY-05**: Webhook signature is verified before processing
- [ ] **PAY-06**: Company admin can add more owner seats mid-subscription
- [ ] **PAY-07**: Company admin can add more team seats mid-subscription

### Discord Roles

- [ ] **ROLE-01**: Bot assigns "Paid (Unintroduced)" role when user claims access
- [ ] **ROLE-02**: Bot promotes user to "Member" role after introduction post
- [ ] **ROLE-03**: Bot promotes company owner to "Owner" role after introduction post
- [ ] **ROLE-04**: Bot assigns "Billing Issue" role when payment fails
- [ ] **ROLE-05**: Bot removes "Billing Issue" and restores correct role when payment recovers
- [ ] **ROLE-06**: Bot removes all managed roles when subscription is canceled/expired

### Onboarding

- [ ] **ONB-01**: Unpaid user sees The Gatekeeper (public lobby) with join instructions
- [ ] **ONB-02**: Paid user can access Claim page to link Stripe subscription to Discord
- [ ] **ONB-03**: After claiming, user receives join instructions or Discord invite
- [ ] **ONB-04**: Bot detects first message in #introductions and triggers role promotion
- [ ] **ONB-05**: Paid (Unintroduced) user can only access #introductions and onboarding channels
- [ ] **ONB-06**: Member/Owner can access full server (except owners-only for Members)
- [ ] **ONB-07**: Owner can access owners-only channels

### Company/Team Management

- [ ] **TEAM-01**: Company admin can view all claimed seats in dashboard
- [ ] **TEAM-02**: Company admin can generate invite tokens for teammates
- [ ] **TEAM-03**: Company admin can specify owner or team tier when generating invite
- [ ] **TEAM-04**: Teammate can claim seat via invite token link
- [ ] **TEAM-05**: Teammate claiming owner seat gets Owner role after introduction
- [ ] **TEAM-06**: Teammate claiming team seat gets Member role after introduction
- [ ] **TEAM-07**: Company admin can revoke a seat (removes user's access)
- [ ] **TEAM-08**: Revoked seat becomes available for reallocation

### Billing Failure

- [ ] **BILL-01**: System detects payment failure via webhook
- [ ] **BILL-02**: Affected users are moved to Billing Issue role
- [ ] **BILL-03**: Billing Issue users can only access #billing-issue channel
- [ ] **BILL-04**: System detects payment recovery via webhook
- [ ] **BILL-05**: On recovery, user is restored to Member or Owner based on intro status

### Email Notifications

- [ ] **EMAIL-01**: Email infrastructure is configured (transactional email provider)
- [ ] **EMAIL-02**: Welcome email sent after successful payment
- [ ] **EMAIL-03**: Claim reminder email sent if user paid but hasn't linked Discord (after 24h)
- [ ] **EMAIL-04**: Payment failure email sent when subscription payment fails
- [ ] **EMAIL-05**: Payment recovered email sent when payment succeeds after failure
- [ ] **EMAIL-06**: Seat invite email sent to teammate with claim link

### Operations

- [ ] **OPS-01**: All Stripe events are logged with event ID for deduplication
- [ ] **OPS-02**: Reconciliation job runs daily to detect drift between Stripe and Discord
- [ ] **OPS-03**: Reconciliation job fixes role mismatches automatically
- [ ] **OPS-04**: Database schema supports future CRM export (all relevant fields captured)

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
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| PAY-01 | Phase 3 | Pending |
| PAY-02 | Phase 5 | Pending |
| PAY-03 | Phase 1 | Pending |
| PAY-04 | Phase 1 | Pending |
| PAY-05 | Phase 1 | Pending |
| PAY-06 | Phase 5 | Pending |
| PAY-07 | Phase 5 | Pending |
| ROLE-01 | Phase 3 | Pending |
| ROLE-02 | Phase 4 | Pending |
| ROLE-03 | Phase 4 | Pending |
| ROLE-04 | Phase 6 | Pending |
| ROLE-05 | Phase 6 | Pending |
| ROLE-06 | Phase 4 | Pending |
| ONB-01 | Phase 3 | Pending |
| ONB-02 | Phase 3 | Pending |
| ONB-03 | Phase 3 | Pending |
| ONB-04 | Phase 4 | Pending |
| ONB-05 | Phase 3 | Pending |
| ONB-06 | Phase 4 | Pending |
| ONB-07 | Phase 4 | Pending |
| TEAM-01 | Phase 5 | Pending |
| TEAM-02 | Phase 5 | Pending |
| TEAM-03 | Phase 5 | Pending |
| TEAM-04 | Phase 5 | Pending |
| TEAM-05 | Phase 5 | Pending |
| TEAM-06 | Phase 5 | Pending |
| TEAM-07 | Phase 5 | Pending |
| TEAM-08 | Phase 5 | Pending |
| BILL-01 | Phase 6 | Pending |
| BILL-02 | Phase 6 | Pending |
| BILL-03 | Phase 6 | Pending |
| BILL-04 | Phase 6 | Pending |
| BILL-05 | Phase 6 | Pending |
| EMAIL-01 | Phase 7 | Pending |
| EMAIL-02 | Phase 7 | Pending |
| EMAIL-03 | Phase 7 | Pending |
| EMAIL-04 | Phase 7 | Pending |
| EMAIL-05 | Phase 7 | Pending |
| EMAIL-06 | Phase 7 | Pending |
| OPS-01 | Phase 1 | Pending |
| OPS-02 | Phase 8 | Pending |
| OPS-03 | Phase 8 | Pending |
| OPS-04 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0

---
*Requirements defined: 2025-01-18*
*Last updated: 2025-01-18 after roadmap creation*
