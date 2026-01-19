# Phase 8: Operations - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated reconciliation between Stripe subscription state and Discord role state. Detects drift, reports to admins, and (optionally) auto-fixes mismatches. Runs daily with manual trigger available. Full audit trail persisted to database.

</domain>

<decisions>
## Implementation Decisions

### Scheduling & triggers
- Daily reconciliation at a fixed time (Claude picks appropriate hour)
- Manual trigger via admin command or API endpoint
- If drift is detected and fixed, re-run after 1 hour to verify
- Pausable via environment variable for maintenance windows

### Drift scenarios
- Detect mismatches in both directions:
  - Stripe active but Discord has no role (missing access)
  - Discord has role but Stripe inactive/canceled (unauthorized access)
- Verify Debtor state: Stripe PAST_DUE should align with Debtor role and grace period timing
- Unclaimed subscriptions are NOT flagged as drift — supporting without claiming is valid

### Auto-fix behavior
- Start with report-only mode (manual fix by admin)
- Build in toggle: RECONCILIATION_AUTO_FIX env var for future automatic correction
- When drift detected: notify admins via both Discord channel AND email
- Silent fixes — affected users are NOT notified when corrected

### Claude's Discretion
- Tier mismatch handling (Knight vs Lord drift) — determine based on context
- Exact logging detail level for reconciliation runs
- Appropriate fixed hour for daily schedule

</decisions>

<specifics>
## Specific Ideas

- "For the time being, flag and notify the admins, then set up for manual adjustments. However, we would like to toggle automatic fixes if stable."
- Unclaimed seats shouldn't trigger reminders — "That can be their own way of supporting the group as well"
- Only send email reports when issues are found, not "all clear" noise

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-operations*
*Context gathered: 2026-01-19*
