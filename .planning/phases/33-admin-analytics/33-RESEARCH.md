# Phase 33: Admin Analytics Dashboard - Research

**Researched:** 2026-01-24
**Domain:** Admin analytics, data visualization, real-time dashboards
**Confidence:** HIGH

## Summary

Admin Analytics Dashboard for Phase 33 builds on the existing v1.0 admin infrastructure (EJS templates with vanilla JS) and v2.0 member dashboard (Next.js with React Query). The phase requires comprehensive analytics covering member overview, engagement metrics, benchmark insights, resource analytics, cohort retention, churn prediction, and data export.

Key architectural decision: Build as a new dedicated React admin page at `/admin/analytics` rather than integrating into existing EJS admin pages. This leverages the established Next.js frontend infrastructure (Recharts, React Query, Tailwind v4) while keeping the v1.0 admin system intact for operational tasks. The admin analytics page uses the same admin authentication (Bearer token from localStorage) but renders React components.

**Primary recommendation:** Create `/admin/analytics` as a standalone React page with tabbed sections (Overview, Members, Engagement, Benchmarks, Resources) using existing Recharts library and React Query polling for real-time updates.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Recharts | ^2.15.0 | Line charts, bar charts, heatmaps | Already in project from Phase 32, D3-based React components |
| React Query | ^5.90.20 | Data fetching with refetchInterval | Already in project, supports polling for real-time updates |
| Next.js | ^15.1.0 | Page routing, SSR where needed | Already in project infrastructure |
| Tailwind CSS | ^4.0.0 | Styling with medieval theme | Already configured with project theme |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| json2csv | ^6.1.3 | JSON to CSV conversion | Export functionality (ANALYTICS-08) |
| lucide-react | ^0.469.0 | Icons for UI | Already in project for member dashboard |
| date-fns | (check if installed) | Date range calculations | Time period comparisons (ANALYTICS-09) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts for heatmaps | Nivo | Nivo has better heatmap support but adds bundle size; Recharts can do basic heatmaps |
| Polling via refetchInterval | WebSockets | WebSockets more efficient but adds complexity; polling sufficient for admin analytics |
| Custom charts | MUI X Charts | MUI X better heatmaps but requires MUI dependency; Recharts adequate |

**Installation:**
```bash
# In project root (Express backend)
npm install json2csv

# date-fns likely needed for period calculations - verify if installed
npm install date-fns
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── analytics/
│   ├── types.ts                    # Analytics types, interfaces
│   ├── queries.ts                  # Raw SQL for aggregates
│   ├── member-analytics.ts         # Member overview, cohorts
│   ├── engagement-analytics.ts     # Engagement metrics, trends
│   ├── benchmark-analytics.ts      # Benchmark aggregates by segment
│   ├── resource-analytics.ts       # Resource download analytics
│   ├── churn-prediction.ts         # At-risk scoring algorithm
│   └── export.ts                   # CSV/JSON export functions
├── routes/admin/
│   └── analytics.ts                # Admin analytics API endpoints
└── jobs/
    └── churn-digest.ts             # Weekly churn digest email job

dashboard/src/
├── app/admin/
│   └── analytics/
│       └── page.tsx                # Admin analytics dashboard page
├── components/admin/
│   ├── KpiCard.tsx                 # Clickable KPI summary card
│   ├── TimeSeriesChart.tsx         # Line chart with period selector
│   ├── ComparisonBarChart.tsx      # Side-by-side bar comparison
│   ├── RetentionHeatmap.tsx        # Cohort retention heatmap
│   ├── AtRiskMemberList.tsx        # Churn prediction alerts
│   ├── DateRangePicker.tsx         # Custom date range selector
│   └── SegmentFilters.tsx          # Segment filter controls
├── hooks/
│   └── useAnalytics.ts             # React Query hooks for analytics
└── lib/
    └── admin-api.ts                # Admin analytics API client
```

### Pattern 1: Admin Authentication in React Pages

**What:** Admin React pages use the same Bearer token pattern as EJS admin pages
**When to use:** All admin React components
**Example:**
```typescript
// dashboard/src/lib/admin-api.ts
const TOKEN_KEY = 'adminAccessToken';

async function adminFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = '/app/admin/login';
    throw new Error('Not authenticated');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/app/admin/login';
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}
```

### Pattern 2: Real-Time Updates via React Query Polling

