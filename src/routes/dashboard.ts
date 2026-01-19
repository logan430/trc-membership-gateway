import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

export const dashboardRouter = Router();

/**
 * GET /dashboard
 * Returns current user's subscription status and claim availability
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
    },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Determine claim state
  const canClaim = member.subscriptionStatus === 'ACTIVE' && !member.discordId;
  const hasClaimed = !!member.discordId;

  res.json({
    member: {
      id: member.id,
      email: member.email,
      subscriptionStatus: member.subscriptionStatus,
      seatTier: member.seatTier,
      currentPeriodEnd: member.currentPeriodEnd,
      discordUsername: member.discordUsername,
      introCompleted: member.introCompleted,
    },
    claim: {
      canClaim,
      hasClaimed,
      discordInviteUrl: hasClaimed ? env.DISCORD_INVITE_URL : null,
    },
  });
});
