/**
 * Churn prediction service
 * ANALYTICS-07: Multi-factor churn risk scoring
 * Factors: inactivity duration, declining engagement trend, payment issues
 */

import { prisma } from '../lib/prisma.js';
import type { ChurnRiskScore, ChurnRiskFactor } from './types.js';

// =============================================================================
// ANALYTICS-07: Calculate Individual Churn Risk
// =============================================================================

/**
 * Calculate churn risk score for a single member
 * Uses multi-factor scoring algorithm:
 * - Factor 1: Inactivity duration (0-40 points)
 * - Factor 2: Declining engagement trend (0-30 points)
 * - Factor 3: Payment issues (0-30 points)
 *
 * Total score: 0-100, higher = more at-risk
 * Risk levels: low (<30), medium (30-59), high (60+)
 */
export async function calculateChurnRisk(
  memberId: string
): Promise<ChurnRiskScore | null> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      pointTransactions: {
        take: 60,
        orderBy: { createdAt: 'desc' },
        where: { points: { gt: 0 } },
      },
    },
  });

  if (!member) return null;

  let score = 0;
  const factors: ChurnRiskFactor[] = [];

  // -------------------------------------------------------------------------
  // Factor 1: Inactivity duration (0-40 points)
  // -------------------------------------------------------------------------
  const daysSinceActive = member.lastActiveAt
    ? Math.floor(
        (Date.now() - member.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    : 999;

  if (daysSinceActive > 30) {
    score += 40;
    factors.push({
      factor: 'inactivity',
      points: 40,
      description: `Inactive for ${daysSinceActive} days`,
    });
  } else if (daysSinceActive > 14) {
    score += 20;
    factors.push({
      factor: 'inactivity',
      points: 20,
      description: `Inactive for ${daysSinceActive} days`,
    });
  } else if (daysSinceActive > 7) {
    score += 10;
    factors.push({
      factor: 'inactivity',
      points: 10,
      description: `Inactive for ${daysSinceActive} days`,
    });
  }

  // -------------------------------------------------------------------------
  // Factor 2: Declining engagement trend (0-30 points)
  // Compare last 14 days vs previous 14 days
  // -------------------------------------------------------------------------
  const now = Date.now();
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  const twentyEightDaysAgo = now - 28 * 24 * 60 * 60 * 1000;

  const recentActivity = member.pointTransactions.filter(
    (t) => t.createdAt.getTime() > fourteenDaysAgo
  ).length;
  const olderActivity = member.pointTransactions.filter(
    (t) =>
      t.createdAt.getTime() > twentyEightDaysAgo &&
      t.createdAt.getTime() <= fourteenDaysAgo
  ).length;

  if (olderActivity > 0 && recentActivity < olderActivity * 0.5) {
    score += 30;
    factors.push({
      factor: 'declining_engagement',
      points: 30,
      description: 'Engagement declined by 50%+',
    });
  } else if (olderActivity > 0 && recentActivity < olderActivity * 0.75) {
    score += 15;
    factors.push({
      factor: 'declining_engagement',
      points: 15,
      description: 'Engagement declining',
    });
  }

  // -------------------------------------------------------------------------
  // Factor 3: Payment issues (0-30 points)
  // -------------------------------------------------------------------------
  if (member.subscriptionStatus === 'PAST_DUE') {
    score += 30;
    factors.push({
      factor: 'payment_issues',
      points: 30,
      description: 'Payment past due',
    });
  } else if (member.paymentFailedAt && !member.gracePeriodEndsAt) {
    score += 15;
    factors.push({
      factor: 'payment_issues',
      points: 15,
      description: 'Recent payment failure',
    });
  }

  // -------------------------------------------------------------------------
  // Finalize score and risk level
  // -------------------------------------------------------------------------
  const finalScore = Math.min(score, 100);
  const riskLevel =
    finalScore >= 60 ? 'high' : finalScore >= 30 ? 'medium' : 'low';

  return {
    memberId,
    email: member.email || '',
    discordUsername: member.discordUsername,
    score: finalScore,
    riskLevel,
    factors,
    lastActiveAt: member.lastActiveAt,
    subscriptionStatus: member.subscriptionStatus,
  };
}

// =============================================================================
// ANALYTICS-07: Get All At-Risk Members
// =============================================================================

/**
 * Get all members with churn risk score >= threshold
 * Default threshold: 30 (medium risk or higher)
 * Returns sorted by score descending (highest risk first)
 */
export async function getAtRiskMembers(
  minScore = 30,
  limit = 50
): Promise<ChurnRiskScore[]> {
  // Get members with active subscriptions
  const members = await prisma.member.findMany({
    where: {
      subscriptionStatus: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
    },
    select: { id: true },
    take: 500, // Process in batches to avoid memory issues
  });

  const scores: ChurnRiskScore[] = [];

  for (const member of members) {
    const risk = await calculateChurnRisk(member.id);
    if (risk && risk.score >= minScore) {
      scores.push(risk);
    }
    // Stop once we have enough high-risk members
    if (scores.length >= limit) break;
  }

  // Sort by score descending (highest risk first)
  return scores.sort((a, b) => b.score - a.score).slice(0, limit);
}
