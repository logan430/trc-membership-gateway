/**
 * Member-facing leaderboard API
 * Supports monthly vs all-time periods and respects leaderboardVisible privacy setting
 */
import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';

export const leaderboardRouter = Router();

/**
 * GET /api/leaderboard
 * Query params:
 *   - period: 'month' | 'alltime' (default: 'month')
 * Returns top 25 members and current member's rank
 * Excludes members where leaderboardVisible = false (GAME-11)
 */
leaderboardRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const memberId = req.memberId!;
  const period = req.query.period === 'alltime' ? 'alltime' : 'month';

  // Calculate start of current month for monthly filter
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Base where clause - only include members visible on leaderboard (GAME-11)
  const baseWhere = {
    subscriptionStatus: 'ACTIVE' as const,
    leaderboardVisible: true, // Respect privacy setting
  };

  // For monthly, we need to sum points earned this month from transactions
  // For all-time, use totalPoints directly
  let topMembers;
  let currentMemberData;
  let currentMemberRank = 0;

  if (period === 'month') {
    // Get monthly points by aggregating transactions
    const monthlyRankings = await prisma.$queryRaw<Array<{
      id: string;
      discordUsername: string | null;
      monthlyPoints: bigint;
      currentStreak: number;
    }>>`
      SELECT
        m.id,
        m."discordUsername",
        COALESCE(SUM(pt.points), 0) as "monthlyPoints",
        m."currentStreak"
      FROM "Member" m
      LEFT JOIN "PointTransaction" pt ON pt."memberId" = m.id
        AND pt."createdAt" >= ${monthStart}
      WHERE m."subscriptionStatus" = 'ACTIVE'
        AND m."leaderboardVisible" = true
      GROUP BY m.id
      HAVING COALESCE(SUM(pt.points), 0) > 0
      ORDER BY "monthlyPoints" DESC
      LIMIT 25
    `;

    topMembers = monthlyRankings.map((m, i) => ({
      id: m.id,
      discordUsername: m.discordUsername,
      totalPoints: Number(m.monthlyPoints),
      currentStreak: m.currentStreak,
      rank: i + 1,
      isCurrent: m.id === memberId,
    }));

    // Get current member's monthly points and rank
    const currentMemberMonthly = await prisma.$queryRaw<Array<{
      monthlyPoints: bigint;
    }>>`
      SELECT COALESCE(SUM(pt.points), 0) as "monthlyPoints"
      FROM "Member" m
      LEFT JOIN "PointTransaction" pt ON pt."memberId" = m.id
        AND pt."createdAt" >= ${monthStart}
      WHERE m.id = ${memberId}
      GROUP BY m.id
    `;

    const currentMemberPoints = currentMemberMonthly[0] ? Number(currentMemberMonthly[0].monthlyPoints) : 0;

    // Count members with more monthly points
    const membersAbove = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM (
        SELECT m.id
        FROM "Member" m
        LEFT JOIN "PointTransaction" pt ON pt."memberId" = m.id
          AND pt."createdAt" >= ${monthStart}
        WHERE m."subscriptionStatus" = 'ACTIVE'
          AND m."leaderboardVisible" = true
        GROUP BY m.id
        HAVING COALESCE(SUM(pt.points), 0) > ${currentMemberPoints}
      ) sub
    `;

    currentMemberRank = Number(membersAbove[0]?.count || 0) + 1;

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, discordUsername: true, currentStreak: true },
    });

    currentMemberData = member ? {
      ...member,
      totalPoints: currentMemberPoints,
      rank: currentMemberRank,
    } : null;

  } else {
    // All-time - use totalPoints directly
    topMembers = await prisma.member.findMany({
      where: {
        ...baseWhere,
        totalPoints: { gt: 0 },
      },
      orderBy: { totalPoints: 'desc' },
      take: 25,
      select: {
        id: true,
        discordUsername: true,
        totalPoints: true,
        currentStreak: true,
      },
    });

    topMembers = topMembers.map((m, i) => ({
      ...m,
      rank: i + 1,
      isCurrent: m.id === memberId,
    }));

    // Get current member's data
    const currentMember = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        discordUsername: true,
        totalPoints: true,
        currentStreak: true,
      },
    });

    // Calculate current member's rank
    if (currentMember) {
      const membersAbove = await prisma.member.count({
        where: {
          totalPoints: { gt: currentMember.totalPoints },
          subscriptionStatus: 'ACTIVE',
          leaderboardVisible: true,
        },
      });
      currentMemberRank = membersAbove + 1;
    }

    currentMemberData = currentMember ? {
      ...currentMember,
      rank: currentMemberRank,
    } : null;
  }

  // Get total participant count (visible members with points)
  const totalParticipants = await prisma.member.count({
    where: {
      totalPoints: { gt: 0 },
      subscriptionStatus: 'ACTIVE',
      leaderboardVisible: true,
    },
  });

  // Calculate next reset date (first of next month)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  res.json({
    period,
    topMembers,
    currentMember: currentMemberData,
    totalParticipants,
    nextResetAt: nextMonth.toISOString(),
  });
});
