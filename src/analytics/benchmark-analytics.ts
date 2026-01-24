/**
 * Benchmark analytics service
 * ANALYTICS-03: Benchmark submission rate by category
 * ANALYTICS-05: Industry insights by segment with JSONB aggregation
 */

import { prisma } from '../lib/prisma.js';
import { BenchmarkCategory } from '@prisma/client';
import type {
  BenchmarkStats,
  CategoryStats,
  BenchmarkTrend,
  DateRange,
  SegmentFilters,
  BenchmarkInsightsResult,
  BenchmarkInsight,
} from './types.js';

// =============================================================================
// ANALYTICS-03: Benchmark Statistics
// =============================================================================

/**
 * Get benchmark submission statistics by category
 * Includes counts for total, valid, flagged, and unique members
 */
export async function getBenchmarkStats(): Promise<BenchmarkStats> {
  const categories: BenchmarkCategory[] = [
    'COMPENSATION',
    'INFRASTRUCTURE',
    'BUSINESS',
    'OPERATIONAL',
  ];

  const byCategory = await Promise.all(
    categories.map(async (category) => {
      const [total, valid, flagged, uniqueMembers] = await Promise.all([
        prisma.benchmarkSubmission.count({ where: { category } }),
        prisma.benchmarkSubmission.count({
          where: { category, isValid: true },
        }),
        prisma.benchmarkSubmission.count({
          where: { category, isValid: false },
        }),
        prisma.benchmarkSubmission
          .groupBy({
            by: ['memberId'],
            where: { category },
          })
          .then((g) => g.length),
      ]);
      return {
        category,
        submissionCount: total,
        validCount: valid,
        flaggedCount: flagged,
        uniqueMembers,
      } as CategoryStats;
    })
  );

  // Get total unique members across all categories
  const totalUniqueMembers = await prisma.benchmarkSubmission
    .groupBy({ by: ['memberId'] })
    .then((g) => g.length);

  return {
    byCategory,
    total: {
      submissions: byCategory.reduce((s, c) => s + c.submissionCount, 0),
      validSubmissions: byCategory.reduce((s, c) => s + c.validCount, 0),
      flaggedSubmissions: byCategory.reduce((s, c) => s + c.flaggedCount, 0),
      uniqueMembers: totalUniqueMembers,
    },
  };
}

// =============================================================================
// ANALYTICS-03: Benchmark Trends
// =============================================================================

/**
 * Get benchmark submission trends over time by category
 * Returns daily counts grouped by category
 */
export async function getBenchmarkTrends(
  range: DateRange
): Promise<BenchmarkTrend[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      date: Date;
      category: string;
      count: bigint;
    }>
  >`
    SELECT
      DATE_TRUNC('day', "submittedAt") as date,
      category::text,
      COUNT(*)::bigint as count
    FROM "BenchmarkSubmission"
    WHERE "submittedAt" >= ${range.startDate}
      AND "submittedAt" < ${range.endDate}
    GROUP BY DATE_TRUNC('day', "submittedAt"), category
    ORDER BY date, category
  `;

  return rows.map((row) => ({
    date: row.date.toISOString().split('T')[0],
    category: row.category,
    count: Number(row.count),
  }));
}

// =============================================================================
// ANALYTICS-05: Benchmark Insights
// =============================================================================

/**
 * Get benchmark insights with JSONB percentile aggregation
 * Aggregates BUSINESS category submissions for key revenue metrics
 * filtered by optional segment criteria
 */
export async function getBenchmarkInsights(
  filters: SegmentFilters
): Promise<BenchmarkInsightsResult> {
  // Build WHERE clause for JSONB filtering
  const whereConditions: string[] = [
    "category = 'BUSINESS'",
    '"isValid" = true',
  ];

  // Note: companySize and industry are stored in submission data JSONB
  // We use queryRawUnsafe with carefully sanitized inputs
  if (filters.companySize) {
    // Sanitize: only allow alphanumeric, spaces, hyphens, and common business characters
    const sanitized = filters.companySize.replace(
      /[^a-zA-Z0-9\s\-$+<>]/g,
      ''
    );
    whereConditions.push(`data->>'annual_revenue_band' = '${sanitized}'`);
  }

  if (filters.industry) {
    // Sanitize: only allow alphanumeric, spaces, hyphens, slashes, ampersands
    const sanitized = filters.industry.replace(/[^a-zA-Z0-9\s\-&/]/g, '');
    whereConditions.push(`data->>'agency_type' = '${sanitized}'`);
  }

  // Key metrics to aggregate from BUSINESS category JSONB data
  const metrics = ['annualRevenue', 'arpu', 'ltv', 'churnRate', 'cac'];
  const insights: BenchmarkInsight[] = [];

  for (const metric of metrics) {
    // Use raw SQL for JSONB extraction and percentile calculations
    const query = `
      WITH extracted AS (
        SELECT (data->>'${metric}')::numeric as value
        FROM "BenchmarkSubmission"
        WHERE ${whereConditions.join(' AND ')}
          AND data->>'${metric}' IS NOT NULL
      )
      SELECT
        COUNT(*) as sample_size,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) as median,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY value) as p25,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75,
        AVG(value) as avg
      FROM extracted
      WHERE value IS NOT NULL
    `;

    try {
      const result = await prisma.$queryRawUnsafe<
        Array<{
          sample_size: bigint;
          median: number | null;
          p25: number | null;
          p75: number | null;
          avg: number | null;
        }>
      >(query);

      if (result.length > 0 && Number(result[0].sample_size) > 0) {
        insights.push({
          metric,
          sampleSize: Number(result[0].sample_size),
          median: result[0].median ? Number(result[0].median) : null,
          p25: result[0].p25 ? Number(result[0].p25) : null,
          p75: result[0].p75 ? Number(result[0].p75) : null,
          avg: result[0].avg ? Number(result[0].avg) : null,
        });
      }
    } catch {
      // Skip metrics that fail (e.g., if field doesn't exist in data)
      continue;
    }
  }

  // Get total sample size for the filtered set
  const totalResult = await prisma.benchmarkSubmission.count({
    where: {
      category: 'BUSINESS',
      isValid: true,
    },
  });

  return {
    filters,
    insights,
    sampleSize: totalResult,
  };
}
