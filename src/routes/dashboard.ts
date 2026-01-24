import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

export const dashboardRouter = Router();

/**
 * GET /dashboard
 * Returns current user's subscription status, claim availability, team info, and activity timeline
 */
dashboardRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
    select: {
      id: true,
      email: true,
      subscriptionStatus: true,
      seatTier: true,
      currentPeriodEnd: true,
      discordId: true,
      discordUsername: true,
      introCompleted: true,
      leaderboardVisible: true,
      createdAt: true,
      updatedAt: true,
      introCompletedAt: true,
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Determine claim state
  const canClaim = member.subscriptionStatus === 'ACTIVE' && !member.discordId;
  const hasClaimed = !!member.discordId;

  // Build activity timeline from member fields
  const timeline: { type: string; date: Date; description: string }[] = [];

  // Account created
  timeline.push({
    type: 'joined',
    date: member.createdAt,
    description: 'Account created',
  });

  // Subscription started (if active)
  if (member.subscriptionStatus === 'ACTIVE' || member.subscriptionStatus === 'PAST_DUE') {
    timeline.push({
      type: 'subscribed',
      date: member.createdAt, // Approximate (subscription typically starts at creation)
      description: 'Subscription activated',
    });
  }

  // Discord claimed
  if (member.discordId) {
    timeline.push({
      type: 'discord_claimed',
      date: member.updatedAt, // Approximate (updated when Discord linked)
      description: `Discord linked: ${member.discordUsername}`,
    });
  }

  // Introduction completed
  if (member.introCompletedAt) {
    timeline.push({
      type: 'introduced',
      date: member.introCompletedAt,
      description: 'Introduction posted',
    });
  }

  // Sort timeline by date descending (most recent first)
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json({
    member: {
      id: member.id,
      email: member.email,
      subscriptionStatus: member.subscriptionStatus,
      seatTier: member.seatTier,
      currentPeriodEnd: member.currentPeriodEnd,
      discordUsername: member.discordUsername,
      introCompleted: member.introCompleted,
      leaderboardVisible: member.leaderboardVisible,
    },
    claim: {
      canClaim,
      hasClaimed,
      discordInviteUrl: hasClaimed ? env.DISCORD_INVITE_URL : null,
    },
    team: member.team ? {
      id: member.team.id,
      name: member.team.name,
      isOwner: member.seatTier === 'OWNER',
    } : null,
    timeline,
  });
});
