---
phase: 25-member-self-service-dashboard
plan: 02
subsystem: auth
tags: [jwt, token-refresh, admin, security]

# Dependency graph
requires:
  - phase: 10-admin-system
    provides: Admin authentication with JWT tokens and refresh endpoints
provides:
  - Admin login page validates token expiry before auto-redirect
  - Expired tokens trigger silent refresh attempt
  - Invalid/expired tokens without valid refresh stay on login page
affects: [admin-dashboard, admin-security]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - JWT expiry validation before auto-redirect
    - Silent refresh attempt for expired tokens
    - Client-side token parsing for expiry check

key-files:
  created: []
  modified:
    - public/admin/login.html

key-decisions:
  - "Token expiry check before redirect prevents infinite loops"
  - "Silent refresh attempt preserves session when refresh token valid"
  - "Clear token on invalid/expired/failed refresh keeps user on login"

patterns-established:
  - "parseAdminToken(): Client-side JWT parsing for exp claim validation"
  - "tryRefreshAndRedirect(): Async silent refresh with fallback to clear token"

# Metrics
duration: 1min
completed: 2026-01-22
---

# Phase 25 Plan 02: Token Auto-Refresh and Admin Login Validation Summary

**Admin login validates JWT expiry before auto-redirect, preventing redirect loops with expired tokens via silent refresh attempt**

## Performance

- **Duration:** 1 min
- **Started:** 2026-01-22T01:54:00Z
- **Completed:** 2026-01-22T01:54:51Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added parseAdminToken() function to decode JWT and extract payload including exp claim
- Added tryRefreshAndRedirect() to attempt silent token refresh via /admin/auth/refresh
- Updated checkAuth() to validate token expiry before redirecting to dashboard
- Expired tokens trigger refresh attempt; failed refresh clears token and stays on login

## Task Commits

Each task was committed atomically:

1. **Task 1: Update admin login checkAuth with token expiry validation** - `e0eb393` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Modified

- `public/admin/login.html` - Added token expiry validation to checkAuth(), parseAdminToken() for JWT decoding, and tryRefreshAndRedirect() for silent refresh

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Check exp claim in milliseconds | JWT exp is in seconds, Date.now() in milliseconds, multiply by 1000 |
| Silent refresh before clearing token | Better UX - preserves session if refresh token is still valid |
| Clear token on any failure | Invalid token, missing exp, or failed refresh all result in clean slate |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed plan specification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Admin login page now properly handles expired tokens
- Prevents redirect loops when admin tokens expire
- Success criteria #9 "Admin login validates token expiry before auto-redirect" is now satisfied

**Verification steps (manual):**
1. Navigate to /app/admin/login
2. Clear localStorage.adminAccessToken and refresh - stays on login
3. Set expired token and refresh - triggers refresh attempt, then clears token
4. Valid login still redirects to dashboard correctly

---
*Phase: 25-member-self-service-dashboard*
*Completed: 2026-01-22*
