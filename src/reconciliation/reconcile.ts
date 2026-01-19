import Stripe from 'stripe';
import cron from 'node-cron';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../index.js';
import { discordClient } from '../bot/client.js';
import { MANAGED_ROLES } from '../config/discord.js';
import { ReconciliationResult, ReconciliationOptions, DriftIssue } from './types.js';
import { detectMemberDrift, detectTeamDrift } from './drift-detector.js';
import { applyFixes } from './auto-fixer.js';
import { notifyAdmins } from './notifications.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

/**
 * Build map of Stripe customer ID to subscription
 * Iterates all subscriptions with pagination
 */
async function buildStripeSubscriptionMap(): Promise<Map<string, Stripe.Subscription>> {
  const map = new Map<string, Stripe.Subscription>();

  // Use Stripe auto-pagination
  for await (const subscription of stripe.subscriptions.list({
    limit: 100,
    status: 'all', // Include active, past_due, canceled, etc.
  })) {
    const customerId = subscription.customer as string;
    // Keep most recent subscription per customer
    const existing = map.get(customerId);
    if (!existing || subscription.created > existing.created) {
      map.set(customerId, subscription);
    }
  }

  logger.info({ count: map.size }, 'Built Stripe subscription map');
  return map;
}

/**
 * Build map of Discord user ID to managed role names
 * Fetches all guild members and filters to managed roles
 */
async function buildDiscordMemberMap(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();

  const guild = discordClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) {
    logger.error('Guild not found for reconciliation');
    return map;
  }

  // Fetch all members (fresh, not cached)
  const members = await guild.members.fetch();

  for (const [discordId, member] of members) {
    const managedRoles = member.roles.cache
      .filter(r => (MANAGED_ROLES as readonly string[]).includes(r.name))
      .map(r => r.name);

    map.set(discordId, managedRoles);
  }

  logger.info({ count: map.size }, 'Built Discord member map');
  return map;
}

/**
 * Schedule verification re-run 1 hour after fixes applied
 */
function scheduleVerificationRerun(): void {
  const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);
  const minute = oneHourLater.getMinutes();
  const hour = oneHourLater.getHours();

  logger.info({ scheduledFor: oneHourLater.toISOString() }, 'Scheduling verification re-run');

  const job = cron.schedule(
    `${minute} ${hour} * * *`,
    async () => {
      await runReconciliation({ isVerificationRerun: true, triggeredBy: 'verification' });
      job.stop(); // One-time execution
    },
    { timezone: env.RECONCILIATION_TIMEZONE }
  );
}

/**
 * Run full reconciliation: detect drift, optionally fix, notify admins
 */
export async function runReconciliation(
  options: ReconciliationOptions = {}
): Promise<ReconciliationResult> {
  const startedAt = new Date();
  const triggeredBy = options.triggeredBy ?? 'scheduled';
  const autoFixEnabled = env.RECONCILIATION_AUTO_FIX === 'true';
  const isVerificationRerun = options.isVerificationRerun ?? false;

  logger.info({ triggeredBy, autoFixEnabled, isVerificationRerun }, 'Starting reconciliation');

  // Create run record
  const run = await prisma.reconciliationRun.create({
    data: {
      triggeredBy,
      autoFixEnabled,
      isVerificationRun: isVerificationRerun,
    },
  });

  try {
    // Build data maps (parallel)
    const [stripeMap, discordMap] = await Promise.all([
      buildStripeSubscriptionMap(),
      buildDiscordMemberMap(),
    ]);

    // Get all members with Discord linked (include team for team-based checks)
    const members = await prisma.member.findMany({
      where: { discordId: { not: null } },
      include: { team: true },
    });

    // Detect drift for each member
    const allIssues: DriftIssue[] = [];
    for (const member of members) {
      const issues = detectMemberDrift(member, stripeMap, discordMap);
      allIssues.push(...issues);
    }

    // Get teams with subscription (for team-level drift detection)
    const teams = await prisma.team.findMany({
      where: { stripeSubscriptionId: { not: null } },
      include: { members: true },
    });

    for (const team of teams) {
      const issues = detectTeamDrift(team, stripeMap, discordMap);
      allIssues.push(...issues);
    }

    // Deduplicate issues (same member may appear in both member and team checks)
    const uniqueIssues = Array.from(
      new Map(allIssues.map(i => [`${i.memberId}-${i.type}`, i])).values()
    );

    // Apply fixes if enabled
    let issuesFixed = 0;
    if (autoFixEnabled && uniqueIssues.length > 0) {
      issuesFixed = await applyFixes(uniqueIssues);

      // Schedule verification re-run if fixes were applied (and this isn't already a re-run)
      if (issuesFixed > 0 && !isVerificationRerun) {
        scheduleVerificationRerun();
      }
    }

    // Update run record
    const completedAt = new Date();
    await prisma.reconciliationRun.update({
      where: { id: run.id },
      data: {
        completedAt,
        membersChecked: members.length,
        teamsChecked: teams.length,
        issuesFound: uniqueIssues.length,
        issuesFixed,
        issues: uniqueIssues as unknown as Prisma.InputJsonValue,
      },
    });

    const result: ReconciliationResult = {
      runId: run.id,
      issuesFound: uniqueIssues.length,
      issuesFixed,
      issues: uniqueIssues,
      autoFixEnabled,
    };

    // Notify admins (only if issues found)
    await notifyAdmins(result);

    const durationMs = completedAt.getTime() - startedAt.getTime();
    logger.info(
      {
        runId: run.id,
        durationMs,
        membersChecked: members.length,
        teamsChecked: teams.length,
        issuesFound: uniqueIssues.length,
        issuesFixed,
      },
      'Reconciliation complete'
    );

    return result;
  } catch (error) {
    logger.error({ runId: run.id, error }, 'Reconciliation failed');

    // Mark run as completed (with error state implied by missing completedAt? or we complete it)
    await prisma.reconciliationRun.update({
      where: { id: run.id },
      data: { completedAt: new Date() },
    });

    throw error;
  }
}