**What:** Use refetchInterval for auto-refreshing analytics data (ANALYTICS-10)
**When to use:** Dashboard components that need live updates
**Example:**
```typescript
// Source: TanStack Query documentation
export function useAnalyticsOverview() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'overview'],
    queryFn: () => adminApi.getOverview(),
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // Auto-refresh every minute
    refetchIntervalInBackground: false, // Pause when tab inactive
  });
}
```

### Pattern 3: Time-Series Data with Recharts LineChart

**What:** Line chart for engagement trends over time
**When to use:** Engagement metrics, activity trends
**Example:**
```typescript
// Source: Recharts documentation and existing ComparisonBar.tsx pattern
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TimeSeriesChartProps {
  data: { date: string; value: number; comparePeriod?: number }[];
  label: string;
  showComparison?: boolean;
}

export function TimeSeriesChart({ data, label, showComparison }: TimeSeriesChartProps) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          {showComparison && <Legend />}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--gold)"
            strokeWidth={2}
            dot={false}
            name="Current Period"
          />
          {showComparison && (
            <Line
              type="monotone"
              dataKey="comparePeriod"
              stroke="var(--muted-foreground)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Previous Period"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Pattern 4: PostgreSQL Time-Series Aggregation

**What:** Raw SQL queries for efficient time-series aggregation
**When to use:** Engagement trends, activity by date
**Example:**
```typescript
// Source: Prisma raw query pattern from existing benchmark service
async function getEngagementTrend(startDate: Date, endDate: Date): Promise<DailyEngagement[]> {
  return prisma.$queryRaw<DailyEngagement[]>`
    SELECT
      DATE_TRUNC('day', "createdAt") as date,
      COUNT(*) FILTER (WHERE action = 'benchmark_submission') as benchmarks,
      COUNT(*) FILTER (WHERE action = 'resource_download') as downloads,
      COUNT(*) FILTER (WHERE action = 'discord_activity') as discord
    FROM "PointTransaction"
    WHERE "createdAt" >= ${startDate}
      AND "createdAt" < ${endDate}
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY date
  `;
}
```

### Anti-Patterns to Avoid

- **Fetching all data client-side:** Do aggregations in PostgreSQL, not JavaScript. The database handles millions of records efficiently.
- **Hard-coding date ranges:** Always accept date parameters, default to last 30 days server-side.
- **Polling too frequently:** 60-second intervals sufficient for admin analytics; faster polling wastes resources.
- **Separate queries per KPI card:** Batch related metrics into single API calls to reduce round-trips.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV generation | String concatenation | json2csv library | Handles escaping, headers, special characters |
| Date range handling | Manual date math | date-fns library | Timezone-safe, handles edge cases |
| Time-series charts | Canvas/SVG from scratch | Recharts LineChart | Already in project, responsive, accessible |
| Real-time polling | setInterval + useState | React Query refetchInterval | Handles cache, background pause, error retry |
| Cohort bucketing | Manual date grouping | PostgreSQL DATE_TRUNC | Database-level efficiency, handles timezones |

**Key insight:** Analytics queries are computationally expensive. Always push aggregation to PostgreSQL rather than fetching raw data and processing in JavaScript.

## Common Pitfalls

### Pitfall 1: N+1 Queries in Analytics

**What goes wrong:** Fetching member details one-by-one when building cohort lists
**Why it happens:** Using Prisma include/select in loops instead of batch queries
**How to avoid:** Use raw SQL with JOINs or batch member lookups
**Warning signs:** Slow page loads, database connection exhaustion

### Pitfall 2: Missing Indexes on Analytics Queries

**What goes wrong:** Slow aggregation queries on large tables
**Why it happens:** New query patterns not covered by existing indexes
**How to avoid:** Analyze query plans, add composite indexes for date + action columns
**Warning signs:** Analytics page takes > 2 seconds to load

### Pitfall 3: Churn Scoring False Positives

**What goes wrong:** Active members flagged as at-risk due to vacation, seasonal patterns
**Why it happens:** Single-factor scoring (inactivity only)
**How to avoid:** Multi-factor scoring per CONTEXT.md (inactivity + declining trend + payment issues)
**Warning signs:** High at-risk count with low actual churn

### Pitfall 4: Memory Exhaustion on Large Exports

**What goes wrong:** Server crashes when exporting large datasets to CSV
**Why it happens:** Loading entire result set into memory before streaming
**How to avoid:** Use streaming response with cursor-based pagination
**Warning signs:** 502 errors on export of 10K+ records

### Pitfall 5: Inconsistent Time Zones in Charts

**What goes wrong:** Data points appear on wrong days, comparison charts misaligned
**Why it happens:** Mixing server UTC with client local time
**How to avoid:** Store/query in UTC, format to local only for display
**Warning signs:** Charts show different values than raw data

## Code Examples

Verified patterns from official sources and existing codebase:

### Member Overview Aggregation

```typescript
// Source: Prisma documentation + existing codebase patterns
interface MemberOverview {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  mrr: number; // Monthly recurring revenue
}

