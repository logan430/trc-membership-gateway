import { Router, raw } from 'express';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

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
    case 'checkout.session.completed':
      logger.info({ eventId: event.id }, 'Checkout completed - handler TBD');
      break;

    case 'customer.subscription.created':
      logger.info({ eventId: event.id }, 'Subscription created - handler TBD');
      break;

    case 'customer.subscription.updated':
      logger.info({ eventId: event.id }, 'Subscription updated - handler TBD');
      break;

    case 'customer.subscription.deleted':
      logger.info({ eventId: event.id }, 'Subscription deleted - handler TBD');
      break;

    case 'invoice.payment_failed':
      logger.info({ eventId: event.id }, 'Payment failed - handler TBD');
      break;

    case 'invoice.payment_succeeded':
      logger.info({ eventId: event.id }, 'Payment succeeded - handler TBD');
      break;

    default:
      logger.debug({ eventId: event.id, type: event.type }, 'Unhandled event type');
  }
}
