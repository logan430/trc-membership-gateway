# Roadmap: The Revenue Council Membership Gateway

## Overview

This roadmap delivers a Stripe-backed membership gateway for The Revenue Council Discord community. The journey progresses from secure infrastructure (webhooks, database) through Discord integration, individual subscription flow, introduction enforcement, and finally the B2B differentiator: company seat management. Billing failure handling and operational hardening complete the system. Each phase delivers a coherent, verifiable capability that enables the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Database schema, Stripe webhook infrastructure, project skeleton
- [x] **Phase 2: Discord Integration** - OAuth linking, bot setup, role management core
- [x] **Phase 3: Individual Subscription** - Stripe Checkout, claim flow, basic role assignment
- [x] **Phase 4: Introduction Requirement** - Introduction monitoring, role promotion to Member/Owner
- [x] **Phase 5: Team Management** - Company plans, seat dashboard, invite system
- [x] **Phase 6: Billing Failure** - Billing Issue role, access restriction, recovery
- [x] **Phase 7: Email Notifications** - Transactional emails for all lifecycle events
- [x] **Phase 8: Operations** - Reconciliation, audit logging, CRM-ready schema
- [x] **Phase 9: Frontend Pages** - Signup, login, dashboard, claim HTML pages
- [x] **Phase 10: Admin System** - Admin login, member management dashboard
- [x] **Phase 11: Frontend Cleanup** - Team routes, checkout success, 404 page
- [x] **Phase 12: Route Restructure** - Consolidate routes under /app/*
- [x] **Phase 13: Billing Portal** - Stripe billing portal endpoint (Gap Closure)
- [x] **Phase 14: Admin Filter Fix** - Fix subscription status filter parameter (Gap Closure)
- [x] **Phase 15: Security Audit** - Review auth, input validation, secrets management (Audit)
- [x] **Phase 16: Data Integrity Audit** - Schema constraints, transactions, idempotency (Audit)
- [x] **Phase 17: Code Quality Audit** - Dead code, types, linting (Audit)
- [x] **Phase 18: Performance Audit** - Query optimization, load testing (Audit)
- [x] **Phase 19: Testing Coverage Audit** - Unit and integration test gaps (Audit)
- [x] **Phase 20: Accessibility Audit** - WCAG compliance (Audit)
- [x] **Phase 21: Documentation Audit** - API docs, setup guides (Audit)
- [x] **Phase 22: Operational Readiness** - Logging, monitoring, deployment (Audit)
- [x] **Phase 23: Email Templates Dashboard** - Admin UI for editing email templates
- [ ] **Phase 24: Seed Data Testing** - Seed data for testing in application

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
**Plans**: 4 plans in 2 waves

Plans:
- [x] 02-01-PLAN.md - Session infrastructure with JWT tokens (Wave 1)
- [x] 02-02-PLAN.md - Discord bot with role management (Wave 1)
- [x] 02-03-PLAN.md - Discord OAuth flow implementation (Wave 2)
- [x] 02-04-PLAN.md - Magic link authentication (Wave 2)

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
**Plans**: 3 plans in 2 waves

Plans:
- [x] 03-01-PLAN.md - User registration (email+password) and Stripe Checkout flow (Wave 1)
- [x] 03-02-PLAN.md - Dashboard and Discord claim flow with Squire role assignment (Wave 2)
- [x] 03-03-PLAN.md - The Gatekeeper landing page with medieval theme (Wave 1)

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
**Plans**: 3 plans in 2 waves

Plans:
- [x] 04-01-PLAN.md - Message event infrastructure and introduction detection (Wave 1)
- [x] 04-02-PLAN.md - Introduction validation and role promotion logic (Wave 2)
- [x] 04-03-PLAN.md - Subscription cancellation handler with role removal and kick (Wave 1)

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
**Plans**: 6 plans in 4 waves

Plans:
- [x] 05-01-PLAN.md - Schema updates, env config, and company checkout flow (Wave 1)
- [x] 05-02-PLAN.md - Team dashboard with seat view (Wave 2)
- [x] 05-03-PLAN.md - Invite token generation and management (Wave 2)
- [x] 05-04-PLAN.md - Invite claim flow with Discord OAuth (Wave 3)
- [x] 05-05-PLAN.md - Seat revocation with immediate kick (Wave 4)
- [x] 05-06-PLAN.md - Mid-subscription seat additions (Wave 4)

### Phase 6: Billing Failure
**Goal**: Payment failures restrict access gracefully; recovery restores access
**Depends on**: Phase 5
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, ROLE-04, ROLE-05
**Success Criteria** (what must be TRUE):
  1. System detects payment failure via webhook
  2. Affected users are moved to "Debtor" role after 48-hour grace period
  3. Debtor users can only access #billing-support channel
  4. System detects payment recovery via webhook
  5. On recovery, user is restored to previous role (Knight or Lord)
**Plans**: 4 plans in 4 waves

Plans:
- [x] 06-01-PLAN.md - Schema updates and #billing-support channel creation (Wave 1)
- [x] 06-02-PLAN.md - Payment failure detection and grace period start (Wave 2)
- [x] 06-03-PLAN.md - Debtor state transition and billing scheduler (Wave 3)
- [x] 06-04-PLAN.md - Payment recovery and role restoration (Wave 4)

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
**Plans**: 4 plans in 2 waves

Plans:
- [x] 07-01-PLAN.md - Email infrastructure with provider abstraction (Wave 1)
- [x] 07-02-PLAN.md - Welcome and claim reminder emails (Wave 2)
- [x] 07-03-PLAN.md - Billing failure and recovery emails (Wave 2)
- [x] 07-04-PLAN.md - Team seat invite emails (Wave 2)

### Phase 8: Operations
**Goal**: System detects and corrects drift between Stripe and Discord state
**Depends on**: Phase 6
**Requirements**: OPS-02, OPS-03
**Success Criteria** (what must be TRUE):
  1. Reconciliation job runs daily
  2. Reconciliation detects drift between Stripe subscription status and Discord roles
  3. Reconciliation automatically fixes role mismatches
**Plans**: 2 plans in 2 waves

Plans:
- [x] 08-01-PLAN.md - Reconciliation infrastructure (schema, env vars, module scaffold) (Wave 1)
- [x] 08-02-PLAN.md - Drift detection and auto-fix logic (Wave 2)

### Phase 9: Frontend Pages
**Goal**: Users can complete the full signup -> login -> dashboard -> claim flow through the browser
**Depends on**: Phase 8 (all backend complete)
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. User can access `/auth/signup` and create an account via form
  2. User can access `/auth/login` and authenticate via form
  3. Authenticated user sees dashboard with subscription status
  4. User can initiate checkout from dashboard
  5. User can initiate Discord claim from dashboard
  6. No CSP errors block page functionality
**Plans**: 2 plans in 1 wave

Plans:
- [x] 09-01-PLAN.md - Auth pages (signup, login) with form styles (Wave 1)
- [x] 09-02-PLAN.md - Dashboard and claim pages (Wave 1)

### Phase 10: Admin System
**Goal**: Admins can view members, manage access, configure feature flags, and review audit logs
**Depends on**: Phase 9
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04
**Success Criteria** (what must be TRUE):
  1. Admin can login at `/admin/login` with separate credentials
  2. Admin can view all members with search, filter, and pagination
  3. Admin can revoke Discord access, reset claims, and grant roles directly
  4. Admin can toggle feature flags (super admin only)
  5. Admin can view and search audit logs
  6. Super admin can manage other admin accounts
  7. Admin can view and edit email templates (super admin only)
**Plans**: 5 plans in 3 waves

Plans:
- [x] 10-01-PLAN.md - Schema updates and admin auth infrastructure (Wave 1)
- [x] 10-02-PLAN.md - Member management and access control APIs (Wave 2)
- [x] 10-03-PLAN.md - Feature flags, audit log, and template APIs (Wave 2)
- [x] 10-04-PLAN.md - Admin account management API (Wave 2)
- [x] 10-05-PLAN.md - Admin UI pages (Wave 3)

### Phase 11: Frontend Cleanup
**Goal**: Complete frontend coverage with team routes, checkout success, and error handling
**Depends on**: Phase 10
**Requirements**: None (polish/cleanup)
**Plans**: 1 plan in 1 wave

Plans:
- [x] 11-01-PLAN.md - Team routes, checkout success, 404 page (Wave 1)

### Phase 12: Route Restructure
**Goal**: Consolidate all routes under /app/* for consistent URL structure
**Depends on**: Phase 11
**Requirements**: None (refactoring)
**Success Criteria** (what must be TRUE):
  1. Auth page routes moved from /auth/* to /app/auth/*
  2. Admin page routes moved from /admin/* to /app/admin/*
  3. Old routes return 404 (no redirects - pre-launch)
  4. All internal links updated to new routes
  5. API routes unchanged (/auth/*, /admin/auth/*, /api/admin/*)
**Plans**: 2 plans in 1 wave

Plans:
- [x] 12-01-PLAN.md - Auth page routes migration (/auth/* to /app/auth/*) (Wave 1)
- [x] 12-02-PLAN.md - Admin page routes migration (/admin/* to /app/admin/*) (Wave 1)

### Phase 13: Billing Portal
**Goal**: Users can access Stripe billing portal to manage their subscription
**Depends on**: Phase 12
**Requirements**: None (gap closure from audit)
**Gap Closure**: Closes critical integration gap - missing `/billing/portal` endpoint
**Success Criteria** (what must be TRUE):
  1. POST `/billing/portal` endpoint exists and returns Stripe billing portal URL
  2. Endpoint requires authentication (valid session)
  3. Dashboard "Manage Billing" button successfully opens billing portal
  4. Billing portal flow works end-to-end (no 404 errors)
**Plans**: 1 plan in 1 wave

Plans:
- [x] 13-01-PLAN.md - Stripe billing portal endpoint (Wave 1)

### Phase 14: Admin Filter Fix
**Goal**: Admin subscription status filter works correctly
**Depends on**: Phase 13
**Requirements**: None (gap closure from audit)
**Gap Closure**: Closes minor integration gap - parameter mismatch between frontend and backend
**Success Criteria** (what must be TRUE):
  1. Admin dashboard filter parameter matches backend expectation
  2. Filtering by subscription status returns correct results
  3. All filter states work: active, past_due, canceled, none
**Plans**: 1 plan in 1 wave

Plans:
- [x] 14-01-PLAN.md - Admin filter parameter alignment (Wave 1)

### Phase 15: Security Audit
**Goal**: Verify all security controls are properly implemented and fix identified gaps
**Depends on**: Phase 14
**Category**: Audit
**Priority**: Critical - blocks production deployment
**Success Criteria** (what must be TRUE):
  1. JWT tokens use secure expiry and httpOnly cookies
  2. Password hashing uses Argon2id with OWASP params
  3. All user input validated with Zod schemas
  4. Stripe webhook signatures verified on all events
  5. No hardcoded secrets in codebase
  6. CSRF protection on OAuth flows
  7. Rate limiting on auth endpoints
  8. Admin routes properly protected
**Plans**: 2 plans in 1 wave

Plans:
- [x] 15-01-PLAN.md - Add rate limiting to authentication endpoints (Wave 1)
- [x] 15-02-PLAN.md - Fix security issues and complete audit verification (Wave 1)

**Checklist Reference:** See [AUDIT-CHECKLIST.md](AUDIT-CHECKLIST.md) Section 3

### Phase 16: Data Integrity Audit
**Goal**: Verify data constraints and transaction safety through documentation audit
**Depends on**: Phase 15
**Category**: Audit
**Priority**: High - prevents data corruption
**Success Criteria** (what must be TRUE):
  1. Prisma schema has proper unique constraints
  2. Cascade delete behavior verified for Team -> Member
  3. Seat claims use atomic transactions
  4. Webhook handlers are idempotent
  5. Stripe remains source of truth (DB mirrors correctly)
  6. Backup procedures documented
**Plans**: 3 plans in 1 wave

Plans:
- [x] 16-01-PLAN.md - Schema and constraint verification audit (Wave 1)
- [x] 16-02-PLAN.md - Transaction and idempotency verification audit (Wave 1)
- [x] 16-03-PLAN.md - Backup procedure documentation (Wave 1, Gap Closure)

**Checklist Reference:** See [AUDIT-CHECKLIST.md](AUDIT-CHECKLIST.md) Section 6

### Phase 17: Code Quality Audit
**Goal**: Identify and document technical debt (audit only, no fixes)
**Depends on**: Phase 16
**Category**: Audit
**Priority**: Medium
**Success Criteria** (what must be TRUE):
  1. No dead code (unused exports/functions)
  2. No `any` types in production code
  3. Consistent error handling patterns
  4. No console.log in production paths
  5. Dependencies up to date (npm audit clean)
  6. No circular dependencies
**Plans**: 1 plan in 1 wave

Plans:
- [x] 17-01-PLAN.md - Run audit tools and produce prioritized report (Wave 1)

**Checklist Reference:** See [AUDIT-CHECKLIST.md](AUDIT-CHECKLIST.md) Section 4

### Phase 18: Performance Audit
**Goal**: Ensure acceptable performance under load
**Depends on**: Phase 17
**Category**: Audit
**Priority**: Medium
**Success Criteria** (what must be TRUE):
  1. No N+1 database queries
  2. API endpoints respond in <200ms
  3. Connection pooling configured
  4. Discord rate limits respected (batch delays)
  5. No memory leaks under load
**Plans**: 1 plan in 1 wave

Plans:
- [x] 18-01-PLAN.md - Static performance analysis and audit report (Wave 1)

**Checklist Reference:** See [AUDIT-CHECKLIST.md](AUDIT-CHECKLIST.md) Section 5

### Phase 19: Testing Coverage Audit
**Goal**: Identify gaps in automated testing and document test coverage needs
**Depends on**: Phase 18
**Category**: Audit
**Priority**: Medium
**Success Criteria** (what must be TRUE):
  1. Critical user flows have test coverage documented
  2. Webhook handlers have integration tests identified
  3. Auth flows tested (login, logout, refresh) needs documented
  4. Error scenarios covered in audit
  5. Edge cases documented
**Plans**: 1 plan in 1 wave

Plans:
- [x] 19-01-PLAN.md - Testing coverage audit report (Wave 1)

**Checklist Reference:** See [AUDIT-CHECKLIST.md](AUDIT-CHECKLIST.md) Section 7

### Phase 20: Accessibility Audit
**Goal**: Ensure WCAG AA compliance
**Depends on**: Phase 19
**Category**: Audit
**Priority**: Medium
**Success Criteria** (what must be TRUE):
  1. All forms have proper labels
  2. Color contrast meets WCAG AA
  3. Focus indicators visible
  4. Keyboard navigation works
  5. ARIA labels on interactive elements
**Plans**: 1 plan in 1 wave

Plans:
- [x] 20-01-PLAN.md - WCAG 2.1 AA compliance audit across all HTML pages (Wave 1)

**Checklist Reference:** See [AUDIT-CHECKLIST.md](AUDIT-CHECKLIST.md) Section 8

### Phase 21: Documentation Audit
**Goal**: Ensure handoff readiness
**Depends on**: Phase 20
**Category**: Audit
**Priority**: Low
**Success Criteria** (what must be TRUE):
  1. Environment variables fully documented
  2. Setup instructions accurate and tested
  3. API endpoints documented
  4. Deployment guide exists
**Plans**: 3 plans in 1 wave

Plans:
- [x] 21-01-PLAN.md - README.md and .env.example completion (Wave 1)
- [x] 21-02-PLAN.md - API documentation (docs/API.md) (Wave 1)
- [x] 21-03-PLAN.md - Deployment guide and setup verification (Wave 1)

**Checklist Reference:** See [AUDIT-CHECKLIST.md](AUDIT-CHECKLIST.md) Section 9

### Phase 22: Operational Readiness
**Goal**: Production deployment readiness
**Depends on**: Phase 21
**Category**: Audit
**Priority**: High
**Success Criteria** (what must be TRUE):
  1. Logging in place for key events
  2. Error monitoring configured (Sentry or similar)
  3. Health check endpoint exists
  4. Graceful shutdown implemented
  5. Environment separation (dev/staging/prod)
  6. Rollback plan documented
  7. Incident runbook created
**Plans**: 4 plans in 3 waves

Plans:
- [x] 22-01-PLAN.md - Graceful shutdown implementation (Wave 1)
- [x] 22-02-PLAN.md - Sentry error monitoring integration (Wave 1)
- [x] 22-03-PLAN.md - Incident runbook and rollback documentation (Wave 2)
- [x] 22-04-PLAN.md - Operational readiness verification audit (Wave 3)

**Checklist Reference:** See [AUDIT-CHECKLIST.md](AUDIT-CHECKLIST.md) Section 10

### Phase 23: Email Templates Dashboard
**Goal**: Wire database email templates to actual email sending and enhance admin UI with categories and dedicated edit page
**Depends on**: Phase 22
**Category**: Enhancement
**Priority**: Medium
**Success Criteria** (what must be TRUE):
  1. Admin can view all email templates grouped by category
  2. Admin can edit template content (subject, body) with variable chips
  3. Admin can preview email templates with sample data before saving
  4. Admin can reset templates to default content
  5. Changes are persisted in database AND used by actual email system
**Plans**: 2 plans in 2 waves

Plans:
- [x] 23-01-PLAN.md - Backend template integration and reset endpoint (Wave 1)
- [x] 23-02-PLAN.md - Frontend UI with categories and dedicated edit page (Wave 2)

### Phase 24: Seed Data Testing
**Goal**: Provide comprehensive seed data for testing all application flows
**Depends on**: Phase 23
**Category**: Development
**Priority**: Medium
**Success Criteria** (what must be TRUE):
  1. Seed script creates test users with various subscription states
  2. Seed script creates test teams with members
  3. Seed script creates test admin accounts
  4. Seed data covers edge cases (billing failures, unclaimed, etc.)
  5. Seed can be run repeatedly without conflicts
**Plans**: 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 24 to break down)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> ... -> 14 -> 15 -> ... -> 22

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-01-18 |
| 2. Discord Integration | 4/4 | Complete | 2026-01-18 |
| 3. Individual Subscription | 3/3 | Complete | 2026-01-18 |
| 4. Introduction Requirement | 3/3 | Complete | 2026-01-18 |
| 5. Team Management | 6/6 | Complete | 2026-01-19 |
| 6. Billing Failure | 4/4 | Complete | 2026-01-19 |
| 7. Email Notifications | 4/4 | Complete | 2026-01-19 |
| 8. Operations | 2/2 | Complete | 2026-01-19 |
| 9. Frontend Pages | 2/2 | Complete | 2026-01-19 |
| 10. Admin System | 5/5 | Complete | 2026-01-20 |
| 11. Frontend Cleanup | 1/1 | Complete | 2026-01-20 |
| 12. Route Restructure | 2/2 | Complete | 2026-01-20 |
| 13. Billing Portal | 1/1 | Complete | 2026-01-20 |
| 14. Admin Filter Fix | 1/1 | Complete | 2026-01-20 |
| 15. Security Audit | 2/2 | Complete | 2026-01-20 |
| 16. Data Integrity Audit | 3/3 | Complete | 2026-01-20 |
| 17. Code Quality Audit | 1/1 | Complete | 2026-01-21 |
| 18. Performance Audit | 1/1 | Complete | 2026-01-21 |
| 19. Testing Coverage Audit | 1/1 | Complete | 2026-01-21 |
| 20. Accessibility Audit | 1/1 | Complete | 2026-01-21 |
| 21. Documentation Audit | 3/3 | Complete | 2026-01-21 |
| 22. Operational Readiness | 4/4 | Complete | 2026-01-21 |
| 23. Email Templates Dashboard | 2/2 | Complete | 2026-01-21 |
| 24. Seed Data Testing | 0/? | Not Started | - |

---
*Roadmap created: 2025-01-18*
*Phase 1 planned: 2025-01-18*
*Phase 2 planned: 2026-01-18*
*Phase 3 planned: 2026-01-18*
*Phase 4 planned: 2026-01-18*
*Phase 4 complete: 2026-01-18*
*Phase 5 planned: 2026-01-19*
*Phase 5 complete: 2026-01-19*
*Phase 6 planned: 2026-01-19*
*Phase 6 complete: 2026-01-19*
*Phase 7 planned: 2026-01-19*
*Phase 7 complete: 2026-01-19*
*Phase 8 planned: 2026-01-19*
*Phase 8 complete: 2026-01-19*
*Phase 9 planned: 2026-01-19*
*Phase 9 complete: 2026-01-19*
*Phase 10 planned: 2026-01-19*
*Phase 10 complete: 2026-01-20*
*Phase 11 planned: 2026-01-20*
*Phase 11 complete: 2026-01-20*
*Phase 12 planned: 2026-01-20*
*Phase 12 complete: 2026-01-20*
*Gap closure phases 13-14 added: 2026-01-20*
*Phase 13 complete: 2026-01-20*
*Phase 14 complete: 2026-01-20*
*Audit phases 15-22 added: 2026-01-20*
*Phase 15 planned: 2026-01-20*
*Phase 15 complete: 2026-01-20*
*Phase 16 planned: 2026-01-20*
*Phase 16 gap closure plan added: 2026-01-21*
*Phase 17 planned: 2026-01-21*
*Phase 17 complete: 2026-01-21*
*Phase 18 planned: 2026-01-21*
*Phase 18 complete: 2026-01-21*
*Phase 19 planned: 2026-01-21*
*Phase 19 complete: 2026-01-21*
*Phase 20 planned: 2026-01-21*
*Phase 20 complete: 2026-01-21*
*Phase 21 planned: 2026-01-21*
*Phase 21 complete: 2026-01-21*
*Phase 22 planned: 2026-01-21*
*Phase 22 complete: 2026-01-21*
*Total requirements: 45 | Total phases: 22 | Total plans: 59 (v1 + Phase 15-22)*
*Phase 23 added: 2026-01-21*
*Phase 23 planned: 2026-01-21*
*Phase 23 complete: 2026-01-21*
*Phase 24 added: 2026-01-21*
