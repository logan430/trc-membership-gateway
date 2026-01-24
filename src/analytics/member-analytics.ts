/**
 * Member analytics service
 * ANALYTICS-01: Member overview counts
 * ANALYTICS-06: Cohort retention analysis
 */

import { prisma } from '../lib/prisma.js';
import type { MemberOverview, CohortRow } from './types.js';

// =============================================================================
// ANALYTICS-01: Member Overview
// =============================================================================

/**
 * Get high-level member overview statistics
 * Includes total members, active (30-day), inactive, new, and MRR estimate
 */
export async function getMemberOverview(): Promise<MemberOverview> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [total, active, newMembers] = await Promise.all([
    // Total members with any active-ish subscription
    prisma.member.count({
      where: { subscriptionStatus: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
    }),
    // Active = has point-earning activity in last 30 days
    prisma.member.count({
      where: {
        subscriptionStatus: { in: ['ACTIVE', 'TRIALING'] },
        lastActiveAt: { gte: thirtyDaysAgo },
      },
    }),
    // New members = joined in last 30 days with subscription
    prisma.member.count({
      where: {
        subscriptionStatus: { in: ['ACTIVE', 'TRIALING'] },
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  // MRR estimate: count * estimated average subscription price
  // In production, this would query Stripe or cached subscription data
  // Placeholder: $50/month average
  const mrr = total * 50;

  return {
    totalMembers: total,
    activeMembers: active,
    inactiveMembers: total - active,
    newMembers30d: newMembers,
    mrr,
  };
}

// =============================================================================
// ANALYTICS-06: Cohort Retention
// =============================================================================

/**
 * Get cohort retention analysis
 * Groups members by signup month and tracks activity in subsequent months
 * Uses PointTransaction activity as retention signal
 */
export async function getCohortRetention(): Promise<CohortRow[]> {
  // Raw SQL for efficient cohort analysis with PostgreSQL date functions
  const rows = await prisma.$queryRaw<
    Array<{
      cohort: string;
      month0: bigint;
      month1: bigint;
      month2: bigint;
      month3: bigint;
      month4: bigint;
      month5: bigint;
    }>
  >`
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
      COUNT(DISTINCT c.id)::bigint as month0,
      COUNT(DISTINCT CASE WHEN a.activity_month = c.cohort_month + INTERVAL '1 month' THEN c.id END)::bigint as month1,
      COUNT(DISTINCT CASE WHEN a.activity_month = c.cohort_month + INTERVAL '2 months' THEN c.id END)::bigint as month2,
      COUNT(DISTINCT CASE WHEN a.activity_month = c.cohort_month + INTERVAL '3 months' THEN c.id END)::bigint as month3,
      COUNT(DISTINCT CASE WHEN a.activity_month = c.cohort_month + INTERVAL '4 months' THEN c.id END)::bigint as month4,
      COUNT(DISTINCT CASE WHEN a.activity_month = c.cohort_month + INTERVAL '5 months' THEN c.id END)::bigint as month5
    FROM cohorts c
    LEFT JOIN activity a ON c.id = a."memberId"
    GROUP BY c.cohort_month
    ORDER BY c.cohort_month DESC
    LIMIT 12
  `;

  // Convert bigints and calculate percentages
  return rows.map((row) => {
    const m0 = Number(row.month0);
    return {
      cohort: row.cohort,
      month0: m0,
      month1: Number(row.month1),
      month2: Number(row.month2),
      month3: Number(row.month3),
      month4: Number(row.month4),
      month5: Number(row.month5),
      month0Pct: 100,
      month1Pct: m0 > 0 ? Math.round((Number(row.month1) / m0) * 100) : 0,
      month2Pct: m0 > 0 ? Math.round((Number(row.month2) / m0) * 100) : 0,
      month3Pct: m0 > 0 ? Math.round((Number(row.month3) / m0) * 100) : 0,
      month4Pct: m0 > 0 ? Math.round((Number(row.month4) / m0) * 100) : 0,
      month5Pct: m0 > 0 ? Math.round((Number(row.month5) / m0) * 100) : 0,
    };
  });
}
