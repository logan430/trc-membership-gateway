/**
 * Point transaction service with idempotent awarding
 * Records point transactions to the immutable ledger (PointTransaction table)
 * Member.totalPoints is updated automatically via database trigger
 */
import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';
import { getPointValue, isActionEnabled } from './config.js';
import { PointAction, type PointActionType } from './types.js';
import { logAuditEvent, AuditAction } from '../lib/audit.js';
import { discordClient } from '../bot/client.js';
import { env } from '../config/env.js';

/**
 * Result of a point award operation
 */
export interface AwardResult {
  awarded: boolean;
  points: number;
  reason?: string; // Why not awarded (e.g., "Already awarded for this category")
}

/**
 * Award points for benchmark submission
 * Per CONTEXT.md: One award per category EVER (not per submission)
 */
export async function awardBenchmarkPoints(
  memberId: string,
  category: string
): Promise<AwardResult> {
  // Check if action is enabled
  if (!(await isActionEnabled(PointAction.BENCHMARK_SUBMISSION))) {
    logger.debug({ memberId, category }, 'Benchmark points disabled');
    return { awarded: false, points: 0, reason: 'Action disabled' };
  }

  // Idempotency: Check for existing award for this category
  const existing = await prisma.pointTransaction.findFirst({
    where: {
      memberId,
      action: PointAction.BENCHMARK_SUBMISSION,
      metadata: {
        path: ['category'],
        equals: category,
      },
    },
  });

  if (existing) {
    logger.debug(
      { memberId, category },
      'Benchmark points already awarded for category'
    );
    return {
      awarded: false,
      points: 0,
      reason: `Already awarded for ${category} category`,
    };
  }

  // Get configured point value
  const points = await getPointValue(PointAction.BENCHMARK_SUBMISSION);

  // Create transaction (trigger updates Member.totalPoints)
  await prisma.pointTransaction.create({
    data: {
      memberId,
      action: PointAction.BENCHMARK_SUBMISSION,
      points,
      metadata: {
        category,
        awardedAt: new Date().toISOString(),
      },
    },
  });

  logger.info(
    { memberId, category, points },
    'Benchmark points awarded'
  );

  return { awarded: true, points };
}

/**
 * Award points for resource download
 * Per CONTEXT.md: First download only awards per resource
 */
export async function awardDownloadPoints(
  memberId: string,
  resourceId: string,
  resourceTitle: string
): Promise<AwardResult> {
  // Check if action is enabled
  if (!(await isActionEnabled(PointAction.RESOURCE_DOWNLOAD))) {
    logger.debug({ memberId, resourceId }, 'Download points disabled');
    return { awarded: false, points: 0, reason: 'Action disabled' };
  }

  // Idempotency: Check for existing award for this resource
  const existing = await prisma.pointTransaction.findFirst({
    where: {
      memberId,
      action: PointAction.RESOURCE_DOWNLOAD,
      metadata: {
        path: ['resourceId'],
        equals: resourceId,
      },
    },
  });

  if (existing) {
    logger.debug(
      { memberId, resourceId },
      'Download points already awarded for resource'
    );
    return {
      awarded: false,
      points: 0,
      reason: 'Already awarded for this resource',
    };
  }

  // Get configured point value
  const points = await getPointValue(PointAction.RESOURCE_DOWNLOAD);

  // Create transaction (trigger updates Member.totalPoints)
  await prisma.pointTransaction.create({
    data: {
      memberId,
      action: PointAction.RESOURCE_DOWNLOAD,
      points,
      metadata: {
        resourceId,
        resourceTitle,
        awardedAt: new Date().toISOString(),
      },
    },
  });

  logger.info(
    { memberId, resourceId, resourceTitle, points },
    'Download points awarded'
  );

  return { awarded: true, points };
}

/**
 * Award points for intro completion
 * One-time ever per member
 */
export async function awardIntroPoints(memberId: string): Promise<AwardResult> {
  // Check if action is enabled
  if (!(await isActionEnabled(PointAction.INTRO_COMPLETED))) {
    logger.debug({ memberId }, 'Intro points disabled');
    return { awarded: false, points: 0, reason: 'Action disabled' };
  }

  // Idempotency: Check for ANY existing intro points for this member
  const existing = await prisma.pointTransaction.findFirst({
    where: {
      memberId,
      action: PointAction.INTRO_COMPLETED,
    },
  });

  if (existing) {
    logger.debug({ memberId }, 'Intro points already awarded');
    return {
      awarded: false,
      points: 0,
      reason: 'Already awarded for introduction',
    };
  }

  // Get configured point value
  const points = await getPointValue(PointAction.INTRO_COMPLETED);

  // Create transaction (trigger updates Member.totalPoints)
  await prisma.pointTransaction.create({
    data: {
      memberId,
      action: PointAction.INTRO_COMPLETED,
      points,
      metadata: {
        awardedAt: new Date().toISOString(),
      },
    },
  });

  logger.info({ memberId, points }, 'Intro points awarded');

  return { awarded: true, points };
}

