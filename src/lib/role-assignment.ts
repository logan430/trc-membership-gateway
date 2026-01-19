import pRetry from 'p-retry';
import { addRoleToMember, removeRoleFromMember, removeAllManagedRoles } from '../bot/roles.js';
import { discordClient } from '../bot/client.js';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';
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

/**
 * Swap role asynchronously with exponential backoff retry
 * Fire-and-forget: returns immediately, role swap happens in background
 * Atomically removes old role and adds new role
 */
export function swapRoleAsync(discordId: string, removeRole: string, addRole: string): void {
  pRetry(
    async () => {
      const removed = await removeRoleFromMember(discordId, removeRole);
      if (!removed) {
        throw new Error(`Failed to remove role ${removeRole}`);
      }
      const added = await addRoleToMember(discordId, addRole);
      if (!added) {
        throw new Error(`Failed to add role ${addRole}`);
      }
      return true;
    },
    {
      retries: 5,
      minTimeout: 1000,
      maxTimeout: 30000,
      onFailedAttempt: (error) => {
        logger.warn(
          { discordId, removeRole, addRole, attempt: error.attemptNumber, retriesLeft: error.retriesLeft },
          'Role swap retry'
        );
      },
    }
  ).then(() => {
    logger.info({ discordId, removeRole, addRole }, 'Role swapped successfully (async)');
  }).catch((error) => {
    logger.error({ discordId, removeRole, addRole, error: error.message }, 'Role swap failed after all retries');
  });
}

/**
 * Remove roles and kick member from server asynchronously
 * Fire-and-forget: returns immediately, removal happens in background
 */
export function removeAndKickAsync(discordId: string, memberId: string): void {
  (async () => {
    try {
      const guild = discordClient.guilds.cache.get(env.DISCORD_GUILD_ID);
      if (!guild) {
        logger.error('Guild not found in cache');
        return;
      }

      // Try to fetch the member (may have already left)
      let member;
      try {
        member = await guild.members.fetch(discordId);
      } catch {
        // Member not in server - just update database
        logger.debug({ discordId }, 'Member not in server, updating database only');
        await prisma.member.update({
          where: { id: memberId },
          data: {
            subscriptionStatus: 'CANCELLED',
            introCompleted: false,
          },
        });
        return;
      }

      // Send farewell DM (best effort, before kick)
      try {
        await member.user.send({
          content: `Hail, valued member of The Revenue Council!\n\n` +
            `Your time with our guild has come to an end, but you shall always be remembered.\n\n` +
            `Should you wish to return to our halls, The Gatekeeper awaits: ${env.APP_URL}\n\n` +
            `Fare thee well on your journey!`,
        });
      } catch {
        logger.debug({ discordId }, 'Could not send farewell DM');
      }

      // Remove all managed roles
      await removeAllManagedRoles(discordId);

      // Kick from server with retry
      await pRetry(
        () => member.kick('Subscription ended'),
        {
          retries: 3,
          minTimeout: 1000,
          onFailedAttempt: (error) => {
            logger.warn({ discordId, attempt: error.attemptNumber }, 'Kick retry');
          },
        }
      );

      // Update database
      await prisma.member.update({
        where: { id: memberId },
        data: {
          subscriptionStatus: 'CANCELLED',
          introCompleted: false,
        },
      });

      logger.info({ discordId, memberId }, 'Member removed from server');
    } catch (error) {
      logger.error({ discordId, memberId, error }, 'Failed to remove and kick member');
      // Don't throw from fire-and-forget
    }
  })();
}
