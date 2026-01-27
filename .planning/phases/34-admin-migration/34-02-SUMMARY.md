---
phase: 34
plan: 02
subsystem: admin-dashboard
tags: ["next.js", "admin", "members", "points", "react-query"]
depends_on:
  requires: ["34-01"]
  provides: ["admin-login-page", "admin-dashboard-page", "admin-members-page", "admin-member-detail-page"]
  affects: ["34-03", "34-04"]
tech-stack:
  added: []
  patterns: ["admin-api-extension", "react-query-admin-hooks", "route-group-auth-bypass"]
key-files:
  created:
    - "dashboard/src/hooks/useAdminMembers.ts"
    - "dashboard/src/app/admin/(auth)/layout.tsx"
    - "dashboard/src/app/admin/(auth)/login/page.tsx"
    - "dashboard/src/app/admin/dashboard/page.tsx"
    - "dashboard/src/app/admin/members/page.tsx"
    - "dashboard/src/app/admin/members/[id]/page.tsx"
    - "dashboard/src/components/admin/MembersTable.tsx"
    - "dashboard/src/components/admin/MemberInfoCard.tsx"
    - "dashboard/src/components/admin/PointsAdjuster.tsx"
  modified:
    - "dashboard/src/lib/admin-api.ts"
    - "dashboard/src/components/admin/index.ts"
decisions:
  - key: "(auth) route group for login"
    choice: "Use route group with passthrough layout"
    reason: "Allows login page to bypass AdminAuthGuard and sidebar"
  - key: "adminAuthApi.login endpoint"
    choice: "POST /admin/auth/login"
    reason: "Matches existing static HTML login endpoint"
  - key: "MemberFilters status param"
    choice: "Map status filter to subscriptionStatus query param"
    reason: "Matches backend API expected parameter name"
metrics:
  duration: "~6 minutes"
  completed: "2026-01-27"
---

# Phase 34 Plan 02: Core Admin Pages Summary

Admin login, dashboard overview, members list, and member detail pages migrated to Next.js with React Query data fetching.

## What Was Built

### Admin API Extensions
- Extended `admin-api.ts` with `adminAuthApi` (login/logout) and `adminMembersApi` (list, get, update, adjustPoints, getPointsHistory)
- Added TypeScript interfaces: `AdminMember`, `MembersListResponse`, `MemberFilters`, `PointTransaction`, `PointsHistoryResponse`

### React Query Hooks
- `useMembers(filters)` - paginated members list with search and status filters
- `useMember(id)` - single member details
- `useAdjustPoints(memberId)` - mutation for adding/deducting points
- `usePointsHistory(memberId)` - member point transaction history
- `useUpdateMember(memberId)` - mutation for updating member data

### Admin Pages
1. **Login Page** (`/admin/login`)
   - Medieval-styled login form with Shield icon
   - Uses `adminAuthApi.login()` for authentication
   - Stores token in localStorage, redirects to dashboard
   - Uses (auth) route group to bypass auth guard

2. **Dashboard Page** (`/admin/dashboard`)
   - KPI cards: Total Members, Active Members, New (30d), MRR
   - Quick links to Members, Benchmarks, Analytics, Resources
   - At-risk members widget showing top 5 churn risks
   - Benchmark activity stats section

3. **Members List Page** (`/admin/members`)
   - Search by email or username
   - Status filter dropdown (Active, Trialing, Past Due, Canceled)
   - Paginated table with member info, status badge, points, activity
   - Click-through to member detail

4. **Member Detail Page** (`/admin/members/[id]`)
   - MemberInfoCard with avatar, email, Discord, dates, points, streak
   - PointsAdjuster with Add/Deduct toggle, reason field, notify checkbox
   - Points history table showing all transactions

### Components
- `MembersTable` - reusable table with status badges and pagination
- `MemberInfoCard` - member profile card with all key info
- `PointsAdjuster` - form for admin point adjustments

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| (auth) route group | Bypasses AdminAuthGuard for login page without nesting complexity |
| adminAuthApi uses /admin/auth/* | Consistent with existing backend auth endpoints |
| subscriptionStatus filter param | Matches backend expected query parameter name |
| Reset form after successful adjustment | Provides clear feedback and prevents double-submission |

## Commits

| Hash | Description |
|------|-------------|
| 036e7fc | feat(34-02): extend admin API client with auth and members endpoints |
| ad0e22f | feat(34-02): create admin members React Query hooks |
| 36cdae9 | feat(34-02): create admin login page |
| 3242120 | feat(34-02): create admin dashboard overview page |
| a3d92ce | feat(34-02): create members list page with table and filters |
| 0900237 | feat(34-02): create member detail page with points adjustment |

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

**Created:**
- `dashboard/src/hooks/useAdminMembers.ts` (87 lines)
- `dashboard/src/app/admin/(auth)/layout.tsx` (14 lines)
- `dashboard/src/app/admin/(auth)/login/page.tsx` (103 lines)
- `dashboard/src/app/admin/dashboard/page.tsx` (148 lines)
- `dashboard/src/app/admin/members/page.tsx` (103 lines)
- `dashboard/src/app/admin/members/[id]/page.tsx` (109 lines)
- `dashboard/src/components/admin/MembersTable.tsx` (91 lines)
- `dashboard/src/components/admin/MemberInfoCard.tsx` (99 lines)
- `dashboard/src/components/admin/PointsAdjuster.tsx` (125 lines)

**Modified:**
- `dashboard/src/lib/admin-api.ts` (+133 lines)
- `dashboard/src/components/admin/index.ts` (+3 exports)

## Next Phase Readiness

Ready for Plan 34-03: Remaining admin pages migration (config, templates, audit, admins).

**Dependencies satisfied:**
- Admin infrastructure from 34-01 (layout, auth guard, sidebar)
- Admin API client with member endpoints
- React Query hooks for data fetching

**No blockers identified.**
