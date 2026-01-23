/**
 * Benchmark service layer
 * Handles benchmark submission, aggregation, and outlier detection
 * Integrates with points system for first-time category submissions
 */

import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';
import { awardBenchmarkPoints } from '../points/service.js';
import { benchmarkDataSchemas, K_ANONYMITY_THRESHOLD } from './schemas.js';
import { Prisma, type BenchmarkCategory } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of a benchmark submission operation
 */
export interface SubmitResult {
  submission: {
    id: string;
    category: BenchmarkCategory;
    submittedAt: Date;
    isValid: boolean;
  };
  outlierFields: string[];
  pointsAwarded: number;
}

/**
 * Aggregate data for a single field (after k-anonymity check passes)
 */
export interface AggregateField {
  field: string;
  median: number | null;
  p25: number | null;
  p75: number | null;
  min: number | null;
  max: number | null;
  count: number;
  yourValue?: number;
}

/**
 * Field that doesn't have enough submissions for k-anonymity
 */
export interface InsufficientField {
  field: string;
  currentCount: number;
  needMore: number;
}

/**
 * Segment filters for cross-category filtering
 * Filters aggregate results based on BUSINESS submission data
 */
export interface SegmentFilters {
  companySize?: string; // Matches annual_revenue_band in BUSINESS category
  industry?: string; // Matches agency_type in BUSINESS category
  // Note: role filter deferred - would require Member schema extension
}

/**
 * Full aggregate result for a category
 */
export interface AggregateResult {
  category: BenchmarkCategory;
  available: AggregateField[];
  insufficient: InsufficientField[];
  totalSubmissions: number;
}

// =============================================================================
// Outlier Detection
// =============================================================================

/**
 * Detect outliers in submitted benchmark data
 * Uses 3-sigma rule: values > 3 standard deviations from median are outliers
 * Only checks fields with sufficient existing data (K_ANONYMITY_THRESHOLD+)
 *
 * @param category - The benchmark category
 * @param data - Validated benchmark data object
 * @returns Array of field names that are outliers
 */
async function detectOutliers(
  category: BenchmarkCategory,
  data: Record<string, unknown>
): Promise<string[]> {
  const outlierFields: string[] = [];
  const schema = benchmarkDataSchemas[category];

  // Get numeric fields that have values in the submission
  const numericFields = Object.keys(schema.shape).filter(
    (key) => typeof data[key] === 'number'
  );

  for (const field of numericFields) {
    const value = data[field] as number;

    // Query stats for this field from existing valid submissions
    // Using raw SQL for PostgreSQL aggregate functions
    const stats = await prisma.$queryRaw<
      { count: bigint; median: number | null; stddev: number | null }[]
    >`
      SELECT
        count(*)::bigint as count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY (data->>${Prisma.raw(`'${field}'`)})::numeric) as median,
        stddev((data->>${Prisma.raw(`'${field}'`)})::numeric) as stddev
      FROM "BenchmarkSubmission"
      WHERE category = ${category}::"BenchmarkCategory"
        AND "isValid" = true
        AND data->>${Prisma.raw(`'${field}'`)} IS NOT NULL
    `;

    const { count, median, stddev } = stats[0] || {
      count: BigInt(0),
      median: null,
      stddev: null,
    };

    // Only check outlier if sufficient data exists and stddev is meaningful
    if (
      Number(count) >= K_ANONYMITY_THRESHOLD &&
      stddev !== null &&
      stddev > 0 &&
      median !== null
    ) {
      const zScore = Math.abs((value - median) / stddev);
      if (zScore > 3) {
        outlierFields.push(field);
        logger.debug(
          { category, field, value, median, stddev, zScore },
          'Outlier detected'
        );
      }
    }
  }

  return outlierFields;
}

// =============================================================================
// Submit Benchmark
// =============================================================================

/**
 * Submit benchmark data for a member
 * Validates data, detects outliers, upserts to database, and awards points
 *
 * @param memberId - The member ID
 * @param category - The benchmark category
 * @param rawData - Raw data to validate and store
 * @returns SubmitResult with submission details, outliers, and points awarded
 */
export async function submitBenchmark(
  memberId: string,
  category: BenchmarkCategory,
  rawData: unknown
): Promise<SubmitResult> {
  // Validate data against category-specific Zod schema
  const schema = benchmarkDataSchemas[category];
  const parseResult = schema.safeParse(rawData);

  if (!parseResult.success) {
    logger.warn(
      { memberId, category, errors: parseResult.error.flatten() },
      'Benchmark validation failed'
    );
    throw new Error(`Invalid benchmark data: ${parseResult.error.message}`);
  }

  const data = parseResult.data;

  // Detect statistical outliers in the submission
  const outlierFields = await detectOutliers(
    category,
    data as Record<string, unknown>
  );
  const isValid = outlierFields.length === 0;

  // Upsert submission (one per member per category)
  const submission = await prisma.benchmarkSubmission.upsert({
    where: {
      memberId_category: { memberId, category },
    },
    create: {
      memberId,
      category,
      data: data as Prisma.InputJsonValue,
      isValid,
    },
    update: {
      data: data as Prisma.InputJsonValue,
      isValid,
      // submittedAt stays as original, updatedAt auto-updates
    },
    select: {
      id: true,
      category: true,
      submittedAt: true,
      isValid: true,
    },
  });

  // Award points (handles idempotency internally - one award per category ever)
  const pointResult = await awardBenchmarkPoints(memberId, category);

  logger.info(
    {
      memberId,
      category,
      submissionId: submission.id,
      isValid,
      outlierFields,
      pointsAwarded: pointResult.points,
    },
    'Benchmark submitted'
  );

  return {
    submission,
    outlierFields,
    pointsAwarded: pointResult.points,
  };
}

