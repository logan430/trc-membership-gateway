---
phase: 27
plan: 01
subsystem: points
tags: [points, configuration, caching, admin-api]

dependency_graph:
  requires: [26-03]
  provides: [point-config-model, point-config-service, admin-points-api]
  affects: [27-02, 27-03]

tech_stack:
  added: []
  patterns: [in-memory-cache-with-ttl, admin-config-crud, idempotent-seeding]

key_files:
  created:
    - prisma/migrations/20260123044437_add_point_config/migration.sql
    - src/points/types.ts
    - src/points/config.ts
    - src/routes/admin/points-config.ts
  modified:
    - prisma/schema.prisma
    - src/index.ts

decisions:
  - id: 27-01-01
    decision: "Follow FeatureFlag caching pattern exactly (60s TTL)"
    rationale: "Consistent with existing patterns, proven reliable"
  - id: 27-01-02
    decision: "admin_adjustment not configurable via admin UI"
    rationale: "Admin adjustments are manual and use arbitrary values"
  - id: 27-01-03
    decision: "Reuse FeatureFlag entityType for audit logs"
    rationale: "Point configs are similar to feature flags conceptually"

metrics:
  duration: "6 minutes"
  completed: "2026-01-23"
---

# Phase 27 Plan 01: Point Configuration Model and Admin API Summary

**One-liner:** PointConfig model with 60s cached lookups and admin CRUD API for configurable point values.

## What Was Built

### 1. PointConfig Database Model

Added `PointConfig` model to Prisma schema with:
- `action` (unique) - identifies the point action type
- `points` - configurable point value
- `enabled` - toggle to disable earning points for an action
- `label` - human-readable name for admin UI
- `description` - optional admin notes
- `updatedBy` - admin ID for audit trail

Migration uses `IF NOT EXISTS` patterns for zero-downtime deployment.

### 2. Point Types System

Created `src/points/types.ts` with:
- `PointAction` constant object with all action types
- `PointActionType` TypeScript type
- `PointActionLabels` for UI display names
- `CONFIGURABLE_ACTIONS` array (excludes admin_adjustment)

### 3. Point Configuration Service

Created `src/points/config.ts` with caching pattern matching FeatureFlag:
- `getPointValue(action)` - returns points (0 if disabled)
- `isActionEnabled(action)` - boolean check
- `invalidateConfigCache()` - immediate cache clear
- `getAllPointConfigs()` - fresh data for admin UI
- `updatePointConfig()` - update with cache invalidation
- `seedDefaultPointConfigs()` - idempotent seeding with skipDuplicates

Default values:
- `benchmark_submission`: 50 points
- `resource_download`: 5 points
- `discord_activity`: 1 point (per 100 XP)
- `intro_completed`: 25 points

### 4. Admin Points Config API

Created `src/routes/admin/points-config.ts`:
- `GET /api/admin/points-config` - list all configs (requireAdmin)
- `PUT /api/admin/points-config/:action` - update config (requireAdmin)
- `POST /api/admin/points-config/seed` - seed defaults (requireSuperAdmin)

All updates are audit logged with `POINT_CONFIG_UPDATED` action.

### 5. Startup Seeding

Modified `src/index.ts` to:
- Import and mount `adminPointsConfigRouter`
- Call `seedDefaultPointConfigs()` on server startup (idempotent)

## Key Code Patterns

### Caching Pattern (matching FeatureFlag)

```typescript
let configCache: Map<string, CachedConfig> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000; // 1 minute

async function getConfig(action): Promise<CachedConfig | null> {
  if (configCache && Date.now() < cacheExpiry) {
    return configCache.get(action) ?? null;
  }
  // Rebuild cache from database
  const configs = await prisma.pointConfig.findMany();
  configCache = new Map(configs.map(c => [c.action, {...}]));
  cacheExpiry = Date.now() + CACHE_TTL;
  return configCache.get(action) ?? null;
}
```

### Idempotent Seeding

```typescript
await prisma.pointConfig.createMany({
  data: DEFAULT_CONFIGS,
  skipDuplicates: true,
});
```

## Verification Results

1. **Migration:** 21 migrations applied, database schema up to date
2. **Build:** Compiles successfully
3. **Server startup:** Point configs seeded (4 rows inserted)
4. **API endpoint:** Returns redirect to login (auth required as expected)

## Commits

| Commit | Description |
|--------|-------------|
| `08dd86f` | PointConfig model and migration |
| `4f2e8ef` | Point types and config service with caching |
| `b9a1b1c` | Admin points config API and router wiring |

## Deviations from Plan

None - plan executed exactly as written.

## Next Steps

- **27-02:** Point transaction service - recording points to PointTransaction table
- **27-03:** Point endpoints API - public endpoints for point values and transactions

## Files Changed

```
prisma/schema.prisma                              (+13 lines)
prisma/migrations/20260123044437_add_point_config/
  migration.sql                                   (+19 lines, new)
src/points/types.ts                               (+34 lines, new)
src/points/config.ts                              (+167 lines, new)
src/routes/admin/points-config.ts                 (+118 lines, new)
src/index.ts                                      (+7 lines)
```
