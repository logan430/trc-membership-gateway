# Phase 28: Benchmarking System - Research

**Researched:** 2026-01-22
**Domain:** Anonymous peer benchmarking with JSONB storage, k-anonymity, and outlier detection
**Confidence:** HIGH

## Summary

This phase builds the backend API for the benchmarking system where members submit anonymous data across 4 categories (compensation, infrastructure, business, operational) and view peer comparisons. The BenchmarkSubmission table with JSONB data column and GIN index already exists from Phase 26. This phase adds validation, submission/update endpoints, aggregate calculation APIs, and admin moderation for outlier flagged submissions.

The approach follows the existing codebase patterns: Zod for request validation, Prisma for database operations, Express Router for API endpoints, and the established points service for awarding +50 points on submission. The key technical challenges are k-anonymity enforcement (hide results until 5+ submissions), JSONB aggregate calculations (median, percentiles via PostgreSQL functions), and outlier detection (3 sigma from median).

**Primary recommendation:** Build a validation schema per category using Zod, calculate aggregates in PostgreSQL using `percentile_cont()` for efficiency, implement k-anonymity at query time (not storage), and use the existing audit logging pattern for admin moderation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 3.x | Request validation + schema definition | Already used throughout codebase for all API validation |
| Prisma | 6.x | Database access and JSONB queries | Established ORM with JSONB path query support |
| PostgreSQL | 13+ | Aggregates and percentile calculations | Built-in `percentile_cont()`, `stddev()` functions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Express Router | 5.x | API endpoint routing | All routes follow existing patterns |
| pino | 9.x | Structured logging | Consistent with codebase |

### Not Needed
| Alternative | Why Not Using |
|------------|---------------|
| pg_jsonschema extension | Zod validation at API layer sufficient; no need for DB-level JSON Schema |
| Additional statistics libraries | PostgreSQL built-in functions cover median, percentiles, stddev |

**Installation:**
No new packages needed. All dependencies exist in current project.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── benchmarks/
│   ├── schemas.ts       # Zod validation schemas per category
│   ├── service.ts       # Business logic (submit, update, aggregate)
│   └── types.ts         # TypeScript types for benchmarks
├── routes/
│   ├── benchmarks.ts    # Member-facing API endpoints
│   └── admin/
│       └── benchmarks.ts # Admin moderation endpoints
```

### Pattern 1: Zod Schema per Category
**What:** Define validation schemas for each benchmark category's JSONB data structure
**When to use:** Always - validates incoming data before database write
**Example:**
```typescript
// Source: Existing codebase pattern (src/routes/admin/members.ts)
import { z } from 'zod';

// Each category has specific fields with optional values
export const compensationSchema = z.object({
  gtm_engineer_us: z.number().optional(),
  gtm_engineer_offshore: z.number().optional(),
  sdr_bdr_us_salary: z.number().optional(),
  sdr_bdr_us_commission: z.string().optional(),
  sdr_bdr_offshore_salary: z.number().optional(),
  account_manager: z.number().optional(),
  virtual_assistant_hourly: z.number().optional(),
  copywriter_hourly: z.number().optional(),
});

export const benchmarkDataSchemas = {
  COMPENSATION: compensationSchema,
  INFRASTRUCTURE: infrastructureSchema,
  BUSINESS: businessSchema,
  OPERATIONAL: operationalSchema,
} as const;
```

### Pattern 2: PostgreSQL Aggregates via Raw Query
**What:** Use Prisma.$queryRaw for percentile and stddev calculations
**When to use:** Aggregate endpoints that need median, percentiles, or outlier detection
**Example:**
```typescript
// Source: PostgreSQL official docs - percentile_cont function
const aggregates = await prisma.$queryRaw<AggregateResult[]>`
  SELECT
    category,
    (data->>'field_name')::numeric as field_value,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY (data->>'field_name')::numeric) as median,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY (data->>'field_name')::numeric) as p25,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY (data->>'field_name')::numeric) as p75,
    avg((data->>'field_name')::numeric) as average,
    stddev((data->>'field_name')::numeric) as stddev,
    count(*) as count
  FROM "BenchmarkSubmission"
  WHERE category = ${category}
    AND "isValid" = true
    AND data->>'field_name' IS NOT NULL
  GROUP BY category
`;
```

### Pattern 3: K-Anonymity at Query Time
**What:** Filter aggregate results to only return metrics with 5+ submissions
**When to use:** All aggregate/comparison endpoints
**Example:**
```typescript
// K-anonymity threshold
const K_ANONYMITY_THRESHOLD = 5;

