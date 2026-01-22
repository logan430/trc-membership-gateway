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

/**
 * GET /billing/details
 * Returns billing information for the authenticated member
 * - Team members get a "managed by team" response
 * - Owners/individuals get subscription, payment method, and invoice info
 */
billingRouter.get('/details', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const member = await prisma.member.findUnique({
      where: { id: req.memberId },
      include: { team: true },
    });

    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // Team members see limited info - billing is managed by owner
    if (member.seatTier === 'TEAM_MEMBER') {
      res.json({
        managedBy: 'team',
        teamName: member.team?.name ?? null,
        canManageBilling: false,
      });
      return;
    }

    // Determine the correct Stripe customer ID
    // Owners use their team's customer ID, individuals use their own
    const stripeCustomerId = member.teamId && member.team
      ? member.team.stripeCustomerId
      : member.stripeCustomerId;

    // No Stripe customer - return empty billing info
    if (!stripeCustomerId) {
      res.json({
        subscription: null,
        paymentMethod: null,
        invoices: [],
        canManageBilling: false,
      });
      return;
    }

    // Retrieve Stripe customer with expanded payment method
    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    });

    // Check if customer was deleted in Stripe
    if (customer.deleted) {
      res.json({
        subscription: null,
        paymentMethod: null,
        invoices: [],
        canManageBilling: false,
      });
      return;
    }

    // Get subscription details
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 1,
      status: 'all',
      expand: ['data.items.data.price'],
    });
    const subscription = subscriptions.data[0];

    // Get recent invoices
    const invoicesResponse = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 10,
    });

    // Extract payment method from customer
    const pm = customer.invoice_settings?.default_payment_method;
    const paymentMethod = pm && typeof pm !== 'string' && pm.card ? {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    } : null;

    // Build subscription info
    // Get current_period_end from first subscription item (Stripe SDK v20+ moved it from Subscription to SubscriptionItem)
    const firstItem = subscription?.items.data[0];
    const subscriptionInfo = subscription ? {
      status: subscription.status,
      currentPeriodEnd: firstItem?.current_period_end
        ? new Date(firstItem.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      planName: firstItem?.price?.nickname || 'Subscription',
    } : null;

    // Build invoice list
    const invoices = invoicesResponse.data.map(inv => ({
      id: inv.id,
      date: new Date(inv.created * 1000),
      amount: inv.total / 100,
      status: inv.status,
      pdfUrl: inv.invoice_pdf,
      hostedUrl: inv.hosted_invoice_url,
    }));

    logger.debug({ memberId: req.memberId }, 'Billing details retrieved');
    res.json({
      subscription: subscriptionInfo,
      paymentMethod,
      invoices,
      canManageBilling: true,
    });
  } catch (error) {
    logger.error({ memberId: req.memberId, error }, 'Failed to retrieve billing details');
    res.status(500).json({ error: 'Failed to retrieve billing details' });
  }
});
