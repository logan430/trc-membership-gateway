/**
 * Daily Streak Calculator
 * Calculates and updates member engagement streaks
 *
 * Core logic:
 * - Streak continues if member was active on the previous weekday
 * - Weekday-only: Monday through Friday required
 * - Saturday/Sunday are automatic grace days
 * - Active = any point-earning action (Discord, benchmarks, downloads)
 * - lastActiveAt is updated by points service when points awarded
 */

import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';
import type { StreakStats } from './types.js';

/**
 * Check if a date falls on a weekday (Mon-Fri)
 * Monday = 1, Friday = 5
 */
function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

/**
 * Get the expected "last active" date for streak continuation
 *
 * Logic:
 * - Start with yesterday
 * - Skip backwards over weekends to find last weekday
 * - Return that date at midnight UTC
 *
 * Examples (running at 00:05 UTC):
 * - Monday: expected = Friday (skip weekend)
 * - Tuesday: expected = Monday
 * - Saturday: expected = Friday
 */
function getExpectedActiveDate(today: Date): Date {
  // Clone today and subtract one day
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  // Skip backwards over weekends
  while (!isWeekday(yesterday)) {
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  }

  // Return at midnight UTC
  yesterday.setUTCHours(0, 0, 0, 0);
  return yesterday;
}

/**
 * Check if member's last active date meets streak requirement
 *
 * @param lastActiveAt - Member's last activity timestamp
 * @param expectedDate - The date they needed to be active on
 * @returns true if streak should continue, false if broken
 */
function isStreakValid(lastActiveAt: Date | null, expectedDate: Date): boolean {
  if (!lastActiveAt) {
    return false; // Never active = no streak
  }

  // Member's last active date at midnight UTC
  const lastActiveDay = new Date(lastActiveAt);
  lastActiveDay.setUTCHours(0, 0, 0, 0);

  // Streak continues if lastActiveAt >= expectedDate (at midnight)
  // This means they were active on or after the expected weekday
  return lastActiveDay.getTime() >= expectedDate.getTime();
}

/**
 * Process streaks in batches to avoid memory issues
 * @param batchSize - Number of members to process per batch
 */
const BATCH_SIZE = 100;

/**
 * Calculate and update member engagement streaks
 *
 * Called daily at 00:05 UTC
 * - Processes all active/trialing members
 * - Validates streak based on weekday-only logic
 * - Resets broken streaks to 0
 * - Increments valid streaks by 1
 *
 * Note: Streak increment happens here, not when points are awarded.
 * The points service only updates lastActiveAt.
 */
export async function calculateStreaks(): Promise<StreakStats> {
  const startedAt = new Date();

  logger.info('Starting daily streak calculation');

  // Get today at midnight UTC
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Calculate expected active date (last weekday before today)
  const expectedActiveDate = getExpectedActiveDate(today);

  logger.debug(
    {
      today: today.toISOString(),
      expectedActiveDate: expectedActiveDate.toISOString(),
    },
    'Streak calculation dates'
  );

  // Fetch all active/trialing members
  const members = await prisma.member.findMany({
    where: {
      subscriptionStatus: { in: ['ACTIVE', 'TRIALING'] },
    },
    select: {
      id: true,
      currentStreak: true,
      lastActiveAt: true,
    },
  });

  const membersProcessed = members.length;
  let streaksIncremented = 0;
  let streaksReset = 0;
  let errors = 0;

  // Group members by action (increment vs reset)
  const membersToIncrement: string[] = [];
  const membersToReset: string[] = [];

  for (const member of members) {
    try {
      if (isStreakValid(member.lastActiveAt, expectedActiveDate)) {
        membersToIncrement.push(member.id);
      } else {
        // Only reset if they have a streak > 0
        if (member.currentStreak > 0) {
          membersToReset.push(member.id);
        }
      }
    } catch (error) {
      errors++;
      logger.error(
        { memberId: member.id, error: error instanceof Error ? error.message : error },
        'Error evaluating member streak'
      );
    }
  }

  // Batch update using transactions
  // Process increments in batches
  for (let i = 0; i < membersToIncrement.length; i += BATCH_SIZE) {
    const batch = membersToIncrement.slice(i, i + BATCH_SIZE);

    try {
      await prisma.$transaction(
        batch.map((memberId) =>
          prisma.member.update({
            where: { id: memberId },
            data: { currentStreak: { increment: 1 } },
          })
        )
      );
      streaksIncremented += batch.length;
    } catch (error) {
      errors += batch.length;
      logger.error(
        { batchStart: i, batchSize: batch.length, error: error instanceof Error ? error.message : error },
        'Error incrementing streak batch'
      );
    }
  }

  // Process resets in batches
  for (let i = 0; i < membersToReset.length; i += BATCH_SIZE) {
    const batch = membersToReset.slice(i, i + BATCH_SIZE);

    try {
      await prisma.$transaction(
        batch.map((memberId) =>
          prisma.member.update({
            where: { id: memberId },
            data: { currentStreak: 0 },
          })
        )
      );
      streaksReset += batch.length;
    } catch (error) {
      errors += batch.length;
      logger.error(
        { batchStart: i, batchSize: batch.length, error: error instanceof Error ? error.message : error },
        'Error resetting streak batch'
      );
    }
  }

  const completedAt = new Date();

  logger.info(
    {
      membersProcessed,
      streaksIncremented,
      streaksReset,
      errors,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    },
    'Daily streak calculation completed'
  );

  return {
    membersProcessed,
    streaksIncremented,
    streaksReset,
    errors,
  };
}

// Re-export types for consumers
export type { StreakStats } from './types.js';
