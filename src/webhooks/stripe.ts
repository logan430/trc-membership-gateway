import { Router, raw } from 'express';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { removeAndKickAsync } from '../lib/role-assignment.js';
import { handlePaymentFailure } from '../billing/failure-handler.js';
import { handlePaymentRecovery } from '../billing/recovery-handler.js';
import { logger } from '../index.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

/**
 * Map Stripe subscription status to our SubscriptionStatus enum
 */
function mapStripeStatus(stripeStatus: string): 'NONE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' {
  switch (stripeStatus) {
    case 'active':
      return 'ACTIVE';
    case 'trialing':
      return 'TRIALING';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'CANCELLED';
    default:
      return 'NONE';
  }
}

export const stripeWebhookRouter = Router();

// CRITICAL: Use raw body parser ONLY for this route
// express.json() would parse the body and break signature verification
stripeWebhookRouter.post(
  '/',
  raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      logger.warn('Webhook received without signature');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;

    // Step 1: Verify signature
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ err: message }, 'Webhook signature verification failed');
      return res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
    }

    // Step 2: Check idempotency - has this event been processed?
    const existingEvent = await prisma.stripeEvent.findUnique({
      where: { eventId: event.id },
    });

    if (existingEvent) {
      logger.info({ eventId: event.id, type: event.type }, 'Duplicate event ignored');
      return res.status(200).json({ received: true, duplicate: true });
    }

    // Step 3: Record event BEFORE processing (prevents race conditions)
    await prisma.stripeEvent.create({
      data: {
        eventId: event.id,
        type: event.type,
        payload: event as unknown as Prisma.JsonObject,
      },
    });

    logger.info({ eventId: event.id, type: event.type }, 'Webhook event received');

    // Step 4: Return 200 immediately (Stripe times out after 10 seconds)
    res.status(200).json({ received: true });

    // Step 5: Process event asynchronously
    // Note: In Phase 1, we just log. Actual handlers added in later phases.
    try {
      await processStripeEvent(event);
    } catch (err) {
      // Log error but don't fail - event is already recorded
      logger.error({ eventId: event.id, err }, 'Event processing failed');
    }
  }
);

