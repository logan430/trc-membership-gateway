import pRetry from 'p-retry';
import { discordClient } from '../bot/client.js';
import { addRoleToMember, removeAllManagedRoles } from '../bot/roles.js';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';

// 30 days in milliseconds
const DEBTOR_STATE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Move a member to Debtor state after grace period expiry
 * - Stores previous role before any changes
 * - Updates database first (before role changes)
 * - Removes all managed roles and adds Debtor role
 * - Sends notification DM
 */
export async function moveToDebtorState(memberId: string): Promise<void> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    logger.warn({ memberId }, 'Cannot move to Debtor state - member not found');
    return;
  }

  // If no discordId, just update database state
  if (!member.discordId) {
    const now = new Date();
    await prisma.member.update({
      where: { id: memberId },
      data: {
        previousRole: 'Knight', // Default assumption
        isInDebtorState: true,
        debtorStateEndsAt: new Date(now.getTime() + DEBTOR_STATE_DURATION_MS),
      },
    });
    logger.info({ memberId }, 'Member moved to Debtor state (no discordId)');
    return;
  }

  const guild = discordClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) {
    logger.error('Guild not found in cache');
    return;
  }

  try {
    const discordMember = await guild.members.fetch(member.discordId);

    // CRITICAL: Determine previous role BEFORE any changes
    const hasLordRole = discordMember.roles.cache.some((r) => r.name === 'Lord');
    const previousRole = hasLordRole ? 'Lord' : 'Knight';

    // Update database FIRST (before role changes)
    const now = new Date();
    await prisma.member.update({
      where: { id: memberId },
      data: {
        previousRole,
        isInDebtorState: true,
        debtorStateEndsAt: new Date(now.getTime() + DEBTOR_STATE_DURATION_MS),
      },
    });

    // Remove all managed roles
    await removeAllManagedRoles(member.discordId);

    // Add Debtor role
    await addRoleToMember(member.discordId, 'Debtor');

    // Send Debtor state notification DM
    try {
      const discordUser = await discordClient.users.fetch(member.discordId);
      await discordUser.send({
        content:
          `Thy grace period hath expired.\n\n` +
          `Thy access to The Revenue Council is now restricted to the #billing-support channel ` +
          `until thy payment matter is resolved.\n\n` +
          `Visit thy Stripe billing portal to update thy payment details.\n\n` +
          `The Council awaits thy return to full standing.`,
      });
      logger.info({ memberId }, 'Debtor state DM sent');
    } catch {
      logger.warn({ memberId }, 'Failed to send Debtor state DM');
    }

    logger.info({ memberId, previousRole }, 'Member moved to Debtor state');
  } catch (error) {
    logger.error({ memberId, error }, 'Failed to move member to Debtor state');
  }
}

/**
 * Move all team members to Debtor state when team's grace period expires
 */
export async function moveTeamToDebtorState(teamId: string): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });

  if (!team) {
    logger.warn({ teamId }, 'Cannot move team to Debtor state - team not found');
    return;
  }

  // Update team debtor state tracking
  const now = new Date();
  await prisma.team.update({
    where: { id: teamId },
    data: {
      debtorStateEndsAt: new Date(now.getTime() + DEBTOR_STATE_DURATION_MS),
    },
  });

  // Move each team member with discordId to Debtor state
  for (const member of team.members) {
    if (member.discordId) {
      await moveToDebtorState(member.id);
    } else {
      // Update database for members without discordId
      await prisma.member.update({
        where: { id: member.id },
        data: {
          previousRole: member.seatTier === 'OWNER' ? 'Lord' : 'Knight',
          isInDebtorState: true,
          debtorStateEndsAt: new Date(now.getTime() + DEBTOR_STATE_DURATION_MS),
        },
      });
    }
  }

  logger.info({ teamId, memberCount: team.members.length }, 'Team moved to Debtor state');
}

/**
 * Kick member after 30-day Debtor state expiry
 * - Sends farewell DM with Debtor-specific message
 * - Removes all roles and kicks from server
 * - Clears all billing failure fields
 * - Sets subscription status to CANCELLED
 */
export async function kickAfterDebtorExpiry(memberId: string): Promise<void> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member) {
    logger.warn({ memberId }, 'Cannot kick after Debtor expiry - member not found');
    return;
  }

  const guild = discordClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) {
    logger.error('Guild not found in cache');
    return;
  }

  // Handle member with discordId
  if (member.discordId) {
    try {
      const discordMember = await guild.members.fetch(member.discordId);

      // Send farewell DM (best effort, before kick)
      try {
        await discordMember.user.send({
          content:
            `Hail, former member of The Revenue Council!\n\n` +
            `Thy billing matter hath remained unresolved for 30 days. ` +
            `As such, thy access to the guild hath ended.\n\n` +
            `Should thy circumstances change, The Gatekeeper awaits: ${env.APP_URL}\n\n` +
            `We hope to see thee return in better times.`,
        });
      } catch {
        logger.debug({ memberId }, 'Could not send Debtor expiry DM');
      }

      // Remove all managed roles
      await removeAllManagedRoles(member.discordId);

      // Kick from server with retry
      await pRetry(() => discordMember.kick('Billing failure - 30 day limit reached'), {
        retries: 3,
        minTimeout: 1000,
        onFailedAttempt: (error) => {
          logger.warn(
            { memberId, attempt: error.attemptNumber },
            'Debtor expiry kick retry'
          );
        },
      });

      logger.info({ memberId }, 'Member kicked after Debtor expiry');
    } catch (error) {
      // Member may have already left
      logger.debug({ memberId, error }, 'Could not kick member after Debtor expiry');
    }
  }

  // Update database: clear all billing failure fields, set status to CANCELLED
  await prisma.member.update({
    where: { id: memberId },
    data: {
      subscriptionStatus: 'CANCELLED',
      paymentFailedAt: null,
      gracePeriodEndsAt: null,
      debtorStateEndsAt: null,
      previousRole: null,
      isInDebtorState: false,
      sentBillingNotifications: [],
      introCompleted: false,
    },
  });
}

/**
 * Kick all team members after 30-day Debtor state expiry
 * - Kicks all team members
 * - Invalidates all pending invites for the team
 * - Updates team subscription status to CANCELLED
 */
export async function kickTeamAfterDebtorExpiry(teamId: string): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true, pendingInvites: true },
  });

  if (!team) {
    logger.warn({ teamId }, 'Cannot kick team after Debtor expiry - team not found');
    return;
  }

  // Kick all team members
  for (const member of team.members) {
    await kickAfterDebtorExpiry(member.id);
  }

  // Invalidate all pending invites for the team
  // Mark them as "accepted" with a special indicator so they can't be used
  await prisma.pendingInvite.deleteMany({
    where: {
      teamId,
      acceptedAt: null, // Only delete unclaimed invites
    },
  });

  // Update team subscription status to CANCELLED and clear billing failure fields
  await prisma.team.update({
    where: { id: teamId },
    data: {
      subscriptionStatus: 'CANCELLED',
      paymentFailedAt: null,
      gracePeriodEndsAt: null,
      debtorStateEndsAt: null,
    },
  });

  logger.info(
    { teamId, memberCount: team.members.length },
    'Team kicked after Debtor expiry, invites invalidated'
  );
}
