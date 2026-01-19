---
phase: 05-team-management
plan: 02
subsystem: dashboard
tags: [api, dashboard, team, prisma, ui]

dependency-graph:
  requires:
    - 05-01 (team schema, company checkout)
  provides:
    - team-dashboard-api
    - team-dashboard-ui
    - seat-visibility
  affects:
    - 05-03 (invite buttons placeholder ready)
    - 05-05 (revocation needs dashboard to show revoke buttons)

tech-stack:
  added: []
  patterns:
    - owner-only-access-control
    - member-grouping-by-seat-tier
    - medieval-themed-dashboard

file-tracking:
  key-files:
    created:
      - src/routes/team-dashboard.ts
      - public/team-dashboard.html
    modified:
      - src/index.ts

decisions:
  - id: owner-only-dashboard
    choice: Only OWNER seatTier can access dashboard
    why: Per CONTEXT.md - team members cannot view seat allocation
  - id: member-sort-order
    choice: Sort by isPrimaryOwner desc, seatTier asc, createdAt asc
    why: Primary owner first, then by tier, then by join order
  - id: status-from-discordid
    choice: Derive claimed/pending status from discordId presence
    why: Members with discordId have completed Discord linking

metrics:
  duration: 3 min
  completed: 2026-01-19
---

# Phase 5 Plan 2: Team Dashboard Summary

**One-liner:** Team dashboard API and UI showing seat allocation with owner-only access control

## What Was Built

### Team Dashboard API Endpoint
`GET /team/dashboard`:
- Requires Bearer token authentication
- Returns 404 if user not part of a team
- Returns 403 if user is not OWNER seatTier
- Queries team with all members included
- Groups members by seatTier (owners vs team)
- Calculates seat summary: claimed/total for each tier
- Returns structured response with team info, seats, members, currentUser

### Team Dashboard HTML Page
`/team-dashboard.html`:
- Medieval theme consistent with Gatekeeper page
- Seat summary display: Owner Seats X/Y | Team Seats X/Y (with chess piece icons)
- Two sections: Owners and Team Members
- Member cards showing name, email, status badges (Claimed/Pending), intro status
- Primary owner highlighted with crown icon and gold border
- Error handling: redirects on 401, shows message on 403/404
- Responsive design for mobile devices
- Action buttons placeholder for future invite/revoke features

## API Response Structure

```typescript
{
  team: { id, name, subscriptionStatus },
  seats: {
    owner: { claimed: 2, total: 3 },
    team: { claimed: 5, total: 10 }
  },
  members: {
    owners: [{ id, name, email, status, introCompleted, isPrimaryOwner }],
    team: [{ id, name, email, status, introCompleted }]
  },
  currentUser: { id, isPrimaryOwner }
}
```

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Access control | OWNER seatTier only | Per CONTEXT.md - owners only can access dashboard |
| Member status | Derived from discordId | If discordId exists, they've completed claim flow |
| Sort order | Primary first, then tier, then date | Logical grouping for dashboard display |
| UI empty states | Distinct messages per section | Clear communication when no seats claimed |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 4db73c2 | feat | Team dashboard API endpoint |
| 32e6ccf | feat | Team dashboard HTML page |

## Next Phase Readiness

**Ready for 05-03 (Invite Tokens):**
- Dashboard displays where invites will be shown
- Action buttons placeholder ready for invite generation
- API returns currentUser.isPrimaryOwner for permission checks

**Ready for 05-05 (Seat Revocation):**
- Member cards display member IDs needed for revocation
- Dashboard can show revoke buttons per member

**Pre-existing issues (documented in STATE.md):**
- TypeScript errors in discord-oauth.ts, claim.ts, team-invites.ts remain

## Files Changed

```
src/routes/team-dashboard.ts | NEW - GET /team/dashboard API endpoint
public/team-dashboard.html   | NEW - Dashboard UI with medieval theme
src/index.ts                 | Mount teamDashboardRouter at /team
```
