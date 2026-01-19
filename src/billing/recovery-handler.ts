import Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';
import { addRoleToMember, removeRoleFromMember } from '../bot/roles.js';
import {
  sendGracePeriodRecoveryDm,
  sendDebtorRecoveryDm,
  sendTeamRecoveryDm,
} from './notifications.js';
import { sendPaymentRecoveredEmail } from '../email/send.js';

/**
 * Restore a member from Debtor state to their previous role
 * @param memberId - Database member ID
 * @param discordId - Discord user ID
 * @param previousRole - Role to restore (from database)
 * @returns The role name that was restored
 */
async function restoreFromDebtorState(
  memberId: string,
  discordId: string,
  previousRole: string | null
): Promise<string> {
  // Default to Knight if no previous role stored
  const roleToRestore = previousRole ?? 'Knight';

  // Remove Debtor role
  await removeRoleFromMember(discordId, 'Debtor');

  // Add previous role back
  await addRoleToMember(discordId, roleToRestore);

  logger.info(
    { memberId, discordId, roleToRestore },
    'Restored member from Debtor state'
  );

  return roleToRestore;
}

/**
 * Handle invoice.paid webhook event for payment recovery
 * Detects successful payment after failure and restores access
 * @param invoice - Stripe invoice object from webhook
 */
export async function handlePaymentRecovery(invoice: Stripe.Invoice): Promise<void> {
  // Only process subscription renewal payments (not checkout payments)
  if (invoice.billing_reason !== 'subscription_cycle') {
    logger.debug(
      { invoiceId: invoice.id, billingReason: invoice.billing_reason },
      'Ignoring non-renewal payment success'
    );
    return;
  }

  const customerId = invoice.customer as string;

  // Check if this is a team subscription by looking up the team first
  const team = await prisma.team.findUnique({
    where: { stripeCustomerId: customerId },
    include: {
      members: {
        select: {
          id: true,
          email: true,
          discordId: true,
          isInDebtorState: true,
          previousRole: true,
          isPrimaryOwner: true,
          isTeamAdmin: true,
          paymentFailedAt: true,
        },
      },
    },
  });

  if (team) {
    // Check if team was in billing failure state
    if (!team.paymentFailedAt) {
      logger.debug(
        { teamId: team.id, invoiceId: invoice.id },
        'Team payment success but no prior failure - normal renewal'
      );
      return;
    }

    // Team payment recovery
    await handleTeamPaymentRecovery(team, invoice);
    return;
  }

  // Individual subscription - find member by stripeCustomerId
  const member = await prisma.member.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!member) {
    logger.warn({ customerId, invoiceId: invoice.id }, 'No member found for payment success');
    return;
  }

  // Check if member was in billing failure state
  if (!member.paymentFailedAt) {
    logger.debug(
      { memberId: member.id, invoiceId: invoice.id },
      'Payment success but no prior failure - normal renewal'
    );
    return;
  }

  // Check if member is in a team (delegate to team handler)
  if (member.teamId) {
    logger.debug(
      { memberId: member.id, teamId: member.teamId },
      'Member in team but team not found by customerId - skipping individual recovery'
    );
    return;
  }

  // Individual recovery
  logger.info(
    { memberId: member.id, isInDebtorState: member.isInDebtorState },
    'Processing individual payment recovery'
  );

  const wasInDebtorState = member.isInDebtorState;

  if (wasInDebtorState && member.discordId) {
    // Restore from Debtor state
    const restoredRole = await restoreFromDebtorState(
      member.id,
      member.discordId,
      member.previousRole
    );

    // Send recovery DM
    await sendDebtorRecoveryDm(member.id, restoredRole);
  } else if (member.discordId) {
    // Grace period recovery - no role changes needed
    await sendGracePeriodRecoveryDm(member.id);
  }

  // Send payment recovered email (fire and forget)
  if (member.email) {
    sendPaymentRecoveredEmail(member.email, wasInDebtorState).catch((err) => {
      logger.error({ memberId: member.id, err }, 'Failed to send payment recovered email');
    });
  }

  // Clear all billing failure state
  await prisma.member.update({
    where: { id: member.id },
    data: {
      paymentFailedAt: null,
      gracePeriodEndsAt: null,
      debtorStateEndsAt: null,
      previousRole: null,
      isInDebtorState: false,
      sentBillingNotifications: [],
      subscriptionStatus: 'ACTIVE',
    },
  });

  logger.info({ memberId: member.id }, 'Individual payment recovery complete');
}

/**
 * Handle payment recovery for team subscriptions
 * All team members are restored together
 * @param team - Team with members included
 * @param invoice - Stripe invoice object from webhook
 */
export async function handleTeamPaymentRecovery(
  team: {
    id: string;
    paymentFailedAt: Date | null;
    members: Array<{
      id: string;
      email: string | null;
      discordId: string | null;
      isInDebtorState: boolean;
      previousRole: string | null;
      isPrimaryOwner: boolean;
      isTeamAdmin: boolean;
      paymentFailedAt: Date | null;
    }>;
  },
  invoice: Stripe.Invoice
): Promise<void> {
  logger.info(
    { teamId: team.id, memberCount: team.members.length },
    'Processing team payment recovery'
  );

  // Process each team member
  for (const member of team.members) {
    if (!member.discordId) {
      // Member without Discord - just clear billing state
      await prisma.member.update({
        where: { id: member.id },
        data: {
          paymentFailedAt: null,
          gracePeriodEndsAt: null,
          debtorStateEndsAt: null,
          previousRole: null,
          isInDebtorState: false,
          sentBillingNotifications: [],
          subscriptionStatus: 'ACTIVE',
        },
      });
      continue;
    }

    const isOwner = member.isPrimaryOwner || member.isTeamAdmin;
    let restoredRole: string | undefined;

    if (member.isInDebtorState) {
      // Restore from Debtor state
      restoredRole = await restoreFromDebtorState(
        member.id,
        member.discordId,
        member.previousRole
      );
    }

    // Send appropriate recovery DM
    if (member.isInDebtorState) {
      await sendTeamRecoveryDm(member.id, isOwner, restoredRole);
    } else {
      // Grace period recovery
      await sendTeamRecoveryDm(member.id, isOwner);
    }

    // Send payment recovered email to owners only (fire and forget)
    if (isOwner && member.email) {
      sendPaymentRecoveredEmail(member.email, member.isInDebtorState).catch((err) => {
        logger.error({ memberId: member.id, err }, 'Failed to send team payment recovered email');
      });
    }

    // Clear member billing failure state
    await prisma.member.update({
      where: { id: member.id },
      data: {
        paymentFailedAt: null,
        gracePeriodEndsAt: null,
        debtorStateEndsAt: null,
        previousRole: null,
        isInDebtorState: false,
        sentBillingNotifications: [],
        subscriptionStatus: 'ACTIVE',
      },
    });
  }

  // Clear team billing failure state
  await prisma.team.update({
    where: { id: team.id },
    data: {
      paymentFailedAt: null,
      gracePeriodEndsAt: null,
      debtorStateEndsAt: null,
      subscriptionStatus: 'ACTIVE',
    },
  });

  logger.info(
    { teamId: team.id, memberCount: team.members.length },
    'Team payment recovery complete'
  );
}
