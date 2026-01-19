import cron from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../index.js';
import { runReconciliation } from './reconcile.js';

/**
 * Start the reconciliation scheduler
 * Runs daily at configured hour in configured timezone
 * Can be paused via RECONCILIATION_PAUSED env var
 */
export function startReconciliationScheduler(): void {
  const hour = env.RECONCILIATION_HOUR;
  const timezone = env.RECONCILIATION_TIMEZONE;
  const cronExpression = `0 ${hour} * * *`; // Daily at specified hour

  logger.info(
    { hour, timezone, cronExpression },
    'Starting reconciliation scheduler'
  );

  cron.schedule(
    cronExpression,
    async () => {
      // Check pause flag
      if (env.RECONCILIATION_PAUSED === 'true') {
        logger.info('Reconciliation paused via RECONCILIATION_PAUSED env var');
        return;
      }

      logger.info('Reconciliation job starting (scheduled)');

      try {
        const result = await runReconciliation({ triggeredBy: 'scheduled' });
        logger.info(
          { issuesFound: result.issuesFound, issuesFixed: result.issuesFixed },
          'Reconciliation job completed'
        );
      } catch (error) {
        logger.error({ error }, 'Reconciliation job failed');
      }
    },
    { timezone }
  );

  logger.info('Reconciliation scheduler started');
}

// Re-export for consumers
export { runReconciliation } from './reconcile.js';
export type { DriftIssue, ReconciliationResult, ReconciliationOptions } from './types.js';