async function processStripeEvent(event: Stripe.Event): Promise<void> {
  // Phase 1: Just log the event types we care about
  // Actual processing logic will be added in Phase 3+

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      // Only handle subscription mode (not one-time payments)
      if (session.mode !== 'subscription') {
        logger.debug({ sessionId: session.id }, 'Ignoring non-subscription checkout');
        break;
      }

      // Retrieve session with expanded subscription data (includes items for seat info)
      const expandedSession = await stripe.checkout.sessions.retrieve(
        session.id,
        { expand: ['subscription', 'subscription.items'] }
      );

      const subscription = expandedSession.subscription;
      if (!subscription || typeof subscription === 'string') {
        logger.error({ sessionId: session.id }, 'No subscription on checkout session');
        break;
      }

      // Get current_period_end from first subscription item (Stripe SDK v20+ moved it from Subscription to SubscriptionItem)
      const firstItem = subscription.items?.data?.[0];
      const currentPeriodEnd = firstItem?.current_period_end
        ? new Date(firstItem.current_period_end * 1000)
        : null;

      // Check if this is a company checkout (has planType in subscription metadata)
      const planType = subscription.metadata?.planType;

      if (planType === 'company') {
        // COMPANY CHECKOUT: Team subscription
        const teamId = subscription.metadata?.teamId;
        const memberId = subscription.metadata?.memberId;

        if (!teamId || !memberId) {
          logger.error(
            { sessionId: session.id, teamId, memberId },
            'Missing teamId or memberId in company checkout metadata'
          );
          break;
        }

        // Find owner and team seat subscription items by price ID
        const ownerSeatItem = subscription.items?.data?.find(
          item => item.price.id === env.STRIPE_OWNER_SEAT_PRICE_ID
        );
        const teamSeatItem = subscription.items?.data?.find(
          item => item.price.id === env.STRIPE_TEAM_SEAT_PRICE_ID
        );

        // Update Team record with subscription details
        await prisma.team.update({
          where: { id: teamId },
          data: {
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: 'ACTIVE',
            // Sync seat counts from Stripe (source of truth)
            ownerSeatCount: ownerSeatItem?.quantity ?? 0,
            teamSeatCount: teamSeatItem?.quantity ?? 0,
          },
        });

        // Update purchaser Member record (becomes primary owner)
        await prisma.member.update({
          where: { id: memberId },
          data: {
            teamId,
            isPrimaryOwner: true,
            isTeamAdmin: true,
            seatTier: 'OWNER',
            subscriptionStatus: 'ACTIVE',
            currentPeriodEnd,
          },
        });

        logger.info(
          {
            teamId,
            memberId,
            subscriptionId: subscription.id,
            ownerSeats: ownerSeatItem?.quantity,
            teamSeats: teamSeatItem?.quantity,
          },
          'Company checkout completed, team subscription activated'
        );
      } else {
        // INDIVIDUAL CHECKOUT: Single member subscription
        const memberId = expandedSession.client_reference_id;
        if (!memberId) {
          logger.error({ sessionId: session.id }, 'Missing client_reference_id on checkout session');
          break;
        }

        // Update member subscription status
        await prisma.member.update({
          where: { id: memberId },
          data: {
            subscriptionStatus: 'ACTIVE',
            currentPeriodEnd,
          },
        });

        logger.info(
          { memberId, subscriptionId: subscription.id, currentPeriodEnd: firstItem?.current_period_end },
          'Individual checkout completed, subscription activated'
        );
      }
      break;
    }

    case 'customer.subscription.created':
      logger.info({ eventId: event.id }, 'Subscription created - handler TBD');
      break;

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;

      // Find team by subscription ID
      const team = await prisma.team.findUnique({
        where: { stripeSubscriptionId: subscription.id },
      });

      if (!team) {
        // Might be an individual subscription, check member
        const member = await prisma.member.findFirst({
          where: { stripeCustomerId: subscription.customer as string },
        });

        if (member && !member.teamId) {
          // Individual subscription update - handle period end sync
          const firstItem = subscription.items?.data?.[0];
          const currentPeriodEnd = firstItem?.current_period_end
            ? new Date(firstItem.current_period_end * 1000)
            : null;

          await prisma.member.update({
            where: { id: member.id },
            data: {
              subscriptionStatus: mapStripeStatus(subscription.status),
              currentPeriodEnd,
            },
          });

          logger.info({ memberId: member.id }, 'Individual subscription updated');
        }
        break;
      }

      // Team subscription - sync seat counts from Stripe
      const ownerItem = subscription.items.data.find(
        i => i.price.id === env.STRIPE_OWNER_SEAT_PRICE_ID
      );
      const teamItem = subscription.items.data.find(
        i => i.price.id === env.STRIPE_TEAM_SEAT_PRICE_ID
      );

      await prisma.team.update({
        where: { id: team.id },
        data: {
          subscriptionStatus: mapStripeStatus(subscription.status),
          ownerSeatCount: ownerItem?.quantity ?? team.ownerSeatCount,
          teamSeatCount: teamItem?.quantity ?? team.teamSeatCount,
        },
      });

      logger.info(
        {
          teamId: team.id,
          ownerSeats: ownerItem?.quantity,
          teamSeats: teamItem?.quantity,
          status: subscription.status,
        },
        'Team subscription updated'
      );
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;

      // Check if this is a team subscription first
      const team = await prisma.team.findUnique({
        where: { stripeSubscriptionId: subscription.id },
        include: { members: true },
      });

      if (team) {
        // Team subscription ended - remove all team members from Discord
        for (const teamMember of team.members) {
          if (teamMember.discordId) {
            removeAndKickAsync(teamMember.discordId, teamMember.id);
          } else {
            // Member without Discord - just update status
            await prisma.member.update({
              where: { id: teamMember.id },
              data: {
                subscriptionStatus: 'CANCELLED',
                introCompleted: false,
              },
            });
          }
        }

        // Update team status
        await prisma.team.update({
          where: { id: team.id },
          data: { subscriptionStatus: 'CANCELLED' },
        });

        logger.info(
          { teamId: team.id, memberCount: team.members.length },
          'Team subscription ended, all members removed'
        );
        break;
      }

      // Individual subscription handling
      const member = await prisma.member.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });

      if (!member) {
        logger.warn(
          { customerId: subscription.customer },
          'No member found for deleted subscription'
        );
        break;
      }

      if (!member.discordId) {
        // Member never linked Discord - just update status
        await prisma.member.update({
          where: { id: member.id },
          data: { subscriptionStatus: 'CANCELLED' },
        });
        logger.info(
          { memberId: member.id },
          'Subscription cancelled (no Discord linked)'
        );
        break;
      }

      // Remove roles and kick (async with retry)
      removeAndKickAsync(member.discordId, member.id);

      logger.info(
        { memberId: member.id, discordId: member.discordId },
        'Subscription ended, member will be removed from server'
      );
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentFailure(invoice);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentRecovery(invoice);
      break;
    }

    default:
      logger.debug({ eventId: event.id, type: event.type }, 'Unhandled event type');
  }
}
