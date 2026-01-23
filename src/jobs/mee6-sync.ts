/**
 * MEE6 XP Synchronization Job
 * Syncs Discord activity (via MEE6 XP) into the TRC points system
 *
 * Core responsibilities:
 * - Fetch MEE6 XP data for all TRC members with linked Discord accounts
 * - Calculate XP deltas since last sync
 * - Award/deduct points based on delta (1 point per 100 XP)
 * - Create DiscordActivity records for audit trail
 * - Handle first-sync baseline (zero delta, no points)
 * - Track consecutive failures for admin alerting
 */

import * as Sentry from '@sentry/node';
import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';
import { env } from '../config/env.js';
import { fetchAllMemberXp } from '../mee6/client.js';
import { awardDiscordPoints } from '../points/service.js';
import type { SyncResult, SyncStats } from './types.js';

// Track consecutive failures for admin alerting
let consecutiveFailures = 0;
const FAILURE_ALERT_THRESHOLD = 3;

/**
 * Generate unique sync ID for idempotency
 */
function generateSyncId(): string {
  return `mee6-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Sync MEE6 XP data for all TRC members
 *
 * Process:
 * 1. Fetch TRC members with linked Discord accounts
 * 2. Fetch MEE6 XP data for those members
 * 3. Calculate deltas and award points
 * 4. Create DiscordActivity records
 *
 * @returns SyncStats with metrics from the sync run
 */
export async function syncMee6Xp(): Promise<SyncStats> {
  const startedAt = new Date();
  const syncId = generateSyncId();

  // Early exit if disabled
  if (env.MEE6_SYNC_ENABLED !== 'true') {
    logger.info({ syncId }, 'MEE6 sync disabled, skipping');
    return {
      totalMembers: 0,
      membersInMee6: 0,
      membersNotInMee6: 0,
      pointsAwarded: 0,
      pointsDeducted: 0,
      firstSyncs: 0,
      errors: 0,
      syncId,
      startedAt,
      completedAt: new Date(),
    };
  }

  logger.info({ syncId }, 'Starting MEE6 XP sync');

  // 1. Fetch TRC members with Discord linked
  const members = await prisma.member.findMany({
    where: {
      discordId: { not: null },
    },
    select: {
      id: true,
      discordId: true,
    },
  });

  const totalMembers = members.length;

  if (totalMembers === 0) {
    logger.info({ syncId }, 'No members with Discord linked, skipping sync');
    return {
      totalMembers: 0,
      membersInMee6: 0,
      membersNotInMee6: 0,
      pointsAwarded: 0,
      pointsDeducted: 0,
      firstSyncs: 0,
      errors: 0,
      syncId,
      startedAt,
      completedAt: new Date(),
    };
  }

  // 2. Fetch MEE6 data
  const discordIds = members.map((m) => m.discordId!);
  let mee6Data: Map<string, { xp: number; level: number; messageCount: number }>;

  try {
    mee6Data = await fetchAllMemberXp(discordIds);
    // Success - reset failure count
    consecutiveFailures = 0;
  } catch (error) {
    // Increment failure count
    consecutiveFailures++;

    logger.error(
      { syncId, error: error instanceof Error ? error.message : error, consecutiveFailures },
      'MEE6 API fetch failed'
    );

    // Alert admin after threshold
    if (consecutiveFailures >= FAILURE_ALERT_THRESHOLD) {
      const errorMessage = `MEE6 sync has failed ${consecutiveFailures} consecutive times`;
      logger.error({ syncId, consecutiveFailures }, errorMessage);
      Sentry.captureException(new Error(errorMessage), {
        level: 'error',
        extra: {
          syncId,
          consecutiveFailures,
          lastError: error instanceof Error ? error.message : String(error),
        },
      });
    }

    return {
      totalMembers,
      membersInMee6: 0,
      membersNotInMee6: 0,
      pointsAwarded: 0,
      pointsDeducted: 0,
      firstSyncs: 0,
      errors: 1,
      syncId,
      startedAt,
      completedAt: new Date(),
    };
  }

  // 3. Process each member
  const results: SyncResult[] = [];
  let membersInMee6 = 0;
  let membersNotInMee6 = 0;
  let pointsAwarded = 0;
  let pointsDeducted = 0;
  let firstSyncs = 0;
  let errors = 0;

  for (const member of members) {
    try {
      const result = await processMemberSync(
        member.id,
        member.discordId!,
        mee6Data,
        syncId
      );

      results.push(result);

      if (result.xpAfter > 0) {
        membersInMee6++;
      } else if (result.isFirstSync && result.xpAfter === 0) {
        // Member not in MEE6 - created zero-XP record
        membersNotInMee6++;
      }

      if (result.isFirstSync) {
        firstSyncs++;
      }

      if (result.pointsAwarded > 0) {
        pointsAwarded += result.pointsAwarded;
      } else if (result.pointsAwarded < 0) {
        pointsDeducted += Math.abs(result.pointsAwarded);
      }
    } catch (error) {
      errors++;
      logger.error(
        { memberId: member.id, discordId: member.discordId, error: error instanceof Error ? error.message : error },
        'Error syncing member MEE6 data'
      );
    }
  }

  const completedAt = new Date();

  logger.info(
    {
      syncId,
      totalMembers,
      membersInMee6,
      membersNotInMee6,
      pointsAwarded,
      pointsDeducted,
      firstSyncs,
      errors,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    },
    'MEE6 XP sync completed'
  );

  return {
    totalMembers,
    membersInMee6,
    membersNotInMee6,
    pointsAwarded,
    pointsDeducted,
    firstSyncs,
    errors,
    syncId,
    startedAt,
    completedAt,
  };
}

/**
 * Process sync for a single member
 *
 * Logic:
 * - Get latest DiscordActivity record (most recent syncedAt)
 * - Get current XP from MEE6 map (0 if not found)
 * - Calculate delta (first sync = 0 delta)
 * - Award/deduct points if delta warrants it
 * - Create DiscordActivity record
 * - Update lastActiveAt if points awarded (positive only)
 */
async function processMemberSync(
  memberId: string,
  discordId: string,
  mee6Data: Map<string, { xp: number; level: number; messageCount: number }>,
  syncId: string
): Promise<SyncResult> {
  // Get latest DiscordActivity for this member
  const lastActivity = await prisma.discordActivity.findFirst({
    where: { memberId },
    orderBy: { syncedAt: 'desc' },
    select: { xpTotal: true },
  });

  // Get current XP from MEE6 (0 if not found)
  const mee6Entry = mee6Data.get(discordId);
  const xpAfter = mee6Entry?.xp ?? 0;

  // Determine if this is first sync
  const isFirstSync = lastActivity === null;
  const xpBefore = isFirstSync ? null : (lastActivity.xpTotal ?? 0);

  // Calculate delta
  // First sync: delta = 0 (no points, just baseline)
  // Subsequent: delta = xpAfter - xpBefore
  const xpDelta = isFirstSync ? 0 : xpAfter - (xpBefore ?? 0);

  // Create DiscordActivity record
  await prisma.discordActivity.create({
    data: {
      memberId,
      discordId,
      activityType: 'MESSAGE', // MEE6 tracks messages
      xpDelta: isFirstSync ? null : xpDelta, // null for first sync per schema
      xpTotal: xpAfter,
    },
  });

  // Award points if delta is non-zero and not first sync
  let pointsAwarded = 0;

  if (!isFirstSync && xpDelta !== 0) {
    const result = await awardDiscordPoints(memberId, xpDelta, syncId);
    if (result.awarded) {
      pointsAwarded = result.points;

      // Update lastActiveAt if points were positive
      if (pointsAwarded > 0) {
        await prisma.member.update({
          where: { id: memberId },
          data: { lastActiveAt: new Date() },
        });
      }
    }
  }

  // Calculate leftover XP (for tracking, not used in points calc yet)
  // Leftover = |xpDelta| % 100 (XP that didn't convert to a full point)
  const leftoverXp = Math.abs(xpDelta) % 100;

  logger.debug(
    {
      memberId,
      discordId,
      isFirstSync,
      xpBefore,
      xpAfter,
      xpDelta,
      pointsAwarded,
      leftoverXp,
      syncId,
    },
    'Member MEE6 sync processed'
  );

  return {
    memberId,
    discordId,
    xpBefore,
    xpAfter,
    xpDelta,
    pointsAwarded,
    leftoverXp,
    isFirstSync,
  };
}

// Re-export types for consumers
export type { SyncStats } from './types.js';