async function getMemberOverview(): Promise<MemberOverview> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [total, active, mrr] = await Promise.all([
    // Total members with active subscriptions
    prisma.member.count({
      where: { subscriptionStatus: 'ACTIVE' },
    }),
    // Active = had point-earning activity in last 30 days
    prisma.member.count({
      where: {
        subscriptionStatus: 'ACTIVE',
        lastActiveAt: { gte: thirtyDaysAgo },
      },
    }),
    // MRR calculation would need Stripe API or cached subscription data
    // Placeholder: count active * average price
    calculateMRR(),
  ]);

  return {
    totalMembers: total,
    activeMembers: active,
    inactiveMembers: total - active,
    mrr,
  };
}
```

### Cohort Retention Query

```typescript
// Source: PostgreSQL aggregation patterns
interface CohortRetention {
  cohort: string; // e.g., "2026-01"
  month0: number;
  month1: number;
  month2: number;
  // ... up to month12
}

async function getCohortRetention(): Promise<CohortRetention[]> {
  return prisma.$queryRaw<CohortRetention[]>`
    WITH cohorts AS (
      SELECT
        id,
        DATE_TRUNC('month', "createdAt") as cohort_month
      FROM "Member"
      WHERE "subscriptionStatus" != 'NONE'
    ),
    activity AS (
      SELECT
        "memberId",
        DATE_TRUNC('month', "createdAt") as activity_month
      FROM "PointTransaction"
      WHERE points > 0
      GROUP BY "memberId", DATE_TRUNC('month', "createdAt")
    )
    SELECT
      TO_CHAR(c.cohort_month, 'YYYY-MM') as cohort,
      COUNT(DISTINCT c.id) as month0,
      COUNT(DISTINCT CASE WHEN a.activity_month = c.cohort_month + INTERVAL '1 month' THEN c.id END) as month1,
      COUNT(DISTINCT CASE WHEN a.activity_month = c.cohort_month + INTERVAL '2 months' THEN c.id END) as month2,
      COUNT(DISTINCT CASE WHEN a.activity_month = c.cohort_month + INTERVAL '3 months' THEN c.id END) as month3
    FROM cohorts c
    LEFT JOIN activity a ON c.id = a."memberId"
    GROUP BY c.cohort_month
    ORDER BY c.cohort_month DESC
    LIMIT 12
  `;
}
```

### Churn Risk Scoring

```typescript
// Source: SaaS churn prediction best practices
interface ChurnRiskScore {
  memberId: string;
  score: number; // 0-100, higher = more risk
  factors: string[];
}

async function calculateChurnRisk(memberId: string): Promise<ChurnRiskScore> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: { pointTransactions: { take: 30, orderBy: { createdAt: 'desc' } } },
  });

  if (!member) throw new Error('Member not found');

  let score = 0;
  const factors: string[] = [];

  // Factor 1: Inactivity duration (0-40 points)
  const daysSinceActive = member.lastActiveAt
    ? Math.floor((Date.now() - member.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (daysSinceActive > 30) {
    score += 40;
    factors.push(`Inactive for ${daysSinceActive} days`);
  } else if (daysSinceActive > 14) {
    score += 20;
    factors.push(`Inactive for ${daysSinceActive} days`);
  } else if (daysSinceActive > 7) {
    score += 10;
    factors.push(`Inactive for ${daysSinceActive} days`);
  }

  // Factor 2: Declining engagement trend (0-30 points)
  const recentActivity = member.pointTransactions.filter(
    (t) => t.createdAt > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  ).length;
  const olderActivity = member.pointTransactions.filter(
    (t) =>
      t.createdAt > new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) &&
      t.createdAt <= new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  ).length;

  if (olderActivity > 0 && recentActivity < olderActivity * 0.5) {
    score += 30;
    factors.push('Engagement declined by 50%+');
  } else if (olderActivity > 0 && recentActivity < olderActivity * 0.75) {
    score += 15;
    factors.push('Engagement declining');
  }

  // Factor 3: Payment issues (0-30 points)
  if (member.subscriptionStatus === 'PAST_DUE') {
    score += 30;
    factors.push('Payment past due');
  } else if (member.paymentFailedAt && !member.gracePeriodEndsAt) {
    score += 15;
    factors.push('Recent payment failure');
  }

  return { memberId, score: Math.min(score, 100), factors };
}
```

### CSV Export Endpoint

```typescript
// Source: Express + json2csv patterns
import { Parser } from 'json2csv';
import { Response } from 'express';

