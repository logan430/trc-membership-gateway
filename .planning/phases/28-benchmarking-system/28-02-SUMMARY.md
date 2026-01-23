# Phase 28 Plan 02: Benchmark Service Layer Summary

**Completed:** 2026-01-23
**Duration:** ~5 minutes
**Status:** Complete

## One-liner

Benchmark service with submit/query/aggregates functions using PostgreSQL percentile_cont() and k-anonymity filtering at threshold 5.

## What Was Built

### Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `src/benchmarks/service.ts` | Benchmark business logic layer | 424 |

### Key Exports

**Functions:**
- `submitBenchmark(memberId, category, rawData)` - Validates, detects outliers, upserts, awards points
- `getMySubmissions(memberId)` - Returns member's benchmark submissions
- `getAggregates(category, memberId?, filters?)` - Calculates median/percentiles with k-anonymity
- `detectOutliers(category, data)` - Flags values >3 sigma from median

**Types:**
- `SubmitResult` - Submission result with outlier fields and points awarded
- `AggregateResult` - Full aggregate data with available/insufficient fields
- `AggregateField` - Single field stats (median, p25, p75, min, max, count, yourValue)
- `InsufficientField` - Field with count < k-anonymity threshold
- `SegmentFilters` - Cross-category filtering by companySize/industry

### Implementation Details

**Outlier Detection:**
- Uses 3-sigma rule (z-score > 3 = outlier)
- Only flags outliers when field has 5+ existing submissions
- Sets `isValid = false` on submission if outliers detected

**Aggregate Calculation:**
- Uses PostgreSQL `percentile_cont()` for median, p25, p75
- Uses `min()` and `max()` for range
- Uses `stddev()` for outlier detection
- JSONB field access via `data->>'fieldName'` cast to numeric

**K-Anonymity Protection:**
- Fields with < 5 submissions moved to `insufficient` array
- Only fields with 5+ submissions appear in `available` array
- Prevents individual identification from aggregate data

**Segment Filtering:**
- Filters by BUSINESS category submission data
- `companySize` matches `annual_revenue_band`
- `industry` matches `agency_type`
- Uses subquery to find memberIds with matching BUSINESS submissions
- K-anonymity re-validated after filtering

**Points Integration:**
- Calls `awardBenchmarkPoints()` after successful submission
- Points system handles idempotency (one award per category ever)
- Returns `pointsAwarded` in result for UI feedback

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `43525fa` | feat | Create benchmark service with submit and query functions |

## Verification Results

1. TypeScript compilation: PASSED
2. Exports correct: PASSED
   - submitBenchmark, getMySubmissions, getAggregates, detectOutliers all exported
3. Zod schemas imported: PASSED (line 10)
4. awardBenchmarkPoints called: PASSED (line 208)
5. K_ANONYMITY_THRESHOLD used: PASSED (lines 125, 379, 393, 397)
6. Raw queries parameterized: PASSED (using $queryRaw with Prisma.raw for field names)

## Deviations from Plan

**Task 2 incorporated into Task 1:**
- Plan specified Task 2 as "Add segment filtering support to aggregates"
- Since service was created from scratch, segment filtering was implemented directly in Task 1
- No separate commit needed for Task 2 as functionality was included

## Dependencies

**Requires:**
- Phase 26 (BenchmarkSubmission model in Prisma schema)
- Plan 28-01 (Zod schemas, K_ANONYMITY_THRESHOLD constant)
- Plan 27-02 (awardBenchmarkPoints function)

**Provides:**
- Complete benchmark service layer for API routes
- Business logic for submit, query, and aggregate operations
- Outlier detection and k-anonymity filtering

**Used by:**
- Plan 28-03: Benchmark API (will import service functions)

## Technical Notes

**PostgreSQL Aggregate Functions:**
```sql
percentile_cont(0.5) WITHIN GROUP (ORDER BY value) -- median
percentile_cont(0.25) WITHIN GROUP (ORDER BY value) -- 25th percentile
percentile_cont(0.75) WITHIN GROUP (ORDER BY value) -- 75th percentile
stddev(value) -- standard deviation for outlier detection
```

**JSONB Field Access:**
```sql
data->>'field_name'  -- extract text value
(data->>'field_name')::numeric  -- cast to number
```

**Prisma Raw Query Pattern:**
- Use `Prisma.raw()` for field names (validated against schema keys)
- Use `$queryRaw` for parameterized queries where possible
- Use `$queryRawUnsafe` when building dynamic SQL with sanitized inputs

**Input Sanitization:**
- Segment filter values sanitized via regex to prevent SQL injection
- Only alphanumeric, spaces, hyphens, and specific characters allowed
