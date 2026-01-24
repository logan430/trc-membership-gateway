/**
 * Engagement analytics service
 * ANALYTICS-02: Engagement metrics with time-series
 * ANALYTICS-09: Month-over-month comparison
 */

import { prisma } from '../lib/prisma.js';
import type {
  EngagementTrend,
  EngagementComparison,
  DailyEngagement,
  DateRange,
} from './types.js';

// =============================================================================
// ANALYTICS-02: Engagement Trend
// =============================================================================

/**
 * Get daily engagement breakdown for a date range
 * Aggregates point transactions by action type per day
 */
export async function getEngagementTrend(
  range: DateRange
): Promise<EngagementTrend> {
  const rows = await prisma.$queryRaw<
    Array<{
      date: Date;
      benchmarks: bigint;
      downloads: bigint;
      discord: bigint;
    }>
  >`
    SELECT
      DATE_TRUNC('day', "createdAt") as date,
      COUNT(*) FILTER (WHERE action = 'benchmark_submission')::bigint as benchmarks,
      COUNT(*) FILTER (WHERE action = 'resource_download')::bigint as downloads,
      COUNT(*) FILTER (WHERE action = 'discord_activity')::bigint as discord
    FROM "PointTransaction"
    WHERE "createdAt" >= ${range.startDate}
      AND "createdAt" < ${range.endDate}
      AND points > 0
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY date
  `;

  const data: DailyEngagement[] = rows.map((row) => ({
    date: row.date.toISOString().split('T')[0],
    benchmarks: Number(row.benchmarks),
    downloads: Number(row.downloads),
    discordActivity: Number(row.discord),
    total:
      Number(row.benchmarks) + Number(row.downloads) + Number(row.discord),
  }));

  return {
    data,
    periodStart: range.startDate.toISOString(),
    periodEnd: range.endDate.toISOString(),
  };
}

// =============================================================================
// ANALYTICS-09: Engagement Comparison
// =============================================================================

/**
 * Compare engagement between two date ranges
 * Returns both periods and percentage change calculations
 */
export async function getEngagementComparison(
  currentRange: DateRange,
  previousRange: DateRange
): Promise<EngagementComparison> {
  const [current, previous] = await Promise.all([
    getEngagementTrend(currentRange),
    getEngagementTrend(previousRange),
  ]);

  // Sum totals for change percentage calculation
  const sumTrend = (trend: EngagementTrend) => {
    return trend.data.reduce(
      (acc, d) => ({
        benchmarks: acc.benchmarks + d.benchmarks,
        downloads: acc.downloads + d.downloads,
        discord: acc.discord + d.discordActivity,
        total: acc.total + d.total,
      }),
      { benchmarks: 0, downloads: 0, discord: 0, total: 0 }
    );
  };

  const currentSum = sumTrend(current);
  const previousSum = sumTrend(previous);

  // Calculate percentage change, handling division by zero
  const calcChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return {
    current,
    previous,
    change: {
      benchmarks: calcChange(currentSum.benchmarks, previousSum.benchmarks),
      downloads: calcChange(currentSum.downloads, previousSum.downloads),
      discordActivity: calcChange(currentSum.discord, previousSum.discord),
      total: calcChange(currentSum.total, previousSum.total),
    },
  };
}
