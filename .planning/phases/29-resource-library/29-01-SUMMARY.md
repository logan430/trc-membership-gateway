---
phase: 29-resource-library
plan: 01
subsystem: database
tags: [prisma, supabase, file-type, storage, validation, migration]

# Dependency graph
requires:
  - phase: 26-database-schema
    provides: Prisma migration patterns, zero-downtime conventions
provides:
  - Resource model with flat tags, versioning, and publishing states
  - ResourceTag model for admin-managed tag list
  - ResourceVersion model for version history
  - Supabase Storage client with service role key
  - File validation via magic number detection
affects: [29-02, 29-03, 32-frontend]

# Tech tracking
tech-stack:
  added: [@supabase/supabase-js, file-type]
  patterns: [magic-number-validation, private-bucket-storage, zero-downtime-migration]

key-files:
  created:
    - prisma/migrations/20260123183355_resource_library_schema/migration.sql
    - src/lib/supabase.ts
    - src/lib/file-validation.ts
  modified:
    - prisma/schema.prisma
    - src/config/env.ts
    - .env.example

key-decisions:
  - "Flat tags instead of hierarchical categories (per CONTEXT.md)"
  - "ResourceStatus enum: DRAFT, PUBLISHED, SCHEDULED"
  - "storagePath field replaces fileUrl for Supabase Storage paths"
  - "NOT VALID foreign key for zero-downtime migration"
  - "DOCX/XLSX detected as ZIP is valid (Office Open XML format)"

patterns-established:
  - "File validation pattern: magic number detection before storage"
  - "Supabase client singleton with lazy initialization"
  - "Extension spoofing prevention via cross-validation"

# Metrics
duration: 7min
completed: 2026-01-23
---

# Phase 29 Plan 01: Resource Library Schema and Infrastructure Summary

**Prisma schema with Resource/ResourceTag/ResourceVersion models, Supabase Storage client, and file validation via magic number detection**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-23T18:32:58Z
- **Completed:** 2026-01-23T18:40:16Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Resource model evolved with flat tags (String[]), version history, and publishing states (Draft/Published/Scheduled)
- ResourceTag table for admin-managed tag list with unique constraint
- ResourceVersion table for tracking file versions with changelog support
- Supabase Storage client configured with service role key for server-side operations
- File validation service with magic number detection for PDF, DOCX, XLSX, MP4, ZIP
- SVG and XML files blocked per SEC-03 (XSS prevention)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create resource library schema migration** - `627a6ef` (feat)
2. **Task 2: Add Supabase Storage client and env vars** - `7e71ff9` (feat)
3. **Task 3: Create file validation service** - `14cc729` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - ResourceStatus enum, ResourceTag, Resource, ResourceVersion models
- `prisma/migrations/20260123183355_resource_library_schema/migration.sql` - Zero-downtime migration with NOT VALID FK
- `src/config/env.ts` - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
- `.env.example` - Supabase Storage configuration documentation
- `src/lib/supabase.ts` - Supabase client singleton with service role key
- `src/lib/file-validation.ts` - Magic number validation with extension cross-check
- `package.json` - Added @supabase/supabase-js and file-type dependencies

## Decisions Made
- **Flat tags over categories:** Per CONTEXT.md, removed ResourceCategory enum in favor of String[] tags array with GIN index
- **storagePath vs fileUrl:** Changed from URL to storage path pattern for Supabase Storage integration
- **ResourceStatus enum:** DRAFT (default), PUBLISHED, SCHEDULED for publishing workflow
- **Zero-downtime migration:** Used IF EXISTS guards, NOT VALID FK, and data migration (fileUrl -> storagePath) before column drop
- **Office format detection:** DOCX/XLSX detected as application/zip is valid because Office Open XML files are ZIP archives internally

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing TypeScript errors**
- **Found during:** Task 2 (npm run build)
- **Issue:** Optional env vars (DISCORD_REDIRECT_URI, DISCORD_INVITE_URL) passed directly to URLSearchParams which requires string
- **Fix:** Added null coalescing to provide fallback values (APP_URL-based redirect, /dashboard fallback)
- **Files modified:** src/auth/discord-oauth.ts, src/routes/claim.ts, src/routes/team-dashboard.ts
- **Verification:** npm run build compiles without errors
- **Committed in:** 7e71ff9 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Pre-existing TypeScript error prevented build verification. Fix was necessary for task completion. No scope creep.

## Issues Encountered
None - all planned work executed as specified.

## User Setup Required

**External services require manual configuration.** The plan frontmatter specifies:

### Environment Variables
Add to `.env`:
```
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Dashboard Configuration
1. Create private bucket named 'resources' in Supabase Storage
   - Location: Supabase Dashboard -> Storage -> New Bucket
   - Name: resources
   - Public: OFF (private bucket)

### Verification
After configuration, the app will use the Supabase client when storage operations are invoked in future plans.

## Next Phase Readiness
- Schema ready for migration application (zero-downtime patterns applied)
- Supabase client ready for storage service layer (Plan 02)
- File validation ready for upload middleware integration (Plan 02)
- No blockers for Plan 29-02 (Storage Service Layer)

---
*Phase: 29-resource-library*
*Completed: 2026-01-23*
