# Phase 32: Member Dashboard Pages - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Members access all v2.0 features (points, benchmarks, resources, leaderboard, profile) through React UI pages. Backend APIs exist from Phases 27-30, dashboard shell exists from Phase 31. This phase builds the actual pages and user interactions.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Overview
- Hero stat: Total points (big number with recent delta)
- Activity feed: Last 7 days, time-grouped sections showing daily activity
- Secondary stat cards: All four (streak, rank, resources downloaded, benchmarks submitted)
- No quick action CTAs - sidebar navigation handles all actions, keep dashboard clean

### Benchmark Submission & Results
- Conversational submission flow: Question-by-question, one field at a time
- Results visualization: Bar charts showing your value vs peer median/percentiles
- Segment filters: Expandable panel (collapsed by default, expand to filter by company size, industry)
- K-anonymity message: Blurred preview of chart with "Need X more submissions to unlock"

### Resource Library Browsing
- Layout: Toggle between card grid and list view (user preference)
- Filtering: Top bar filters with dropdowns (horizontal bar above results)
- Preview: Modal/drawer overlay - click to see details, download without leaving list
- Download stats: Show popularity badges ("Popular", "Trending") instead of exact counts

### Leaderboard Presentation
- Tone: Supportive - focus on personal progress, downplay direct comparison
- Member position: Pinned row always visible at bottom of leaderboard
- Privacy opt-out: Toggle in profile/account settings, not on leaderboard itself
- Monthly reset: Countdown timer showing days/hours until reset

### Claude's Discretion
- Exact animation and transitions
- Loading skeleton patterns
- Error state messaging
- Mobile responsive breakpoints
- Form validation UX details

</decisions>

<specifics>
## Specific Ideas

- Conversational benchmark flow should feel like answering questions, not filling a form
- Blurred preview creates anticipation - "submit to see how you compare"
- Supportive leaderboard: celebrate progress over position
- Modal/drawer for resources keeps browsing flow uninterrupted

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 32-member-dashboard-pages*
*Context gathered: 2026-01-23*
