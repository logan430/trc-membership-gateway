/**
 * Member Settings API
 *
 * Privacy settings and member-specific configuration endpoints.
 */
import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

export const memberRouter = Router();

const privacySchema = z.object({
  leaderboardVisible: z.boolean(),
});

/**
 * GET /api/member/privacy
 * Get member's privacy settings
 */
memberRouter.get('/privacy', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const memberId = req.memberId!;

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { leaderboardVisible: true },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  res.json({ leaderboardVisible: member.leaderboardVisible });
});

/**
 * PUT /api/member/privacy
 * Update member's privacy settings (leaderboard visibility)
 */
memberRouter.put('/privacy', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const memberId = req.memberId!;

  const parsed = privacySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }

  const { leaderboardVisible } = parsed.data;

  await prisma.member.update({
    where: { id: memberId },
    data: { leaderboardVisible },
  });

  res.json({
    message: 'Privacy settings updated',
    leaderboardVisible,
  });
});
