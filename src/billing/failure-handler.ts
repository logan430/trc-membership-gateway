import Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';
import { sendPaymentFailedDm, sendTeamPaymentFailedDm } from './notifications.js';

const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

/**
 * Handle invoice.payment_failed webhook event
 * Starts grace period and sends immediate notifications
 * @param invoice - Stripe invoice object from webhook
 */
export async function handlePaymentFailure(invoice: Stripe.Invoice): Promise<void> {
  // Only process subscription renewal failures (not checkout failures)
  if (invoice.billing_reason !== 'subscription_cycle') {
    logger.debug(
      { invoiceId: invoice.id, billingReason: invoice.billing_reason },
      'Ignoring non-renewal payment failure'
    );
    return;
  }

  const customerId = invoice.customer as string;

  // Check if this is a team subscription by looking up the team first
  const team = await prisma.team.findUnique({
    where: { stripeCustomerId: customerId },
    include: { members: true },
  });

  if (team) {
    // This is a team subscription failure
    await handleTeamPaymentFailure(team, invoice);
    return;
  }

  // Individual subscription - find member by stripeCustomerId
  const member = await prisma.member.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!member) {
    logger.warn({ customerId, invoiceId: invoice.id }, 'No member found for failed payment');
    return;
  }

  // Check if member is in a team (shouldn't happen for individual billing but safety check)
  if (member.teamId) {
    logger.warn(
      { memberId: member.id, teamId: member.teamId },
      'Member has teamId but no team found by customerId - billing mismatch'
    );
    return;
  }

  // Check if grace period already started (don't reset on retry failures)
  if (member.paymentFailedAt) {
    logger.info(
      { memberId: member.id, paymentFailedAt: member.paymentFailedAt },
      'Payment failure already recorded, grace period not reset'
    );
    return;
  }

  // First failure - start grace period
  const now = new Date();
  const gracePeriodEndsAt = new Date(now.getTime() + GRACE_PERIOD_MS);

  await prisma.member.update({
    where: { id: member.id },
    data: {
      paymentFailedAt: now,
      gracePeriodEndsAt,
      subscriptionStatus: 'PAST_DUE',
      sentBillingNotifications: { push: 'immediate' },
    },
  });

  // Send immediate DM notification
  await sendPaymentFailedDm(member.id, 'immediate');

  logger.info(
    { memberId: member.id, gracePeriodEndsAt },
    'Payment failure recorded, grace period started'
  );
}

/**
 * Handle payment failure for team subscriptions
 * All team members enter grace period together
 * @param team - Team with members included
 * @param invoice - Stripe invoice object from webhook
 */
export async function handleTeamPaymentFailure(
  team: Awaited<ReturnType<typeof prisma.team.findUnique>> & { members: Array<{ id: string; discordId: string | null; isPrimaryOwner: boolean; isTeamAdmin: boolean }> },
  invoice: Stripe.Invoice
): Promise<void> {
  // Check if grace period already started
  if (team.paymentFailedAt) {
    logger.info(
      { teamId: team.id, paymentFailedAt: team.paymentFailedAt },
      'Team payment failure already recorded, grace period not reset'
    );
    return;
  }

  // First failure - start grace period for team and all members
  const now = new Date();
  const gracePeriodEndsAt = new Date(now.getTime() + GRACE_PERIOD_MS);

  // Use transaction to atomically update team and all members
  await prisma.$transaction(async (tx) => {
    // Update team billing state
    await tx.team.update({
      where: { id: team.id },
      data: {
        paymentFailedAt: now,
        gracePeriodEndsAt,
        subscriptionStatus: 'PAST_DUE',
      },
    });

    // Update all team members
    for (const member of team.members) {
      await tx.member.update({
        where: { id: member.id },
        data: {
          paymentFailedAt: now,
          gracePeriodEndsAt,
          subscriptionStatus: 'PAST_DUE',
          sentBillingNotifications: { push: 'immediate' },
        },
      });
    }
  });

  // Send notifications to all team members (outside transaction)
  for (const member of team.members) {
    if (member.discordId) {
      // Owner (isPrimaryOwner or isTeamAdmin) gets full billing details
      const isOwner = member.isPrimaryOwner || member.isTeamAdmin;
      await sendTeamPaymentFailedDm(member.id, isOwner);
    }
  }

  logger.info(
    { teamId: team.id, memberCount: team.members.length, gracePeriodEndsAt },
    'Team payment failure recorded, all members notified'
  );
}
