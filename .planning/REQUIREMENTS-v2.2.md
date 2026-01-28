# Requirements: The Revenue Council v2.2

**Defined:** 2026-01-28
**Core Value:** Paid members can access the community, and we always know who everyone is. Production deployment enables real members to join.

## v2.2 Requirements

Requirements for v2.2 Production Deployment & Launch release. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: Dockerfile created for Express backend with multi-stage Alpine build
- [ ] **INFRA-02**: Dockerfile created for Next.js frontend with standalone output
- [ ] **INFRA-03**: docker-compose.yml defines both services with internal networking
- [ ] **INFRA-04**: Health check endpoint (/health) returns 200 when service is ready
- [ ] **INFRA-05**: Next.js health check endpoint works for Traefik routing
- [ ] **INFRA-06**: Both containers build successfully on Coolify
- [ ] **INFRA-07**: Express can reach Next.js via internal Docker network (http://nextjs:3001)

### Domain & SSL

- [ ] **DOMAIN-01**: Custom domain configured in Coolify project settings
- [ ] **DOMAIN-02**: DNS A record points domain to Coolify server IP
- [ ] **DOMAIN-03**: SSL certificate issued via Let's Encrypt
- [ ] **DOMAIN-04**: HTTPS redirect works (HTTP → HTTPS)
- [ ] **DOMAIN-05**: Application accessible via https://[domain]

### Stripe Integration

- [ ] **STRIPE-01**: Stripe webhook endpoint URL updated in Stripe Dashboard
- [ ] **STRIPE-02**: Webhook signature verification works with production secret
- [ ] **STRIPE-03**: checkout.session.completed webhook fires and processes correctly
- [ ] **STRIPE-04**: invoice.payment_succeeded webhook updates member status
- [ ] **STRIPE-05**: invoice.payment_failed webhook triggers grace period
- [ ] **STRIPE-06**: Billing portal creates correctly and redirects back
- [ ] **STRIPE-07**: Test mode checkout flow completes successfully
- [ ] **STRIPE-08**: Live mode checkout flow completes successfully (1-2 test payments)

### Discord Integration

- [ ] **DISCORD-01**: Discord OAuth redirect URI updated in Developer Portal
- [ ] **DISCORD-02**: OAuth flow completes successfully (authorize → callback → linked)
- [ ] **DISCORD-03**: Member discordId and discordUsername saved after OAuth
- [ ] **DISCORD-04**: Discord bot is online and connected to test server
- [ ] **DISCORD-05**: Bot assigns Squire role when member links Discord
- [ ] **DISCORD-06**: Bot promotes Squire to Knight/Lord after intro
- [ ] **DISCORD-07**: Bot assigns Debtor role on payment failure
- [ ] **DISCORD-08**: Introduction detection works in #introductions channel

### Database & Data

- [ ] **DATA-01**: Supabase database accessible from Coolify containers
- [ ] **DATA-02**: Prisma migrations run successfully in production
- [ ] **DATA-03**: Seed data script creates test accounts
- [ ] **DATA-04**: Point configs seeded with correct values
- [ ] **DATA-05**: Feature flags seeded and enabled
- [ ] **DATA-06**: Email templates exist in database

### End-to-End Verification

- [ ] **E2E-01**: New user can signup with email/password
- [ ] **E2E-02**: User can complete Stripe checkout and become ACTIVE
- [ ] **E2E-03**: User can link Discord account via OAuth
- [ ] **E2E-04**: User receives Squire role after linking
- [ ] **E2E-05**: User can post introduction and get promoted to Knight/Lord
- [ ] **E2E-06**: User can access dashboard with points and streak
- [ ] **E2E-07**: User can browse and download resources
- [ ] **E2E-08**: User can submit benchmarks
- [ ] **E2E-09**: Admin can login to admin dashboard
- [ ] **E2E-10**: Admin can view and manage members
- [ ] **E2E-11**: Admin can adjust points and toggle features

### Go-Live Preparation

- [ ] **GOLIVE-01**: Database reset script clears all test data
- [ ] **GOLIVE-02**: Reset preserves admin account for access
- [ ] **GOLIVE-03**: Reset preserves point configs, feature flags, email templates
- [ ] **GOLIVE-04**: Production Discord server configured (channels, roles)
- [ ] **GOLIVE-05**: Discord bot connected to production server
- [ ] **GOLIVE-06**: OAuth redirect URI updated for production Discord
- [ ] **GOLIVE-07**: Stripe switched from test to live mode
- [ ] **GOLIVE-08**: Live webhook secret configured
- [ ] **GOLIVE-09**: Go-live checklist completed

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| CI/CD pipelines | Manual deployment sufficient for v2.2, automate later |
| Blue-green deployments | Accept brief downtime for v2.2 |
| Auto-scaling | Single replica sufficient for launch traffic |
| Production monitoring/alerting | Use Coolify built-in logs for v2.2 |
| Automated backups | Supabase handles database backups |
| Staging environment | Test in production with test mode Stripe |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | TBD | Pending |
| INFRA-02 | TBD | Pending |
| INFRA-03 | TBD | Pending |
| ... | ... | ... |

**Coverage:**
- v2.2 requirements: 45 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 45

---
*Requirements defined: 2026-01-28*
*Last updated: 2026-01-28 after initial definition*
