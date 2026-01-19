# Phase 7: Email Notifications - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Transactional emails for all key membership lifecycle events: welcome, claim reminders, payment failure alerts, payment recovery confirmations, and team seat invites. This phase delivers the email infrastructure and all email templates — it does not add new membership features.

</domain>

<decisions>
## Implementation Decisions

### Email tone & branding
- Full medieval theme consistent with site ("The Gatekeeper", guild language)
- Sender name: "The Revenue Council"
- Subject lines: Medieval hints — themed but clear (e.g., "Welcome to The Revenue Council", "Action needed: payment issue")
- No visual branding in emails — text-only content, no images or heavy styling

### Content depth
- Welcome emails: Key action only — "Thanks for joining, click here to claim Discord access"
- Payment failure emails: Detailed consequences — grace period timeline, what happens next, urgency indicators
- Team invite emails: Full context — what The Revenue Council is, what access they'll get, company name
- Claim reminders: Consistent tone across all reminders (no escalation)

### Delivery preferences
- Plain text only — no HTML formatting
- Reply-to: Real support inbox that someone monitors (support@...)
- No unsubscribe option — these are transactional emails, legally required
- Provider-agnostic implementation — abstract email sending behind interface to support any provider (Resend, SendGrid, Postmark, etc.)

### Timing & cadence
- Welcome email: Immediately after successful payment
- Claim reminder sequence (if Discord not linked):
  - 48 hours: First nudge
  - 7 days: Second reminder
  - 30 days: Cheeky email — thankful for subscription, emphasize desire to have them in the group
  - Monthly thereafter: Gentle nudge until claimed
- Payment failure email: Send after confirming it's a real user-side failure (not our infrastructure)
- Team invite emails: No expiry mentioned — link works until admin revokes

### Claude's Discretion
- Exact wording of medieval-themed copy
- Email template structure and formatting
- Provider abstraction interface design
- Retry logic for failed email sends

</decisions>

<specifics>
## Specific Ideas

- The 30-day claim reminder should be "cheeky" — thankful for subscription but emphasizing we'd like to have them in the group
- Payment failure emails should create urgency by showing the timeline (grace period → debtor state → kick)
- Team invites should give recipient enough context to understand what they're joining even if they've never heard of The Revenue Council

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-email-notifications*
*Context gathered: 2026-01-19*
