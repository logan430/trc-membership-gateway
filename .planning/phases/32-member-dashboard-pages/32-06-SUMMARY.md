---
phase: 32
plan: 06
subsystem: frontend-member
tags: [profile, account, privacy, leaderboard-opt-out, member-settings]

dependency_graph:
  requires:
    - 32-01: React Query provider and API client setup
    - 32-04: Leaderboard API endpoint for privacy toggle
  provides:
    - Profile page with point history and activity timeline
    - Account settings page with email/password management
    - Leaderboard privacy toggle (GAME-11)
  affects:
    - 33-*: Profile navigation links from sidebar

tech_stack:
  added: []
  patterns:
    - useProfile hook for dashboard data fetching
    - Privacy settings toggle with optimistic updates
    - Form validation with inline error messages

key_files:
  created:
    - dashboard/src/app/dashboard/profile/page.tsx
    - dashboard/src/app/dashboard/account/page.tsx
  modified: []

decisions:
  - decision: "Profile uses dashboard API instead of separate profile endpoint"
    rationale: "Dashboard already returns member info with timeline - no extra call needed"
    alternatives: ["Create /api/member/profile endpoint"]

metrics:
  duration: "~9 minutes"
  completed: "2026-01-24"
---

# Phase 32 Plan 06: Profile and Account Pages Summary

Profile and account settings pages with leaderboard privacy controls using hooks for dashboard data, point history, and privacy mutations.

## Tasks Completed

### Task 1: Profile hooks, privacy API, and API client updates
**Commit:** 172b717 (previously committed)
**Status:** Already complete from prior session

- `leaderboardVisible` field added to Member schema with migration
- `src/routes/member.ts` - GET/PUT /api/member/privacy endpoints
- `dashboard/src/hooks/useProfile.ts` - useProfile, usePrivacySettings, useUpdateEmail, useUpdatePassword, useUpdateLeaderboardVisibility hooks
- `dashboard/src/lib/api.ts` - dashboardApi, authApi, memberPrivacyApi clients
- `src/routes/dashboard.ts` - Added leaderboardVisible to response

### Task 2: Profile page
**Commit:** b20ff12
**Files:** `dashboard/src/app/dashboard/profile/page.tsx` (180 lines)

- Profile summary card with member info and Discord username
- Two-tab interface: Point History and Activity Timeline
- Point History tab shows transactions from usePointsHistory hook
- Activity Timeline tab shows member events from dashboard API
- Mobile responsive with proper stacking at narrow widths
- Loading state with GoldCoinsLoader

### Task 3: Account settings page with leaderboard privacy toggle
**Commit:** 66fd32c
**Files:** `dashboard/src/app/dashboard/account/page.tsx` (320 lines)

- Current account info card (email, subscription status, renewal date)
- Privacy settings section with "Show on Leaderboard" toggle (GAME-11)
- Toggle updates via useUpdateLeaderboardVisibility mutation
- Change Email form with password verification
- Change Password form with confirmation and min-length validation
- Success/error feedback for all forms
- Loading states during form submission

## Verification Results

| Check | Result |
|-------|--------|
| Backend TypeScript compiles | Pass |
| Dashboard TypeScript compiles | Pass |
| Dashboard build succeeds | Pass |
| Profile page minimum 80 lines | Pass (180 lines) |
| Account page minimum 100 lines | Pass (320 lines) |
| usePointsHistory pattern in profile | Pass |
| useUpdateEmail pattern in account | Pass |
| useUpdateLeaderboardVisibility pattern in account | Pass |

## Success Criteria Met

| Requirement | Status |
|-------------|--------|
| UI-07: Profile page showing point history | Done |
| UI-08: Account settings page (email, password) | Done |
| UI-11: Mobile responsive at 375px | Done |
| UI-12: Loading states during submission | Done |
| UI-13: Form validation with helpful errors | Done |
| GAME-11: Leaderboard visibility toggle | Done |

## Deviations from Plan

### Auto-fixed Issues

None - Task 1 was already complete from a previous session (commit 172b717). The work included:
- leaderboardVisible migration
- member router
- profile hooks
- API client updates

This was [Rule 3 - Blocking] issue as Task 1 files were needed for Tasks 2 and 3. No additional fixes were required.

## Architecture Notes

**Profile data flow:**
- Profile page uses useProfile() which calls dashboardApi.get()
- Point history uses usePointsHistory() from usePoints.ts
- Both cached by React Query with 30-60 second stale times

**Privacy toggle flow:**
- usePrivacySettings() fetches current state from /api/member/privacy
- useUpdateLeaderboardVisibility() sends PUT to /api/member/privacy
- Optimistic update with rollback on error
- Invalidates dashboard, privacy, and leaderboard queries on success

**Form validation:**
- Client-side validation before submission
- Server-side validation returns specific error messages
- Inline error display with AlertCircle icon
- Success feedback with Check icon and auto-clear

## Next Phase Readiness

**Dependencies resolved:**
- Profile and account pages complete
- Privacy toggle functional
- All member-facing dashboard pages now available

**Ready for:**
- Phase 33 (Admin Dashboard) or final integration testing
- Sidebar navigation can now link to /dashboard/profile and /dashboard/account