/**
 * Award points for Discord activity
 * Points calculated as: floor(xpDelta / 100) * pointValue
 * Idempotency via syncId to prevent duplicate sync processing
 */
export async function awardDiscordPoints(
  memberId: string,
  xpDelta: number,
  syncId: string
): Promise<AwardResult> {
  // Check if action is enabled
  if (!(await isActionEnabled(PointAction.DISCORD_ACTIVITY))) {
    logger.debug({ memberId, xpDelta, syncId }, 'Discord points disabled');
    return { awarded: false, points: 0, reason: 'Action disabled' };
  }

  // Get configured point value (per 100 XP)
  const pointsPerUnit = await getPointValue(PointAction.DISCORD_ACTIVITY);

  // Calculate points: floor(xpDelta / 100) * pointValue
  const units = Math.floor(xpDelta / 100);
  const points = units * pointsPerUnit;

  // If calculated points <= 0, return early (no award for small deltas)
  if (points <= 0) {
    logger.debug(
      { memberId, xpDelta, syncId, points },
      'Discord XP delta too small for points'
    );
    return {
      awarded: false,
      points: 0,
      reason: 'XP delta too small to award points',
    };
  }

  // Idempotency: Check for existing transaction with this syncId
  const existing = await prisma.pointTransaction.findFirst({
    where: {
      memberId,
      action: PointAction.DISCORD_ACTIVITY,
      metadata: {
        path: ['syncId'],
        equals: syncId,
      },
    },
  });

  if (existing) {
    logger.debug({ memberId, syncId }, 'Discord points already awarded for sync');
    return {
      awarded: false,
      points: 0,
      reason: 'Already processed this sync',
    };
  }

  // Create transaction (trigger updates Member.totalPoints)
  await prisma.pointTransaction.create({
    data: {
      memberId,
      action: PointAction.DISCORD_ACTIVITY,
      points,
      metadata: {
        xpDelta,
        syncId,
        awardedAt: new Date().toISOString(),
      },
    },
  });

  logger.info(
    { memberId, xpDelta, syncId, points },
    'Discord activity points awarded'
  );

  return { awarded: true, points };
}

/**
 * Admin adjustment of points
 * No enable check - admin adjustments always work
 * Points can be positive or negative
 */
export async function adminAdjustPoints(params: {
  memberId: string;
  points: number;
  reason?: string;
  notifyMember: boolean;
  adminId: string;
}): Promise<void> {
  const { memberId, points, reason, notifyMember, adminId } = params;

  // Get current total for audit log
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { totalPoints: true, discordId: true },
  });

  const previousTotal = member?.totalPoints ?? 0;
  const newTotal = previousTotal + points;

  // Create transaction (trigger updates Member.totalPoints)
  await prisma.pointTransaction.create({
    data: {
      memberId,
      action: PointAction.ADMIN_ADJUSTMENT,
      points,
      metadata: {
        reason: reason ?? null,
        adminId,
        notifyMember,
        adjustedAt: new Date().toISOString(),
      },
    },
  });

  // Log audit event
  await logAuditEvent({
    action: AuditAction.POINTS_ADJUSTED,
    entityType: 'Member',
    entityId: memberId,
    details: {
      points,
      reason: reason ?? null,
      notifyMember,
      previousTotal,
      newTotal,
    },
    performedBy: adminId,
    reason,
  });

  logger.info(
    { memberId, points, reason, adminId, previousTotal, newTotal },
    'Admin adjusted member points'
  );

  // If notifyMember is true, queue Discord DM notification (fire-and-forget pattern)
  if (notifyMember && member?.discordId) {
    sendPointsNotification(member.discordId, points, reason).catch((err) => {
      logger.debug(
        { error: err, discordId: member.discordId },
        'Failed to send points notification DM'
      );
    });
  }
}

/**
 * Send points notification DM to member
 * Fire-and-forget - errors are logged but not thrown
 */
async function sendPointsNotification(
  discordId: string,
  points: number,
  reason?: string
): Promise<void> {
  const guild = discordClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) {
    logger.debug({ discordId }, 'Guild not found for points notification');
    return;
  }

  try {
    const member = await guild.members.fetch(discordId);
    const direction = points >= 0 ? 'added' : 'removed';
    const absPoints = Math.abs(points);

    let message = `Your points have been ${direction} by an administrator.\n\n`;
    message += `**${direction === 'added' ? '+' : '-'}${absPoints} points**\n`;
    if (reason) {
      message += `\nReason: ${reason}`;
    }

    await member.send({ content: message });
    logger.debug({ discordId, points }, 'Points notification DM sent');
  } catch (err) {
    // User may have DMs disabled or not be in guild
    logger.debug(
      { error: err, discordId },
      'Could not send points notification DM'
    );
  }
}
