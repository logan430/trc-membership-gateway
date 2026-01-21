---
phase: 22-operational-readiness
plan: 02
subsystem: infra
tags: [sentry, error-monitoring, express, observability]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Express server structure and env configuration
provides:
  - Sentry error monitoring integration
  - Production error capture middleware
  - start:prod script for Sentry-enabled production
affects: [deployment, production-operations]

# Tech tracking
tech-stack:
  added: ["@sentry/node v10.36.0"]
  patterns: ["conditional initialization based on env", "instrument file pattern for ESM"]

key-files:
  created: ["src/instrument.ts"]
  modified: ["src/index.ts", "src/config/env.ts", "package.json", ".env.example"]

key-decisions:
  - "SENTRY_DSN is optional - app runs without it (graceful degradation)"
  - "Sentry only initializes in production with DSN set"
  - "10% tracesSampleRate for cost efficiency"
  - "start:prod script uses --import flag for ESM instrumentation"

patterns-established:
  - "Instrument file pattern: Sentry must init before other modules via --import"
  - "Conditional monitoring: Check env vars before enabling features"

# Metrics
duration: 4min
completed: 2026-01-21
---

# Phase 22 Plan 02: Sentry Error Monitoring Summary

**Sentry error monitoring integration with conditional initialization and Express error handler**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-21T11:24:00Z
- **Completed:** 2026-01-21T11:28:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Installed @sentry/node SDK for production error tracking
- Created instrument.ts with conditional Sentry initialization
- Integrated Express error handler to capture route errors
- Added start:prod script for Sentry-enabled production deployments

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Sentry SDK and add env var** - `15f9b9c` (chore)
2. **Task 2: Create Sentry instrument file** - `534429f` (feat)
3. **Task 3: Add Sentry Express error handler to index.ts** - `b38ee9d` (feat)

## Files Created/Modified
- `src/instrument.ts` - Sentry initialization file (imported first via --import flag)
- `src/index.ts` - Added Sentry import and setupExpressErrorHandler
- `src/config/env.ts` - Added SENTRY_DSN as optional env var
- `package.json` - Added @sentry/node dependency and start:prod script
- `.env.example` - Added SENTRY_DSN placeholder with setup instructions

## Decisions Made
- SENTRY_DSN is optional - application runs without it for graceful degradation
- Sentry only initializes when both SENTRY_DSN is set AND NODE_ENV=production
- 10% tracesSampleRate keeps monitoring costs low while providing performance data
- start:prod script added for production use; simple start preserved for backwards compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript strict mode errors (6 errors in discord-oauth.ts, claim.ts, team-dashboard.ts) cause build to exit with error code, but JavaScript output is still generated. These errors are documented in STATE.md and are unrelated to Sentry changes.

## User Setup Required

**External services require manual configuration:**

1. **Create Sentry Project:**
   - Go to Sentry Dashboard -> Projects -> Create Project
   - Select Node.js platform
   - Note your project DSN

2. **Environment Variable:**
   - Add `SENTRY_DSN=<your-dsn>` to production .env file
   - Get DSN from: Sentry Dashboard -> Settings -> Client Keys (DSN)

3. **Production Deployment:**
   - Use `npm run start:prod` instead of `npm run start`
   - This enables Sentry instrumentation via --import flag

4. **Verification:**
   - Set NODE_ENV=production and SENTRY_DSN
   - Trigger an error and verify it appears in Sentry dashboard

## Next Phase Readiness
- Sentry integration complete for production error monitoring
- App continues to function without SENTRY_DSN (graceful degradation)
- Ready for remaining operational readiness tasks

---
*Phase: 22-operational-readiness*
*Completed: 2026-01-21*
