/**
 * Job Scheduler
 * Centralized background job management with graceful shutdown
 *
 * Jobs:
 * - MEE6 XP sync: Every 15 minutes
 * - Streak calculation: Daily at 00:05 UTC
 *
 * Graceful shutdown:
 * - All jobs can be stopped via stopJobScheduler()
 * - Called during application shutdown (SIGTERM/SIGINT)
 */

import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../index.js';
import { syncMee6Xp } from './mee6-sync.js';
import { calculateStreaks } from './streak-calculator.js';

// Track scheduled tasks for graceful shutdown
const scheduledTasks: ScheduledTask[] = [];

/**
 * Start the job scheduler
 * Registers all background jobs and begins execution
 */
export function startJobScheduler(): void {
  logger.info('Starting job scheduler');

  // MEE6 XP sync job - every 15 minutes
  // Cron: */15 * * * * (at minute 0, 15, 30, 45)
  const mee6Job = cron.schedule('*/15 * * * *', async () => {
    try {
      const stats = await syncMee6Xp();
      logger.info(
        {
          totalMembers: stats.totalMembers,
          membersInMee6: stats.membersInMee6,
          pointsAwarded: stats.pointsAwarded,
          pointsDeducted: stats.pointsDeducted,
          errors: stats.errors,
        },
        'MEE6 sync completed'
      );
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? { message: error.message, stack: error.stack } : error },
        'MEE6 sync job failed'
      );
      // Sentry captures via existing integration in error logging
    }
  });
  scheduledTasks.push(mee6Job);
  logger.info({ cron: '*/15 * * * *' }, 'MEE6 sync job scheduled');

  // Streak calculation job - daily at 00:05 UTC
  // Cron: 5 0 * * * (at 00:05 UTC)
  // Runs slightly after midnight to ensure all day's activity is recorded
  const streakJob = cron.schedule(
    '5 0 * * *',
    async () => {
      try {
        const stats = await calculateStreaks();
        logger.info(
          {
            membersProcessed: stats.membersProcessed,
            streaksIncremented: stats.streaksIncremented,
            streaksReset: stats.streaksReset,
            errors: stats.errors,
          },
          'Streak calculation completed'
        );
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? { message: error.message, stack: error.stack } : error },
          'Streak calculation job failed'
        );
        // Sentry captures via existing integration in error logging
      }
    },
    { timezone: 'UTC' }
  );
  scheduledTasks.push(streakJob);
  logger.info({ cron: '5 0 * * *', timezone: 'UTC' }, 'Streak calculation job scheduled');

  logger.info({ jobCount: scheduledTasks.length }, 'Job scheduler started');
}

/**
 * Stop the job scheduler
 * Gracefully stops all scheduled jobs
 */
export function stopJobScheduler(): void {
  logger.info({ jobCount: scheduledTasks.length }, 'Stopping job scheduler');

  for (const task of scheduledTasks) {
    task.stop();
  }

  // Clear the array
  scheduledTasks.length = 0;

  logger.info('Job scheduler stopped');
}

// Re-export job functions for direct invocation (testing, manual runs)
export { syncMee6Xp } from './mee6-sync.js';
export { calculateStreaks } from './streak-calculator.js';

// Re-export types
export type { SyncStats, StreakStats } from './types.js';
