import { Router, Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../index.js';
import { revokeAndKickAsync } from '../lib/role-assignment.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

// Schema for adding seats
const addSeatsSchema = z.object({
  seatType: z.enum(['owner', 'team']),
  quantity: z.number().int().min(1).max(50),
});

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

/**
 * DELETE /team/members/:memberId
 * Revoke a seat from a team member.
 * Only accessible by team owners, cannot revoke primary owner or self.
 */
teamDashboardRouter.delete('/members/:memberId', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { memberId: targetMemberId } = req.params;

  // Get requester
  const requester = await prisma.member.findUnique({
    where: { id: req.memberId },
  });

  if (!requester?.teamId) {
    res.status(404).json({ error: 'Not part of a team' });
    return;
  }

  if (requester.seatTier !== 'OWNER') {
    res.status(403).json({ error: 'Only team owners can revoke seats' });
    return;
  }

  // Get target member
  const targetMember = await prisma.member.findUnique({
    where: { id: targetMemberId },
  });

  if (!targetMember) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Verify target is in same team
  if (targetMember.teamId !== requester.teamId) {
    res.status(403).json({ error: 'Cannot revoke member from another team' });
    return;
  }

  // Cannot revoke yourself
  if (targetMemberId === req.memberId) {
    res.status(400).json({ error: 'Cannot revoke your own seat' });
    return;
  }

  // Primary owner protection per CONTEXT.md
  if (targetMember.isPrimaryOwner) {
    res.status(403).json({ error: 'Primary owner cannot be revoked by other team members' });
    return;
  }

  // Perform revocation
  if (targetMember.discordId) {
    revokeAndKickAsync(targetMember.discordId, targetMemberId);
  } else {
    // Member never linked Discord, just update database
    await prisma.member.update({
      where: { id: targetMemberId },
      data: {
        teamId: null,
        seatTier: null,
        subscriptionStatus: 'NONE',
      },
    });
  }

  logger.info(
    { requesterId: req.memberId, targetMemberId, teamId: requester.teamId },
    'Seat revoked'
  );

  res.status(200).json({ success: true, message: 'Seat revoked successfully' });
});

/**
 * POST /team/seats
 * Add additional seats mid-subscription with immediate prorated charge.
 * Only accessible by team members with OWNER seatTier.
 */
teamDashboardRouter.post('/seats', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const validation = addSeatsSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ error: 'Invalid request', details: validation.error.issues });
    return;
  }

  const { seatType, quantity } = validation.data;

  // Get requester and verify ownership
  const requester = await prisma.member.findUnique({
    where: { id: req.memberId },
    include: { team: true },
  });

  if (!requester?.team) {
    res.status(404).json({ error: 'Not part of a team' });
    return;
  }

  if (requester.seatTier !== 'OWNER') {
    res.status(403).json({ error: 'Only team owners can add seats' });
    return;
  }

  if (!requester.team.stripeSubscriptionId) {
    res.status(400).json({ error: 'No active subscription' });
    return;
  }

  // Determine which price ID to update
  const priceId = seatType === 'owner'
    ? env.STRIPE_OWNER_SEAT_PRICE_ID
    : env.STRIPE_TEAM_SEAT_PRICE_ID;

  if (!priceId) {
    res.status(500).json({ error: 'Seat pricing not configured' });
    return;
  }

  try {
    // Retrieve subscription to find the subscription item
    const subscription = await stripe.subscriptions.retrieve(
      requester.team.stripeSubscriptionId
    );

    const item = subscription.items.data.find(i => i.price.id === priceId);

    if (!item) {
      res.status(400).json({ error: `No ${seatType} seat item on subscription` });
      return;
    }

    // Update quantity with immediate proration
    // Per RESEARCH.md: proration_behavior: 'always_invoice' charges immediately
    const updatedItem = await stripe.subscriptionItems.update(item.id, {
      quantity: (item.quantity ?? 0) + quantity,
      proration_behavior: 'always_invoice',
    });

    // Note: Database update happens via webhook (customer.subscription.updated)
    // This ensures Stripe is source of truth

    logger.info(
      {
        teamId: requester.team.id,
        seatType,
        previousQuantity: item.quantity,
        newQuantity: updatedItem.quantity,
        addedQuantity: quantity,
      },
      'Seats added mid-subscription'
    );

    res.json({
      success: true,
      seatType,
      previousQuantity: item.quantity,
      newQuantity: updatedItem.quantity,
      addedQuantity: quantity,
    });
  } catch (error) {
    logger.error({ error, teamId: requester.team.id }, 'Failed to add seats');
    res.status(500).json({ error: 'Failed to add seats. Please try again.' });
  }
});
