---
phase: 31-nextjs-frontend
plan: 03
subsystem: auth
tags: [jwt, jose, next-middleware, cookies, api-client]

# Dependency graph
requires:
  - phase: 31-01
    provides: Next.js 15 app structure with jose installed
  - phase: 31-02
    provides: Express proxy and cookie configuration (sameSite lax, path /)
provides:
  - JWT verification library matching Express token format
  - Next.js auth middleware protecting /dashboard/* routes
  - API client with cookie-based authentication
affects: [31-04-dashboard-shell, 32-member-pages]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "verifyToken returns null on any error (no exceptions)"
    - "credentials: include for all API fetches"
    - "x-member-id header injection for server components"

key-files:
  created:
    - dashboard/src/lib/auth.ts
    - dashboard/src/middleware.ts
    - dashboard/src/lib/api.ts
  modified: []

key-decisions:
  - "Validate JWT_SECRET existence before verification attempt"
  - "Return null on verification error (consistent with Express)"
  - "Add x-member-id header for server component access"
  - "Include returnTo query param on login redirect"

patterns-established:
  - "verifyToken: Returns payload or null, never throws"
  - "apiFetch: Wrapper with credentials and 401 handling"
  - "Middleware matcher: /dashboard/:path* only"

# Metrics
duration: 3min
completed: 2026-01-24
---

# Phase 31 Plan 03: Auth Middleware Summary

**Next.js JWT auth middleware using jose library with matching Express token validation and cookie-based API client**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-24T02:45:27Z
- **Completed:** 2026-01-24T02:48:30Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments
- JWT verification library that matches Express token format exactly
- Next.js middleware protecting all /dashboard/* routes
- Type-safe API client for Express backend with automatic cookie forwarding

## Task Commits

Each task was committed atomically:

1. **Task 1: Create JWT verification library** - `69c5647` (feat)
2. **Task 2: Create Next.js auth middleware** - `e4e4207` (feat)
3. **Task 3: Create API client for Express backend** - `b6e1feb` (feat)

## Files Created/Modified
- `dashboard/src/lib/auth.ts` - JWT verification using jose, TokenPayload interface, cookie name constant
- `dashboard/src/middleware.ts` - Route protection for /dashboard/*, redirects to /login on auth failure
- `dashboard/src/lib/api.ts` - API client with credentials, typed endpoints for points/benchmarks/resources/member

## Decisions Made
- **Validate JWT_SECRET before verification:** Returns null early if env var missing rather than cryptic jose error
- **Return null on any verification error:** Matches Express pattern, simplifies caller logic
- **Add x-member-id header:** Server components can access authenticated member ID without re-parsing token
- **Include returnTo param:** Users return to their original destination after login
- **Debug logging in development only:** Token failures logged only when NODE_ENV=development

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Initial Next.js build failed due to OneDrive sync conflicts with .next cache
- Resolved by cleaning .next directory and rebuilding
- Build succeeded on second attempt, TypeScript and middleware fully validated

## User Setup Required
None - no external service configuration required. JWT_SECRET environment variable should already be configured from Express setup.

## Next Phase Readiness
- Auth middleware ready to protect React dashboard pages
- API client ready for data fetching in React components
- Need to create dashboard shell layout with sidebar navigation (31-04)

---
*Phase: 31-nextjs-frontend*
*Completed: 2026-01-24*
