# Phase 27: Points System Backend - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend APIs for earning, tracking, and viewing engagement points. Members earn points for community actions: +50 benchmark submission, +5 resource download, +1 per 100 Discord XP, +25 introduction completion. This phase builds the transaction ledger, history APIs, and admin adjustment capabilities. Leaderboard UI and member-facing dashboard are Phase 32.

</domain>

<decisions>
## Implementation Decisions

### Point Earning Edge Cases
- One point award per benchmark category ever (prevents submit-delete-resubmit gaming)
- First download only awards +5 per resource (re-downloads are free, no repeated points)
- Points once earned stay — no reversals for legitimate deletions

### History API Design
- Transactions grouped by type (Discord XP, Benchmarks, Downloads, Admin, etc.)
- All-time history accessible (no rolling window cutoff)
- API supports filtering by point type via query param (e.g., `?type=benchmark`)
- Contextual detail per transaction — include what triggered it (e.g., "Downloaded: Sales Playbook PDF")

### Admin Adjustment Flow
- Reason field available but not required
- No limits on adjustment amounts — trust admin judgment
- Admin chooses whether to notify member per adjustment (checkbox)
- Admin adjustments hidden from member's point history — only visible in admin audit log

### Point Value Configuration
- Point values admin-configurable via admin panel (not hardcoded)
- No retroactive recalculation — changing values applies going forward only
- Point values hidden from members — discovery through earning, not documentation
- Per-action toggle — admins can enable/disable each point type independently

### Claude's Discretion
- Whether total points can go negative (floor at zero vs allow debt)
- Pagination strategy for history API
- Caching approach for point totals
- Error response format and codes

</decisions>

<specifics>
## Specific Ideas

- Gaming prevention is the priority for edge cases — legitimate use shouldn't be punished
- Admin adjustments are for corrections and special cases, not regular point management
- The hidden-from-member approach for admin adjustments preserves the "earned" feeling

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-points-system-backend*
*Context gathered: 2026-01-22*