// In aggregate results, filter out fields with insufficient data
const safeResults = aggregateResults.filter(r => r.count >= K_ANONYMITY_THRESHOLD);

// For API response, indicate which fields are hidden
const response = {
  available: safeResults,
  insufficient: aggregateResults
    .filter(r => r.count < K_ANONYMITY_THRESHOLD)
    .map(r => ({
      field: r.field,
      currentCount: r.count,
      needMore: K_ANONYMITY_THRESHOLD - r.count,
    })),
};
```

### Pattern 4: Outlier Detection with 3-Sigma Rule
**What:** Flag submissions where any numeric field is > 3 standard deviations from median
**When to use:** On submission/update before persisting
**Example:**
```typescript
// Source: PostgreSQL stddev function + 3-sigma rule
async function detectOutliers(
  category: BenchmarkCategory,
  data: Record<string, unknown>
): Promise<string[]> {
  const outlierFields: string[] = [];

  for (const [field, value] of Object.entries(data)) {
    if (typeof value !== 'number') continue;

    const stats = await prisma.$queryRaw<{ median: number; stddev: number }[]>`
      SELECT
        percentile_cont(0.5) WITHIN GROUP (ORDER BY (data->>${field})::numeric) as median,
        stddev((data->>${field})::numeric) as stddev
      FROM "BenchmarkSubmission"
      WHERE category = ${category}
        AND "isValid" = true
        AND data->>${field} IS NOT NULL
    `;

    if (stats[0]?.stddev && stats[0].stddev > 0) {
      const zScore = Math.abs((value - stats[0].median) / stats[0].stddev);
      if (zScore > 3) {
        outlierFields.push(field);
      }
    }
  }

  return outlierFields;
}
```

### Pattern 5: Upsert for Updates (Quarterly Refresh)
**What:** Use Prisma upsert with unique constraint for member+category
**When to use:** Both initial submission and quarterly updates
**Example:**
```typescript
// Source: Existing Prisma schema has @@unique([memberId, category])
const submission = await prisma.benchmarkSubmission.upsert({
  where: {
    memberId_category: {
      memberId,
      category,
    },
  },
  create: {
    memberId,
    category,
    data,
    isValid: outlierFields.length === 0, // Auto-flag if outliers detected
  },
  update: {
    data,
    isValid: outlierFields.length === 0,
    updatedAt: new Date(),
  },
});
```

### Anti-Patterns to Avoid
- **Client-side aggregate calculation:** Calculate aggregates in PostgreSQL, not by fetching all submissions to JavaScript
- **Storing k-anonymity status:** Query at runtime; membership changes affect counts
- **Hardcoded field lists in queries:** Use dynamic field iteration from schema definitions
- **Blocking on outlier detection:** Run detection asynchronously if performance becomes an issue

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Median calculation | JavaScript array sort + midpoint | PostgreSQL `percentile_cont(0.5)` | Handles large datasets efficiently, no data transfer |
| Percentile calculation | Manual percentile formula | PostgreSQL `percentile_cont(n)` | Continuous interpolation built-in |
| Standard deviation | Manual calculation | PostgreSQL `stddev()` | Handles NULL values, edge cases |
| JSONB field extraction | Manual JSON parsing | Prisma JSONB path queries | Type-safe, index-aware |
| Points awarding | Custom logic | `awardBenchmarkPoints()` from Phase 27 | Already built with idempotency |
| Audit logging | Custom logging | `logAuditEvent()` from lib/audit.ts | Established pattern with entity tracking |

**Key insight:** PostgreSQL has excellent statistical functions built-in. Using `percentile_cont()`, `stddev()`, and JSONB operators at the database layer is far more efficient than pulling data to the application layer.

## Common Pitfalls

### Pitfall 1: K-Anonymity Per Field vs Per Category
**What goes wrong:** Implementing k-anonymity only at category level (5+ total submissions) but showing individual field aggregates that may have fewer values
**Why it happens:** Confusion between "category has 5 submissions" vs "this specific field has 5 values"
**How to avoid:** Check count per field, not per category. Some users may skip fields.
**Warning signs:** A field shows aggregate but only 2 people filled it in

### Pitfall 2: Segment Filtering Breaking K-Anonymity
**What goes wrong:** User filters by small segment (e.g., "company size: 1-10") and sees data from < 5 submissions
**Why it happens:** Segment combinations reduce effective sample size
**How to avoid:** Re-check k-anonymity threshold after applying segment filters; hide results if filtered count < 5
**Warning signs:** Very specific segment combinations return data

### Pitfall 3: Outlier Detection on Sparse Data
**What goes wrong:** Flagging submissions as outliers when there's insufficient data for meaningful stddev
**Why it happens:** With < 5 submissions, stddev is unreliable
**How to avoid:** Only run outlier detection when field has K_ANONYMITY_THRESHOLD+ submissions
**Warning signs:** First few submissions all flagged as outliers

### Pitfall 4: Points Awarded Multiple Times
**What goes wrong:** Member receives +50 points on every update, not just first submission
**Why it happens:** Calling awardBenchmarkPoints on both create and update paths
**How to avoid:** awardBenchmarkPoints already has idempotency per category - call it on every submission and it handles deduplication
**Warning signs:** Points ledger shows multiple benchmark_submission entries for same category

### Pitfall 5: Returning Raw Submission Data in Aggregates
**What goes wrong:** API accidentally returns individual submission data instead of only aggregates
**Why it happens:** Debug logging left in, or wrong query result mapping
**How to avoid:** API responses should only contain: median, percentiles, count, user's own value (if they submitted)
**Warning signs:** Response includes arrays of individual values or user IDs

### Pitfall 6: JSONB Path Injection
**What goes wrong:** User-provided field names used directly in raw SQL queries
**Why it happens:** Dynamic field aggregation with unsanitized input
**How to avoid:** Validate field names against known schema; use parameterized queries where possible
**Warning signs:** Unusual characters in field parameter causing SQL errors

## Code Examples

Verified patterns from official sources and existing codebase:

### Submit Benchmark Endpoint
```typescript
// Source: Existing route patterns (src/routes/points.ts)
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';
import { awardBenchmarkPoints } from '../points/service.js';
import { benchmarkDataSchemas, BenchmarkCategory } from '../benchmarks/schemas.js';

