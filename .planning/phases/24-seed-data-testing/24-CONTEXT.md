# Phase 24: Seed Data Testing - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Seed script creates comprehensive test data for all application flows. Covers individual subscriptions, team memberships, various subscription states, admin accounts, and edge cases. Database-only seeding — no Stripe API calls during seed.

</domain>

<decisions>
## Implementation Decisions

### User scenarios
- Full coverage of subscription states: active, past_due, canceled, unclaimed, billing failure in grace period
- Moderate volume: 5-10 users per state
- Introduction completion proportional to real usage: 80% introduced (Knight), 20% unintroduced (Squire)
- Claim reminder scenarios with varied timing: some at 48h, some at 7d, some at 30d+ for testing escalating reminder emails

### Team configurations
- Small teams only: 3-5 seats per team
- At least one team with billing failure (past_due or grace period)
- Claude's discretion on total team count and mix of member states (claimed, pending invites, revoked, empty seats)

### Data realism
- Recognizable naming patterns: test-active-1@test.example.com, test-billing-fail@test.example.com — state obvious from name
- No Stripe IDs: leave stripeCustomerId/stripeSubscriptionId null — only DB state matters for UI testing
- Claude's discretion on Discord IDs and timestamp spreading

### Idempotency
- Wipe and recreate: delete all test data, then create fresh
- Pattern-based identification: all test emails use @test.example.com domain for easy WHERE clause cleanup
- No confirmation prompt: fast dev tool behavior
- Preserve non-test admins: only wipe admins with @test.example.com, preserve manually created admin accounts

### Claude's Discretion
- Total number of teams (aim for good scenario coverage)
- Team member state distribution (claimed owners, members, pending invites, revoked, empty)
- Discord ID handling (fake placeholders vs null)
- Timestamp spreading for realistic data aging
- Exact number of users at each reminder stage

</decisions>

<specifics>
## Specific Ideas

- Email domain @test.example.com for all seed data — easy to identify and clean up
- State-indicating naming pattern makes admin dashboard testing intuitive
- No need to preserve seed data post-launch — it's purely for development/testing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-seed-data-testing*
*Context gathered: 2026-01-21*
