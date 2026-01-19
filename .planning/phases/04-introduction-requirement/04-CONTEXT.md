# Phase 4: Introduction Requirement - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Detect when a paid user posts their first valid introduction in #introductions and promote them to the appropriate full-access role (Member or Owner). Remove all managed roles and kick users from the server when their subscription ends.

</domain>

<decisions>
## Implementation Decisions

### Introduction Detection
- Minimum length requirement: 100 characters
- Text content only — no keyword or format requirements
- Message edits count — if they edit to meet length, promote them
- Single message only — multiple short messages don't combine
- Top-level messages only — replies to others don't count as intros
- Deleting intro after promotion has no effect — role stays

### Role Promotion Logic
- Promotion is immediate upon valid intro detection
- Clean role swap — remove Squire, add Member or Owner
- Retry automatically on Discord API failure with exponential backoff
- Alert admins if retry keeps failing

### Role Removal on Cancellation
- Roles removed at subscription period end (not immediately on cancel)
- Send farewell DM, then kick from server
- Farewell DM: Thank them for being a valued Council member, include resubscribe link to The Gatekeeper, wish them well on their journey

### Bot Feedback
- On valid intro: React with 🎉 AND send welcome DM
- Welcome DM: Medieval-themed tone ("Hail, [name]! You've been admitted to the guild...")
- Welcome DM includes link to community guidelines
- On too-short message: DM with guidance explaining:
  - The Council requires a full introduction
  - We want to know what interests you about joining
  - 100 character minimum requirement

### Claude's Discretion
- Exact Stripe event to trigger role removal (subscription.deleted vs status change)
- Determining Member vs Owner role from existing data model
- Rate-limiting "too short" DM spam (suggested: once per user per day)
- Image + text handling (suggested: text length only, images don't count)
- Retry count and backoff timing for failed promotions

</decisions>

<specifics>
## Specific Ideas

- Medieval guild theme continues from The Gatekeeper branding
- Farewell message should be gracious — "valued member of the Council", "best on your journey"
- Guidance DM should be welcoming, not scolding — explain what we want to know about them

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-introduction-requirement*
*Context gathered: 2026-01-18*