const submitSchema = z.object({
  category: z.enum(['COMPENSATION', 'INFRASTRUCTURE', 'BUSINESS', 'OPERATIONAL']),
  data: z.record(z.unknown()), // Validated per-category below
});

benchmarksRouter.post('/submit', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { category, data } = submitSchema.parse(req.body);
    const memberId = req.memberId!;

    // Validate data against category-specific schema
    const categorySchema = benchmarkDataSchemas[category];
    const validatedData = categorySchema.parse(data);

    // Check for outliers (only if sufficient data exists)
    const outlierFields = await detectOutliers(category, validatedData);

    // Upsert submission (handles both create and update)
    const submission = await prisma.benchmarkSubmission.upsert({
      where: { memberId_category: { memberId, category } },
      create: {
        memberId,
        category,
        data: validatedData,
        isValid: outlierFields.length === 0,
      },
      update: {
        data: validatedData,
        isValid: outlierFields.length === 0,
      },
    });

    // Award points (idempotent - only awards once per category)
    const pointsResult = await awardBenchmarkPoints(memberId, category);

    res.json({
      submission: {
        id: submission.id,
        category: submission.category,
        submittedAt: submission.submittedAt,
        isValid: submission.isValid,
      },
      outlierFields: outlierFields.length > 0 ? outlierFields : undefined,
      pointsAwarded: pointsResult.awarded ? pointsResult.points : 0,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    throw error;
  }
});
```

### Get Aggregates with K-Anonymity
```typescript
// Source: PostgreSQL percentile_cont documentation
const K_ANONYMITY_THRESHOLD = 5;

