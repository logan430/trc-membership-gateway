---
phase: 29-resource-library
plan: 02
subsystem: storage
tags: [multer, supabase-storage, signed-urls, clamav, rate-limiting]

# Dependency graph
requires:
  - phase: 29-01
    provides: Supabase client, file validation service, Resource schema
provides:
  - Upload rate limiter (5 files/hour/admin)
  - Multer middleware with 100MB limit
  - Supabase Storage upload/delete functions
  - Signed URL generation (1-hour expiry, attachment headers)
  - Optional ClamAV malware scanning
  - Resource domain types for CRUD operations
affects: [29-03-resource-api, admin-resources, member-downloads]

# Tech tracking
tech-stack:
  added: [multer, @types/multer]
  patterns: [rate-limit-by-admin-id, optional-dynamic-imports, storage-path-organization]

key-files:
  created:
    - src/middleware/rate-limit.ts (uploadLimiter export)
    - src/storage/types.ts
    - src/storage/upload.ts
    - src/storage/download.ts
    - src/storage/malware-scan.ts
    - src/resources/types.ts
    - src/types/clamscan.d.ts
  modified:
    - src/config/env.ts
    - .env.example
    - package.json

key-decisions:
  - "Dynamic import for clamscan (optional dependency)"
  - "Fail-open on malware scan errors (can be changed to fail-closed)"
  - "Admin ID from res.locals.admin for rate limit keying"
  - "Storage path pattern: uploads/{adminId}/{timestamp}-{sanitized-filename}"

patterns-established:
  - "Optional dependency via dynamic import with type declaration"
  - "Rate limiter keyed by authenticated user ID"
  - "Storage path organization by uploader and timestamp"

# Metrics
duration: 8min
completed: 2026-01-23
---

# Phase 29 Plan 02: Storage Service Layer Summary

**Multer upload middleware with 100MB limit, Supabase Storage integration, signed URL generation (1-hour/attachment), and optional ClamAV malware scanning**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-23T19:15:00Z
- **Completed:** 2026-01-23T19:23:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Upload rate limiter enforcing 5 files/hour/admin (SEC-07)
- Multer middleware with 100MB file size limit (SEC-01)
- Supabase Storage upload with organized paths and malware scanning
- Signed URL generation with 1-hour expiry and Content-Disposition: attachment (SEC-05, SEC-06)
- Optional ClamAV integration for malware detection (SEC-04)
- Complete resource domain types for API layer

## Task Commits

Each task was committed atomically:

1. **Task 1: Add upload rate limiter and install multer** - `52953c1` (feat)
2. **Task 2: Create storage service layer with malware scanning** - `a7adcf5` (feat)
3. **Task 3: Create resource domain types** - `8d52b45` (feat)

## Files Created/Modified

### Created
- `src/middleware/rate-limit.ts` - Added uploadLimiter (5 files/hour/admin)
- `src/storage/types.ts` - Storage constants and interfaces (MAX_FILE_SIZE, SIGNED_URL_EXPIRY)
- `src/storage/upload.ts` - Multer middleware and uploadToStorage function
- `src/storage/download.ts` - Signed URL generation with attachment headers
- `src/storage/malware-scan.ts` - Optional ClamAV malware scanning
- `src/resources/types.ts` - Domain types for resource CRUD operations
- `src/types/clamscan.d.ts` - Type declarations for optional clamscan module

### Modified
- `src/config/env.ts` - Added ENABLE_MALWARE_SCAN, CLAMAV_HOST, CLAMAV_PORT
- `.env.example` - Added malware scanning env vars section
- `package.json` - Added multer and @types/multer

## Decisions Made

1. **Dynamic import for clamscan** - Using dynamic import() for the optional clamscan module allows TypeScript to compile even when the package isn't installed. Added type declaration file for type safety.

2. **Fail-open on malware scan errors** - If ClamAV scanner fails/times out, uploads proceed with `scanned: false`. This can be changed to fail-closed for stricter security but risks blocking legitimate uploads during scanner issues.

3. **Admin ID rate limit keying** - Rate limiter uses `res.locals.admin.id` from the authentication middleware to key limits per admin, ensuring the limit applies after authentication.

4. **Storage path organization** - Paths follow `uploads/{adminId}/{timestamp}-{sanitized-filename}` pattern for easy attribution and uniqueness without database lookup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added clamscan type declaration**
- **Found during:** Task 2 (Create storage service layer)
- **Issue:** TypeScript failed to compile because `clamscan` module has no types and isn't installed by default
- **Fix:** Created `src/types/clamscan.d.ts` with interface definitions for the optional module
- **Files modified:** src/types/clamscan.d.ts
- **Verification:** npm run build passes
- **Committed in:** a7adcf5 (Task 2 commit)

**2. [Rule 3 - Blocking] Regenerated Prisma client**
- **Found during:** Task 3 (Create resource domain types)
- **Issue:** ResourceStatus and ResourceType not exported from @prisma/client - schema updated in 29-01 but client not regenerated
- **Fix:** Ran `npx prisma generate` to regenerate client with new types
- **Files modified:** None (generated files in node_modules)
- **Verification:** npm run build passes, imports work
- **Committed in:** Not committed (regenerated files)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for build to succeed. No scope creep.

## Issues Encountered
None - plan executed as specified after auto-fixes.

## User Setup Required

**Malware Scanning (Optional)**

If you want to enable malware scanning on file uploads:

1. Install ClamAV daemon on your server
2. Add to `.env`:
   ```
   ENABLE_MALWARE_SCAN=true
   CLAMAV_HOST=localhost
   CLAMAV_PORT=3310
   ```
3. Install the clamscan package: `npm install clamscan`

Without these settings, malware scanning is disabled and uploads proceed without scanning.

## Next Phase Readiness

Ready for Plan 29-03 (Resource API Endpoints):
- Storage services ready: upload, download, delete
- Rate limiting ready for upload routes
- Domain types ready for request/response typing
- All security requirements (SEC-01 through SEC-07) infrastructure in place

No blockers.

---
*Phase: 29-resource-library*
*Completed: 2026-01-23*
