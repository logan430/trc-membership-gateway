# Phase 6: Billing Failure - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Detect payment failures via Stripe webhook, restrict access via "Debtor" role after grace period, send notification cadence through DM and email, and restore access automatically on payment recovery. Includes handling for individual and team subscriptions.

</domain>

<decisions>
## Implementation Decisions

### Debtor Role Behavior
- Use existing "Debtor" role (already defined in codebase)
- No special color — neutral appearance
- Hidden from member sidebar (not displayed separately)
- Restricted to #billing-support channel only (read-only)
- Bot creates #billing-support channel if it doesn't exist
- Channel contains pinned instructions for resolving payment
- Previous role removed and stored in database for restoration
- Debtor role assigned after 48-hour grace period expires

### Grace Period
- 48-hour grace period from first payment failure
- User keeps full access (Member/Owner) during grace period
- DM + email notification sent immediately on payment failure
- After 48 hours without recovery → move to Debtor state

### Debtor State Timeline
- Maximum 1 month (30 days) in Debtor state
- After 1 month without recovery → kicked from server
- Notification cadence (DM + email at each point):
  - Immediate: Payment failure detected
  - 24 hours: Warning, mention pending Debtor status
  - 48 hours: Now restricted as Debtor
  - 7 days: Reminder
  - 10 days: Reminder
  - 15 days: Reminder
  - 20 days: Reminder
  - 25 days: Reminder
  - 48 hours before kick: Final warning
  - 24 hours before kick: Final warning
  - 12 hours before kick: Final warning
  - On kick: Removal notification

### User Communication
- Medieval-themed tone for all messaging
- DM and email content tailored to each channel (DM shorter, email more detailed)
- Claude's discretion: Whether to include Stripe portal link in DM
- Claude's discretion: Bot sender framing (e.g., "On behalf of The Revenue Council")

### Recovery Behavior
- Immediate restoration on payment success webhook
- Previous role restored directly from database (no re-introduction required)
- Grace period recovery: Confirmation notification (DM + email) with celebratory tone
- Debtor state recovery: "Welcome back" celebration with role restoration

### Team Member Handling
- All team members enter Debtor state when owner's payment fails
- Owner receives full billing details
- Team members receive brief notice ("Contact thy organization admin")
- All team members restored together when owner's payment recovers
- Pending invites invalidated if team is kicked after 1-month limit
- Team members still count against seat limits while in Debtor state
- Owner retains full dashboard access during Debtor state (can revoke, add seats, manage invites)
- Dashboard shows prominent billing status banner when in Debtor state

### Claude's Discretion
- Exact medieval phrasing for notifications
- Whether DMs include direct Stripe portal links
- Bot sender framing for DMs
- Pinned message formatting in #billing-support
- Scheduling mechanism for notification cadence

</decisions>

<specifics>
## Specific Ideas

- Medieval theme: "Hark! The Treasury reports a matter requiring attention..."
- Recovery messages should celebrate the return: "Welcome back to the Council! Thy standing is restored."
- Team member messages don't assign blame, just redirect to admin

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-billing-failure*
*Context gathered: 2026-01-19*