benchmarksRouter.get('/aggregates/:category', requireAuth, async (req: AuthenticatedRequest, res) => {
  const category = z.enum(['COMPENSATION', 'INFRASTRUCTURE', 'BUSINESS', 'OPERATIONAL'])
    .parse(req.params.category);
  const memberId = req.memberId!;

  // Get user's own submission for comparison
  const userSubmission = await prisma.benchmarkSubmission.findUnique({
    where: { memberId_category: { memberId, category } },
  });

  // Get category field list from schema
  const fields = Object.keys(benchmarkDataSchemas[category].shape);

  // Calculate aggregates for each field
  const aggregates = await Promise.all(fields.map(async (field) => {
    const result = await prisma.$queryRaw<{
      count: bigint;
      median: number | null;
      p25: number | null;
      p75: number | null;
      min: number | null;
      max: number | null;
    }[]>`
      SELECT
        count(*)::bigint as count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY (data->>${field})::numeric) as median,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY (data->>${field})::numeric) as p25,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY (data->>${field})::numeric) as p75,
        min((data->>${field})::numeric) as min,
        max((data->>${field})::numeric) as max
      FROM "BenchmarkSubmission"
      WHERE category = ${category}::"BenchmarkCategory"
        AND "isValid" = true
        AND data->>${field} IS NOT NULL
    `;

    return {
      field,
      ...result[0],
      count: Number(result[0]?.count || 0),
    };
  }));

  // Apply k-anonymity filter
  const available = aggregates
    .filter(a => a.count >= K_ANONYMITY_THRESHOLD)
    .map(a => ({
      field: a.field,
      median: a.median,
      p25: a.p25,
      p75: a.p75,
      min: a.min,
      max: a.max,
      count: a.count,
      yourValue: userSubmission?.data?.[a.field] as number | undefined,
    }));

  const insufficient = aggregates
    .filter(a => a.count < K_ANONYMITY_THRESHOLD)
    .map(a => ({
      field: a.field,
      currentCount: a.count,
      needMore: K_ANONYMITY_THRESHOLD - a.count,
    }));

  res.json({
    category,
    available,
    insufficient,
    totalSubmissions: await prisma.benchmarkSubmission.count({
      where: { category, isValid: true },
    }),
  });
});
```

### Admin Review Flagged Submissions
```typescript
// Source: Existing admin patterns (src/routes/admin/members.ts)
adminBenchmarksRouter.get('/flagged', requireAdmin, async (req, res) => {
  const query = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    category: z.enum(['COMPENSATION', 'INFRASTRUCTURE', 'BUSINESS', 'OPERATIONAL']).optional(),
  }).parse(req.query);

  const submissions = await prisma.benchmarkSubmission.findMany({
    take: query.limit + 1,
    skip: query.cursor ? 1 : 0,
    cursor: query.cursor ? { id: query.cursor } : undefined,
    where: {
      isValid: false,
      ...(query.category ? { category: query.category } : {}),
    },
    include: {
      member: {
        select: { id: true, email: true, discordUsername: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const hasMore = submissions.length > query.limit;
  const results = hasMore ? submissions.slice(0, query.limit) : submissions;

  res.json({
    submissions: results,
    nextCursor: hasMore ? results[results.length - 1].id : null,
    hasMore,
  });
});

// Approve/Reject flagged submission
adminBenchmarksRouter.post('/:id/review', requireAdmin, async (req, res) => {
  const { id } = z.object({ id: z.string() }).parse(req.params);
  const { action } = z.object({ action: z.enum(['approve', 'reject']) }).parse(req.body);
  const admin = res.locals.admin!;

  const submission = await prisma.benchmarkSubmission.findUnique({
    where: { id },
  });

  if (!submission) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }

  // Update isValid based on action
  await prisma.benchmarkSubmission.update({
    where: { id },
    data: { isValid: action === 'approve' },
  });

  // Log audit event
  await logAuditEvent({
    action: 'BENCHMARK_REVIEWED',
    entityType: 'Member',
    entityId: submission.memberId,
    details: {
      submissionId: id,
      category: submission.category,
      action,
      reviewedBy: admin.id,
    },
    performedBy: admin.id,
  });

  res.json({ success: true });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JavaScript median calculation | PostgreSQL `percentile_cont()` | PostgreSQL 9.4+ (2014) | 10x+ faster on large datasets |
| JSON text storage | JSONB with GIN indexes | PostgreSQL 9.4+ (2014) | Index-accelerated queries |
| Application-level k-anonymity | Query-time filtering | Best practice | Dynamic, no stale flags |

**Deprecated/outdated:**
- JSON type (not JSONB): Use JSONB for indexing and query operators
- `percentile_disc()` for median: Use `percentile_cont()` for continuous interpolation

## Open Questions

Things that couldn't be fully resolved:

1. **Segment filter combinations**
   - What we know: Users can filter by company size, industry, role per BENCH-09
   - What's unclear: Where does member store company size/industry/role? Not in current Member model.
   - Recommendation: Either add fields to Member model or include in benchmark submission metadata. Research suggests adding to Member profile makes more sense for cross-category filtering.

2. **Quarterly refresh enforcement**
   - What we know: BENCH-15 says members can update quarterly
   - What's unclear: Should we enforce 90-day minimum between updates, or just encourage?
   - Recommendation: Allow updates anytime but only award points once ever. Admin can see update history via updatedAt timestamp.

3. **Outlier notification**
   - What we know: Outliers are flagged (isValid=false) for admin review
   - What's unclear: Should member be notified their submission was flagged?
   - Recommendation: Do not notify. They still see their own data vs aggregates. Admin approves/rejects silently. Rejected just excludes from aggregates.

## Sources

### Primary (HIGH confidence)
- PostgreSQL 18 Documentation - Aggregate Functions: `percentile_cont`, `stddev()`, `jsonb` operators
- Existing codebase patterns: src/routes/points.ts, src/points/service.ts, src/routes/admin/members.ts
- Prisma schema: BenchmarkSubmission model with JSONB data column and GIN index
- Chris's reference app: benchmark-submit-form.tsx field definitions per category

### Secondary (MEDIUM confidence)
- [PostgreSQL: Calculating Percentile](https://leafo.net/guides/postgresql-calculating-percentile.html) - percentile_cont/percentile_disc patterns
- [Tiger Data: Standard Deviation in PostgreSQL](https://www.tigerdata.com/learn/how-to-compute-standard-deviation-postgresql) - stddev() usage
- [Sisense: Outlier Detection in SQL](https://www.sisense.com/blog/outlier-detection-in-sql/) - 3-sigma rule implementation
- [K-Anonymity Wikipedia](https://en.wikipedia.org/wiki/K-anonymity) - Privacy model background

### Tertiary (LOW confidence)
- WebSearch results for k-anonymity minimum sample sizes: Industry standard is k=5 for basic protection, higher for sensitive data. Our k=5 aligns with BENCH-06 requirement.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already in codebase
- Architecture: HIGH - Follows established patterns from Phase 27
- JSONB aggregates: HIGH - PostgreSQL built-in functions well-documented
- K-anonymity: HIGH - Simple count-based filtering per BENCH-06
- Outlier detection: MEDIUM - 3-sigma rule is standard but threshold (3) may need tuning
- Segment filtering: MEDIUM - Requires additional Member fields not yet defined

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (30 days - stable domain)

---

## Key Decisions for Planning

Based on research, the planner should make these decisions:

1. **Schema validation approach:** Zod schemas per category (not pg_jsonschema extension)
2. **Aggregate calculation:** PostgreSQL `percentile_cont()` and `stddev()` via raw queries
3. **K-anonymity enforcement:** Query-time filtering, threshold = 5
4. **Points integration:** Call existing `awardBenchmarkPoints()` - handles idempotency
5. **Update mechanism:** Prisma upsert with existing unique constraint
6. **Admin moderation:** isValid flag toggle with audit logging
7. **Outlier threshold:** 3 standard deviations from median (configurable if needed)

## API Endpoints Summary

**Member-facing (src/routes/benchmarks.ts):**
- `POST /api/benchmarks/submit` - Submit/update benchmark data
- `GET /api/benchmarks/my-submissions` - Get user's own submissions
- `GET /api/benchmarks/aggregates/:category` - Get aggregates with k-anonymity

**Admin-facing (src/routes/admin/benchmarks.ts):**
- `GET /api/admin/benchmarks/flagged` - List flagged submissions
- `POST /api/admin/benchmarks/:id/review` - Approve/reject flagged submission
- `GET /api/admin/benchmarks/stats` - Submission counts per category
