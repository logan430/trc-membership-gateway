---
phase: 34
plan: 04
subsystem: admin-frontend
tags: [admin, resources, benchmarks, points-config, react-query]
dependency-graph:
  requires: ["34-01", "34-02", "34-03"]
  provides: ["admin-resources-ui", "admin-benchmarks-ui", "admin-points-config-ui"]
  affects: ["resource-management", "benchmark-moderation"]
tech-stack:
  added: ["date-fns"]
  patterns: ["inline-edit-forms", "file-upload", "expandable-cards"]
key-files:
  created:
    - dashboard/src/hooks/useAdminResources.ts
    - dashboard/src/hooks/useAdminBenchmarks.ts
    - dashboard/src/hooks/useAdminPointsConfig.ts
    - dashboard/src/components/admin/ResourceUploader.tsx
    - dashboard/src/components/admin/FlaggedBenchmarkCard.tsx
    - dashboard/src/app/admin/resources/page.tsx
    - dashboard/src/app/admin/resources/[id]/page.tsx
    - dashboard/src/app/admin/benchmarks/page.tsx
    - dashboard/src/app/admin/points-config/page.tsx
  modified:
    - dashboard/src/lib/admin-api.ts
    - dashboard/src/components/ui/GoldCoinsLoader.tsx
decisions:
  - id: expandable-benchmark-cards
    choice: "Expandable cards with JSON data view"
    rationale: "Admins need to see raw data but don't need it always visible"
  - id: inline-point-config-edit
    choice: "Inline editing rather than modal or separate page"
    rationale: "Quick edits are more common than bulk changes"
  - id: reject-without-reason
    choice: "Reject benchmarks without requiring reason input"
    rationale: "Backend API uses approve/reject action enum, no reason field required"
metrics:
  duration: "6 minutes"
  completed: "2026-01-27"
---

# Phase 34 Plan 04: New Admin Feature UIs Summary

**One-liner:** Built admin UIs for resources CRUD with versioning, flagged benchmarks moderation, and points configuration editor.

## What Was Built

### 1. Admin API Extensions (admin-api.ts)
Extended the admin API client with three new modules:
- **adminResourcesApi**: CRUD operations, versioning, tags management
- **adminBenchmarksApi**: Flagged submissions list, approve/reject actions, stats
- **adminPointsConfigApi**: List configs, update point values

### 2. React Query Hooks
Created three new hook files for state management:
- **useAdminResources.ts**: useResources, useResource, useCreateResource, useUpdateResource, useUploadVersion, useDeleteResource, useResourceTags
- **useAdminBenchmarks.ts**: useFlaggedBenchmarks, useBenchmarkStats, useApproveBenchmark, useRejectBenchmark
- **useAdminPointsConfig.ts**: usePointConfigs, useUpdatePointConfig

### 3. Resources Management Pages
- **Resources List** (`/admin/resources`): Searchable, filterable resource grid with type/status badges
- **Resource Detail** (`/admin/resources/[id]`): Edit form with version history sidebar and new version upload modal
- **ResourceUploader Component**: File drop zone with metadata form

### 4. Benchmarks Moderation Page
- **Benchmarks Page** (`/admin/benchmarks`): Flagged submissions queue with stats overview
- **FlaggedBenchmarkCard Component**: Expandable card showing submission data with approve/reject buttons

### 5. Points Configuration Page
- **Points Config Page** (`/admin/points-config`): List of point actions with inline editing
- **PointConfigCard Component**: View/edit toggle for each point action

## Key Implementation Details

### File Upload Pattern
Used FormData with getAdminToken() helper for file uploads since adminFetch uses JSON content type:
```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('metadata', JSON.stringify(metadata));
const response = await fetch('/api/admin/resources', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
```

### Benchmark API Integration
The backend uses `/review` endpoint with action enum rather than separate approve/reject endpoints:
```typescript
approve: (id: string) =>
  adminFetch<{ success: boolean }>(`/api/admin/benchmarks/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ action: 'approve' }),
  }),
```

### Inline Editing Pattern
Points config uses inline editing with local state that resets on cancel:
- View mode shows label, points, and edit button
- Edit mode expands to full form
- Cancel resets to original values from config

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added PageLoader message prop**
- **Found during:** Task 3
- **Issue:** PageLoader component didn't accept a message prop but admin pages were passing custom messages
- **Fix:** Added optional message prop to PageLoader with default value
- **Files modified:** dashboard/src/components/ui/GoldCoinsLoader.tsx
- **Commit:** 83a0eba

**2. [Rule 3 - Blocking] Installed date-fns dependency**
- **Found during:** Task 4 verification
- **Issue:** date-fns not installed but used for formatDistanceToNow
- **Fix:** npm install date-fns
- **Files modified:** dashboard/package.json, dashboard/package-lock.json
- **Commit:** 83a0eba

**3. [Rule 1 - Bug] Adjusted benchmark API to match backend**
- **Found during:** Task 1
- **Issue:** Plan showed separate approve/reject endpoints but backend uses single /review endpoint
- **Fix:** Used correct /review endpoint with action body
- **Files modified:** dashboard/src/lib/admin-api.ts
- **Commit:** 239e1e1

## Verification Results

All TypeScript compilation passes. Pages created:
- `/admin/resources` - Resource list with CRUD
- `/admin/resources/[id]` - Resource detail with versioning
- `/admin/benchmarks` - Flagged benchmarks moderation
- `/admin/points-config` - Point values configuration

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 239e1e1 | feat | Extend admin API with resources, benchmarks, points config |
| 6593a71 | feat | Create React Query hooks for admin features |
| 116fea4 | feat | Create resources management page with CRUD |
| 11a26ea | feat | Create resource detail page with versioning |
| 9097d6b | feat | Create benchmarks moderation page with approve/reject |
| 71bc985 | feat | Create points configuration page with edit capability |
| 83a0eba | fix | Add date-fns dependency and PageLoader message prop |

## Next Phase Readiness

Phase 34 is now complete. All admin pages have been migrated from static HTML to Next.js:
- Plan 01: Infrastructure setup (proxy, auth guard, layout)
- Plan 02: Members management (list, detail, points adjustment)
- Plan 03: Config pages (feature flags, templates, audit, admins)
- Plan 04: New feature UIs (resources, benchmarks, points config)

The admin dashboard is fully functional with the medieval pixel theme.

---

*Plan completed: 2026-01-27*
*Duration: ~6 minutes*