async function exportMembersToCsv(res: Response, filters: ExportFilters): Promise<void> {
  const members = await getMembersForExport(filters);

  const fields = [
    { label: 'Email', value: 'email' },
    { label: 'Name', value: 'name' },
    { label: 'Company', value: 'company' },
    { label: 'Total Points', value: 'totalPoints' },
    { label: 'Current Streak', value: 'currentStreak' },
    { label: 'Last Active', value: 'lastActiveAt' },
    { label: 'Subscription Status', value: 'subscriptionStatus' },
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(members);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=members-export.csv');
  res.send(csv);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chart.js | Recharts | 2023+ | Better React integration, smaller bundle |
| Manual polling with setInterval | React Query refetchInterval | 2022+ | Cache management, error handling included |
| Server-side rendering for charts | Client-side with loading states | 2024+ | Better interactivity, cleaner separation |
| REST polling | WebSockets | Emerging | Not necessary for admin analytics use case |

**Deprecated/outdated:**
- recharts v1.x: Use v2.x for React 18+ compatibility
- Create React App: Project uses Next.js, no CRA involved

## Open Questions

Things that couldn't be fully resolved:

1. **MRR Calculation Method**
   - What we know: Stripe stores subscription pricing data
   - What's unclear: Should MRR be calculated from Stripe API on-demand or cached locally?
   - Recommendation: Cache MRR in database, update on subscription webhook events (already have webhook infrastructure)

2. **Heatmap Library Choice**
   - What we know: Recharts has basic heatmap support; Nivo has better heatmap components
   - What's unclear: Is Recharts heatmap sufficient for cohort retention visualization?
   - Recommendation: Try Recharts first (consistent with project); add Nivo only if insufficient

3. **Admin Page Hosting**
   - What we know: Member dashboard is Next.js at /dashboard/*, proxied from Express
   - What's unclear: Should admin analytics be separate Next.js page or integrated into member dashboard app?
   - Recommendation: Add to existing dashboard Next.js app at /admin/analytics, requires admin auth check in middleware

## Sources

### Primary (HIGH confidence)
- Existing codebase: `dashboard/src/components/benchmarks/ComparisonBar.tsx` - Recharts pattern
- Existing codebase: `src/routes/admin/benchmarks.ts` - Admin API pattern with requireAdmin middleware
- Existing codebase: `src/benchmarks/service.ts` - Raw SQL aggregation pattern
- Existing codebase: `dashboard/src/hooks/usePoints.ts` - React Query hook pattern
- Existing codebase: `src/jobs/index.ts` - node-cron job scheduler pattern
- Existing codebase: `src/email/send.ts` - Email sending pattern for weekly digest

### Secondary (MEDIUM confidence)
- [TanStack Query Documentation](https://tanstack.com/query/v4/docs/framework/react/reference/useQuery) - refetchInterval polling
- [Recharts GitHub](https://github.com/recharts/recharts) - Chart component API
- [PostHog Recharts Tutorial](https://posthog.com/tutorials/recharts) - Analytics visualization patterns
- [json2csv npm](https://www.npmjs.com/package/json2csv) - CSV export pattern

### Tertiary (LOW confidence)
- [SaaS Churn Prediction Models](https://www.glencoyne.com/guides/churn-prediction-models-saas) - Scoring algorithm approach (needs validation against actual data)
- [Cohort Analysis Visualization](https://www.glencoyne.com/guides/cohort-analysis-retention-simple) - Heatmap design patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project libraries (Recharts, React Query)
- Architecture: HIGH - Following established patterns from member dashboard
- API patterns: HIGH - Following existing admin API middleware pattern
- Churn prediction: MEDIUM - Algorithm design based on industry patterns, needs tuning
- Heatmap implementation: MEDIUM - Recharts heatmap capability needs verification

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - stable technology stack)
