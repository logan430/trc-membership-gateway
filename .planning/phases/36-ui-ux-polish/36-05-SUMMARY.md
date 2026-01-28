---
phase: 36-ui-ux-polish
plan: 05
subsystem: auth
tags: [proxy, cookies, cors, session, express, nextjs, routing]

# Dependency graph
requires:
  - phase: 35-auth-pages-migration
    provides: Next.js login/signup pages at /login, /signup
  - phase: 31-nextjs-frontend
    provides: Express-to-Next.js proxy infrastructure
provides:
  - Reliable auth flow from login to dashboard
  - Consolidated routing (single /login and /signup paths)
  - Legacy HTML auth pages redirect to Next.js pages
  - Fixed cookie forwarding through proxy
affects: [36-01, 36-02, 36-03, 36-04, auth, session]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - pathFilter proxy for URL preservation
    - Bearer token auth for API client
    - CSP unsafe-eval for Next.js dev mode

key-files:
  modified:
    - src/index.ts
    - dashboard/src/lib/api.ts
    - public/login.html
    - public/signup.html

key-decisions:
  - "pathFilter instead of app.use() for proxy routing"
  - "Bearer token in API client for dashboard requests"
  - "Redirect stubs for legacy HTML auth pages"

patterns-established:
  - "Use pathFilter in createProxyMiddleware to preserve full URL path"
  - "Legacy HTML pages should redirect to Next.js equivalents"

# Metrics
duration: 2min (continuation - task 07 only)
completed: 2026-01-28
---

# Plan 36-05: Session & Routing Fixes Summary

**Fixed auth flow with consolidated proxy routing, Bearer token API auth, and legacy page redirects for reliable login-to-dashboard navigation**

## Performance

- **Duration:** ~2 min (continuation session - task 07 only)
- **Full plan duration:** Executed across 2 sessions with human verification
- **Started:** 2026-01-28T04:54:56Z (continuation)
- **Completed:** 2026-01-28T04:56:28Z
- **Tasks:** 7 (6 prior + 1 this session)
- **Files modified:** 4

## Accomplishments

- Audited and documented complete cookie/session configuration
- Consolidated Express proxy using pathFilter to preserve URL paths
- Fixed API client to use Bearer token authentication
- Added CSP unsafe-eval for Next.js development mode HMR
- Replaced legacy HTML auth pages with redirect stubs
- Verified end-to-end auth flow with Playwright testing

## Task Commits

Each task was committed atomically:

1. **Task 01: Audit cookie configuration** - (audit only, no commit)
2. **Task 02: Fix cookie path and attributes** - (no changes needed)
3. **Task 03-04: Fix proxy cookie forwarding + consolidate routes** - `c96ec6a`, `665a7b4` (fix)
4. **Task 05: Verify CORS configuration** - (no changes needed)
5. **Task 06: End-to-end auth flow test** - `97453a4` (fix)
6. **Task 07: Clean up legacy HTML auth pages** - `0b5a831` (chore)

## Files Created/Modified

- `src/index.ts` - Consolidated proxy with pathFilter for /login, /signup, /dashboard, /admin, /_next
- `dashboard/src/lib/api.ts` - Added Bearer token to Authorization header for API requests
- `public/login.html` - Replaced with redirect stub to /login
- `public/signup.html` - Replaced with redirect stub to /signup

## Decisions Made

1. **pathFilter instead of app.use() for proxy routing** - When using app.use('/path'), Express strips the mount path from req.url, causing proxy to send '/' instead of full path. pathFilter preserves the complete URL.

2. **Bearer token in API client** - Dashboard API requests need Authorization header with Bearer token for proper authentication flow with the Express backend.

3. **CSP unsafe-eval for dev mode** - Next.js hot module reloading requires unsafe-eval in development. Only added to dev mode CSP.

4. **Redirect stubs for legacy auth pages** - Option A (redirect) chosen over Option B (delete) to maintain backward compatibility for bookmarks and avoid 404s on /login.html or /signup.html.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Task 03-04 required consolidation** - The proxy pathFilter approach naturally combined tasks 03 (cookie forwarding) and 04 (route consolidation) into a single implementation.

- **Human verification checkpoint** - Plan included checkpoint after task 06 for manual auth flow testing. User confirmed with Playwright:
  - /login loads correctly
  - Login with credentials works
  - Dashboard loads with user data
  - Session persists on refresh
  - Legacy routes redirect correctly

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Auth flow is now reliable and tested
- Wave 2 plans (36-01 Legal Pages, 36-02 Forgot Password) can proceed
- No blockers or concerns

---
*Phase: 36-ui-ux-polish*
*Completed: 2026-01-28*
