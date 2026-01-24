---
phase: 32-member-dashboard-pages
plan: 05
title: Leaderboard Page
subsystem: frontend
tags: [react, leaderboard, gamification, rankings]
dependencies:
  requires:
    - 27: Points system with totalPoints and currentStreak
    - 31: Dashboard shell with sidebar navigation
    - 32-01: React Query provider and points hooks
  provides:
    - Leaderboard page with monthly/all-time periods
    - Member rank pinning when outside top 25
    - Reset countdown timer
  affects:
    - Profile page may link to leaderboard
    - Sidebar navigation includes leaderboard
tech-stack:
  added: []
  patterns:
    - Period filter with raw SQL for monthly aggregation
    - Privacy filter (leaderboardVisible setting)
    - Pinned member row component pattern
key-files:
  created:
    - src/routes/leaderboard.ts
    - dashboard/src/hooks/useLeaderboard.ts
    - dashboard/src/components/leaderboard/LeaderboardTable.tsx
    - dashboard/src/components/leaderboard/RankBadge.tsx
    - dashboard/src/components/leaderboard/PeriodTabs.tsx
    - dashboard/src/components/leaderboard/ResetCountdown.tsx
    - dashboard/src/components/leaderboard/index.ts
    - dashboard/src/app/dashboard/leaderboard/page.tsx
  modified:
    - src/index.ts
    - dashboard/src/lib/api.ts
decisions:
  - key: monthly-points-aggregation
    choice: Raw SQL query for monthly points from PointTransaction
    rationale: Prisma doesn't support conditional sums in groupBy; raw SQL required
  - key: privacy-filter-in-query
    choice: Filter leaderboardVisible in both queries
    rationale: Consistent privacy enforcement for rankings and rank calculation
  - key: percentile-calculation
    choice: Calculate percentile from rank/totalParticipants
    rationale: Shows "Top X% of the guild" for supportive messaging
metrics:
  duration: ~5 minutes
  completed: 2026-01-24
---

# Phase 32 Plan 05: Leaderboard Page Summary

**One-liner:** Guild rankings with monthly/all-time toggle, pinned member position, reset countdown timer, and supportive "How to Earn Gold" guide.

## What Was Built

### Backend API (src/routes/leaderboard.ts)

**GET /api/leaderboard?period=month|alltime**
- Returns top 25 members ranked by points (GAME-09)
- Calculates current member's rank even if outside top 25 (GAME-10)
- Filters out members with leaderboardVisible=false (GAME-11)
- Monthly period uses raw SQL to aggregate PointTransaction since month start
- All-time uses totalPoints directly from Member
- Includes nextResetAt timestamp for countdown timer

### Frontend Hook (useLeaderboard.ts)
- Period parameter support (month/alltime)
- 5-minute stale time and refetch interval (JOBS-03)
- React Query for caching and automatic refetching

### UI Components

**RankBadge**
- Trophy icon for 1st place (gold)
- Medal icon for 2nd place (silver)
- Award icon for 3rd place (bronze)
- Number display for ranks 4+

**PeriodTabs (GAME-12)**
- Toggle between "This Month" and "All Time"
- Active tab highlighted with background
- Smooth transition on selection

**ResetCountdown (GAME-12)**
- Shows days, hours, minutes until monthly reset
- Updates every minute
- Clock icon for visual indicator

**LeaderboardTable**
- Header row with Rank, Member, Streak, Points columns
- Member rows with avatar placeholder, username, streak flame, points
- Current member highlighted with gold background
- Pinned row at bottom when member outside top 25
- Empty state message encouraging engagement

### Leaderboard Page (/dashboard/leaderboard)
- "Guild Rankings" header with supportive subtitle
- Period tabs and countdown timer in header bar
- Your progress card showing rank, points, and percentile
- Top 25 table with pinned member if needed
- "How to Earn Gold" section showing point values

## Commits

| # | Hash | Description |
|---|------|-------------|
| 1 | 2241f99 | Create leaderboard API endpoint and hook |
| 2 | 4224fbc | Create leaderboard components |
| 3 | 18e3a3b | Create leaderboard page |

## Success Criteria Met

- [x] UI-06: Leaderboard page showing rankings
- [x] UI-11: Mobile responsive - verified at 375px breakpoint
- [x] GAME-09: Top 25 members ranked by total points
- [x] GAME-10: Current member rank shown even if outside top 25
- [x] GAME-11: Members with leaderboardVisible=false excluded from rankings
- [x] GAME-12: Monthly/All-time toggle with countdown timer to reset
- [x] GAME-13: Current streak shown in leaderboard
- [x] JOBS-03: 5-minute refresh via React Query (client-side)

## Deviations from Plan

None - plan executed as written.

## Technical Notes

### Monthly Points Calculation
The monthly leaderboard requires summing points from PointTransaction table since the first of the month. Prisma's groupBy doesn't support conditional sums, so raw SQL with COALESCE(SUM(pt.points), 0) is used.

### Privacy Filtering
Both the top 25 query and the current member rank calculation filter by leaderboardVisible=true. This ensures members who opt out of the leaderboard don't affect others' rankings.

### Mobile Responsiveness
- Period tabs remain inline at all sizes
- Your progress card stacks vertically on mobile
- Table uses 12-column grid with appropriate spans
- How to Earn cards: 2 columns on desktop, 1 on mobile

### API Response Shape
```typescript
{
  period: 'month' | 'alltime';
  topMembers: LeaderboardMember[];
  currentMember: LeaderboardMember | null;
  totalParticipants: number;
  nextResetAt: string; // ISO date
}
```

## Next Steps

- Phase 32 complete after this plan
- Phase 33: Testing and polish (if applicable)
- Future: Privacy settings toggle for leaderboardVisible
