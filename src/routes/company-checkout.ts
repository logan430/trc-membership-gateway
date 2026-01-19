import { Router, Response } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../index.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
export const companyCheckoutRouter = Router();

// Request body validation schema
const companyCheckoutSchema = z.object({
  ownerSeats: z.number().int().min(1, 'At least 1 owner seat required'),
  teamSeats: z.number().int().min(0, 'Team seats cannot be negative'),
  companyName: z.string().min(3, 'Company name must be at least 3 characters').max(100, 'Company name must be 100 characters or less'),
});

/**
 * POST /company/checkout
 * Create a Team record and Stripe Checkout session for Company subscription
 * Requires authentication
 */
companyCheckoutRouter.post('/checkout', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Validate request body
  const parseResult = companyCheckoutSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.issues[0].message });
    return;
  }

  const { ownerSeats, teamSeats, companyName } = parseResult.data;

  // Check price IDs are configured
  if (!env.STRIPE_OWNER_SEAT_PRICE_ID || !env.STRIPE_TEAM_SEAT_PRICE_ID) {
    logger.error('Company checkout attempted but seat price IDs not configured');
    res.status(500).json({ error: 'Company checkout not configured' });
    return;
  }

  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
  });

  if (!member?.stripeCustomerId) {
    res.status(400).json({ error: 'Account not configured for payment' });
    return;
  }

  // Check user doesn't already have active subscription
  if (member.subscriptionStatus === 'ACTIVE') {
    res.status(400).json({ error: 'You already have an active subscription' });
    return;
  }

  // Check user doesn't already belong to a team
  if (member.teamId) {
    res.status(400).json({ error: 'You are already a member of a team' });
    return;
  }

  // Create Team record BEFORE checkout session (prevents webhook race condition per RESEARCH.md)
  const team = await prisma.team.create({
    data: {
      name: companyName,
      stripeCustomerId: member.stripeCustomerId,
      ownerSeatCount: ownerSeats,
      teamSeatCount: teamSeats,
    },
  });

  logger.info({ teamId: team.id, memberId: member.id, companyName }, 'Team record created for checkout');

  // Create Stripe checkout session with multi-line items
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: member.stripeCustomerId,
    client_reference_id: team.id, // Reference team, not member
    custom_fields: [{
      key: 'company_name',
      label: { type: 'custom', custom: 'Company Name' },
      type: 'text',
      text: {
        default_value: companyName,
      },
    }],
    line_items: [
      {
        price: env.STRIPE_OWNER_SEAT_PRICE_ID,
        quantity: ownerSeats,
      },
      {
        price: env.STRIPE_TEAM_SEAT_PRICE_ID,
        quantity: teamSeats,
      },
    ],
    subscription_data: {
      metadata: {
        teamId: team.id,
        planType: 'company',
        memberId: member.id,
      },
    },
    success_url: `${env.APP_URL}/team/dashboard?checkout=success`,
    cancel_url: `${env.APP_URL}/company?checkout=cancel`,
  });

  logger.info(
    { teamId: team.id, memberId: member.id, sessionId: session.id, ownerSeats, teamSeats },
    'Company checkout session created'
  );

  res.json({ checkoutUrl: session.url });
});
