import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';

export const teamDashboardRouter = Router();

/**
 * GET /team/dashboard
 * Returns team seat allocation data for team owners.
 * Only accessible by team members with OWNER seatTier.
 */
teamDashboardRouter.get('/dashboard', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Look up member to get their teamId
  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
    select: {
      id: true,
      teamId: true,
      seatTier: true,
      isPrimaryOwner: true,
    },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Check if member is part of a team
  if (!member.teamId) {
    res.status(404).json({ error: 'Not part of a team' });
    return;
  }

  // Only team owners can access the dashboard
  if (member.seatTier !== 'OWNER') {
    res.status(403).json({ error: 'Only team owners can access the dashboard' });
    return;
  }

  // Query team with all members
  const team = await prisma.team.findUnique({
    where: { id: member.teamId },
    include: {
      members: {
        select: {
          id: true,
          discordUsername: true,
          email: true,
          seatTier: true,
          introCompleted: true,
          isPrimaryOwner: true,
          discordId: true,
        },
        orderBy: [
          { isPrimaryOwner: 'desc' },
          { seatTier: 'asc' },
          { createdAt: 'asc' },
        ],
      },
    },
  });

  if (!team) {
    res.status(404).json({ error: 'Team not found' });
    return;
  }

  // Calculate seat counts
  const owners = team.members.filter(m => m.seatTier === 'OWNER');
  const teamMembers = team.members.filter(m => m.seatTier === 'TEAM_MEMBER');

  const seatSummary = {
    owner: { claimed: owners.length, total: team.ownerSeatCount },
    team: { claimed: teamMembers.length, total: team.teamSeatCount },
  };

  // Return structured response
  res.json({
    team: {
      id: team.id,
      name: team.name,
      subscriptionStatus: team.subscriptionStatus,
    },
    seats: seatSummary,
    members: {
      owners: owners.map(m => ({
        id: m.id,
        name: m.discordUsername ?? m.email ?? 'Unclaimed',
        email: m.email,
        status: m.discordId ? 'claimed' : 'pending',
        introCompleted: m.introCompleted,
        isPrimaryOwner: m.isPrimaryOwner,
      })),
      team: teamMembers.map(m => ({
        id: m.id,
        name: m.discordUsername ?? m.email ?? 'Unclaimed',
        email: m.email,
        status: m.discordId ? 'claimed' : 'pending',
        introCompleted: m.introCompleted,
      })),
    },
    currentUser: {
      id: member.id,
      isPrimaryOwner: member.isPrimaryOwner,
    },
  });
});
