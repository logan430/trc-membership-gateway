import { Router, Response } from 'express';
import Stripe from 'stripe';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../index.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
export const checkoutRouter = Router();

/**
 * POST /checkout
 * Create a Stripe Checkout session for Individual Monthly subscription
 * Requires authentication
 */
checkoutRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
  });

  if (!member?.stripeCustomerId) {
    res.status(400).json({ error: 'Account not configured for payment' });
    return;
  }

  if (member.subscriptionStatus === 'ACTIVE') {
    res.status(400).json({ error: 'Already subscribed' });
    return;
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: member.stripeCustomerId,
    client_reference_id: member.id,
    line_items: [{
      price: env.STRIPE_INDIVIDUAL_PRICE_ID,
      quantity: 1,
    }],
    success_url: `${env.APP_URL}/dashboard?checkout=success`,
    cancel_url: `${env.APP_URL}/dashboard?checkout=cancel`,
  });

  logger.info({ memberId: member.id, sessionId: session.id }, 'Checkout session created');
  res.json({ checkoutUrl: session.url });
});
