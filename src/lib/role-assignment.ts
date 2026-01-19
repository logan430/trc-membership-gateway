import pRetry from 'p-retry';
import { addRoleToMember } from '../bot/roles.js';
import { logger } from '../index.js';

/**
 * Assign role asynchronously with exponential backoff retry
 * Fire-and-forget: returns immediately, role assignment happens in background
 */
export function assignRoleAsync(discordId: string, roleName: string): void {
  pRetry(
    () => addRoleToMember(discordId, roleName),
    {
      retries: 5,
      minTimeout: 1000,
      maxTimeout: 30000,
      onFailedAttempt: (error) => {
        logger.warn(
          { discordId, roleName, attempt: error.attemptNumber, retriesLeft: error.retriesLeft },
          'Role assignment retry'
        );
      },
    }
  ).then((success) => {
    if (success) {
      logger.info({ discordId, roleName }, 'Role assigned successfully (async)');
    }
  }).catch((error) => {
    // After all retries exhausted - admin already alerted by addRoleToMember
    logger.error({ discordId, roleName, error: error.message }, 'Role assignment failed after all retries');
  });
}
