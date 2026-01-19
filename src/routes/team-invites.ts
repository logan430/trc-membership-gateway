import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { generateInviteToken } from '../lib/invite-tokens.js';
import { sendSeatInviteEmail } from '../email/send.js';
import { logger } from '../index.js';

export const teamInvitesRouter = Router();

// Validation schemas
const createInviteSchema = z.object({
  seatTier: z.enum(['OWNER', 'TEAM_MEMBER']),
  email: z.string().email().optional(),
});

/**
 * POST /team/invites
 * Create a new invite token for a team seat
 * Only team owners can create invites
 */
teamInvitesRouter.post('/invites', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Validate request body
  const parsed = createInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues });
    return;
  }

  const { seatTier } = parsed.data;

  // Look up member
  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Verify member belongs to a team
  if (!member.teamId) {
    res.status(400).json({ error: 'You are not part of a team' });
    return;
  }

  // Verify member is a team owner (only owners can create invites)
  if (member.seatTier !== 'OWNER') {
    res.status(403).json({ error: 'Only team owners can create invites' });
    return;
  }

  // Check seat availability before creating invite
  const team = await prisma.team.findUnique({
    where: { id: member.teamId },
    include: {
      members: { where: { seatTier: seatTier } },
    },
  });

  if (!team) {
    res.status(404).json({ error: 'Team not found' });
    return;
  }

  const maxSeats = seatTier === 'OWNER' ? team.ownerSeatCount : team.teamSeatCount;
  const claimedSeats = team.members.length;

  if (claimedSeats >= maxSeats) {
    res.status(400).json({
      error: `No ${seatTier.toLowerCase().replace('_', ' ')} seats available`,
      claimed: claimedSeats,
      total: maxSeats,
    });
    return;
  }

  // Generate secure token and create invite
  const token = generateInviteToken();

  const invite = await prisma.pendingInvite.create({
    data: {
      teamId: member.teamId,
      seatTier: seatTier,
      token: token,
      createdBy: member.id,
      inviteeEmail: parsed.data.email,
    },
  });

  const inviteUrl = `${env.APP_URL}/team/claim?token=${invite.token}`;

  // Send invite email if email was provided (fire-and-forget)
  if (parsed.data.email) {
    sendSeatInviteEmail(
      parsed.data.email,
      team.name,
      seatTier,
      inviteUrl
    ).catch(err => {
      logger.error({ inviteId: invite.id, err }, 'Failed to send invite email');
    });
  }

  logger.info(
    { memberId: member.id, teamId: member.teamId, inviteId: invite.id, seatTier, emailSent: !!parsed.data.email },
    'Team invite created'
  );

  res.status(201).json({
    invite: {
      id: invite.id,
      seatTier: invite.seatTier,
      token: invite.token,
      inviteUrl,
      inviteeEmail: invite.inviteeEmail,
      emailSent: !!parsed.data.email,
      createdAt: invite.createdAt,
    },
  });
});

/**
 * GET /team/invites
 * List all pending invites for the team
 * Only team owners can list invites
 */
teamInvitesRouter.get('/invites', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Look up member
  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Verify member belongs to a team
  if (!member.teamId) {
    res.status(400).json({ error: 'You are not part of a team' });
    return;
  }

  // Verify member is a team owner
  if (member.seatTier !== 'OWNER') {
    res.status(403).json({ error: 'Only team owners can view invites' });
    return;
  }

  // Fetch all invites for the team
  const invites = await prisma.pendingInvite.findMany({
    where: { teamId: member.teamId },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    invites: invites.map(i => ({
      id: i.id,
      seatTier: i.seatTier,
      inviteUrl: `${env.APP_URL}/team/claim?token=${i.token}`,
      inviteeEmail: i.inviteeEmail,
      createdAt: i.createdAt,
      acceptedAt: i.acceptedAt,
      acceptedBy: i.acceptedBy,
    })),
  });
});

/**
 * DELETE /team/invites/:inviteId
 * Revoke (delete) a pending invite
 * Only team owners can revoke invites
 */
teamInvitesRouter.delete('/invites/:inviteId', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const inviteId = req.params.inviteId as string;

  // Look up member
  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Verify member belongs to a team
  if (!member.teamId) {
    res.status(400).json({ error: 'You are not part of a team' });
    return;
  }

  // Verify member is a team owner
  if (member.seatTier !== 'OWNER') {
    res.status(403).json({ error: 'Only team owners can revoke invites' });
    return;
  }

  // Look up invite and verify it belongs to member's team
  const invite = await prisma.pendingInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite) {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }

  if (invite.teamId !== member.teamId) {
    res.status(403).json({ error: 'Invite does not belong to your team' });
    return;
  }

  // Delete the invite
  await prisma.pendingInvite.delete({
    where: { id: inviteId },
  });

  logger.info(
    { memberId: member.id, teamId: member.teamId, inviteId },
    'Team invite revoked'
  );

  res.status(204).send();
});