// =============================================================================
// Get Member Submissions
// =============================================================================

/**
 * Get all benchmark submissions for a member
 *
 * @param memberId - The member ID
 * @returns Array of submissions with all fields
 */
export async function getMySubmissions(memberId: string): Promise<
  {
    id: string;
    category: BenchmarkCategory;
    data: Prisma.JsonValue;
    isValid: boolean;
    submittedAt: Date;
    updatedAt: Date;
  }[]
> {
  const submissions = await prisma.benchmarkSubmission.findMany({
    where: { memberId },
    select: {
      id: true,
      category: true,
      data: true,
      isValid: true,
      submittedAt: true,
      updatedAt: true,
    },
    orderBy: { category: 'asc' },
  });

  logger.debug(
    { memberId, count: submissions.length },
    'Retrieved member submissions'
  );

  return submissions;
}

// =============================================================================
// Get Aggregates
// =============================================================================

/**
 * Get aggregate statistics for a benchmark category
 * Applies k-anonymity filter (only returns fields with 5+ submissions)
 * Optionally includes member's own value for comparison
 * Optionally filters by segment (requires BUSINESS category submission for matching)
 *
 * @param category - The benchmark category
 * @param memberId - Optional member ID to include their value
 * @param filters - Optional segment filters (companySize, industry)
 * @returns AggregateResult with available and insufficient fields
 */
export async function getAggregates(
  category: BenchmarkCategory,
  memberId?: string,
  filters?: SegmentFilters
): Promise<AggregateResult> {
  // Get user's submission if memberId provided
  const userSubmission = memberId
    ? await prisma.benchmarkSubmission.findUnique({
        where: { memberId_category: { memberId, category } },
      })
    : null;

  const schema = benchmarkDataSchemas[category];
  const fields = Object.keys(schema.shape);

  // Build member filter subquery if segment filters provided
  // Filters by matching BUSINESS category submission data
  let memberFilterSql = '';
  if (filters?.companySize || filters?.industry) {
    const conditions: string[] = [];
    if (filters.companySize) {
      // Sanitize input - only allow alphanumeric, spaces, and hyphens
      const sanitized = filters.companySize.replace(/[^a-zA-Z0-9\s\-$+<>]/g, '');
      conditions.push(`data->>'annual_revenue_band' = '${sanitized}'`);
    }
    if (filters.industry) {
      // Sanitize input - only allow alphanumeric, spaces, and hyphens
      const sanitized = filters.industry.replace(/[^a-zA-Z0-9\s\-&/]/g, '');
      conditions.push(`data->>'agency_type' = '${sanitized}'`);
    }

    memberFilterSql = `
      AND "memberId" IN (
        SELECT "memberId" FROM "BenchmarkSubmission"
        WHERE category = 'BUSINESS'::"BenchmarkCategory"
          AND "isValid" = true
          AND ${conditions.join(' AND ')}
      )
    `;

    logger.debug(
      { category, filters, memberFilterSql },
      'Segment filter applied to aggregates'
    );
  }

  // Calculate aggregates for each field
  const aggregates = await Promise.all(
    fields.map(async (field) => {
      // Build the full query with optional member filter
      const queryText = `
        SELECT
          count(*)::bigint as count,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY (data->>'${field}')::numeric) as median,
          percentile_cont(0.25) WITHIN GROUP (ORDER BY (data->>'${field}')::numeric) as p25,
          percentile_cont(0.75) WITHIN GROUP (ORDER BY (data->>'${field}')::numeric) as p75,
          min((data->>'${field}')::numeric) as min,
          max((data->>'${field}')::numeric) as max
        FROM "BenchmarkSubmission"
        WHERE category = '${category}'::"BenchmarkCategory"
          AND "isValid" = true
          AND data->>'${field}' IS NOT NULL
          ${memberFilterSql}
      `;

      const result = await prisma.$queryRawUnsafe<
        {
          count: bigint;
          median: number | null;
          p25: number | null;
          p75: number | null;
          min: number | null;
          max: number | null;
        }[]
      >(queryText);

      const userData = userSubmission?.data as Record<string, unknown> | null;
      const yourValue =
        typeof userData?.[field] === 'number'
          ? (userData[field] as number)
          : undefined;

      return {
        field,
        ...result[0],
        count: Number(result[0]?.count || 0),
        yourValue,
      };
    })
  );

  // Apply k-anonymity filter
  // Only fields with K_ANONYMITY_THRESHOLD+ submissions are "available"
  const available = aggregates
    .filter((a) => a.count >= K_ANONYMITY_THRESHOLD)
    .map((a) => ({
      field: a.field,
      median: a.median,
      p25: a.p25,
      p75: a.p75,
      min: a.min,
      max: a.max,
      count: a.count,
      yourValue: a.yourValue,
    }));

  // Fields with some data but not enough for k-anonymity
  const insufficient = aggregates
    .filter((a) => a.count < K_ANONYMITY_THRESHOLD && a.count > 0)
    .map((a) => ({
      field: a.field,
      currentCount: a.count,
      needMore: K_ANONYMITY_THRESHOLD - a.count,
    }));

  // Get total valid submissions for this category (with segment filters)
  let totalSubmissions: number;
  if (memberFilterSql) {
    const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
      SELECT count(*)::bigint as count
      FROM "BenchmarkSubmission"
      WHERE category = '${category}'::"BenchmarkCategory"
        AND "isValid" = true
        ${memberFilterSql}
    `);
    totalSubmissions = Number(countResult[0]?.count || 0);
  } else {
    totalSubmissions = await prisma.benchmarkSubmission.count({
      where: { category, isValid: true },
    });
  }

  return { category, available, insufficient, totalSubmissions };
}

// =============================================================================
// Exports
// =============================================================================

export { detectOutliers };
