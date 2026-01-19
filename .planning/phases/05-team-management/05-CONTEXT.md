# Phase 5: Team Management - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Companies can purchase plans and manage team seats. Owner invites teammates via tokens, teammates claim seats via Discord OAuth, admins can revoke/reallocate seats. Mid-subscription seat additions are supported.

</domain>

<decisions>
## Implementation Decisions

### Company Checkout
- Custom seat count (not fixed tiers) — user enters exact numbers
- Two seat types with different prices: owner seats and team seats
- Separate quantity fields at checkout: "Owner seats" and "Team seats" inputs
- No minimum seat count — can buy 1 owner + 0 team
- Company name is required at checkout
- Purchaser claims their seat separately (same flow as teammates)
- Purchaser becomes "primary owner" with super admin rights in their org
- Individual subscribers can upgrade to company plan, preserving account and intro status

### Seat Dashboard
- Basic info per seat: name, email, seat type (owner/team), status (claimed/pending)
- Summary at top showing seat counts: "Owner: 2/3 • Team: 5/10"
- Owners only can access dashboard — team members cannot view
- Individuals have owner-level permissions (Knight role in Discord hierarchy)

### Invite Flow
- Invite tokens never expire — valid until revoked
- Multi-use tokens — share link, first N claimers get seats until filled
- Invitees only need Discord OAuth — no email/password account required
- Block claims from users with existing individual subscription: "You already have owner access"

### Seat Revocation
- Immediate kick on revocation — roles removed, kicked from server
- Generic DM notification before kick: access ended, no blame assigned
- Owners can revoke other owners within same org
- Primary owner (purchaser) cannot be revoked by other org members — only Discord server admins
- Revoked seat returns to pool immediately — available for new invite

### Claude's Discretion
- Checkout page location (add to Gatekeeper vs separate /company page)
- Pending invites display (separate section vs mixed in list)
- Token format and generation approach
- Dashboard layout and styling details

</decisions>

<specifics>
## Specific Ideas

- Individual subscriptions are owner-level with higher permissions — hierarchy: Individual = Owner > Team
- Medieval theme continuation from existing Gatekeeper page
- "Super admin" concept for primary owner (purchaser) within their organization

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-team-management*
*Context gathered: 2026-01-18*
