import { Router, Response } from 'express';
import Stripe from 'stripe';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../index.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);
export const billingRouter = Router();

/**
 * POST /billing/portal
 * Create a Stripe billing portal session for the authenticated user
 * - Individual members use their own stripeCustomerId
 * - Team members use their team's stripeCustomerId
 */
billingRouter.post('/portal', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const member = await prisma.member.findUnique({
      where: { id: req.memberId },
      include: { team: true },
    });

    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // Determine the correct Stripe customer ID
    // Team members use their team's customer ID, individuals use their own
    let stripeCustomerId: string | null = null;
    if (member.teamId && member.team) {
      stripeCustomerId = member.team.stripeCustomerId;
    } else {
      stripeCustomerId = member.stripeCustomerId;
    }

    if (!stripeCustomerId) {
      res.status(400).json({ error: 'No billing account configured' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${env.APP_URL}/app/dashboard`,
    });

    logger.info({ memberId: req.memberId }, 'Billing portal session created');
    res.json({ portalUrl: session.url });
  } catch (error) {
    logger.error({ memberId: req.memberId, error }, 'Failed to create billing portal session');
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});
