---
phase: 33-admin-analytics
plan: 01
subsystem: analytics
tags: [analytics, prisma, postgresql, aggregation, churn-prediction]
requires: [phase-26, phase-27, phase-28, phase-29]
provides: [analytics-service-layer]
affects: [phase-33-02, phase-33-03]
tech-stack:
  added: []
  patterns: [raw-sql-aggregation, multi-factor-scoring, jsonb-percentiles]
key-files:
  created:
    - src/analytics/types.ts
    - src/analytics/member-analytics.ts
    - src/analytics/engagement-analytics.ts
    - src/analytics/benchmark-analytics.ts
    - src/analytics/resource-analytics.ts
    - src/analytics/churn-prediction.ts
  modified: []
decisions:
  - key: mrr-placeholder
    value: $50/month average estimate
    rationale: Placeholder until Stripe webhook caching implemented
  - key: cohort-limit
    value: 12 months
    rationale: Reasonable historical view without excessive data
  - key: churn-scoring
    value: 0-100 with three factors (inactivity/engagement/payment)
    rationale: Matches CONTEXT.md multi-factor approach
  - key: at-risk-batch-size
    value: 500 members
    rationale: Prevent memory issues with large member counts
metrics:
  duration: ~5 minutes
  completed: 2026-01-24
---

# Phase 33 Plan 01: Analytics Service Layer Summary

Backend analytics service layer with aggregation functions for member overview, engagement metrics, benchmark statistics, resource analytics, and churn prediction scoring.

## One-liner

Analytics service layer with PostgreSQL aggregations for member counts, engagement trends, benchmark stats, resource downloads, cohort retention, and multi-factor churn risk scoring.

## Completed Tasks

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create Analytics Types | 4bf4e61 | src/analytics/types.ts |
| 2 | Create Member and Engagement Analytics | 5bf32a9 | src/analytics/member-analytics.ts, src/analytics/engagement-analytics.ts |
| 3 | Create Benchmark, Resource, Churn Analytics | c91286d | src/analytics/benchmark-analytics.ts, src/analytics/resource-analytics.ts, src/analytics/churn-prediction.ts |

## What Was Built

### Type Definitions (types.ts)
- **MemberOverview**: Total/active/inactive/new member counts + MRR
- **DailyEngagement, EngagementTrend, EngagementComparison**: Time-series engagement data
- **BenchmarkStats, CategoryStats, BenchmarkTrend**: Benchmark submission analytics
- **BenchmarkInsight, BenchmarkInsightsResult**: JSONB percentile insights with segment filters
- **ResourceStats, PopularResource, TrendingResource**: Resource download analytics
- **ChurnRiskScore, ChurnRiskFactor**: Multi-factor churn prediction
- **CohortRow**: Retention analysis with percentages
- **DateRange, SegmentFilters**: Common query parameters

### Member Analytics (member-analytics.ts)
- `getMemberOverview()`: Returns total, active (30-day), inactive, new members, and MRR estimate
- `getCohortRetention()`: Raw SQL cohort analysis with 6-month retention tracking

### Engagement Analytics (engagement-analytics.ts)
- `getEngagementTrend(range)`: Daily breakdown of benchmarks, downloads, discord activity
- `getEngagementComparison(current, previous)`: Period-over-period change calculations

### Benchmark Analytics (benchmark-analytics.ts)
- `getBenchmarkStats()`: Submission counts by category (total, valid, flagged, unique members)
- `getBenchmarkTrends(range)`: Daily submission counts over time by category
- `getBenchmarkInsights(filters)`: JSONB percentile aggregation (median, p25, p75, avg) with segment filtering

### Resource Analytics (resource-analytics.ts)
- `getResourceStats(range?)`: Total resources, downloads, unique downloaders
- `getPopularResources(limit)`: Top resources by download count
- `getTrendingResources(limit)`: Growth-based trending (7-day vs previous 7-day comparison)

### Churn Prediction (churn-prediction.ts)
- `calculateChurnRisk(memberId)`: Multi-factor scoring algorithm:
  - Inactivity duration (0-40 points): >30 days = 40, >14 days = 20, >7 days = 10
  - Declining engagement (0-30 points): 50%+ decline = 30, 25%+ decline = 15
  - Payment issues (0-30 points): PAST_DUE = 30, payment failure = 15
- `getAtRiskMembers(minScore, limit)`: Batch retrieval of at-risk members sorted by score

## Key Patterns Used

1. **Raw SQL for Aggregations**: PostgreSQL DATE_TRUNC, FILTER, percentile_cont() for efficient DB-level computation
2. **JSONB Path Queries**: Segment filtering via data->>'field' syntax
3. **Multi-Factor Scoring**: Additive point system with capped maximum (100)
4. **Batch Processing**: getAtRiskMembers processes in batches to avoid memory issues

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TrendingResource type mismatch**
- **Found during:** Task 3 verification
- **Issue:** Prisma ResourceType enum not assignable to string type in TrendingResource
- **Fix:** Cast resource.type as string explicitly
- **Files modified:** src/analytics/resource-analytics.ts
- **Commit:** Included in c91286d (amended)

## Verification Results

- [x] All files exist in src/analytics/ directory
- [x] npx tsc --noEmit passes without errors
- [x] All types exported from types.ts
- [x] All service functions exported from respective files
- [x] Import paths use .js extension per ESM convention

## Success Criteria Met

- [x] src/analytics/types.ts exists with all analytics interfaces including BenchmarkInsight types
- [x] src/analytics/member-analytics.ts exports getMemberOverview, getCohortRetention
- [x] src/analytics/engagement-analytics.ts exports getEngagementTrend, getEngagementComparison
- [x] src/analytics/benchmark-analytics.ts exports getBenchmarkStats, getBenchmarkTrends, getBenchmarkInsights
- [x] src/analytics/resource-analytics.ts exports getResourceStats, getPopularResources, getTrendingResources
- [x] src/analytics/churn-prediction.ts exports calculateChurnRisk, getAtRiskMembers
- [x] getBenchmarkInsights implements JSONB percentile aggregation for ANALYTICS-05
- [x] TypeScript compiles without errors

## Next Phase Readiness

Ready for Plan 33-02 (Analytics API Endpoints) which will:
- Create admin routes at `/api/admin/analytics/*`
- Wire up all service functions to HTTP endpoints
- Add date range parsing and segment filter handling
- Include CSV/JSON export functionality
